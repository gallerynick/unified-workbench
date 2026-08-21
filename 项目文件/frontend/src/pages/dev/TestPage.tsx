import {
  AppstoreOutlined,
  CloudOutlined,
  FireOutlined,
  ThunderboltOutlined,
  ThunderboltTwoTone,
  UnorderedListOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Button, List, Result, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isDebugModeEnabled } from '@/pages/settings/SiteSettings';
import BackgroundAnimationSection from './TestPageBackground';
import HapticsTestSection from './TestPageHaptics';
import WelcomeAnimationSection from './TestPageWelcome';
import ConvergenceAnimationSection from './TestPageConvergence';
import AftermathAnimationSection from './TestPageAftermath';
import styles from './TestPage.module.css';

const { Title, Paragraph, Text } = Typography;

interface Section {
  key: string;
  label: string;
  icon: ReactNode;
  description: string;
  render: () => ReactNode;
}

function ExampleSection() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Text strong>这是一个示例分区</Text>
        <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
          新增分区：在下方 SECTIONS 数组中追加一个条目，填写 key、label、icon、description 与 render，
          即可在索引页中看到新分区。框架本身不需要改动。
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
    description: '按钮与基础组件展示',
    render: () => <ExampleSection />,
  },
  {
    key: 'animation-bg',
    label: 'Phase 1 — 氛围背景',
    icon: <CloudOutlined />,
    description: '深色径向渐变 + CSS 迷雾缓漂，纯 CSS 零 Canvas',
    render: () => <BackgroundAnimationSection />,
  },
  {
    key: 'animation-welcome',
    label: 'Phase 2 — 欢迎语+圆环炸开',
    icon: <FireOutlined />,
    description: 'hi初次见面淡入淡出后从文字位置炸开圆环粒子扩散',
    render: () => <WelcomeAnimationSection />,
  },
  {
    key: 'animation-convergence',
    label: 'Phase 3 — 粒子汇聚成字',
    icon: <UnorderedListOutlined />,
    description: '800粒子从屏幕随机位置飞入汇聚拼出UNIFIED WORKBENCH',
    render: () => <ConvergenceAnimationSection />,
  },
  {
    key: 'animation-aftermath',
    label: 'Phase 4 — 汇聚后持续运动',
    icon: <SyncOutlined />,
    description: '汇聚成字后粒子呼吸+流场漂移不死板不散架',
    render: () => <AftermathAnimationSection />,
  },
  {
    key: 'background-animation',
    label: '背景互动动画',
    icon: <ThunderboltOutlined />,
    description: '粒子网络跟随鼠标互动',
    render: () => <BackgroundAnimationSection />,
  },
  {
    key: 'haptics-test',
    label: 'Mac 触控板震动测试',
    icon: <ThunderboltTwoTone />,
    description: 'navigator.vibrate / Force Touch / Web Haptics 可行性验证',
    render: () => <HapticsTestSection />,
  },
];

export default function TestPage() {
  const navigate = useNavigate();
  const { key } = useParams<{ key?: string }>();

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

  // ── 索引页 ──
  if (!key) {
    return (
      <div className={styles.page ?? ''}>
        <header className={styles.topbar ?? ''}>
            <Title level={4} style={{ margin: 0 }}>
              开发测试页
            </Title>
          <Button onClick={() => navigate('/', { replace: true })}>返回工作台</Button>
        </header>
        <div className={styles.indexContainer ?? ''}>
          <Paragraph type="secondary" style={{ marginBottom: 'var(--spacing-sm)' }}>
            以下列出所有测试分区，点击即可进入对应的测试页面。
          </Paragraph>
          <List
            size="small"
            dataSource={SECTIONS}
            renderItem={(s) => (
              <List.Item className={styles.indexItem ?? ''}>
                <a
                  href={`/dev/testpage/${s.key}`}
                  className={styles.indexLink ?? ''}
                >
                  <Space size={12} className={styles.indexContent ?? ''}>
                    <span className={styles.indexIcon}>{s.icon}</span>
                    <div className={styles.indexText}>
                      <Text strong>{s.label}</Text>
                      <Text type="secondary" style={{ fontSize: 'var(--text-caption-size)' }}>
                        {s.description}
                      </Text>
                    </div>
                  </Space>
                </a>
              </List.Item>
            )}
          />
        </div>
      </div>
    );
  }

  // ── 单项页 ──
  const section = SECTIONS.find((s) => s.key === key);
  if (!section) {
    return (
      <div className={styles.page ?? ''}>
        <header className={styles.topbar ?? ''}>
          <Title level={4} style={{ margin: 0 }}>
            测试工作台
          </Title>
          <Button onClick={() => navigate('/dev/testpage', { replace: true })}>返回索引</Button>
        </header>
        <Result
          status="404"
          title="未找到测试分区"
          subTitle={`没有找到 key 为 "${key}" 的测试分区`}
          extra={
            <Button type="primary" onClick={() => navigate('/dev/testpage', { replace: true })}>
              返回索引
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.page ?? ''}>
      {section.render()}
    </div>
  );
}