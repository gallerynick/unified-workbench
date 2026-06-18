import { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Select,
  DatePicker,
  Typography,
  Tag,
  Space,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { listAuditLogs } from '../../api/audit';
import type { AuditLog } from '../../types/audit';
import styles from './AuditLog.module.css';

const { Title } = Typography;
const { RangePicker } = DatePicker;

// 操作类型映射
const ACTION_MAP: Record<string, { color: string; text: string }> = {
  create: { color: 'green', text: '创建' },
  update: { color: 'blue', text: '更新' },
  delete: { color: 'red', text: '删除' },
  login: { color: 'cyan', text: '登录' },
  logout: { color: 'default', text: '登出' },
  disable: { color: 'orange', text: '禁用' },
  enable: { color: 'green', text: '启用' },
  export: { color: 'purple', text: '导出' },
  import: { color: 'geekblue', text: '导入' },
};

// 操作类型选项
const ACTION_OPTIONS = [
  { value: '', label: '全部操作' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'login', label: '登录' },
  { value: 'logout', label: '登出' },
  { value: 'disable', label: '禁用' },
  { value: 'enable', label: '启用' },
  { value: 'export', label: '导出' },
  { value: 'import', label: '导入' },
];

// 格式化 JSON 为可读字符串
function formatJson(obj: Record<string, unknown> | null): string {
  if (!obj) return '无详情';
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

// 渲染 diff 详情
function renderDiffDetail(detail: Record<string, unknown> | null): React.ReactNode {
  if (!detail) return <span className={styles.detailValue ?? ''}>无详情</span>;

  const keys = Object.keys(detail);
  if (keys.length === 0) return <span className={styles.detailValue ?? ''}>无变更</span>;

  return (
    <div className={styles.detailContainer ?? ''}>
      <div className={styles.detailTitle ?? ''}>变更详情</div>
      <pre className={styles.detailJson ?? ''}>{formatJson(detail)}</pre>
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        page_size: number;
        action?: string;
        start_date?: string;
        end_date?: string;
      } = {
        page,
        page_size: pageSize,
      };
      if (actionFilter) {
        params.action = actionFilter;
      }
      if (dateRange[0]) {
        params.start_date = dateRange[0].startOf('day').toISOString();
      }
      if (dateRange[1]) {
        params.end_date = dateRange[1].endOf('day').toISOString();
      }
      const res = await listAuditLogs(params);
      if (res.code === 0) {
        setLogs(res.data.items);
        setTotal(res.data.total);
      } else {
        message.error(res.msg || '获取审计日志失败');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取审计日志失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleActionChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  const handleDateChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    setDateRange(dates ?? [null, null]);
    setPage(1);
  };

  const columns: ColumnsType<AuditLog> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => (
        <span>{dayjs(text).format('YYYY-MM-DD HH:mm:ss')}</span>
      ),
    },
    {
      title: '用户',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
      ellipsis: true,
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 100,
      render: (action: string) => {
        const cfg = ACTION_MAP[action] ?? { color: 'default', text: action };
        return (
          <Tag color={cfg.color} className={styles.actionTag ?? ''}>
            {cfg.text}
          </Tag>
        );
      },
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 120,
      ellipsis: true,
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      key: 'target_id',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (ip: string | null) => (
        <span className={styles.ipText ?? ''}>{ip ?? '-'}</span>
      ),
    },
  ];

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} className={styles.title ?? ''}>
          审计日志
        </Title>
        <Space className={styles.filters ?? ''}>
          <Select
            className={styles.filterSelect ?? ''}
            placeholder="选择操作类型"
            options={ACTION_OPTIONS}
            value={actionFilter}
            onChange={handleActionChange}
            allowClear
          />
          <RangePicker
            className={styles.dateRangePicker ?? ''}
            value={dateRange}
            onChange={handleDateChange}
            placeholder={['开始日期', '结束日期']}
            format="YYYY-MM-DD"
          />
        </Space>
      </div>

      <Table<AuditLog>
        className={styles.table ?? ''}
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        expandable={{
          expandedRowRender: (record) => renderDiffDetail(record.detail),
          rowExpandable: (record) => record.detail !== null,
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </div>
  );
}
