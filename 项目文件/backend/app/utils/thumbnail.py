"""缩略图生成工具"""

from pathlib import Path

from PIL import Image


async def generate_thumbnail(image_path: str, thumbnail_path: str, size: int = 200) -> str:
    """生成缩略图，返回缩略图路径"""
    img = Image.open(image_path)
    img.thumbnail((size, size))
    Path(thumbnail_path).parent.mkdir(parents=True, exist_ok=True)
    img.save(thumbnail_path, "JPEG", quality=85)
    return thumbnail_path
