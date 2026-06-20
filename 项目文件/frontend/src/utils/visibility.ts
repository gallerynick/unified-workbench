import type { TagProps } from 'antd';

export type Visibility = 'public' | 'private';

export interface VisibilityConfig {
  color: NonNullable<TagProps['color']>;
  text: string;
}

export const VISIBILITY_MAP: Record<Visibility, VisibilityConfig> = {
  public: { color: 'success', text: '公开' },
  private: { color: 'default', text: '私有' },
};

const DEFAULT_CONFIG: VisibilityConfig = { color: 'default', text: '未知' };

export function getVisibilityConfig(visibility: string): VisibilityConfig {
  return VISIBILITY_MAP[visibility as Visibility] ?? DEFAULT_CONFIG;
}
