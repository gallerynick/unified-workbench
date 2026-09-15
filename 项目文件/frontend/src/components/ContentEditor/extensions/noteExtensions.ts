import type { Extensions } from '@tiptap/core';
import { TaskItem } from '@tiptap/extension-list/task-item';
import { TaskList } from '@tiptap/extension-list/task-list';
import { Callout } from './Callout';
import { Highlight } from './Highlight';
import { NoteImage } from './Image';
import { NoteEmbed, NoteEmbedStub } from './NoteEmbed';
import { EditorPlaceholder } from './Placeholder';
import { WikiLink } from './WikiLink';

export interface NoteExtensionsOptions {
  /** 点击 wikilink 时的跳转回调，绑定到真实的路由跳转 */
  onNavigateNote?: (noteId: string) => void;
  /** 编辑器空态占位文案 */
  placeholder?: string;
  /**
   * 只读嵌入形态：展开 note-embed 时传给内部只读编辑器的扩展集。
   * 传 true 时注册 NoteEmbedStub 代替 NoteEmbed，从而把嵌套深度截断在 1 层。
   */
  isEmbedded?: boolean;
}

/**
 * 笔记编辑器的扩展装配。
 *
 * 只放这里、不进 ContentEditor 的 base 扩展集，保证 content 模块
 * （及模板、提案等复用方）在传参不变时行为与改造前完全一致。
 *
 * 依赖说明：TaskList / TaskItem 来自 @tiptap/extension-list 的子路径导出，
 * 该包是 starter-kit 的传递依赖，已在本地 node_modules 中；package.json
 * 已把它提升为显式依赖，避免隐式依赖漂移。
 */
export function noteExtensions(options: NoteExtensionsOptions = {}): Extensions {
  const {
    onNavigateNote,
    placeholder = '开始撰写笔记…',
    isEmbedded = false,
  } = options;

  return [
    onNavigateNote
      ? WikiLink.configure({ onNavigate: onNavigateNote })
      : WikiLink,
    isEmbedded ? NoteEmbedStub : NoteEmbed,
    Callout,
    TaskList,
    TaskItem,
    Highlight,
    NoteImage,
    EditorPlaceholder.configure({ placeholder }),
  ];
}
