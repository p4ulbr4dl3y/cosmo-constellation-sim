import React from 'react'
import type { Scenario } from '../../types/scenario'
import { calculateFullTimeline } from '../../lib/orbit'
import { Button, Badge } from '../ui'
import { formatDurationHuman } from '../../lib/formatters'

interface ComparisonViewProps {
  currentScenario: Scenario
  variantA: Scenario | null
  variantB: Scenario | null
  onSetVariantA: (scenario: Scenario) => void
  onSetVariantB: (scenario: Scenario) => void
  onLoadVariantIntoEditor: (scenario: Scenario) => void
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  currentScenario,
  variantA,
  variantB,
  onSetVariantA,
  onSetVariantB,
  onLoadVariantIntoEditor,
}) => {
  // Compute metrics for Variant A & B
  const resultA = React.useMemo(() => {
    return variantA ? calculateFullTimeline(variantA) : null
  }, [variantA])

  const resultB = React.useMemo(() => {
    return variantB ? calculateFullTimeline(variantB) : null
  }, [variantB])

  const clients = currentScenario.ground_sites.filter((g) => g.role === 'client')

  // Check differences between variant A and B for highlighting
  const stageDiff = variantA && variantB && variantA.design.launch_stage !== variantB.design.launch_stage
  const islDiff = variantA && variantB && variantA.environment.isl_range_km !== variantB.environment.isl_range_km
  const failDiff =
    variantA &&
    variantB &&
    (variantA.failures?.length ?? 0) !== (variantB.failures?.length ?? 0)

  // Helper for delta formatting
  const renderDeltaPct = (valA: number, valB: number) => {
    const diff = (valB - valA) * 100
    if (Math.abs(diff) < 0.05) {
      return (
        <span className="text-zinc-400 font-mono">
          0.0%
        </span>
      )
    }
    const isPositive = diff > 0
    return (
      <span
        className={`font-bold font-mono ${
          isPositive ? 'text-emerald-400' : diff < -5 ? 'text-rose-400' : 'text-amber-400'
        }`}
      >
        {isPositive ? `+${Math.abs(diff).toFixed(1)}%` : `-${Math.abs(diff).toFixed(1)}%`}
      </span>
    )
  }

  const renderDeltaTime = (gapA: number, gapB: number) => {
    const diffSec = gapB - gapA
    const diffMin = Math.round(diffSec / 60)
    if (Math.abs(diffMin) === 0) {
      return (
        <span className="text-zinc-400 font-mono">
          0 мин
        </span>
      )
    }
    // For gap, negative delta is BETTER (less outage duration)
    const isBetter = diffSec < 0
    const absFormatted = formatDurationHuman(Math.abs(diffSec))
    return (
      <span
        className={`font-bold font-mono ${
          isBetter ? 'text-emerald-400' : diffSec > 600 ? 'text-rose-400' : 'text-amber-400'
        }`}
      >
        {isBetter ? `-${absFormatted}` : `+${absFormatted}`}
      </span>
    )
  }

  const renderDeltaHops = (hopsA: number, hopsB: number) => {
    const diff = hopsB - hopsA
    if (Math.abs(diff) < 0.05) {
      return <span className="text-zinc-400 font-mono">0.0</span>
    }
    const absVal = Math.abs(diff).toFixed(1)
    return (
      <span className="text-zinc-400 font-mono">
        {diff > 0 ? `+${absVal}` : `-${absVal}`}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-2 font-sans text-xs max-w-[1500px] mx-auto w-full">
      {/* Action Header */}
      <div className="bg-[#0b1017] px-2.5 sm:px-3 py-2 rounded-md border border-[#1a2636] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-semibold text-zinc-200 text-xs">
            A/B Сравнение вариантов
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSetVariantA(currentScenario)}
            className="flex-1 sm:flex-initial"
            title="Зафиксировать текущую конфигурацию как Вариант A"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>Зафиксировать A</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSetVariantB(currentScenario)}
            className="flex-1 sm:flex-initial"
            title="Зафиксировать текущую конфигурацию как Вариант B"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            <span>Зафиксировать B</span>
          </Button>
        </div>
      </div>

      {/* Variant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 shrink-0">
        {/* Card A */}
        <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[#1a2636] pb-1.5">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Вариант A (базовый)
            </span>
            {variantA && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantA)}
                className="text-xs text-cyan-300 hover:underline cursor-pointer font-medium"
              >
                Загрузить в симулятор
              </button>
            )}
          </div>
          {variantA ? (
            <div className="space-y-1 text-zinc-300 text-xs">
              <div className="text-white font-semibold text-xs">{variantA.meta.title}</div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Очередь запуска:</span>
                <span className={stageDiff ? 'text-cyan-300 font-semibold' : 'text-zinc-200'}>
                  Этап {variantA.design.launch_stage} (
                  {variantA.design.satellites.filter(
                    (s) => s.launch_batch <= variantA.design.launch_stage
                  ).length || variantA.design.launch_stage * 16}{' '}
                  КА)
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Дальность ISL:</span>
                <span className={islDiff ? 'text-cyan-300 font-semibold' : 'text-zinc-200'}>
                  {variantA.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Отказы КА:</span>
                <span className={failDiff ? 'text-amber-400 font-semibold' : 'text-zinc-200'}>
                  {variantA.failures?.length ?? 0}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-zinc-500 italic">
              Вариант A не зафиксирован
            </div>
          )}
        </div>

        {/* Card B */}
        <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-[#1a2636] pb-1.5">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Вариант B (целевой)
            </span>
            {variantB && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantB)}
                className="text-xs text-purple-300 hover:underline cursor-pointer font-medium"
              >
                Загрузить в симулятор
              </button>
            )}
          </div>
          {variantB ? (
            <div className="space-y-1 text-zinc-300 text-xs">
              <div className="text-white font-semibold text-xs">{variantB.meta.title}</div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Очередь запуска:</span>
                <span className={stageDiff ? 'text-purple-300 font-semibold' : 'text-zinc-200'}>
                  Этап {variantB.design.launch_stage} (
                  {variantB.design.satellites.filter(
                    (s) => s.launch_batch <= variantB.design.launch_stage
                  ).length || variantB.design.launch_stage * 16}{' '}
                  КА)
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Дальность ISL:</span>
                <span className={islDiff ? 'text-purple-300 font-semibold' : 'text-zinc-200'}>
                  {variantB.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Отказы КА:</span>
                <span className={failDiff ? 'text-amber-400 font-semibold' : 'text-zinc-200'}>
                  {variantB.failures?.length ?? 0}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-zinc-500 italic">
              Вариант B не зафиксирован
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Metrics Table */}
      {resultA && resultB && (
        <div className="bg-[#0b1017] rounded-md border border-[#1a2636] overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-3 py-1.5 bg-[#070b10] border-b border-[#1a2636] flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-zinc-200">
              Сводная матрица метрик
            </span>
            <span className="text-xs text-cyan-400">
              Порог SLA: ≥ 90.0%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[560px]">
              <thead>
                <tr className="bg-[#070b10] text-zinc-400 border-b border-[#1a2636] text-xs sticky top-0 z-20">
                  <th className="py-2 px-3 text-left sticky left-0 bg-[#070b10] z-30">Терминал</th>
                  <th className="py-2 px-3 text-left">Параметр</th>
                  <th className="py-2 px-3 text-right text-cyan-300">Вариант A</th>
                  <th className="py-2 px-3 text-right text-purple-300">Вариант B</th>
                  <th className="py-2 px-3 text-right">Дельта (B - A)</th>
                  <th className="py-2 px-3 text-left">Статус (B)</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const mA = resultA.timelines[c.id]?.metrics
                  const mB = resultB.timelines[c.id]?.metrics
                  if (!mA || !mB) return null

                  const targetAvailB = variantB?.environment.target_availability ?? 0.9
                  const meetsSlaB = mB.availability_ratio >= targetAvailB

                  return (
                    <React.Fragment key={c.id}>
                      {/* Row 1: Availability */}
                      <tr className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="py-2 px-3 font-bold text-zinc-200 border-r border-white/[0.04] align-middle sticky left-0 bg-[#0b1017] z-10" rowSpan={3}>
                          {c.id} ({c.lat_deg}° с.ш.)
                        </td>
                        <td className="py-1.5 px-3 text-zinc-300">
                          Доступность SLA
                        </td>
                        <td className="py-1.5 px-3 text-right text-zinc-300 font-mono tabular-nums">
                          {(mA.availability_ratio * 100).toFixed(1)}%
                        </td>
                        <td className="py-1.5 px-3 text-right text-white font-bold font-mono tabular-nums">
                          {(mB.availability_ratio * 100).toFixed(1)}%
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                          {renderDeltaPct(mA.availability_ratio, mB.availability_ratio)}
                        </td>
                        <td className="py-1.5 px-3 text-left">
                          <Badge variant={meetsSlaB ? 'emerald' : 'red'}>
                            {meetsSlaB ? 'В норме' : 'Ниже цели'}
                          </Badge>
                        </td>
                      </tr>

                      {/* Row 2: Max Gap */}
                      <tr className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="py-1.5 px-3 text-zinc-400">Макс. перерыв (Max Gap)</td>
                        <td className="py-1.5 px-3 text-right text-zinc-300 font-mono tabular-nums">
                          {formatDurationHuman(mA.max_gap_s)}
                        </td>
                        <td className="py-1.5 px-3 text-right text-zinc-200 font-medium font-mono tabular-nums">
                          {formatDurationHuman(mB.max_gap_s)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                          {renderDeltaTime(mA.max_gap_s, mB.max_gap_s)}
                        </td>
                        <td className="py-1.5 px-3 text-left">
                          <Badge variant={mB.max_gap_s <= 480 ? 'neutral' : 'amber'}>
                            {mB.max_gap_s <= 480 ? '≤ 8 мин' : '> 8 мин'}
                          </Badge>
                        </td>
                      </tr>

                      {/* Row 3: Hops */}
                      <tr className="border-b border-white/10 hover:bg-white/[0.02]">
                        <td className="py-1.5 px-3 text-zinc-400">Среднее хопов</td>
                        <td className="py-1.5 px-3 text-right text-zinc-300 font-mono tabular-nums">{mA.avg_hops.toFixed(1)}</td>
                        <td className="py-1.5 px-3 text-right text-zinc-200 font-medium font-mono tabular-nums">
                          {mB.avg_hops.toFixed(1)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                          {renderDeltaHops(mA.avg_hops, mB.avg_hops)}
                        </td>
                        <td className="py-1.5 px-3 text-left text-zinc-600 font-mono text-xs">
                          —
                        </td>
                      </tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
