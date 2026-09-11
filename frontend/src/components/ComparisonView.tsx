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
import { Card, CardHeader, CardTitle, Button, Badge } from './ui'

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
        <span className="text-slate-400 flex items-center gap-0.5 font-mono">
          <Minus className="w-3 h-3" /> 0.0%
        </span>
      )
    }
    const isPositive = diff > 0
    return (
      <span
        className={`flex items-center gap-0.5 font-bold font-mono ${
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
        <span className="text-slate-400 flex items-center gap-0.5 font-mono">
          <Minus className="w-3 h-3" /> 0 мин
        </span>
      )
    }
    // For gap, negative delta is BETTER (less outage duration)
    const isBetter = diffSec < 0
    return (
      <span
        className={`flex items-center gap-0.5 font-bold font-mono ${
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
    <Card noPadding className="p-3.5 flex flex-col gap-3 max-w-6xl mx-auto">
      {/* Header */}
      <CardHeader className="pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#121824] border border-[#182232] flex items-center justify-center text-[#00f0ff]">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div>
            <CardTitle>
              A/B СРАВНЕНИЕ ПРОЕКТНЫХ ВАРИАНТОВ (TRADE-OFF STUDY)
            </CardTitle>
            <p className="text-[10px] font-mono text-slate-400 mt-0.5">
              Сопоставление архитектур группировки, плотности сетки ISL и дельты показателей SLA
            </p>
          </div>
        </div>

        {/* Snapshot Buttons */}
        <div className="flex items-center gap-2 font-mono">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetVariantA(currentScenario)}
            className="border-blue-500/40 text-blue-300 hover:text-blue-200 gap-1.5"
          >
            <Pin className="w-3 h-3 text-blue-400" />
            <span>ФИКСИРОВАТЬ [A]</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetVariantB(currentScenario)}
            className="border-purple-500/40 text-purple-300 hover:text-purple-200 gap-1.5"
          >
            <Pin className="w-3 h-3 text-purple-400" />
            <span>ФИКСИРОВАТЬ [B]</span>
          </Button>
        </div>
      </CardHeader>

      {/* Top Banner: Variant Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Card A */}
        <div className="bg-[#080b11] p-3 rounded-xl border border-blue-500/30 flex flex-col gap-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              ВАРИАНТ A (БАЗА)
            </span>
            {variantA && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantA)}
                className="text-[10px] text-blue-300 hover:underline cursor-pointer"
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
        <div className="bg-[#080b11] p-3 rounded-xl border border-purple-500/30 flex flex-col gap-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              ВАРИАНТ B (ОПТИМИЗАЦИЯ)
            </span>
            {variantB && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantB)}
                className="text-[10px] text-purple-300 hover:underline cursor-pointer"
              >
                ЗАГРУЗИТЬ В СИМУЛЯТОР ↗
              </button>
            )}
          </div>
          {variantB ? (
            <div className="text-xs text-slate-300 space-y-1">
              <div className="text-slate-100 font-bold">{variantB.meta.title}</div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Очередь запуска:</span>
                <span className="text-slate-200">
                  Этап {variantB.design.launch_stage} ({variantB.design.launch_stage * 16} КА)
                </span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Предельная дальность ISL:</span>
                <span className="text-slate-200">
                  {variantB.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Активных отказов спутников:</span>
                <span className="text-slate-200">{variantB.failures.length}</span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500 italic">
              Вариант B еще не зафиксирован. Нажмите кнопку выше.
            </div>
          )}
        </div>
      </div>

      {/* Side-by-Side Metrics Table */}
      {resultA && resultB && (
        <div className="bg-[#080b11] rounded-xl border border-[#182232] overflow-hidden font-mono">
          <div className="px-3 py-2 bg-[#0c1017] border-b border-[#182232] flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              ТАБЛИЦА СРАВНЕНИЯ МЕТРИК СВЯЗИ
            </span>
            <span className="text-[10px] text-[#00f0ff]">
              ЦЕЛЕВОЙ ПОРОГ SLA: ≥ 90.0%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0c1017] text-slate-400 border-b border-[#182232] text-[10px] uppercase">
                  <th className="py-2.5 px-3">НАЗЕМНЫЙ ПУНКТ</th>
                  <th className="py-2.5 px-3">ПАРАМЕТР</th>
                  <th className="py-2.5 px-3 text-blue-300">ВАРИАНТ A</th>
                  <th className="py-2.5 px-3 text-purple-300">ВАРИАНТ B</th>
                  <th className="py-2.5 px-3">ДЕЛЬТА (B - A)</th>
                  <th className="py-2.5 px-3">SLA СТАТУС (B)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#182232]">
                {clients.map((c) => {
                  const mA = resultA.timelines[c.id]?.metrics
                  const mB = resultB.timelines[c.id]?.metrics
                  if (!mA || !mB) return null

                  const targetAvailB = variantB?.environment.target_availability ?? 0.9
                  const meetsSlaB = mB.availability_ratio >= targetAvailB

                  return (
                    <React.Fragment key={c.id}>
                      {/* Row 1: Availability */}
                      <tr className="hover:bg-[#121824]/50">
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
                          <Badge variant={meetsSlaB ? 'emerald' : 'red'}>
                            {meetsSlaB ? 'СООТВЕТСТВУЕТ' : 'НИЖЕ ЦЕЛИ'}
                          </Badge>
                        </td>
                      </tr>

                      {/* Row 2: Max Gap */}
                      <tr className="hover:bg-[#121824]/50">
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
                      <tr className="hover:bg-[#121824]/50">
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
    </Card>
  )
}
