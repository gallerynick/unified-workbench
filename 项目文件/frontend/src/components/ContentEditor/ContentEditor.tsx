import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { CSSProperties } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Extension, type Extensions } from '@tiptap/core';
import type { CommandProps } from '@tiptap/core';
import { Dropdown, Popover, type MenuProps } from 'antd';
import {
  AlignLeftOutlined,
  BoldOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  CodeOutlined,
  CommentOutlined,
  EllipsisOutlined,
  ExclamationCircleOutlined,
  FileImageOutlined,
  FileTextOutlined,
  FontColorsOutlined,
  FontSizeOutlined,
  HighlightOutlined,
  InfoCircleOutlined,
  ItalicOutlined,
  LinkOutlined,
  LineOutlined,
  RedoOutlined,
  UndoOutlined,
  UnorderedListOutlined,
  UnderlineOutlined,
} from '@ant-design/icons';
import SlashMenu from './extensions/SlashMenu';
import ImageInsertModal from './extensions/ImageInsertModal';
import NotePickerModal, { type NotePickerMode } from './extensions/NotePickerModal';
import type { Note } from '@/types/note';
import styles from './ContentEditor.module.css';

// 自定义 FontSize 扩展
const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes: Record<string, unknown>) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }: CommandProps) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: CommandProps) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// 文字颜色板：12 色，优先引用 design token；
// 富文本调色板属用户内容而非界面 chrome，token 之外的色值允许硬编码
const COLORS = [
  'var(--ink)',
  'var(--color-red)',
  'var(--color-orange-bright)',
  '#fadb14',
  'var(--color-lime)',
  'var(--color-success)',
  'var(--color-cyan)',
  'var(--color-info)',
  'var(--color-indigo)',
  'var(--color-violet)',
  'var(--color-magenta)',
  'var(--color-rose)',
];

// 字号选项：收纳进「更多」下拉，不再常驻工具条
const FONT_SIZES = [
  { value: '', label: '默认' },
  { value: '12px', label: '12px' },
  { value: '14px', label: '14px' },
  { value: '16px', label: '16px' },
  { value: '18px', label: '18px' },
  { value: '20px', label: '20px' },
  { value: '24px', label: '24px' },
  { value: '28px', label: '28px' },
  { value: '32px', label: '32px' },
];

/**
 * 安全执行编辑器命令。
 *
 * 提示块 / 图片 / 双链 / 内嵌 / 高亮等命令只有注入对应扩展后才注册，
 * content 模块复用本组件时并未注入。先探测再执行，避免非笔记编辑器
 * 抛出 Command not found。
 */
function runCommand(editor: Editor, name: string, ...args: unknown[]): void {
  try {
    const chain = editor.chain().focus() as unknown as Record<string, unknown>;
    const fn = chain[name];
    if (typeof fn !== 'function') return;
    const result = (fn as (...a: unknown[]) => { run?: () => void }).apply(chain, args);
    result?.run?.();
  } catch {
    // 命令不可用时静默
  }
}

interface ContentEditorProps {
  value?: Record<string, unknown> | null;
  onChange?: (value: Record<string, unknown>) => void;
  placeholder?: string;
  minHeight?: number;
  editable?: boolean;
  /** 调用方注入的额外扩展；默认空数组，行为与组件全局化之前完全一致 */
  extensions?: Extensions;
  /**
   * 是否挂载 `/` 与 `[[` 触发的命令菜单。
   * 菜单含内部链接 / 笔记内嵌等笔记专属命令，故不作为默认能力，
   * 由笔记编辑器显式开启，content 模块保持不受影响。
   */
  slashMenu?: boolean;
}

export interface ContentEditorHandle {
  setContent: (content: Record<string, unknown>) => void;
}

/**
 * 通用富文本编辑器。
 *
 * 工具条按 Obsidian 式极简收纳：行内格式外露（粗体 / 斜体 / 下划线 / 高亮），
 * 块级功能全部收进「更多」下拉，主要入口是正文中的 `/` 命令菜单。
 */
