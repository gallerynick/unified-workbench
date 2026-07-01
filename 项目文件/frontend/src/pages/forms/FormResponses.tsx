import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Typography, Spin, Empty, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getForm, getFormResponses } from '../../api/forms';
import type { FormField } from '../../types/form';
import styles from './FormResponses.module.css';

const { Title } = Typography;

interface ResponseRow extends Record<string, unknown> {
  id: string;
  respondent_id: string | null;
  created_at: string;
}

export default function FormResponses() {
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState<FormField[] | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadForm = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getForm(id);
      if (res.code !== 0 || !res.data) throw new Error('表单不存在');
      setForm(res.data.fields);
      setTitle(res.data.title);
    } catch {
      setForm(null);
    }
  }, [id]);

  const loadResponses = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getFormResponses(id, page, 20);
      if (res.code === 0 && res.data) {
        setResponses(res.data.items.map(r => ({ ...r.data, id: r.id, respondent_id: r.respondent_id, created_at: r.created_at })));
        setTotal(res.data.total);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id, page]);

  useEffect(() => { loadForm(); }, [loadForm]);
  useEffect(() => { loadResponses(); }, [loadResponses]);

  const columns: ColumnsType<ResponseRow> = form ? [
    { title: '提交时间', dataIndex: 'created_at', key: 'created_at', width: 180, render: (d: string) => new Date(d).toLocaleString('zh-CN') },
    ...form.map(f => ({ title: f.label || f.key, dataIndex: f.key, key: f.key, render: (v: unknown) => { if (Array.isArray(v)) return v.join(', '); if (typeof v === 'boolean') return v ? '是' : '否'; return String(v ?? '-'); } })),
    { title: '提交者', dataIndex: 'respondent_id', key: 'respondent_id', width: 120, render: (v: string | null) => v ? <Tag>{v.slice(0,8)}</Tag> : <Tag color="orange">匿名</Tag> },
  ] : [];

  if (loading) return <div className={styles.container}><Spin size="large" /></div>;
  if (!form) return <div className={styles.container}><Empty description="表单不存在或无权访问" /></div>;
  if (responses.length === 0) return <div className={styles.container}><div className={styles.header}><Title level={4}>{title} - 回复</Title><Tag>{total} 条</Tag></div><Empty description="暂无提交" /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4}>{title} - 回复</Title>
        <Tag>{total} 条</Tag>
      </div>
      <Table columns={columns} dataSource={responses} rowKey="id" pagination={{ current: page, total, pageSize: 20, onChange: (p) => setPage(p) }} scroll={{ x: 'max-content' }} />
    </div>
  );
}
