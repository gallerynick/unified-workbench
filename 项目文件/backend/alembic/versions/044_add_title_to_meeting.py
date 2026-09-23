"""project_meeting 表新增 title 列 — 将交流主题从 content 中拆出独立存储。

Revision ID: 044
Revises: 043
Create Date: 2026-09-01

变更内容：
1. project_meeting 新增 title（VARCHAR(500)，nullable，comment='交流主题'）
2. 回填：现有记录的 content 按第一个 \n\n 拆分，前半段写入 title，后半段保留在 content
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = "044"
down_revision: str | None = "043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "project_meeting",
        sa.Column(
            "title",
            sa.String(length=500),
            nullable=True,
            comment="交流主题",
        ),
    )

    # 回填：从 content 拆出 title（取第一个 \n\n 之前的内容）
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, content FROM project_meeting WHERE content IS NOT NULL")
    ).fetchall()
    for row in rows:
        content = row[1]
        idx = content.find("\n\n")
        if idx > 0:
            title = content[:idx].strip()
            body = content[idx + 2:]
            conn.execute(
                sa.text(
                    "UPDATE project_meeting SET title = :title, content = :body WHERE id = :id"
                ),
                {"title": title, "body": body, "id": row[0]},
            )
        else:
            # 无分隔符，整段作为 title（旧格式只有标题无正文的情况）
            conn.execute(
                sa.text(
                    "UPDATE project_meeting SET title = :title, content = :body WHERE id = :id"
                ),
                {"title": content.strip(), "body": "", "id": row[0]},
            )


def downgrade() -> None:
    # 回填：将 title 合回 content
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT id, title, content FROM project_meeting WHERE title IS NOT NULL"
        )
    ).fetchall()
    for row in rows:
        title = row[1]
        content = row[2] or ""
        new_content = f"{title}\n\n{content}" if content else title
        conn.execute(
            sa.text("UPDATE project_meeting SET content = :content WHERE id = :id"),
            {"content": new_content, "id": row[0]},
        )
    op.drop_column("project_meeting", "title")