const ContentEditor = forwardRef<ContentEditorHandle, ContentEditorProps>(function ContentEditor({
  value,
  onChange,
  placeholder = '请输入内容...',
  minHeight = 200,
  editable = true,
  extensions,
  slashMenu = false,
}, ref) {
  const currentColorRef = useRef('var(--ink)');
  const isExternalUpdate = useRef(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<NotePickerMode | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      ...(extensions ?? []),
    ],
    editable: editable,
    content: value ? JSON.parse(JSON.stringify(value)) : undefined,
    editorProps: {
      attributes: {
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (!isExternalUpdate.current) {
        const json = ed.getJSON();
        onChange?.(json as Record<string, unknown>);
      }
    },
  });

  useEffect(() => {
    if (editor && value) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(value);
      if (currentJson !== newJson) {
        isExternalUpdate.current = true;
        editor.commands.setContent(JSON.parse(newJson));
        isExternalUpdate.current = false;
      }
    }
  }, [value, editor]);

  useImperativeHandle(ref, () => ({
    setContent: (content: Record<string, unknown>) => {
      if (editor) {
        isExternalUpdate.current = true;
        editor.commands.setContent(JSON.parse(JSON.stringify(content)));
        isExternalUpdate.current = false;
      }
    },
  }), [editor]);

  const exec = useCallback(
    (name: string, ...args: unknown[]) => {
      if (editor) runCommand(editor, name, ...args);
    },
    [editor],
  );

  const handleBold = useCallback(() => exec('toggleBold'), [exec]);
  const handleItalic = useCallback(() => exec('toggleItalic'), [exec]);
  const handleUnderline = useCallback(() => exec('toggleUnderline'), [exec]);
  const handleHighlight = useCallback(() => exec('setHighlight'), [exec]);
  const handleUndo = useCallback(() => exec('undo'), [exec]);
  const handleRedo = useCallback(() => exec('redo'), [exec]);

  const handleColor = useCallback(
    (color: string) => {
      if (color) {
        exec('setColor', color);
        currentColorRef.current = color;
      } else {
        exec('unsetColor');
        currentColorRef.current = 'var(--ink)';
      }
    },
    [exec],
  );

  const handleFontSize = useCallback(
    (size: string) => {
      if (size) exec('setFontSize', size);
      else exec('unsetFontSize');
    },
    [exec],
  );

  const handleImageConfirm = useCallback(
    (src: string, alt: string) => {
      exec('setImage', { src, alt: alt || null });
      setImageModalOpen(false);
    },
    [exec],
  );

  const handleNoteSelect = useCallback(
    (note: Note) => {
      if (pickerMode === 'embed') {
        exec('insertNoteEmbed', { target_id: note.id, title: note.title });
      } else {
        exec('insertWikiLink', { target_id: note.id, target_title: note.title });
      }
      setPickerMode(null);
    },
    [pickerMode, exec],
  );

  if (!editor) return null;

  const hasHighlight = typeof (editor.chain() as unknown as Record<string, unknown>)['setHighlight'] === 'function';
  const hasCallout = typeof (editor.chain() as unknown as Record<string, unknown>)['insertCallout'] === 'function';
  const hasInsert = typeof (editor.chain() as unknown as Record<string, unknown>)['insertWikiLink'] === 'function';
  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  const colorContent = (
    <div className={styles.colorGrid}>
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`${styles.colorSwatch} ${
            editor.getAttributes('textStyle').color === color ? styles.colorSwatchActive : ''
          }`}
          style={{ backgroundColor: color }}
          onClick={() => handleColor(color)}
          title={color}
        />
      ))}
      <button
        type="button"
        className={styles.colorSwatch}
        style={{
          background: 'linear-gradient(135deg, #ff0000, #ff9800, #ffeb3b, #4caf50, #2196f3, #9c27b0)',
        }}
        onClick={() => handleColor('')}
        title="清除颜色"
      />
    </div>
  );

  const moreMenu: MenuProps = {
    items: [
      {
        type: 'group',
        label: '段落与标题',
        children: [
          { key: 'paragraph', icon: <AlignLeftOutlined />, label: '正文段落', onClick: () => exec('setParagraph') },
          { key: 'h1', icon: <FontSizeOutlined />, label: '标题 1', onClick: () => exec('setHeading', { level: 1 }) },
          { key: 'h2', icon: <FontSizeOutlined />, label: '标题 2', onClick: () => exec('setHeading', { level: 2 }) },
          { key: 'h3', icon: <FontSizeOutlined />, label: '标题 3', onClick: () => exec('setHeading', { level: 3 }) },
        ],
      },
      {
        type: 'group',
        label: '列表与块',
        children: [
          { key: 'bulletList', icon: <UnorderedListOutlined />, label: '无序列表', onClick: () => exec('toggleBulletList') },
          { key: 'taskList', icon: <CheckSquareOutlined />, label: '待办列表', onClick: () => exec('toggleTaskList') },
          { key: 'blockquote', icon: <CommentOutlined />, label: '引用', onClick: () => exec('toggleBlockquote') },
          { key: 'codeBlock', icon: <CodeOutlined />, label: '代码块', onClick: () => exec('toggleCodeBlock') },
          { key: 'horizontalRule', icon: <LineOutlined />, label: '分割线', onClick: () => exec('setHorizontalRule') },
        ],
      },
      ...(hasCallout
        ? [
            {
              type: 'group' as const,
              label: '提示块',
              children: [
                { key: 'callout-info', icon: <InfoCircleOutlined />, label: '提示块 · 信息', onClick: () => exec('insertCallout', 'info') },
                { key: 'callout-warning', icon: <ExclamationCircleOutlined />, label: '提示块 · 警告', onClick: () => exec('insertCallout', 'warning') },
                { key: 'callout-danger', icon: <ExclamationCircleOutlined />, label: '提示块 · 危险', onClick: () => exec('insertCallout', 'danger') },
                { key: 'callout-success', icon: <CheckCircleOutlined />, label: '提示块 · 成功', onClick: () => exec('insertCallout', 'success') },
              ],
            },
          ]
        : []),
      ...(hasInsert
        ? [
            {
              type: 'group' as const,
              label: '插入',
              children: [
                { key: 'image', icon: <FileImageOutlined />, label: '图片（按链接）', onClick: () => setImageModalOpen(true) },
                { key: 'wikilink', icon: <LinkOutlined />, label: '内部链接', onClick: () => setPickerMode('wikilink') },
                { key: 'noteEmbed', icon: <FileTextOutlined />, label: '笔记内嵌', onClick: () => setPickerMode('embed') },
              ],
            },
          ]
        : []),
      {
        type: 'group' as const,
        label: '字号',
        children: FONT_SIZES.map((size) => ({
          key: `fs-${size.value}`,
          label: size.label,
          onClick: () => handleFontSize(size.value),
        })),
      },
    ],
  };

  return (
    <div className={styles.editorWrapper} style={{ '--editor-min-height': `${minHeight}px` } as CSSProperties}>
      {editable && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${editor.isActive('bold') ? styles.toolbarBtnActive : ''}`}
              onClick={handleBold}
              title="粗体（⌘B）"
            >
              <BoldOutlined />
            </button>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${editor.isActive('italic') ? styles.toolbarBtnActive : ''}`}
              onClick={handleItalic}
              title="斜体（⌘I）"
            >
              <ItalicOutlined />
            </button>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${editor.isActive('underline') ? styles.toolbarBtnActive : ''}`}
              onClick={handleUnderline}
              title="下划线"
            >
              <UnderlineOutlined />
            </button>
            {hasHighlight ? (
              <button
                type="button"
                className={`${styles.toolbarBtn} ${editor.isActive('highlight') ? styles.toolbarBtnActive : ''}`}
                onClick={handleHighlight}
                title="高亮"
              >
                <HighlightOutlined />
              </button>
            ) : null}
          </div>

          <div className={styles.toolbarDivider} />

          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={handleUndo}
              disabled={!canUndo}
              title="撤销（⌘Z）"
            >
              <UndoOutlined />
            </button>
            <button
              type="button"
              className={styles.toolbarBtn}
              onClick={handleRedo}
              disabled={!canRedo}
              title="重做（⇧⌘Z）"
            >
              <RedoOutlined />
            </button>
          </div>

          <div className={styles.toolbarDivider} />

          <div className={styles.toolbarGroup}>
            <Popover
              content={colorContent}
              trigger="click"
              placement="bottomLeft"
              overlayClassName={styles.colorPopover ?? ''}
            >
              <button
                type="button"
                className={styles.colorPickerBtn}
                title="文字颜色"
              >
                <FontColorsOutlined />
                <span
                  className={styles.colorIndicator}
                  style={{ backgroundColor: currentColorRef.current }}
                />
              </button>
            </Popover>

            <Dropdown
              menu={moreMenu}
              trigger={['click']}
              placement="bottomRight"
            >
              <button
                type="button"
                className={styles.toolbarBtn}
                title="更多格式"
              >
                <EllipsisOutlined />
              </button>
            </Dropdown>
          </div>
        </div>
      )}

      {editable && slashMenu ? <SlashMenu editor={editor} /> : null}

      <div className={styles.editorContent} style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>

      {editable ? (
        <ImageInsertModal
          open={imageModalOpen}
          onClose={() => setImageModalOpen(false)}
          onConfirm={(src, alt) => handleImageConfirm(src, alt)}
        />
      ) : null}

      {editable ? (
        <NotePickerModal
          open={pickerMode !== null}
          mode={pickerMode ?? 'wikilink'}
          onClose={() => setPickerMode(null)}
          onSelect={(note) => handleNoteSelect(note)}
        />
      ) : null}
    </div>
  );
});

export default ContentEditor;
