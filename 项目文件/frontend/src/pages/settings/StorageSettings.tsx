import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  InputNumber,
  Progress,
  Result,
  Row,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ClockCircleOutlined,
  CopyOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  HddOutlined,
  InfoCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { getStorageInfo, updateReservedSpace } from '../../api/file-shares';
import type { StorageInfo } from '../../api/file-shares';
import {
  formatBytes,
  getStorageBreakdown,
  toPercent,
} from '../../api/storage';
import type {
  AccuracyLevel,
  StorageBreakdown,
  StorageCategory,
} from '../../api/storage';
import {
  getModelInventory,
  STATUS_COLOR,
  STATUS_LABEL,
} from '../../api/model-inventory';
import type {
  ModelInventory,
  ModelInventoryItem,
  ModelStatus,
} from '../../api/model-inventory';
import { resolveCssVar } from '../../hooks/useChartColors';
import { useTheme } from '../../contexts/ThemeContext';
import { isAdmin } from '../../utils/auth';
import styles from './StorageSettings.module.css';

const { Title, Text, Paragraph } = Typography;

/** 自动刷新间隔：目录遍历有秒级成本，不宜像资源监视那样 2 秒一次 */
const REFRESH_INTERVAL_MS = 60_000;

/** 精度档位：颜色语义与后端 accuracy 字段一一对应 */
const ACCURACY_META: Record<AccuracyLevel, { label: string; color: string }> = {
  exact: { label: '精确', color: 'success' },
  logical: { label: '逻辑值', color: 'warning' },
  residual: { label: '残差', color: 'purple' },
};

/** 分类 → design token 颜色（图表填充与图例共用，禁止硬编码 hex） */
const CATEGORY_COLOR: Record<string, string> = {
  model_local_ai: 'var(--color-purple)',
  model_modelscope: 'var(--color-indigo)',
  db: 'var(--color-gold)',
  cache: 'var(--color-cyan)',
  files: 'var(--color-info)',
  backups: 'var(--color-success)',
  other: 'var(--color-orange)',
};
const FALLBACK_COLOR = 'var(--text-tertiary)';

const CATEGORY_ICON: Record<string, ReactNode> = {
  model_local_ai: <RobotOutlined />,
  model_modelscope: <RobotOutlined />,
  db: <DatabaseOutlined />,
  cache: <ThunderboltOutlined />,
  files: <FolderOpenOutlined />,
  backups: <HddOutlined />,
  other: <HddOutlined />,
};

/** 宿主机侧命令提示：应用容器内无数据源可读，只能指向宿主机 */
const HOST_COMMANDS: { label: string; cmd: string }[] = [
  { label: '查看 Docker 存储明细', cmd: 'docker system df' },
  { label: '查看构建缓存占用', cmd: 'docker builder du' },
];

function categoryIcon(key: string): ReactNode {
  return CATEGORY_ICON[key] ?? <HddOutlined />;
}

function accuracyTag(level: AccuracyLevel): ReactNode {
  const meta = ACCURACY_META[level] ?? ACCURACY_META.exact;
  return <Tag color={meta.color ?? 'default'}>{meta.label}</Tag>;
}

function clampPercent(part: number, total: number): number {
  return Math.min(100, Math.max(0, toPercent(part, total)));
}

/**
 * 存储占用分布区块。
 *
 * 拆成独立组件：内部有多个 hook 且需要早退之外的稳定调用顺序，
 * 与外层「权限不足 / 加载中」的早退路径隔离，避免 hooks 顺序违规。
 */
