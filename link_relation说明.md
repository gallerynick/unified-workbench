# link_relation 通用双向关联表说明

## 定位

`link_relation` 是一张**通用双向关联表**，用于表达任意两个模块实体之间的关联关系。它不是 project 模块的专属表，也不属于任何特定业务模块，定位是跨模块复用的基础设施表。

设计目标：当两个实体需要建立"松散关联"（如内容↔笔记、待办↔会议）且不便引入硬外键时，可在此表登记一条关联记录。

## 数据模型

表名：`link_relation`（对应模型 `backend/app/models/link_relation.py` 中的 `LinkRelation`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键，默认 `uuid4` 生成 |
| `source_type` | String(50) | 源对象类型，自由字符串 |
| `source_id` | UUID | 源对象 ID |
| `target_type` | String(50) | 目标对象类型，自由字符串 |
| `target_id` | UUID | 目标对象 ID |
| `created_at` | DateTime(timezone=True) | 创建时间，默认数据库当前时间 |

**关键设计：无任何外键。**

- `source_type` / `target_type` 是自由字符串而非受约束的枚举或外键，因此可以关联任意模块的任意实体，新增模块接入时无需迁移表结构。
- `source_id` / `target_id` 仅存储 UUID，不指向具体表，避免了跨表外键的耦合。
- 关联本身无业务字段，只负责"两者之间有关联"这一事实。

## 行为

对应路由 `backend/app/api/link_relations.py`（prefix `/link-relations`），行为如下：

| 操作 | 接口 | 行为 |
|------|------|------|
| 创建 | `POST /link-relations/` | **双向双写**：同时插入 `(source→target)` 与 `(target→source)` 两条记录；若某条已存在则跳过。返回实际新建的记录列表 |
| 列表 | `GET /link-relations/` | 以 `source_type` + `source_id` 查询以某实体为源的关联记录，按 `created_at` 倒序 |
| 关联实体 | `GET /link-relations/linked-entities` | **双向查询**：同时查该实体作为源或目标两方向的记录，对另一侧实体 `[{type, id}]` **去重**后返回 |
| 删除 | `DELETE /link-relations/` | **双向删除**：同时删除 `(source→target)` 与 `(target→source)` 两条记录；均不存在时返回 404 |

接口行为由 `backend/app/services/link_relation.py` 实现（`create_relation` / `delete_relation` / `list_relations` / `get_linked_entities`）。

## 与 project 的关系澄清

此表诞生于数据库迁移 `034_project_module_redo.py`，**这属于历史原因，不代表它属于 project 模块**。

实际上：

- **project 内各 Tab 间的关联使用标准外键**，例如 `TodoTask.proposal_id` 外键指向 `project_proposal` 表，属于强关联。
- **project 模块未使用 `link_relation` 表**。该表在 project 重做过程中被一并引入，但其定位是通用关联表，与 project 的业务关联机制无耦合。

因此在理解数据模型时，不应把 `link_relation` 视为 project 模块的一部分。

## 当前状态

- **后端**：模型、API 路由、业务服务均已实现，除自身路由外无任何模块引用。
- **前端**：客户端 `frontend/src/api/link-relations.ts` 已封装四个方法（`createLink` / `listLinkRelations` / `getLinkedEntities` / `deleteLink`），类型定义位于 `frontend/src/types/link-relation.ts`。
- **当前无任何页面调用**：前端仅 `api/link-relations.ts` 与其类型文件互相引用，没有任何业务页面接入该接口。

即：链路完整（模型 → 服务 → API → 前端客户端），但尚未接入任何 UI 功能。

## 未来用途建议

需要表达"跨模块实体松散关联"时可接入此表，例如：

- 内容 ↔ 笔记：一篇文章关联若干条笔记
- 待办 ↔ 会议：一条待办关联某次会议
- 文件 ↔ 记录：一个文件关联多条项目记录

接入方式：后端直接调用 `POST /link-relations/` 创建关联、`GET /link-relations/linked-entities` 查询；前端复用 `api/link-relations.ts` 已有客户端。由于 type 为自由字符串、无外键，**接入新模块无需修改表结构或迁移**。
