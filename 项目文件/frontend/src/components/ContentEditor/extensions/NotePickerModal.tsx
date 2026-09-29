import { useEffect, useMemo, useState } from 'react';
import { Empty, Input, List, Modal, Skeleton, Tag, message } from 'antd';
import { FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { listAllNotes } from '@/api/notes';
import type { Note } from '@/types/note';
import styles from './NotePickerModal.module.css';

export type NotePickerMode = 'wikilink' | 'embed';

interface NotePickerModalProps {
  open: boolean;
  mode: NotePickerMode;
  onClose: () => void;
  onSelect: (note: Note) => void;
}

/**
 * 笔记选择器：内部链接与笔记内嵌共用。
 *
 * 数据源为 listAllNotes（当前用户可见的全部笔记）。
 * 检索为纯前端过滤，在本产品规模（20 人内网）下足够。
 */
export default function NotePickerModal({
  open,
  mode,
  onClose,
  onSelect,
}: NotePickerModalProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (!open) return;
    setKeyword('');
    setLoading(true);

    listAllNotes()
      .then((resp) => setNotes(resp.data?.items ?? []))
      .catch(() => message.error('笔记列表加载失败'))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter((note) => {
      if (note.title.toLowerCase().includes(query)) return true;
      return (note.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
    });
  }, [notes, keyword]);

  const title = mode === 'wikilink' ? '插入内部链接' : '内嵌笔记';
  const hint =
    mode === 'wikilink'
      ? '选中后将插入一条双链，会在知识图谱中连出一条边。'
      : '选中后将以只读卡片形式嵌入该笔记内容。';

  return (
    <Modal title={title} open={open} onCancel={onClose} footer={null} width={520}>
      <div className={styles.hint}>{hint}</div>
      <Input
        allowClear
        className={styles.search}
        prefix={<SearchOutlined />}
        placeholder="按标题或标签搜索"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        autoFocus
      />
      <div className={styles.listWrap}>
        {loading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : filtered.length === 0 ? (
          <Empty description={keyword ? '没有匹配的笔记' : '还没有笔记'} />
        ) : (
          <List
            size="small"
            dataSource={filtered}
            renderItem={(note) => (
              <List.Item
                className={styles.item ?? ''}
                onClick={() => {
                  onSelect(note);
                  onClose();
                }}
              >
                <FileTextOutlined className={styles.itemIcon} />
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>{note.title}</div>
                  <div className={styles.itemMeta}>
                    {(note.tags ?? []).slice(0, 3).map((tag) => (
                      <Tag key={tag} className={styles.tag ?? ''}>
                        {tag}
                      </Tag>
                    ))}
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>
    </Modal>
  );
}
