"""双因素认证（TOTP）业务逻辑：设备绑定、恢复码、登录校验。"""

import secrets
import uuid
from datetime import UTC, datetime

import pyotp
from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.encryption import decrypt_data, encrypt_data
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.user_recovery_code import UserRecoveryCode
from app.models.user_totp import UserTotp

# 认证器显示名称（otpauth URI 的 issuer）—— 默认值，未配置 custom_config 时使用
DEFAULT_ISSUER = "一站式工作台"


async def get_app_name(db: AsyncSession) -> str:
    """从站点自定义配置读取应用名称，未设置则返回默认值。"""
    from app.services.system_config import get_config

    cfg = await get_config(db, "custom_config") or {}
    return cfg.get("app_name") or DEFAULT_ISSUER


# 每批生成的恢复码数量
RECOVERY_CODE_COUNT = 10
# 恢复码分组长度（如 XXXX-XXXX-XXXX 共 3 组 4 位）
RECOVERY_GROUPS = 3
RECOVERY_GROUP_SIZE = 4
# 排除易混淆字符（0/O、1/I/L）
_RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _encrypt_secret(secret: str) -> str:
    """用 AES-256-GCM 加密 TOTP 密钥，返回 hex 编码密文。"""
    settings = get_settings()
    return encrypt_data({"s": secret}, settings.ENCRYPTION_MASTER_KEY).hex()


def _decrypt_secret(secret_encrypted: str) -> str:
    """解密 TOTP 密钥。"""
    settings = get_settings()
    value = decrypt_data(
        bytes.fromhex(secret_encrypted), settings.ENCRYPTION_MASTER_KEY
    )
    return str(value["s"])


def generate_secret() -> str:
    """生成随机的 Base32 TOTP 密钥。"""
    return pyotp.random_base32()


def build_otpauth_uri(secret: str, account: str, issuer_name: str | None = None) -> str:
    """构建 otpauth:// 链接（供认证器扫码）。issuer_name 为空时使用默认值。"""
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=account, issuer_name=issuer_name or DEFAULT_ISSUER
    )


def verify_totp(secret: str, code: str) -> bool:
    """校验 6 位动态码，容忍前后各一个时间窗的轻微时钟偏差。"""
    code = code.strip()
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)


def _generate_recovery_code() -> str:
    """生成一个恢复码，形如 XXXX-XXXX-XXXX。"""
    groups = []
    for _ in range(RECOVERY_GROUPS):
        group = "".join(secrets.choice(_RECOVERY_ALPHABET) for _ in range(RECOVERY_GROUP_SIZE))
        groups.append(group)
    return "-".join(groups)


def _normalize_recovery_code(code: str) -> str:
    """规范化用户输入的恢复码：去空白、去分隔符、转大写。"""
    return "".join(code.split()).upper().replace("-", "")


