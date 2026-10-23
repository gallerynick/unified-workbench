import { LockOutlined } from '@ant-design/icons';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import styles from './AppSwitch.module.css';

/** 组合样式类名，过滤空值 */
function cx(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(' ');
}

export type AppSwitchSize = 'sm' | 'md' | 'lg' | 'small' | 'middle' | 'large' | 'default';

export interface AppSwitchProps {
  /** 受控值；不传则为非受控（配合 defaultChecked） */
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  /** 尺寸：sm 44×24 / md 56×32（默认）/ lg 68×38；兼容 antd 的 small/large 写法 */
  size?: AppSwitchSize;
  className?: string;
  style?: CSSProperties;
  id?: string;
  name?: string;
  title?: string;
  'aria-label'?: string;
  /** 兼容 antd 旧用法：开关内不再渲染文字，仅在缺 aria-label 时用作无障碍名称 */
  checkedChildren?: ReactNode;
  unCheckedChildren?: ReactNode;
}

const SIZE_CLASS: Record<AppSwitchSize, 'sm' | 'md' | 'lg'> = {
  sm: 'sm',
  small: 'sm',
  md: 'md',
  middle: 'md',
  default: 'md',
  lg: 'lg',
  large: 'lg',
};

/**
 * 全站统一开关。
 * 视觉：轨道关=输入框描边灰 / 开=交互蓝；滑块白 + 细投影；
 * 状态图形（通=竖线 / 断=圆环）画在轨道上，由滑块遮挡；
 * 加载时滑块单向扫光 + 描边亮光绕行；禁用时滑块上显示淡锁。
 */
export default function AppSwitch({
  checked,
  defaultChecked = false,
  onChange,
  disabled,
  loading,
  size = 'md',
  className,
  style,
  id,
  name,
  title,
  'aria-label': ariaLabel,
  checkedChildren,
}: AppSwitchProps) {
  const [innerChecked, setInnerChecked] = useState<boolean>(defaultChecked);
  const isControlled = checked !== undefined;
  const value = isControlled ? checked : innerChecked;

  const handleClick = () => {
    const next = !value;
    if (!isControlled) setInnerChecked(next);
    onChange?.(next);
  };

  const fallbackLabel =
    typeof checkedChildren === 'string' && checkedChildren ? checkedChildren : title;
  const sizeClass = SIZE_CLASS[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel ?? fallbackLabel}
      aria-busy={loading ? true : undefined}
      disabled={disabled}
      id={id}
      name={name}
      className={cx(
        styles.switch,
        sizeClass === 'sm' && styles.sm,
        sizeClass === 'lg' && styles.lg,
        loading && styles.isLoading,
        className,
      )}
      style={style}
      onClick={handleClick}
    >
      <span className={cx(styles.glyph, styles.glyphOn)} aria-hidden="true">
        <span className={styles.glyphBar} />
      </span>
      <span className={cx(styles.glyph, styles.glyphOff)} aria-hidden="true">
        <span className={styles.glyphRing} />
      </span>
      <span className={styles.thumb}>
        {disabled ? <LockOutlined className={styles.lockIcon} /> : null}
      </span>
    </button>
  );
}