function BreakdownSection() {
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [nextRefreshIn, setNextRefreshIn] = useState(REFRESH_INTERVAL_MS / 1000);

  const { isDark } = useTheme();
  const antdToken = theme.useToken().token;

  const loadBreakdown = useCallback(async (silent = false) => {
    if (!silent) setBreakdownLoading(true);
    try {
      const res = await getStorageBreakdown();
      setBreakdown(res.data ?? null);
      setBreakdownError(null);
    } catch (err) {
      setBreakdownError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (!silent) setBreakdownLoading(false);
      setNextRefreshIn(REFRESH_INTERVAL_MS / 1000);
    }
  }, []);

  useEffect(() => {
    void loadBreakdown();
    const timer = window.setInterval(() => void loadBreakdown(true), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadBreakdown]);

  // 倒计时提示：目录遍历有秒级成本，让等待可预期
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNextRefreshIn((s) => (s > 1 ? s - 1 : REFRESH_INTERVAL_MS / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const copyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      message.success('命令已复制');
    } catch {
      message.error('复制失败，请手动选择命令文本');
    }
  };

  const countedTotal = breakdown?.measured_total_bytes ?? 0;

  const ringData = useMemo(() => {
    if (!breakdown) return [];
    return breakdown.categories
      .filter((c) => c.counted && (c.bytes ?? 0) > 0)
      .map((c) => ({
        name: c.name,
        value: c.bytes ?? 0,
        color: resolveCssVar(CATEGORY_COLOR[c.key] ?? FALLBACK_COLOR),
        percent: clampPercent(c.bytes ?? 0, countedTotal),
      }));
    // isDark / antdToken 仅作失效信号：CSS 变量随 data-theme 切换而变化，
    // recharts 的 fill 是 SVG attribute，无法解析 var(...)，必须在运行时解析
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, countedTotal, isDark, antdToken]);

  const other = breakdown?.categories.find((c) => c.key === 'other') ?? null;
  const logicalRef = breakdown?.logical_reference_bytes ?? 0;

  const tooltipProps = {
    contentStyle: {
      backgroundColor: antdToken.colorBgElevated,
      border: '1px solid ' + antdToken.colorBorderSecondary,
      borderRadius: 8,
      color: antdToken.colorText,
    },
    itemStyle: { color: antdToken.colorText },
    labelStyle: { color: antdToken.colorTextSecondary },
  };

  const categoryColumns: ColumnsType<StorageCategory> = [
    {
      title: '分类',
      dataIndex: 'name',
      key: 'name',
      width: 210,
      render: (_, record) => (
        <span className={styles.catName ?? ''}>
          <span className={styles.catIcon ?? ''}>{categoryIcon(record.key)}</span>
          <span>{record.name}</span>
        </span>
      ),
    },
    {
      title: '大小',
      dataIndex: 'bytes',
      key: 'bytes',
      width: 120,
      align: 'right',
      render: (value, record) =>
        record.reachable ? (
          <Text strong>{formatBytes(value)}</Text>
        ) : (
          <Tag color="default">未计入</Tag>
        ),
    },
    {
      title: '占比',
      key: 'percent',
      width: 90,
      align: 'right',
      render: (_, record) =>
        record.counted
          ? toPercent(record.bytes ?? 0, countedTotal) + '%'
          : record.reachable
            ? '参考'
            : '—',
    },
    {
      title: '精度',
      dataIndex: 'accuracy',
      key: 'accuracy',
      width: 90,
      render: (value: AccuracyLevel) => accuracyTag(value),
    },
    {
      title: '数据源',
      key: 'source',
      width: 170,
      render: (_, record) => (
        <span className={styles.sourceText ?? ''}>
          {record.source}
          {record.path ? (
            <Tooltip title={record.path}>
              <InfoCircleOutlined className={styles.pathHint ?? ''} />
            </Tooltip>
          ) : null}
        </span>
      ),
    },
    {
      title: '口径说明',
      key: 'note',
      render: (_, record) => {
        const bits = [record.anchor, record.note].filter(Boolean) as string[];
        if (bits.length === 0) return <Text type="secondary">—</Text>;
        return (
          <div className={styles.noteCell ?? ''}>
            {bits.map((bit, i) => (
              <div key={i}>{bit}</div>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <Card
      title="存储占用分布"
      className={styles.breakdownCard ?? ''}
      extra={
        <div className={styles.breakdownExtra ?? ''}>
          {breakdown ? (
            <Text type="secondary" className={styles.breakdownMeta ?? ''}>
              <ClockCircleOutlined />
              {breakdown.generated_at.slice(11, 19)} · 耗时 {breakdown.elapsed_ms} ms ·{' '}
              {nextRefreshIn}s 后自动刷新
            </Text>
          ) : null}
          <Button
            icon={<ReloadOutlined />}
            loading={breakdownLoading}
            onClick={() => void loadBreakdown()}
          >
            刷新
          </Button>
        </div>
      }
    >
      {breakdownError && !breakdown ? (
        <Alert
          type="warning"
          showIcon
          message="存储占用分布加载失败"
          description={breakdownError}
          action={
            <Button size="small" onClick={() => void loadBreakdown()}>
              重试
            </Button>
          }
        />
      ) : null}

      {breakdown && (
        <>
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} md={10}>
              <div className={styles.chartWrap ?? ''}>
                {ringData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={ringData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="60%"
                        outerRadius="88%"
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={1}
                        stroke={antdToken.colorBgContainer}
                        strokeWidth={2}
                        isAnimationActive={false}
                      >
                        {ringData.map((seg) => (
                          <Cell key={seg.name} fill={seg.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        {...tooltipProps}
                        formatter={(value, name) => [
                          formatBytes(Number(value)) +
                            '（' +
                            toPercent(Number(value), countedTotal) +
                            '%）',
                          String(name),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={styles.chartEmpty ?? ''}>
                    <Text type="secondary">本次没有可计入的分类</Text>
                  </div>
                )}
                {ringData.length > 0 ? (
                  <div className={styles.chartCenter ?? ''}>
                    <Text type="secondary" className={styles.chartCenterLabel ?? ''}>
                      已计入合计
                    </Text>
                    <Text strong className={styles.chartCenterValue ?? ''}>
                      {formatBytes(countedTotal)}
                    </Text>
                  </div>
                ) : null}
              </div>
            </Col>

            <Col xs={24} md={14}>
              <div className={styles.legendList ?? ''}>
                {breakdown.categories.map((c) => {
                  const color = resolveCssVar(CATEGORY_COLOR[c.key] ?? FALLBACK_COLOR);
                  return (
                    <div key={c.key} className={styles.legendItem ?? ''}>
                      <span
                        className={styles.legendDot ?? ''}
                        style={{ backgroundColor: color }}
                      />
                      <span className={styles.legendName ?? ''}>{c.name}</span>
                      <span className={styles.legendAccuracy ?? ''}>{accuracyTag(c.accuracy)}</span>
                      <span className={styles.legendValue ?? ''}>
                        {c.reachable ? formatBytes(c.bytes) : '未计入'}
                        {c.counted ? (
                          <span className={styles.legendPercent ?? ''}>
                            {' '}
                            {toPercent(c.bytes ?? 0, countedTotal)}%
                          </span>
                        ) : c.reachable ? (
                          <span className={styles.legendPercent ?? ''}> 参考</span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>

              {logicalRef > 0 ? (
                <Paragraph type="secondary" className={styles.logicalHint ?? ''}>
                  其中数据库与缓存为逻辑值（合计 {formatBytes(logicalRef)}），物理占用已包含在
                  「其他」的残差内，仅作参考列出、未计入合计。
                </Paragraph>
              ) : null}
            </Col>
          </Row>

          <div className={styles.tableWrap ?? ''}>
            <Table<StorageCategory>
              rowKey="key"
              size="small"
              columns={categoryColumns}
              dataSource={breakdown.categories}
              pagination={false}
              expandable={{
                rowExpandable: (record) => (record.details?.length ?? 0) > 0,
                expandedRowRender: (record) => (
                  <div className={styles.detailList ?? ''}>
                    {record.details?.map((d) => (
                      <div key={d.name} className={styles.detailItem ?? ''}>
                        <span>{d.name}</span>
                        <span>{formatBytes(d.bytes)}</span>
                      </div>
                    ))}
                  </div>
                ),
              }}
            />
          </div>

          <Row gutter={[24, 16]} className={styles.diskRow ?? ''}>
            {breakdown.disks.map((disk) => {
              const percent = clampPercent(disk.used_bytes, disk.total_bytes);
              return (
                <Col xs={24} md={12} key={disk.key}>
                  <div className={styles.diskBlock ?? ''}>
                    <div className={styles.diskHead ?? ''}>
                      <Text strong>{disk.name}</Text>
                      <Tooltip title={'测量路径：' + disk.measured_via}>
                        <InfoCircleOutlined className={styles.pathHint ?? ''} />
                      </Tooltip>
                    </div>
                    <Progress
                      percent={percent}
                      status={percent >= 90 ? 'exception' : 'normal'}
                    />
                    <div className={styles.diskStats ?? ''}>
                      <Text type="secondary">
                        已用 {formatBytes(disk.used_bytes)} / {formatBytes(disk.total_bytes)}
                        · 剩余 {formatBytes(disk.free_bytes)}
                      </Text>
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>

          {other ? (
            <Alert
              className={styles.otherAlert ?? ''}
              type={other.reachable ? 'info' : 'warning'}
              showIcon
              message={'「' + other.name + '」为什么没有更细的分解'}
              description={
                <div className={styles.otherBody ?? ''}>
                  {other.anchor ? <div>{other.anchor}</div> : null}
                  {other.note ? <div>{other.note}</div> : null}
                  <div className={styles.cmdList ?? ''}>
                    {HOST_COMMANDS.map((item) => (
                      <div key={item.cmd} className={styles.cmdRow ?? ''}>
                        <Text type="secondary">{item.label}</Text>
                        <code className={styles.cmd ?? ''}>{item.cmd}</code>
                        <Button
                          size="small"
                          type="text"
                          icon={<CopyOutlined />}
                          onClick={() => void copyCommand(item.cmd)}
                        >
                          复制
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              }
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

/** 用途类型展示顺序：先语音链路（识别 → 端点 → 标点 → 声纹），再生成类，最后未分类 */
const TYPE_ORDER: Record<string, number> = {
  asr: 0,
  vad: 1,
  punc: 2,
  spk: 3,
  llm: 10,
  code: 11,
  vision: 12,
  unknown: 99,
};

const ENGINE_LABEL: Record<string, string> = {
  llamacpp: 'llama.cpp',
  modelscope: 'ModelScope',
};

/**
 * 模型清单区块。
 *
 * 把两个引擎的模型排在同一张表里，按用途类型分组。用途是元数据而非目录位置，
 * 所以不需要把模型文件挪进同一个目录就能得到「一块放在一起」的效果。
 *
 * 本区块只读：下载 / 删除等管理动作由第三方配置页持有，避免两处各自实现一份。
 */
function ModelInventorySection() {
  const [inventory, setInventory] = useState<ModelInventory | null>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    try {
      const res = await getModelInventory();
      setInventory(res.data ?? null);
      setInvError(null);
    } catch (err) {
      setInvError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setInvLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const items = useMemo(
    () =>
      [...(inventory?.items ?? [])].sort(
        (a, b) =>
          (TYPE_ORDER[a.type_key] ?? 50) - (TYPE_ORDER[b.type_key] ?? 50) || b.bytes - a.bytes,
      ),
    [inventory],
  );

  const columns: ColumnsType<ModelInventoryItem> = [
    {
      title: '用途',
      dataIndex: 'model_type',
      key: 'model_type',
      width: 110,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '模型',
      key: 'name',
      render: (_, record) => (
        <div className={styles.invModel ?? ''}>
          <div className={styles.invModelName ?? ''}>{record.name}</div>
          {record.repo_id ? (
            <Tooltip title={record.repo_id}>
              <Text type="secondary" className={styles.invRepoId ?? ''}>
                {record.repo_id}
              </Text>
            </Tooltip>
          ) : null}
        </div>
      ),
    },
    {
      title: '引擎',
      dataIndex: 'engine',
      key: 'engine',
      width: 104,
      render: (value: string) => ENGINE_LABEL[value] ?? value,
    },
    {
      title: '体积',
      dataIndex: 'bytes',
      key: 'bytes',
      width: 104,
      align: 'right',
      render: (value: number) => formatBytes(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 88,
      render: (value: ModelStatus) => (
        <Tag color={STATUS_COLOR[value] ?? 'default'}>{STATUS_LABEL[value] ?? value}</Tag>
      ),
    },
    {
      title: '说明',
      dataIndex: 'note',
      key: 'note',
      render: (value: string | null | undefined) =>
        value ? <Text type="secondary">{value}</Text> : null,
    },
  ];

  return (
    <Card
      title="模型清单"
      className={styles.invCard ?? ''}
      extra={
        <Button
          icon={<ReloadOutlined />}
          loading={invLoading}
          onClick={() => void loadInventory()}
        >
          刷新
        </Button>
      }
    >
      <Paragraph type="secondary" className={styles.invHint ?? ''}>
        两个引擎的模型分别住在各自的命名卷里，管理动作也不同，所以这里按用途
        统一列出而不合并总数。下载与删除请到「第三方配置 → 模型配置」操作。
      </Paragraph>

      {invError ? (
        <Alert
          type="error"
          showIcon
          className={styles.invNotes ?? ''}
          message="模型清单加载失败"
          description={invError}
        />
      ) : null}

      {(inventory?.notes ?? []).length > 0 ? (
        <Alert
          type="warning"
          showIcon
          className={styles.invNotes ?? ''}
          message={(inventory?.notes ?? []).map((note, index) => (
            <div key={index}>{note}</div>
          ))}
        />
      ) : null}

      {(inventory?.engines ?? []).length > 0 ? (
        <div className={styles.invChips ?? ''}>
          {(inventory?.engines ?? []).map((engine) => (
            <div key={engine.engine} className={styles.invChip ?? ''}>
              <RobotOutlined className={styles.invChipIcon ?? ''} />
              <Text className={styles.invChipLabel ?? ''}>{engine.engine_name}</Text>
              <Text strong className={styles.invChipValue ?? ''}>
                {formatBytes(engine.bytes)}
              </Text>
              <Text type="secondary" className={styles.invChipCount ?? ''}>
                {engine.count} 个模型
              </Text>
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.tableWrap ?? ''}>
        <Table<ModelInventoryItem>
          rowKey={(record) => record.engine + '/' + record.repo_id + '/' + record.name}
          columns={columns}
          dataSource={items}
          loading={invLoading}
          pagination={false}
          size="middle"
          locale={{ emptyText: '未找到已下载的模型' }}
        />
      </div>
    </Card>
  );
}

export default function StorageSettings() {
  const admin = isAdmin();
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [reserved, setReserved] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    getStorageInfo()
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setReserved(data.reserved_space_gb);
      })
      .catch(() => {
        // 加载失败，保持默认值
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [admin]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateReservedSpace(reserved);
      message.success('预留空间已更新');
    } catch {
      message.error('更新失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (!admin) {
    return (
      <Result
        status="403"
        title="权限不足"
        subTitle="只有管理员可以查看存储设置"
        icon={<LockOutlined />}
      />
    );
  }

  if (loading) {
    return <Card loading />;
  }

  const usedPercent =
    info && info.total_space_gb > 0
      ? Math.min(100, parseFloat(((info.used_space_gb / info.total_space_gb) * 100).toFixed(1)))
      : 0;

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          存储设置
        </Title>
      </div>

      <Card title="磁盘空间">
        <div className={styles.statsRow ?? ''}>
          <Card className={styles.statCard ?? ''}>
            <Statistic title="总空间" value={info?.total_space_gb ?? 0} precision={2} suffix="GB" />
          </Card>
          <Card className={styles.statCard ?? ''}>
            <Statistic title="已使用" value={info?.used_space_gb ?? 0} precision={2} suffix="GB" />
          </Card>
          <Card className={styles.statCard ?? ''}>
            <Statistic title="剩余空间" value={info?.free_space_gb ?? 0} precision={2} suffix="GB" />
          </Card>
        </div>
        <div className={styles.progressBar ?? ''}>
          <Progress percent={usedPercent} />
        </div>
        <div className={styles.reservedSection ?? ''}>
          <Text>预留空间</Text>
          <InputNumber
            min={0}
            value={reserved}
            onChange={(value) => setReserved(value ?? 0)}
            addonAfter="GB"
            style={{ width: 160 }}
          />
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
        </div>
      </Card>

      <BreakdownSection />

      <ModelInventorySection />
    </div>
  );
}
