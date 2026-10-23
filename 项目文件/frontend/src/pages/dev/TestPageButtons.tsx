import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LoadingOutlined,
  LockOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { Input, Segmented, Select } from 'antd';
import { useState } from 'react';
import styles from './TestPageButtons.module.css';

/** 组合样式类名，过滤空值 */
function cx(...names: Array<string | false | undefined>): string {
  return names.filter(Boolean).join(' ');
}

const VIEW_OPTIONS = ['日', '周', '月'];

/**
 * 按钮样式验证分区
 * 目标：把按钮的底色/描边/圆角/高度对齐现有输入框与滑动选择框，
 * 覆盖「纯图标」「开关型」「带文字」三类，深浅色共用同一套 token。
 */
export default function ButtonStyleSection() {
  const [starred, setStarred] = useState<boolean>(false);
  const [locked, setLocked] = useState<boolean>(false);
  const [autoSave, setAutoSave] = useState<boolean>(true);
  const [view, setView] = useState<string>('周');

  return (
    <div className={styles.section}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <h1 className={styles.title}>按钮样式</h1>
          <p className={styles.lead}>
            按钮的描边、圆角、高度、文字规格与输入框完全一致；开关型的按下态沿用滑动选择框的选中色。
            三类形态：纯图标按钮、开关型按钮、带文字按钮。
          </p>
        </header>

        {/* ── 基线对照 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>基线对照</span>
            <span className={styles.groupNote}>
              输入框 / 下拉 / 分段控件 / 按钮 四者同高（32px）、同圆角（8px）、同描边色
            </span>
          </div>
          <div className={styles.baseline}>
            <Input placeholder="输入框" style={{ width: 132 }} />
            <Select
              defaultValue="选项"
              style={{ width: 96 }}
              options={[{ value: '选项', label: '选项' }]}
            />
            <Segmented options={VIEW_OPTIONS} value={view} onChange={(v) => setView(String(v))} />
            <button type="button" className={styles.btn}>
              默认按钮
            </button>
            <button type="button" className={cx(styles.btn, styles.primary)}>
              主行动
            </button>
          </div>
        </section>

        {/* ── 1. 纯图标按钮 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>1. 纯图标按钮</span>
            <span className={styles.groupNote}>按钮内只有图标、没有文字，正方形，宽度等于高度</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>轻量</span>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.ghost)}
              aria-label="更多"
            >
              <MoreOutlined />
            </button>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.ghost)}
              aria-label="刷新"
            >
              <ReloadOutlined />
            </button>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.ghost)}
              aria-label="通知"
            >
              <BellOutlined />
            </button>
            <span className={styles.groupNote}>工具栏、列表行内，默认无描边</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>描边</span>
            <button type="button" className={cx(styles.btn, styles.iconBtn)} aria-label="设置">
              <SettingOutlined />
            </button>
            <button type="button" className={cx(styles.btn, styles.iconBtn)} aria-label="编辑">
              <EditOutlined />
            </button>
            <button type="button" className={cx(styles.btn, styles.iconBtn)} aria-label="下载">
              <DownloadOutlined />
            </button>
            <span className={styles.groupNote}>需要被看见的独立操作</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>按下</span>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.on)}
              aria-label="已收藏"
            >
              <StarOutlined />
            </button>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.danger)}
              aria-label="删除"
            >
              <DeleteOutlined />
            </button>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn)}
              aria-label="不可用"
              disabled
            >
              <SaveOutlined />
            </button>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.loading)}
              aria-label="加载中"
            >
              <LoadingOutlined spin />
            </button>
            <span className={styles.groupNote}>按下=选中色；最右两个为禁用与加载</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>尺寸</span>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.sm, styles.ghost)}
              aria-label="更多（紧凑）"
            >
              <MoreOutlined />
            </button>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.sm)}
              aria-label="编辑（紧凑）"
            >
              <EditOutlined />
            </button>
            <button
              type="button"
              className={cx(styles.btn, styles.iconBtn, styles.lg)}
              aria-label="编辑（大）"
            >
              <EditOutlined />
            </button>
            <span className={styles.groupNote}>紧凑 28px / 默认 32px / 大 36px</span>
          </div>
        </section>

        {/* ── 2. 开关型按钮 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>2. 开关型按钮</span>
            <span className={styles.groupNote}>
              表示开/关两种状态，按下态用底色区分（color-info-bg +
              color-info），与分段控件的选中态同源
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>图标开关</span>
            <button
              type="button"
              aria-pressed={starred}
              aria-label="收藏"
              className={cx(styles.btn, styles.iconBtn, starred ? styles.on : styles.ghost)}
              onClick={() => setStarred((v) => !v)}
            >
              <StarOutlined />
            </button>
            <button
              type="button"
              aria-pressed={locked}
              aria-label="锁定"
              className={cx(styles.btn, styles.iconBtn, locked ? styles.on : styles.ghost)}
              onClick={() => setLocked((v) => !v)}
            >
              <LockOutlined />
            </button>
            <span className={styles.groupNote}>
              已收藏：{starred ? '是' : '否'}，已锁定：{locked ? '是' : '否'}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>文字开关</span>
            <button
              type="button"
              aria-pressed={autoSave}
              className={cx(styles.btn, autoSave ? styles.on : undefined)}
              onClick={() => setAutoSave((v) => !v)}
            >
              {autoSave ? <CheckOutlined /> : null}
              自动保存
            </button>
            <button
              type="button"
              aria-pressed={!autoSave}
              className={cx(styles.btn, !autoSave ? styles.on : undefined)}
              onClick={() => setAutoSave((v) => !v)}
            >
              手动保存
            </button>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>互斥组</span>
            <button
              type="button"
              aria-pressed={view === '日'}
              className={cx(styles.btn, view === '日' ? styles.on : undefined)}
              onClick={() => setView('日')}
            >
              日
            </button>
            <button
              type="button"
              aria-pressed={view === '周'}
              className={cx(styles.btn, view === '周' ? styles.on : undefined)}
              onClick={() => setView('周')}
            >
              周
            </button>
            <button
              type="button"
              aria-pressed={view === '月'}
              className={cx(styles.btn, view === '月' ? styles.on : undefined)}
              onClick={() => setView('月')}
            >
              月
            </button>
            <span className={styles.groupNote}>同一时刻只有一项按下；纯切换仍以分段控件更合适</span>
          </div>
        </section>

        {/* ── 3. 带文字按钮 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>3. 带文字按钮</span>
            <span className={styles.groupNote}>
              文字 + 可选图标；静默态统一为中性描边，不再使用蓝色描边蓝字
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>默认</span>
            <button type="button" className={styles.btn}>
              取消
            </button>
            <button type="button" className={styles.btn}>
              查看详情
            </button>
            <button type="button" className={cx(styles.btn, styles.primary)}>
              <PlusOutlined />
              新建
            </button>
            <span className={styles.groupNote}>一个区块只出现一个实底主按钮</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>危险</span>
            <button type="button" className={styles.btn}>
              取消
            </button>
            <button type="button" className={cx(styles.btn, styles.danger)}>
              <DeleteOutlined />
              删除
            </button>
            <button type="button" className={cx(styles.btn, styles.dangerSolid)}>
              确认删除
            </button>
            <span className={styles.groupNote}>左为描边态，右为最终确认的实底态</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>文本</span>
            <button type="button" className={cx(styles.btn, styles.text)}>
              展开全部
            </button>
            <button type="button" className={cx(styles.btn, styles.text)}>
              查看记录
            </button>
            <span className={styles.groupNote}>无底无边，仅用于次级跳转</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>状态</span>
            <button type="button" className={styles.btn} disabled>
              不可用
            </button>
            <button type="button" className={cx(styles.btn, styles.primary, styles.loading)}>
              <LoadingOutlined spin />
              保存中
            </button>
            <span className={styles.groupNote}>禁用用文字与底色弱化，不走整体透明度</span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>尺寸</span>
            <button type="button" className={cx(styles.btn, styles.sm)}>
              紧凑
            </button>
            <button type="button" className={styles.btn}>
              默认
            </button>
            <button type="button" className={cx(styles.btn, styles.lg)}>
              大
            </button>
            <span className={styles.groupNote}>28 / 32 / 36</span>
          </div>
        </section>

        {/* ── 规格速查 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>规格速查</span>
            <span className={styles.groupNote}>全部取自 token.css，无硬编码色值</span>
          </div>
          <dl className={styles.spec}>
            <dt>高度</dt>
            <dd>var(--input-height) 32px（与输入框同高）；紧凑 28px、大 36px</dd>
            <dt>圆角</dt>
            <dd>var(--rounded-sm) 8px（与输入框、下拉、分段控件一致）</dd>
            <dt>描边</dt>
            <dd>var(--input-border) 1px var(--border-primary)，与输入框同色</dd>
            <dt>底色</dt>
            <dd>var(--input-bg)（浅色纯白 / 深色 --canvas）</dd>
            <dt>文字</dt>
            <dd>var(--ink)，14px / 400，字距 -0.224px</dd>
            <dt>悬停</dt>
            <dd>底色转 var(--bg-tertiary)，描边不变</dd>
            <dt>按下</dt>
            <dd>transform: var(--btn-active-scale) 缩放，不变色</dd>
            <dt>焦点</dt>
            <dd>2px var(--color-primary-focus) 外描边，offset 1px</dd>
            <dt>选中 / 开启</dt>
            <dd>var(--color-info-bg) 底 + var(--color-info) 字</dd>
            <dt>主行动</dt>
            <dd>var(--color-info) 实底 + var(--btn-primary-text) 字</dd>
            <dt>禁用</dt>
            <dd>var(--text-disabled) 字 + var(--bg-secondary) 底 + var(--border-secondary) 描边</dd>
            <dt>图标</dt>
            <dd>纯图标按钮正方形，图标 14px，与文字间距 var(--spacing-xxs) 4px</dd>
          </dl>
        </section>

        {/* ── 使用建议 ── */}
        <section className={styles.group}>
          <div className={styles.groupHead}>
            <span className={styles.groupName}>使用建议</span>
          </div>
          <ul className={styles.notes}>
            <li>
              同一区块只允许一个实底主按钮，其余用中性描边或文本按钮，层级靠底色而非颜色数量。
            </li>
            <li>
              纯图标按钮没有可见文字，必须带 aria-label（必要时加
              Tooltip），否则读屏与悬停都无法识别。
            </li>
            <li>开关型按钮用 aria-pressed 表达开/关，状态只靠底色区分，不额外加边框或阴影。</li>
            <li>危险操作默认走描边态，只有不可逆操作的最终确认才用实底红色。</li>
            <li>按钮不参与阴影系统：面板承载阴影，按钮本身保持平面。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
