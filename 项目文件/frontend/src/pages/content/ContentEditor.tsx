import { useCallback, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Extension } from '@tiptap/core';
import type { CommandProps } from '@tiptap/core';
import { Popover, Select } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  FontColorsOutlined,
} from '@ant-design/icons';
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

// 预设颜色列表
const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#ff0000', '#ff5722', '#ff9800', '#ffc107', '#ffeb3b', '#8bc34a', '#4caf50', '#009688',
  '#00bcd4', '#03a9f4', '#2196f3', '#3f51b5', '#673ab7', '#9c27b0', '#e91e63', '#f44336',
  '#b71c1c', '#bf360c', '#e65100', '#f57f17', '#f9a825', '#33691e', '#1b5e20', '#004d40',
  '#006064', '#01579b', '#0d47a1', '#1a237e', '#311b92', '#4a148c', '#880e4f', '#c62828',
];

// 字号选项
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

interface ContentEditorProps {
  value?: Record<string, unknown> | null;
  onChange?: (value: Record<string, unknown>) => void;
  placeholder?: string;
  minHeight?: number;
  editable?: boolean;
}

export default function ContentEditor({
  value,
  onChange,
  placeholder = '请输入内容...',
  minHeight = 200,
  editable = true,
}: ContentEditorProps) {
  const currentColorRef = useRef('#000000');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      FontSize,
    ],
    editable: editable,
    content: value ? JSON.parse(JSON.stringify(value)) : undefined,
    editorProps: {
      attributes: {
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      onChange?.(json as Record<string, unknown>);
    },
  });

  // 外部 value 变化时同步编辑器内容（如套用模板场景）
  useEffect(() => {
    if (editor && value) {
      const nextContent = JSON.parse(JSON.stringify(value));
      editor.commands.setContent(nextContent);
    }
  }, [editor]);

  const handleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run();
  }, [editor]);

  const handleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run();
  }, [editor]);

  const handleUnderline = useCallback(() => {
    editor?.chain().focus().toggleUnderline().run();
  }, [editor]);

  const handleColor = useCallback(
    (color: string) => {
      if (color) {
        editor?.chain().focus().setColor(color).run();
        currentColorRef.current = color;
      } else {
        editor?.chain().focus().unsetColor().run();
      }
    },
    [editor],
  );

  const handleFontSize = useCallback(
    (size: string) => {
      if (size) {
        (editor?.chain().focus() as unknown as { setFontSize: (s: string) => { run: () => void } }).setFontSize(size).run();
      } else {
        (editor?.chain().focus() as unknown as { unsetFontSize: () => { run: () => void } }).unsetFontSize().run();
      }
    },
    [editor],
  );

  if (!editor) return null;

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

  return (
    <div className={styles.editorWrapper} style={{ '--editor-min-height': `${minHeight}px` } as React.CSSProperties}>
      {editable && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${editor.isActive('bold') ? styles.toolbarBtnActive : ''}`}
              onClick={handleBold}
              title="粗体"
            >
              <BoldOutlined />
            </button>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${editor.isActive('italic') ? styles.toolbarBtnActive : ''}`}
              onClick={handleItalic}
              title="斜体"
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
          </div>

          <div className={styles.toolbarDivider} />

          <div className={styles.toolbarGroup}>
            <Select
              className={styles.fontSizeSelect ?? ''}
              size="small"
              placeholder="字号"
              options={FONT_SIZES}
              onChange={handleFontSize}
              allowClear
              popupMatchSelectWidth={false}
            />
          </div>
        </div>
      )}

      <div className={styles.editorContent} style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
