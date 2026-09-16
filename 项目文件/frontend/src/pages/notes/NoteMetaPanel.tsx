import { useEffect, useMemo, useState } from 'react';
import { Divider, Empty, Input, Select, Space, Spin, Switch, Tag, TreeSelect, Typography, message } from 'antd';
import { PushpinOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import { listNoteTags, updateNote } from '@/api/notes';
import type { Note, NoteUpdate, TagCount } from '@/types/note';
import { getUserId } from '@/utils/auth';
import { getVisibilityConfig } from '@/utils/visibility';
import styles from './NoteMetaPanel.module.css';

const { Text } = Typography;

interface ParentTreeNode {
  value: string;
  title: string;
  /** 恒为数组：空数组即叶子节点，避免 exactOptionalPropertyTypes 下的 undefined 问题 */
  children: ParentTreeNode[];
}

/** 从扁平笔记列表构建父笔记下拉树；编辑中的笔记自身被排除，避免自引用 */
function buildParentTree(notes: Note[], excludeId: string | null): ParentTreeNode[] {
  const candidates = excludeId ? notes.filter((n) => n.id !== excludeId) : notes;
  const childrenOf = new Map<string | null, ParentTreeNode[]>();
  for (const note of candidates) {
    const parentKey = note.parent_id;
    const bucket = childrenOf.get(parentKey) ?? [];
    bucket.push({ value: note.id, title: note.title, children: [] });
    childrenOf.set(parentKey, bucket);
  }

  const resolve = (parentKey: string | null): ParentTreeNode[] => {
    const list = childrenOf.get(parentKey) ?? [];
    for (const node of list) {
      node.children = resolve(node.value);
    }
    return list;
  };

  return resolve(null);
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * 笔记元信息面板：维护分类 / 标签 / 受限标签 / 父笔记 / 置顶，并展示只读元信息。
 *
 * 可见性以只读标签呈现——后端 NoteUpdate 不含 visibility / restricted_users，
 * 写在这里的可见性 UI 会被静默丢弃，属于伪功能，故不开放编辑。
 */
export default function NoteMetaPanel({
  note,
  allNotes,
  onOpenNote,
  onSaved,
}: NoteMetaPanelProps) {
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);

  useEffect(() => {
    if (!note) return;
    setCategory(note.category ?? '');
    setTags(note.tags ?? []);
    setRestrictedTags(note.restricted_tags ?? []);
    setParentId(note.parent_id);
    setIsPinned(note.is_pinned);
  // 依赖 note.id 而非 note 对象：保存后回传的同一篇笔记不应重置未提交的输入
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id]);

  useEffect(() => {
    let cancelled = false;
    listNoteTags()
      .then((res) => {
        if (!cancelled && res.code === 0) setTagCounts(res.data ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const tagOptions = useMemo(() => {
    const current = new Set([...tags, ...restrictedTags]);
    const fromTags = tagCounts.map((item) => ({ value: item.tag, label: `${item.tag} (${item.count})` }));
    const extra = Array.from(current)
      .filter((tag) => !tagCounts.some((item) => item.tag === tag))
      .map((tag) => ({ value: tag, label: tag }));
    return [...fromTags, ...extra];
  }, [tagCounts, tags, restrictedTags]);

  const parentTree = useMemo(() => buildParentTree(allNotes, note?.id ?? null), [allNotes, note?.id]);

  const save = async (patch: NoteUpdate) => {
    if (!note) return;
    setSaving(true);
    try {
      const res = await updateNote(note.id, patch);
      if (res.code === 0) {
        onSaved(res.data);
      } else {
        message.error('保存失败');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryBlur = async () => {
    if (!note || note.category === category) return;
    // 清空时传空串：后端按「非 None 即写入」处理，空串等价于无分类
    await save({ category: category.trim() });
  };

  if (!note) {
    return <div className={styles.emptyBox ?? ''}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择一篇笔记" /></div>;
  }

  const ownVisibility = getVisibilityConfig(note.visibility);
  const isOwner = note.owner_id === getUserId();
  const wordCount = (note.plain_text ?? note.content ?? '').length;

  return (
    <div className={styles.panel ?? ''}>
      {saving && <Spin size="small" className={styles.saving ?? ''} />}

      <Divider plain className={styles.divider ?? ''}>可编辑</Divider>

      <div className={styles.field ?? ''}>
        <label className={styles.label ?? ''} htmlFor="note-meta-category">分类</label>
        <Input
          id="note-meta-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onBlur={() => void handleCategoryBlur()}
          placeholder="如：项目、决策、笔记"
          variant="filled"
          allowClear
        />
      </div>

      <div className={styles.field ?? ''}>
        <label className={styles.label ?? ''} htmlFor="note-meta-tags">标签</label>
        <Select
          id="note-meta-tags"
          mode="tags"
          value={tags}
          onChange={(value: string[]) => {
            setTags(value);
            void save({ tags: value });
          }}
          options={tagOptions}
          placeholder="输入后回车添加"
          allowClear
          style={{ width: '100%' }}
        />
      </div>

      <div className={styles.field ?? ''}>
        <label className={styles.label ?? ''} htmlFor="note-meta-restricted-tags">受限标签</label>
        <Select
          id="note-meta-restricted-tags"
          mode="tags"
          value={restrictedTags}
          onChange={(value: string[]) => {
            setRestrictedTags(value);
            void save({ restricted_tags: value });
          }}
          options={tagOptions}
          placeholder="持有该标签的成员可见"
          allowClear
          style={{ width: '100%' }}
        />
      </div>

      <div className={styles.field ?? ''}>
        <label className={styles.label ?? ''} htmlFor="note-meta-parent">父笔记</label>
        <TreeSelect
          id="note-meta-parent"
          treeData={parentTree}
          value={parentId ?? undefined}
          onChange={(value) => {
            const next = value ?? null;
            setParentId(next);
            void save({ parent_id: next });
          }}
          placeholder="根笔记"
          allowClear
          treeDefaultExpandAll
          style={{ width: '100%' }}
        />
      </div>

      <div className={styles.switchRow ?? ''}>
        <span className={styles.label ?? ''}>置顶</span>
        <Switch
          checked={isPinned}
          checkedChildren={<PushpinOutlined />}
          unCheckedChildren={<PushpinOutlined />}
          onChange={(checked) => {
            setIsPinned(checked);
            void save({ is_pinned: checked });
          }}
        />
      </div>

      <Divider plain className={styles.divider ?? ''}>只读信息</Divider>

      <div className={styles.infoGrid ?? ''}>
        <div className={styles.infoRow ?? ''}>
          <span className={styles.infoKey ?? ''}>可见性</span>
          <Tag color={ownVisibility.color}>{ownVisibility.text}</Tag>
        </div>
        <div className={styles.infoRow ?? ''}>
          <span className={styles.infoKey ?? ''}>所有者</span>
          <Space size={4}>
            <UserOutlined />
            {isOwner ? <Text>本人</Text> : <Text type="secondary">他人</Text>}
          </Space>
        </div>
        <div className={styles.infoRow ?? ''}>
          <span className={styles.infoKey ?? ''}>字数</span>
          <span>{wordCount}</span>
        </div>
        <div className={styles.infoRow ?? ''}>
          <span className={styles.infoKey ?? ''}>创建时间</span>
          <span>{formatDateTime(note.created_at)}</span>
        </div>
        <div className={styles.infoRow ?? ''}>
          <span className={styles.infoKey ?? ''}>更新时间</span>
          <span>{formatDateTime(note.updated_at)}</span>
        </div>
        {note.parent_id ? (
          <div className={styles.infoRow ?? ''}>
            <span className={styles.infoKey ?? ''}>父笔记</span>
            <button type="button" className={styles.jumpLink ?? ''} onClick={() => onOpenNote(note.parent_id as string)}>
              {(allNotes.find((n) => n.id === note.parent_id)?.title) ?? '已删除的父笔记'}
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.footer ?? ''}>
        <SaveOutlined />
        <Text type="secondary">改动即时保存到服务器</Text>
      </div>
    </div>
  );
}

interface NoteMetaPanelProps {
  note: Note | null;
  allNotes: Note[];
  onOpenNote: (noteId: string) => void;
  onSaved: (note: Note) => void;
}