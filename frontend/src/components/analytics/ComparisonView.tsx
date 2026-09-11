import React from 'react'
import type { Scenario } from '../../types/scenario'
import { calculateFullTimeline } from '../../lib/orbit'
import { Button } from '../ui'
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
          isPositive ? 'text-emerald-400' : 'text-amber-400'
        }`}
      >
        {isPositive ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
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
          isBetter ? 'text-emerald-400' : 'text-amber-400'
        }`}
      >
        {isBetter ? `-${absFormatted}` : `+${absFormatted}`}
      </span>
    )
  }

  return (
    <div className="h-full flex flex-col gap-2 font-mono text-xs overflow-y-auto max-w-[1500px] mx-auto w-full">
      {/* Action Header */}
      <div className="bg-[#121215] px-2.5 sm:px-3 py-2 rounded-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-bold text-zinc-200 uppercase tracking-wider text-xs">
            A/B СРАВНЕНИЕ ВАРИАНТОВ
          </span>
          <span className="text-[10px] text-zinc-400 hidden xs:inline">
            (оценка дельты SLA, времени простоя и сетевых хопов)
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSetVariantA(currentScenario)}
            className="flex-1 sm:flex-initial font-mono"
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
            className="flex-1 sm:flex-initial font-mono"
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
        <div className="bg-[#121215] p-3 rounded-xl border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Вариант A (базовый)
            </span>
            {variantA && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantA)}
                className="text-[10px] text-cyan-300 hover:underline cursor-pointer"
              >
                Загрузить в симулятор ↗
              </button>
            )}
          </div>
          {variantA ? (
            <div className="space-y-1 text-zinc-300 text-[11px]">
              <div className="text-white font-bold text-xs">{variantA.meta.title}</div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Очередь запуска:</span>
                <span className={stageDiff ? 'text-cyan-300 font-bold' : 'text-zinc-200'}>
                  Этап {variantA.design.launch_stage} (
                  {variantA.design.satellites.filter(
                    (s) => s.launch_batch <= variantA.design.launch_stage
                  ).length || variantA.design.launch_stage * 16}{' '}
                  КА)
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Дальность ISL:</span>
                <span className={islDiff ? 'text-cyan-300 font-bold' : 'text-zinc-200'}>
                  {variantA.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Отказы КА:</span>
                <span className={failDiff ? 'text-amber-400 font-bold' : 'text-zinc-200'}>
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
        <div className="bg-[#121215] p-3 rounded-xl border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Вариант B (целевой)
            </span>
            {variantB && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantB)}
                className="text-[10px] text-purple-300 hover:underline cursor-pointer"
              >
                Загрузить в симулятор ↗
              </button>
            )}
          </div>
          {variantB ? (
            <div className="space-y-1 text-zinc-300 text-[11px]">
              <div className="text-white font-bold text-xs">{variantB.meta.title}</div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Очередь запуска:</span>
                <span className={stageDiff ? 'text-purple-300 font-bold' : 'text-zinc-200'}>
                  Этап {variantB.design.launch_stage} (
                  {variantB.design.satellites.filter(
                    (s) => s.launch_batch <= variantB.design.launch_stage
                  ).length || variantB.design.launch_stage * 16}{' '}
                  КА)
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Дальность ISL:</span>
                <span className={islDiff ? 'text-purple-300 font-bold' : 'text-zinc-200'}>
                  {variantB.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>Отказы КА:</span>
                <span className={failDiff ? 'text-amber-400 font-bold' : 'text-zinc-200'}>
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
        <div className="bg-[#121215] rounded-xl border border-white/10 overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-3 py-1.5 bg-[#09090c] border-b border-white/10 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Сводная матрица метрик
            </span>
            <span className="text-[10px] text-cyan-400">
              Порог SLA: ≥ 90.0%
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead>
                <tr className="bg-[#09090c] text-zinc-400 border-b border-white/10 text-[10px] uppercase">
                  <th className="py-2 px-3">Терминал</th>
                  <th className="py-2 px-3">Параметр</th>
                  <th className="py-2 px-3 text-cyan-300">Вариант A</th>
                  <th className="py-2 px-3 text-purple-300">Вариант B</th>
                  <th className="py-2 px-3">Дельта (B - A)</th>
                  <th className="py-2 px-3">Статус SLA (B)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {clients.map((c) => {
                  const mA = resultA.timelines[c.id]?.metrics
                  const mB = resultB.timelines[c.id]?.metrics
                  if (!mA || !mB) return null

                  const targetAvailB = variantB?.environment.target_availability ?? 0.9
                  const meetsSlaB = mB.availability_ratio >= targetAvailB

                  return (
                    <React.Fragment key={c.id}>
                      {/* Row 1: Availability */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 font-bold text-zinc-200" rowSpan={3}>
                          {c.id} ({c.lat_deg}° с.ш.)
                        </td>
                        <td className="py-1.5 px-3 text-zinc-300">
                          Доступность SLA
                        </td>
                        <td className="py-1.5 px-3 text-zinc-300">
                          {(mA.availability_ratio * 100).toFixed(1)}%
                        </td>
                        <td className="py-1.5 px-3 text-white font-bold">
                          {(mB.availability_ratio * 100).toFixed(1)}%
                        </td>
                        <td className="py-1.5 px-3">
                          {renderDeltaPct(mA.availability_ratio, mB.availability_ratio)}
                        </td>
                        <td className="py-1.5 px-3 align-middle" rowSpan={3}>
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                meetsSlaB ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                            />
                            <span className={meetsSlaB ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                              {meetsSlaB ? 'В норме' : 'Ниже цели'}
                            </span>
                          </span>
                        </td>
                      </tr>

                      {/* Row 2: Max Gap */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="py-1.5 px-3 text-zinc-400">Макс. перерыв (Max Gap)</td>
                        <td className="py-1.5 px-3 text-zinc-300">
                          {formatDurationHuman(mA.max_gap_s)}
                        </td>
                        <td className="py-1.5 px-3 text-zinc-200 font-medium">
                          {formatDurationHuman(mB.max_gap_s)}
                        </td>
                        <td className="py-1.5 px-3">
                          {renderDeltaTime(mA.max_gap_s, mB.max_gap_s)}
                        </td>
                      </tr>

                      {/* Row 3: Hops */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="py-1.5 px-3 text-zinc-400">Среднее хопов</td>
                        <td className="py-1.5 px-3 text-zinc-300">{mA.avg_hops.toFixed(1)}</td>
                        <td className="py-1.5 px-3 text-zinc-200 font-medium">
                          {mB.avg_hops.toFixed(1)}
                        </td>
                        <td className="py-1.5 px-3 text-zinc-400">
                          {(mB.avg_hops - mA.avg_hops) > 0 ? `+${(mB.avg_hops - mA.avg_hops).toFixed(1)}` : (mB.avg_hops - mA.avg_hops).toFixed(1)}
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
