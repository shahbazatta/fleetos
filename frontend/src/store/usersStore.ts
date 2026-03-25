import { create } from 'zustand';
import api from '../services/api';

export type UserRole = 'viewer' | 'operator' | 'admin' | 'superadmin';

export interface PortalUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  phone?: string;
  last_login?: string;
  created_at: string;
  tenant_id?: string;
  tenant_name?: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  tenant_id?: string | null;   // required for superadmin creating non-superadmin users
}

export interface UpdateUserPayload {
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  phone?: string;
  password?: string;
}

interface UsersStore {
  users:     PortalUser[];
  isLoading: boolean;
  error:     string | null;

  fetchUsers:   () => Promise<void>;
  createUser:   (payload: CreateUserPayload) => Promise<{ ok: boolean; error?: string }>;
  updateUser:   (id: string, payload: UpdateUserPayload) => Promise<{ ok: boolean; error?: string }>;
  deleteUser:   (id: string) => Promise<{ ok: boolean; error?: string }>;
  toggleActive: (id: string, is_active: boolean) => Promise<void>;
}

export const useUsersStore = create<UsersStore>((set, get) => ({
  users:     [],
  isLoading: false,
  error:     null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/users');
      set({ users: data.users, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to load users', isLoading: false });
    }
  },

  createUser: async (payload) => {
    try {
      const { data } = await api.post('/users', payload);
      set(s => ({ users: [...s.users, data.user] }));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.response?.data?.error || 'Failed to create user' };
    }
  },

  updateUser: async (id, payload) => {
    try {
      const { data } = await api.patch(`/users/${id}`, payload);
      set(s => ({ users: s.users.map(u => u.id === id ? { ...u, ...data.user } : u) }));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.response?.data?.error || 'Failed to update user' };
    }
  },

  deleteUser: async (id) => {
    try {
      await api.delete(`/users/${id}`);
      set(s => ({ users: s.users.filter(u => u.id !== id) }));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.response?.data?.error || 'Failed to delete user' };
    }
  },

  toggleActive: async (id, is_active) => {
    await get().updateUser(id, { is_active });
  },
}));
