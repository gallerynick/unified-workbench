import { useEffect, useState } from 'react';
import { Modal, Space, Input, AutoComplete, message } from 'antd';

interface TopologyModalProps {
  open: boolean;
  /** 已有拓扑分类选项，用于分类输入自动补全 */
  categories: { value: string; label: string }[];
  onClose: () => void;
  /** 创建成功回调，回传表单输入的名称与分类 */
  onSaved: (data: { name: string; category: string }) => void;
}

/**
 * 拓扑 新建 共用弹窗
 *
 * 供「拓扑管理」页（TopologyManagement）复用，表单与提交校验逻辑内聚于此，
 * 页面只负责打开/关闭与创建后的初始化，一处修改、多处以一。
 */
export default function TopologyModal({
  open,
  categories,
  onClose,
  onSaved,
}: TopologyModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  // 每次打开时重置表单
  useEffect(() => {
    if (!open) return;
    setName('');
    setCategory('');
  }, [open]);

  const handleCreate = () => {
    if (!name.trim()) { message.warning('请输入拓扑名称'); return; }
    onSaved({ name, category });
    onClose();
  };

  return (
    <Modal
      title="新建拓扑"
      open={open}
      onOk={handleCreate}
      onCancel={onClose}
      okText="创建"
      cancelText="取消"
      width={480}
      destroyOnClose
      styles={{ body: { paddingBottom: "var(--spacing-card-gap)" } }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <div style={{ marginBottom: "var(--spacing-xxs)", fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>拓扑名称</div>
          <Input placeholder="输入拓扑名称" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div style={{ marginBottom: "var(--spacing-xxs)", fontSize: 'var(--text-caption-size)', color: 'var(--text-secondary)' }}>分类标签（可选）</div>
          <AutoComplete
            style={{ width: '100%' }}
            placeholder="输入分类名称或选择已有分类"
            value={category}
            onChange={(val) => setCategory(val)}
            options={categories}
            allowClear
          />
        </div>
      </Space>
    </Modal>
  );
}
