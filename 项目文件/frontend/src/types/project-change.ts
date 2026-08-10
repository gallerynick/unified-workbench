/** 项目修改记录类型定义 */

export interface ProjectChange {
  id: string;
  project_id: string;
  number: string;
  title: string;
  date: string;
  category_major: string;
  category_minor: string | null;
  category_detail: string | null;
  content: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectChangeCreate {
  project_id: string;
  number: string;
  title: string;
  date: string;
  category_major: string;
  category_minor?: string;
  category_detail?: string;
  content?: string;
  status?: string;
}

export interface ProjectChangeUpdate {
  number?: string;
  title?: string;
  date?: string;
  category_major?: string;
  category_minor?: string;
  category_detail?: string;
  content?: string;
  status?: string;
}

export interface ProjectChangeListResponse {
  items: ProjectChange[];
  total: number;
}
