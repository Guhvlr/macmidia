import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SystemUser } from './app-types';

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  loggedUserId: string | null;
  loggedUserName: string | null;
  loggedUserRole: 'ADMIN' | 'USER' | 'GUEST';
  loggedUserClientLink: string | null;
  loggedUserKanbanLink: string | null;
  systemUsers: SystemUser[];
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  adminDeleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  adminResetPassword: (id: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  adminUpdateUserRole: (id: string, role: string, clientLink?: string, kanbanLink?: string) => Promise<{ success: boolean; error?: string }>;
  setSystemUsers: React.Dispatch<React.SetStateAction<SystemUser[]>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSystemUser(row: any): SystemUser {
  return {
    id: row.id, fullName: row.full_name, email: row.email,
    role: row.role as 'ADMIN' | 'USER' | 'GUEST', avatarUrl: row.avatar_url || undefined,
    clientLink: row.client_link || undefined,
    kanbanLink: row.kanban_link || undefined,
    createdAt: row.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [loggedUserId, setLoggedUserId] = useState<string | null>(null);
  const [loggedUserName, setLoggedUserName] = useState<string | null>(null);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);

  const isAuthenticated = !!loggedUserId;

  const loggedUser = useMemo(() => {
    if (!loggedUserId || systemUsers.length === 0) return null;
    return systemUsers.find(u => u.id === loggedUserId) || null;
  }, [loggedUserId, systemUsers]);

  const loggedUserRole = loggedUser?.role || 'GUEST';
  const loggedUserClientLink = loggedUser?.clientLink || null;
  const loggedUserKanbanLink = loggedUser?.kanbanLink || null;

  const fetchUsers = useCallback(async () => {
    const { data } = await (supabase as any).from('system_users').select('*');
    if (data) setSystemUsers((data as any[]).map(mapSystemUser));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLoggedUserId(session.user.id);
        setLoggedUserName(session.user.user_metadata?.full_name || session.user.email || 'Usuário');
        fetchUsers();
      }
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setLoggedUserId(session.user.id);
        setLoggedUserName(session.user.user_metadata?.full_name || session.user.email || 'Usuário');
        fetchUsers();
      } else {
        setLoggedUserId(null);
        setLoggedUserName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUsers]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const channel = supabase.channel('realtime-users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_users' }, fetchUsers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAuthenticated, fetchUsers]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const logout = useCallback(async () => { 
    await supabase.auth.signOut();
  }, []);

  const adminDeleteUser = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any).rpc('admin_delete_user', { target_user_id: id });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const adminResetPassword = useCallback(async (id: string, newPassword: string) => {
    try {
      const { error } = await (supabase as any).rpc('admin_reset_password', { 
        target_user_id: id, 
        new_password: newPassword 
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const adminUpdateUserRole = useCallback(async (id: string, role: string, clientLink?: string, kanbanLink?: string) => {
    try {
      const { error } = await (supabase as any).rpc('admin_update_user_role', { 
        target_user_id: id, 
        new_role: role,
        new_client_link: clientLink || null,
        new_kanban_link: kanbanLink || null
      });
      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  const value = useMemo(() => ({
    isAuthenticated,
    isAuthLoading,
    loggedUserId,
    loggedUserName,
    loggedUserRole,
    loggedUserClientLink,
    loggedUserKanbanLink,
    systemUsers,
    login,
    register,
    logout,
    adminDeleteUser,
    adminResetPassword,
    adminUpdateUserRole,
    setSystemUsers
  }), [
    isAuthenticated,
    isAuthLoading,
    loggedUserId,
    loggedUserName,
    loggedUserRole,
    loggedUserClientLink,
    loggedUserKanbanLink,
    systemUsers,
    login,
    register,
    logout,
    adminDeleteUser,
    adminResetPassword,
    adminUpdateUserRole
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
