import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, UserRole } from '../types';
import api from '../utils/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  setSession: (user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isInspector: boolean;
  isOfficer: boolean;
  isCitizen: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The JWT lives in an httpOnly cookie now -- JavaScript literally
  // cannot read it (that's the point: it's unreachable even to an
  // XSS payload). So "is there a valid session" can no longer be
  // answered by checking localStorage; it has to be answered by
  // asking the server, which will succeed or 401 based on whatever
  // cookie the browser actually sends. The user object itself isn't
  // sensitive, so it's still cached in localStorage purely to avoid
  // a blank flash while this request is in flight -- never trusted
  // on its own, always reconciled against this response.
  useEffect(() => {
    const cached = localStorage.getItem('rf_user');
    if (cached) {
      try { setUser(JSON.parse(cached)); } catch { localStorage.removeItem('rf_user'); }
    }

    api.get('/auth/profile')
      .then(({ data }) => {
        setUser(data.user);
        localStorage.setItem('rf_user', JSON.stringify(data.user));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('rf_user');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setSession = useCallback((newUser: User) => {
    localStorage.setItem('rf_user', JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setSession(data.user);
  }, [setSession]);

  const logout = useCallback(() => {
    // Only the server can clear an httpOnly cookie (Set-Cookie with
    // an expired date) -- there's no client-side equivalent of the
    // old localStorage.removeItem('rf_token') to fall back on, so
    // this request has to complete (or at least be attempted) for
    // logout to actually take effect server-side.
    api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('rf_user');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('rf_user', JSON.stringify(updatedUser));
  }, []);

  const hasRole = useCallback((...roles: UserRole[]) => {
    return !!user && roles.includes(user.role);
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    setSession,
    logout,
    updateUser,
    hasRole,
    isAdmin:     !!user && user.role === 'admin',
    isInspector: !!user && user.role === 'inspector',
    isOfficer:   !!user && user.role === 'maintenance_officer',
    isCitizen:   !!user && user.role === 'citizen',
    isStaff:     !!user && ['admin', 'inspector', 'maintenance_officer'].includes(user.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
