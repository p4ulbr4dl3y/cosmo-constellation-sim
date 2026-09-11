import React from 'react'
import {
  AlertTriangle,
  Radio,
  ArrowRight,
} from 'lucide-react'
import type { Scenario, Snapshot, ClientTimeline } from '../types/scenario'
import { Card, CardHeader, CardTitle, Badge, StatCard } from './ui'

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
      {/* Client Selection Cards */}
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
              className={`p-2.5 rounded-xl border font-mono transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-[#0e131d] border-[#c4f042] shadow-[0_0_16px_rgba(196,240,66,0.12)]'
                  : 'bg-[#0c1017] border-[#182232] hover:border-slate-600 hover:bg-[#101622]'
              }`}
            >
              {/* Top Row */}
              <div className="flex items-center justify-between gap-1.5 mb-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isOnlineNow ? 'bg-[#c4f042] shadow-[0_0_8px_#c4f042]' : 'bg-red-400'
                    }`}
                  />
                  <span className="font-bold text-xs tracking-wider text-slate-100">
                    {c.id}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {c.lat_deg}°N
                  </span>
                </div>
                <Badge variant={meetsTarget ? 'lime' : 'amber'}>
                  {availPct}%
                </Badge>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <div className="bg-[#080b11] p-1.5 rounded-lg border border-[#141b26]">
                  <span className="text-slate-400 block text-[8px] uppercase tracking-wider">ВИДИМОСТЬ</span>
                  <span className="font-semibold text-slate-200">{visPct}%</span>
                </div>
                <div className="bg-[#080b11] p-1.5 rounded-lg border border-[#141b26]">
                  <span className="text-slate-400 block text-[8px] uppercase tracking-wider">MAX GAP</span>
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
      <Card noPadding className="p-3">
        <CardHeader className="pb-2 mb-2.5">
          <CardTitle>
            <Radio className="w-3.5 h-3.5 text-[#c4f042]" />
            <span>МАРШРУТ: {selectedClientId} // {scenario.ground_sites.find((g) => g.id === selectedClientId)?.name}</span>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 text-[10px] uppercase">ШЛЮЗ MUR:</span>
            <Badge variant={isGatewayOutage ? 'red' : 'lime'}>
              {isGatewayOutage ? 'ОТКАЗ' : 'ONLINE'}
            </Badge>
          </div>
        </CardHeader>

        {/* Route Chain Flow Visualization */}
        {hasRoute ? (
          <div className="bg-[#080b11] p-2.5 rounded-lg border border-[#182232] flex flex-wrap items-center gap-1.5">
            {activeRoute.map((nodeId, idx) => {
              const isFirst = idx === 0
              const isLast = idx === activeRoute.length - 1

              return (
                <React.Fragment key={idx}>
                  {/* Node pill */}
                  <div
                    className={`px-2 py-0.5 rounded-md font-mono text-xs flex items-center gap-1 border ${
                      isFirst
                        ? 'bg-amber-950/60 border-amber-600/60 text-amber-300'
                        : isLast
                        ? 'bg-blue-950/60 border-blue-600/60 text-blue-300'
                        : 'bg-[#c4f042]/10 border-[#c4f042]/30 text-[#c4f042]'
                    }`}
                  >
                    <span className="font-bold">{nodeId}</span>
                  </div>

                  {/* Connecting Arrow */}
                  {!isLast && (
                    <div className="flex items-center text-[#c4f042]">
                      <ArrowRight className="w-3 h-3 text-[#c4f042]/80" />
                      <span className="text-[8px] font-mono text-slate-400 mx-0.5">
                        {idx === 0 ? 'GSL' : idx === activeRoute.length - 2 ? 'GSL' : 'ISL'}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              )
            })}

            <div className="ml-auto flex items-center gap-2.5 font-mono text-[10px]">
              {routeLatencyMs && (
                <span className="text-slate-300">
                  RTT <span className="text-[#c4f042] font-semibold">{routeLatencyMs} ms</span>
                </span>
              )}
              <Badge variant="lime">
                {activeRoute.length - 1} HOPS
              </Badge>
            </div>
          </div>
        ) : (
          <div className="bg-red-950/20 border border-red-900/40 p-2.5 rounded-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-300 text-xs font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div>
                <span className="font-semibold block text-[11px]">МАРШРУТ НЕДОСТУПЕН</span>
                <span className="text-red-400/80 text-[10px]">
                  ДИАГНОЗ: {outageReason || 'РАЗРЫВ СЕТИ'}
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded border border-[#182232]">
              0 HOPS
            </span>
          </div>
        )}

        {/* Aggregate KPI Stat Cards */}
        {selectedMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5 pt-2.5 border-t border-[#182232]">
            <StatCard
              variant="compact"
              label="ДОСТУПНОСТЬ (24H)"
              value={`${(selectedMetrics.availability_ratio * 100).toFixed(1)}%`}
              sublabel="/ 90% SLA"
            />
            <StatCard
              variant="compact"
              label="ВИДИМОСТЬ КА"
              value={`${(selectedMetrics.visibility_ratio * 100).toFixed(1)}%`}
              sublabel="(>=10°)"
            />
            <StatCard
              variant="compact"
              label="MAX GAP"
              value={`${Math.round(selectedMetrics.max_gap_s / 60)} мин`}
              sublabel={`(${selectedMetrics.max_gap_s}s)`}
            />
            <StatCard
              variant="compact"
              label="СРЕДНЕЕ ХОПОВ"
              value={selectedMetrics.avg_hops.toFixed(1)}
              sublabel="hops/path"
            />
          </div>
        )}
      </Card>
    </div>
  )
}
