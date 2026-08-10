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
  { value: 'approved', label: '已采纳' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'completed', label: '已完成' },
] as const;

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

/** 会议/交流记录类型（允许自由填写，此列表为常用预设） */
export const MEETING_TYPE_OPTIONS = [
  { value: 'meeting', label: '会议纪要' },
  { value: 'communication', label: '沟通记录' },
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
  info: '信息',
  members: '人员',
  progress: '进度',
  proposals: '提案',
  todos: '待办',
  meetings: '交流',
  changes: '修改',
  documents: '文档',
  events: '事件',
} as const;
