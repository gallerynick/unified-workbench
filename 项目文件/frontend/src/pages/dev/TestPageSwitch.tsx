import { LockOutlined } from '@ant-design/icons';
import { Input, Segmented, Select } from 'antd';
import { useState } from 'react';
import styles from './TestPageSwitch.module.css';

/** 组合样式类名，过滤空值 */
function cx(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(' ');
}

interface SwitchProps {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** 无障碍名称 */
  label: string;
}

/**
 * 开关：状态图形（通=竖线 / 断=圆环）画在轨道上，滑块滑过去把它盖住；
 * 滑块内部不放任何内容；加载时由滑块上的高光来回扫表示。
 */
function Switch({ checked, onChange, disabled, loading, size = 'md', label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={loading ? true : undefined}
      disabled={disabled}
      className={cx(
        styles.switch,
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        loading && styles.isLoading,
      )}
      onClick={() => onChange?.(!checked)}
    >
      <span className={cx(styles.glyph, styles.glyphOn)} aria-hidden="true">
        <span className={styles.glyphBar} />
      </span>
      <span className={cx(styles.glyph, styles.glyphOff)} aria-hidden="true">
        <span className={styles.glyphRing} />
      </span>
      <span className={styles.thumb}>
        {disabled ? <LockOutlined className={styles.lockIcon} /> : null}
      </span>
    </button>
  );
}

/**
 * 开关样式验证分区（第四版）
 * 全站统一 I/O 图形（通=竖线 / 断=圆环），不提供文字开关；
 * 加载由「滑块单向扫光 + 描边绕行亮光」表示，不用转圈图标。
 */
