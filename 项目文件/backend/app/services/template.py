"""模板业务逻辑"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.template import Template
from app.models.user import User


async def create_template(
    db: AsyncSession,
    data: dict,
    owner_id: uuid.UUID,
) -> Template:
    """创建模板"""
    # Pydantic v2 将 "schema" 字段序列化为 "schema_": model_dump() 避免与 BaseModel.schema 冲突
    schema_data = data.get("schema") or data.get("schema_") or []
    template = Template(
        name=data["name"],
        category=data.get("category", "默认"),
        schema=[f.model_dump() if hasattr(f, "model_dump") else f for f in schema_data],
        owner_id=owner_id,
    )
    db.add(template)
    await db.flush()
    return template


async def list_templates(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    category: str | None = None,
    search: str | None = None,
) -> tuple[list[Template], int]:
    """列出模板，支持分类过滤和搜索"""
    query = select(Template)
    count_query = select(func.count()).select_from(Template)

    if category:
        query = query.where(Template.category == category)
        count_query = count_query.where(Template.category == category)

    if search:
        query = query.where(Template.name.ilike(f"%{search}%"))
        count_query = count_query.where(Template.name.ilike(f"%{search}%"))

    # 总数
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # 分页
    query = query.order_by(Template.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    templates = list(result.scalars().all())

    return templates, total


async def get_template(db: AsyncSession, template_id: uuid.UUID) -> Template:
    """获取单个模板"""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="模板不存在"
        )
    return template


async def update_template(
    db: AsyncSession, template_id: uuid.UUID, data: dict, current_user: User
) -> Template:
    """更新模板，自动递增版本号，仅所有者可修改。"""
    template = await get_template(db, template_id)
    if template.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可修改"
        )

    if "name" in data and data["name"] is not None:
        template.name = data["name"]
    if "category" in data and data["category"] is not None:
        template.category = data["category"]
    if "schema" in data and data["schema"] is not None:
        template.schema = [
            f.model_dump() if hasattr(f, "model_dump") else f for f in data["schema"]
        ]
        template.version += 1

    await db.flush()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, template_id: uuid.UUID, current_user: User) -> None:
    """删除模板，仅所有者可删除。"""
    template = await get_template(db, template_id)
    if template.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="仅所有者可删除"
        )
    await db.delete(template)
    await db.flush()


async def export_template_json(db: AsyncSession, template_id: uuid.UUID) -> dict:
    """导出模板为 JSON"""
    template = await get_template(db, template_id)
    return {
        "name": template.name,
        "category": template.category,
        "schema": template.schema,
        "version": template.version,
    }


async def import_template_json(
    db: AsyncSession, json_data: dict, owner_id: uuid.UUID
) -> Template:
    """从 JSON 导入模板"""
    if "name" not in json_data or "schema" not in json_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="导入数据必须包含 name 和 schema 字段",
        )

    if not isinstance(json_data["schema"], list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="schema 必须是数组",
        )

    template = Template(
        name=json_data["name"],
        category=json_data.get("category", "默认"),
        schema=json_data["schema"],
        owner_id=owner_id,
    )
    db.add(template)
    await db.flush()
    return template
