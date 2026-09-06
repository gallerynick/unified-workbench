import { useEffect, useState } from 'react';
import { AutoComplete, Input, Modal, Space, message } from 'antd';

interface TopologyCreateModalProps {
  open: boolean;
  /** 已有拓扑分类选项（AutoComplete 建议） */
  existingCategories: { value: string; label: string }[];
  onClose: () => void;
  /** 创建成功回调（父组件接管后续状态） */
  onCreated: (name: string, category: string) => void;
}

/**
 * 拓扑 新建弹窗
 *
 * 供「拓扑管理」页（TopologyManagement）复用，名称/分类表单与校验内聚于此，
 * 页面只负责打开/关闭与创建后的状态接管，一处修改、多处以一。
 */
export default function TopologyCreateModal({
  open,
  existingCategories,
  onClose,
  onCreated,
}: TopologyCreateModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    if (!open) return;
    setName('');
    setCategory('');
  }, [open]);

  const handleOk = () => {
    if (!name.trim()) {
      message.warning('请输入拓扑名称');
      return;
    }
    onCreated(name.trim(), category.trim());
  };

  return (
    <Modal
      title="新建拓扑"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="创建"
      cancelText="取消"
      width={480}
      destroyOnClose
      styles={{ body: { paddingBottom: 'var(--spacing-card-gap)' } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <div style={{ marginBottom: 'var(--spacing-xxs)', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>拓扑名称</div>
          <Input placeholder="输入拓扑名称" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div style={{ marginBottom: 'var(--spacing-xxs)', fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>分类标签（可选）</div>
          <AutoComplete
            style={{ width: '100%' }}
            placeholder="输入分类名称或选择已有分类"
            value={category}
            onChange={(val) => setCategory(val)}
            options={existingCategories}
            allowClear
          />
        </div>
      </Space>
    </Modal>
  );
}
