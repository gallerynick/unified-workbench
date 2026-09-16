import { useCallback, useEffect, useState } from 'react';
import { Empty, Spin, Tooltip, Typography } from 'antd';
import { ClockCircleOutlined, FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import { getBacklinks } from '@/api/notes';
import type { BacklinkItem } from '@/types/note';
import styles from './BacklinksPanel.module.css';

const { Text } = Typography;

interface BacklinksPanelProps {
  noteId: string | null;
  onOpenNote: (noteId: string) => void;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '时间未知';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 反向链接面板：列出正文 wikilink 指向当前笔记的其他笔记。
 * 数据源为后端 note_link 索引查询，当前笔记变化时自动刷新。
 */
export default function BacklinksPanel({ noteId, onOpenNote }: BacklinksPanelProps) {
  const [items, setItems] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!noteId) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const res = await getBacklinks(noteId);
      if (res.code === 0) setItems(res.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!noteId) {
    return <div className={styles.emptyBox ?? ''}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择一篇笔记" /></div>;
  }

  if (loading) {
    return <div className={styles.emptyBox ?? ''}><Spin /></div>;
  }

  if (error) {
    return <div className={styles.emptyBox ?? ''}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="反向链接加载失败" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className={styles.emptyBox ?? ''}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有笔记引用这篇" />
        <div className={styles.emptyHint ?? ''}>
          <Text type="secondary">在别的笔记正文里输入 [[ 选中这篇笔记，这里就会出现反向链接。</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.list ?? ''}>
      {items.map((item) => (
        <div
          key={item.note_id}
          role="button"
          tabIndex={0}
          className={styles.item ?? ''}
          onClick={() => onOpenNote(item.note_id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenNote(item.note_id);
            }
          }}
        >
          <div className={styles.itemTitle ?? ''}>
            <FileTextOutlined className={styles.itemIcon ?? ''} />
            <Tooltip title={item.title}>
              <span className={styles.itemTitleText ?? ''}>{item.title}</span>
            </Tooltip>
          </div>
          {item.excerpt ? <div className={styles.itemExcerpt ?? ''}>{item.excerpt}</div> : null}
          <div className={styles.itemMeta ?? ''}>
            <LinkOutlined />
            <ClockCircleOutlined />
            <span>{formatDateTime(item.updated_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}