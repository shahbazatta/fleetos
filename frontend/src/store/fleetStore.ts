import { create } from 'zustand';
import type { Vehicle, Alert, Geofence, Driver, FleetSummary, WsMessage } from '../types';
import api from '../services/api';

// City → map center lookup (lng, lat, zoom)
const CITY_COORDS: Record<string, { longitude: number; latitude: number; zoom: number }> = {
  'riyadh':       { longitude: 46.7132, latitude: 24.6877, zoom: 11 },
  'jeddah':       { longitude: 39.1925, latitude: 21.4858, zoom: 11 },
  'dammam':       { longitude: 50.1033, latitude: 26.4367, zoom: 12 },
  'dubai':        { longitude: 55.2963, latitude: 25.2048, zoom: 11 },
  'abu dhabi':    { longitude: 54.3773, latitude: 24.4539, zoom: 11 },
  'sharjah':      { longitude: 55.3781, latitude: 25.3463, zoom: 12 },
  'doha':         { longitude: 51.5310, latitude: 25.2854, zoom: 12 },
  'muscat':       { longitude: 58.5900, latitude: 23.6140, zoom: 12 },
  'kuwait city':  { longitude: 47.9783, latitude: 29.3697, zoom: 12 },
  'kuwait':       { longitude: 47.9783, latitude: 29.3697, zoom: 12 },
  'manama':       { longitude: 50.5860, latitude: 26.2154, zoom: 13 },
  'bahrain':      { longitude: 50.5860, latitude: 26.2154, zoom: 12 },
  'lahore':       { longitude: 74.3587, latitude: 31.5204, zoom: 12 },
  'karachi':      { longitude: 67.0099, latitude: 24.8607, zoom: 11 },
  'islamabad':    { longitude: 73.0479, latitude: 33.6844, zoom: 12 },
  'cairo':        { longitude: 31.2357, latitude: 30.0444, zoom: 11 },
  'amman':        { longitude: 35.9106, latitude: 31.9539, zoom: 12 },
  'beirut':       { longitude: 35.4952, latitude: 33.8886, zoom: 13 },
};

function cityCoords(city?: string | null, country?: string | null) {
  if (!city && !country) return null;
  const key = (city || country || '').toLowerCase().trim();
  return CITY_COORDS[key] ?? null;
}

interface FleetStore {
  // State
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  alerts: Alert[];
  geofences: Geofence[];
  drivers: Driver[];
  summary: FleetSummary | null;
  isLoading: boolean;
  mapViewState: { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };
  showGeofences: boolean;
  showHeatmap: boolean;
  showTrails: boolean;
  sidebarTab: 'vehicles' | 'alerts' | 'drivers' | 'analytics' | 'layers';
  ws: WebSocket | null;
  wsConnected: boolean;
  tenantFilter: string | null; // superadmin only — filter all data by tenant

  // Actions
  fetchVehicles: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchGeofences: () => Promise<void>;
  fetchDrivers: () => Promise<void>;
  fetchSummary: () => Promise<void>;
  fetchAll: () => Promise<void>;
  setTenantFilter: (id: string | null, city?: string | null, country?: string | null) => void;
  flyToTenant: (city?: string | null, country?: string | null) => void;
  selectVehicle: (id: string | null) => void;
  updateVehicleTelemetry: (updates: WsMessage['vehicles']) => void;
  addAlert: (alert: Alert) => void;
  markAlertRead: (id: string) => void;
  setMapViewState: (vs: Partial<FleetStore['mapViewState']>) => void;
  setShowGeofences: (v: boolean) => void;
  setShowHeatmap: (v: boolean) => void;
  setShowTrails: (v: boolean) => void;
  setSidebarTab: (t: FleetStore['sidebarTab']) => void;
  connectWs: () => void;
  disconnectWs: () => void;
}

