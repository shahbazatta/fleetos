import React, { useEffect, useState } from 'react';
import { ArrowLeft, Gauge, Fuel, Activity, MapPin, User, Wrench, Clock } from 'lucide-react';
import { useFleetStore } from '../../store/fleetStore';
import { STATUS_COLOR, scoreColor, fuelColor, timeAgo } from '../../utils/colors';
import api from '../../services/api';

interface Props { vehicleId: string; onBack: () => void; }

export default function VehicleDetail({ vehicleId, onBack }: Props) {
  const { vehicles, showTrails, setShowTrails } = useFleetStore();
  const vehicle = vehicles.find(v => v.id === vehicleId);
  const [detail, setDetail] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'alerts' | 'trips'>('info');

  useEffect(() => {
    api.get(`/vehicles/${vehicleId}`).then(({ data }) => setDetail(data)).catch(() => {});
  }, [vehicleId]);

  if (!vehicle) return null;

  const statBox = (icon: React.ReactNode, label: string, value: string | number, color?: string) => (
    <div style={{
      flex: 1, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
      borderRadius: 8, padding: '10px 12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#5d7a9a', fontSize: 10, marginBottom: 5, fontFamily: 'DM Sans, sans-serif' }}>
        {icon}{label.toUpperCase()}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: color || '#e8eaf0' }}>
        {value}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5d7a9a', padding: 0, display: 'flex' }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: '#00d4e8' }}>
                {vehicle.registration}
              </span>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, fontFamily: 'DM Sans, sans-serif',
                background: `${STATUS_COLOR[vehicle.status]}22`,
                color: STATUS_COLOR[vehicle.status],
              }}>
                {vehicle.status.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#8da4c2', fontFamily: 'DM Sans, sans-serif', marginTop: 2 }}>
              {vehicle.make} {vehicle.model} • {vehicle.year}
            </div>
          </div>
          <button
            onClick={() => setShowTrails(!showTrails)}
            title="Show trail"
            style={{
              padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
              fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
              background: showTrails ? 'rgba(0,212,232,.2)' : 'rgba(255,255,255,.05)',
              color: showTrails ? '#00d4e8' : '#8da4c2',
            }}
          >
            Trail
          </button>
        </div>
      </div>

      {/* Live stats */}
      <div style={{ padding: '12px 14px', display: 'flex', gap: 6, flexShrink: 0 }}>
        {statBox(<Gauge size={11} />, 'Speed', `${Math.round(vehicle.current_speed)} km/h`, vehicle.current_speed > 0 ? '#22c55e' : '#5d7a9a')}
        {statBox(<Fuel size={11} />, 'Fuel', `${Math.round(vehicle.current_fuel)}%`, fuelColor(vehicle.current_fuel))}
        {statBox(<Activity size={11} />, 'Health', `${Math.round(vehicle.health_score)}`, scoreColor(vehicle.health_score))}
      </div>

      {/* Driver card */}
      {vehicle.driver_name && (
        <div style={{
          margin: '0 14px 12px', padding: '10px 12px',
          background: 'rgba(0,212,232,.05)', border: '1px solid rgba(0,212,232,.15)',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'rgba(0,212,232,.15)', border: '1px solid rgba(0,212,232,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={16} style={{ color: '#00d4e8' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eaf0', fontFamily: 'DM Sans, sans-serif' }}>
              {vehicle.driver_name}
            </div>
            <div style={{ fontSize: 10, color: '#5d7a9a', fontFamily: 'DM Sans, sans-serif' }}>
              {vehicle.driver_phone || 'No phone'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: scoreColor(vehicle.driver_score || 0) }}>
              {vehicle.driver_score ?? '—'}
            </div>
            <div style={{ fontSize: 9, color: '#5d7a9a', letterSpacing: 1 }}>SAFETY</div>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div style={{ display: 'flex', padding: '0 14px', gap: 0, borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
        {(['info','alerts','trips'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === tab ? '2px solid #00d4e8' : '2px solid transparent',
            color: activeTab === tab ? '#00d4e8' : '#5d7a9a',
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
            fontFamily: 'DM Sans, sans-serif',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {activeTab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Odometer', `${Math.round(vehicle.current_odometer).toLocaleString()} km`],
              ['Heading', `${Math.round(vehicle.current_heading)}°`],
              ['Engine', vehicle.engine_on ? 'Running' : 'Off'],
              ['Depot', vehicle.depot_name || '—'],
              ['Last seen', vehicle.last_seen ? timeAgo(vehicle.last_seen) : '—'],
              ['Health score', `${Math.round(vehicle.health_score)} / 100`],
              ['Max speed', `${vehicle.max_speed} km/h`],
              ['Fuel capacity', `${vehicle.fuel_capacity} L`],
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#5d7a9a', fontFamily: 'DM Sans, sans-serif' }}>{label}</span>
                <span style={{ fontSize: 12, color: '#e8eaf0', fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
              </div>
            ))}

            {detail?.maintenance?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: '#5d7a9a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, fontFamily: 'DM Sans, sans-serif' }}>
                  Maintenance
                </div>
                {detail.maintenance.slice(0,3).map((m: any) => (
                  <div key={m.id} style={{
                    padding: '8px 10px', background: 'rgba(255,255,255,.02)',
                    border: '1px solid rgba(255,255,255,.05)', borderRadius: 6, marginBottom: 4,
                  }}>
                    <div style={{ fontSize: 12, color: '#e8eaf0', fontFamily: 'DM Sans, sans-serif' }}>{m.type}</div>
                    <div style={{ fontSize: 10, color: '#5d7a9a', marginTop: 2 }}>
                      {m.scheduled_date} • {m.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div>
            {(detail?.alerts || []).length === 0 && (
              <div style={{ color: '#5d7a9a', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>No recent alerts</div>
            )}
            {(detail?.alerts || []).map((a: any) => (
              <div key={a.id} style={{
                padding: '8px 10px', marginBottom: 4,
                background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)',
                borderRadius: 6,
                borderLeft: `3px solid ${a.severity === 'critical' ? '#ef4444' : a.severity === 'warning' ? '#f59e0b' : '#00d4e8'}`,
              }}>
                <div style={{ fontSize: 12, color: '#e8eaf0', fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}>{a.title}</div>
                <div style={{ fontSize: 10, color: '#5d7a9a', marginTop: 2 }}>{timeAgo(a.occurred_at)}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'trips' && (
          <div>
            {(detail?.trips || []).length === 0 && (
              <div style={{ color: '#5d7a9a', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>No recent trips</div>
            )}
            {(detail?.trips || []).map((t: any) => (
              <div key={t.id} style={{
                padding: '10px 12px', marginBottom: 4,
                background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)',
                borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#00d4e8', fontFamily: 'JetBrains Mono, monospace' }}>
                    {t.distance_km ? `${t.distance_km} km` : 'In progress'}
                  </span>
                  <span style={{ fontSize: 10, color: '#5d7a9a' }}>{t.duration_mins} min</span>
                </div>
                <div style={{ fontSize: 10, color: '#5d7a9a', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>
                  {t.origin_address || 'Unknown'} → {t.dest_address || 'Unknown'}
                </div>
                {t.started_at && <div style={{ fontSize: 9, color: '#3a5070', marginTop: 2 }}>{timeAgo(t.started_at)}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
