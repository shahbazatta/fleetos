import { create } from 'zustand';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Depot {
  id: string; tenant_id: string;
  name: string; address?: string; city?: string;
  lng: number; lat: number;
  capacity: number; manager?: string; phone?: string;
  is_active: boolean; vehicle_count?: number; driver_count?: number;
  created_at: string;
}

export interface FMDriver {
  id: string; tenant_id: string;
  employee_id: string; full_name: string;
  phone?: string; email?: string;
  license_number: string; license_class: string; license_expiry: string;
  status: 'active' | 'inactive' | 'on_leave' | 'suspended';
  safety_score: number; current_score?: number;
  total_distance_km?: number; total_trips?: number;
  vehicle_id?: string; vehicle_reg?: string;
  depot_id?: string; depot_name?: string;
  emergency_contact?: string;
}

export interface FMVehicle {
  id: string; tenant_id: string;
  registration: string; make: string; model: string;
  year: number; type: string; color?: string; vin?: string;
  status: string;
  fuel_capacity?: number; fuel_type?: string;
  max_speed?: number; payload_capacity?: number; seats?: number;
  current_fuel?: number; current_odometer?: number; health_score?: number;
  driver_id?: string; driver_name?: string; driver_phone?: string;
  depot_id?: string; depot_name?: string;
  insurance_expiry?: string; registration_expiry?: string;
  last_service_date?: string; next_service_km?: number;
  notes?: string;
  route_id?: string; route_name?: string; route_color?: string;
  qr_code?: string;
}

export interface FMRoute {
  id: string; tenant_id: string;
  name: string; description?: string;
  color: string; is_active: boolean;
  distance_km?: number; computed_distance_km?: number;
  duration_min?: number;
  vehicle_count?: number;
  path_geojson?: GeoJSON.LineString;
}

export interface FMGeofence {
  id: string; tenant_id: string;
  name: string; description?: string;
  color: string; zone_type: string;
  is_active: boolean; alert_on_enter: boolean; alert_on_exit: boolean;
  speed_limit?: number; area_sqm?: number;
  boundary: GeoJSON.Polygon;
}

export interface GeofenceLayer {
  id: string; tenant_id: string;
  name: string; description?: string;
  color: string; is_visible: boolean; sort_order: number;
  geofence_ids: string[];  // managed client-side + persisted
}

interface FMSummary {
  drivers:   { total: number; active: number };
  vehicles:  { total: number; active: number };
  geofences: { total: number; active: number };
  depots:    { total: number; active: number };
  routes:    { total: number; active: number };
}

// ── Store ──────────────────────────────────────────────────────────────────

interface FMStore {
  drivers:   FMDriver[];
  vehicles:  FMVehicle[];
  geofences: FMGeofence[];
  depots:    Depot[];
  routes:    FMRoute[];
  layers:    GeofenceLayer[];
  summary:   FMSummary | null;
  isLoading: boolean;
  error:     string | null;

  fetchAll:          (tenantId?: string) => Promise<void>;
  fetchSummary:      () => Promise<void>;
  fetchGeofencesOnly: (tenantId?: string) => Promise<void>;

  // Drivers
  createDriver: (d: any) => Promise<{ ok: boolean; error?: string; mobile_credentials?: any }>;
  updateDriver: (id: string, d: any) => Promise<{ ok: boolean; error?: string }>;
  deleteDriver: (id: string) => Promise<{ ok: boolean; error?: string }>;
  assignDriver: (driverId: string, vehicleId: string | null) => Promise<{ ok: boolean; error?: string }>;

  // Vehicles
  createVehicle: (v: any) => Promise<{ ok: boolean; vehicle?: any; error?: string }>;
  updateVehicle: (id: string, v: any) => Promise<{ ok: boolean; error?: string }>;
  deleteVehicle: (id: string) => Promise<{ ok: boolean; error?: string }>;
  assignVehicleDriver: (vehicleId: string, driverId: string | null) => Promise<{ ok: boolean; error?: string }>;

  // Geofences
  createGeofence: (g: any) => Promise<{ ok: boolean; error?: string }>;
  updateGeofence: (id: string, g: any) => Promise<{ ok: boolean; error?: string }>;
  deleteGeofence: (id: string) => Promise<{ ok: boolean; error?: string }>;

