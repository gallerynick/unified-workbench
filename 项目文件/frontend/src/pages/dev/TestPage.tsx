import {
  AppstoreOutlined,
  FormOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  Button,
  Divider,
  Form,
  Input,
  List,
  message,
  Result,
  Select,
  Space,
  Typography,
} from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { isDebugModeEnabled } from '@/pages/settings/SiteSettings';
import styles from './TestPage.module.css';

const { Title, Paragraph, Text } = Typography;

const BUTTON_CODE = `// 按钮样式：primary / default / danger + 不同 size
<Button type="primary">主要按钮</Button>
<Button>默认按钮</Button>
<Button danger>危险按钮</Button>
<Button type="primary" size="large">大尺寸</Button>
<Button size="small">小尺寸</Button>`;

const FORM_CODE = `// 表单校验：Input + Select + Button
<Form layout="vertical" onFinish={onFinish}>
  <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
    <Input placeholder="请输入姓名" />
  </Form.Item>
  <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
    <Select options={[{ value: 'admin', label: '管理员' }, { value: 'member', label: '成员' }]} />
  </Form.Item>
  <Form.Item>
    <Button type="primary" htmlType="submit">提交</Button>
  </Form.Item>
</Form>`;

const ANIMATION_CODE = `// 现有 CSS 动画枚举（源自 MainLayout / Home / LockPage）
const ANIMATIONS = [
  { name: 'routeFadeIn',     css: 'animation: routeFadeIn 300ms ease-out' },
  { name: 'menuItemFlyIn',   css: 'animation: menuItemFlyIn 300ms ease-out forwards' },
  { name: 'appFloatIn',      css: 'animation: appFloatIn 500ms ease-out forwards' },
  { name: 'widgetFadeUp',    css: 'animation: widgetFadeUp 350ms ease-out both' },
  { name: 'lockPageFadeIn',  css: 'animation: lockPageFadeIn 300ms ease-out' },
  { name: 'workbenchBlurIn', css: 'animation: workbenchBlurIn 480ms ease-out forwards' },
];`;

function ButtonDemo() {
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space wrap>
        <Button type="primary">主要按钮</Button>
        <Button>默认按钮</Button>
        <Button danger>危险按钮</Button>
        <Button type="primary" ghost>
          幽灵按钮
        </Button>
      </Space>
      <Space wrap>
        <Button type="primary" size="large">
          大尺寸
        </Button>
        <Button type="primary">中尺寸</Button>
        <Button type="primary" size="small">
          小尺寸
        </Button>
      </Space>
    </Space>
  );
}

function FormDemo() {
  const onFinish = (values: { name?: string; role?: string }) => {
    message.success(`表单提交成功：${JSON.stringify(values)}`);
  };
  return (
    <Form layout="vertical" style={{ maxWidth: 400 }} onFinish={onFinish}>
      <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
        <Input placeholder="请输入姓名" />
      </Form.Item>
      <Form.Item label="角色" name="role" rules={[{ required: true, message: '请选择角色' }]}>
        <Select
          placeholder="请选择角色"
          options={[
            { value: 'admin', label: '管理员' },
            { value: 'member', label: '成员' },
          ]}
        />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit">
          提交
        </Button>
      </Form.Item>
    </Form>
  );
}

const ANIMATIONS: { name: string; desc: string }[] = [
  { name: 'routeFadeIn', desc: '路由切换渐入（MainLayout）' },
  { name: 'menuItemFlyIn', desc: '侧边栏菜单飞入（MainLayout）' },
  { name: 'appFloatIn', desc: '工作台浮入（MainLayout）' },
  { name: 'widgetFadeUp', desc: '首页组件浮现（Home）' },
  { name: 'lockPageFadeIn', desc: '锁屏淡入（LockPage）' },
  { name: 'workbenchBlurIn', desc: '解锁溶回（MainLayout）' },
];

function AnimationDemo() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div
        className={styles.demoBox ?? ''}
        {...(active ? { style: { animation: `${active} 600ms ease-out` } } : {})}
      >
        <Text type="secondary">点击下方动画名称触发演示</Text>
      </div>
      <Space wrap>
        {ANIMATIONS.map((a) => (
          <Button key={a.name} icon={<PlayCircleOutlined />} onClick={() => setActive(a.name)}>
            {a.name}
          </Button>
        ))}
      </Space>
      <Divider style={{ margin: 0 }} />
      <List
        size="small"
        bordered
        dataSource={ANIMATIONS}
        renderItem={(a) => (
          <List.Item>
            <Space direction="vertical" size={0}>
              <Text code>{a.name}</Text>
              <Text type="secondary">{a.desc}</Text>
            </Space>
          </List.Item>
        )}
      />
    </Space>
  );
}

interface DemoItem {
  key: string;
  label: string;
  icon: ReactNode;
  render: () => ReactNode;
  code: string;
}

const DEMOS: DemoItem[] = [
  {
    key: 'button',
    label: '按钮样式',
    icon: <AppstoreOutlined />,
    render: () => <ButtonDemo />,
    code: BUTTON_CODE,
  },
  {
    key: 'form',
    label: '表单校验',
    icon: <FormOutlined />,
    render: () => <FormDemo />,
    code: FORM_CODE,
  },
  {
    key: 'animation',
    label: '动画效果',
    icon: <ThunderboltOutlined />,
    render: () => <AnimationDemo />,
    code: ANIMATION_CODE,
  },
];

export default function TestPage() {
  const [activeKey, setActiveKey] = useState<string>(() => DEMOS[0]?.key ?? 'button');
  const active = DEMOS.find((d) => d.key === activeKey) ?? DEMOS[0];

  if (!isDebugModeEnabled()) {
    return (
      <Result
        status="warning"
        title="调试模式未开启"
        subTitle="请在系统设置中启用调试模式后访问组件测试工作台"
      />
    );
  }

  return (
    <div className={styles.container ?? ''}>
      <div className={styles.header ?? ''}>
        <Title level={4} style={{ margin: 0 }}>
          组件测试工作台
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          用于在进入工作台前验证组件的正确性
        </Paragraph>
      </div>
      <div className={styles.layout ?? ''}>
        <div className={styles.sider ?? ''}>
          <List
            dataSource={DEMOS}
            renderItem={(d) => (
              <List.Item
                className={
                  d.key === activeKey ? (styles.listItemActive ?? '') : (styles.listItem ?? '')
                }
                onClick={() => setActiveKey(d.key)}
              >
                <Space>
                  {d.icon}
                  {d.label}
                </Space>
              </List.Item>
            )}
          />
        </div>
        <div className={styles.content ?? ''}>
          <div className={styles.preview ?? ''}>{active?.render()}</div>
          <pre className={styles.codeBlock ?? ''}>
            <code>{active?.code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
