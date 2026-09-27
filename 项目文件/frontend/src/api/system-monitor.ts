import { request } from '../utils/request';
import type { UnifiedResponse } from '../types/user';

/**
 * 资源监视接口。
 *
 * 后端为 GET /system/monitor（无尾部斜杠），仅管理员可访问；
 * 数据来自进程内单例采样器的内存环形缓冲，不做数据库持久化。
 */

/** CPU 占用按用途拆分（百分比，各项之和约为 100）。 */
export interface CpuBreakdown {
  user: number;
  system: number;
  iowait: number;
  steal: number;
  idle: number;
}

export interface CpuInfo {
  /** 全部核心平均值（%） */
  total: number;
  /** 每核心占用（%），长度等于逻辑核心数 */
  per_core: number[];
  breakdown: CpuBreakdown;
}

export interface MemoryInfo {
  total: number;
  used: number;
  cached: number;
  buffers: number;
  free: number;
  available: number;
  used_percent: number;
}

export interface SwapInfo {
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface LoadInfo {
  load1: number;
  load5: number;
  load15: number;
}

export interface DiskInfo {
  read_bytes_per_sec: number;
  write_bytes_per_sec: number;
  read_count_per_sec: number;
  write_count_per_sec: number;
}

export interface NetInfo {
  bytes_sent_per_sec: number;
  bytes_recv_per_sec: number;
  packets_sent_per_sec: number;
  packets_recv_per_sec: number;
}

export interface HostSnapshot {
  ts: number;
  cores: number;
  cpu: CpuInfo;
  memory: MemoryInfo;
  swap: SwapInfo;
  load: LoadInfo;
  disk: DiskInfo;
  net: NetInfo;
}

export interface ContainerCpu {
  /** false 表示未设 CPU 配额（如 compose 未配置 deploy.resources） */
  has_limit: boolean;
  quota_cores: number | null;
  used_cores: number | null;
  used_percent: number | null;
  throttled_count: number;
  throttled_seconds: number;
}

export interface ContainerMemory {
  has_limit: boolean;
  limit: number | null;
  current: number;
  used_percent: number | null;
  oom_kill_count: number;
  max_events: number;
}

export interface ContainerSnapshot {
  cpu: ContainerCpu;
  memory: ContainerMemory;
}

export interface PressureDimension {
  key: string;
  label: string;
  value: number;
}

export type PressureLevel = 'normal' | 'elevated' | 'high' | 'critical';

export interface Pressure {
  index: number;
  level: PressureLevel;
  level_label: string;
  dimensions: PressureDimension[];
  causes: string[];
}

export interface ProcessInfo {
  pid: number;
  name: string;
  username: string;
  status: string;
  cpu_percent: number;
  memory_rss: number;
  memory_percent: number;
}

/** 历史序列：每列等长，采样间隔约 1 秒 */
export interface HistorySeries {
  ts: number[];
  cpu_total: number[];
  cpu_user: number[];
  cpu_system: number[];
  cpu_iowait: number[];
  memory_used_percent: number[];
  memory_cached_percent: number[];
  memory_buffers_percent: number[];
  memory_free_percent: number[];
  load1: number[];
  load5: number[];
  load15: number[];
  disk_read_bps: number[];
  disk_write_bps: number[];
  net_sent_bps: number[];
  net_recv_bps: number[];
}

export interface MonitorMeta {
  /** true 表示后端运行在容器内：以下均为容器可见的数值 */
  in_container: boolean;
  platform: string;
  machine: string;
  sample_interval_seconds: number;
  history_seconds: number;
}

export interface MonitorData {
  host: HostSnapshot;
  container: ContainerSnapshot;
  pressure: Pressure;
  processes: ProcessInfo[];
  history: HistorySeries;
  meta: MonitorMeta;
}

/** 拉取资源监视数据。minutes: 1-10；processes: 1-50。 */
export async function getMonitorData(
  minutes = 5,
  processes = 20
): Promise<UnifiedResponse<MonitorData>> {
  return request<MonitorData>(
    '/system/monitor?minutes=' + minutes + '&processes=' + processes
  );
}
