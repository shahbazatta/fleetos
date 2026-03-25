export type VehicleStatus = 'active' | 'idle' | 'offline' | 'maintenance' | 'alert';
export type VehicleType   = 'truck' | 'van' | 'car' | 'bus' | 'motorcycle' | 'heavy';
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType     = 'speeding' | 'geofence_enter' | 'geofence_exit' | 'harsh_braking'
  | 'harsh_acceleration' | 'idle_timeout' | 'sos' | 'low_fuel' | 'maintenance_due' | 'offline' | 'fatigue';

export interface Vehicle {
  id: string;
  registration: string;
  make: string;
  model: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  color: string;
  current_speed: number;
  current_heading: number;
  current_fuel: number;
  current_odometer: number;
  engine_on: boolean;
  health_score: number;
  last_seen: string;
  lng: number;
  lat: number;
  location?: GeoJSON.Point;
  fuel_capacity: number;
  max_speed: number;
  driver_id?: string;
  driver_name?: string;
  driver_score?: number;
  driver_phone?: string;
  depot_name?: string;
  unread_alerts?: number;
}

export interface Driver {
  id: string;
  employee_id: string;
  full_name: string;
  phone: string;
  email?: string;
  license_number: string;
  license_expiry: string;
  status: 'active' | 'inactive' | 'on_leave' | 'suspended';
  safety_score: number;
  current_score: number;
  total_distance: number;
  total_trips: number;
  vehicle_reg?: string;
  depot_name?: string;
}

export interface Alert {
  id: string;
  vehicle_id: string;
  driver_id?: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  lng?: number;
  lat?: number;
  speed?: number;
  is_read: boolean;
  is_resolved: boolean;
  occurred_at: string;
  registration?: string;
  driver_name?: string;
}

export interface Geofence {
  id: string;
  name: string;
  description?: string;
  boundary: GeoJSON.Polygon;
  color: string;
  zone_type?: string;
  is_active: boolean;
  alert_on_enter: boolean;
  alert_on_exit: boolean;
  speed_limit?: number;
}

export interface TelemetryPoint {
  id: number;
  recorded_at: string;
  lng: number;
  lat: number;
  speed: number;
  heading: number;
  fuel_level: number;
  odometer: number;
  engine_on: boolean;
}

export interface FleetSummary {
  vehicles: {
    total: number; active: number; idle: number;
    offline: number; maintenance: number;
    avg_speed: number; avg_fuel: number; avg_health: number;
  };
  alerts: { unread: number; critical: number; today: number; };
  drivers: { avg_safety_score: number; };
}

export interface WsMessage {
  type: 'telemetry_batch' | 'alert' | 'connected' | 'pong';
  vehicles?: Array<{ id: string; lng: number; lat: number; speed: number; heading: number; fuel: number; status: VehicleStatus; engine_on: boolean; }>;
  alert?: Alert;
  timestamp?: string;
}
