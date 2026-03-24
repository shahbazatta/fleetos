import { create } from 'zustand';
import api from '../services/api';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  country: string;
  city?: string;
  email?: string;
  phone?: string;
  website?: string;
  is_active: boolean;
  plan: string;
  max_vehicles: number;
  max_users: number;
  user_count?: number;
  vehicle_count?: number;
  driver_count?: number;
  created_at: string;
}

export interface CreateTenantPayload {
  name: string;
  slug: string;
  country?: string;
  city?: string;
  email?: string;
  phone?: string;
  plan?: string;
  max_vehicles?: number;
  max_users?: number;
}

interface TenantsStore {
  tenants: Tenant[];
  isLoading: boolean;
  error: string | null;
  fetchTenants: () => Promise<void>;
  createTenant: (payload: CreateTenantPayload) => Promise<{ ok: boolean; error?: string; tenant?: Tenant }>;
  updateTenant: (id: string, payload: Partial<Tenant>) => Promise<{ ok: boolean; error?: string }>;
  deleteTenant: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export const useTenantsStore = create<TenantsStore>((set) => ({
  tenants: [],
  isLoading: false,
  error: null,

  fetchTenants: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/tenants');
      set({ tenants: data.tenants, isLoading: false });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to load tenants', isLoading: false });
    }
  },

  createTenant: async (payload) => {
    try {
      const { data } = await api.post('/tenants', payload);
      set(s => ({ tenants: [data.tenant, ...s.tenants] }));
      return { ok: true, tenant: data.tenant };
    } catch (err: any) {
      return { ok: false, error: err.response?.data?.error || 'Failed to create tenant' };
    }
  },

  updateTenant: async (id, payload) => {
    try {
      const { data } = await api.patch(`/tenants/${id}`, payload);
      set(s => ({ tenants: s.tenants.map(t => t.id === id ? { ...t, ...data.tenant } : t) }));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.response?.data?.error || 'Failed to update tenant' };
    }
  },

  deleteTenant: async (id) => {
    try {
      await api.delete(`/tenants/${id}`);
      set(s => ({ tenants: s.tenants.filter(t => t.id !== id) }));
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.response?.data?.error || 'Failed to delete tenant' };
    }
  },
}));
