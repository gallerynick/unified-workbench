import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import type { ReactNode } from 'react';
import {
  CheckCircleOutlined,
  CheckSquareOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  CommentOutlined,
  ExclamationCircleOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FontSizeOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  LineOutlined,
  AlignLeftOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import ImageInsertModal from './ImageInsertModal';
import NotePickerModal, { type NotePickerMode } from './NotePickerModal';
import type { Note } from '@/types/note';
import styles from './SlashMenu.module.css';

type TriggerMode = 'slash' | 'wikilink';

interface TriggerState {
  mode: TriggerMode;
  /** 触发字符的起始位置（/ 本身，或第一个 [） */
  triggerStart: number;
  /** 查询文本的起始位置（触发字符之后） */
  queryStart: number;
}

interface SlashCommand {
  key: string;
  label: string;
  icon: ReactNode;
  keywords: string[];
  run: () => void;
}

interface CommandGroup {
  title: string;
  commands: SlashCommand[];
}

interface SlashMenuProps {
  editor: Editor;
}

const QUERY_LIMIT = 40;

/**
 * 斜杠菜单与 [[ 内链补全。
 *
 * 取舍说明：计划原写「antd Popover + List」。Popover 需要一个锚点元素，
 * 而菜单要跟随编辑器内的光标坐标，用 createPortal + 绝对定位更直接可靠，
 * 故改用 portal；命令分组仍照计划的清单。[[ 触发的是笔记选择器 Modal
 * （数据源 listAllNotes）而非定位下拉——笔记列表需异步加载，Modal 承载更简单。
 */
export default function SlashMenu({ editor }: SlashMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pickerMode, setPickerMode] = useState<NotePickerMode | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const triggerRef = useRef<TriggerState | null>(null);
  const openRef = useRef(false);
  openRef.current = open;

  /** 光标前最近的触发字符：/ 或 [[ */
  const findTrigger = useMemo(
    () => (): TriggerState | null => {
      const { from, to } = editor.state.selection;
      if (from !== to) return null;

      const resolved = editor.state.doc.resolve(from);
      const blockStart = resolved.start();
      const text = editor.state.doc.textBetween(blockStart, from);

      if (text.endsWith('[[')) {
        return {
          mode: 'wikilink',
          triggerStart: blockStart + text.length - 2,
          queryStart: blockStart + text.length,
        };
      }

      if (text.endsWith('/')) {
        const before = text.length >= 2 ? text.charAt(text.length - 2) : '';
        if (before === '' || /\s/.test(before)) {
          return {
            mode: 'slash',
            triggerStart: blockStart + text.length - 1,
            queryStart: blockStart + text.length,
          };
        }
      }

      return null;
    },
    [editor],
  );

  const closeMenu = useCallback(() => {
    triggerRef.current = null;
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  /** 先删掉触发文本，再执行命令 */
  const runAndClear = useCallback(
    (action: () => void) => {
      const trigger = triggerRef.current;
      if (trigger) {
        editor
          .chain()
          .focus()
          .deleteRange({
            from: trigger.triggerStart,
            to: editor.state.selection.from,
          })
          .run();
      }
      action();
      closeMenu();
    },
    [editor, closeMenu],
  );

  const buildGroups = useMemo(
    () => (editor: Editor): CommandGroup[] => [
      {
        title: '段落与标题',
        commands: [
          {
            key: 'paragraph',
            label: '正文段落',
            icon: <AlignLeftOutlined />,
            keywords: ['paragraph', 'p', 'body', '段落'],
            run: () => editor.chain().focus().setParagraph().run(),
          },
          {
            key: 'h1',
            label: '标题 1',
            icon: <FontSizeOutlined />,
            keywords: ['heading', 'h1', 'title', '一级'],
            run: () => editor.chain().focus().setHeading({ level: 1 }).run(),
          },
          {
            key: 'h2',
            label: '标题 2',
            icon: <FontSizeOutlined />,
            keywords: ['heading', 'h2', '二级'],
            run: () => editor.chain().focus().setHeading({ level: 2 }).run(),
          },
          {
            key: 'h3',
            label: '标题 3',
            icon: <FontSizeOutlined />,
            keywords: ['heading', 'h3', '三级'],
            run: () => editor.chain().focus().setHeading({ level: 3 }).run(),
          },
        ],
      },
      {
        title: '内容块',
        commands: [
          {
            key: 'blockquote',
            label: '引用',
            icon: <CommentOutlined />,
            keywords: ['quote', 'blockquote', '引用'],
            run: () => editor.chain().focus().toggleBlockquote().run(),
          },
          {
            key: 'codeBlock',
            label: '代码块',
            icon: <CodeOutlined />,
            keywords: ['code', 'pre', '代码'],
            run: () => editor.chain().focus().toggleCodeBlock().run(),
          },
          {
            key: 'horizontalRule',
            label: '分割线',
            icon: <LineOutlined />,
            keywords: ['divider', 'hr', '分割'],
            run: () => editor.chain().focus().setHorizontalRule().run(),
          },
        ],
      },
      {
        title: '列表',
        commands: [
          {
            key: 'bulletList',
            label: '无序列表',
            icon: <UnorderedListOutlined />,
            keywords: ['bullet', 'ul', '无序'],
            run: () => editor.chain().focus().toggleBulletList().run(),
          },
          {
            key: 'taskList',
            label: '待办列表',
            icon: <CheckSquareOutlined />,
            keywords: ['task', 'todo', 'check', '待办'],
            run: () => editor.chain().focus().toggleTaskList().run(),
          },
        ],
      },
      {
        title: '提示块',
        commands: [
          {
            key: 'callout-info',
            label: '提示块 · 信息',
            icon: <InfoCircleOutlined />,
            keywords: ['callout', 'info', '提示'],
            run: () =>
              editor.chain().focus().insertCallout('info').run(),
          },
          {
            key: 'callout-warning',
            label: '提示块 · 警告',
            icon: <ExclamationCircleOutlined />,
            keywords: ['callout', 'warning', '警告'],
            run: () =>
              editor
                .chain()
                .focus()
                .insertCallout('warning')
                .run(),
          },
          {
            key: 'callout-danger',
            label: '提示块 · 危险',
            icon: <CloseCircleOutlined />,
            keywords: ['callout', 'danger', '危险'],
            run: () =>
              editor
                .chain()
                .focus()
                .insertCallout('danger')
                .run(),
          },
          {
            key: 'callout-success',
            label: '提示块 · 成功',
            icon: <CheckCircleOutlined />,
            keywords: ['callout', 'success', '成功'],
            run: () =>
              editor
                .chain()
                .focus()
                .insertCallout('success')
                .run(),
          },
        ],
      },
      {
        title: '插入',
        commands: [
          {
            key: 'image',
            label: '图片（按链接）',
            icon: <FileImageOutlined />,
            keywords: ['image', 'img', 'picture', '图片'],
            run: () => setImageModalOpen(true),
          },
          {
            key: 'wikilink',
            label: '内部链接',
            icon: <LinkOutlined />,
            keywords: ['link', 'wiki', '内部链接'],
            run: () => setPickerMode('wikilink'),
          },
          {
            key: 'noteEmbed',
            label: '笔记内嵌',
            icon: <FileTextOutlined />,
            keywords: ['embed', 'note', '内嵌', '嵌入'],
            run: () => setPickerMode('embed'),
          },
        ],
      },
    ],
    [],
  );

  const groups = useMemo(() => buildGroups(editor), [buildGroups, editor]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        commands: group.commands.filter(
          (command) =>
            command.label.toLowerCase().includes(q) ||
            command.keywords.some((keyword) => keyword.toLowerCase().includes(q)),
        ),
      }))
      .filter((group) => group.commands.length > 0);
  }, [groups, query]);

  const flatCommands = useMemo(
    () => filtered.flatMap((group) => group.commands),
    [filtered],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  /** 每次事务后重新校验触发是否仍成立 */
  useEffect(() => {
    const handleTransaction = () => {
      const fresh = findTrigger();
      if (fresh) {
        triggerRef.current = fresh;
        if (fresh.mode === 'wikilink') {
          setPickerMode('wikilink');
          return;
        }
        setOpen(true);
        setQuery('');
        return;
      }

      const trigger = triggerRef.current;
      if (!trigger || !openRef.current) return;

      const { from, to } = editor.state.selection;
      if (from !== to || from < trigger.queryStart) {
        closeMenu();
        return;
      }

      const resolved = editor.state.doc.resolve(from);
      const blockStart = resolved.start();
      const text = editor.state.doc.textBetween(blockStart, from);
      const localQuery = text.slice(trigger.queryStart - blockStart);

      if (localQuery.length > QUERY_LIMIT || /\s/.test(localQuery)) {
        closeMenu();
        return;
      }

      setQuery(localQuery);
    };

    editor.on('transaction', handleTransaction);
    return () => {
      editor.off('transaction', handleTransaction);
    };
  }, [editor, findTrigger, closeMenu]);

  /**
   * 菜单打开时拦截方向键、回车与 Esc。
   * Tiptap 3 的 EditorEvents 不含 keydown，故直接监听编辑器 DOM。
   */
  useEffect(() => {
    const dom = editor.view.dom;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!openRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) =>
          flatCommands.length > 0 ? (prev + 1) % flatCommands.length : 0,
        );
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) =>
          flatCommands.length > 0
            ? (prev - 1 + flatCommands.length) % flatCommands.length
            : 0,
        );
        return;
      }
      if (event.key === 'Enter' && flatCommands.length > 0) {
        event.preventDefault();
        const command = flatCommands[activeIndex];
        if (command) runAndClear(command.run);
      }
    };

    dom.addEventListener('keydown', handleKeyDown);
    return () => {
      dom.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, flatCommands, activeIndex, closeMenu, runAndClear]);

  /** 点击编辑器外部区域时关闭 */
  useEffect(() => {
    const menuClass = '.' + (styles.menuRoot ?? '');

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(menuClass)) {
        if (openRef.current) closeMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [closeMenu]);

  const handleSelectNote = (note: Note) => {
    const mode = pickerMode;
    setPickerMode(null);
    if (!mode) return;
    runAndClear(() => {
      if (mode === 'wikilink') {
        editor
          .chain()
          .focus()
          .insertWikiLink({ target_id: note.id, target_title: note.title })
          .run();
      } else {
        editor
          .chain()
          .focus()
          .insertNoteEmbed({ target_id: note.id, title: note.title })
          .run();
      }
    });
  };

  const trigger = triggerRef.current;
  let coords: { top: number; left: number } | null = null;
  if (open && trigger) {
    try {
      const rect = editor.view.coordsAtPos(trigger.triggerStart);
      coords = { top: rect.top, left: rect.left };
    } catch {
      coords = null;
    }
  }

  const menu =
    open && coords
      ? createPortal(
          <div
            className={styles.menuRoot}
            style={{ top: coords.top, left: coords.left }}
            role="menu"
          >
            {flatCommands.length === 0 ? (
              <div className={styles.empty}>没有匹配的命令</div>
            ) : (
              filtered.map((group) => (
                <div key={group.title} className={styles.group}>
                  <div className={styles.groupTitle}>{group.title}</div>
                  {group.commands.map((command) => {
                    const flatIndex = flatCommands.indexOf(command);
                    const itemClass =
                      styles.item +
                      (flatIndex === activeIndex ? ' ' + styles.itemActive : '');
                    return (
                      <button
                        type="button"
                        key={command.key}
                        role="menuitem"
                        className={itemClass}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => runAndClear(command.run)}
                      >
                        <span className={styles.icon}>{command.icon}</span>
                        <span className={styles.label}>{command.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
            <div className={styles.footer}>↑↓ 选择 · 回车确认 · Esc 取消</div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {menu}
      <NotePickerModal
        open={pickerMode !== null}
        mode={pickerMode ?? 'wikilink'}
        onClose={() => setPickerMode(null)}
        onSelect={handleSelectNote}
      />
      <ImageInsertModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onConfirm={(src, alt) => {
          editor.chain().focus().setImage({ src, alt }).run();
          editor.commands.focus();
        }}
      />
    </>
  );
}
