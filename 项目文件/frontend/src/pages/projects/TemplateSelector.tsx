import { useEffect, useState } from 'react';
import { Card, Empty, Spin, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { listTemplates } from '../../api/templates';
import type { Template } from '../../types/template';

const { Text, Paragraph } = Typography;

interface TemplateSelectorProps {
  onSelect: (template: Template) => void;
  location?: string;
}

export default function TemplateSelector({ onSelect, location }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await listTemplates({ page_size: 100 });
        if (!cancelled && res.code === 0 && res.data) {
          const items = res.data.items.filter(
            (t) => location === 'project' ? t.location === 'project' || t.location === 'global' : true
          );
          setTemplates(items);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [location]);

  if (loading) return <Spin style={{ display: 'block', textAlign: 'center', padding: 'var(--spacing-xxl)' }} />;
  if (templates.length === 0) return <Empty description="暂无可用模板" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: "var(--spacing-xs)", maxHeight: 400, overflowY: 'auto' }}>
      {templates.map((tpl) => (
        <Card
          key={tpl.id}
          size="small"
          hoverable
          onClick={() => onSelect(tpl)}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: "var(--spacing-xs)" }}>
            <FileTextOutlined style={{ color: 'var(--color-info)', fontSize: 'var(--text-heading-4-size)' }} />
            <Text strong>{tpl.name}</Text>
          </div>
          <Paragraph
            type="secondary"
            style={{ margin: 'var(--spacing-xxs) 0 0', fontSize: 'var(--text-body-xs-size)' }}
            ellipsis={{ rows: 1 }}
          >
            {tpl.schema?.length ?? 0} 个字段
            {tpl.category ? ` · ${tpl.category}` : ''}
          </Paragraph>
        </Card>
      ))}
    </div>
  );
}
