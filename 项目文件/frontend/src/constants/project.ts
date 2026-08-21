/** 项目管理模块选项常量，供各 Tab 下拉选择/标签展示使用 */

export const PROPOSAL_TYPE_OPTIONS = [
  { value: 'feature', label: '功能需求' },
  { value: 'bug', label: 'Bug修复' },
  { value: 'improvement', label: '优化改进' },
  { value: 'removal', label: '功能移除' },
  { value: 'other', label: '其他' },
] as const;

export const PROPOSAL_PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 紧急' },
  { value: 'P1', label: 'P1 高' },
  { value: 'P2', label: 'P2 中' },
  { value: 'P3', label: 'P3 低' },
  { value: 'P4', label: 'P4 待定' },
] as const;

export const PROPOSAL_STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '待实现' },
  { value: 'in_progress', label: '实现中' },
  { value: 'completed', label: '已完成' },
  { value: 'rejected', label: '已废弃' },
] as const;

export const PROPOSAL_STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '待实现',
  in_progress: '实现中',
  completed: '已完成',
  rejected: '已废弃',
};

export const CHANGE_CATEGORY_MAJOR = [
  { value: 'code', label: '代码' },
  { value: 'doc', label: '文档' },
  { value: 'config', label: '配置' },
  { value: 'other', label: '其他' },
] as const;

export const CHANGE_CATEGORY_MINOR_MAP: Record<string, { value: string; label: string }[]> = {
  code: [
    { value: 'frontend', label: '前端' },
    { value: 'backend', label: '后端' },
    { value: 'database', label: '数据库' },
    { value: 'deploy', label: '部署' },
  ],
  doc: [
    { value: 'baseline', label: '基准文档' },
    { value: 'design', label: '设计文档' },
    { value: 'api', label: 'API文档' },
    { value: 'ops', label: '运维文档' },
  ],
  config: [
    { value: 'env', label: '环境变量' },
    { value: 'docker', label: 'Docker' },
    { value: 'nginx', label: 'Nginx' },
    { value: 'dependency', label: '依赖' },
  ],
};

export const TODO_PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 紧急' },
  { value: 'P1', label: 'P1 高' },
  { value: 'P2', label: 'P2 中' },
  { value: 'P3', label: 'P3 低' },
  { value: 'P4', label: 'P4 待定' },
] as const;

export const TODO_STATUS_OPTIONS = [
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
] as const;

/** 会议/交流记录类型 */
export const MEETING_TYPE_OPTIONS = [
  { value: '会议纪要', label: '会议纪要' },
  { value: '沟通记录', label: '沟通记录' },
] as const;

export const EVENT_TYPE_OPTIONS = [
  { value: 'handover', label: '项目移交' },
  { value: 'archive', label: '归档' },
  { value: 'close', label: '关闭' },
  { value: 'reopen', label: '重启' },
  { value: 'owner_change', label: '负责人变更' },
  { value: 'other', label: '其他' },
] as const;

/** 各模块编号前缀 */
export const PROJECT_NUMBER_PREFIX = {
  proposal: 'PRP-',
  meeting: 'MTG-',
  change: 'CHG-',
  todo: 'TOD-',
  event: 'EVT-',
} as const;

/** 项目分区权限配置：分区键 → 中文名，供分区权限设置弹窗使用 */
export const PERMISSION_SECTIONS = {
  info: '项目信息',
  members: '成员管理',
  progress: '项目进度',
  proposals: '提案管理',
  todos: '待办事项',
  meetings: '交流记录',
  changes: '修改记录',
  documents: '文档管理',
  events: '事件记录',
} as const;

/** 项目优先级选项 */
export const PROJECT_PRIORITY = [
  { value: '立即', label: '立即' },
  { value: '重要', label: '重要' },
  { value: '一般', label: '一般' },
  { value: '最后', label: '最后' },
  { value: '待定', label: '待定' },
] as const;

/** 项目类型选项（六类+其他） */
export const PROJECT_TYPE = [
  { value: 'entertainment', label: '娱乐与媒体类' },
  { value: 'productivity', label: '生产力与工具类' },
  { value: 'commerce', label: '商业与电商类' },
  { value: 'education', label: '教育与社会服务类' },
  { value: 'utility', label: '实用工具与系统类' },
  { value: 'frontier', label: '前沿技术与垂直领域类' },
  { value: 'other', label: '其他' },
] as const;

/** 是否开源选项 */
export const IS_OPEN_SOURCE = [
  { value: true, label: '是' },
  { value: false, label: '否' },
] as const;

/**
 * 解析关联项目字段（存储为 JSON 数组字符串，兼容旧数据逗号分隔文本）
 */
export function parseRelatedProjects(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    // 兼容旧数据：逗号分隔文本
  }
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}
