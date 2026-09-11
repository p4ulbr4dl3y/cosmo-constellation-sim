import React, { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Crosshair,
  ZapOff,
} from 'lucide-react'
import type { Scenario, Snapshot, ClientTimeline } from '../types/scenario'
import { StatCard } from './ui'

interface MetricsPanelProps {
  scenario: Scenario
  snapshot: Snapshot
  timelines: Record<string, ClientTimeline>
  selectedClientId: string
  onSelectClient: (clientId: string) => void
  onToggleFailure?: (satId: string) => void
}

/** Human-readable diagnosis & actionable suggestions for network failure */
function getDiagnosis(reason?: string, isGatewayOutage?: boolean) {
  // 1. no_client_satellite: terminal has no visible satellites
  if (
    reason &&
    (reason.includes('no_client_satellite') ||
      (reason.includes('Нет спутников над') && !reason.includes('над шлюзом')))
  ) {
    return {
      title: 'Терминал вне зоны радиовидимости',
      detail: 'Над выбранным терминалом отсутствуют активные КА с углом места ≥ 10°.',
      recommendation: 'Ожидайте пролета очередного спутника или увеличьте число КА в группировке.',
    }
  }

  // 2. gateway_offline: gateway maintenance outage window
  if (
    isGatewayOutage ||
    (reason && (reason.includes('Шлюз отключен') || reason.includes('gateway_offline')))
  ) {
    return {
      title: 'Технологическое окно шлюза',
      detail: 'Опорный шлюз G_MUR временно отключен согласно регламенту обслуживания.',
      recommendation: 'Дождитесь завершения планового технологического окна шлюза.',
    }
  }

  // 3. no_gateway_satellite: gateway online but no satellites in its footprint
  if (
    reason &&
    (reason.includes('над шлюзом') || reason.includes('no_gateway_satellite'))
  ) {
    return {
      title: 'Нет КА над шлюзом',
      detail: 'В радиовидимости опорного шлюза Мурманск отсутствуют спутники с углом места ≥ 10°.',
      recommendation: 'Ожидайте захода КА орбитальной плоскости в приполярный сектор Мурманска.',
    }
  }

  // 4. isl_disconnected: both sites see sats, but ISL mesh is disconnected
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
  onToggleFailure,
}) => {
  const targetAvailability = scenario.environment.target_availability ?? 0.9
  const clients = useMemo(
    () => scenario.ground_sites.filter((g) => g.role === 'client'),
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
    (o) => o.start_s <= snapshot.t_s && snapshot.t_s < o.end_s
  )

  // Approximate route latency (RTT) based on geometry
  const routeLatencyMs = useMemo(() => {
    if (activeRoute.length < 2) return null
    let totalDist = 0
    for (let i = 0; i < activeRoute.length - 1; i++) {
      const u = activeRoute[i]
      const v = activeRoute[i + 1]
      const getCoords = (nodeId: string): [number, number, number] | null => {
        const sat = snapshot.satellites.find((s) => s.id === nodeId)
        if (sat) return [sat.x_km, sat.y_km, sat.z_km]
        const ground = scenario.ground_sites.find((g) => g.id === nodeId)
        if (ground) {
          const r = 6371
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

  // Prime satellite on route (first sat client links to)
  const primeSatId = activeRoute.find((n) => n.startsWith('S'))
  const primeSat = primeSatId ? snapshot.satellites.find((s) => s.id === primeSatId) : null

  return (
    <div className="h-full flex flex-col gap-2 font-mono text-xs overflow-y-auto">
      {/* 1. Client Selection Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-[#0c1017] border border-white/10 rounded-xl shrink-0">
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
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isOnlineNow ? 'bg-emerald-400' : 'bg-rose-500'
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

      {/* 2. Client Details & Route Card */}
      <div className="flex-1 flex flex-col bg-[#0c1017] p-2.5 rounded-xl border border-white/10 gap-2 overflow-y-auto">
        {/* Header & Gateway Status */}
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10 shrink-0">
          <span className="font-bold text-slate-200 text-xs">
            {selectedClient?.id} · {selectedClient?.name?.split('(')[0]?.trim() || selectedClientId}
          </span>
          {isGatewayOutage && (
            <span className="text-rose-400 font-bold bg-rose-950/50 border border-rose-800/50 px-1.5 py-0.5 rounded text-[10px]">
              ШЛЮЗ: ТЕХОКНО
            </span>
          )}
        </div>

        {/* Current Route or Outage Diagnosis */}
        <div className="shrink-0">
          {hasRoute ? (
            <div className="bg-black/40 p-2 rounded-lg border border-white/10 flex flex-wrap items-center gap-1.5">
              {activeRoute.map((nodeId, idx) => {
                const isFirst = idx === 0
                const isLast = idx === activeRoute.length - 1

                return (
                  <React.Fragment key={idx}>
                    <div
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${
                        isFirst
                          ? 'bg-amber-950/40 border-amber-600/40 text-amber-300'
                          : isLast
                          ? 'bg-blue-950/40 border-blue-600/40 text-blue-300'
                          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      }`}
                    >
                      {nodeId}
                    </div>

                    {!isLast && (
                      <div className="flex items-center text-slate-500">
                        <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                        <span className="text-[8px] mx-0.5 text-slate-400">
                          {idx === 0 ? 'GSL' : idx === activeRoute.length - 2 ? 'GSL' : 'ISL'}
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                )
              })}

              {routeLatencyMs && (
                <div className="ml-auto text-slate-400 text-[10px]">
                  RTT <span className="text-cyan-300 font-bold">{routeLatencyMs}ms</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-rose-950/20 border border-rose-900/40 p-2 rounded-lg space-y-1">
              <div className="flex items-center justify-between text-rose-400 font-bold text-xs">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  МАРШРУТ РАЗОРВАН
                </span>
                <span className="text-[9px] bg-black/40 px-1 rounded text-slate-400">0 хопов</span>
              </div>
              <div className="text-[11px] text-slate-300">
                <span className="text-rose-400">Причина: </span>
                {diagnosis.title}
              </div>
              <div className="text-[10px] text-slate-400 bg-black/40 p-1 rounded">
                <span className="text-cyan-400">Рекомендация: </span>
                {diagnosis.recommendation}
              </div>
            </div>
          )}
        </div>

        {/* 3. 2x2 Key Metrics Grid */}
        {selectedMetrics && (
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-white/10 shrink-0">
            <StatCard
              variant="compact"
              label="Доступность SLA"
              value={`${availPct}%`}
              sublabel={`Цель ≥${targetPct}%`}
              className={meetsTarget ? '' : 'border-amber-500/40 text-amber-300'}
            />
            <StatCard
              variant="compact"
              label="Видимость КА"
              value={`${(selectedMetrics.visibility_ratio * 100).toFixed(1)}%`}
              sublabel="Угол места ≥10°"
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

        {/* 4. Active Satellite Telemetry / Failure Injection */}
        {primeSat ? (
          <div className="mt-auto bg-black/40 border border-white/10 rounded-lg p-2 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    primeSat.failed ? 'bg-rose-500' : 'bg-emerald-400'
                  }`}
                />
                <span className="font-bold text-white">КА {primeSat.id}</span>
                <span className="text-[10px] bg-white/10 px-1 rounded text-slate-300">
                  {primeSat.plane_id}
                </span>
                <span className="text-[10px] text-slate-400">Партия #{primeSat.launch_batch}</span>
              </div>
              {primeSat.failed && (
                <span className="text-rose-400 font-bold text-[10px] bg-rose-950/50 px-1.5 py-0.2 rounded border border-rose-800/40">
                  ОТКАЗ
                </span>
              )}
            </div>

            <div className="flex justify-between text-[10px] text-slate-400">
              <span>
                {Math.abs(primeSat.lat_deg).toFixed(1)}°{primeSat.lat_deg >= 0 ? ' с.ш.' : ' ю.ш.'},{' '}
                {Math.abs(primeSat.lon_deg).toFixed(1)}°{primeSat.lon_deg >= 0 ? ' в.д.' : ' з.д.'}
              </span>
              <span>
                [{Math.round(primeSat.x_km)}, {Math.round(primeSat.y_km)}, {Math.round(primeSat.z_km)}] км
              </span>
            </div>

            {onToggleFailure && (
              <button
                onClick={() => onToggleFailure(primeSat.id)}
                className={`mt-1 h-7 px-2.5 rounded-md text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  primeSat.failed
                    ? 'bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 hover:bg-rose-950/40 border-white/10 hover:border-rose-800/50 text-slate-300 hover:text-rose-300'
                }`}
              >
                {primeSat.failed ? (
                  <>
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Восстановить связь</span>
                  </>
                ) : (
                  <>
                    <ZapOff className="w-3.5 h-3.5" />
                    <span>Имитировать отказ КА</span>
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-auto bg-black/30 border border-white/5 rounded-lg p-2 text-center text-[10px] text-slate-500">
            Ожидание радиозахвата космического аппарата
          </div>
        )}
      </div>
    </div>
  )
}
