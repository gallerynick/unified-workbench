import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from 'antd';
import { HolderOutlined, CloseOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import styles from './Home.module.css';

interface SortableWidgetProps {
  id: string;
  /** 标题节点（图标 + 文本），由 Home.tsx 的 WIDGET_META 提供 */
  title?: ReactNode;
  /** 标题行右侧动作（如「查看全部」），由 Home.tsx 的 WIDGET_META 提供 */
  extra?: ReactNode;
  children: ReactNode;
  onRemove?: () => void;
}

export default function SortableWidget({ id, title, extra, children, onRemove }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 'var(--z-dropdown)' : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.widgetWrapper}>
      <div className={styles.widgetHeader}>
        <Button
          type="text"
          size="small"
          icon={<HolderOutlined />}
          className={styles.dragHandle ?? ''}
          {...attributes}
          {...listeners}
          aria-label="拖拽排序"
        />
        {onRemove && (
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onRemove}
            className={styles.removeBtn ?? ''}
            aria-label="隐藏组件"
          />
        )}
      </div>
      <div className={styles.widgetTitle}>
        {title && <span className={styles.widgetTitleMain}>{title}</span>}
        {extra && <span className={styles.widgetTitleExtra}>{extra}</span>}
      </div>
      <div className={styles.widgetBody}>{children}</div>
    </div>
  );
}
