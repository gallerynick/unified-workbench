import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteDraft, getDraft, saveDraft } from '@/api/notes';
import type { NoteBody, NoteDraft } from '@/types/note';

/** 草稿保存状态：idle 未改动 · saving 已排期或正在写入 · saved 已落盘 · error 写入失败 */
export type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 1500;

interface Baseline {
  noteId: string | null;
  title: string;
  body: NoteBody;
}

export interface NoteDraftApi {
  saveState: DraftSaveState;
  /** 服务端已有草稿 */
  existingDraft: NoteDraft | null;
  /** 查询当前笔记的服务端草稿；无草稿时返回 null */
  loadExisting: () => Promise<NoteDraft | null>;
  /** 取消排队中的保存，不写服务器 */
  discardPending: () => void;
  /** 发布成功后清理：取消排队 + 删除服务端草稿 + 重置状态 */
  clear: () => Promise<void>;
  /**
   * 声明「当前内容是刚载入的基线，不算改动」，须在 setTitle/setBody 同一次 effect 内调用。
   * 没有它的话，打开一篇笔记会触发一次 state 变化并被误判为用户编辑。
   */
  reset: (noteId: string | null, title: string, body: NoteBody) => void;
}

/**
 * 服务端草稿：内容相对基线发生变化后 debounce 1.5s 写 saveDraft，
 * 并暴露已有草稿供「检测到未保存草稿」提示。
 *
 * noteId 为 null 表示尚未关联笔记的新笔记草稿，后端按 user 维度存一份。
 */
export function useNoteDraft(
  noteId: string | null,
  title: string,
  body: NoteBody,
): NoteDraftApi {
  const [saveState, setSaveState] = useState<DraftSaveState>('idle');
  const [existingDraft, setExistingDraft] = useState<NoteDraft | null>(null);

  const latest = useRef({ noteId, title, body });
  latest.current = { noteId, title, body };

  const baseline = useRef<Baseline>({ noteId, title, body });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(async () => {
    const { noteId: id, title: t, body: b } = latest.current;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSaveState('saving');
    try {
      const res = await saveDraft(id, t, b);
      if (res.code === 0) {
        setExistingDraft(res.data);
        setSaveState('saved');
      } else {
        setSaveState('error');
      }
    } catch {
      setSaveState('error');
    }
  }, []);

  useEffect(() => {
    const base = baseline.current;
    if (noteId === base.noteId && title === base.title && body === base.body) return;
    if (timer.current) clearTimeout(timer.current);
    setSaveState('saving');
    timer.current = setTimeout(() => {
      void persist();
    }, DEBOUNCE_MS);
  }, [noteId, title, body, persist]);

  // 切换笔记即重置提示与状态，草稿按 note_id 独立存在
  useEffect(() => {
    setExistingDraft(null);
    setSaveState('idle');
  }, [noteId]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const reset = useCallback((nextNoteId: string | null, nextTitle: string, nextBody: NoteBody) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    baseline.current = { noteId: nextNoteId, title: nextTitle, body: nextBody };
  }, []);

  const loadExisting = useCallback(async (): Promise<NoteDraft | null> => {
    try {
      const res = await getDraft(latest.current.noteId);
      const draft = res.code === 0 ? (res.data ?? null) : null;
      setExistingDraft(draft);
      return draft;
    } catch {
      setExistingDraft(null);
      return null;
    }
  }, []);

  const discardPending = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setSaveState('idle');
  }, []);

  const clear = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    try {
      // 草稿可能从未落盘，失败无需提示
      await deleteDraft(latest.current.noteId);
    } catch {
      /* 忽略：无草稿或删除失败都不影响发布结果 */
    }
    setExistingDraft(null);
    setSaveState('idle');
  }, []);

  return { saveState, existingDraft, loadExisting, discardPending, clear, reset };
}