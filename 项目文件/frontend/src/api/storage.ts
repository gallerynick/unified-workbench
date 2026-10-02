import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

/**
 * 存储占用分布接口。
 *
 * 后端为 GET /system/storage-breakdown（无尾部斜杠），仅管理员可访问；
 * 数据来自实时测量（目录遍历、SQL / Redis 查询、statvfs），
 * 不做数据库持久化。
 */

/** 测量精度：exact 可直接相加；logical 为逻辑量；residual 为卷级残差 */
export type AccuracyLevel = 'exact' | 'logical' | 'residual';

/** 分类明细条目（如单个模型文件大小） */
export interface CategoryDetail {
  name: string;
  bytes: number;
}

export interface StorageCategory {
  key: string;
  group: string;
  name: string;
  /** null 表示本次未能测得 */
  bytes: number | null;
  source: string;
  accuracy: AccuracyLevel;
  /** false 表示数据源本次不可达，counted 为 false */
  reachable: boolean;
  counted: boolean;
  path?: string | null;
  note?: string | null;
  /** 残差类的计算锚点说明 */
  anchor?: string | null;
  details: CategoryDetail[];
}

export interface DiskInfo {
  key: 'work' | 'docker_vm';
  name: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  measured_via: string;
}

export interface StorageBreakdown {
  generated_at: string;
  elapsed_ms: number;
  categories: StorageCategory[];
  measured_total_bytes: number;
  logical_reference_bytes: number;
  disks: DiskInfo[];
}

/** 拉取存储占用分布快照 */
export async function getStorageBreakdown(): Promise<UnifiedResponse<StorageBreakdown>> {
  return request<StorageBreakdown>('/system/storage-breakdown');
}

/** 字节数格式化为人类可读文本（二进制单位） */
export function formatBytes(bytes: number | null | undefined, digits = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log2(bytes) / 10));
  const unit = units[idx] ?? 'B';
  return (bytes / 2 ** (10 * idx)).toFixed(digits) + ' ' + unit;
}

/** 百分比（0-100，保留 1 位小数） */
export function toPercent(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