async def has_active_devices(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """判断用户是否已启用 2FA（存在至少一个已激活 TOTP 设备）。"""
    result = await db.execute(
        select(UserTotp.id).where(
            UserTotp.user_id == user_id, UserTotp.is_active.is_(True)
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def create_pending_device(
    db: AsyncSession, user: User, label: str
) -> tuple[UserTotp, str, str]:
    """为当前用户创建一个待激活的 TOTP 设备。

    返回 (设备记录, 明文密钥, otpauth URI)。明文密钥仅此一次返回给前端展示。
    """
    secret = generate_secret()
    device = UserTotp(
        user_id=user.id,
        secret_encrypted=_encrypt_secret(secret),
        label=label.strip() or "认证器",
        is_active=False,
    )
    db.add(device)
    await db.flush()
    issuer_name = await get_app_name(db)
    uri = build_otpauth_uri(secret, user.username, issuer_name)
    return device, secret, uri


async def get_owned_device(db: AsyncSession, user_id: uuid.UUID, device_id: uuid.UUID) -> UserTotp:
    """按 id 获取属于指定用户的 TOTP 设备。"""
    result = await db.execute(
        select(UserTotp).where(UserTotp.id == device_id, UserTotp.user_id == user_id)
    )
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="认证器设备不存在")
    return device


async def verify_and_activate_device(
    db: AsyncSession, user: User, device_id: uuid.UUID, code: str
) -> bool:
    """校验动态码并激活指定待绑定设备。"""
    device = await get_owned_device(db, user.id, device_id)
    if device.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该设备已激活")
    secret = _decrypt_secret(device.secret_encrypted)
    if not verify_totp(secret, code):
        return False
    device.is_active = True
    return True


async def list_active_devices(db: AsyncSession, user_id: uuid.UUID) -> list[UserTotp]:
    """列出用户已激活的 TOTP 设备（不返回密钥）。"""
    result = await db.execute(
        select(UserTotp)
        .where(UserTotp.user_id == user_id, UserTotp.is_active.is_(True))
        .order_by(UserTotp.created_at.asc())
    )
    return list(result.scalars().all())


async def remove_device(db: AsyncSession, user_id: uuid.UUID, device_id: uuid.UUID) -> None:
    """删除用户的某个 TOTP 设备（含未激活的待绑定设备）。"""
    device = await get_owned_device(db, user_id, device_id)
    await db.delete(device)


async def delete_recovery_codes(db: AsyncSession, user_id: uuid.UUID) -> None:
    """删除用户全部恢复码。"""
    await db.execute(
        delete(UserRecoveryCode).where(UserRecoveryCode.user_id == user_id)
    )


async def remove_all_active_devices(db: AsyncSession, user_id: uuid.UUID) -> None:
    """删除用户全部已激活 TOTP 设备（用于关闭 2FA）。"""
    await db.execute(
        delete(UserTotp).where(
            UserTotp.user_id == user_id, UserTotp.is_active.is_(True)
        )
    )


async def mark_device_used(db: AsyncSession, device: UserTotp) -> None:
    """更新设备最后使用时间。"""
    device.last_used_at = datetime.now(UTC)
    await db.flush()


async def generate_recovery_codes(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    """生成一批新的恢复码，旧批次全部作废。返回明文恢复码（仅此一次）。

    恢复码以 bcrypt 哈希存储，未使用状态；验证通过后标记 used_at。
    """
    await db.execute(
        delete(UserRecoveryCode).where(UserRecoveryCode.user_id == user_id)
    )
    codes: list[str] = []
    for _ in range(RECOVERY_CODE_COUNT):
        code = _generate_recovery_code()
        codes.append(code)
        # 哈希统一使用规范化形式（去分隔符大写），与校验时一致
        db.add(
            UserRecoveryCode(
                user_id=user_id, code_hash=hash_password(_normalize_recovery_code(code))
            )
        )
    await db.flush()
    return codes


async def count_unused_recovery_codes(db: AsyncSession, user_id: uuid.UUID) -> int:
    """统计用户未使用的恢复码数量。"""
    result = await db.execute(
        select(UserRecoveryCode.id).where(
            UserRecoveryCode.user_id == user_id, UserRecoveryCode.used_at.is_(None)
        )
    )
    return len(list(result.scalars().all()))


async def verify_and_get_device(
    db: AsyncSession, user_id: uuid.UUID, code: str
) -> UserTotp | None:
    """在所有已激活设备上校验动态码，返回命中的设备（供更新最后使用时间）。"""
    result = await db.execute(
        select(UserTotp).where(
            UserTotp.user_id == user_id, UserTotp.is_active.is_(True)
        )
    )
    for device in list(result.scalars().all()):
        if verify_totp(_decrypt_secret(device.secret_encrypted), code):
            return device
    return None


async def verify_recovery_code(db: AsyncSession, user_id: uuid.UUID, code: str) -> bool:
    """校验一次性恢复码；命中则标记为已使用。"""
    normalized = _normalize_recovery_code(code)
    result = await db.execute(
        select(UserRecoveryCode).where(
            UserRecoveryCode.user_id == user_id,
            UserRecoveryCode.used_at.is_(None),
        )
    )
    for record in list(result.scalars().all()):
        if verify_password(normalized, record.code_hash):
            record.used_at = datetime.now(UTC)
            return True
    return False