export const useFleetStore = create<FleetStore>((set, get) => ({
  vehicles: [],
  selectedVehicleId: null,
  alerts: [],
  geofences: [],
  drivers: [],
  summary: null,
  isLoading: false,
  mapViewState: { longitude: 74.3587, latitude: 31.5204, zoom: 12, pitch: 45, bearing: 0 },
  showGeofences: true,
  showHeatmap: false,
  showTrails: false,
  sidebarTab: 'vehicles',
  ws: null,
  wsConnected: false,
  tenantFilter: null,

  fetchVehicles: async () => {
    try {
      const tf = get().tenantFilter;
      const qs = tf ? `?tenant_id=${tf}` : '';
      const { data } = await api.get(`/vehicles${qs}`);
      set({ vehicles: data.vehicles });
    } catch (e) { console.error('fetchVehicles', e); }
  },

  fetchAlerts: async () => {
    try {
      const tf = get().tenantFilter;
      const qs = tf ? `?tenant_id=${tf}&limit=100` : '?limit=100';
      const { data } = await api.get(`/alerts${qs}`);
      set({ alerts: data.alerts });
    } catch (e) { console.error('fetchAlerts', e); }
  },

  fetchGeofences: async () => {
    try {
      const tf = get().tenantFilter;
      const qs = tf ? `?tenant_id=${tf}` : '';
      const { data } = await api.get(`/geofences${qs}`);
      set({ geofences: data.geofences });
    } catch (e) { console.error('fetchGeofences', e); }
  },

  fetchDrivers: async () => {
    try {
      const tf = get().tenantFilter;
      const qs = tf ? `?tenant_id=${tf}` : '';
      const { data } = await api.get(`/drivers${qs}`);
      set({ drivers: data.drivers });
    } catch (e) { console.error('fetchDrivers', e); }
  },

  fetchSummary: async () => {
    try {
      const tf = get().tenantFilter;
      const qs = tf ? `?tenant_id=${tf}` : '';
      const { data } = await api.get(`/analytics/fleet-summary${qs}`);
      set({ summary: data });
    } catch (e) { console.error('fetchSummary', e); }
  },

  fetchAll: async () => {
    await Promise.all([
      get().fetchVehicles(),
      get().fetchAlerts(),
      get().fetchGeofences(),
      get().fetchDrivers(),
      get().fetchSummary(),
    ]);
  },

  setTenantFilter: (id, city, country) => {
    set({ tenantFilter: id, selectedVehicleId: null });
    if (city || country) get().flyToTenant(city, country);
    setTimeout(() => get().fetchAll(), 0);
  },

  flyToTenant: (city, country) => {
    const coords = cityCoords(city, country);
    if (coords) {
      set(s => ({ mapViewState: { ...s.mapViewState, ...coords, pitch: 45, bearing: 0 } }));
    }
  },

  selectVehicle: (id) => {
    set({ selectedVehicleId: id });
    if (id) {
      const v = get().vehicles.find(v => v.id === id);
      if (v) {
        set(s => ({ mapViewState: { ...s.mapViewState, longitude: v.lng, latitude: v.lat, zoom: 15 } }));
      }
      // Subscribe via WS
      const { ws } = get();
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe_vehicle', vehicleId: id }));
      }
    }
  },

  updateVehicleTelemetry: (updates) => {
    if (!updates?.length) return;
    set(state => {
      const map = new Map(state.vehicles.map(v => [v.id, v]));
      for (const u of updates) {
        const existing = map.get(u.id);
        if (existing) {
          map.set(u.id, { ...existing, lng: u.lng, lat: u.lat, current_speed: u.speed, current_heading: u.heading, current_fuel: u.fuel, status: u.status, engine_on: u.engine_on });
        }
      }
      return { vehicles: Array.from(map.values()) };
    });
  },

  addAlert: (alert) => set(s => ({ alerts: [alert, ...s.alerts.slice(0, 199)] })),

  markAlertRead: async (id) => {
    await api.patch(`/alerts/${id}/read`);
    set(s => ({ alerts: s.alerts.map(a => a.id === id ? { ...a, is_read: true } : a) }));
  },

  setMapViewState: (vs) => set(s => ({ mapViewState: { ...s.mapViewState, ...vs } })),
  setShowGeofences: (v) => set({ showGeofences: v }),
  setShowHeatmap: (v) => set({ showHeatmap: v }),
  setShowTrails: (v) => set({ showTrails: v }),
  setSidebarTab: (t) => set({ sidebarTab: t }),

  connectWs: () => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => { set({ wsConnected: true }); console.log('WS connected'); };
    ws.onclose = () => {
      set({ wsConnected: false });
      // Reconnect after 3s
      setTimeout(() => get().connectWs(), 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try {
        const msg: WsMessage = JSON.parse(e.data);
        if (msg.type === 'telemetry_batch') get().updateVehicleTelemetry(msg.vehicles);
        if (msg.type === 'alert' && msg.alert)  get().addAlert(msg.alert);
      } catch (_) {}
    };
    set({ ws });
  },

  disconnectWs: () => {
    get().ws?.close();
    set({ ws: null, wsConnected: false });
  },
}));
