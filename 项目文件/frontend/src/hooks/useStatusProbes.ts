import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getToken } from '../utils/auth';
import { APP_VERSION } from '../utils/version';
import { getIdleMsLeft } from './useIdleTimer';
import { useStatusDemoIssues } from './useStatusDemo';

export type StatusLevel = 'warning' | 'critical';

export interface StatusIssue {
  id: string;
  level: StatusLevel;
  text: string;
}

/** /system/status 返回的并发登录统计（F1） */
export interface ConcurrentInfo {
  other_session_count: number;
  other_ip_count: number;
  other_device_count: number;
}

// ── 阈值 ────────────────────────────────────────────────────────
// 与服务端保持一致（backend/app/api/status.py），改动需双向同步
const POLL_INTERVAL_MS = 60_000;        // 巡检周期
const HEALTH_FAIL_THRESHOLD = 3;        // A1：连续失败次数
const FLAP_GUARD = 2;                   // A2/C2：连续 N 次异常才提示、N 次正常才恢复
const WS_GRACE_MS = 10_000;             // A3：断开通告宽限期
const LATENCY_WINDOW = 5;               // A2：采样窗口
const LATENCY_THRESHOLD_MS = 800;       // A2：延迟阈值
const CLOCK_SKEW_MS = 5 * 60 * 1000;    // D2：时间偏差
const LOCK_WARN_MS = 30_000;            // E1：自动锁定预警
const IDLE_TICK_MS = 1_000;             // E1：倒计时轮询粒度
// F1：其他 IP 数或其他设备数达到该值即提示。后端已按 CONCURRENT_RECENT_MINUTES
// （session_activity.py，30 分钟）过滤陈旧会话，前端无需再做时间判断，只需阈值比较。
const CONCURRENT_MIN = 1;
// F1 独立轮询周期。并发登录属安全语义，需要秒级响应；
// 服务状态（C3/C4/C5）变化缓慢，仍走 60s 的全量状态轮询。
const CONCURRENT_POLL_MS = 10_000;

const CRITICAL = 'critical' as const;
const WARNING = 'warning' as const;

const NO_CACHE: Record<string, string> = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
};

// ── B3 公网访问判定 ─────────────────────────────────────────────
// 规则见《待办计划/状态指示设计规格.md》3.3：
// 域名一律按公网处理（浏览器无法解析 DNS，内网 DNS 部署概率低，宁可提示不漏判）。
function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost') return true;

  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  // IPv6 字面量经 URL 解析后不带方括号
  if (hostname === '::1') return true;
  if (/^f[cd][0-3]/.test(hostname)) return true; // fc00::/7 ULA
  if (/^fe[89ab]/.test(hostname)) return true;   // fe80::/10 链路本地
  return false;
}

/** 登录前即可判定的本地项：B1 / B2 / B3 / D3 */
function detectLocal(): StatusIssue[] {
  const { protocol, hostname } = window.location;
  const out: StatusIssue[] = [];

  if (window.isSecureContext === false) {
    // 非安全上下文：传输明文，且 getUserMedia / WebAuthn / Notification 全部失效
    out.push({ id: 'b2-insecure', level: CRITICAL, text: '非安全环境，直播等能力不可用' });
  } else if (protocol === 'http:' && hostname !== 'localhost') {
    // 兜底：极老浏览器不实现 isSecureContext
    out.push({ id: 'b1-http', level: WARNING, text: '未启用 HTTPS' });
  }

  if (!isPrivateHost(hostname)) {
    out.push({ id: 'b3-public', level: WARNING, text: '正在通过公网访问' });
  }

  const missing: string[] = [];
  if (typeof WebSocket === 'undefined') missing.push('WebSocket');
  if (!navigator.mediaDevices) missing.push('媒体设备');
  if (typeof Notification === 'undefined') missing.push('通知');
  if (typeof PublicKeyCredential === 'undefined') missing.push('WebAuthn');
  if (missing.length > 0) {
    out.push({ id: 'd3-browser', level: WARNING, text: '浏览器能力不完整' });
  }

  return out;
}

