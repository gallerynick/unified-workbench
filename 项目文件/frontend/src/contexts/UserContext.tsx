import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getMe } from '../api/auth';
import type { User } from '../types/user';

interface UserContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  setUser: () => {},
  refreshUser: async () => {},
});

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const res = await getMe();
      if (res.code === 0) {
        setUser(res.data);
      }
    } catch (e) { console.warn('Failed to refresh user:', e); }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <UserContext.Provider value={{ user, setUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}
