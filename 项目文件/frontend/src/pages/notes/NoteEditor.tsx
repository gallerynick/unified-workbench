import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Empty, Input, Space, Tooltip, Typography, message } from 'antd';
import {
  CheckCircleOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  PushpinOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import ContentEditor from '@/components/ContentEditor/ContentEditor';
import { noteExtensions } from '@/components/ContentEditor/extensions/noteExtensions';
import { updateNote } from '@/api/notes';
import type { Note, NoteBody, NoteDraft } from '@/types/note';
import { useNoteDraft, type DraftSaveState } from './useNoteDraft';
import styles from './NoteEditor.module.css';

const { Text } = Typography;

interface NoteEditorProps {
  note: Note | null;
  /** 新建落库的空笔记：显示「取消」按钮，取消即删除该笔记 */
  isNew: boolean;
  onNavigate: (noteId: string) => void;
  onSaved: (note: Note) => void;
  onCancelNew: () => void;
}

/** 旧版纯文本正文迁成最小 Tiptap 文档，避免老笔记打开后内容丢失 */
function textToBody(text: string): NoteBody {
  const trimmed = text.trim();
  if (!trimmed) return {};
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: trimmed }] }],
  };
}

/** 遍历 Tiptap JSON 累加 text 节点长度，用于字数统计 */
function countWords(body: NoteBody): number {
  let total = 0;
  const walk = (node: unknown): void => {
    if (node == null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.text === 'string') total += record.text.length;
    if (Array.isArray(record.content)) {
      for (const child of record.content) walk(child);
    }
  };
  walk(body);
  return total;
}

/**
 * 稳定序列化：递归排序对象键后 stringify。
 * Tiptap JSON 的键序在不同写入路径下可能不一致，直接 JSON.stringify
 * 比较会把内容相同的草稿误判为「已改动」。
 */
function stableStringify(value: unknown): string {
  const normalize = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(normalize);
    if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(record).sort()) sorted[key] = normalize(record[key]);
      return sorted;
    }
    return node;
  };
  return JSON.stringify(normalize(value));
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '未知时间';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function saveStateView(state: DraftSaveState): { icon: ReactNode; text: string } {
  switch (state) {
    case 'saving':
      return { icon: <LoadingOutlined />, text: '草稿保存中' };
    case 'saved':
      return { icon: <CheckCircleOutlined />, text: '草稿已保存' };
    case 'error':
      return { icon: <ExclamationCircleOutlined />, text: '草稿保存失败' };
    default:
      return { icon: <MinusCircleOutlined />, text: '无未保存改动' };
  }
}

/**
 * 笔记编辑器主体：标题 + 富文本正文 + 草稿提示 + 字数与保存状态。
 *
 * 草稿与服务端发布是两条独立路径：草稿随编辑自动落盘，
 * 「保存」才写 note 表并删除草稿。
 */