// ── 网络探测 ────────────────────────────────────────────────────
// 统一用裸 fetch 而非 utils/request：探测不应触发 401 刷新与跳转登录。

interface HealthResult {
  ok: boolean;
  latency: number;
  version: string | null;
  serverTime: number | null;
}

async function probeHealth(): Promise<HealthResult> {
  const t0 = performance.now();
  try {
    // cache: 'no-store' 是必须的。只发 no-cache 请求头的语义是「重新校验」，
    // 浏览器仍可能命中磁盘缓存；而后端 /api/v1/health 不带任何 Cache-Control，
    // 断网后浏览器可能直接返回缓存副本 → 探测「成功」→ failCount 被清零，
    // 网络告警永远不出现。
    const res = await fetch('/api/v1/health', { headers: NO_CACHE, cache: 'no-store' });
    // 502/503/504 来自 nginx，语义是「上游（后端）连不上」，等价于后端不可达；
    // 其余非 2xx 说明对端已经回包、连接是通的，不能判成「网络已断开」——
    // 否则后端一次 500 就会被 A1 报成断网，而且 failCount 要 3 轮才清零，双向闪烁。
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return { ok: false, latency: -1, version: null, serverTime: null };
    }
    const body = (await res.json().catch(() => ({}))) as { data?: { version?: string; server_time?: string } };
    const data = body.data ?? {};
    return {
      ok: true,
      latency: performance.now() - t0,
      version: data.version ?? null,
      serverTime: data.server_time ? Date.parse(data.server_time) : null,
    };
  } catch {
    return { ok: false, latency: -1, version: null, serverTime: null };
  }
}

async function probeDb(): Promise<boolean | null> {
  try {
    const res = await fetch('/api/v1/health/db', { headers: NO_CACHE, cache: 'no-store' });
    // 只有 HTTP 2xx 且 body 明确给出 unhealthy 才算一轮证据。非 2xx 不能证明
    // 「数据库异常」：既可能是 nginx 502（后端在重启），也可能是 get_db 依赖
    // 解析失败导致的 500（后端自身出错）。都返回 null，交给 flapGate 的 null
    // 分支既不计入也不清零——否则一次后端重启就被报成「数据服务暂时不可用」。
    if (!res.ok) return null;
    const body = (await res.json().catch(() => ({}))) as { data?: { status?: string } };
    return body.data?.status !== 'unhealthy';
  } catch {
    // 传输层失败无法区分「后端不可达」与「DB 异常」，交给 A1 判定。
    // 这里若返回 false，一次网络抖动就会被当成「数据服务暂时不可用」
    // 显示一整个巡检周期，然后下次成功又消失——指示器反复闪。
    return null;
  }
}

async function probeMaintenance(): Promise<boolean | null> {
  try {
    const res = await fetch('/api/v1/system/site-config', { headers: NO_CACHE, cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { maintenance_mode?: boolean } };
    return body.data?.maintenance_mode === true;
  } catch {
    return null;
  }
}

async function probeStatus(): Promise<{
  services?: Record<string, string>;
  concurrent?: ConcurrentInfo;
} | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/v1/system/status', {
      headers: { ...NO_CACHE, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { services?: Record<string, string>; concurrent?: ConcurrentInfo };
    };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/** F1 专用：仅取并发会话统计。
 *
 * 走独立的轻量端点，不触发 /system/status 的存储写入探针与推流连通性探测，
 * 因此可以按 CONCURRENT_POLL_MS 高频调用。
 */
async function probeConcurrent(): Promise<ConcurrentInfo | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/v1/me/concurrent', {
      headers: { ...NO_CACHE, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: ConcurrentInfo };
    return body.data ?? null;
  } catch {
    return null;
  }
}

