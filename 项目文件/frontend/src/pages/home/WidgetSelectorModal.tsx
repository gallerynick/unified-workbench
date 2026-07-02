import { Modal, List, Switch, Typography } from 'antd';
import type { WidgetItem } from './types';
import { WIDGET_META } from './types';

const { Text } = Typography;

interface WidgetSelectorModalProps {
  open: boolean;
  widgets: WidgetItem[];
  onClose: () => void;
  onToggle: (id: string, visible: boolean) => void;
}

export default function WidgetSelectorModal({
  open,
  widgets,
  onClose,
  onToggle,
}: WidgetSelectorModalProps) {
  return (
    <Modal
      title="组件显示设置"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      destroyOnClose
      width={560}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <List
        size="small"
        dataSource={widgets}
        renderItem={(item) => {
          const meta = WIDGET_META[item.id];
          return (
            <List.Item>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div>
                  <Text strong>{meta?.label ?? item.id}</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {meta?.description ?? ''}
                    </Text>
                  </div>
                </div>
                <Switch
                  checked={item.visible}
                  onChange={(checked) => onToggle(item.id, checked)}
                />
              </div>
            </List.Item>
          );
        }}
      />
    </Modal>
  );
}
