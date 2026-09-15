import { useEffect, useState } from 'react';
import {
  DownOutlined,
  FileTextOutlined,
  LockOutlined,
  RightOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ReactNodeViewProps } from '@tiptap/react';
import { getNote } from '@/api/notes';
import { HttpError } from '@/utils/request';
import ContentEditor from '../ContentEditor';
import type { NoteEmbedAttrs } from './NoteEmbed';
import styles from './NoteEmbedView.module.css';

interface EmbedData {
  title: string;
  excerpt: string;
  body: Record<string, unknown> | null;
}

/**
 * 同一目标笔记只取一次，避免一张笔记里多处内嵌重复请求。
 * 缓存挂在模块作用域，进程内有效；不做失效处理，因为标题与正文变更
 * 频率低，折叠后重开仍读缓存。
 */
const embedCache = new Map<string, EmbedData>();

const EXCERPT_LENGTH = 90;

function toExcerpt(plainText: string | null | undefined): string {
  const text = (plainText ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '（无正文）';
  if (text.length > EXCERPT_LENGTH) return text.slice(0, EXCERPT_LENGTH) + '…';
  return text;
}

/**
 * note-embed 卡片视图：折叠态显示标题与摘要，展开态只读渲染目标笔记正文。
 *
 * 嵌套上限 1 层由装配方保证——展开时传入的 extensions 不含 NoteEmbed，
 * 而是注册 NoteEmbedStub，因此更深层的内嵌只呈现为静态标题行。
 * 目标不可见（403）时渲染占位卡片，不显示任何目标内容。
 */
export default function NoteEmbedView(props: ReactNodeViewProps<HTMLDivElement>) {
  const { node, editor, ref } = props;
  const attrs = node.attrs as NoteEmbedAttrs;
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const targetId = attrs.target_id;
  const title = data?.title || attrs.title || '（未命名笔记）';

  useEffect(() => {
    if (!targetId) return;

    const cached = embedCache.get(targetId);
    if (cached) {
      setData(cached);
      setForbidden(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setForbidden(false);

    getNote(targetId)
      .then((resp) => {
        if (cancelled) return;
        const note = resp.data;
        if (!note) return;
        const next: EmbedData = {
          title: note.title,
          excerpt: toExcerpt(note.plain_text),
          body: note.body ?? null,
        };
        embedCache.set(targetId, next);
        setData(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof HttpError && error.status === 403) {
          setForbidden(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [targetId]);

  const handleToggle = () => {
    editor.chain().focus().run();
    setExpanded((prev) => !prev);
  };

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={styles.embed}
      data-state={forbidden ? 'forbidden' : expanded ? 'expanded' : 'collapsed'}
    >
      <button
        type="button"
        className={styles.header}
        onClick={handleToggle}
        disabled={forbidden}
      >
        {forbidden ? (
          <LockOutlined className={styles.icon} />
        ) : (
          <FileTextOutlined className={styles.icon} />
        )}
        <span className={styles.title}>{title}</span>
        {!forbidden && (
          <span className={styles.toggle}>
            {expanded ? <DownOutlined /> : <RightOutlined />}
          </span>
        )}
      </button>

      {forbidden ? (
        <div className={styles.forbidden}>
          无权限查看该笔记，请联系笔记所有者调整可见性。
        </div>
      ) : (
        <>
          {!expanded && (
            <p className={styles.excerpt}>{data?.excerpt ?? toExcerpt(undefined)}</p>
          )}
          {expanded && loading && (
            <p className={styles.hint}>
              <SyncOutlined spin />
              正在载入目标笔记…
            </p>
          )}
          {expanded && !loading && data?.body && (
            <div className={styles.body}>
              <ContentEditor
                value={data.body}
                editable={false}
                minHeight={40}
                extensions={[]}
              />
            </div>
          )}
          {expanded && !loading && !data?.body && (
            <p className={styles.hint}>该笔记暂无正文内容。</p>
          )}
        </>
      )}
    </div>
  );
}
