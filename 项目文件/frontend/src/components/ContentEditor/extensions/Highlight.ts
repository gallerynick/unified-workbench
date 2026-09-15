import { mergeAttributes } from '@tiptap/core';
import { Mark } from '@tiptap/core';

export interface HighlightOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      setHighlight: () => ReturnType;
      unsetHighlight: () => ReturnType;
    };
  }
}

/**
 * 文字高亮标记。零新依赖实现（不依赖 @tiptap/extension-highlight）。
 *
 * 底色取 design token --color-gold，深浅色自动切换，不使用硬编码 hex。
 * 渲染为 <mark>，与富文本调色板同属用户内容，不受界面 chrome 约束。
 */
export const Highlight = Mark.create<HighlightOptions>({
  name: 'highlight',

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'note-highlight',
        style: 'background-color: var(--color-gold)',
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'mark[data-highlight]' },
      { tag: 'span[data-highlight]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'mark',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-highlight': 'true',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setHighlight:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
      unsetHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
