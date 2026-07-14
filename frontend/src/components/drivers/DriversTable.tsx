import React from 'react';
import { useFleetStore } from '../../store/fleetStore';
import { scoreColor, STATUS_COLOR } from '../../utils/colors';

// Optional: Define a type for better safety (add this at the top if you want)
type VehicleStatus = keyof typeof STATUS_COLOR | string | null;

function ScoreBar({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--bdr-08)', borderRadius: 2 }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 2, transition: 'width .5s' }} />
      </div>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color, width: 32, textAlign: 'right' }}>
        {Math.round(score)}
      </span>
    </div>
  );
}

export default function DriversTable() {
  const { drivers } = useFleetStore();
  const sorted = [...drivers].sort((a, b) => (b.current_score || b.safety_score) - (a.current_score || a.safety_score));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bdr-06)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--txt-3)', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif' }}>
          Safety Leaderboard — {drivers.length} drivers
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {sorted.map((d, idx) => {
          const score = d.current_score || d.safety_score;
          const rankColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--txt-4)';

          return (
            <div key={d.id} style={{
              padding: '10px 12px', marginBottom: 3, borderRadius: 8,
              background: 'var(--fill-02)', border: '1px solid var(--fill-04)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {/* Rank */}
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: rankColor, width: 22, textAlign: 'center', fontWeight: 700 }}>
                {String(idx + 1).padStart(2, '0')}
              </div>

              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--acc-12)', border: '1px solid var(--acc-25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: 'var(--acc)', fontFamily: 'DM Sans, sans-serif',
                flexShrink: 0,
              }}>
                {d.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>

              {/* Info + bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-1)', fontFamily: 'DM Sans, sans-serif' }}>
                    {d.full_name}
                  </span>
                  {d.vehicle_reg && (
                    <span style={{ fontSize: 9, color: 'var(--acc)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {d.vehicle_reg}
                    </span>
                  )}
                </div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: d.status === 'active' ? 'rgba(34,197,94,.15)' : 'rgba(100,116,139,.15)',
                    color: d.status === 'active' ? '#22c55e' : '#64748b',
                    fontFamily: 'DM Sans, sans-serif', fontWeight: 600,
                  }}>
                    {d.status}
                  </span>

                  {/* Vehicle Status */}
                  {('vehicle_status' in d && d.vehicle_status != null) && (
                    <div
                      style={{
                        backgroundColor: `${
                          STATUS_COLOR[d.vehicle_status as keyof typeof STATUS_COLOR] || '#64748b'
                        }22`,
                        color: STATUS_COLOR[d.vehicle_status as keyof typeof STATUS_COLOR] || '#64748b',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 500,
                        display: 'inline-block',
                      }}
                    >
                      Vehicle: {String(d.vehicle_status)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--txt-3)', fontSize: 13, paddingTop: 40, fontFamily: 'DM Sans, sans-serif' }}>
            No drivers loaded
          </div>
        )}
      </div>
    </div>
  );
}