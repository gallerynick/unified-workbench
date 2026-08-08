import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from '../utils/auth';
import { request } from '../utils/request';

export interface Notification {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  read: boolean;
}

interface NotificationListResponse {
  items: Array<{
    id: string;
    message: string;
    type: string;
    read: boolean;
    created_at: string;
  }>;
  total: number;
}

export interface KickedInfo {
  roomId: string;
  nickname: string;
}

function mapNotification(db: NotificationListResponse['items'][0]): Notification {
  const lines = db.message.split('\n', 2);
  return {
    id: db.id,
    title: lines[0]?.replace('提醒：', '') ?? db.message,
    content: lines[1] ?? '',
    timestamp: new Date(db.created_at).getTime(),
    read: db.read,
  };
}

export function useWebSocket() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connected, setConnected] = useState(false);
  const [kickedInfo, setKickedInfo] = useState<KickedInfo | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        } else {
          clearInterval(heartbeat);
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;

      try {
        const data = JSON.parse(event.data) as {
          type: string;
          title?: string;
          message?: string;
          content?: string;
          room_id?: string;
          nickname?: string;
        };
        if (data.type === 'notification') {
          const msg = data.message ?? data.content ?? '';
          const lines = msg.split('\n', 2);
          const notification: Notification = {
            id: Date.now().toString(),
            title: lines[0] ?? '',
            content: lines[1] ?? '',
            timestamp: Date.now(),
            read: false,
          };
          setNotifications((prev) => {
            // 避免 WebSocket 推送与 API 轮询重复
            if (prev.some((n) => n.title === notification.title && n.timestamp > Date.now() - 60000)) {
              return prev;
            }
            return [notification, ...prev];
          });
        } else if (data.type === 'room_kicked') {
          setKickedInfo({
            roomId: data.room_id || '',
            nickname: data.nickname || '',
          });
        }
      } catch {
        // 忽略非 JSON 消息
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  // ── API 轮询历史通知 ──────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await request<NotificationListResponse>('/notifications/?page=1&page_size=50');
      if (res.code === 0 && res.data) {
        const apiNotes = res.data.items.map(mapNotification);
        setNotifications((prev) => {
          const wsNotes = prev.filter((n) => !apiNotes.some((a) => a.id === n.id));
          return [...apiNotes, ...wsNotes];
        });
      }
    } catch {
      // 静默失败
    }
  }, []);

  useEffect(() => {
    connect();
    fetchNotifications();
    const poll = setInterval(fetchNotifications, 15000);
    return () => {
      clearInterval(poll);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    try {
      await request(`/notifications/${id}/read`, { method: 'PUT' });
    } catch {
      // 静默失败
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await request('/notifications/read-all', { method: 'PUT' });
    } catch {
      // 静默失败
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, connected, markAsRead, markAllAsRead, kickedInfo };
}
