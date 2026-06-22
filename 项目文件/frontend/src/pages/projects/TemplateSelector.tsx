import { Empty } from 'antd';
import type { Template } from '../../types/template';

interface TemplateSelectorProps {
  onSelect: (template: Template) => void;
  location?: string;
}

/**
 * 模板选择器（占位版本）
 * 模板功能开发中，暂不展示模板列表
 */
export default function TemplateSelector(_props: TemplateSelectorProps) {
  return (
    <Empty
      description="模板功能开发中"
      image={Empty.PRESENTED_IMAGE_SIMPLE}
    />
  );
}
