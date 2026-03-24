import { create } from 'zustand';
import type { Vehicle, Alert, Geofence, Driver, FleetSummary, WsMessage } from '../types';
import api from '../services/api';

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
  sidebarTab: 'vehicles' | 'alerts' | 'drivers' | 'analytics';
  ws: WebSocket | null;
  wsConnected: boolean;

  // Actions
  fetchVehicles: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchGeofences: () => Promise<void>;
  fetchDrivers: () => Promise<void>;
  fetchSummary: () => Promise<void>;
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

  fetchVehicles: async () => {
    try {
      const { data } = await api.get('/vehicles');
      set({ vehicles: data.vehicles });
    } catch (e) { console.error('fetchVehicles', e); }
  },

  fetchAlerts: async () => {
    try {
      const { data } = await api.get('/alerts?limit=100');
      set({ alerts: data.alerts });
    } catch (e) { console.error('fetchAlerts', e); }
  },

  fetchGeofences: async () => {
    try {
      const { data } = await api.get('/geofences');
      set({ geofences: data.geofences });
    } catch (e) { console.error('fetchGeofences', e); }
  },

  fetchDrivers: async () => {
    try {
      const { data } = await api.get('/drivers');
      set({ drivers: data.drivers });
    } catch (e) { console.error('fetchDrivers', e); }
  },

  fetchSummary: async () => {
    try {
      const { data } = await api.get('/analytics/fleet-summary');
      set({ summary: data });
    } catch (e) { console.error('fetchSummary', e); }
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
