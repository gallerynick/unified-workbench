import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Card,
  Empty,
  Progress,
  Result,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { LockOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { getMonitorData } from '../../api/system-monitor';
import type {
  CpuBreakdown,
  MonitorData,
  PressureLevel,
  ProcessInfo,
} from '../../api/system-monitor';
import { useMonitorChartColors } from '../../hooks/useChartColors';
import type { MonitorChartColors } from '../../hooks/useChartColors';
import { isAdmin } from '../../utils/auth';
import styles from './ResourceMonitor.module.css';

const { Title, Text, Paragraph } = Typography;

const POLL_INTERVAL_MS = 2000;
const HISTORY_MINUTES = 5;
const PROCESS_TOP = 20;
const AXIS_TICK = { fontSize: 12 };

type UnitKind = 'pct' | 'bytes' | 'load';

// ── 数值格式化 ──────────────────────────────────────────────

function formatBytes(bytes: number, digits = 1): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log2(bytes) / 10));
  const name = units[idx] ?? 'B';
  return (bytes / 2 ** (10 * idx)).toFixed(digits) + ' ' + name;
}

function formatRate(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 B/s';
  return formatBytes(bytesPerSec) + '/s';
}

function formatClock(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('zh-CN', { hour12: false });
}

function unitFormatter(unit: UnitKind): (value: number) => string {
  if (unit === 'bytes') return (v) => formatBytes(v);
  if (unit === 'pct') return (v) => v.toFixed(0) + '%';
  return (v) => v.toFixed(1);
}

// ── 颜色分档 ────────────────────────────────────────────────

function levelColor(level: PressureLevel, colors: MonitorChartColors): string {
  switch (level) {
    case 'elevated':
      return colors.levelElevated;
    case 'high':
      return colors.levelHigh;
    case 'critical':
      return colors.levelCritical;
    default:
      return colors.levelNormal;
  }
}

/** 每核心与概览进度条共用三档色：正常 / 偏高 / 过载 */
function bandColor(percent: number, colors: MonitorChartColors): string {
  if (percent >= 80) return colors.coreHigh;
  if (percent >= 60) return colors.coreMid;
  return colors.coreLow;
}

function processStatusTag(status: string): React.ReactNode {
  const map: Record<string, string> = {
    running: 'processing',
    stopped: 'default',
    sleeping: 'default',
    zombie: 'error',
  };
  return <Tag color={map[status] ?? 'default'}>{status}</Tag>;
}

// ── 数据映射 ────────────────────────────────────────────────

interface RingSegment {
  name: string;
  value: number;
  color: string;
}

function buildCpuRing(bd: CpuBreakdown, colors: MonitorChartColors): RingSegment[] {
  const segments: RingSegment[] = [
    { name: '使用者', value: bd.user, color: colors.user },
    { name: '系统', value: bd.system, color: colors.system },
    { name: 'I/O 等待', value: bd.iowait, color: colors.iowait },
    { name: '虚拟化', value: bd.steal, color: colors.steal },
    { name: '闲置', value: bd.idle, color: colors.idle },
  ];
  return segments.filter((s) => s.value > 0.05);
}

interface SeriesDef {
  key: string;
  name: string;
  color: string;
}

// ── 趋势图 ─────────────────────────────────────────────────

function SeriesChart({
  data,
  series,
  height,
  unit,
  yMax,
  stacked = false,
  asLine = false,
  referenceLine,
}: {
  data: Array<Record<string, string | number>>;
  series: SeriesDef[];
  height: number;
  unit: UnitKind;
  yMax?: number;
  stacked?: boolean;
  asLine?: boolean;
  referenceLine?: { y: number; label: string };
}) {
  const colors = useMonitorChartColors();
  const fmt = unitFormatter(unit);
  const fillOpacity = asLine ? 0 : stacked ? 1 : 0.18;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="t"
          tick={{ ...AXIS_TICK, fill: colors.axis }}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
          minTickGap={56}
        />
        <YAxis
          tick={{ ...AXIS_TICK, fill: colors.axis }}
          tickLine={false}
          axisLine={false}
          width={58}
          domain={yMax ? [0, yMax] : [0, 'auto']}
          tickFormatter={(value) => fmt(Number(value))}
        />
        <Tooltip
          cursor={{ stroke: colors.grid }}
          formatter={(value, name) => [fmt(Number(value)), String(name)]}
        />
        {referenceLine ? (
          <ReferenceLine
            y={referenceLine.y}
            stroke={colors.refLine}
            strokeDasharray="4 4"
            label={{
              value: referenceLine.label,
              fill: colors.axis,
              fontSize: 12,
              position: 'insideTopRight',
            }}
          />
        ) : null}
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            {...(stacked ? { stackId: 'total' } : {})}
            stroke={s.color}
            strokeWidth={1.5}
            fill={s.color}
            fillOpacity={fillOpacity}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── 页头刷新按钮 ───────────────────────────────────────────

function RefreshButton() {
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  return (
    <ReloadOutlined
      spin={spinning}
      aria-label="刷新"
      style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
      onClick={() => {
        if (spinning) return;
        setSpinning(true);
        window.dispatchEvent(new CustomEvent('resource-monitor-refresh'));
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setSpinning(false), 1200);
      }}
    />
  );
}

