"""文件管理模块测试（12 个用例）"""

import io
import os

import pytest
from PIL import Image
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.core.config import get_settings  # noqa: E402


@pytest.fixture(autouse=True)
def _patch_nas_path(tmp_path):
    settings = get_settings()
    original = settings.NAS_FILES_PATH
    settings.NAS_FILES_PATH = str(tmp_path / "nas")
    os.makedirs(settings.NAS_FILES_PATH, exist_ok=True)
    yield
    settings.NAS_FILES_PATH = original


def _make_file_content(size: int = 100) -> bytes:
    return b"x" * size


def _make_image_bytes(width: int = 100, height: int = 100) -> bytes:
    img = Image.new("RGB", (width, height), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_upload_file(client, admin_token):
    content = _make_file_content(500)
    response = await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("test.txt", content, "text/plain")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["name"] == "test.txt"
    assert data["data"]["size"] == 500
    assert data["data"]["mime_type"] == "text/plain"
    stored = data["data"]["stored_path"]
    assert os.path.exists(stored)


@pytest.mark.asyncio
async def test_upload_image_thumbnail(client, admin_token):
    content = _make_image_bytes(200, 200)
    response = await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("photo.jpg", content, "image/jpeg")},
    )
    assert response.status_code == 200
    file_id = response.json()["data"]["id"]
    settings = get_settings()
    thumb_path = os.path.join(settings.NAS_FILES_PATH, "thumbnails", f"{file_id}_thumb.jpg")
    assert os.path.exists(thumb_path)


@pytest.mark.asyncio
async def test_download_file(client, admin_token):
    content = _make_file_content(300)
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("dl_test.bin", content, "application/octet-stream")},
    )
    file_id = upload_resp.json()["data"]["id"]

    response = await client.get(
        f"/api/v1/files/{file_id}/download",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.content == content


@pytest.mark.asyncio
async def test_download_private_file_access_denied(client, admin_token, member_token):
    content = _make_file_content(100)
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("secret.txt", content, "text/plain")},
        params={"visibility": "private"},
    )
    file_id = upload_resp.json()["data"]["id"]

    response = await client.get(
        f"/api/v1/files/{file_id}/download",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_delete_file_owner(client, admin_token):
    content = _make_file_content(100)
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("del_test.txt", content, "text/plain")},
    )
    file_id = upload_resp.json()["data"]["id"]

    response = await client.delete(
        f"/api/v1/files/{file_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    assert response.json()["code"] == 0


@pytest.mark.asyncio
async def test_delete_file_admin(client, admin_token, seeded_user, member_token):
    content = _make_file_content(100)
    upload_resp = await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {member_token}"},
        files={"file": ("member_file.txt", content, "text/plain")},
    )
    file_id = upload_resp.json()["data"]["id"]

    response = await client.delete(
        f"/api/v1/files/{file_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_sha256_dedup(client, admin_token):
    content = _make_file_content(200)
    resp1 = await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("dup1.txt", content, "text/plain")},
    )
    resp2 = await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("dup2.txt", content, "text/plain")},
    )
    assert resp1.json()["data"]["id"] == resp2.json()["data"]["id"]
    assert resp2.json()["data"]["name"] == "dup1.txt"


@pytest.mark.asyncio
async def test_create_folder(client, admin_token):
    response = await client.post(
        "/api/v1/files/folders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "测试文件夹"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["name"] == "测试文件夹"


@pytest.mark.asyncio
async def test_list_files_visibility(client, admin_token, member_token):
    content_pub = b"public-content"
    content_priv = b"private-content"
    await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("pub.txt", content_pub, "text/plain")},
        data={"visibility": "public"},
    )
    await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("priv.txt", content_priv, "text/plain")},
        data={"visibility": "private"},
    )

    admin_list = await client.get(
        "/api/v1/files/",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_list.json()["data"]["total"] == 2

    member_list = await client.get(
        "/api/v1/files/",
        headers={"Authorization": f"Bearer {member_token}"},
    )
    assert member_list.json()["data"]["total"] == 1
    assert member_list.json()["data"]["items"][0]["visibility"] == "public"


@pytest.mark.asyncio
async def test_file_size_limit(client, admin_token):
    settings = get_settings()
    original = settings.MAX_FILE_SIZE
    settings.MAX_FILE_SIZE = 100
    try:
        content = _make_file_content(200)
        response = await client.post(
            "/api/v1/files/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            files={"file": ("big.bin", content, "application/octet-stream")},
        )
        assert response.status_code == 413
    finally:
        settings.MAX_FILE_SIZE = original


@pytest.mark.asyncio
async def test_list_files_with_folder(client, admin_token):
    folder_resp = await client.post(
        "/api/v1/files/folders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "我的文件夹"},
    )
    folder_id = folder_resp.json()["data"]["id"]

    content = _make_file_content(50)
    await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("in_folder.txt", content, "text/plain")},
        data={"folder_id": folder_id},
    )
    await client.post(
        "/api/v1/files/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files={"file": ("no_folder.txt", content, "text/plain")},
    )

    response = await client.get(
        "/api/v1/files/",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"folder_id": folder_id},
    )
    assert response.json()["data"]["total"] == 1
    assert response.json()["data"]["items"][0]["folder_id"] == folder_id


@pytest.mark.asyncio
async def test_delete_folder(client, admin_token):
    folder_resp = await client.post(
        "/api/v1/files/folders",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "待删除"},
    )
    folder_id = folder_resp.json()["data"]["id"]

    response = await client.delete(
        f"/api/v1/files/folders/{folder_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
