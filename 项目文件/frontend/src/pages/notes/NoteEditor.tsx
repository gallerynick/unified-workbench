import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Empty, Input, Space, Switch, Tooltip, Typography, message } from 'antd';
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
import type { Note, NoteBody } from '@/types/note';
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

  const { saveState, existingDraft, loadExisting, clear, reset } = useNoteDraft(note?.id ?? null, title, body);

  const extensions = useMemo(() => noteExtensions({ onNavigateNote: onNavigate }), [onNavigate]);

  useEffect(() => {
    if (!note) {
      setTitle('');
      setBody({});
      setIsPinned(false);
      return;
    }
    const nextTitle = note.title;
    const nextBody: NoteBody = note.body ?? (note.content ? textToBody(note.content) : {});
    setTitle(nextTitle);
    setBody(nextBody);
    setIsPinned(note.is_pinned);
    reset(note.id, nextTitle, nextBody);
    void loadExisting();
  // 依赖 note.id 而非 note 对象：父组件重渲染产生的新对象不应触发重新载入
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.id, reset, loadExisting]);

  const wordCount = useMemo(() => countWords(body), [body]);

  const draftDiffers = useMemo(() => {
    if (!existingDraft || !note) return false;
    const draftBody = existingDraft.body ?? {};
    return JSON.stringify(draftBody) !== JSON.stringify(body);
  }, [existingDraft, body, note]);

  const restoreDraft = useCallback(() => {
    if (!existingDraft) return;
    const nextTitle = existingDraft.title ?? title;
    const nextBody = existingDraft.body ?? body;
    setTitle(nextTitle);
    setBody(nextBody);
    reset(note?.id ?? null, nextTitle, nextBody);
  }, [existingDraft, title, body, note?.id, reset]);

  const discardDraft = useCallback(async () => {
    await clear();
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
          <Tooltip title={isPinned ? '取消置顶' : '置顶'}>
            <Switch
              checked={isPinned}
              checkedChildren={<PushpinOutlined />}
              unCheckedChildren={<PushpinOutlined />}
              onChange={(checked) => void handleTogglePin(checked)}
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

      {draftDiffers ? (
        <Alert
          type="warning"
          showIcon
          className={styles.draftAlert ?? ''}
          message="检测到未保存的草稿"
          description={existingDraft ? `服务端草稿保存于 ${formatTime(existingDraft.saved_at)}，与当前内容不同。` : ''}
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