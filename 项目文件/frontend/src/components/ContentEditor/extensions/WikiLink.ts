import { mergeAttributes } from '@tiptap/core';
import { Node, ReactNodeViewRenderer } from '@tiptap/react';
import WikiLinkView from './WikiLinkView';

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
  /** 点击 wikilink 时的跳转回调；不提供时节点仅展示不响应点击 */
  onNavigate?: (targetId: string) => void;
}

export interface WikiLinkAttrs {
  target_id: string;
  target_title: string;
  display: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikiLink: (attrs: {
        target_id: string;
        target_title: string;
        display?: string;
      }) => ReturnType;
      deleteWikiLink: () => ReturnType;
    };
  }
}

/**
 * 双链节点：行内、原子、可选。
 *
 * 设计规格 8.1 —— 只有 wikilink 节点计入知识图谱；note-embed 为只读渲染
 * 卡片，不建边。本节点渲染为带高亮底色的行内「药丸」，点击跳转目标笔记。
 * atom: true 使整块作为单一编辑单元（内部不可移动光标），便于整体删除。
 *
 * 跳转回调通过 addStorage 暴露，NodeView 按编辑器实例读取，
 * 避免模块级全局状态在多个编辑器并存时串号。
 */
export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikilink',

  group: 'inline',

  inline: true,

  selectable: true,

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'note-wikilink',
      },
    };
  },

  addAttributes() {
    return {
      target_id: { default: '' },
      target_title: { default: '' },
      display: { default: null },
    };
  },

  addStorage() {
    return {
      onNavigate: this.options.onNavigate,
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wikilink]',
        getAttrs: (element) => ({
          target_id: element.getAttribute('data-target-id') ?? '',
          target_title: element.getAttribute('data-target-title') ?? '',
          display: element.getAttribute('data-display'),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as WikiLinkAttrs;
    return [
      'span',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-wikilink': 'true',
          'data-target-id': attrs.target_id,
          'data-target-title': attrs.target_title,
        },
      ),
      attrs.display ?? attrs.target_title,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView);
  },

  addCommands() {
    return {
      insertWikiLink:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
      deleteWikiLink:
        () =>
        ({ commands }) =>
          commands.deleteSelection(),
    };
  },
});
