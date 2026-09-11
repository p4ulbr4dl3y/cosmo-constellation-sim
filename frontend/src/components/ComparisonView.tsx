import React from 'react'
import {
  Scale,
  Pin,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import type { Scenario } from '../types/scenario'
import { calculateFullTimeline } from '../lib/orbit'

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

  // Helper for delta formatting
  const renderDeltaPct = (valA: number, valB: number) => {
    const diff = (valB - valA) * 100
    if (Math.abs(diff) < 0.05) {
      return (
        <span className="text-slate-400 flex items-center gap-0.5">
          <Minus className="w-3 h-3" /> 0.0%
        </span>
      )
    }
    const isPositive = diff > 0
    return (
      <span
        className={`flex items-center gap-0.5 font-bold ${
          isPositive ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        {isPositive ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
      </span>
    )
  }

  const renderDeltaTime = (gapA: number, gapB: number) => {
    const diffSec = gapB - gapA
    const diffMin = Math.round(diffSec / 60)
    if (Math.abs(diffMin) === 0) {
      return (
        <span className="text-slate-400 flex items-center gap-0.5">
          <Minus className="w-3 h-3" /> 0 мин
        </span>
      )
    }
    // For gap, negative delta is BETTER (less outage duration)
    const isBetter = diffSec < 0
    return (
      <span
        className={`flex items-center gap-0.5 font-bold ${
          isBetter ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {isBetter ? (
          <TrendingDown className="w-3 h-3" />
        ) : (
          <TrendingUp className="w-3 h-3" />
        )}
        {diffMin > 0 ? `+${diffMin} мин` : `${diffMin} мин`}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-[#0b101b] border border-[#1f293d] rounded-xl shadow-xl max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2a3f] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              A/B Сравнение проектных вариантов
            </h2>
            <p className="text-xs text-slate-400">
              Сопоставление архитектур группировки, отказоустойчивости и метрик SLA
            </p>
          </div>
        </div>

        {/* Snapshot Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetVariantA(currentScenario)}
            className="px-3 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <Pin className="w-3.5 h-3.5" />
            <span>Зафиксировать как Вариант A</span>
          </button>
          <button
            onClick={() => onSetVariantB(currentScenario)}
            className="px-3 py-1.5 rounded-lg bg-purple-600/90 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/20"
          >
            <Pin className="w-3.5 h-3.5" />
            <span>Зафиксировать как Вариант B</span>
          </button>
        </div>
      </div>

      {/* Top Banner: Variant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A */}
        <div className="bg-[#0e1524] p-3.5 rounded-xl border border-blue-800/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Вариант A (Базовый)
            </span>
            {variantA && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantA)}
                className="text-[10px] text-blue-300 hover:underline font-mono"
              >
                Загрузить в симулятор ↗
              </button>
            )}
          </div>
          {variantA ? (
            <div className="text-xs font-mono text-slate-300 space-y-1">
              <div className="text-slate-100 font-bold">{variantA.meta.title}</div>
              <div className="flex justify-between text-slate-400">
                <span>Очередь запуска:</span>
                <span className="text-slate-200">
                  Этап {variantA.design.launch_stage} ({variantA.design.launch_stage * 16} КА)
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Предельная дальность ISL:</span>
                <span className="text-slate-200">
                  {variantA.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Активных отказов спутников:</span>
                <span className="text-slate-200">{variantA.failures.length}</span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500 font-mono italic">
              Вариант A еще не зафиксирован. Нажмите кнопку выше.
            </div>
          )}
        </div>

        {/* Card B */}
        <div className="bg-[#0e1524] p-3.5 rounded-xl border border-purple-800/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              Вариант B (Альтернативный / Оптимизация)
            </span>
            {variantB && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantB)}
                className="text-[10px] text-purple-300 hover:underline font-mono"
              >
                Загрузить в симулятор ↗
              </button>
            )}
          </div>
          {variantB ? (
            <div className="text-xs font-mono text-slate-300 space-y-1">
              <div className="text-slate-100 font-bold">{variantB.meta.title}</div>
              <div className="flex justify-between text-slate-400">
                <span>Очередь запуска:</span>
                <span className="text-slate-200">
                  Этап {variantB.design.launch_stage} ({variantB.design.launch_stage * 16} КА)
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Предельная дальность ISL:</span>
                <span className="text-slate-200">
                  {variantB.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Активных отказов спутников:</span>
                <span className="text-slate-200">{variantB.failures.length}</span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500 font-mono italic">
              Вариант B еще не зафиксирован. Нажмите кнопку выше.
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Metrics Table */}
      {resultA && resultB && (
        <div className="bg-[#0e1524] rounded-xl border border-[#1e2c44] overflow-hidden">
          <div className="px-4 py-3 bg-[#131d31] border-b border-[#1e2c44] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Детальное сопоставление показателей качества связи
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              Целевой порог доступности: ≥ 90.0%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="bg-[#101726] text-slate-400 border-b border-[#1b263b]">
                  <th className="py-2.5 px-3">Наземный пункт</th>
                  <th className="py-2.5 px-3">Метрика</th>
                  <th className="py-2.5 px-3 text-blue-300">Вариант A</th>
                  <th className="py-2.5 px-3 text-purple-300">Вариант B</th>
                  <th className="py-2.5 px-3">Дельта (B - A)</th>
                  <th className="py-2.5 px-3">SLA Варианта B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#172236]">
                {clients.map((c) => {
                  const mA = resultA.timelines[c.id]?.metrics
                  const mB = resultB.timelines[c.id]?.metrics
                  if (!mA || !mB) return null

                  const meetsSlaB = mB.availability_ratio >= 0.9

                  return (
                    <React.Fragment key={c.id}>
                      {/* Row 1: Availability */}
                      <tr className="hover:bg-[#121c2e]/50">
                        <td className="py-2.5 px-3 font-bold text-slate-200" rowSpan={3}>
                          {c.id} ({c.lat_deg}°N)
                        </td>
                        <td className="py-2 px-3 text-slate-300 font-semibold">
                          Доступность пути
                        </td>
                        <td className="py-2 px-3 text-slate-200">
                          {(mA.availability_ratio * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-slate-200 font-bold">
                          {(mB.availability_ratio * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-3">
                          {renderDeltaPct(mA.availability_ratio, mB.availability_ratio)}
                        </td>
                        <td className="py-2 px-3" rowSpan={3}>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              meetsSlaB
                                ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                                : 'bg-red-950/80 border-red-700 text-red-300'
                            }`}
                          >
                            {meetsSlaB ? 'СООТВЕТСТВУЕТ' : 'НИЖЕ ЦЕЛИ'}
                          </span>
                        </td>
                      </tr>

                      {/* Row 2: Max Gap */}
                      <tr className="hover:bg-[#121c2e]/50">
                        <td className="py-2 px-3 text-slate-400">Макс. перерыв связи</td>
                        <td className="py-2 px-3 text-slate-300">
                          {Math.round(mA.max_gap_s / 60)} мин ({mA.max_gap_s}с)
                        </td>
                        <td className="py-2 px-3 text-slate-300 font-bold">
                          {Math.round(mB.max_gap_s / 60)} мин ({mB.max_gap_s}с)
                        </td>
                        <td className="py-2 px-3">
                          {renderDeltaTime(mA.max_gap_s, mB.max_gap_s)}
                        </td>
                      </tr>

                      {/* Row 3: Hops */}
                      <tr className="hover:bg-[#121c2e]/50">
                        <td className="py-2 px-3 text-slate-400">Среднее число хопов</td>
                        <td className="py-2 px-3 text-slate-300">{mA.avg_hops.toFixed(1)}</td>
                        <td className="py-2 px-3 text-slate-300 font-bold">
                          {mB.avg_hops.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {(mB.avg_hops - mA.avg_hops).toFixed(1)}
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
