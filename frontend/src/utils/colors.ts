import type { VehicleStatus, AlertSeverity, VehicleType } from '../types';

export const STATUS_COLOR: Record<VehicleStatus, string> = {
  active:      '#22c55e',
  idle:        '#f59e0b',
  offline:     '#64748b',
  maintenance: '#a855f7',
  alert:       '#ef4444',
};

export const STATUS_BG: Record<VehicleStatus, string> = {
  active:      'rgba(34,197,94,0.15)',
  idle:        'rgba(245,158,11,0.15)',
  offline:     'rgba(100,116,139,0.15)',
  maintenance: 'rgba(168,85,247,0.15)',
  alert:       'rgba(239,68,68,0.15)',
};

export const SEVERITY_COLOR: Record<AlertSeverity, string> = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#00d4e8',
};

export const SEVERITY_BG: Record<AlertSeverity, string> = {
  critical: 'rgba(239,68,68,0.15)',
  warning:  'rgba(245,158,11,0.15)',
  info:     'rgba(0,212,232,0.12)',
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
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

export function fuelColor(pct: number): string {
  if (pct > 40) return '#22c55e';
  if (pct > 15) return '#f59e0b';
  return '#ef4444';
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
