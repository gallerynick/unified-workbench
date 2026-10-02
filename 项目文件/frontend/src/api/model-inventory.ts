import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

/**
 * 模型清单接口。
 *
 * 后端为 GET /system/model-inventory（无尾部斜杠），仅管理员可访问；
 * 聚合本地 GGUF 目录与 ModelScope 缓存目录两个来源，实时采样、不持久化。
 *
 * 用途类型是元数据而非目录位置，因此两个引擎的模型能排在同一张清单里，
 * 不需要把它们的文件挪到同一个目录。
 */

/** configured 在用；available 已下载未引用；orphan 历史缓存；incomplete 未下全 */
export type ModelStatus = 'configured' | 'available' | 'orphan' | 'incomplete';

export interface ModelInventoryItem {
  engine: 'llamacpp' | 'modelscope';
  type_key: string;
  model_type: string;
  name: string;
  repo_id?: string | null;
  bytes: number;
  status: ModelStatus;
  source: string;
  note?: string | null;
}

export interface EngineSummary {
  engine: 'llamacpp' | 'modelscope';
  engine_name: string;
  bytes: number;
  count: number;
}

export interface ModelInventory {
  generated_at: string;
  elapsed_ms: number;
  total_bytes: number;
  engines: EngineSummary[];
  items: ModelInventoryItem[];
  notes: string[];
}

/** 拉取模型清单快照 */
export async function getModelInventory(): Promise<UnifiedResponse<ModelInventory>> {
  return request<ModelInventory>('/system/model-inventory');
}

/** 状态标签文案 */
export const STATUS_LABEL: Record<ModelStatus, string> = {
  configured: '在用',
  available: '备用',
  orphan: '未配置',
  incomplete: '不完整',
};

/** 状态标签颜色（antd PresetColor，避免硬编码 hex） */
export const STATUS_COLOR: Record<ModelStatus, string> = {
  configured: 'green',
  available: 'blue',
  orphan: 'gold',
  incomplete: 'red',
};
