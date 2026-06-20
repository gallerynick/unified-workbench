import { Radio } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { getVisibilityOptions } from '../../utils/visibility';
import type { Visibility } from '../../utils/visibility';
import styles from './VisibilitySetting.module.css';

export type { Visibility };

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
  const options = getVisibilityOptions();

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
            {options.map((opt) => (
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
          options.map((opt) => (
            <Radio.Button key={opt.value} value={opt.value}>
              {opt.label}
            </Radio.Button>
          ))
        )}
      </Radio.Group>
    </div>
  );
}