export default function SwitchStyleSection() {
  const [main, setMain] = useState<boolean>(true);
  const [compact, setCompact] = useState<boolean>(true);
  const [large, setLarge] = useState<boolean>(true);
  const [debugMode, setDebugMode] = useState<boolean>(true);
  const [maintenance, setMaintenance] = useState<boolean>(false);
  const [autoLock, setAutoLock] = useState<boolean>(true);
  const [view, setView] = useState<string>('周');

  return (
    <div className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>开关样式</h1>
          <p className={styles.lead}>
            统一形态：状态图形画在轨道上，滑块滑过去把它盖住 —— 开时露出左侧竖线（通），
            关时露出右侧圆环（断）。滑块内部不放内容；加载时滑块上有单向扫光，另有一段亮光沿描边绕行。
            关 = 输入框描边灰，开 = 交互蓝。
          </p>
        </header>

        {/* ── 基线对照 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>基线对照</span>
            <span className={styles.groupNote}>
              输入框 / 下拉 / 滑动选择框 / 开关 / 按钮 同一行，圆角与底色同一套语言
            </span>
          </div>
          <div className={styles.baseline}>
            <Input placeholder="输入框" style={{ width: 132 }} />
            <Select
              defaultValue="选项"
              style={{ width: 96 }}
              options={[{ value: '选项', label: '选项' }]}
            />
            <Segmented
              options={['日', '周', '月']}
              value={view}
              onChange={(v) => setView(String(v))}
            />
            <Switch checked={false} onChange={() => undefined} label="对照开关（关）" />
            <Switch checked onChange={() => undefined} label="对照开关（开）" />
            <button type="button" className={styles.inlineAction}>
              默认按钮
            </button>
          </div>
        </section>

        {/* ── 1. 两态 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>1. 两态</span>
            <span className={styles.groupNote}>
              关：灰轨道 + 右侧圆环；开：蓝轨道 + 左侧竖线。底色、位置、图形三层信号同时给出
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>关 → 开</span>
            <Switch checked={false} onChange={() => undefined} label="关状态" />
            <Switch checked={main} onChange={setMain} label="开状态" />
          </div>
        </section>

        {/* ── 2. 尺寸 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>2. 尺寸</span>
            <span className={styles.groupNote}>
              紧凑 44×24 / 默认 56×32（与输入框同高）/ 大 68×38，滑块四周留 3px
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>紧凑</span>
            <Switch size="sm" checked={compact} onChange={setCompact} label="紧凑开关" />
            <Switch size="sm" checked={false} onChange={() => undefined} label="紧凑开关（关）" />
            <span className={styles.rowLabel}>默认</span>
            <Switch checked={main} onChange={setMain} label="默认开关" />
            <Switch checked={false} onChange={() => undefined} label="默认开关（关）" />
            <span className={styles.rowLabel}>大</span>
            <Switch size="lg" checked={large} onChange={setLarge} label="大号开关" />
            <Switch size="lg" checked={false} onChange={() => undefined} label="大号开关（关）" />
          </div>
        </section>

        {/* ── 3. 状态 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>3. 状态</span>
            <span className={styles.groupNote}>
              禁用整体降透明并去投影；加载时滑块单向扫光 + 描边绕行亮光，轨道图形淡出
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowLabel}>禁用</span>
            <Switch checked={false} disabled label="禁用（关）" />
            <Switch checked disabled label="禁用（开）" />
            <span className={styles.rowLabel}>加载</span>
            <Switch checked loading label="加载中（开位置）" />
            <Switch checked={false} loading label="加载中（关位置）" />
          </div>
        </section>

        {/* ── 4. 设置行 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>4. 设置行</span>
            <span className={styles.groupNote}>开关最常见的落位：左侧标题 + 说明，右侧开关</span>
          </div>
          <div className={styles.settingList}>
            <div className={styles.settingRow}>
              <div className={styles.settingText}>
                <span className={styles.settingLabel}>调试模式</span>
                <span className={styles.settingDesc}>开启后可访问开发测试页</span>
              </div>
              <Switch checked={debugMode} onChange={setDebugMode} label="调试模式" />
            </div>
            <div className={styles.settingRow}>
              <div className={styles.settingText}>
                <span className={styles.settingLabel}>维护模式</span>
                <span className={styles.settingDesc}>开启后普通成员无法进入系统</span>
              </div>
              <Switch checked={maintenance} onChange={setMaintenance} label="维护模式" />
            </div>
            <div className={styles.settingRow}>
              <div className={styles.settingText}>
                <span className={styles.settingLabel}>闲置自动锁定</span>
                <span className={styles.settingDesc}>长时间无操作后自动锁定页面</span>
              </div>
              <Switch checked={autoLock} onChange={setAutoLock} label="闲置自动锁定" />
            </div>
          </div>
        </section>

        {/* ── 5. 与按钮并排 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>5. 与按钮并排</span>
            <span className={styles.groupNote}>开关不抢按钮的视觉重量，两者可同排</span>
          </div>
          <div className={styles.row}>
            <Switch checked={main} onChange={setMain} label="并排开关" />
            <button type="button" className={styles.inlineAction}>
              立即同步
            </button>
            <button type="button" className={styles.inlineAction}>
              查看记录
            </button>
          </div>
        </section>

        {/* ── 规格速查 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>规格速查</span>
            <span className={styles.groupNote}>尺寸与颜色全部取自 token.css</span>
          </div>
          <dl className={styles.spec}>
            <dt>唯一形态</dt>
            <dd>I/O 图形（通=竖线 / 断=圆环），不提供文字开关，滑块内不放内容</dd>
            <dt>尺寸</dt>
            <dd>默认 56×32（与输入框同高）/ 紧凑 44×24 / 大 68×38</dd>
            <dt>轨道·关</dt>
            <dd>var(--border-primary)（输入框描边色）</dd>
            <dt>轨道·开</dt>
            <dd>var(--color-info)（输入框焦点蓝）</dd>
            <dt>滑块</dt>
            <dd>var(--canvas) + var(--shadow-sm)，圆角 var(--rounded-xs) 5px，四周留 3px</dd>
            <dt>轨道圆角</dt>
            <dd>var(--rounded-sm) 8px，与输入框、按钮一致</dd>
            <dt>图形</dt>
            <dd>竖线 0.2em × 0.9em / 圆环 0.8em、描边 0.14em，画在轨道上、滑块之下</dd>
            <dt>图形配色</dt>
            <dd>开启侧 var(--btn-primary-text) 白；关闭侧 var(--ink-muted-80)</dd>
            <dt>加载</dt>
            <dd>
              滑块上高光 1.1s 来回扫（linear-gradient + alternate），轨道图形降到 35%
              透明，控件不可点
            </dd>
            <dt>位移</dt>
            <dd>translateX(轨道宽 − 滑块 − 6px)，var(--anim-normal) ease-in-out</dd>
          </dl>
        </section>

        {/* ── 使用建议 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>使用建议</span>
          </div>
          <ul className={styles.notes}>
            <li>全站只用这一种开关形态，不再出现文字开关或空白滑块。</li>
            <li>开关只用于立即生效的设置；需要提交后才生效的选项用复选或下拉。</li>
            <li>无可见文字，必须有 aria-label；状态用 role=switch + aria-checked 表达。</li>
            <li>同一设置页统一用默认尺寸，一排里不要出现两种尺寸。</li>
            <li>加载中不允许重复点击，也不要在加载时切换尺寸或位置。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
