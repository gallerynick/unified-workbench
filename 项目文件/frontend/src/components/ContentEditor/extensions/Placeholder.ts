import { Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface EditorPlaceholderOptions {
  /** 占位文案 */
  placeholder: string;
}

/**
 * 编辑器空态占位。零新依赖实现（不依赖 @tiptap/extension-placeholder）。
 *
 * 用 ProseMirror 的 widget decoration 在文档起始位置渲染一个占位 span，
 * 仅当文档只剩一个空段落时出现。不碰现有 ContentEditor 的 base 扩展集，
 * 因此 content 模块行为保持不变，由调用方按需注入。
 */
export const EditorPlaceholder = Extension.create<EditorPlaceholderOptions>({
  name: 'editorPlaceholder',

  addOptions() {
    return {
      placeholder: '请输入内容...',
    };
  },

  addProseMirrorPlugins() {
    const { placeholder } = this.options;

    return [
      new Plugin({
        props: {
          decorations: (state: EditorState): DecorationSet => {
            const doc = state.doc;
            const firstChild = doc.firstChild;
            const isEmpty =
              doc.childCount === 1 &&
              firstChild !== null &&
              firstChild.type.name === 'paragraph' &&
              firstChild.childCount === 0;

            if (!isEmpty) {
              return DecorationSet.empty;
            }

            const span = document.createElement('span');
            span.className = 'note-editor-placeholder';
            span.textContent = placeholder;
            span.setAttribute('contenteditable', 'false');

            return DecorationSet.create(doc, [
              Decoration.widget(0, () => span, { side: -1 }),
            ]);
          },
        },
      }),
    ];
  },
});