// ── 页面 ───────────────────────────────────────────────────

export default function ResourceMonitor() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const busy = useRef(false);
  const colors = useMonitorChartColors();

  useEffect(() => {
    const onRefresh = () => {
      void reload();
    };
    window.addEventListener('resource-monitor-refresh', onRefresh);
    return () => window.removeEventListener('resource-monitor-refresh', onRefresh);

    async function reload() {
      if (!isAdmin() || busy.current) return;
      busy.current = true;
      try {
        const res = await getMonitorData(HISTORY_MINUTES, PROCESS_TOP);
        if (res.data) {
          setData(res.data);
          setLastUpdate(Date.now());
          setFailed(false);
        }
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isAdmin()) return;
    const timer = window.setInterval(() => {
      // 标签页不可见时暂停，避免后台空转
      if (!document.hidden) {
        window.dispatchEvent(new CustomEvent('resource-monitor-refresh'));
      }
    }, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) {
        window.dispatchEvent(new CustomEvent('resource-monitor-refresh'));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.dispatchEvent(new CustomEvent('resource-monitor-refresh'));
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  if (!isAdmin()) {
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="只有管理员可以查看资源监视"
        icon={<LockOutlined />} 
      />
    );
  }

  if (loading && !data) {
    return <Card loading />;
  }

  if (!data) {
    return (
      <Alert
        type="error"
        showIcon
        message="资源数据加载失败"
        description="无法获取运行环境指标，请确认后端服务正常。"
      />
    );
  }

  return <MonitorContent data={data} colors={colors} failed={failed} lastUpdate={lastUpdate} />;
}


function MonitorContent({ data, colors, failed, lastUpdate }: { data: MonitorData; colors: MonitorChartColors; failed: boolean; lastUpdate: number | null }) {
  const { host, container, pressure, processes, history, meta } = data;
  const rings = useMemo(() => buildCpuRing(host.cpu.breakdown, colors), [host, colors]);

  const cpuTrend = useMemo(
    () =>
      history.ts.map((ts, i) => ({
        t: formatClock(ts),
        value: history.cpu_total[i] ?? 0,
      })),
    [history]
  );
  const memorySeries = useMemo(
    () =>
      history.ts.map((ts, i) => ({
        t: formatClock(ts),
        used: history.memory_used_percent[i] ?? 0,
        cached: history.memory_cached_percent[i] ?? 0,
        buffers: history.memory_buffers_percent[i] ?? 0,
        free: history.memory_free_percent[i] ?? 0,
      })),
    [history]
  );
  const loadSeries = useMemo(
    () =>
      history.ts.map((ts, i) => ({
        t: formatClock(ts),
        load1: history.load1[i] ?? 0,
        load5: history.load5[i] ?? 0,
        load15: history.load15[i] ?? 0,
      })),
    [history]
  );
  const ioSeries = useMemo(
    () =>
      history.ts.map((ts, i) => ({
        t: formatClock(ts),
        read: history.disk_read_bps[i] ?? 0,
        write: history.disk_write_bps[i] ?? 0,
      })),
    [history]
  );
  const netSeries = useMemo(
    () =>
      history.ts.map((ts, i) => ({
        t: formatClock(ts),
        sent: history.net_sent_bps[i] ?? 0,
        recv: history.net_recv_bps[i] ?? 0,
      })),
    [history]
  );

  const perCore = host.cpu.per_core.map((value, i) => ({ index: i, value }));
  const pressureColor = levelColor(pressure.level, colors);

  const processColumns: ColumnsType<ProcessInfo> = [
    {
      title: 'PID',
      dataIndex: 'pid',
      width: 84,
      sorter: (a, b) => a.pid - b.pid,
      render: (value: number) => <span className="text-body-mono">{value}</span>,
    },
    {
      title: '进程名',
      dataIndex: 'name',
      ellipsis: true,
      render: (value: string) => value || '—',
    },
    { title: '用户', dataIndex: 'username', width: 132, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 104,
      render: (value: string) => processStatusTag(value),
    },
    {
      title: 'CPU',
      dataIndex: 'cpu_percent',
      width: 104,
      sorter: (a, b) => a.cpu_percent - b.cpu_percent,
      defaultSortOrder: 'descend',
      render: (value: number) => value.toFixed(1) + '%',
    },
    {
      title: '内存',
      dataIndex: 'memory_rss',
      width: 116,
      sorter: (a, b) => a.memory_rss - b.memory_rss,
      render: (value: number) => formatBytes(value),
    },
    {
      title: '占比',
      dataIndex: 'memory_percent',
      width: 92,
      sorter: (a, b) => a.memory_percent - b.memory_percent,
      render: (value: number) => value.toFixed(2) + '%',
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.title ?? ''}>
          资源监视
        </Title>
        <div className={styles.headerMeta}>
          {failed ? <Tag color="error">数据加载失败</Tag> : null}
          {lastUpdate ? (
            <Text className="text-caption">
              更新于 {new Date(lastUpdate).toLocaleTimeString('zh-CN', { hour12: false })}
            </Text>
          ) : null}
          <RefreshButton />
        </div>
      </div>

      {/* 概览卡 */}
      <div className={styles.statsRow}>
        <Card>
          <Statistic
            title="CPU 总占用"
            value={host.cpu.total}
            precision={1}
            suffix="%"
            valueStyle={{ color: bandColor(host.cpu.total, colors) }}
          />
          <div className={styles.progressBlock}>
            <Progress
              percent={Math.min(100, host.cpu.total)}
              strokeColor={bandColor(host.cpu.total, colors)}
              strokeWidth={6}
              strokeLinecap="round"
              showInfo={false}
            />
          </div>
          <Text className="text-caption">
            {host.cores} 核 · 使用者 {host.cpu.breakdown.user.toFixed(1)}% · 系统{' '}
            {host.cpu.breakdown.system.toFixed(1)}%
          </Text>
        </Card>

        <Card>
          <Statistic
            title="内存"
            value={host.memory.used_percent}
            precision={1}
            suffix="%"
            valueStyle={{ color: bandColor(host.memory.used_percent, colors) }}
          />
          <div className={styles.progressBlock}>
            <Progress
              percent={Math.min(100, host.memory.used_percent)}
              strokeColor={bandColor(host.memory.used_percent, colors)}
              strokeWidth={6}
              strokeLinecap="round"
              showInfo={false}
            />
          </div>
          <Text className="text-caption">
            已用 {formatBytes(host.memory.used)} / 共 {formatBytes(host.memory.total)}
          </Text>
        </Card>

        <Card>
          <Statistic title="系统负载" value={host.load.load1} precision={2} suffix=" / 1 分钟" />
          <Text className="text-caption">
            5 分钟 {host.load.load5.toFixed(2)} · 15 分钟 {host.load.load15.toFixed(2)}
          </Text>
          <Text className="text-caption">
            每核负载 {(host.load.load1 / Math.max(host.cores, 1)).toFixed(2)}（1.0 = 每核满载）
          </Text>
        </Card>

        <Card>
          <div className={styles.miniStats}>
            <Statistic
              title="磁盘读取"
              value={formatRate(host.disk.read_bytes_per_sec)}
              valueStyle={{ fontSize: 18 }}
            />
            <Statistic
              title="磁盘写入"
              value={formatRate(host.disk.write_bytes_per_sec)}
              valueStyle={{ fontSize: 18 }}
            />
          </div>
          <div className={styles.progressBlock}>
            <Text className="text-caption">网络发送 {formatRate(host.net.bytes_sent_per_sec)}</Text>
            <Text className="text-caption">网络接收 {formatRate(host.net.bytes_recv_per_sec)}</Text>
          </div>
        </Card>
      </div>

      {/* 压力分析 */}
      <Card title="压力分析">
        <div className={styles.pressureLayout}>
          <div className={styles.pressureGauge}>
            <Progress
              type="dashboard"
              percent={Math.min(100, pressure.index)}
              strokeColor={pressureColor}
              trailColor="var(--bg-tertiary)"
              strokeWidth={9}
              width={148}
              format={(value) => (
                <span>
                  <div className="text-heading-3">{Math.round(Number(value ?? 0))}</div>
                  <div className="text-caption">{pressure.level_label}</div>
                </span>
              )}
            />
          </div>
          <div className={styles.pressureDims}>
            {pressure.dimensions.map((dim) => (
              <div key={dim.key} className={styles.dimRow}>
                <span className="text-body-sm">{dim.label}</span>
                <Progress
                  percent={Math.min(100, dim.value)}
                  strokeColor={bandColor(dim.value, colors)}
                  strokeWidth={6}
                  strokeLinecap="round"
                  showInfo={false}
                />
                <span className="text-body-sm">{dim.value.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
        {pressure.causes.length > 0 ? (
          <Alert
            className={styles.note ?? ''}
            type={pressure.level === 'critical' ? 'error' : 'warning'}
            showIcon
            message="当前压力成因"
            description={'综合压力由以下维度触发：' + pressure.causes.join('、') + '。'}
          />
        ) : (
          <Alert
            className={styles.note ?? ''}
            type="success"
            showIcon
            message="各维度均未达阈值（60%），运行平稳"
          />
        )}
      </Card>

      {/* 运行环境与容器配额 */}
      <div className={styles.twoCol}>
        <Card title="运行环境">
          <ul className={styles.metaList}>
            <li className="text-body-sm">
              机器：<span className="text-body-mono">{meta.platform} / {meta.machine}</span>
            </li>
            <li className="text-body-sm">逻辑核心：{host.cores}</li>
            <li className="text-body-sm">采样间隔：{meta.sample_interval_seconds.toFixed(1)} 秒</li>
            <li className="text-body-sm">历史窗口：{(meta.history_seconds / 60).toFixed(0)} 分钟</li>
          </ul>
          {meta.in_container ? (
            <Alert
              className={styles.note ?? ''}
              type="info"
              showIcon
              message="后端运行在容器内"
              description="以上为容器可见的运行环境数值。在 Docker Desktop（macOS / Windows）上该环境为 Docker VM，并非物理机。"
            />
          ) : null}
        </Card>

        <Card title="本容器配额">
          <div className={styles.progressBlock}>
            <div className={styles.progressItem}>
              <div className={styles.progressHead}>
                <Text className="text-body-sm">CPU 配额</Text>
                <Text className="text-caption">
                  {container.cpu.has_limit
                    ? container.cpu.quota_cores?.toFixed(2) + ' 核'
                    : '未设配额'}
                </Text>
              </div>
              {container.cpu.used_percent != null ? (
                <Progress
                  percent={Math.min(100, container.cpu.used_percent)}
                  strokeColor={bandColor(container.cpu.used_percent, colors)}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              ) : (
                <Text className="text-caption">
                  已用 {container.cpu.used_cores?.toFixed(2) ?? '—'} 核
                </Text>
              )}
            </div>

            <div className={styles.progressItem}>
              <div className={styles.progressHead}>
                <Text className="text-body-sm">内存配额</Text>
                <Text className="text-caption">
                  {container.memory.has_limit
                    ? formatBytes(container.memory.limit ?? 0)
                    : '未设配额'}
                </Text>
              </div>
              {container.memory.used_percent != null ? (
                <Progress
                  percent={Math.min(100, container.memory.used_percent)}
                  strokeColor={bandColor(container.memory.used_percent, colors)}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
              ) : (
                <Text className="text-caption">当前占用 {formatBytes(container.memory.current)}</Text>
              )}
            </div>
          </div>
          <ul className={styles.metaList}>
            <li className="text-body-sm">
              CPU 限流：{container.cpu.throttled_count} 次 / {container.cpu.throttled_seconds.toFixed(2)} 秒
            </li>
            <li className="text-body-sm">
              内存超限事件：{container.memory.max_events} 次
              {container.memory.oom_kill_count > 0
                ? '（其中 OOM kill ' + container.memory.oom_kill_count + ' 次）'
                : ''}
            </li>
          </ul>
          {!container.cpu.has_limit || !container.memory.has_limit ? (
            <Alert
              className={styles.note ?? ''}
              type="info"
              showIcon
              message="当前 compose 未配置 deploy.resources.limits"
              description="故只能显示绝对占用。如需占比，请在 docker-compose.yml 为后端服务补充资源限制。"
            />
          ) : null}
        </Card>
      </div>

      {/* CPU 使用率环形拆分 */}
      <Card title="CPU 使用率">
        <div className={styles.ringLayout}>
          <div className={styles.ringWrap}>
            {rings.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rings}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="66%"
                    outerRadius="94%"
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={1}
                    stroke={colors.cardBg}
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {rings.map((seg) => (
                      <Cell key={seg.name} fill={seg.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [Number(value).toFixed(1) + '%', String(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="41"
                  fill="none"
                  stroke={rings[0]?.color ?? colors.idle}
                  strokeWidth={16}
                />
              </svg>
            )}
            <div className={styles.ringCenter}>
              <div className="text-heading-3">{host.cpu.total.toFixed(0)}</div>
              <div className="text-caption">% 占用</div>
            </div>
          </div>
          <div className={styles.ringLegend}>
            {rings.map((seg) => (
              <div key={seg.name} className={styles.legendRow}>
                <span className={styles.legendSwatch} style={{ background: seg.color }} />
                <span className="text-body-sm">{seg.name}</span>
                <span className="text-body-sm">{seg.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* CPU 趋势 */}
      <Card title="CPU 使用率趋势">
        <SeriesChart
          data={cpuTrend}
          series={[{ key: 'value', name: 'CPU 占用', color: colors.user }]}
          height={200}
          unit="pct"
          yMax={100}
        />
      </Card>

      {/* 各核心占用 */}
      <Card title={'各核心占用（' + host.cores + ' 核）'}>
        <div className={styles.coreGrid}>
          {perCore.map((core) => (
            <div key={core.index} className={styles.coreRow}>
              <span className="text-body-sm">{core.index} 核</span>
              <Progress
                percent={Math.min(100, core.value)}
                strokeColor={bandColor(core.value, colors)}
                strokeWidth={6}
                strokeLinecap="round"
                showInfo={false}
              />
              <span className="text-body-sm">{core.value.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 内存使用率 */}
      <Card title="内存使用率">
        <SeriesChart
          data={memorySeries}
          series={[
            { key: 'used', name: '已用', color: colors.memoryUsed },
            { key: 'cached', name: '缓存', color: colors.memoryCached },
            { key: 'buffers', name: '缓冲', color: colors.memoryBuffers },
            { key: 'free', name: '空闲', color: colors.memoryFree },
          ]}
          height={240}
          unit="pct"
          yMax={100}
          stacked
        />
      </Card>

      {/* 系统负载 */}
      <Card title="系统负载">
        <SeriesChart
          data={loadSeries}
          series={[
            { key: 'load1', name: '1 分钟', color: colors.load1 },
            { key: 'load5', name: '5 分钟', color: colors.load5 },
            { key: 'load15', name: '15 分钟', color: colors.load15 },
          ]}
          height={220}
          unit="load"
          asLine
          referenceLine={{ y: host.cores, label: '核心数 ' + host.cores }}
        />
      </Card>

      {/* 磁盘与网络 IO */}
      <Card title="磁盘与网络 IO">
        <div className={styles.twoCol}>
          <div>
            <Text className="text-caption">磁盘读 / 写</Text>
            <SeriesChart
              data={ioSeries}
              series={[
                { key: 'read', name: '读取', color: colors.diskRead },
                { key: 'write', name: '写入', color: colors.diskWrite },
              ]}
              height={200}
              unit="bytes"
            />
          </div>
          <div>
            <Text className="text-caption">网络发送 / 接收</Text>
            <SeriesChart
              data={netSeries}
              series={[
                { key: 'sent', name: '发送', color: colors.netSent },
                { key: 'recv', name: '接收', color: colors.netRecv },
              ]}
              height={200}
              unit="bytes"
            />
          </div>
        </div>
      </Card>

      {/* 进程占用 */}
      <Card title={'进程占用（Top ' + processes.length + '）'}>
        <Table<ProcessInfo>
          columns={processColumns}
          dataSource={processes}
          rowKey="pid"
          size="small"
          pagination={false}
          scroll={{ x: 720 }}
          sticky
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无进程数据" /> }}
        />
        <Paragraph
          className="text-caption"
          style={{ marginTop: 'var(--spacing-card-gap)' }}
        >
          列表取 CPU Top 10 与内存 Top 10 的并集，按 CPU 降序。范围仅限后端容器内的进程：非 root
          无法读取其他容器的进程信息，也无法读取进程级磁盘 IO。
        </Paragraph>
      </Card>
    </div>
  );
}

