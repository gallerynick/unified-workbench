/** 项目待办任务类型定义 */

export interface ProjectTodo {
  id: string;
  project_id: string;
  number: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assignee_id: string | null;
  creator_id: string;
  proposal_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTodoCreate {
  project_id: string;
  number: string;
  title: string;
  description?: string;
  priority?: string;
  status?: string;
  assignee_id?: string;
  proposal_id?: string;
  due_date?: string;
}

export interface ProjectTodoUpdate {
  number?: string;
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  assignee_id?: string;
  proposal_id?: string;
  due_date?: string;
}

export interface ProjectTodoListResponse {
  items: ProjectTodo[];
  total: number;
}
