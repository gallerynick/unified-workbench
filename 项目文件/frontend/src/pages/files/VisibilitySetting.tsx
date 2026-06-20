import { Radio } from 'antd';
import type { RadioChangeEvent } from 'antd';
import styles from './VisibilitySetting.module.css';

export type Visibility = 'public' | 'private';

interface VisibilityOption {
  value: Visibility;
  label: string;
  description?: string;
}

const DEFAULT_OPTIONS: VisibilityOption[] = [
  { value: 'public', label: '公开', description: '所有人可见' },
  { value: 'private', label: '私有', description: '仅自己可见' },
];

interface VisibilitySettingProps {
  value?: Visibility;
  onChange?: (visibility: Visibility) => void;
  showDescription?: boolean;
  layout?: 'horizontal' | 'vertical';
}

export default function VisibilitySetting({
  value = 'public',
  onChange,
  showDescription = false,
  layout = 'horizontal',
}: VisibilitySettingProps) {
  const handleVisibilityChange = (e: RadioChangeEvent) => {
    onChange?.(e.target.value as Visibility);
  };

  return (
    <div className={styles.container ?? ''}>
      <Radio.Group
        className={styles.radioGroup ?? ''}
        value={value}
        onChange={handleVisibilityChange}
      >
        {layout === 'vertical' ? (
          <div className={styles.visibilitySection ?? ''}>
            {DEFAULT_OPTIONS.map((opt) => (
              <Radio key={opt.value} value={opt.value}>
                <div>
                  <div className={styles.visibilityOptionTitle ?? ''}>{opt.label}</div>
                  {showDescription && opt.description && (
                    <div className={styles.visibilityOptionDesc ?? ''}>{opt.description}</div>
                  )}
                </div>
              </Radio>
            ))}
          </div>
        ) : (
          DEFAULT_OPTIONS.map((opt) => (
            <Radio.Button key={opt.value} value={opt.value}>
              {opt.label}
            </Radio.Button>
          ))
        )}
      </Radio.Group>
    </div>
  );
}
