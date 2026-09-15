import {
  NodeViewContent,
  type ReactNodeViewProps,
} from '@tiptap/react';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import styles from './CalloutView.module.css';
import type { CalloutVariant } from './Callout';

interface CalloutNodeAttrs {
  variant?: CalloutVariant | null;
}

const ICONS: Record<CalloutVariant, ReactNode> = {
  info: <InfoCircleOutlined />,
  warning: <ExclamationCircleOutlined />,
  danger: <CloseCircleOutlined />,
  success: <CheckCircleOutlined />,
};

/**
 * Callout 节点视图。variant 决定色条与底色，全部经 design token 取值。
 * 图标一律 @ant-design/icons（禁止 Emoji）。
 */
export default function CalloutView(props: ReactNodeViewProps<HTMLDivElement>) {
  const { node, ref } = props;
  const attrs = node.attrs as CalloutNodeAttrs;
  const variant = (attrs.variant ?? 'info') as CalloutVariant;

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={styles.callout}
      data-variant={variant}
    >
      <span className={styles.marker} aria-hidden="true">
        {ICONS[variant]}
      </span>
      <div className={styles.content}>
        <NodeViewContent />
      </div>
    </div>
  );
}
