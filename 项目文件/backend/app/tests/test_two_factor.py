"""双因素认证（2FA）测试。"""

import pyotp
import pytest


def _otp_code(secret: str) -> str:
    """用明文密钥计算当前 6 位动态码。"""
    return pyotp.TOTP(secret).now()


def _login(client, username, password):
    return client.post(
        "/api/v1/auth/login", json={"username": username, "password": password}
    )


@pytest.mark.asyncio
async def test_login_no_2fa_returns_tokens(client, seeded_user):
    """未启用 2FA：登录直接返回正式令牌，pending_2fa=False。"""
    resp = await _login(client, "member01", "member123")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["pending_2fa"] is False
    assert data["access_token"]
    assert data["refresh_token"]


@pytest.mark.asyncio
async def test_setup_requires_password(client, member_token):
    """绑定设备需校验登录密码，错误密码返回 401。"""
    resp = await client.post(
        "/api/v1/auth/2fa/setup",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "wrong", "label": "我的手机"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_setup_and_activate_then_login_pending(client, member_token):
    """绑定并激活设备后，登录返回 pending_2fa=True。"""
    setup = await client.post(
        "/api/v1/auth/2fa/setup",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123", "label": "我的手机"},
    )
    assert setup.status_code == 200
    sdata = setup.json()["data"]
    assert "secret" in sdata and "otpauth_uri" in sdata
    device_id = sdata["device_id"]

    # 未激活前，2FA 未生效
    resp = await _login(client, "member01", "member123")
    assert resp.json()["data"]["pending_2fa"] is False

    # 激活设备
    act = await client.post(
        "/api/v1/auth/2fa/activate",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"device_id": device_id, "code": _otp_code(sdata["secret"])},
    )
    assert act.status_code == 200

    # 激活后登录需二次验证
    resp = await _login(client, "member01", "member123")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["pending_2fa"] is True
    assert data["access_token"] is None
    assert data["pending_token"]


@pytest.mark.asyncio
async def test_verify_2fa_with_totp(client, member_token):
    """用正确动态码完成二次验证，签发正式令牌。"""
    setup = await client.post(
        "/api/v1/auth/2fa/setup",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123", "label": "手机"},
    )
    device_id = setup.json()["data"]["device_id"]
    secret = setup.json()["data"]["secret"]
    await client.post(
        "/api/v1/auth/2fa/activate",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"device_id": device_id, "code": _otp_code(secret)},
    )

    login = await _login(client, "member01", "member123")
    pending_token = login.json()["data"]["pending_token"]

    resp = await client.post(
        "/api/v1/auth/verify-2fa",
        json={"pending_token": pending_token, "code": _otp_code(secret)},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["pending_2fa"] is False
    assert data["access_token"]
    assert data["refresh_token"]


@pytest.mark.asyncio
async def test_verify_2fa_wrong_code(client, member_token):
    """动态码错误：二次验证返回 401。"""
    setup = await client.post(
        "/api/v1/auth/2fa/setup",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123", "label": "手机"},
    )
    device_id = setup.json()["data"]["device_id"]
    secret = setup.json()["data"]["secret"]
    await client.post(
        "/api/v1/auth/2fa/activate",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"device_id": device_id, "code": _otp_code(secret)},
    )

    login = await _login(client, "member01", "member123")
    pending_token = login.json()["data"]["pending_token"]

    resp = await client.post(
        "/api/v1/auth/verify-2fa",
        json={"pending_token": pending_token, "code": "000000"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_recovery_codes_one_time(client, member_token, db):
    """恢复码：可登录一次，重复使用失效。"""
    # 先绑定并激活设备，使登录进入二次验证
    setup = await client.post(
        "/api/v1/auth/2fa/setup",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123", "label": "手机"},
    )
    device_id = setup.json()["data"]["device_id"]
    secret = setup.json()["data"]["secret"]
    await client.post(
        "/api/v1/auth/2fa/activate",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"device_id": device_id, "code": _otp_code(secret)},
    )

    # 生成恢复码
    resp = await client.post(
        "/api/v1/auth/2fa/recovery-codes",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123"},
    )
    assert resp.status_code == 200
    codes = resp.json()["data"]["codes"]
    assert len(codes) == 10
    first = codes[0]

    # 2FA 已启用，登录进入第二步
    login = await _login(client, "member01", "member123")
    assert login.json()["data"]["pending_2fa"] is True
    pending_token = login.json()["data"]["pending_token"]

    # 用恢复码完成验证
    ok = await client.post(
        "/api/v1/auth/verify-2fa",
        json={"pending_token": pending_token, "code": first},
    )
    assert ok.status_code == 200

    # 恢复码已使用，二次使用应失败
    login2 = await _login(client, "member01", "member123")
    pending2 = login2.json()["data"]["pending_token"]
    again = await client.post(
        "/api/v1/auth/verify-2fa",
        json={"pending_token": pending2, "code": first},
    )
    assert again.status_code == 401


@pytest.mark.asyncio
async def test_status_and_disable(client, member_token):
    """状态查询与关闭 2FA。"""
    # 初始：未启用
    st = await client.get(
        "/api/v1/auth/2fa/status",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    sdata = st.json()["data"]
    assert sdata["enabled"] is False
    assert sdata["device_count"] == 0

    # 绑定并激活一个设备
    setup = await client.post(
        "/api/v1/auth/2fa/setup",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123", "label": "手机"},
    )
    device_id = setup.json()["data"]["device_id"]
    secret = setup.json()["data"]["secret"]
    await client.post(
        "/api/v1/auth/2fa/activate",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"device_id": device_id, "code": _otp_code(secret)},
    )

    st = await client.get(
        "/api/v1/auth/2fa/status",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    sdata = st.json()["data"]
    assert sdata["enabled"] is True
    assert sdata["device_count"] == 1

    # 错误密码无法关闭
    bad = await client.post(
        "/api/v1/auth/2fa/disable",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "wrong"},
    )
    assert bad.status_code == 401

    # 正确密码关闭
    off = await client.post(
        "/api/v1/auth/2fa/disable",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123"},
    )
    assert off.status_code == 200

    st = await client.get(
        "/api/v1/auth/2fa/status",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert st.json()["data"]["enabled"] is False

    # 关闭后登录不再需要二次验证
    login = await _login(client, "member01", "member123")
    assert login.json()["data"]["pending_2fa"] is False


@pytest.mark.asyncio
async def test_remove_device_requires_password(client, member_token):
    """解绑设备需校验登录密码。"""
    setup = await client.post(
        "/api/v1/auth/2fa/setup",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123", "label": "手机"},
    )
    device_id = setup.json()["data"]["device_id"]
    secret = setup.json()["data"]["secret"]
    await client.post(
        "/api/v1/auth/2fa/activate",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"device_id": device_id, "code": _otp_code(secret)},
    )

    # 错误密码
    bad = await client.post(
        f"/api/v1/auth/2fa/devices/{device_id}/remove",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "wrong"},
    )
    assert bad.status_code == 401

    # 正确密码
    ok = await client.post(
        f"/api/v1/auth/2fa/devices/{device_id}/remove",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"password": "member123"},
    )
    assert ok.status_code == 200

    devices = await client.get(
        "/api/v1/auth/2fa/devices",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert devices.json()["data"] == []