  // Depots
  createDepot: (d: any) => Promise<{ ok: boolean; error?: string }>;
  updateDepot: (id: string, d: any) => Promise<{ ok: boolean; error?: string }>;
  deleteDepot: (id: string) => Promise<{ ok: boolean; error?: string }>;

  // Routes
  createRoute: (r: any) => Promise<{ ok: boolean; error?: string }>;
  updateRoute: (id: string, r: any) => Promise<{ ok: boolean; error?: string }>;
  deleteRoute: (id: string) => Promise<{ ok: boolean; error?: string }>;
  assignVehicleRoute: (vehicleId: string, routeId: string | null) => Promise<{ ok: boolean; error?: string }>;

  // Layers (client-side, persisted to localStorage)
  createLayer:  (name: string, color: string, description?: string) => void;
  updateLayer:  (id: string, patch: Partial<GeofenceLayer>) => void;
  deleteLayer:  (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  addGeofenceToLayer:    (layerId: string, geofenceId: string) => void;
  removeGeofenceFromLayer: (layerId: string, geofenceId: string) => void;
  saveLayers:  () => void;
  loadLayers:  (tenantId: string) => void;
}

const storageKey = (tenantId: string) => `fleet_layers_${tenantId}`;

export const useFMStore = create<FMStore>((set, get) => ({
  drivers: [], vehicles: [], geofences: [], depots: [], routes: [],
  layers: [], summary: null, isLoading: false, error: null,

  fetchAll: async (tenantId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const qs = tenantId ? `?tenant_id=${tenantId}` : '';
      const [dr, veh, geo, dep, sum, rts] = await Promise.all([
        api.get(`/fm/drivers${qs}`),
        api.get(`/fm/vehicles${qs}`),
        api.get(`/fm/geofences${qs}`),
        api.get(`/fm/depots${qs}`),
        api.get(`/fm/summary${qs}`),
        api.get(`/fm/routes${qs}`),
      ]);
      set({
        drivers:   dr.data.drivers,
        vehicles:  veh.data.vehicles,
        geofences: geo.data.geofences,
        depots:    dep.data.depots,
        summary:   sum.data,
        routes:    rts.data.routes,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.response?.data?.error || 'Failed to load fleet data', isLoading: false });
    }
  },

  fetchSummary: async () => {
    try { const { data } = await api.get('/fm/summary'); set({ summary: data }); } catch {}
  },

  fetchGeofencesOnly: async (tenantId?: string) => {
    try {
      const qs = tenantId ? `?tenant_id=${tenantId}` : '';
      const { data } = await api.get(`/fm/geofences${qs}`);
      set({ geofences: data.geofences });
    } catch {}
  },

  // ── Drivers ──────────────────────────────────────────────────
  createDriver: async (payload) => {
    try {
      const { data } = await api.post('/fm/drivers', payload);
      set(s => ({ drivers: [...s.drivers, data.driver] }));
      return { ok: true, mobile_credentials: data.mobile_credentials };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  updateDriver: async (id, payload) => {
    try {
      const { data } = await api.patch(`/fm/drivers/${id}`, payload);
      set(s => ({ drivers: s.drivers.map(d => d.id === id ? { ...d, ...data.driver } : d) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  deleteDriver: async (id) => {
    try {
      await api.delete(`/fm/drivers/${id}`);
      set(s => ({ drivers: s.drivers.filter(d => d.id !== id) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  assignDriver: async (driverId, vehicleId) => {
    try {
      await api.patch(`/fm/drivers/${driverId}/assign`, { vehicle_id: vehicleId });
      await get().fetchAll();
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },

  // ── Vehicles ─────────────────────────────────────────────────
  createVehicle: async (payload) => {
    try {
      const { data } = await api.post('/fm/vehicles', payload);
      set(s => ({ vehicles: [...s.vehicles, data.vehicle] }));
      return { ok: true, vehicle: data.vehicle };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  updateVehicle: async (id, payload) => {
    try {
      const { data } = await api.patch(`/fm/vehicles/${id}`, payload);
      set(s => ({ vehicles: s.vehicles.map(v => v.id === id ? { ...v, ...data.vehicle } : v) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  deleteVehicle: async (id) => {
    try {
      await api.delete(`/fm/vehicles/${id}`);
      set(s => ({ vehicles: s.vehicles.filter(v => v.id !== id) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  assignVehicleDriver: async (vehicleId, driverId) => {
    try {
      await api.patch(`/fm/vehicles/${vehicleId}/assign-driver`, { driver_id: driverId });
      await get().fetchAll();
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },

  // ── Geofences ────────────────────────────────────────────────
  createGeofence: async (payload) => {
    try {
      const { data } = await api.post('/fm/geofences', payload);
      set(s => ({ geofences: [...s.geofences, data.geofence] }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  updateGeofence: async (id, payload) => {
    try {
      const { data } = await api.patch(`/fm/geofences/${id}`, payload);
      set(s => ({ geofences: s.geofences.map(g => g.id === id ? { ...g, ...data.geofence } : g) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  deleteGeofence: async (id) => {
    try {
      await api.delete(`/fm/geofences/${id}`);
      set(s => ({
        geofences: s.geofences.filter(g => g.id !== id),
        layers: s.layers.map(l => ({ ...l, geofence_ids: l.geofence_ids.filter(gid => gid !== id) })),
      }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },

  // ── Depots ───────────────────────────────────────────────────
  createDepot: async (payload) => {
    try {
      const { data } = await api.post('/fm/depots', payload);
      set(s => ({ depots: [...s.depots, data.depot] }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  updateDepot: async (id, payload) => {
    try {
      const { data } = await api.patch(`/fm/depots/${id}`, payload);
      set(s => ({ depots: s.depots.map(d => d.id === id ? { ...d, ...data.depot } : d) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  deleteDepot: async (id) => {
    try {
      await api.delete(`/fm/depots/${id}`);
      set(s => ({ depots: s.depots.filter(d => d.id !== id) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },

  // ── Routes ───────────────────────────────────────────────────
  createRoute: async (payload) => {
    try {
      const { data } = await api.post('/fm/routes', payload);
      set(s => ({ routes: [...s.routes, data.route] }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  updateRoute: async (id, payload) => {
    try {
      const { data } = await api.patch(`/fm/routes/${id}`, payload);
      set(s => ({ routes: s.routes.map(r => r.id === id ? { ...r, ...data.route } : r) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  deleteRoute: async (id) => {
    try {
      await api.delete(`/fm/routes/${id}`);
      set(s => ({ routes: s.routes.filter(r => r.id !== id) }));
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },
  assignVehicleRoute: async (vehicleId, routeId) => {
    try {
      await api.patch(`/fm/vehicles/${vehicleId}/assign-route`, { route_id: routeId });
      await get().fetchAll();
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e.response?.data?.error || 'Error' }; }
  },

  // ── Layers (localStorage) ─────────────────────────────────────
  loadLayers: (tenantId) => {
    try {
      const raw = localStorage.getItem(storageKey(tenantId));
      if (raw) set({ layers: JSON.parse(raw) });
    } catch {}
  },
  saveLayers: () => {
    const { layers } = get();
    // find tenant from first layer or skip
    if (!layers.length) return;
    const key = storageKey(layers[0].tenant_id);
    localStorage.setItem(key, JSON.stringify(layers));
  },
  createLayer: (name, color, description) => {
    const id = crypto.randomUUID();
    set(s => {
      const tenantId = s.geofences[0]?.tenant_id || 'default';
      const layer: GeofenceLayer = { id, tenant_id: tenantId, name, color, description, is_visible: true, sort_order: s.layers.length, geofence_ids: [] };
      const updated = [...s.layers, layer];
      return { layers: updated };
    });
    get().saveLayers();
  },
  updateLayer: (id, patch) => {
    set(s => ({ layers: s.layers.map(l => l.id === id ? { ...l, ...patch } : l) }));
    get().saveLayers();
  },
  deleteLayer: (id) => {
    set(s => ({ layers: s.layers.filter(l => l.id !== id) }));
    get().saveLayers();
  },
  toggleLayerVisibility: (id) => {
    set(s => ({ layers: s.layers.map(l => l.id === id ? { ...l, is_visible: !l.is_visible } : l) }));
    get().saveLayers();
  },
  addGeofenceToLayer: (layerId, geofenceId) => {
    set(s => ({ layers: s.layers.map(l => l.id === layerId && !l.geofence_ids.includes(geofenceId) ? { ...l, geofence_ids: [...l.geofence_ids, geofenceId] } : l) }));
    get().saveLayers();
  },
  removeGeofenceFromLayer: (layerId, geofenceId) => {
    set(s => ({ layers: s.layers.map(l => l.id === layerId ? { ...l, geofence_ids: l.geofence_ids.filter(id => id !== geofenceId) } : l) }));
    get().saveLayers();
  },
}));