/**
 * 服务级抖动抑制：返回本轮是否应告警。
 *
 * bad === null 表示本轮探测本身失败（网络抖动、令牌过期、端点 5xx），既不计入
 * 也不清零：计入会让一次网络抖动被当成服务故障并挂一整个巡检周期；清零会让
 * 故障期恰逢网络抖动时故障被掩盖。要求连续 FLAP_GUARD 轮异常才告警，代价是
 * 真实故障晚报约一个巡检周期。
 */
function flapGate(ref: { current: number }, bad: boolean | null): boolean {
  if (bad === null) return false;
  if (bad) {
    ref.current += 1;
    return ref.current >= FLAP_GUARD;
  }
  ref.current = 0;
  return false;
}

/** 内容比较：id/level/text 三元组，顺序敏感。用于避免同内容新数组触发重渲染 */
function sameIssues(a: StatusIssue[], b: StatusIssue[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return !!y && x.id === y.id && x.level === y.level && x.text === y.text;
  });
}

// ── F1 实时推送订阅 ─────────────────────────────────────────────────
// 并发会话集合的变化（登录 / 登出 / 注销设备）都是服务端已知事件，
// 由 WebSocket 推送 session_alert（见 backend/app/core/websocket.py 的
// SESSION_ALERT）。收到后立即重跑探测，而不是等下一个轮询周期——
// 这就是「另一端登出后本端提示立刻消失」的实现。
//
// 10s 轮询仍保留：推送可能丢失（连接恰好在推送瞬间断开），轮询负责兜底对账。
// 推送负载为空，前端以服务端计数为准，不信任客户端上报。
type ConcurrentListener = () => void;
const concurrentListeners = new Set<ConcurrentListener>();

/** 订阅并发会话变化，返回取消订阅函数。 */
export function subscribeConcurrentChange(fn: ConcurrentListener): () => void {
  concurrentListeners.add(fn);
  return () => {
    concurrentListeners.delete(fn);
  };
}

/** 由 useWebSocket 在收到 session_alert 时调用。 */
export function emitConcurrentChange(): void {
  concurrentListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // 单个监听器异常不影响其他监听器
    }
  });
}

/**
 * 汇总状态异常列表，供 StatusIndicator 渲染。
 *
 * @param authed 是否处于登录态。false 时仅返回登录前可判定的 10 项，
 *               跳过 A3 / C3 / C4 / C5 / E1（需登录态或服务级探测）。
 * @param wsConnected WebSocket 实时通道是否连通（A3）。
 */
