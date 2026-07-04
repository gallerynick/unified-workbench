import { useEffect, useState } from 'react';
import { Card, Empty, Spin, Typography, Tag } from 'antd';
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

  if (loading) return <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} />;
  if (templates.length === 0) return <Empty description="暂无可用模板" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
      {templates.map((tpl) => (
        <Card
          key={tpl.id}
          size="small"
          hoverable
          onClick={() => onSelect(tpl)}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: '#1677ff', fontSize: 16 }} />
            <Text strong>{tpl.name}</Text>
            <Tag color="blue" style={{ marginLeft: 'auto', fontSize: 11 }}>
              {tpl.location === 'global' ? '全局' : tpl.location === 'project' ? '项目' : '记录'}
            </Tag>
          </div>
          <Paragraph
            type="secondary"
            style={{ margin: '4px 0 0', fontSize: 12 }}
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
