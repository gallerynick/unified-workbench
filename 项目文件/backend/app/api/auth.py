"""认证 API 路由。"""


from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import decode_token, verify_password
from app.core.websocket import SESSION_ALERT, manager
from app.models.user import User
from app.models.user_session import UserSession
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    PasswordVerifyRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    TokenResponse,
    Verify2FARequest,
)
from app.schemas.common import UnifiedResponse
from app.schemas.user import UserResponse
from app.services.auth import change_password, login, refresh_access_token, verify_2fa
from app.services.system_config import get_config, update_config

router = APIRouter()

# 与 deps.get_current_user 共用同一个 Bearer 解析器实例
_bearer = HTTPBearer(auto_error=False)


def _client_ip(req: Request) -> str | None:
    """取客户端真实 IP。

    经 nginx 反代时取 X-Real-IP（由 $remote_addr 写入，客户端无法伪造）；
    直连 uvicorn 时退回 request.client.host。

    不能直接用 request.client.host：uvicorn 未启用 --proxy-headers，
    该值恒为容器网桥 IP（172.18.0.x），区分不出真实来源。
    与 api/forms.py 的同名助手保持一致（实现相同，后续可抽到公共模块）。
    """
    real = req.headers.get("x-real-ip")
    if real:
        return real.strip()
    return req.client.host if req.client else None


@router.post("/login", response_model=UnifiedResponse[LoginResponse])
async def login_endpoint(request: LoginRequest, req: Request, db: AsyncSession = Depends(get_db)):
    """用户登录。未启用 2FA 直接返回令牌；已启用则返回 pending 令牌进入二次验证。"""
    ip = _client_ip(req)
    user_agent = req.headers.get("User-Agent", "")
    device_token = req.headers.get("X-Device-Token", "")
    tokens = await login(db, request, ip, user_agent, device_token)
    return UnifiedResponse(data=tokens)


@router.post("/verify-2fa", response_model=UnifiedResponse[LoginResponse])
async def verify_2fa_endpoint(
    request: Verify2FARequest, req: Request, db: AsyncSession = Depends(get_db)
):
    """登录第二步：用动态码或恢复码完成二次验证并签发正式令牌。"""
    ip = _client_ip(req)
    user_agent = req.headers.get("User-Agent", "")
    device_token = req.headers.get("X-Device-Token", "")
    tokens = await verify_2fa(db, request, ip, user_agent, device_token)
    return UnifiedResponse(data=tokens)


@router.post("/refresh", response_model=UnifiedResponse[TokenResponse])
async def refresh_endpoint(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """刷新访问令牌。"""
    tokens = await refresh_access_token(db, request)
    return UnifiedResponse(data=tokens)


@router.post("/logout", response_model=UnifiedResponse[dict])
async def logout_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
):
    """退出当前登录：撤销本次会话。

    只清浏览器本地令牌是不够的——user_session.is_revoked 若保持 false，
    后端仍会把它计入「其他在线会话」，F1 并发登录提示永远不会消失。
    这里把当前会话标记为已撤销，deps.get_current_user 会按 jti 反查拦截
    该令牌后续请求（即强制下线）。

    幂等：会话不存在或已撤销时同样返回成功，登出不应因重试而报错。
    """
    jti: str | None = None
    if credentials:
        try:
            jti = decode_token(credentials.credentials).get("jti")
        except Exception:
            jti = None

    revoked = False
    if jti:
        result = await db.execute(
            update(UserSession)
            .where(
                UserSession.user_id == current_user.id,
                UserSession.jti == jti,
                UserSession.is_revoked == False,  # noqa: E712
            )
            .values(is_revoked=True)
        )
        revoked = (result.rowcount or 0) > 0
        await db.commit()

        # F1 并发登录提示的实时推送：本会话已撤销，通知该用户其余在线连接
        # 立即重算并发数。用户报障的「A 登出后 B 的提示不消失，刷新才消失」
        # 根因就是这里缺了主动通知，只能等轮询周期。
        try:
            await manager.send_to_user(current_user.id, SESSION_ALERT)
        except Exception:  # noqa: BLE001
            pass

    return UnifiedResponse(data={"revoked": revoked})


