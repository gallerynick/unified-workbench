/**
 * WHEP (WebRTC HTTP Egress Protocol) 客户端 — draft-ietf-wish-whep
 *
 * 通过 MediaMTX 的 WHEP 端点播放浏览器端 WebRTC 流。
 * 调用方提供 video 元素与完整 URL（含 /{streamKey}/whep），
 * 本类负责信令交换、ICE trickle 与自动重连。
 */

export type WhepState = 'idle' | 'connecting' | 'playing' | 'error' | 'reconnecting';

export interface WhepOptions {
  /** ICE 服务器配置，传递给 RTCPeerConnection */
  iceServers?: RTCIceServer[];
}

/** 重连参数 */
const RECONNECT_MAX_RETRIES = 5;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 8000;

/**
 * 从 SDP 中提取 ice-ufrag / ice-pwd 用于 ICE trickle PATCH 片段头。
 */
function extractIceCredentials(sdp: string): { ufrag: string; pwd: string } {
  const ufragMatch = sdp.match(/a=ice-ufrag:(.+)\r?\n/);
  const pwdMatch = sdp.match(/a=ice-pwd:(.+)\r?\n/);
  return {
    ufrag: ufragMatch?.[1] ?? '',
    pwd: pwdMatch?.[1] ?? '',
  };
}

export class WhepClient {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private _state: WhepState = 'idle';
  private iceUfrag = '';
  private icePwd = '';
  /** ICE candidates 在收到 resourceUrl 之前的缓冲区 */
  private pendingCandidates: RTCIceCandidate[] = [];
  /** 保存调用方传入的参数，供重连复用 */
  private savedWhepUrl: string | null = null;
  private savedVideoElement: HTMLVideoElement | null = null;
  private savedIceServers: RTCIceServer[] | undefined;

  /** 重连计数器与定时器 */
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- 公开回调 ----
  onStateChange: ((state: WhepState) => void) | null = null;
  onError: ((error: Error) => void) | null = null;

  get state(): WhepState {
    return this._state;
  }

  // ============================================================
  //  公开 API
  // ============================================================

  /**
   * 启动 WHEP 播放。
   * @param whepUrl      - WHEP 端点（如 http://localhost:8554/mystream/whep）
   * @param videoElement - 承载播放流的 <video> 元素
   * @param options      - 可选 ICE 服务器配置
   */
  async start(
    whepUrl: string,
    videoElement: HTMLVideoElement,
    options?: WhepOptions,
  ): Promise<void> {
    // 先停掉已有会话（含重连定时器）
    await this.stop();

    this.savedWhepUrl = whepUrl;
    this.savedVideoElement = videoElement;
    this.savedIceServers = options?.iceServers;
    this.reconnectAttempts = 0;

    await this.connect();
  }

  /**
   * 停止播放并释放所有资源。
   */
  async stop(): Promise<void> {
    // 取消重连定时器
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // DELETE resource URL（优雅拆除）
    if (this.resourceUrl) {
      await fetch(this.resourceUrl, { method: 'DELETE' }).catch(() => {
        /* 忽略网络错误 */
      });
    }

    await this.cleanup();
    this.setState('idle');
  }

  // ============================================================
  //  连接流程
  // ============================================================

