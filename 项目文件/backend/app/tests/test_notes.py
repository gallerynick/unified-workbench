"""笔记模块回归测试。

覆盖场景：创建、详情、更新、删除、列表分页、置顶排序、文件夹 CRUD 与
多对多归属（按文件夹过滤列表、删除文件夹不删笔记）、可见性三态读权限
（private / public / restricted）、Tiptap body 与 plain_text 派生、
restricted_tags 读写、搜索覆盖文件夹名称与简介。

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
async def test_folder_crud_and_membership(client, member_token):
    """文件夹 CRUD + 笔记多对多归属。

    覆盖：一篇笔记可属于多个文件夹（重复 id 去重）、列表可见笔记数、
    按文件夹过滤列表、移出全部文件夹、删除文件夹不删笔记、改名生效。
    """
    note = await _create_note(client, member_token, title="归属笔记")
    note_id = note["data"]["id"]

    f1 = await client.post(
        "/api/v1/notes/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"name": "工作", "description": "日常事务"},
    )
    assert f1.status_code == 200
    d1 = f1.json()["data"]
    assert d1["note_count"] == 0

    f2 = await client.post(
        "/api/v1/notes/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"name": "生活"},
    )
    d2 = f2.json()["data"]

    # 全量替换归属：重复 id 去重，回显为两个文件夹
    set1 = await client.put(
        f"/api/v1/notes/{note_id}/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"folder_ids": [d1["id"], d2["id"], d1["id"]]},
    )
    assert set1.status_code == 200
    assert {f["name"] for f in set1.json()["data"]["folders"]} == {"工作", "生活"}

    # 列表附带可见笔记数
    folders = await client.get(
        "/api/v1/notes/folders",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    counts = {f["name"]: f["note_count"] for f in folders.json()["data"]["items"]}
    assert counts["工作"] == 1
    assert counts["生活"] == 1

    # 按文件夹过滤列表
    filtered = await client.get(
        "/api/v1/notes/",
        params={"folder_id": d1["id"]},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert filtered.status_code == 200
    assert [n["id"] for n in filtered.json()["data"]["items"]] == [note_id]

    # 移出全部文件夹：笔记变为顶级
    set2 = await client.put(
        f"/api/v1/notes/{note_id}/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"folder_ids": []},
    )
    assert set2.status_code == 200
    assert set2.json()["data"]["folders"] == []

    # 重挂后删除文件夹：关联清除，笔记本身保留
    await client.put(
        f"/api/v1/notes/{note_id}/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"folder_ids": [d1["id"]]},
    )
    dele = await client.delete(
        f"/api/v1/notes/folders/{d1['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert dele.status_code == 200
    detail = await client.get(
        f"/api/v1/notes/{note_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert detail.status_code == 200
    assert detail.json()["data"]["folders"] == []

    # 改名生效
    patch = await client.patch(
        f"/api/v1/notes/folders/{d2['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"name": "生活方式"},
    )
    assert patch.status_code == 200
    assert patch.json()["data"]["name"] == "生活方式"


@pytest.mark.asyncio
async def test_set_note_folders_rejects_unknown_folder(client, member_token):
    """传入不存在的文件夹 id 返回 400，且不产生任何归属。"""
    note = await _create_note(client, member_token, title="笔记")
    resp = await client.put(
        f"/api/v1/notes/{note['data']['id']}/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"folder_ids": [str(uuid.uuid4())]},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_move_endpoint_removed(client, member_token):
    """父子嵌套已废弃，原 /move 端点应返回 404（路径参数无法匹配笔记 id）。"""
    created = await _create_note(client, member_token, title="笔记")
    resp = await client.put(
        f"/api/v1/notes/{created['data']['id']}/move",
        headers={"Authorization": f"Bearer {member_token}"},
        json={},
    )
    assert resp.status_code == 404



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


# ── Tiptap body 与 plain_text 派生 ────────────────────────────────────


def _tiptap_body(paragraphs):
    """辅助：构造最小的 Tiptap 文档树。"""
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": p}],
            }
            for p in paragraphs
        ],
    }


@pytest.mark.asyncio
async def test_create_note_with_body_derives_plain_text(client, member_token):
    """创建时带 body：body 原样回显，plain_text 由服务端从 body 派生。"""
    body = _tiptap_body(["第一段", "第二段"])
    resp = await client.post(
        "/api/v1/notes/",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"title": "富文本笔记", "body": body},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["body"] == body
    assert data["plain_text"] == "第一段\n\n第二段"


@pytest.mark.asyncio
async def test_update_note_body_recomputes_plain_text(client, member_token):
    """更新 body 后 plain_text 必须同步重算，否则搜索会读到旧值。"""
    created = await _create_note(
        client, member_token, title="待改正文", body=_tiptap_body(["旧正文"])
    )
    assert created["data"]["plain_text"] == "旧正文"
    note_id = created["data"]["id"]

    new_body = _tiptap_body(["新第一段", "新第二段"])
    resp = await client.put(
        f"/api/v1/notes/{note_id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": new_body},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["body"] == new_body
    assert data["plain_text"] == "新第一段\n\n新第二段"


@pytest.mark.asyncio
async def test_update_note_without_body_keeps_plain_text(client, member_token):
    """只改 title 不动 body：plain_text 保持不变。"""
    created = await _create_note(
        client, member_token, title="旧标题", body=_tiptap_body(["正文不动"])
    )
    note_id = created["data"]["id"]

    resp = await client.put(
        f"/api/v1/notes/{note_id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"title": "新标题"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["title"] == "新标题"
    assert data["plain_text"] == "正文不动"


@pytest.mark.asyncio
async def test_restricted_tags_round_trip(client, member_token):
    """restricted_tags 可写入并回显。"""
    created = await _create_note(
        client, member_token, title="标签授权", restricted_tags=["财务", "机密"]
    )
    assert created["data"]["restricted_tags"] == ["财务", "机密"]

    resp = await client.put(
        f"/api/v1/notes/{created['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"restricted_tags": ["公开"]},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["restricted_tags"] == ["公开"]


# ── 双链出边、反向链接与图谱 ──────────────────────────────────────────


def _wikilink_body(target_id, target_title="目标"):
    """辅助：构造含一个 wikilink 节点的 Tiptap 文档树。"""
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [
                    {"type": "text", "text": "见 "},
                    {
                        "type": "wikilink",
                        "attrs": {
                            "target_id": target_id,
                            "target_title": target_title,
                        },
                        "content": [{"type": "text", "text": target_title}],
                    },
                ],
            }
        ],
    }


async def _links(db):
    """辅助：读取 note_link 表全部行。"""
    from sqlalchemy import select

    from app.models.note_link import NoteLink

    return list((await db.execute(select(NoteLink))).scalars().all())


def test_extract_link_targets_dedupes_and_skips_other_nodes():
    """同一目标重复引用只产出一边；非 wikilink 节点一律忽略。"""
    from app.services.note_link import extract_link_targets

    body = _wikilink_body("t-1", "甲")
    body["content"][0]["content"].append(
        {
            "type": "wikilink",
            "attrs": {"target_id": "t-1", "target_title": "甲"},
            "content": [{"type": "text", "text": "甲"}],
        }
    )
    body["content"][0]["content"].append(
        {
            "type": "note-embed",
            "attrs": {"target_id": "should-be-ignored"},
        }
    )
    assert extract_link_targets(body) == ["t-1"]
    assert extract_link_targets(None) == []
    assert extract_link_targets({"type": "doc", "content": []}) == []


@pytest.mark.asyncio
async def test_create_note_rebuilds_outgoing_links(client, db, member_token):
    """保存含 wikilink 的 body 时，note_link 出边被创建。"""
    a = await _create_note(client, member_token, title="源笔记")
    b = await _create_note(client, member_token, title="目标笔记")

    resp = await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _wikilink_body(b["data"]["id"], "目标笔记")},
    )
    assert resp.status_code == 200

    rows = await _links(db)
    assert len(rows) == 1
    assert str(rows[0].source_id) == a["data"]["id"]
    assert str(rows[0].target_id) == b["data"]["id"]


@pytest.mark.asyncio
async def test_update_body_removes_links(client, db, member_token):
    """body 去掉 wikilink 后，原有出边被清空。"""
    a = await _create_note(client, member_token, title="源笔记")
    b = await _create_note(client, member_token, title="目标笔记")
    await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _wikilink_body(b["data"]["id"], "目标笔记")},
    )
    assert len(await _links(db)) == 1

    resp = await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _tiptap_body(["已无链接"])},
    )
    assert resp.status_code == 200
    assert await _links(db) == []


@pytest.mark.asyncio
async def test_update_without_body_keeps_links(client, db, member_token):
    """未传 body 的更新不得改动出边。"""
    a = await _create_note(client, member_token, title="源笔记")
    b = await _create_note(client, member_token, title="目标笔记")
    await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _wikilink_body(b["data"]["id"], "目标笔记")},
    )

    resp = await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"title": "改个标题"},
    )
    assert resp.status_code == 200
    assert len(await _links(db)) == 1


@pytest.mark.asyncio
async def test_delete_note_cascades_links(client, db, member_token):
    """删除笔记后其出边由 ON DELETE CASCADE 级联清除。"""
    a = await _create_note(client, member_token, title="源笔记")
    b = await _create_note(client, member_token, title="目标笔记")
    await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _wikilink_body(b["data"]["id"], "目标笔记")},
    )
    assert len(await _links(db)) == 1

    resp = await client.delete(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    assert await _links(db) == []


@pytest.mark.asyncio
async def test_wikilink_to_nonexistent_note_is_ignored(client, db, member_token):
    """指向不存在笔记的 wikilink 静默跳过，不阻断保存。"""
    a = await _create_note(client, member_token, title="源笔记")

    resp = await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _wikilink_body(str(uuid.uuid4()), "不存在")},
    )
    assert resp.status_code == 200
    assert await _links(db) == []


@pytest.mark.asyncio
async def test_backlinks_respects_visibility(db, seeded_admin, seeded_user):
    """反向链接只返回当前用户可见的笔记。"""
    from app.services.note_link import get_backlinks, rebuild_outgoing_links

    target = await _insert_note(
        db, seeded_user, title="被引用目标", visibility="public"
    )
    visible_src = await _insert_note(
        db, seeded_admin, title="引用者-公开", visibility="public"
    )
    hidden_src = await _insert_note(
        db, seeded_admin, title="引用者-私有", visibility="private"
    )
    for src in (visible_src, hidden_src):
        await rebuild_outgoing_links(db, src.id, _wikilink_body(str(target.id)))

    rows = await get_backlinks(db, target.id, seeded_user.id)
    assert [r["title"] for r in rows] == ["引用者-公开"]


@pytest.mark.asyncio
async def test_get_graph_local_and_global(db, seeded_user):
    """局部图谱按跳数扩展；全局图谱返回全部可见笔记与边。"""
    from app.services.note_link import get_graph, rebuild_outgoing_links

    n1 = await _insert_note(db, seeded_user, title="根节点")
    n2 = await _insert_note(db, seeded_user, title="一跳邻居")
    n3 = await _insert_note(db, seeded_user, title="二跳邻居")
    await rebuild_outgoing_links(db, n1.id, _wikilink_body(str(n2.id)))
    await rebuild_outgoing_links(db, n2.id, _wikilink_body(str(n3.id)))

    local = await get_graph(db, seeded_user.id, root_id=n1.id, depth=1)
    assert {n["title"] for n in local["nodes"]} == {"根节点", "一跳邻居"}
    assert len(local["links"]) == 1

    deep = await get_graph(db, seeded_user.id, root_id=n1.id, depth=2)
    assert len(deep["nodes"]) == 3

    global_graph = await get_graph(db, seeded_user.id)
    assert len(global_graph["nodes"]) == 3
    assert len(global_graph["links"]) == 2


# ── 搜索与标签筛选 ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_search_matches_title_plain_text_tags_and_folder(client, member_token):
    """搜索覆盖标题、正文纯文本、标签、文件夹名称四路径。

    tags 为 JSON 数组，按「元素相等」匹配而非子串，故 tags 为
    ["标签关键词"] 的笔记不会被搜索词「关键词」命中。
    """
    await _create_note(client, member_token, title="标题关键词", content="正文无关")
    await _create_note(
        client,
        member_token,
        title="无关一",
        body=_tiptap_body(["正文关键词"]),
    )
    await _create_note(
        client, member_token, title="无关二", content="x", tags=["关键词"]
    )
    await _create_note(
        client, member_token, title="无关三-仅子串", content="x", tags=["标签关键词"]
    )

    # 文件夹名称命中：其下笔记应被搜到
    folder = await client.post(
        "/api/v1/notes/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"name": "文件夹关键词", "description": "简介无关"},
    )
    folder_id = folder.json()["data"]["id"]
    in_folder = await _create_note(client, member_token, title="夹内笔记")
    await client.put(
        f"/api/v1/notes/{in_folder['data']['id']}/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"folder_ids": [folder_id]},
    )

    resp = await client.get(
        "/api/v1/notes/",
        params={"search": "关键词"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 4
    assert {n["title"] for n in data["items"]} == {
        "标题关键词",
        "无关一",
        "无关二",
        "夹内笔记",
    }


@pytest.mark.asyncio
async def test_search_matches_folder_description(client, member_token):
    """文件夹简介命中时，其下笔记应被搜到（名称本身不命中）。"""
    folder = await client.post(
        "/api/v1/notes/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"name": "名称无关", "description": "简介里含搜索词"},
    )
    folder_id = folder.json()["data"]["id"]
    note = await _create_note(client, member_token, title="夹内笔记二")
    await client.put(
        f"/api/v1/notes/{note['data']['id']}/folders",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"folder_ids": [folder_id]},
    )

    resp = await client.get(
        "/api/v1/notes/",
        params={"search": "简介里"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["items"][0]["id"] == note["data"]["id"]


@pytest.mark.asyncio
async def test_list_notes_tag_filter(client, member_token):
    """tag 参数按标签精确筛选，不误伤同名字符串前缀。"""
    await _create_note(client, member_token, title="标签A和B", tags=["A", "B"])
    await _create_note(client, member_token, title="标签B", tags=["B"])
    await _create_note(client, member_token, title="标签AB", tags=["AB"])
    await _create_note(client, member_token, title="无标签")

    resp = await client.get(
        "/api/v1/notes/",
        params={"tag": "B"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 2
    assert {n["title"] for n in data["items"]} == {"标签A和B", "标签B"}


# ── 反向链接 / 图谱 HTTP 端点 ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_backlinks_endpoint_returns_sources(client, member_token):
    """A 正文 wikilink 指向 B：GET /{B}/backlinks 返回 A。"""
    a = await _create_note(client, member_token, title="引用方")
    b = await _create_note(client, member_token, title="被引用方")
    await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _wikilink_body(b["data"]["id"], "被引用方")},
    )

    resp = await client.get(
        f"/api/v1/notes/{b['data']['id']}/backlinks",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) == 1
    assert items[0]["note_id"] == a["data"]["id"]
    assert items[0]["title"] == "引用方"


@pytest.mark.asyncio
async def test_backlinks_endpoint_empty_after_source_deleted(client, member_token):
    """引用方笔记被删除后，反向链接随之清空（级联）。"""
    a = await _create_note(client, member_token, title="引用方")
    b = await _create_note(client, member_token, title="被引用方")
    await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _wikilink_body(b["data"]["id"], "被引用方")},
    )

    resp = await client.delete(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200

    resp = await client.get(
        f"/api/v1/notes/{b['data']['id']}/backlinks",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] == []


@pytest.mark.asyncio
async def test_local_graph_endpoint_respects_depth(client, member_token):
    """A→B→C：depth=1 只见一跳，depth=2 见完整链路。"""
    a = await _create_note(client, member_token, title="根A")
    b = await _create_note(client, member_token, title="中B")
    c = await _create_note(client, member_token, title="末端C")
    for src, tgt in ((a, b), (b, c)):
        await client.put(
            f"/api/v1/notes/{src['data']['id']}",
            headers={"Authorization": f"Bearer {member_token}"},
            json={"body": _wikilink_body(tgt["data"]["id"])},
        )

    resp = await client.get(
        f"/api/v1/notes/{a['data']['id']}/graph",
        params={"depth": 1},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert {n["id"] for n in data["nodes"]} == {a["data"]["id"], b["data"]["id"]}
    assert len(data["links"]) == 1

    resp = await client.get(
        f"/api/v1/notes/{a['data']['id']}/graph",
        params={"depth": 2},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    data = resp.json()["data"]
    assert {n["id"] for n in data["nodes"]} == {
        a["data"]["id"],
        b["data"]["id"],
        c["data"]["id"],
    }
    assert len(data["links"]) == 2


@pytest.mark.asyncio
async def test_global_graph_endpoint(client, member_token):
    """全局图谱返回全部可见笔记与全部双链边。"""
    a = await _create_note(client, member_token, title="起点笔记")
    b = await _create_note(client, member_token, title="被引笔记")
    await client.put(
        f"/api/v1/notes/{a['data']['id']}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"body": _wikilink_body(b["data"]["id"])},
    )

    resp = await client.get(
        "/api/v1/notes/graph",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data["nodes"]) == 2
    assert len(data["links"]) == 1
    link = data["links"][0]
    assert link["source"] == a["data"]["id"]
    assert link["target"] == b["data"]["id"]


@pytest.mark.asyncio
async def test_tags_endpoint_counts_desc(client, member_token):
    """标签聚合按出现次数降序返回。"""
    await _create_note(client, member_token, title="一", tags=["工作", "重要"])
    await _create_note(client, member_token, title="二", tags=["工作"])
    await _create_note(client, member_token, title="三", tags=["工作", "生活"])
    await _create_note(client, member_token, title="四", tags=["重要"])

    resp = await client.get(
        "/api/v1/notes/tags",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert [(t["tag"], t["count"]) for t in data] == [
        ("工作", 3),
        ("重要", 2),
        ("生活", 1),
    ]


# ── 服务端草稿 ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_draft_roundtrip(client, member_token):
    """PUT 保存 → GET 读到一致内容 → DELETE 后 GET 为空。"""
    note = await _create_note(client, member_token, title="草稿宿主")
    note_id = note["data"]["id"]
    body = _tiptap_body(["草稿正文"])

    resp = await client.put(
        "/api/v1/notes/draft",
        headers={"Authorization": f"Bearer {member_token}"},
        json={"note_id": note_id, "title": "草稿标题", "body": body},
    )
    assert resp.status_code == 200
    saved = resp.json()["data"]
    assert saved["note_id"] == note_id
    assert saved["title"] == "草稿标题"
    assert saved["body"] == body

    resp = await client.get(
        "/api/v1/notes/draft",
        params={"note_id": note_id},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["title"] == "草稿标题"

    resp = await client.delete(
        "/api/v1/notes/draft",
        params={"note_id": note_id},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200

    resp = await client.get(
        "/api/v1/notes/draft",
        params={"note_id": note_id},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] is None


@pytest.mark.asyncio
async def test_draft_upsert_updates_existing(client, member_token):
    """同一篇笔记重复保存只保留一份草稿，内容为最新值。"""
    note = await _create_note(client, member_token, title="宿主")
    note_id = note["data"]["id"]
    for title in ("第一次", "第二次"):
        resp = await client.put(
            "/api/v1/notes/draft",
            headers={"Authorization": f"Bearer {member_token}"},
            json={
                "note_id": note_id,
                "title": title,
                "body": _tiptap_body([title]),
            },
        )
        assert resp.status_code == 200

    resp = await client.get(
        "/api/v1/notes/draft",
        params={"note_id": note_id},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.json()["data"]["title"] == "第二次"


@pytest.mark.asyncio
async def test_draft_owner_isolation(client, member_token, admin_token):
    """草稿归属本人：成员读不到管理员的草稿。"""
    resp = await client.put(
        "/api/v1/notes/draft",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"title": "管理员草稿", "body": _tiptap_body(["管理员正文"])},
    )
    assert resp.status_code == 200

    resp = await client.get(
        "/api/v1/notes/draft",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["data"] is None
