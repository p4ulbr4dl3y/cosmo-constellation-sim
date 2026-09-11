import React, { useMemo } from 'react'
import {
  AlertTriangle,
  Radio,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
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

/** Human-readable diagnosis & actionable suggestions for network failure */
function getDiagnosis(reason?: string, isGatewayOutage?: boolean) {
  if (isGatewayOutage || (reason && reason.includes('Шлюз отключен'))) {
    return {
      title: 'Технологическое окно шлюза',
      detail: 'Опорный шлюз G_MUR временно отключен согласно регламенту обслуживания.',
      recommendation: 'Дождитесь завершения планового технологического окна шлюза.',
    }
  }
  if (
    reason &&
    (reason.includes('Нет спутников над шлюзом') || reason.includes('no_gateway_satellite'))
  ) {
    return {
      title: 'Нет КА над шлюзом',
      detail: 'В радиовидимости опорного шлюза Мурманск отсутствуют спутники с углом места ≥ 10°.',
      recommendation: 'Ожидайте захода КА орбитальной плоскости в приполярный сектор Мурманска.',
    }
  }
  if (
    reason &&
    (reason.includes('Нет спутников') || reason.includes('no_client_satellite'))
  ) {
    return {
      title: 'Терминал вне зоны радиовидимости',
      detail: 'Над выбранным терминалом отсутствуют активные КА с углом места ≥ 10°.',
      recommendation: 'Ожидайте пролета очередного спутника или увеличьте число КА в группировке.',
    }
  }
  if (
    reason &&
    (reason.includes('ISL') || reason.includes('рассоединен') || reason.includes('isl_disconnected'))
  ) {
    return {
      title: 'Разрыв межспутникового сегмента',
      detail: 'Граф межспутниковых линий (ISL) рассоединен, сквозной путь до шлюза отсутствует.',
      recommendation: 'Проверьте состояние отказавших КА или скорректируйте лимит дальности ISL.',
    }
  }
  return {
    title: 'Маршрут не построен',
    detail: reason || 'Сетевой путь между клиентом и опорным шлюзом временно разорван.',
    recommendation: 'Ожидайте изменения взаимной орбитальной геометрии группировки.',
  }
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  scenario,
  snapshot,
  timelines,
  selectedClientId,
  onSelectClient,
}) => {
  const targetAvailability = scenario.environment.target_availability ?? 0.9
  const clients = useMemo(
    () => scenario.ground_sites.filter((g) => g.role === 'client'),
    [scenario.ground_sites]
  )
  const gateway = useMemo(
    () => scenario.ground_sites.find((g) => g.role === 'gateway'),
    [scenario.ground_sites]
  )

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || clients[0],
    [clients, selectedClientId]
  )

  const selectedTimeline = timelines[selectedClientId]
  const selectedMetrics = selectedTimeline?.metrics
  const activeRoute = useMemo(
    () => snapshot.routes[selectedClientId] || [],
    [snapshot.routes, selectedClientId]
  )
  const hasRoute = activeRoute.length > 0
  const outageReason = snapshot.outageReasons[selectedClientId]

  // Check gateway status at current simulation step
  const isGatewayOutage = scenario.gateway_outages.some(
    (o) =>
      o.gateway_id === (gateway?.id || '') &&
      o.start_s <= snapshot.t_s &&
      snapshot.t_s < o.end_s
  )

  // Calculate approximate path round-trip time in milliseconds (c ≈ 300,000 km/s)
  const routeLatencyMs = useMemo(() => {
    if (activeRoute.length < 2) return null
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
          return [
            r * Math.cos(latRad) * Math.cos(lonRad),
            r * Math.cos(latRad) * Math.sin(lonRad),
            r * Math.sin(latRad),
          ]
        }
        return null
      }
      const c1 = getCoords(u)
      const c2 = getCoords(v)
      if (c1 && c2) {
        totalDist += Math.hypot(c1[0] - c2[0], c1[1] - c2[1], c1[2] - c2[2])
      }
    }
    return ((totalDist / 300000) * 1000 * 2).toFixed(1)
  }, [activeRoute, snapshot.satellites, scenario.ground_sites])

  const targetPct = Math.round(targetAvailability * 100)
  const availRatio = selectedMetrics?.availability_ratio ?? 0
  const availPct = (availRatio * 100).toFixed(1)
  const meetsTarget = availRatio >= targetAvailability

  const diagnosis = getDiagnosis(outageReason, isGatewayOutage)

  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. Concise Client Selection Tabs */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0c1017] border border-white/10 rounded-xl">
        {clients.map((c) => {
          const tl = timelines[c.id]
          const m = tl?.metrics
          const isSelected = c.id === selectedClientId
          const clientAvail = m ? (m.availability_ratio * 100).toFixed(1) : '0.0'
          const clientMeetsTarget = m ? m.availability_ratio >= targetAvailability : false
          const clientRoute = snapshot.routes[c.id] || []
          const isOnlineNow = clientRoute.length > 0

          return (
            <button
              key={c.id}
              onClick={() => onSelectClient(c.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg font-mono transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white/10 text-white border border-white/20 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isOnlineNow ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                  {c.id}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold ${
                  clientMeetsTarget ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {clientAvail}%
              </span>
            </button>
          )
        })}
      </div>

      {/* 2. Client Details Card */}
      <Card noPadding className="p-3">
        {/* Header & Gateway Status */}
        <CardHeader className="pb-2 mb-2.5">
          <CardTitle>
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {selectedClient?.id} · {selectedClient?.name?.split('(')[0]?.trim() || selectedClientId}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 text-[10px] uppercase">Шлюз MUR:</span>
            <Badge variant={isGatewayOutage ? 'red' : 'emerald'}>
              {isGatewayOutage ? 'ОТКАЗ' : 'ONLINE'}
            </Badge>
          </div>
        </CardHeader>

        {/* Current Route or Outage Diagnosis */}
        <div className="mb-3">
          {hasRoute ? (
            <div className="bg-[#080b11] p-2.5 rounded-lg border border-white/10 flex flex-wrap items-center gap-1.5">
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
                          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      }`}
                    >
                      <span className="font-bold">{nodeId}</span>
                    </div>

                    {/* Connecting Arrow */}
                    {!isLast && (
                      <div className="flex items-center text-slate-400">
                        <ArrowRight className="w-3 h-3 text-cyan-400/80" />
                        <span className="text-[8px] font-mono text-slate-500 mx-0.5">
                          {idx === 0 ? 'GSL' : idx === activeRoute.length - 2 ? 'GSL' : 'ISL'}
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                )
              })}

              <div className="ml-auto flex items-center gap-2 font-mono text-[10px]">
                {routeLatencyMs && (
                  <span className="text-slate-300">
                    RTT <span className="text-cyan-400 font-semibold">{routeLatencyMs} ms</span>
                  </span>
                )}
                <Badge variant="cyan">
                  {activeRoute.length - 1} {activeRoute.length - 1 === 1 ? 'HOP' : 'HOPS'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="bg-red-950/20 border border-red-900/40 p-2.5 rounded-lg space-y-1.5 font-mono">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-red-300 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>МАРШРУТ РАЗОРВАН (OFFLINE)</span>
                </div>
                <span className="text-[10px] text-slate-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                  0 HOPS
                </span>
              </div>
              <div className="text-[11px] text-slate-300">
                <span className="text-red-400 font-semibold">Причина: </span>
                {diagnosis.title} — {diagnosis.detail}
              </div>
              <div className="text-[10px] text-slate-400 bg-black/30 p-1.5 rounded border border-white/5">
                <span className="text-cyan-400 font-semibold">Рекомендация: </span>
                {diagnosis.recommendation}
              </div>
            </div>
          )}
        </div>

        {/* 3. Compact 2x2 Key Metrics Grid */}
        {selectedMetrics && (
          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/10">
            <StatCard
              variant="compact"
              label="Доступность SLA (24ч)"
              value={`${availPct}%`}
              sublabel={`Цель ≥${targetPct}%`}
              badge={
                meetsTarget ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-amber-400" />
                )
              }
            />
            <StatCard
              variant="compact"
              label="Видимость КА"
              value={`${(selectedMetrics.visibility_ratio * 100).toFixed(1)}%`}
              sublabel="Угол места ≥10°"
              badge={<HelpCircle className="w-3.5 h-3.5 text-slate-500" />}
            />
            <StatCard
              variant="compact"
              label="Max Gap (простой)"
              value={`${Math.round(selectedMetrics.max_gap_s / 60)} мин`}
              sublabel={`макс. ${selectedMetrics.max_gap_s}с`}
            />
            <StatCard
              variant="compact"
              label="Среднее хопов"
              value={selectedMetrics.avg_hops.toFixed(1)}
              sublabel="на активный путь"
            />
          </div>
        )}
      </Card>
    </div>
  )
}