  /**
   * 执行一次完整 WHEP 连接握手。
   */
  private async connect(): Promise<void> {
    const whepUrl = this.savedWhepUrl;
    const videoElement = this.savedVideoElement;
    if (!whepUrl || !videoElement) return;

    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      // 1. 创建 PeerConnection
      const config: RTCConfiguration = {
        bundlePolicy: 'max-bundle',
        iceServers: this.savedIceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
      };
      this.pc = new RTCPeerConnection(config);

      // 2. 添加 recvonly transceiver（video + audio）
      this.pc.addTransceiver('video', { direction: 'recvonly' });
      this.pc.addTransceiver('audio', { direction: 'recvonly' });

      // 3. 创建 SDP offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      const sdp = offer.sdp;
      if (!sdp) {
        throw new Error('createOffer 未产生 SDP');
      }

      // 记录 ICE credentials 供 trickle PATCH 用
      const creds = extractIceCredentials(sdp);
      this.iceUfrag = creds.ufrag;
      this.icePwd = creds.pwd;

      // 4. 注册事件
      this.pc.onicecandidate = (evt) => this.handleIceCandidate(evt);
      this.pc.ontrack = (evt) => this.handleTrack(evt);
      this.pc.onconnectionstatechange = () => this.handleConnectionStateChange();

      // 5. POST SDP offer → WHEP endpoint
      console.log('[WHEP] POST', whepUrl);
      const resourceUrl = await this.postOffer(whepUrl, sdp);
      console.log('[WHEP] POST OK, resourceUrl:', resourceUrl.location);

      // 6. 用 answer 设置 remote description
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: resourceUrl.answerSdp }),
      );

      this.resourceUrl = resourceUrl.location;

      // 连接成功时状态由 onconnectionstatechange 'connected' 驱动；
      // 若因 ICE trickle 延迟导致早期触发了 reconnecting，此时重置计数器。
      // 7. 排空缓冲区中的 ICE candidates
      await this.flushPendingCandidates();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError?.(error);
      // 不是重连流程 → 进入 error 状态
      if (this.reconnectAttempts === 0) {
        this.setState('error');
      }
      await this.cleanup();
    }
  }

  // ============================================================
  //  信令方法
  // ============================================================

  /**
   * POST SDP offer，解析 201 响应的 Location 头与 answer SDP。
   */
  private async postOffer(
    url: string,
    sdp: string,
  ): Promise<{ location: string; answerSdp: string }> {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: sdp,
    });

    if (resp.status !== 201) {
      const body = await resp.text().catch(() => '');
      throw new Error(
        `WHEP POST 返回 ${resp.status}，预期 201。响应：${body.slice(0, 200)}`,
      );
    }

    const location = resp.headers.get('Location');
    if (!location) {
      throw new Error('WHEP 响应缺少 Location 头');
    }
    const resolvedLocation = new URL(location, url).toString();

    const answerSdp = await resp.text();
    if (!answerSdp) {
      throw new Error('WHEP 响应 body 为空（期望 SDP answer）');
    }

    return { location: resolvedLocation, answerSdp };
  }

  // ============================================================
  //  事件处理
  // ============================================================

  /**
   * 处理 ICE candidate：
   * - resourceUrl 已收到 → 立即 PATCH
   * - resourceUrl 未收到 → 暂存到缓冲区
   */
  private handleIceCandidate(evt: RTCPeerConnectionIceEvent): void {
    const candidate = evt.candidate;
    if (!candidate) return; // null = ICE 收集结束

    if (this.resourceUrl) {
      void this.patchCandidate(candidate);
    } else {
      this.pendingCandidates.push(candidate);
    }
  }

  /**
   * 绑定远端媒体流到 video 元素。
   */
  private handleTrack(evt: RTCTrackEvent): void {
    console.log('[WHEP] ontrack fired, kind:', evt.track.kind, 'streams:', evt.streams.length);
    if (this.savedVideoElement && evt.streams[0]) {
      this.savedVideoElement.srcObject = evt.streams[0];
      this.savedVideoElement.play().catch((e) => { console.warn('Failed to play video:', e); });
    }
  }

  /**
   * 监听连接状态变化：
   * - 'connected'  → 进入 playing / 重置重连计数
   * - 'failed' 且在 playing 状态 → 触发重连
   */
  private handleConnectionStateChange(): void {
    const connectionState = this.pc?.connectionState;
    console.log('[WHEP] connectionState →', connectionState);
    if (!connectionState) return;

    switch (connectionState) {
      case 'connected':
        this.setState('playing');
        this.reconnectAttempts = 0;
        break;

      case 'failed':
        // 仅在 playing 期间意外断开才自动重连
        if (this._state === 'playing') {
          this.scheduleReconnect();
        }
        break;

      default:
        break;
    }
  }

  // ============================================================
  //  ICE trickle
  // ============================================================

  /**
   * 排空缓冲区中所有暂存的 ICE candidates。
   */
  private async flushPendingCandidates(): Promise<void> {
    const batch = this.pendingCandidates.splice(0);
    await Promise.all(batch.map((c) => this.patchCandidate(c)));
  }

  /**
   * PATCH 单个 ICE candidate 到 WHEP resource URL。
   * 格式遵循 RFC 8840 trickle-ice-sdpfrag。
   */
  private async patchCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.resourceUrl) return;

    const candidateLine = candidate.candidate
      ? `a=${candidate.candidate}\r\n`
      : '';
    const fragment = [
      `a=ice-ufrag:${this.iceUfrag}\r\n`,
      `a=ice-pwd:${this.icePwd}\r\n`,
      candidateLine,
    ]
      .filter(Boolean)
      .join('');

    if (!fragment) return;

    await fetch(this.resourceUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/trickle-ice-sdpfrag' },
      body: fragment,
    }).catch(() => {
      /* ICE trickle 失败不中断主流程 */
    });
  }

  // ============================================================
  //  自动重连
  // ============================================================

  /**
   * 指数退避重连：1s → 2s → 4s → 8s → 8s，最多 5 次。
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= RECONNECT_MAX_RETRIES) {
      this.setState('error');
      this.onError?.(new Error('WHEP 重连次数已达上限'));
      void this.stop();
      return;
    }

    // 清理当前连接资源（保留用户参数）
    void this.cleanup();

    const backoff = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, backoff);
  }

  // ============================================================
  //  状态与清理
  // ============================================================

  private setState(next: WhepState): void {
    if (this._state !== next) {
      this._state = next;
      this.onStateChange?.(next);
    }
  }

  /**
   * 释放 WebRTC 资源，但保留用户参数供重连复用。
   */
  private async cleanup(): Promise<void> {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }

    this.resourceUrl = null;
    this.pendingCandidates = [];
    this.iceUfrag = '';
    this.icePwd = '';
  }
}
