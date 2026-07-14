import type { VehicleStatus, AlertSeverity, VehicleType } from '../types';

export const STATUS_COLOR: Record<VehicleStatus, string> = {
  active:      '#0f9d74',
  idle:        '#c9862b',
  offline:     '#64748b',
  maintenance: '#8b7cd8',
  alert:       '#e14b42',
};

export const STATUS_BG: Record<VehicleStatus, string> = {
  active:      'rgba(15,157,116,0.12)',
  idle:        'rgba(201,134,43,0.12)',
  offline:     'rgba(100,116,139,0.15)',
  maintenance: 'rgba(139,124,216,0.12)',
  alert:       'rgba(225,75,66,0.12)',
};

export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: '#e14b42',
  warning:  '#c9862b',
  info:     '#64748b',
};

export const SEVERITY_BG: Record<AlertSeverity, string> = {
  critical: 'rgba(225,75,66,0.12)',
  warning:  'rgba(201,134,43,0.12)',
  info:     'rgba(100,116,139,0.12)',
};

export const TYPE_EMOJI: Record<VehicleType, string> = {
  truck:      '🚛',
  van:        '🚐',
  car:        '🚗',
  bus:        '🚌',
  motorcycle: '🏍',
  heavy:      '🚜',
};

export function statusColor(status: VehicleStatus): [number, number, number, number] {
  const hex = STATUS_COLOR[status] || '#64748b';
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return [r, g, b, 220];
}

export function scoreColor(score: number): string {
  if (score >= 85) return '#0f9d74';
  if (score >= 70) return '#c9862b';
  return '#e14b42';
}

export function fuelColor(pct: number): string {
  if (pct > 40) return '#0f9d74';
  if (pct > 15) return '#c9862b';
  return '#e14b42';
}

export function formatSpeed(s: number) { return `${Math.round(s)} km/h`; }
export function formatFuel(f: number)  { return `${Math.round(f)}%`; }
export function formatDist(km: number) {
  return km > 1000 ? `${(km/1000).toFixed(1)}k km` : `${Math.round(km)} km`;
}
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff/1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
