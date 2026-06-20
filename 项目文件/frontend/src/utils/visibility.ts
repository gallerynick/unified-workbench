import type { TagProps } from 'antd';

export type Visibility = 'public' | 'private';

export interface VisibilityConfig {
  color: NonNullable<TagProps['color']>;
  text: string;
  description: string;
}

export const VISIBILITY_MAP: Record<Visibility, VisibilityConfig> = {
  public: { color: 'success', text: '公开', description: '所有人可见' },
  private: { color: 'default', text: '私有', description: '仅自己可见' },
};

const DEFAULT_CONFIG: VisibilityConfig = { color: 'default', text: '未知', description: '' };

export function getVisibilityConfig(visibility: string): VisibilityConfig {
  return VISIBILITY_MAP[visibility as Visibility] ?? DEFAULT_CONFIG;
}

export function getVisibilityOptions(): Array<{ value: Visibility; label: string; description: string }> {
  return Object.entries(VISIBILITY_MAP).map(([value, config]) => ({
    value: value as Visibility,
    label: config.text,
    description: config.description,
  }));
}
