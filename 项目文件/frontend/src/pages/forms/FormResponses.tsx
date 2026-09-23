import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Table,
  Typography,
  Spin,
  Tag,
  Button,
  Descriptions,
  Alert,
  Result,
  message,
  theme,
} from 'antd';
import { ArrowLeftOutlined, ExportOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { getFormResponses, getFormStats, exportFormFile } from '../../api/forms';
import type { FormStats, FormStatsField } from '../../types/form';
import styles from './FormResponses.module.css';

const { Title, Text } = Typography;

/** 图表配色序列：取固定色值而非 CSS 变量，SVG 表现层属性不解析 var() */
const CHART_COLORS = ['#1677ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16', '#2f54eb'];

/** 按下标取配色，规避 noUncheckedIndexedAccess 下的 undefined */
function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? '#1677ff';
}

const AXIS_TICK = { fontSize: 12 };

/** 柱状图通用配置：坐标轴与网格线颜色跟随 antd token，深浅色模式自动切换 */
function ChartFrame({
  data,
  height,
  color,
  labelKey,
}: {
  data: Array<{ name: string; count: number }>;
  height: number;
  color?: string;
  labelKey?: string;
}) {
  const { token } = theme.useToken();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 12, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ ...AXIS_TICK, fill: token.colorTextSecondary }}
          tickLine={false}
          axisLine={{ stroke: token.colorBorderSecondary }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ ...AXIS_TICK, fill: token.colorTextSecondary }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip cursor={{ fill: token.colorFillTertiary }} />
        <Bar
          dataKey="count"
          name={labelKey ?? '数量'}
          fill={color ?? '#1677ff'}
          radius={[4, 4, 0, 0]}
          barSize={36}
        >
          <LabelList dataKey="count" position="top" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ResponseRow {
  id: string;
  created_at: string;
  respondent_name: string;
  values: Record<string, unknown>;
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN') : '—';
}