@router.get("/me", response_model=UnifiedResponse[UserResponse])
async def get_me_endpoint(current_user: User = Depends(get_current_user)):
    """获取当前用户信息。"""
    return UnifiedResponse(data=UserResponse.model_validate(current_user))


@router.put("/me", response_model=UnifiedResponse[UserResponse])
async def update_me_endpoint(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户信息（昵称、头像）。"""
    if request.nickname is not None:
        current_user.nickname = request.nickname
    if request.email is not None:
        current_user.email = request.email
    if request.phone is not None:
        current_user.phone = request.phone
    if request.gender is not None:
        current_user.gender = request.gender
    if "avatar" in request.model_fields_set:
        current_user.avatar = request.avatar
    await db.flush()
    # 只重载 tags 关系：全量 refresh 会过期关系属性，序列化时再次触发 async 惰性加载（greenlet 错误）
    await db.refresh(current_user, attribute_names=["tags"])
    return UnifiedResponse(data=UserResponse.model_validate(current_user))


@router.put("/me/password", response_model=UnifiedResponse[None])
async def change_password_endpoint(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改当前用户密码。"""
    await change_password(db, current_user, request)
    return UnifiedResponse(msg="密码修改成功")


@router.post("/verify-password", response_model=UnifiedResponse[dict])
async def verify_password_endpoint(
    request: PasswordVerifyRequest,
    current_user: User = Depends(get_current_user),
):
    """验证当前用户登录密码"""
    valid = verify_password(request.password, current_user.password_hash)
    return UnifiedResponse(data={"valid": valid})


SETUP_COMPLETE_KEY = "setup_complete"


@router.get("/setup-status", response_model=UnifiedResponse[dict])
async def get_setup_status_endpoint(
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """获取系统初始化状态（公开接口，无需登录）。

    强制 no-store 头防止 Safari/Edge 对 {complete: false} 做启发式缓存，
    避免完成初始化后仍反复跳转 Welcome 页面。
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    value = await get_config(db, SETUP_COMPLETE_KEY)
    complete = value.get("complete", False) if value else False
    return UnifiedResponse(data={"complete": complete})


@router.post("/setup-complete", response_model=UnifiedResponse[dict])
async def mark_setup_complete_endpoint(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """标记系统初始化完成（任何已认证用户可调用，替代仅管理员的 system-config PUT）。"""
    config = await update_config(db, SETUP_COMPLETE_KEY, {"complete": True})
    return UnifiedResponse(data={"complete": config.value.get("complete", True) if config else True})


class InitialSetupRequest(BaseModel):
    """初始设置请求（创建首个管理员）"""
    username: str
    password: str
    nickname: str = "管理员"


@router.post("/initial-setup", response_model=UnifiedResponse[dict])
async def initial_setup_endpoint(
    request: InitialSetupRequest,
    db: AsyncSession = Depends(get_db),
):
    """初始化系统：创建首个管理员账号并标记设置完成（公开接口）"""
    from sqlalchemy import text

    from app.core.security import hash_password, validate_password_strength
    from app.models.user import User, UserRole, UserStatus

    # 1. 检查是否已初始化（通过 setup_complete 标记而非用户数）
    from app.services.system_config import get_config
    config = await get_config(db, SETUP_COMPLETE_KEY)
    if config and config.get("complete") is True:
        return {"code": 1, "msg": "系统已初始化", "data": None}

    # 2. 清除 seed 创建的默认用户，替换为请求中指定的管理员
    await db.execute(text("DELETE FROM \"user\""))

    # 3. 验证用户名和密码
    if len(request.username) < 3 or len(request.username) > 50:
        return {"code": 1, "msg": "用户名长度需在 3-50 个字符", "data": None}
    if not validate_password_strength(request.password):
        return {"code": 1, "msg": "密码至少 8 位，必须包含字母和数字", "data": None}

    # 3. 创建管理员账号
    admin = User(
        username=request.username,
        password_hash=hash_password(request.password),
        nickname=request.nickname,
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(admin)

    # 4. 标记设置完成
    await update_config(db, SETUP_COMPLETE_KEY, {"complete": True})
    await db.commit()

    return UnifiedResponse(msg="初始化完成，请登录")
