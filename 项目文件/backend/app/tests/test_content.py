"""内容模块测试（9 个用例）。"""

import uuid

import pytest


@pytest.mark.asyncio
async def test_create_content(client, member_token):
    """创建内容成功。"""
    response = await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "测试内容",
            "body": {"type": "doc", "content": [{"type": "text", "text": "Hello"}]},
            "visibility": "private",
            "tags": ["test", "demo"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["title"] == "测试内容"
    assert data["data"]["visibility"] == "private"
    assert data["data"]["tags"] == ["test", "demo"]
    assert "id" in data["data"]


@pytest.mark.asyncio
async def test_get_content(client, member_token):
    """获取内容详情成功。"""
    # 先创建
    create_resp = await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "详情测试",
            "body": {"type": "doc"},
            "visibility": "public",
        },
    )
    content_id = create_resp.json()["data"]["id"]

    # 获取详情
    response = await client.get(
        f"/api/v1/contents/{content_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["id"] == content_id
    assert data["data"]["title"] == "详情测试"


@pytest.mark.asyncio
async def test_update_content(client, member_token):
    """更新内容字段成功。"""
    # 先创建
    create_resp = await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "原始标题",
            "body": {"type": "doc"},
            "visibility": "private",
        },
    )
    content_id = create_resp.json()["data"]["id"]

    # 更新
    response = await client.put(
        f"/api/v1/contents/{content_id}",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "更新后的标题",
            "tags": ["updated"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["title"] == "更新后的标题"
    assert data["data"]["tags"] == ["updated"]
    # 未修改的字段保持不变
    assert data["data"]["visibility"] == "private"


@pytest.mark.asyncio
async def test_delete_content_owner(client, member_token):
    """owner 可以删除自己的内容。"""
    # 先创建
    create_resp = await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "待删除",
            "body": {"type": "doc"},
            "visibility": "private",
        },
    )
    content_id = create_resp.json()["data"]["id"]

    # 删除
    response = await client.delete(
        f"/api/v1/contents/{content_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 200
    assert response.json()["code"] == 0

    # 验证已删除
    get_resp = await client.get(
        f"/api/v1/contents/{content_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_content_admin(client, member_token, admin_token):
    """admin 可以删除他人的内容。"""
    # member 创建
    create_resp = await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "admin删除测试",
            "body": {"type": "doc"},
            "visibility": "public",
        },
    )
    content_id = create_resp.json()["data"]["id"]

    # admin 删除
    response = await client.delete(
        f"/api/v1/contents/{content_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["code"] == 0


@pytest.mark.asyncio
async def test_list_contents_visibility(client, member_token, admin_token):
    """可见性过滤：private 内容仅 owner 可见，public 所有人可见。"""
    # member 创建 private 内容
    await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "私有内容",
            "body": {"type": "doc"},
            "visibility": "private",
        },
    )

    # member 创建 public 内容
    await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "公开内容",
            "body": {"type": "doc"},
            "visibility": "public",
        },
    )

    # admin 查看列表：只能看到 public
    response = await client.get(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    titles = [item["title"] for item in data["data"]["items"]]
    assert "公开内容" in titles
    assert "私有内容" not in titles

    # member 查看列表：能看到自己的 private 和 public
    response = await client.get(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    titles = [item["title"] for item in data["data"]["items"]]
    assert "公开内容" in titles
    assert "私有内容" in titles


@pytest.mark.asyncio
async def test_search_by_title(client, member_token):
    """按标题搜索内容（ILIKE）。"""
    for title in ["Python 教程", "Java 教程", "数据分析"]:
        await client.post(
            "/api/v1/contents",
            headers={"Authorization": f"Bearer {member_token}"},
            json={
                "title": title,
                "body": {"type": "doc"},
                "visibility": "public",
            },
        )

    # 搜索 "教程"
    response = await client.get(
        "/api/v1/contents",
        params={"search": "教程"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["total"] == 2
    titles = [item["title"] for item in data["data"]["items"]]
    assert "Python 教程" in titles
    assert "Java 教程" in titles


@pytest.mark.asyncio
async def test_search_by_tag(client, member_token):
    """按标签搜索内容（JSONB 包含检查）。"""
    await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "标签测试A",
            "body": {"type": "doc"},
            "visibility": "public",
            "tags": ["python", "tutorial"],
        },
    )
    await client.post(
        "/api/v1/contents",
        headers={"Authorization": f"Bearer {member_token}"},
        json={
            "title": "标签测试B",
            "body": {"type": "doc"},
            "visibility": "public",
            "tags": ["java", "tutorial"],
        },
    )

    # 搜索标签 "python"
    response = await client.get(
        "/api/v1/contents",
        params={"tag": "python"},
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["data"]["total"] == 1
    assert data["data"]["items"][0]["title"] == "标签测试A"


@pytest.mark.asyncio
async def test_content_not_found(client, member_token):
    """访问不存在的内容返回 404。"""
    fake_id = str(uuid.uuid4())
    response = await client.get(
        f"/api/v1/contents/{fake_id}",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 404