function formatRate(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

function formatResponseValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length > 0 ? value.join('，') : '—';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

/** 单一选项占 100% 时的环形图。
 *
 * recharts 的扇形走 SVG 的 A 弧命令，而 A 画不出整圆：360° 时起点与终点重合，
 * 路径退化为一条线（recharts Sector.js 里也有这条注释）。单一片场景改用原生
 * circle 渲染，保证闭环。
 */
function SingleSliceRing({ name, count }: { name: string; count: number }) {
  const color = chartColor(0);
  const size = 184;
  return (
    <div className={styles.pieSingle ?? ''}>
      <svg width={size} height={size} role="img" aria-label={name}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={67}
          fill="none"
          stroke={color}
          strokeWidth={32}
        />
      </svg>
      <div className={styles.pieSingleLegend ?? ''}>
        <span className={styles.pieSwatch ?? ''} style={{ background: color }} />
        <span className={styles.pieSingleName ?? ''}>{name}</span>
        <span className={styles.pieSingleValue ?? ''}>{count}（100%）</span>
      </div>
    </div>
  );
}

/** 选项类字段（select / radio / checkbox）：计数柱状图 + 占比饼图 */
function OptionChart({ field }: { field: FormStatsField }) {
  const data = (field.option_counts ?? []).map((item) => ({
    name: item.option,
    count: item.count,
  }));
  if (data.length === 0) {
    return <Text type="secondary">该字段未定义选项</Text>;
  }
  const total = data.reduce((sum, item) => sum + item.count, 0);
  // 饼图只画有投票的选项：0 值扇区会吃掉 paddingAngle 的视觉留白，
  // 让「所有人都选同一项」看起来像少了一块
  const pieData = data.filter((item) => item.count > 0);
  const only = pieData.length === 1 ? pieData[0] : undefined;
  return (
    <div className={styles.chartRow ?? ''}>
      <div className={styles.chartPane ?? ''}>
        <div className={styles.chartCaption ?? ''}>各项计数</div>
        <ChartFrame data={data} height={240} labelKey="计数" />
      </div>
      <div className={styles.chartPane ?? ''}>
        <div className={styles.chartCaption ?? ''}>占比分布</div>
        {total === 0 ? (
          <div className={styles.chartEmpty ?? ''}>暂无数据，收到回复后展示占比</div>
        ) : only ? (
          <SingleSliceRing name={only.name} count={only.count} />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={86}
                paddingAngle={2}
                labelLine={false}
              >
                {pieData.map((item, index) => (
                  <Cell key={item.name} fill={chartColor(index)} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/** 数字字段的描述统计与分箱分布图 */
function NumberStats({ field }: { field: FormStatsField }) {
  const stats = field.number_stats;
  const bins = (field.bins ?? []).map((item) => ({ name: item.label, count: item.count }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <Descriptions
        size="small"
        bordered
        column={{ xs: 2, sm: 3, md: 6 }}
        items={[
          { key: 'count', label: '有效数值', children: stats?.count ?? 0 },
          { key: 'mean', label: '均值', children: stats?.mean ?? 0 },
          { key: 'median', label: '中位数', children: stats?.median ?? 0 },
          { key: 'min', label: '最小值', children: stats?.min ?? 0 },
          { key: 'max', label: '最大值', children: stats?.max ?? 0 },
          { key: 'stdev', label: '标准差', children: stats?.stdev ?? 0 },
        ]}
      />
      {bins.length > 0 ? (
        <ChartFrame data={bins} height={200} labelKey="数量" />
      ) : (
        <Text type="secondary">暂无有效数值，分箱分布待数据填充后展示</Text>
      )}
    </div>
  );
}

export default function FormResponses() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [stats, setStats] = useState<FormStats | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null);

  const loadStats = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getFormStats(id);
      if (res.code === 0 && res.data) {
        setStats(res.data);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadResponses = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getFormResponses(id, page, pageSize);
      if (res.code === 0 && res.data) {
        setResponses(
          res.data.items.map((item) => ({
            id: item.id,
            created_at: item.created_at,
            respondent_name: item.respondent_name,
            values: item.data,
          })),
        );
        setTotal(res.data.total);
      }
    } catch {
      message.error('获取回复明细失败');
    }
  }, [id, page, pageSize]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  const handleExport = async (fmt: 'xlsx' | 'csv'): Promise<void> => {
    if (!id) return;
    setExporting(fmt);
    try {
      await exportFormFile(id, fmt);
      message.success(fmt === 'xlsx' ? '已导出 Excel' : '已导出 CSV');
    } catch (error) {
      message.error(error instanceof Error && error.message ? error.message : '导出失败');
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Spin size="large" />
      </div>
    );
  }

  if (failed || !stats) {
    return (
      <div className={styles.container}>
        <Result
          status="403"
          title="无法查看统计"
          subTitle="表单不存在，或你没有查看权限"
        >
          <Button type="primary" icon={<ArrowLeftOutlined />} onClick={() => navigate('/forms')}>
            返回列表
          </Button>
        </Result>
      </div>
    );
  }

  const totalResponses = stats.total_responses;

  const columns: ColumnsType<ResponseRow> = [
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    ...stats.field_stats.map((field) => ({
      title: field.label,
      key: field.key,
      render: (_: unknown, record: ResponseRow) =>
        formatResponseValue(record.values[field.key]),
    })),
    {
      title: '提交者',
      dataIndex: 'respondent_name',
      key: 'respondent_name',
      width: 140,
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header ?? ''}>
        <div className={styles.headerLeft ?? ''}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/forms')}
            aria-label="返回列表"
          >
            返回
          </Button>
          <div>
            <Title level={4} className={styles.title ?? ''}>
              {stats.title} · 统计
            </Title>
            {stats.description ? (
              <Text type="secondary" className={styles.subtitle ?? ''}>
                {stats.description}
              </Text>
            ) : null}
          </div>
        </div>
        <div className={styles.headerRight ?? ''}>
          <Button
            icon={<ExportOutlined />}
            loading={exporting === 'xlsx'}
            onClick={() => void handleExport('xlsx')}
          >
            导出 Excel
          </Button>
          <Button
            icon={<ExportOutlined />}
            loading={exporting === 'csv'}
            onClick={() => void handleExport('csv')}
          >
            导出 CSV
          </Button>
        </div>
      </div>

      <div className={styles.overview ?? ''}>
        <div className={styles.overviewItem ?? ''}>
          <div className={styles.overviewLabel ?? ''}>回复总数</div>
          <div className={styles.overviewValue ?? ''}>{totalResponses}</div>
        </div>
        <div className={styles.overviewItem ?? ''}>
          <div className={styles.overviewLabel ?? ''}>访客回复</div>
          <div className={styles.overviewValue ?? ''}>{stats.visitor_count}</div>
        </div>
        <div className={styles.overviewItem ?? ''}>
          <div className={styles.overviewLabel ?? ''}>首次提交</div>
          <div className={styles.overviewValue ?? ''}>
            {formatDateTime(stats.first_response_at)}
          </div>
        </div>
        <div className={styles.overviewItem ?? ''}>
          <div className={styles.overviewLabel ?? ''}>末次提交</div>
          <div className={styles.overviewValue ?? ''}>
            {formatDateTime(stats.last_response_at)}
          </div>
        </div>
      </div>

      {totalResponses === 0 ? (
        <Alert type="info" showIcon message="暂无回复" />
      ) : null}

      <div className={styles.statsSection ?? ''}>
        {stats.field_stats.map((field) => (
          <div key={field.key} className={styles.fieldCard ?? ''}>
            <div className={styles.fieldCardHeader ?? ''}>
              <span className={styles.fieldCardTitle ?? ''}>{field.label}</span>
              {field.required ? <Tag color="orange">必填</Tag> : <Tag>选填</Tag>}
              <span className={styles.fieldCardMeta ?? ''}>
                已填写 {field.answered_count} / {totalResponses}（{formatRate(field.answer_rate)}）
              </span>
            </div>
            {field.option_counts && field.option_counts.length > 0 ? (
              <OptionChart field={field} />
            ) : field.number_stats ? (
              <NumberStats field={field} />
            ) : (
              <Text type="secondary">文本类字段仅统计填写率</Text>
            )}
          </div>
        ))}
      </div>

      <Table<ResponseRow>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={responses}
        rowKey="id"
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => '共 ' + t + ' 条',
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </div>
  );
}
