import { useCallback, useState } from 'react';
import { Card, Space, Typography, Button, Tag, Divider, Alert, List } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface TestResult {
  label: string;
  status: 'pass' | 'fail' | 'unknown' | 'testing';
  detail: string;
}

export default function HapticsTestSection() {
  const [results, setResults] = useState<TestResult[]>([
    { label: 'navigator.vibrate() 支持检测', status: 'unknown', detail: '点击按钮测试' },
    { label: 'navigator.vibrate() 实际震动', status: 'unknown', detail: '点击按钮测试' },
    { label: 'Force Touch 事件检测', status: 'unknown', detail: '点击按钮开始监听' },
    { label: 'ios-vibrator-pro-max 风格 hack', status: 'unknown', detail: '点击按钮测试' },
    { label: 'GamepadHapticActuator', status: 'unknown', detail: '检测手柄震动' },
  ]);
  const [forceTouchLevel, setForceTouchLevel] = useState<number>(0);
  const [forceTouchActive, setForceTouchActive] = useState(false);
  const [forceTouchSupported, setForceTouchSupported] = useState<boolean | null>(null);

  const updateResult = useCallback((index: number, update: Pick<TestResult, 'status' | 'detail'>) => {
    setResults((prevList) => {
      const next = [...prevList];
      next[index] = { ...next[index]!, ...update };
      return next;
    });
  }, []);

  /* 测试 1: navigator.vibrate() 支持检测 */
  const testVibrateSupport = useCallback(() => {
    const supported = 'vibrate' in navigator;
    const userAgent = navigator.userAgent.toLowerCase();
    const isMac = userAgent.includes('mac');
    const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
    const isChrome = userAgent.includes('chrome');
    updateResult(0, {
      status: supported ? 'pass' : 'fail',
      detail: supported
        ? `浏览器支持 navigator.vibrate()。平台: ${isMac ? 'macOS' : '非 macOS'}，`
          + `${isSafari ? 'Safari' : isChrome ? 'Chrome' : '其他浏览器'}。`
          + '注意：macOS 上 navigator.vibrate() 返回 true 但实际无震动效果。'
        : '浏览器不支持 navigator.vibrate()',
    });
  }, [updateResult]);

  /* 测试 2: 实际执行震动 */
  const testVibrateActual = useCallback(() => {
    try {
      const result = navigator.vibrate(200);
      updateResult(1, {
        status: 'testing',
        detail: `已调用 navigator.vibrate(200)，返回 ${result}。请感受触控板是否有震动。（注意：macOS 桌面浏览器此 API 无实际效果）`,
      });
      setTimeout(() => {
        navigator.vibrate(0);
        updateResult(1, {
          status: result ? 'pass' : 'fail',
          detail: `调用完成，返回 ${result}。`
            + '如果触控板没有震动，说明该 API 在 macOS 上的实际效果为空。'
            + '（该 API 仅限 Android Chrome）',
        });
      }, 500);
    } catch (e) {
      updateResult(1, {
        status: 'fail',
        detail: `调用失败: ${e instanceof Error ? e.message : '未知错误'}`,
      });
    }
  }, [updateResult]);

  /* 测试 3: Force Touch 事件监听 */
  const startForceTouchMonitor = useCallback(() => {
    setForceTouchActive(true);
    const handler = (e: MouseEvent) => {
      const force = (e as unknown as { webkitForce?: number }).webkitForce ?? 0;
      setForceTouchLevel(force);
      if (force > 0.5 && forceTouchSupported === null) {
        setForceTouchSupported(true);
      }
    };
    window.addEventListener('mousemove', handler);
    updateResult(2, {
      status: 'testing',
      detail: '已开始监听 Force Touch 事件，请在触控板上用不同力度按压...',
    });
    // 5秒后自动停止
    setTimeout(() => {
      window.removeEventListener('mousemove', handler);
      setForceTouchActive(false);
      if (forceTouchSupported === null) {
        setForceTouchSupported(false);
        updateResult(2, {
          status: 'fail',
          detail: '未检测到 Force Touch 事件。可能原因：1) 非 Safari 浏览器 2) 触控板不支持 Force Touch 3) 需要用力按压',
        });
      } else {
        updateResult(2, {
          status: 'pass',
          detail: `检测到 Force Touch 事件！webkitForce 最大值为 ${forceTouchLevel.toFixed(2)}。`
            + '（注意：这只能检测输入，不能主动触发震动）',
        });
      }
    }, 5000);
  }, [updateResult, forceTouchLevel, forceTouchSupported]);

  /* 测试 4: ios-vibrator-pro-max 风格 hack */
  const testHapticHack = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');

    if (!isSafari) {
      updateResult(3, {
        status: 'fail',
        detail: '此 hack 仅适用于 Safari 浏览器。当前浏览器非 Safari。',
      });
      return;
    }

    /* 尝试创建隐藏的 switch input 来触发系统震动 */
    try {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.style.position = 'fixed';
      input.style.top = '-100px';
      input.style.left = '-100px';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      document.body.appendChild(input);

      /* 快速切换 switch 状态 */
      let count = 0;
      const interval = setInterval(() => {
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        count++;
        if (count >= 10) {
          clearInterval(interval);
          document.body.removeChild(input);
          updateResult(3, {
            status: 'pass',
            detail: '已执行隐藏 switch 切换 hack 10 次。'
              + '如果触控板有震动感，说明此方法可行。'
              + '（iOS 18.4+ 需要用户点击交互授权）',
          });
        }
      }, 50);

      updateResult(3, {
        status: 'testing',
        detail: '正在执行隐藏 switch 切换 hack...请感受触控板是否有震动。',
      });
    } catch (e) {
      updateResult(3, {
        status: 'fail',
        detail: `hack 执行失败: ${e instanceof Error ? e.message : '未知错误'}`,
      });
    }
  }, [updateResult]);

  /* 测试 5: GamepadHapticActuator */
  const testGamepadHaptics = useCallback(async () => {
    const gamepads = navigator.getGamepads?.();
    const hasGamepad = Array.from(gamepads ?? []).some((g) => g !== null);
    updateResult(4, {
      status: hasGamepad ? 'pass' : 'fail',
      detail: hasGamepad
        ? '检测到已连接手柄，GamepadHapticActuator 可能可用'
        : '未检测到已连接手柄。GamepadHapticActuator 仅适用于游戏手柄，不适用于触控板。',
    });
  }, [updateResult]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={4}>macOS 触控板震动可行性测试</Title>
      <Paragraph type="secondary">
        此页面测试在网页端触发 MacBook 触控板/妙控板震动的各种方法。
        关键结论：<Text strong>目前没有标准 Web API 能在桌面浏览器上触发触控板震动</Text>。
        只有 Electron/Tauri 原生模块或 Safari hack 可能实现。
      </Paragraph>

      <Divider />

      {/* 测试项目列表 */}
      <List
        dataSource={results}
        renderItem={(item, idx) => (
          <List.Item
            actions={[
              <Button
                key="test"
                size="small"
                onClick={() => {
                  const actions = [
                    testVibrateSupport,
                    testVibrateActual,
                    startForceTouchMonitor,
                    testHapticHack,
                    testGamepadHaptics,
                  ];
                  actions[idx]?.();
                }}
              >
                测试
              </Button>,
            ]}
          >
            <List.Item.Meta
              avatar={
                item.status === 'pass' ? (
                  <CheckCircleOutlined style={{ color: 'var(--color-success)', fontSize: 20 }} />
                ) : item.status === 'fail' ? (
                  <CloseCircleOutlined style={{ color: 'var(--color-danger)', fontSize: 20 }} />
                ) : item.status === 'testing' ? (
                  <ThunderboltOutlined style={{ color: 'var(--color-warning)', fontSize: 20 }} />
                ) : (
                  <QuestionCircleOutlined style={{ color: 'var(--text-tertiary)', fontSize: 20 }} />
                )
              }
              title={item.label}
              description={item.detail}
            />
          </List.Item>
        )}
      />

      <Divider />

      {/* Force Touch 实时压力条 */}
      <Card size="small" title="Force Touch 实时压力检测 (Safari Only)" style={{ marginTop: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Space>
            <Text>监听状态:</Text>
            <Tag color={forceTouchActive ? 'processing' : 'default'}>
              {forceTouchActive ? '监听中' : '未启动'}
            </Tag>
            <Text>webkitForce:</Text>
            <Tag color={forceTouchLevel > 0.5 ? 'blue' : 'default'}>
              {forceTouchLevel.toFixed(3)}
            </Tag>
          </Space>
          <div
            style={{
              width: '100%',
              height: 20,
              background: 'var(--canvas)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, forceTouchLevel * 100)}%`,
                height: '100%',
                background: 'var(--color-primary)',
                transition: 'width 0.05s linear',
              }}
            />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Force Touch 事件阈值：WEBKIT_FORCE_AT_MOUSE_DOWN ≈ 1.0，WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN ≈ 2.0
          </Text>
        </Space>
      </Card>

      {/* 结论 */}
      <Alert
        type="info"
        showIcon
        style={{ marginTop: 24 }}
        message="可行性结论"
        description={
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 2 }}>
            <li>
              <Text code>navigator.vibrate()</Text> — ❌ macOS 全浏览器不支持（仅 Android Chrome）
            </li>
            <li>
              Force Touch 事件 (<Text code>webkitmouseforce*</Text>) — ⚠️ 只读，可检测按压力度，
              不可主动触发震动
            </li>
            <li>
              Safari hidden switch hack — ⚠️ 可能有效，但依赖 iOS 18+ 的特定行为，非标准 API
            </li>
            <li>
              <Text strong>最佳方案：</Text>Electron +
              <Text code>@deepkolos/electron-trackpad-utils</Text> 或 Tauri +
              <Text code>tauri-plugin-macos-haptics</Text>
            </li>
            <li>
              W3C 正在讨论桌面 Haptics API（<Text code>WICG/proposals/issues/262</Text>），
              暂无实现时间表
            </li>
          </ul>
        }
      />
    </div>
  );
}