import { mergeAttributes } from '@tiptap/core';
import { Node, ReactNodeViewRenderer } from '@tiptap/react';
import NoteEmbedView from './NoteEmbedView';

export interface NoteEmbedOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface NoteEmbedAttrs {
  target_id: string;
  title: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteEmbed: {
      insertNoteEmbed: (attrs: {
        target_id: string;
        title?: string;
      }) => ReturnType;
    };
  }
}

/**
 * 笔记内嵌卡片。块级、原子节点。
 *
 * 设计规格 8.1 的关键区分：
 * - wikilink 计入知识图谱的边
 * - note-embed 是只读渲染卡片，不建边
 * 后端图谱只从 wikilink 提取目标，因此此处无需任何后端配合。
 *
 * 嵌套深度限制 1 层：展开后的只读编辑器注入 NoteEmbedStub 而非本节点，
 * 更深层的内嵌只渲染成静态标题行，不再展开、不再发起请求。
 */
export const NoteEmbed = Node.create<NoteEmbedOptions>({
  name: 'note-embed',

  group: 'block',

  atom: true,

  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: { class: 'note-embed' },
    };
  },

  addAttributes() {
    return {
      target_id: { default: '' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-note-embed]',
        getAttrs: (element) => ({
          target_id: element.getAttribute('data-target-id') ?? '',
          title: element.getAttribute('data-title') ?? '',
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as NoteEmbedAttrs;
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-note-embed': 'true',
        'data-target-id': attrs.target_id,
        'data-title': attrs.title,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteEmbedView);
  },

  addCommands() {
    return {
      insertNoteEmbed:
        (attrs: { target_id: string; title?: string }) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { target_id: attrs.target_id, title: attrs.title ?? '' },
          }),
    };
  },
});

/**
 * note-embed 的静态降级形态，仅用于被内嵌笔记的只读渲染。
 *
 * 与 NoteEmbed 同名，二者不可共存于同一编辑器——这正是 1 层嵌套上限的
 * 实现方式：主编辑器注册 NoteEmbed（可展开），被展开的只读编辑器注册
 * NoteEmbedStub（静态），于是更深层的内嵌在第二层就被截断。
 * 无 NodeView、无副作用，仅走 renderHTML。
 */
export const NoteEmbedStub = Node.create({
  name: 'note-embed',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      target_id: { default: '' },
      title: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-note-embed]',
        getAttrs: (element) => ({
          target_id: element.getAttribute('data-target-id') ?? '',
          title: element.getAttribute('data-title') ?? '',
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as NoteEmbedAttrs;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-note-embed': 'true',
        'data-note-embed-stub': 'true',
      }),
      '嵌入笔记：' + (attrs.title || '（未命名）'),
    ];
  },
});
