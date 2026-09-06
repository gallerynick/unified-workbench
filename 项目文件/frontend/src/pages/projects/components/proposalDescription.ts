/**
 * 提案描述富文本工具（Tiptap doc 与纯文本兼容处理）
 *
 * 描述存储约定：Tiptap doc JSON 序列化后的字符串；历史纯文本数据直接为字符串。
 * 供 ProposalModal（编辑回填）与 ProposalDetailPage（只读渲染）共用。
 */

/**
 * 解析描述字符串：兼容 Tiptap JSON 字符串与纯文本旧数据。
 * 返回 Tiptap doc JSON 对象；纯文本返回 null（由调用方包装为段落 doc）。
 */
export function parseDescription(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && (parsed as { type?: string }).type === 'doc') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // 非 JSON，走纯文本
  }
  return null;
}

/** 把纯文本包装为 Tiptap 段落 doc（供富文本编辑器回显旧数据） */
export function wrapPlainTextToDoc(text: string): Record<string, unknown> {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

/**
 * 序列化描述：Tiptap doc 对象 → JSON 字符串；纯文本 → trim 后非空字符串。
 * 返回 undefined 表示无需提交（描述为空）。
 */
export function serializeDescription(
  value: Record<string, unknown> | string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (typeof value !== 'string') {
    return JSON.stringify(value);
  }
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}
