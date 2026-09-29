import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Collapse, Empty, Select, Spin, Switch, Tag, Typography, message } from 'antd';
import { SaveOutlined, UserOutlined } from '@ant-design/icons';
import { getBacklinks, listFolders, listNoteTags, setNoteFolders, updateNote } from '@/api/notes';
import type { Note, NoteBody, NoteFolder, NoteUpdate, TagCount } from '@/types/note';
import { getUserId } from '@/utils/auth';
import { getVisibilityConfig } from '@/utils/visibility';
import styles from './NoteMetaPanel.module.css';

const { Text } = Typography;

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 统计正文中的 wikilink 节点数，即出链数。 */
function countOutgoingLinks(body: NoteBody | null | undefined): number {
  if (!body) return 0;
  let count = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const record = node as Record<string, unknown>;
    if (record.type === 'wikilink') count += 1;
    const content = record.content;
    if (Array.isArray(content)) for (const child of content) walk(child);
  };
  walk(body);
  return count;
}

interface InfoRowProps {
  label: string;
  children: ReactNode;
}

function InfoRow({ label, children }: InfoRowProps) {
  return (
    <div className={styles.infoRow ?? ''}>
      <span className={styles.infoKey ?? ''}>{label}</span>
      <span className={styles.infoValue ?? ''}>{children}</span>
    </div>
  );
}

/**
 * 笔记元信息面板：上半部分只读信息，下半部分可编辑配置。
 *
 * 可见性以只读呈现——后端 NoteUpdate 不含 visibility / restricted_users，
 * 写在这里的可见性 UI 会被静默丢弃，属于伪功能，故不开放编辑。
 *
 * 层级关系不再由父笔记表达：笔记归属由「所属文件夹」多选决定，
 * 笔记之间的关联改由正文 wikilink 表达（见出链数 / 入链数）。
 */
export default function NoteMetaPanel({ note, onSaved }: NoteMetaPanelProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [restrictedTags, setRestrictedTags] = useState<string[]>([]);
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [backlinkCount, setBacklinkCount] = useState(0);

  useEffect(() => {
    if (!note) return;
    setTags(note.tags ?? []);
    setRestrictedTags(note.restricted_tags ?? []);
    setFolderIds(note.folders.map((folder) => folder.id));
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
    listFolders()
      .then((res) => {
        if (!cancelled && res.code === 0) setFolders(res.data.items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // 入链数：只依赖 note.id，避免每次保存都重拉
  useEffect(() => {
    if (!note) {
      setBacklinkCount(0);
      return;
    }
    let cancelled = false;
    getBacklinks(note.id)
      .then((res) => {
        if (!cancelled && res.code === 0) setBacklinkCount(res.data?.length ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [note?.id]);

  const tagOptions = useMemo(() => {
    const current = new Set([...tags, ...restrictedTags]);
    const fromTags = tagCounts.map((item) => ({ value: item.tag, label: `${item.tag} (${item.count})` }));
    const extra = Array.from(current)
      .filter((tag) => !tagCounts.some((item) => item.tag === tag))
      .map((tag) => ({ value: tag, label: tag }));
    return [...fromTags, ...extra];
  }, [tagCounts, tags, restrictedTags]);

  const folderOptions = useMemo(
    () => folders.map((folder) => ({ value: folder.id, label: folder.name })),
    [folders],
  );

  const save = async (patch: NoteUpdate) => {
    if (!note) return;
    setSaving(true);
    try {
      const res = await updateNote(note.id, patch);
      if (res.code === 0) onSaved(res.data);
      else message.error('保存失败');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleFoldersChange = async (value: string[]) => {
    if (!note) return;
    setFolderIds(value);
    setSaving(true);
    try {
      const res = await setNoteFolders(note.id, value);
      if (res.code === 0) onSaved(res.data);
      else message.error('保存失败');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!note) {
    return (
      <div className={styles.emptyBox ?? ''}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择一篇笔记" />
      </div>
    );
  }

  const ownVisibility = getVisibilityConfig(note.visibility);
  const isOwner = note.owner_id === getUserId();
  const wordCount = (note.plain_text ?? note.content ?? '').length;
  const outgoingCount = countOutgoingLinks(note.body ?? undefined);

  return (
    <div className={styles.panel ?? ''}>
      {saving && <Spin size="small" className={styles.saving ?? ''} />}

      <div className={styles.panelHead ?? ''}>
        <Text className={styles.panelHeadTitle ?? ''}>笔记属性</Text>
        <Tag color={ownVisibility.color}>{ownVisibility.text}</Tag>
      </div>

      <Collapse
        ghost
        size="small"
        className={styles.detailCollapse ?? ''}
        defaultActiveKey={['info', 'config']}
        items={[
          {
            key: 'info',
            label: '信息',
            children: (
              <div className={styles.infoGrid ?? ''}>
                <InfoRow label="所有者">
                  <span className={styles.infoInline}>
                    <UserOutlined />
                    {isOwner ? '本人' : <Text type="secondary">他人</Text>}
                  </span>
                </InfoRow>
                <InfoRow label="可见性">{ownVisibility.text}</InfoRow>
                <InfoRow label="所属文件夹">
                  {note.folders.length > 0 ? (
                    <span className={styles.chips}>
                      {note.folders.map((folder) => (
                        <span key={folder.id} className={styles.chip}>
                          {folder.name}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <Text type="secondary">无</Text>
                  )}
                </InfoRow>
                <InfoRow label="字数">{wordCount}</InfoRow>
                <InfoRow label="标签数">{(note.tags ?? []).length}</InfoRow>
                <InfoRow label="出链数">{outgoingCount}</InfoRow>
                <InfoRow label="入链数">{backlinkCount}</InfoRow>
                <InfoRow label="创建时间">{formatDateTime(note.created_at)}</InfoRow>
                <InfoRow label="更新时间">{formatDateTime(note.updated_at)}</InfoRow>
              </div>
            ),
          },
          {
            key: 'config',
            label: '配置',
            children: (
              <div className={styles.fields ?? ''}>
                <div className={styles.field ?? ''}>
                  <label className={styles.label ?? ''} htmlFor="note-meta-folders">
                    所属文件夹
                  </label>
                  <Select
                    id="note-meta-folders"
                    mode="multiple"
                    value={folderIds}
                    onChange={(value: string[]) => void handleFoldersChange(value)}
                    options={folderOptions}
                    placeholder={folders.length > 0 ? '选择文件夹' : '还没有文件夹，请先在左侧新建'}
                    allowClear
                    style={{ width: '100%' }}
                  />
                </div>

                <div className={styles.field ?? ''}>
                  <label className={styles.label ?? ''} htmlFor="note-meta-tags">
                    标签
                  </label>
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
                  <label className={styles.label ?? ''} htmlFor="note-meta-restricted-tags">
                    受限标签
                  </label>
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

                <div className={styles.switchRow ?? ''}>
                  <span className={styles.label ?? ''}>置顶</span>
                  <Switch
                    checked={isPinned}
                    onChange={(checked) => {
                      setIsPinned(checked);
                      void save({ is_pinned: checked });
                    }}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />

      <div className={styles.footer ?? ''}>
        <SaveOutlined />
        <Text type="secondary">改动即时保存到服务器</Text>
      </div>
    </div>
  );
}

interface NoteMetaPanelProps {
  note: Note | null;
  onSaved: (note: Note) => void;
}
