import { AppstoreOutlined } from '@ant-design/icons';
import { Button, List, Result, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDebugModeEnabled } from '@/pages/settings/SiteSettings';
import styles from './TestPage.module.css';

const { Title, Paragraph, Text } = Typography;

interface Section {
  key: string;
  label: string;
  icon: ReactNode;
  render: () => ReactNode;
}

function ExampleSection() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Text strong>这是一个示例分区</Text>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          新增分区：在下方 SECTIONS 数组中追加一个条目，填写 key、label、icon 与 render，
          即可在左侧列表中看到新分区。框架本身不需要改动。
        </Paragraph>
      </div>
      <Space wrap>
        <Button type="primary">主要按钮</Button>
        <Button>默认按钮</Button>
        <Button danger>危险按钮</Button>
      </Space>
    </Space>
  );
}

const SECTIONS: Section[] = [
  {
    key: 'example',
    label: '示例分区',
    icon: <AppstoreOutlined />,
    render: () => <ExampleSection />,
  },
];

export default function TestPage() {
  const navigate = useNavigate();
  const [activeKey, setActiveKey] = useState<string>(() => SECTIONS[0]?.key ?? '');
  const active = SECTIONS.find((s) => s.key === activeKey) ?? SECTIONS[0];

  if (!isDebugModeEnabled()) {
    return (
      <Result
        status="warning"
        title="调试模式未开启"
        subTitle="请在系统设置中启用调试模式后访问组件测试工作台"
        extra={
          <Button type="primary" onClick={() => navigate('/', { replace: true })}>
            返回工作台
          </Button>
        }
      />
    );
  }

  return (
    <div className={styles.page ?? ''}>
      <header className={styles.topbar ?? ''}>
        <Title level={4} style={{ margin: 0 }}>
          测试工作台
        </Title>
        <Button onClick={() => navigate('/', { replace: true })}>返回工作台</Button>
      </header>
      <div className={styles.body ?? ''}>
        <nav className={styles.sider ?? ''}>
          <List
            size="small"
            dataSource={SECTIONS}
            renderItem={(s) => (
              <List.Item
                className={
                  s.key === activeKey ? (styles.itemActive ?? '') : (styles.item ?? '')
                }
                onClick={() => setActiveKey(s.key)}
              >
                <Space size={6}>
                  {s.icon}
                  {s.label}
                </Space>
              </List.Item>
            )}
          />
        </nav>
        <main className={styles.content ?? ''}>
          {active ? active.render() : <Paragraph type="secondary">暂无分区</Paragraph>}
        </main>
      </div>
    </div>
  );
}
