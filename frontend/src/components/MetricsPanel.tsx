import React from 'react'
import {
  AlertTriangle,
  Radio,
  ArrowRight,
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
  const activeRoute = React.useMemo(() => snapshot.routes[selectedClientId] || [], [snapshot.routes, selectedClientId])
  const hasRoute = activeRoute.length > 0
  const outageReason = snapshot.outageReasons[selectedClientId]

  // Check gateway status at current moment
  const isGatewayOutage = scenario.gateway_outages.some(
    (o) => o.gateway_id === (gateway?.id || '') && o.start_s <= snapshot.t_s && snapshot.t_s < o.end_s
  )

  // Calculate approximate path latency in milliseconds (speed of light c ≈ 300,000 km/s)
  const routeDistanceKm = React.useMemo(() => {
    if (activeRoute.length < 2) return 0
    let totalDist = 0
    for (let i = 0; i < activeRoute.length - 1; i++) {
      const u = activeRoute[i]
      const v = activeRoute[i + 1]
      const getCoords = (id: string): [number, number, number] | null => {
        const sat = snapshot.satellites.find((s) => s.id === id)
        if (sat) return [sat.x_km, sat.y_km, sat.z_km]
        const ground = scenario.ground_sites.find((g) => g.id === id)
        if (ground) {
          const r = 6378.137
          const latRad = (ground.lat_deg * Math.PI) / 180
          const lonRad = (ground.lon_deg * Math.PI) / 180
          return [r * Math.cos(latRad) * Math.cos(lonRad), r * Math.cos(latRad) * Math.sin(lonRad), r * Math.sin(latRad)]
        }
        return null
      }
      const c1 = getCoords(u)
      const c2 = getCoords(v)
      if (c1 && c2) {
        totalDist += Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2])
      }
    }
    return totalDist
  }, [activeRoute, snapshot.satellites, scenario.ground_sites])

  const routeLatencyMs = routeDistanceKm > 0 ? ((routeDistanceKm / 300000) * 1000 * 2).toFixed(1) : null // RTT ms

  return (
    <div className="flex flex-col gap-2.5">
      {/* Client Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
              className={`p-2.5 rounded-lg border font-mono transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-[#0b1322] border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/40'
                  : 'bg-[#080d17] border-[#162238] hover:border-slate-600 hover:bg-[#0c1424]'
              }`}
            >
              {/* Top Row */}
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isOnlineNow ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-400'
                    }`}
                  />
                  <span className="font-bold text-xs tracking-wider text-slate-100">
                    {c.id}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {c.lat_deg}°N
                  </span>
                </div>
                <div
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                    meetsTarget
                      ? 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
                      : 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                  }`}
                >
                  <span>{availPct}%</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="bg-[#050810] p-1.5 rounded border border-[#141e30]">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">ВИДИМОСТЬ</span>
                  <span className="font-semibold text-slate-200">{visPct}%</span>
                </div>
                <div className="bg-[#050810] p-1.5 rounded border border-[#141e30]">
                  <span className="text-slate-500 block text-[8px] uppercase tracking-wider">MAX GAP</span>
                  <span className="font-semibold text-slate-200">
                    {m ? `${Math.round(m.max_gap_s / 60)}m` : '-'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Client Detailed Breakdown & Active Route Inspector */}
      <div className="bg-[#080d17] border border-[#162238] rounded-lg p-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#162238] pb-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-mono font-semibold tracking-wide text-slate-200">
              МАРШРУТ: {selectedClientId} // {scenario.ground_sites.find((g) => g.id === selectedClientId)?.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-500 text-[10px] uppercase">ШЛЮЗ MURMANSK:</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                isGatewayOutage
                  ? 'bg-red-950/80 text-red-300 border-red-700/60'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
              }`}
            >
              {isGatewayOutage ? 'ОТКАЗ' : 'ONLINE'}
            </span>
          </div>
        </div>

        {/* Route Chain Flow Visualization */}
        {hasRoute ? (
          <div className="bg-[#050810] p-2.5 rounded border border-emerald-900/40 flex flex-wrap items-center gap-1.5">
            {activeRoute.map((nodeId, idx) => {
              const isFirst = idx === 0
              const isLast = idx === activeRoute.length - 1

              return (
                <React.Fragment key={idx}>
                  {/* Node pill */}
                  <div
                    className={`px-2 py-0.5 rounded font-mono text-xs flex items-center gap-1 border ${
                      isFirst
                        ? 'bg-amber-950/60 border-amber-600/60 text-amber-300'
                        : isLast
                        ? 'bg-blue-950/60 border-blue-600/60 text-blue-300'
                        : 'bg-[#0d1728] border-cyan-500/50 text-cyan-200'
                    }`}
                  >
                    <span className="font-bold">{nodeId}</span>
                  </div>

                  {/* Connecting Arrow */}
                  {!isLast && (
                    <div className="flex items-center text-emerald-400">
                      <ArrowRight className="w-3 h-3 text-emerald-400/80" />
                      <span className="text-[8px] font-mono text-emerald-500/80 mx-0.5">
                        {idx === 0 ? 'GSL' : idx === activeRoute.length - 2 ? 'GSL' : 'ISL'}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              )
            })}

            <div className="ml-auto flex items-center gap-3 font-mono text-[10px]">
              {routeLatencyMs && (
                <span className="text-cyan-400">
                  RTT ~{routeLatencyMs} ms
                </span>
              )}
              <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.5 rounded font-bold">
                {activeRoute.length - 1} HOPS
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-red-950/20 border border-red-900/50 p-2.5 rounded flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-300 text-xs font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div>
                <span className="font-semibold block text-[11px]">МАРШРУТ НЕДОСТУПЕН</span>
                <span className="text-red-400/80 text-[10px]">
                  ДИАГНОЗ: {outageReason || 'РАЗРЫВ СЕТИ'}
                </span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-slate-500 bg-black/40 px-2 py-0.5 rounded border border-red-900/40">
              0 HOPS
            </div>
          </div>
        )}

        {/* Aggregate KPI Strip */}
        {selectedMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5 pt-2.5 border-t border-[#162238] text-xs font-mono">
            <div className="bg-[#050810] p-2 rounded border border-[#141e30]">
              <span className="text-slate-500 text-[8px] uppercase tracking-wider block">ДОСТУПНОСТЬ (24H)</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xs font-bold text-slate-100">
                  {(selectedMetrics.availability_ratio * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] text-slate-500">/ 90% SLA</span>
              </div>
            </div>

            <div className="bg-[#050810] p-2 rounded border border-[#141e30]">
              <span className="text-slate-500 text-[8px] uppercase tracking-wider block">ВИДИМОСТЬ КА</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xs font-bold text-slate-100">
                  {(selectedMetrics.visibility_ratio * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] text-slate-500">(&gt;=10°)</span>
              </div>
            </div>

            <div className="bg-[#050810] p-2 rounded border border-[#141e30]">
              <span className="text-slate-500 text-[8px] uppercase tracking-wider block">MAX GAP ДЛИТ.</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xs font-bold text-slate-100">
                  {Math.round(selectedMetrics.max_gap_s / 60)} мин
                </span>
                <span className="text-[9px] text-slate-500">
                  ({selectedMetrics.max_gap_s}s)
                </span>
              </div>
            </div>

            <div className="bg-[#050810] p-2 rounded border border-[#141e30]">
              <span className="text-slate-500 text-[8px] uppercase tracking-wider block">СРЕДНЕЕ ХОПОВ</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xs font-bold text-slate-100">
                  {selectedMetrics.avg_hops.toFixed(1)}
                </span>
                <span className="text-[9px] text-slate-500">hops/path</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