export function useStatusProbes(options: {
  authed: boolean;
  wsConnected: boolean;
}): StatusIssue[] {
  const { authed, wsConnected } = options;
  const [probeIssues, setProbeIssues] = useState<StatusIssue[]>(() => detectLocal());
  const [lockWarning, setLockWarning] = useState(false);
  // A3：WebSocket 断开超过宽限期才通告（false 初始态与短暂重连不提示）
  const [wsDown, setWsDown] = useState(false);
  // F1 并发登录：独立轮询周期，与 60s 的服务状态探测解耦
  const [concurrentIssues, setConcurrentIssues] = useState<StatusIssue[]>([]);
  // A1 交叉校验用：上一次 /health 探测结果，null = 尚未探测过
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);

  // 演示模式（?status_demo=...）：非空时覆盖真实探测结果，null 表示关闭
  const demoIssues = useStatusDemoIssues();

  const failCountRef = useRef(0);
  const rttRef = useRef<number[]>([]);
  // C2 / C3 / C4 / C5 抖动抑制：连续异常计数，语义见 flapGate
  const dbBadCountRef = useRef(0);
  const storageBadCountRef = useRef(0);
  const streamBadCountRef = useRef(0);
  const tasksBadCountRef = useRef(0);
  // A3 断开累计时长
  const wsDownMsRef = useRef(0);
  // 供 1s tick 读最新连接状态；直接依赖 wsConnected 会让 effect 重启、计数清零
  const wsConnectedRef = useRef(wsConnected);
  useEffect(() => {
    wsConnectedRef.current = wsConnected;
  }, [wsConnected]);

  // A1：浏览器已知离线。navigator.onLine 在断网瞬间即变 false，
  // 不必等连续 3 次巡检失败（最长 3 分钟）才告警。
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => {
      setBrowserOnline(true);
      // 恢复后重新计数，避免离线期积累的失败数在重连后立刻误报
      failCountRef.current = 0;
    };
    const goOffline = () => setBrowserOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const compute = useCallback(async (needServices: boolean): Promise<StatusIssue[]> => {
    const out: StatusIssue[] = detectLocal();

    // A1 / A2 / D1 / D2
    const health = await probeHealth();
    setBackendReachable(health.ok);
    if (!health.ok) {
      failCountRef.current += 1;
      if (failCountRef.current >= HEALTH_FAIL_THRESHOLD) {
        out.push({ id: 'a1-backend', level: CRITICAL, text: '网络已断开' });
      }
      return out; // 后端不可达时无需再探其他项
    }
    failCountRef.current = 0;

    rttRef.current = [...rttRef.current, health.latency].slice(-LATENCY_WINDOW);
    // 不能用 Math.max：窗口里任意一次慢请求就会点亮告警，且要等 5 轮才熄灭。
    // 改为窗口内超阈值样本达到 FLAP_GUARD 个才判定网络劣化。
    const slowSamples = rttRef.current.filter((ms) => ms > LATENCY_THRESHOLD_MS).length;
    if (slowSamples >= FLAP_GUARD) {
      out.push({ id: 'a2-latency', level: WARNING, text: '网络延迟较高' });
    }

    if (health.version !== null && health.version !== APP_VERSION) {
      out.push({ id: 'd1-version', level: CRITICAL, text: '版本不匹配，请刷新' });
    }

    if (health.serverTime !== null) {
      const skew = Math.abs(Date.now() - health.serverTime);
      if (skew > CLOCK_SKEW_MS) {
        out.push({ id: 'd2-clock', level: WARNING, text: '本机时间偏差超过 5 分钟' });
      }
    }

    // C1 / C2 —— 公开端点，登录前后都探
    const [maintenance, dbOk] = await Promise.all([probeMaintenance(), probeDb()]);
    if (maintenance) {
      out.push({ id: 'c1-maintenance', level: CRITICAL, text: '系统维护中' });
    }
    // dbOk === null 表示本轮探测本身失败，flapGate 的 null 分支既不计入也不清零
    if (flapGate(dbBadCountRef, dbOk === false)) {
      out.push({ id: 'c2-db', level: CRITICAL, text: '数据服务暂时不可用' });
    }

    // C3 / C4 / C5 —— 需登录态，共用同一次 /system/status 请求。
    // F1 并发登录不在此处：它走独立的 /me/concurrent 端点与 10s 周期，
    // 见下方同名 useEffect。
    if (needServices) {
      const status = await probeStatus();
      const services = status?.services;
      if (services) {
        if (flapGate(storageBadCountRef, services['storage'] === 'unavailable')) {
          out.push({ id: 'c3-storage', level: CRITICAL, text: '文件服务暂时不可用' });
        }
        if (flapGate(streamBadCountRef, services['stream'] === 'unavailable')) {
          out.push({ id: 'c4-stream', level: WARNING, text: '直播服务暂时不可用' });
        }
        // tasks 的 stale 判定（backend/app/api/status.py 的 _check_tasks_sync）
        // 只看 last_beat_at 单点时间戳：机器长时间睡眠、容器重启或系统自动校时
        // 让时钟向前跳过 5 分钟，就会被判成「任务挂了」，而 beat 下一跳（≤60s）
        // 即自愈。抖动抑制把这类假象压掉。
        if (flapGate(tasksBadCountRef, services['tasks'] === 'unavailable')) {
          out.push({ id: 'c5-tasks', level: WARNING, text: '提醒服务暂时不可用' });
        }
      }
    }

    return out;
  }, []);

  // 主探测周期
  useEffect(() => {
    let cancelled = false;
    const runCycle = async () => {
      const next = await compute(authed);
      if (cancelled) return;
      // 内容不变时复用旧数组：否则每个巡检周期都换引用，StatusIndicator 里
      // sorted 重算、轮播索引被重置，指示器视觉上跳一下。
      setProbeIssues((prev) => (sameIssues(prev, next) ? prev : next));
    };
    void runCycle();
    const timer = setInterval(() => void runCycle(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [authed, compute]);

  // F1 并发登录：实时推送 + 10s 轮询兜底。
  // 服务端在登录 / 登出 / 注销设备后推送 session_alert，这里收到立即重跑，
  // 所以另一端登出后本端提示在一次网络往返内消失，不必等轮询周期。
  // 轮询仍保留：推送可能丢失（连接在推送瞬间断开），负责兜底对账。
  // 探测失败时保留上一次结果——瞬时网络抖动不应让告警消失。
  useEffect(() => {
    if (!authed) {
      setConcurrentIssues([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const info = await probeConcurrent();
      if (cancelled || !info) return;
      const next: StatusIssue[] =
        info.other_ip_count >= CONCURRENT_MIN ||
        info.other_device_count >= CONCURRENT_MIN
          ? [{ id: 'f1-concurrent', level: WARNING, text: '账号在其他设备登录' }]
          : [];
      setConcurrentIssues((prev) => (sameIssues(prev, next) ? prev : next));
    };
    const kick = () => void run();
    void run();
    const timer = setInterval(kick, CONCURRENT_POLL_MS);
    const unsubscribe = subscribeConcurrentChange(kick);
    return () => {
      cancelled = true;
      clearInterval(timer);
      unsubscribe();
    };
  }, [authed]);

  // E1 自动锁定倒计时 + A3 断开通告宽限期，共用 1s tick
  // （布尔值不变时 React 会跳过重渲染）
  useEffect(() => {
    if (!authed) {
      setLockWarning(false);
      setWsDown(false);
      wsDownMsRef.current = 0;
      return;
    }
    const tick = () => {
      const left = getIdleMsLeft();
      setLockWarning(left !== null && left <= LOCK_WARN_MS);
      wsDownMsRef.current = wsConnectedRef.current
        ? 0
        : wsDownMsRef.current + IDLE_TICK_MS;
      setWsDown(wsDownMsRef.current > WS_GRACE_MS);
    };
    tick();
    const timer = setInterval(tick, IDLE_TICK_MS);
    return () => clearInterval(timer);
  }, [authed]);

  // 合并即时项：A1（浏览器离线且后端探测确认）、A3、E1。
  // 按 id 去重，避免同一 id 重复展示。
  const merged = useMemo(() => {
    const out: StatusIssue[] = [];
    const seen = new Set<string>();
    const add = (issue: StatusIssue): void => {
      if (seen.has(issue.id)) return;
      seen.add(issue.id);
      out.push(issue);
    };
    // 浏览器离线信号只有后端也不可达时才采信。navigator.onLine 在 Chromium 系
    // 由 network service 全局判定，本机 LAN 与后端都正常时也可能为 false，
    // 且 online 事件不一定会补发——无条件采信会留下一条永不消失的 CRITICAL
    // 误报。后端可达即证伪；后端首次探测失败即提示（早于 3 次阈值），持续失败
    // 再由 a1-backend 升级为 CRITICAL。
    if (!browserOnline && backendReachable === false) {
      add({ id: 'a1-browser', level: WARNING, text: '浏览器报告离线' });
    }
    probeIssues.forEach(add);
    concurrentIssues.forEach(add);
    if (authed && wsDown) {
      add({ id: 'a3-ws', level: WARNING, text: '实时提醒不可用' });
    }
    if (authed && lockWarning) {
      add({ id: 'e1-lock', level: WARNING, text: '即将自动锁定' });
    }
    return out;
  }, [probeIssues, concurrentIssues, authed, wsDown, lockWarning, browserOnline, backendReachable]);

  // 演示模式优先；关闭时退回真实探测结果
  return demoIssues ?? merged;
}