export default function NoteEditor({ note, isNew, onNavigate, onSaved, onCancelNew }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState<NoteBody>({});
  const [isPinned, setIsPinned] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /**
   * 载入笔记时判定出的「待恢复草稿」。
   * 只在载入那一刻判定一次，之后不随编辑内容变化重新判定。
   */
  const [pendingDraft, setPendingDraft] = useState<NoteDraft | null>(null);

  const { saveState, loadExisting, clear, reset } = useNoteDraft(note?.id ?? null, title, body);

  const extensions = useMemo(() => noteExtensions({ onNavigateNote: onNavigate }), [onNavigate]);

  useEffect(() => {
    if (!note) {
      setTitle('');
      setBody({});
      setIsPinned(false);
      setPendingDraft(null);
      return;
    }
    const nextTitle = note.title;
    const nextBody: NoteBody = note.body ?? (note.content ? textToBody(note.content) : {});
    setTitle(nextTitle);
    setBody(nextBody);
    setIsPinned(note.is_pinned);
    reset(note.id, nextTitle, nextBody);
    // 「是否有待恢复的草稿」只在载入这一刻判定一次，比较对象是刚载入的
    // 已发布内容，而不是实时编辑器内容。若与实时内容比较，用户一敲键盘
    // 就会判成「有差异」；自动保存又把草稿更新为当前内容，提示随之消失，
    // 于是一路打字一路闪现。此刻的草稿就是本人正在写的内容，无需提示。
    void loadExisting().then((draft) => {
      const differs =
        draft !== null &&
        (draft.title !== nextTitle ||
          stableStringify(draft.body ?? {}) !== stableStringify(nextBody));
      setPendingDraft(differs ? draft : null);
    });
  // 依赖 note.id 而非 note 对象：父组件重渲染产生的新对象不应触发重新载入
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, reset, loadExisting]);

  const wordCount = useMemo(() => countWords(body), [body]);

  const restoreDraft = useCallback(() => {
    if (!pendingDraft) return;
    const nextTitle = pendingDraft.title ?? title;
    const nextBody = pendingDraft.body ?? body;
    setTitle(nextTitle);
    setBody(nextBody);
    // 恢复后草稿内容就是当前编辑内容，基线随之对齐，提示清除
    reset(note?.id ?? null, nextTitle, nextBody);
    setPendingDraft(null);
  }, [pendingDraft, title, body, note?.id, reset]);

  const discardDraft = useCallback(async () => {
    await clear();
    setPendingDraft(null);
    message.info('已丢弃草稿');
  }, [clear]);

  const handlePublish = useCallback(async () => {
    if (!note || publishing) return;
    const finalTitle = title.trim() || '未命名笔记';
    if (finalTitle === title) setTitle(finalTitle);
    setPublishing(true);
    try {
      const res = await updateNote(note.id, { title: finalTitle, body });
      if (res.code === 0) {
        await clear();
        reset(note.id, finalTitle, body);
        setPendingDraft(null);
        onSaved(res.data);
        message.success('已保存');
      } else {
        message.error('保存失败');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setPublishing(false);
    }
  }, [note, publishing, title, body, clear, reset, onSaved]);

  const handleTogglePin = useCallback(async (checked: boolean) => {
    if (!note) return;
    try {
      const res = await updateNote(note.id, { is_pinned: checked });
      if (res.code === 0) onSaved(res.data);
    } catch {
      message.error('置顶状态更新失败');
    }
  }, [note, onSaved]);

  if (!note) {
    return (
      <div className={styles.emptyBox ?? ''}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="从左侧选择一篇笔记，或新建一篇" />
      </div>
    );
  }

  const stateView = saveStateView(saveState);

  return (
    <div className={styles.editor ?? ''}>
      <div className={styles.header ?? ''}>
        <Input
          className={styles.titleInput ?? ''}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="未命名笔记"
          variant="borderless"
          aria-label="笔记标题"
        />
        <Space size={8} className={styles.actions ?? ''}>
          {/* 用状态明确的图标按钮替代「两种状态都显示图钉」的 Switch */}
          <Tooltip title={isPinned ? '取消置顶' : '置顶'}>
            <Button
              type={isPinned ? 'primary' : 'text'}
              icon={<PushpinOutlined />}
              aria-label={isPinned ? '取消置顶' : '置顶'}
              aria-pressed={isPinned}
              onClick={() => void handleTogglePin(!isPinned)}
            />
          </Tooltip>
          {isNew ? (
            <Button icon={<CloseOutlined />} onClick={onCancelNew}>取消</Button>
          ) : null}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={publishing}
            onClick={() => void handlePublish()}
          >
            保存
          </Button>
        </Space>
      </div>

      {pendingDraft ? (
        <Alert
          type="warning"
          showIcon
          className={styles.draftAlert ?? ''}
          message="检测到未保存的草稿"
          description={`服务端草稿保存于 ${formatTime(pendingDraft.saved_at)}，与已发布的内容不同。`}
          action={
            <Space size={8}>
              <Button size="small" type="primary" onClick={restoreDraft}>恢复草稿</Button>
              <Button size="small" onClick={() => void discardDraft()}>丢弃</Button>
            </Space>
          }
        />
      ) : null}

      <div className={styles.bodyWrap ?? ''}>
        <ContentEditor
          value={body}
          onChange={(value) => setBody(value)}
          placeholder="开始撰写笔记…  输入 / 呼出命令菜单"
          minHeight={480}
          extensions={extensions}
          slashMenu
        />
      </div>

      <div className={styles.statusBar ?? ''}>
        <Text type="secondary" className={styles.statusText ?? ''}>
          {wordCount} 字
        </Text>
        <Text type="secondary" className={styles.statusText ?? ''}>
          {stateView.icon}
          {stateView.text}
        </Text>
      </div>
    </div>
  );
}