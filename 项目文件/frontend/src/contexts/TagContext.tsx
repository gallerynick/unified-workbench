import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { listTags } from '../api/tags';
import type { Tag } from '../api/tags';

interface TagContextValue {
  tags: Tag[];
  loading: boolean;
  refresh: () => Promise<void>;
  getTagById: (id: string) => Tag | undefined;
}

const TagContext = createContext<TagContextValue | null>(null);

export function TagProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTags();
      if (res.code === 0) {
        setTags(res.data.items);
      }
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getTagById = useCallback((id: string) => {
    return tags.find((t) => t.id === id);
  }, [tags]);

  return (
    <TagContext.Provider value={{ tags, loading, refresh, getTagById }}>
      {children}
    </TagContext.Provider>
  );
}

export function useTagContext() {
  const context = useContext(TagContext);
  if (!context) {
    throw new Error('useTagContext must be used within a TagProvider');
  }
  return context;
}
