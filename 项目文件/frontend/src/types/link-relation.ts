/** 通用关联关系类型定义 */

export interface LinkRelation {
  id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  created_at: string;
}

export interface LinkRelationCreate {
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
}

export interface LinkRelationListResponse {
  items: LinkRelation[];
  total: number;
}

/** 关联实体（getLinkedEntities 返回项） */
export interface LinkedEntity {
  type: string;
  id: string;
}
