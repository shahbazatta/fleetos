import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useFleetStore } from '../../store/fleetStore';
import { scoreColor, STATUS_COLOR } from '../../utils/colors';
import api from '../../services/api';

const chartStyle = { fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: 'var(--txt-3)' };

export default function AnalyticsPanel() {
  const { summary, vehicles, drivers } = useFleetStore();
  const [fuelTrend, setFuelTrend] = useState<any[]>([]);

  useEffect(() => {
    api.get('/analytics/fuel-trend?days=1').then(({ data }) => {
      setFuelTrend(data.trend.map((t: any) => ({
        time: new Date(t.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fuel: parseFloat(t.avg_fuel),
        speed: parseFloat(t.avg_speed),
        vehicles: parseInt(t.active_vehicles),
      })));
    }).catch(() => {});
  }, []);

  const v = summary?.vehicles;

  const statusData = v ? [
    { name: 'Active',  value: v.active,      color: STATUS_COLOR.active },
    { name: 'Idle',    value: v.idle,         color: STATUS_COLOR.idle },
    { name: 'Offline', value: v.offline,      color: STATUS_COLOR.offline },
    { name: 'Maint.',  value: v.maintenance,  color: STATUS_COLOR.maintenance },
  ] : [];

  const driverScoreData = drivers
    .slice(0, 8)
    .sort((a, b) => b.safety_score - a.safety_score)
    .map(d => ({
      name: d.full_name.split(' ')[0],
      score: Math.round(d.current_score || d.safety_score),
    }));

  const kpi = (label: string, value: string | number, sub?: string, color?: string) => (
    <div style={{
      background: 'var(--fill-03)', border: '1px solid var(--bdr-06)',
      borderRadius: 8, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 9, color: 'var(--txt-3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontFamily: 'DM Sans, sans-serif' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: color || 'var(--txt-1)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 4, fontFamily: 'DM Sans, sans-serif' }}>{sub}</div>}
    </div>
  );

  const section = (title: string) => (
    <div style={{ fontSize: 10, color: 'var(--txt-3)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, fontFamily: 'DM Sans, sans-serif', marginTop: 4 }}>
      {title}
    </div>
  );

  const tooltipStyle = {
    contentStyle: { background: 'var(--srf-1)', border: '1px solid var(--acc-20)', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--txt-1)' },
    labelStyle: { color: 'var(--txt-2)' },
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI grid */}
      <div>
        {section('Fleet Overview')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {kpi('Total Vehicles', v?.total ?? '—')}
          {kpi('Active Now', v?.active ?? '—', undefined, '#22c55e')}
          {kpi('Avg Speed', v?.avg_speed ? `${v.avg_speed}` : '—', 'km/h', 'var(--acc)')}
          {kpi('Avg Fuel', v?.avg_fuel ? `${v.avg_fuel}%` : '—', undefined, v?.avg_fuel && v.avg_fuel < 30 ? '#ef4444' : 'var(--txt-1)')}
          {kpi('Safety Score', summary?.drivers.avg_safety_score ?? '—', 'fleet avg', scoreColor(summary?.drivers.avg_safety_score || 0))}
          {kpi('Alerts Today', summary?.alerts.today ?? '—', `${summary?.alerts.critical ?? 0} critical`, summary?.alerts.critical ? '#ef4444' : 'var(--txt-1)')}
        </div>
      </div>

      {/* Status breakdown bar */}
      {statusData.length > 0 && (
        <div>
          {section('Status Breakdown')}
          <div style={{ height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} barSize={28}>
                <XAxis dataKey="name" tick={chartStyle} axisLine={false} tickLine={false} />
                <YAxis tick={chartStyle} axisLine={false} tickLine={false} width={24} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" radius={[4,4,0,0]}>
                  {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Fuel trend chart */}
      {fuelTrend.length > 0 && (
        <div>
          {section('Fuel Level — Last 24h')}
          <div style={{ height: 110 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fuelTrend}>
                <defs>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--acc)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--acc)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={chartStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={chartStyle} axisLine={false} tickLine={false} width={24} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="fuel" stroke="var(--acc)" strokeWidth={2} fill="url(#fuelGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Speed trend */}
      {fuelTrend.length > 0 && (
        <div>
          {section('Avg Speed — Last 24h')}
          <div style={{ height: 100 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fuelTrend}>
                <defs>
                  <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a3e635" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a3e635" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={chartStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={chartStyle} axisLine={false} tickLine={false} width={24} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="speed" stroke="#a3e635" strokeWidth={2} fill="url(#speedGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Driver scores */}
      {driverScoreData.length > 0 && (
        <div>
          {section('Driver Safety Scores')}
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={driverScoreData} barSize={18} layout="horizontal">
                <XAxis dataKey="name" tick={{ ...chartStyle, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={chartStyle} axisLine={false} tickLine={false} width={24} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="score" radius={[3,3,0,0]}>
                  {driverScoreData.map((d, i) => (
                    <Cell key={i} fill={scoreColor(d.score)} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
