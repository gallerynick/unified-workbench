import { mergeAttributes } from '@tiptap/core';
import { Node, ReactNodeViewRenderer } from '@tiptap/react';
import CalloutView from './CalloutView';

export type CalloutVariant = 'info' | 'warning' | 'danger' | 'success';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
  variants: CalloutVariant[];
  defaultVariant: CalloutVariant;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      insertCallout: (variant?: CalloutVariant) => ReturnType;
      setCalloutVariant: (variant: CalloutVariant) => ReturnType;
    };
  }
}

/**
 * 提示块节点：左侧色条 + 背景卡片，内部可嵌套任意块级内容。
 *
 * 规格约束：variant 颜色一律取自 design token（--color-info / warning /
 * error / success 及其 -bg 变体），不使用硬编码 hex，深浅色由 token.css
 * 自动切换。图标一律 @ant-design/icons（禁止 Emoji）。
 */
export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  group: 'block',

  content: 'block+',

  addOptions() {
    return {
      HTMLAttributes: { class: 'note-callout' },
      variants: ['info', 'warning', 'danger', 'success'],
      defaultVariant: 'info',
    };
  },

  addAttributes() {
    return {
      variant: {
        default: null,
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.variant
            ? { 'data-variant': attributes.variant }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout]',
        getAttrs: (element) => ({
          variant: element.getAttribute('data-variant'),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as { variant?: string | null };
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-callout': 'true',
        'data-variant': attrs.variant ?? this.options.defaultVariant,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      insertCallout:
        (variant?: CalloutVariant) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { variant: variant ?? this.options.defaultVariant },
            content: [{ type: 'paragraph' }],
          }),
      setCalloutVariant:
        (variant: CalloutVariant) =>
        ({ commands }) =>
          commands.setNode(this.name, { variant }),
    };
  },
});
