import { create } from 'zustand';
import api from '../services/api';

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  max_vehicles: number;
  max_users: number;
  settings?: Record<string, any>;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  tenant_id: string | null;
  tenant: TenantInfo | null;
}

interface AuthStore {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  init: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  init: () => {
    const token = localStorage.getItem('fleet_token');
    const user  = localStorage.getItem('fleet_user');
    if (token && user) set({ token, user: JSON.parse(user) });
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('fleet_token', data.token);
      localStorage.setItem('fleet_user', JSON.stringify(data.user));
      set({ token: data.token, user: data.user, isLoading: false });
      return true;
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Login failed', isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('fleet_token');
    localStorage.removeItem('fleet_user');
    set({ user: null, token: null });
    window.location.href = '/login';
  },
}));
