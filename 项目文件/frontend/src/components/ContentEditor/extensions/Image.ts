import { mergeAttributes } from '@tiptap/core';
import { Node } from '@tiptap/core';

export interface NoteImageOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface NoteImageAttrs {
  src: string | null;
  alt: string | null;
  title: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteImage: {
      setImage: (attrs: {
        src: string;
        alt?: string;
        title?: string;
      }) => ReturnType;
    };
  }
}

/**
 * 图片节点。StarterKit 不含 Image，手写以让 note.body 具备图片数据能力。
 *
 * 当前工作台前端没有通用图片上传接口，故仅支持按 URL 插入；
 * 上传能力待后端提供接口后补齐。
 */
export const NoteImage = Node.create<NoteImageOptions>({
  name: 'image',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: { class: 'note-image' },
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as NoteImageAttrs;
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        src: attrs.src,
        alt: attrs.alt,
        title: attrs.title,
      }),
    ];
  },

  addCommands() {
    return {
      setImage:
        (attrs: { src: string; alt?: string; title?: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
