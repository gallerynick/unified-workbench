import { Radio } from 'antd';
import type { RadioChangeEvent } from 'antd';
import styles from './VisibilitySetting.module.css';

type Visibility = 'public' | 'private';

interface VisibilitySettingProps {
  value?: Visibility;
  onChange?: (visibility: Visibility) => void;
}

export default function VisibilitySetting({
  value = 'public',
  onChange,
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
        <Radio.Button value="public">公开</Radio.Button>
        <Radio.Button value="private">私有</Radio.Button>
      </Radio.Group>
    </div>
  );
}
