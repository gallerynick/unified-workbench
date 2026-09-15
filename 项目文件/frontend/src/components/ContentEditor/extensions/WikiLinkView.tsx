import type { ReactNodeViewProps } from '@tiptap/react';
import { LinkOutlined } from '@ant-design/icons';
import styles from './WikiLinkView.module.css';

interface WikiLinkNodeAttrs {
  target_id: string;
  target_title: string;
  display: string | null;
}

interface WikiLinkStorage {
  onNavigate?: (targetId: string) => void;
}

/**
 * wikilink 的 React 节点视图：行内药丸，点击跳转目标笔记。
 *
 * onNavigate 由装配方经 WikiLink.configure({ onNavigate }) 注入，
 * 存在扩展 storage 中按实例读取；未提供时节点保持纯展示。
 */
export default function WikiLinkView(props: ReactNodeViewProps<HTMLSpanElement>) {
  const { node, editor, ref } = props;
  const attrs = node.attrs as WikiLinkNodeAttrs;
  const title = attrs.display || attrs.target_title || attrs.target_id;

  const storage = (
    editor.extensionStorage as { wikilink?: WikiLinkStorage }
  ).wikilink;
  const onNavigate = storage?.onNavigate;

  const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    if (attrs.target_id && onNavigate) {
      onNavigate(attrs.target_id);
    }
  };

  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      className={styles.pill}
      onClick={handleClick}
      title={title}
    >
      <LinkOutlined className={styles.icon} />
      {title}
    </span>
  );
}
