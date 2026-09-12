import React, { useMemo } from 'react'
import {
  ArrowRight,
  ZapOff,
  RotateCcw,
} from 'lucide-react'
import type { Scenario, Snapshot, ClientTimeline } from '../../types/scenario'
import { StatCard, Badge, Button, ClientSelector } from '../ui'
import { formatDurationHuman } from '../../lib/formatters'

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
      detail: 'Над терминалом нет активных КА с углом места ≥ 10°.',
      recommendation: 'Ожидание пролета КА или увеличение числа КА в группировке.',
    }
  }

  // 2. Explicit gateway_offline reason
  if (reason && (reason.includes('Шлюз отключен') || reason.includes('gateway_offline'))) {
    return {
      title: 'Технологическое окно шлюза',
      detail: 'Опорный наземный шлюз временно отключен согласно регламенту.',
      recommendation: 'Ожидание завершения регламентных работ на шлюзе.',
    }
  }

  // 3. no_gateway_satellite: gateway online but no satellites in its footprint
  if (
    reason &&
    (reason.includes('над шлюзом') || reason.includes('no_gateway_satellite'))
  ) {
    return {
      title: 'Нет КА над шлюзом',
      detail: 'В радиовидимости шлюза отсутствуют КА с углом места ≥ 10°.',
      recommendation: 'Ожидание захода КА орбитальной плоскости в зону шлюза.',
    }
  }

  // 4. isl_disconnected: both sites see sats, but ISL mesh is disconnected
  if (
    reason &&
    (reason.includes('ISL') || reason.includes('рассоединен') || reason.includes('isl_disconnected'))
  ) {
    return {
      title: 'Разрыв межспутникового сегмента',
      detail: 'Граф межспутниковых линий (ISL) рассоединен, маршрут отсутствует.',
      recommendation: 'Проверка отказавших КА или корректировка лимита дальности ISL.',
    }
  }

  // 5. Fallback if all gateways are offline and no specific reason was determined
  if (isGatewayOutage) {
    return {
      title: 'Технологическое окно шлюза',
      detail: 'Опорный наземный шлюз временно отключен согласно регламенту.',
      recommendation: 'Ожидание завершения регламентных работ на шлюзе.',
    }
  }

  return {
    title: 'Маршрут не построен',
    detail: reason || 'Сетевой путь между клиентом и опорным шлюзом разорван.',
    recommendation: 'Ожидание изменения взаимного положения КА.',
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

  const gateways = useMemo(
    () => scenario.ground_sites.filter((g) => g.role === 'gateway'),
    [scenario.ground_sites]
  )

  // In multi-gateway topologies, gateway outage applies if all available gateways are in maintenance
  const isGatewayOutage = useMemo(() => {
    if (gateways.length === 0) return false
    return gateways.every((gw) =>
      scenario.gateway_outages?.some(
        (o) => o.gateway_id === gw.id && o.start_s <= snapshot.t_s && snapshot.t_s < o.end_s
      )
    )
  }, [gateways, scenario.gateway_outages, snapshot.t_s])

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

  // Prime satellite on route (first sat client links to: intermediate node on [client, sat1, ..., gw])
  const satIdSet = useMemo(() => new Set(snapshot.satellites.map((s) => s.id)), [snapshot.satellites])
  const primeSatId = activeRoute.find((n) => satIdSet.has(n))
  const primeSat = primeSatId ? snapshot.satellites.find((s) => s.id === primeSatId) : null

  return (
    <div className="h-full flex flex-col gap-2 font-sans text-xs overflow-y-auto overflow-x-hidden">
      {/* 1. Client Switcher Header */}
      <ClientSelector
        clients={clients}
        selectedClientId={selectedClientId}
        onSelectClient={onSelectClient}
        timelines={timelines}
        targetAvailability={targetAvailability}
        routes={snapshot.routes}
        variant="grid"
      />

      {/* 2. Client Details & Route Card */}
      <div className="flex-1 flex flex-col bg-[#0b1017] p-2 sm:p-2.5 rounded-md border border-[#1a2636] gap-2 lg:overflow-y-auto lg:overflow-x-hidden overflow-x-hidden">
        {/* Header & Gateway Status */}
        <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-[#1a2636] shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="font-semibold text-zinc-100 text-xs shrink-0">
              Терминал {selectedClient?.id || selectedClientId}
            </span>
            {selectedClient && (
              <span className="text-[10px] text-zinc-400 font-mono truncate">
                {Math.abs(selectedClient.lat_deg).toFixed(1)}°{selectedClient.lat_deg >= 0 ? ' с.ш.' : ' ю.ш.'},{' '}
                {Math.abs(selectedClient.lon_deg).toFixed(1)}°{selectedClient.lon_deg >= 0 ? ' в.д.' : ' з.д.'}
              </span>
            )}
          </div>
          {isGatewayOutage && (
            <Badge variant="red" className="shrink-0">Шлюз: техокно</Badge>
          )}
        </div>

        {/* Current Route or Outage Diagnosis */}
        <div className="shrink-0 min-h-[46px]">
          {hasRoute ? (
            <div className="bg-[#070b10] p-2 rounded border border-[#1a2636] flex flex-wrap items-center gap-1.5 min-h-[46px]">
              {activeRoute.map((nodeId, idx) => {
                const isFirst = idx === 0
                const isLast = idx === activeRoute.length - 1

                return (
                  <React.Fragment key={idx}>
                    <div
                      className={`px-1.5 py-0.5 rounded text-[11px] font-mono border ${
                        isFirst || isLast
                          ? 'bg-white/[0.04] border-white/10 text-zinc-300 font-medium'
                          : 'bg-white/12 border-white/20 text-white font-semibold shadow-2xs'
                      }`}
                    >
                      {nodeId}
                    </div>

                    {!isLast && (
                      <div className="flex items-center text-zinc-500">
                        <ArrowRight className="w-3 h-3 text-zinc-500" />
                        <span className="text-[8px] mx-0.5 text-zinc-400 font-mono">
                          {idx === 0 ? 'GSL' : idx === activeRoute.length - 2 ? 'GSL' : 'ISL'}
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                )
              })}

              {routeLatencyMs && (
                <div className="basis-full sm:basis-auto sm:ml-auto min-w-0 flex justify-end text-zinc-400 text-[10px] font-mono">
                  RTT <span className="text-zinc-200 font-semibold ml-1">{routeLatencyMs} мс</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded border border-rose-500/25 bg-rose-500/[0.03] p-2 flex flex-col justify-center gap-1 min-h-[46px]">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span className="text-rose-400 font-medium text-xs">
                  Маршрут разорван
                </span>
                <span className="text-zinc-600 text-xs">/</span>
                <span className="text-zinc-300 text-xs font-medium truncate">
                  {diagnosis.title}
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 leading-snug pl-3.5">
                <span className="text-zinc-500">Рекомендация: </span>
                <span>{diagnosis.recommendation}</span>
              </div>
            </div>
          )}
        </div>

        {/* 3. 2x2 Key Metrics Grid */}
        {selectedMetrics && (
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#1a2636] shrink-0">
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
              label="Макс. перерыв (Max Gap)"
              value={formatDurationHuman(selectedMetrics.max_gap_s)}
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
          <div className="mt-auto bg-[#070b10] border border-[#1a2636] rounded p-2 flex flex-col gap-1.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-1 border-b border-[#1a2636]/60 pb-1">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    primeSat.failed ? 'bg-rose-500' : 'bg-emerald-400'
                  }`}
                />
                <span className="font-semibold text-white">КА {primeSat.id}</span>
                <span className="text-[10px] bg-white/[0.06] px-1 rounded text-zinc-300 font-mono">
                  {primeSat.plane_id}
                </span>
                <span className="text-[10px] text-zinc-400 font-sans">Партия №{primeSat.launch_batch}</span>
              </div>
              {primeSat.failed && (
                <Badge variant="red" className="shrink-0">Отказ</Badge>
              )}
            </div>

            <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
              <span>
                {Math.abs(primeSat.lat_deg).toFixed(1)}°{primeSat.lat_deg >= 0 ? ' с.ш.' : ' ю.ш.'},{' '}
                {Math.abs(primeSat.lon_deg).toFixed(1)}°{primeSat.lon_deg >= 0 ? ' в.д.' : ' з.д.'}
              </span>
            </div>

            {onToggleFailure && (
              <Button
                type="button"
                variant={primeSat.failed ? 'success' : 'danger'}
                size="sm"
                onClick={() => onToggleFailure(primeSat.id)}
                className="mt-1 w-full font-sans"
              >
                {primeSat.failed ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                    <span>Восстановить связь</span>
                  </>
                ) : (
                  <>
                    <ZapOff className="w-3.5 h-3.5 shrink-0" />
                    <span>Имитировать отказ КА</span>
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-auto bg-[#070b10] border border-[#1a2636]/60 rounded p-2 text-center text-[11px] text-zinc-500 font-sans min-h-[82px] flex items-center justify-center">
            Ожидание радиозахвата космического аппарата
          </div>
        )}
      </div>
    </div>
  )
}
