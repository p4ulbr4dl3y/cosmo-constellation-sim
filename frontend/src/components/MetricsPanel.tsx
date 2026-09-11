import React from 'react'
import {
  AlertTriangle,
  Radio,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Server,
} from 'lucide-react'
import type { Scenario, Snapshot, ClientTimeline } from '../types/scenario'

interface MetricsPanelProps {
  scenario: Scenario
  snapshot: Snapshot
  timelines: Record<string, ClientTimeline>
  selectedClientId: string
  onSelectClient: (clientId: string) => void
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  scenario,
  snapshot,
  timelines,
  selectedClientId,
  onSelectClient,
}) => {
  const targetAvailability = scenario.environment.target_availability // 0.90
  const clients = scenario.ground_sites.filter((g) => g.role === 'client')
  const gateway = scenario.ground_sites.find((g) => g.role === 'gateway')

  const selectedTimeline = timelines[selectedClientId]
  const selectedMetrics = selectedTimeline?.metrics
  const activeRoute = snapshot.routes[selectedClientId] || []
  const hasRoute = activeRoute.length > 0
  const outageReason = snapshot.outageReasons[selectedClientId]

  // Check gateway status at current moment
  const isGatewayOutage = scenario.gateway_outages.some(
    (o) => o.gateway_id === (gateway?.id || '') && o.start_s <= snapshot.t_s && snapshot.t_s < o.end_s
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Client Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {clients.map((c) => {
          const tl = timelines[c.id]
          const m = tl?.metrics
          const isSelected = c.id === selectedClientId
          const availPct = m ? (m.availability_ratio * 100).toFixed(1) : '0.0'
          const visPct = m ? (m.visibility_ratio * 100).toFixed(1) : '0.0'
          const meetsTarget = m ? m.availability_ratio >= targetAvailability : false
          const clientRoute = snapshot.routes[c.id] || []
          const isOnlineNow = clientRoute.length > 0

          return (
            <div
              key={c.id}
              onClick={() => onSelectClient(c.id)}
              className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-[#10192a] border-cyan-500/80 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-400/40'
                  : 'bg-[#0b101b] border-[#1e2a3f] hover:border-slate-600'
              }`}
            >
              {/* Top Row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnlineNow ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                    }`}
                  />
                  <span className="font-mono font-bold text-sm text-slate-100">
                    {c.id}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                    {c.lat_deg}°N
                  </span>
                </div>
                <div
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                    meetsTarget
                      ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                      : 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                  }`}
                >
                  {meetsTarget ? (
                    <>
                      <ShieldCheck className="w-3 h-3" />
                      <span>{availPct}%</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3 h-3" />
                      <span>{availPct}%</span>
                    </>
                  )}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-[#131d2e] p-1.5 rounded border border-[#1d2c44]">
                  <span className="text-slate-400 block text-[9px] uppercase">Видимость</span>
                  <span className="font-bold text-slate-200">{visPct}%</span>
                </div>
                <div className="bg-[#131d2e] p-1.5 rounded border border-[#1d2c44]">
                  <span className="text-slate-400 block text-[9px] uppercase">Макс. разрыв</span>
                  <span className="font-bold text-slate-200">
                    {m ? `${Math.round(m.max_gap_s / 60)} мин` : '-'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Client Detailed Breakdown & Active Route Inspector */}
      <div className="bg-[#0b101b] border border-[#1f293d] rounded-xl p-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1f2a3f] pb-2 mb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">
              Текущее состояние маршрута для {selectedClientId} (
              {scenario.ground_sites.find((g) => g.id === selectedClientId)?.name})
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Шлюз Murmansk:</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isGatewayOutage
                  ? 'bg-red-950 text-red-300 border border-red-700'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
              }`}
            >
              {isGatewayOutage ? 'В РЕЖИМЕ ОТКАЗА' : 'В СЕТИ'}
            </span>
          </div>
        </div>

        {/* Route Chain Flow Visualization */}
        {hasRoute ? (
          <div className="bg-[#090e18] p-3 rounded-lg border border-emerald-800/40 flex flex-wrap items-center gap-2">
            {activeRoute.map((nodeId, idx) => {
              const isFirst = idx === 0
              const isLast = idx === activeRoute.length - 1
              const isSat = !isFirst && !isLast

              return (
                <React.Fragment key={idx}>
                  {/* Node pill */}
                  <div
                    className={`px-2.5 py-1 rounded-md font-mono text-xs flex items-center gap-1.5 border shadow-md ${
                      isFirst
                        ? 'bg-amber-950/80 border-amber-600/70 text-amber-200'
                        : isLast
                        ? 'bg-blue-950/80 border-blue-600/70 text-blue-200'
                        : 'bg-[#121c2e] border-cyan-500/60 text-cyan-200'
                    }`}
                  >
                    {isFirst && <span className="text-[10px]">📍</span>}
                    {isLast && <Server className="w-3 h-3 text-blue-300" />}
                    {isSat && <span className="text-[10px]">🛰️</span>}
                    <span className="font-bold">{nodeId}</span>
                  </div>

                  {/* Connecting Arrow */}
                  {!isLast && (
                    <div className="flex items-center text-emerald-400">
                      <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                      <span className="text-[9px] font-mono text-emerald-500/80 ml-0.5">
                        {idx === 0 ? 'Earth-Sat' : idx === activeRoute.length - 2 ? 'Sat-Earth' : 'ISL'}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              )
            })}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400">
                Переходов (хопов):
              </span>
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-mono font-bold text-xs px-2 py-0.5 rounded">
                {activeRoute.length - 1} хопа
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-red-950/30 border border-red-800/60 p-3 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-300 text-xs">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <span className="font-semibold block">Маршрут временно недоступен!</span>
                <span className="text-red-400/90 text-[11px] font-mono">
                  Причина: {outageReason || 'Разрыв в сети спутниковой связи'}
                </span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400 bg-black/40 px-2 py-1 rounded border border-red-900/50">
              0 хопов
            </div>
          </div>
        )}

        {/* Aggregate KPI Strip */}
        {selectedMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1a2538] text-xs font-mono">
            <div className="bg-[#090d16] p-2 rounded border border-[#162033]">
              <span className="text-slate-400 text-[10px] uppercase block">Доступность за сутки</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold text-slate-100">
                  {(selectedMetrics.availability_ratio * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500">/ 90% target</span>
              </div>
            </div>

            <div className="bg-[#090d16] p-2 rounded border border-[#162033]">
              <span className="text-slate-400 text-[10px] uppercase block">Геом. видимость КА</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold text-slate-100">
                  {(selectedMetrics.visibility_ratio * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500">(&gt;= 10°)</span>
              </div>
            </div>

            <div className="bg-[#090d16] p-2 rounded border border-[#162033]">
              <span className="text-slate-400 text-[10px] uppercase block">Макс. перерыв связи</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold text-slate-100">
                  {Math.round(selectedMetrics.max_gap_s / 60)} мин
                </span>
                <span className="text-[10px] text-slate-500">
                  ({selectedMetrics.max_gap_s} с)
                </span>
              </div>
            </div>

            <div className="bg-[#090d16] p-2 rounded border border-[#162033]">
              <span className="text-slate-400 text-[10px] uppercase block">Среднее число хопов</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-sm font-bold text-slate-100">
                  {selectedMetrics.avg_hops.toFixed(1)}
                </span>
                <span className="text-[10px] text-slate-500">хопов/путь</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
