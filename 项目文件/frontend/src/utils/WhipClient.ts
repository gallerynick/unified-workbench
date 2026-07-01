/**
 * WHIP (WebRTC HTTP Ingestion Protocol) 客户端 — RFC 9725
 *
 * 通过 MediaMTX 的 WHIP 端点发布浏览器端 WebRTC 流。
 * 调用方提供 MediaStream，本类负责信令交换与 ICE trickle。
 */

export type WhipState = 'idle' | 'connecting' | 'streaming' | 'error';

export interface StreamStats {
  bitrateKbps: number;
  totalBytes: number;
  packetsLost: number;
  fps: number;
  resolution: string;
}

export interface WhipOptions {
  iceServers?: RTCIceServer[];
  videoBitrate?: number; // kbps
  videoFps?: number;
  audioBitrate?: number; // kbps
}

/**
 * 提升 SDP 中 opus 音频的码率和立体声参数
 */
function boostOpusSdp(sdp: string, audioBitrateKbps: number): string {
  // 从 a=rtpmap:N opus/... 提取 opus 的 payload type 编号
  const rtpmapMatch = sdp.match(/a=rtpmap:(\d+) opus\//);
  if (!rtpmapMatch) return sdp;
  const opusPt = rtpmapMatch[1];
  const fmtpPrefix = `a=fmtp:${opusPt}`;

  return sdp
    .split('\r\n')
    .map((line) => {
      if (line.startsWith(fmtpPrefix)) {
        const clean = line
          .replace(/;stereo=\d/, '')
          .replace(/;sprop-stereo=\d/, '')
          .replace(/;maxaveragebitrate=\d+/, '');
        return clean + `;stereo=1;sprop-stereo=1;maxaveragebitrate=${audioBitrateKbps * 1000}`;
      }
      if (line.startsWith('m=audio')) {
        return line + '\r\nb=AS:' + audioBitrateKbps;
      }
      return line;
    })
    .join('\r\n');
}

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

export class WhipClient {
  private pc: RTCPeerConnection | null = null;
  private resourceUrl: string | null = null;
  private _state: WhipState = 'idle';
  private iceUfrag = '';
  private icePwd = '';
  /** ICE candidates 在收到 resourceUrl 之前的缓冲区 */
  private pendingCandidates: RTCIceCandidate[] = [];
  /** MediaStream tracks 引用，用于 stop 时逐个终止 */
  private tracks: MediaStreamTrack[] = [];

  // ---- 公开回调 ----
  onStateChange: ((state: WhipState) => void) | null = null;
  onError: ((error: Error) => void) | null = null;
  onStats: ((stats: StreamStats) => void) | null = null;

  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private lastStatsBytes = 0;
  private lastStatsTime = 0;

  get state(): WhipState {
    return this._state;
  }

  // ============================================================
  //  公开 API
  // ============================================================

  /**
   * 启动 WHIP 发布。
   * @param whipUrl  - WHIP 端点（如 http://localhost:8554/mystream/whip）
   * @param stream   - 待发布的 MediaStream
   * @param options  - 可选 ICE 服务器配置
   */
  async start(
    whipUrl: string,
    stream: MediaStream,
    options?: WhipOptions,
  ): Promise<void> {
    if (this._state !== 'idle') {
      throw new Error(`WhipClient 已在 ${this._state} 状态，需先调用 stop()`);
    }

    this.setState('connecting');

    try {
      // 1. 创建 PeerConnection
      const config: RTCConfiguration = {
        bundlePolicy: 'max-bundle',
          iceServers: options?.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
      };
      this.pc = new RTCPeerConnection(config);

      // 2. 添加 tracks（sendonly transceiver）
      this.tracks = stream.getTracks().slice();
      for (const track of this.tracks) {
        const init: RTCRtpTransceiverInit = { direction: 'sendonly' };
        if (track.kind === 'video' && options) {
          const enc: RTCRtpEncodingParameters = { scaleResolutionDownBy: 1 };
          if (options.videoBitrate) enc.maxBitrate = options.videoBitrate * 1000;
          if (options.videoFps) enc.maxFramerate = options.videoFps;
          init.sendEncodings = [enc];
        }
        if (track.kind === 'audio' && options?.audioBitrate) {
          init.sendEncodings = [{ maxBitrate: options.audioBitrate * 1000 }];
        }
        const sender = this.pc.addTransceiver(track, init);
        if (track.kind === 'video') {
          const codecs = RTCRtpSender.getCapabilities('video')?.codecs ?? [];
          const h264 = codecs.filter((c) => c.mimeType === 'video/H264');
          const others = codecs.filter((c) => c.mimeType !== 'video/H264');
          sender.setCodecPreferences([...h264, ...others]);
          const params = sender.sender.getParameters();
          params.degradationPreference = 'maintain-resolution';
          await sender.sender.setParameters(params);
        }
        if (track.kind === 'audio') {
          const codecs = RTCRtpSender.getCapabilities('audio')?.codecs ?? [];
          const opus = codecs.filter((c) => c.mimeType === 'audio/opus');
          const others = codecs.filter((c) => c.mimeType !== 'audio/opus');
          sender.setCodecPreferences([...opus, ...others]);
        }
      }

      // 3. 创建 SDP offer
      const offer = await this.pc.createOffer();
      if (!offer.sdp) {
        throw new Error('createOffer 未生成 SDP');
      }
      if (options?.audioBitrate) {
        offer.sdp = boostOpusSdp(offer.sdp, options.audioBitrate);
      }
      await this.pc.setLocalDescription(offer);

      // 记录 ICE credentials 供 trickle PATCH 用
      const creds = extractIceCredentials(offer.sdp);
      this.iceUfrag = creds.ufrag;
      this.icePwd = creds.pwd;

      // 4. 注册 ICE candidate 事件（在 await setLocalDescription 之后）
      this.pc.onicecandidate = (evt) => this.handleIceCandidate(evt);

      // 5. POST SDP offer → WHIP endpoint
      const resourceUrl = await this.postOffer(whipUrl, offer.sdp);

      // 6. 用 answer 设置 remote description
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: resourceUrl.answerSdp }),
      );

      this.resourceUrl = resourceUrl.location;

      // 7. setRemoteDescription 完成后才排空 ICE candidates
      await this.flushPendingCandidates();

      // 8. 强制设置编码参数（setParameters 比 SDP 更可靠）
      if (options?.audioBitrate) {
        const audioSender = this.pc.getSenders().find(s => s.track?.kind === 'audio');
        if (audioSender) {
          const params = audioSender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          if (params.encodings[0]) {
            params.encodings[0].maxBitrate = options.audioBitrate * 1000;
          }
          await audioSender.setParameters(params);
        }
      }
      if (options?.videoBitrate || options?.videoFps) {
        const videoSender = this.pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          const params = videoSender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          if (params.encodings[0]) {
            if (options.videoBitrate) params.encodings[0].maxBitrate = options.videoBitrate * 1000;
            if (options.videoFps) params.encodings[0].maxFramerate = options.videoFps;
          }
          await videoSender.setParameters(params);
        }
      }

      this.setState('streaming');
    } catch (err) {
      this.setState('error');
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError?.(error);
      // 半途失败时清理
      await this.cleanup();
      throw error;
    }
  }

  /**
   * 停止发布并释放资源。
   */
  async stop(): Promise<void> {
    if (this._state === 'idle') return;

    try {
      // DELETE resource URL（优雅拆除）
      if (this.resourceUrl) {
        await fetch(this.resourceUrl, { method: 'DELETE' }).catch(() => {
          /* 忽略网络错误 */
        });
      }
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 动态添加音轨（推流后新增麦克风）。
   */
  addTrack(track: MediaStreamTrack): void {
    if (!this.pc || this._state !== 'streaming') return;
    this.pc.addTransceiver(track, { direction: 'sendonly' });
    this.tracks.push(track);
  }

  // ============================================================
  //  内部方法
  // ============================================================

  private setState(next: WhipState): void {
    if (this._state !== next) {
      this._state = next;
      this.onStateChange?.(next);
    }
    if (next === 'streaming') {
      this.startStatsPolling();
    } else if (this._state !== 'connecting') {
      this.stopStatsPolling();
    }
  }

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
        `WHIP POST 返回 ${resp.status}，预期 201。响应：${body.slice(0, 200)}`,
      );
    }

    const location = resp.headers.get('Location');
    if (!location) {
      throw new Error('WHIP 响应缺少 Location 头');
    }
    const resolvedLocation = new URL(location, url).toString();

    const answerSdp = await resp.text();
    if (!answerSdp) {
      throw new Error('WHIP 响应 body 为空（期望 SDP answer）');
    }

    return { location: resolvedLocation, answerSdp };
  }

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
   * 排空缓冲区中所有暂存的 ICE candidates。
   */
  private async flushPendingCandidates(): Promise<void> {
    const batch = this.pendingCandidates.splice(0);
    await Promise.all(batch.map((c) => this.patchCandidate(c)));
  }

  /**
   * PATCH 单个 ICE candidate 到 WHIP resource URL。
   * 格式遵循 RFC 8840 trickle-ice-sdpfrag。
   */
  private async patchCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.resourceUrl) return;

    const candidateLine = candidate.candidate
      ? `a=${candidate.candidate}\r\n`
      : '';
    // 按 RFC 8840，片段以 ice-ufrag/ice-pwd 行开头，后跟候选行
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
      /* ICE trickle 失败不中断主流程；连接仍可通过 STUN/TURN 建立 */
    });
  }

  /**
   * 释放所有资源：关闭 PeerConnection、停止 tracks、重置状态。
   */
  private async cleanup(): Promise<void> {
    this.stopStatsPolling();

    // 停止所有 tracks
    for (const track of this.tracks) {
      track.stop();
    }
    this.tracks = [];

    // 关闭 PeerConnection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.resourceUrl = null;
    this.pendingCandidates = [];
    this.iceUfrag = '';
    this.icePwd = '';

    if (this._state !== 'error') {
      this.setState('idle');
    }
  }

  private startStatsPolling(): void {
    this.stopStatsPolling();
    this.lastStatsBytes = 0;
    this.lastStatsTime = 0;
    this.statsInterval = setInterval(() => this.collectStats(), 2000);
  }

  private stopStatsPolling(): void {
    if (this.statsInterval) { clearInterval(this.statsInterval); this.statsInterval = null; }
    this.lastStatsBytes = 0; this.lastStatsTime = 0;
  }

  private async collectStats(): Promise<void> {
    if (!this.pc || !this.onStats) return;
    try {
      const report = await this.pc.getStats();
      let bytesSent = 0; let fps = 0; let packetsLost = 0; let resolution = '';
      report.forEach((r) => {
        if (r.type === 'outbound-rtp' && r.kind === 'video') {
          bytesSent += r.bytesSent ?? 0;
          fps = r.framesPerSecond ?? 0;
          packetsLost += r.packetsLost ?? 0;
          resolution = r.frameWidth && r.frameHeight ? `${r.frameWidth}x${r.frameHeight}` : '';
        }
      });
      let bitrate = 0;
      const now = Date.now();
      if (this.lastStatsTime > 0 && bytesSent > this.lastStatsBytes) {
        bitrate = ((bytesSent - this.lastStatsBytes) * 8) / ((now - this.lastStatsTime) / 1000) / 1000;
      }
      this.lastStatsBytes = bytesSent;
      this.lastStatsTime = now;
      this.onStats({ bitrateKbps: Math.round(bitrate), totalBytes: bytesSent, packetsLost, fps, resolution });
    } catch { /* stats failure is non-critical */ }
  }
}
