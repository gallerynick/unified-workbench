"""笔记模块回归测试。

8 个基线场景：创建、详情、更新、删除、列表分页、置顶排序、
循环挂载拦截、可见性三态读权限（private / public / restricted）。

可见性用例中，NoteCreate/NoteUpdate 至今不含 visibility / restricted_users
字段（写侧尚未开放），因此 public 与 restricted 两态改用 db fixture 直接
插入 Note 行来构造，绕过 API 写入限制。
"""

import uuid

import pytest


async def _create_note(client, token, **overrides):
    """辅助：经 API 创建一篇笔记，返回解析后的 JSON 响应。"""
    payload = {"title": "默认标题"}
    payload.update(overrides)
    resp = await client.post(
        "/api/v1/notes/",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert resp.status_code == 200
    return resp.json()


async def _insert_note(db, owner, **overrides):
    """辅助：直接插入一篇笔记，用于构造 API 写侧无法表达的可见性。

    返回已 flush 的 Note 实例。
    """
    from app.models.note import Note

    note = Note(owner_id=owner.id, title="默认标题")
    for key, value in overrides.items():
        setattr(note, key, value)
    db.add(note)
    await db.flush()
    return note


@pytest.mark.asyncio
async def test_create_note(client, member_token):
    """创建成功：code==0、title 回显、visibility 默认 private、id 存在。

    同时断言 NoteResponse 确实暴露了 restricted_users 键——T0.1 的核心意图是
    让前端读得到真实可见性值，而不是回退到前端默认值。
    """
    resp = await client.post(
        "/api/v1/notes/",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"title": "第一篇笔记", "content": "hello"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["title"] == "第一篇笔记"
    assert data["data"]["visibility"] == "private"
    assert data["data"]["id"]
    assert "restricted_users" in data["data"]


@pytest.mark.asyncio
async def test_get_note(client, member_token):
    """创建后取详情，id 与 title 一致。"""
    created = await _create_note(client, member_token, title="详情目标")
    note_id = created["data"]["id"]

    resp = await client.get(
        f"/api/v1/notes/{note_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["id"] == note_id
    assert data["data"]["title"] == "详情目标"


@pytest.mark.asyncio
async def test_update_note(client, member_token):
    """更新 title 成功。"""
    created = await _create_note(client, member_token, title="旧标题")
    note_id = created["data"]["id"]

    resp = await client.put(
        f"/api/v1/notes/{note_id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"title": "新标题"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["title"] == "新标题"


@pytest.mark.asyncio
async def test_delete_note(client, member_token):
    """删除成功，再取详情明确返回 404。"""
    created = await _create_note(client, member_token, title="待删除")
    note_id = created["data"]["id"]

    resp = await client.delete(
        f"/api/v1/notes/{note_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["code"] == 0

    get_resp = await client.get(
        f"/api/v1/notes/{note_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_list_notes_pagination(client, member_token):
    """创建 3 篇，分页 page=1&page_size=2：total==3、items 长度==2。"""
    for i in range(3):
        await _create_note(client, member_token, title=f"分页笔记 {i}")

    resp = await client.get(
        "/api/v1/notes/",
        params={"page": 1, "page_size": 2},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0
    assert data["data"]["total"] == 3
    assert len(data["data"]["items"]) == 2


@pytest.mark.asyncio
async def test_pinned_sort(client, member_token):
    """置顶一条后排首位，未置顶的排在其后。"""
    created_a = await _create_note(client, member_token, title="普通A")
    # 再建一篇未置顶笔记作为对照：若列表只有 A 一条，置顶断言会平凡通过
    created_b = await _create_note(client, member_token, title="普通B")
    pinned_id = created_a["data"]["id"]
    other_id = created_b["data"]["id"]

    # 置顶其中一篇
    pin_resp = await client.put(
        f"/api/v1/notes/{pinned_id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"is_pinned": True},
    )
    assert pin_resp.status_code == 200

    list_resp = await client.get(
        "/api/v1/notes/",
        params={"page": 1, "page_size": 10},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert list_resp.status_code == 200
    items = list_resp.json()["data"]["items"]
    assert len(items) == 2
    assert items[0]["id"] == pinned_id
    assert items[0]["is_pinned"] is True
    assert items[1]["id"] == other_id
    assert items[1]["is_pinned"] is False


@pytest.mark.asyncio
async def test_move_circular_raises(client, member_token):
    """A 已在 B 下，再把 B 挂到 A 下形成循环，move 端点应返回 400。"""
    created_a = await _create_note(client, member_token, title="A")
    created_b = await _create_note(client, member_token, title="B")
    a_id = created_a["data"]["id"]
    b_id = created_b["data"]["id"]

    # 第一步：把 A 移到 B 下面（合法），并确认确实生效
    move1 = await client.put(
        f"/api/v1/notes/{a_id}/move",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"parent_id": b_id},
    )
    assert move1.status_code == 200
    assert move1.json()["data"]["parent_id"] == b_id

    # 第二步：把 B 移到 A 下面（形成 A -> B -> A 循环）
    move2 = await client.put(
        f"/api/v1/notes/{b_id}/move",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"parent_id": a_id},
    )
    assert move2.status_code == 400


@pytest.mark.asyncio
async def test_visibility_private_invisible_to_others(
    client, admin_token, member_token
):
    """private：owner 可见，他人取详情返回 403。"""
    # NoteCreate 不含 visibility 字段，数据库 server_default 即为 "private"
    created = await _create_note(client, admin_token, title="admin私有")
    note_id = created["data"]["id"]

    resp = await client.get(
        f"/api/v1/notes/{note_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_visibility_public_readable_by_others(
    client, db, seeded_admin, member_token
):
    """public：非 owner 也能取详情，返回 200。"""
    note = await _insert_note(db, seeded_admin, title="公开笔记", visibility="public")

    resp = await client.get(
        f"/api/v1/notes/{note.id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["visibility"] == "public"


@pytest.mark.asyncio
async def test_visibility_restricted_authorized_readable(
    client, db, seeded_admin, seeded_user, member_token
):
    """restricted：被授权者取详情返回 200。"""
    note = await _insert_note(
        db,
        seeded_admin,
        title="受限笔记",
        visibility="restricted",
        restricted_users=[str(seeded_user.id)],
    )

    resp = await client.get(
        f"/api/v1/notes/{note.id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["visibility"] == "restricted"


@pytest.mark.asyncio
async def test_visibility_restricted_unauthorized_forbidden(
    client, db, seeded_admin, member_token
):
    """restricted：未被授权者取详情返回 403。"""
    note = await _insert_note(
        db,
        seeded_admin,
        title="受限笔记-未授权",
        visibility="restricted",
        # 授权给一个不存在的用户，确保 member_token 对应的用户不在其中
        restricted_users=[str(uuid.uuid4())],
    )

    resp = await client.get(
        f"/api/v1/notes/{note.id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 403
