import { Grid } from 'antd';

const { useBreakpoint } = Grid;

/**
 * 响应式断点 Hook
 * 基于 Ant Design Grid 的 useBreakpoint 检测屏幕尺寸
 * 断点定义：md=768px, lg=992px
 */
export function useResponsive() {
  const screens = useBreakpoint();
  return {
    /** 移动端：屏幕宽度 < 768px */
    isMobile: !screens.md,
    /** 平板端：768px ≤ 屏幕宽度 < 992px */
    isTablet: screens.md && !screens.lg,
    /** 桌面端：屏幕宽度 ≥ 992px */
    isDesktop: screens.lg ?? false,
  };
}
