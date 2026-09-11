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

function formatDurationHuman(sec: number): string {
  if (!sec || sec <= 0) return '0 мин'
  const totalMinutes = Math.round(sec / 60)
  if (totalMinutes < 60) return `${totalMinutes} мин`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
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
  const failDiff = variantA && variantB && variantA.failures.length !== variantB.failures.length

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
          isPositive ? 'text-emerald-400' : 'text-amber-400'
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
    const absFormatted = formatDurationHuman(Math.abs(diffSec))
    return (
      <span
        className={`flex items-center gap-0.5 font-bold font-mono ${
          isBetter ? 'text-emerald-400' : 'text-amber-400'
        }`}
      >
        {isBetter ? (
          <TrendingDown className="w-3 h-3" />
        ) : (
          <TrendingUp className="w-3 h-3" />
        )}
        {isBetter ? `-${absFormatted}` : `+${absFormatted}`}
      </span>
    )
  }

  return (
    <Card noPadding className="p-3.5 flex flex-col gap-3 max-w-6xl mx-auto">
      {/* Header */}
      <CardHeader className="pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-cyan-400">
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div>
            <CardTitle>
              A/B сравнение проектных вариантов
            </CardTitle>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Сопоставление архитектур группировки, плотности ISL и дельты показателей доступности
            </p>
          </div>
        </div>

        {/* Snapshot Buttons */}
        <div className="flex items-center gap-2 font-mono">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetVariantA(currentScenario)}
            className="border-white/15 text-slate-200 hover:text-white gap-1.5"
            title="Зафиксировать текущую конфигурацию как Вариант A"
          >
            <Pin className="w-3 h-3 text-cyan-400" />
            <span>Зафиксировать А</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSetVariantB(currentScenario)}
            className="border-white/15 text-slate-200 hover:text-white gap-1.5"
            title="Зафиксировать текущую конфигурацию как Вариант B"
          >
            <Pin className="w-3 h-3 text-purple-400" />
            <span>Зафиксировать B</span>
          </Button>
        </div>
      </CardHeader>

      {/* Top Banner: Variant Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Card A */}
        <div className="bg-[#080b11] p-3 rounded-xl border border-white/10 flex flex-col gap-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Вариант A (базовый)
            </span>
            {variantA && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantA)}
                className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
              >
                Загрузить в симулятор ↗
              </button>
            )}
          </div>
          {variantA ? (
            <div className="text-xs font-mono text-slate-300 space-y-1.5">
              <div className="text-slate-100 font-bold">{variantA.meta.title}</div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Очередь запуска:</span>
                <span
                  className={
                    stageDiff
                      ? 'px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                      : 'text-slate-300'
                  }
                >
                  Этап {variantA.design.launch_stage} ({variantA.design.launch_stage * 16} КА)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Предельная дальность ISL:</span>
                <span
                  className={
                    islDiff
                      ? 'px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                      : 'text-slate-400'
                  }
                >
                  {variantA.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Активных отказов КА:</span>
                <span
                  className={
                    failDiff
                      ? 'px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30'
                      : 'text-slate-400'
                  }
                >
                  {variantA.failures.length}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500 font-mono italic">
              Вариант A еще не зафиксирован. Нажмите кнопку выше.
            </div>
          )}
        </div>

        {/* Card B */}
        <div className="bg-[#080b11] p-3 rounded-xl border border-white/10 flex flex-col gap-2 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Вариант B (целевой)
            </span>
            {variantB && (
              <button
                onClick={() => onLoadVariantIntoEditor(variantB)}
                className="text-[10px] text-purple-400 hover:underline cursor-pointer"
              >
                Загрузить в симулятор ↗
              </button>
            )}
          </div>
          {variantB ? (
            <div className="text-xs font-mono text-slate-300 space-y-1.5">
              <div className="text-slate-100 font-bold">{variantB.meta.title}</div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Очередь запуска:</span>
                <span
                  className={
                    stageDiff
                      ? 'px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 font-bold border border-purple-500/30'
                      : 'text-slate-300'
                  }
                >
                  Этап {variantB.design.launch_stage} ({variantB.design.launch_stage * 16} КА)
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Предельная дальность ISL:</span>
                <span
                  className={
                    islDiff
                      ? 'px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 font-bold border border-purple-500/30'
                      : 'text-slate-400'
                  }
                >
                  {variantB.environment.isl_range_km} км
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400 text-[11px]">
                <span>Активных отказов КА:</span>
                <span
                  className={
                    failDiff
                      ? 'px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30'
                      : 'text-slate-400'
                  }
                >
                  {variantB.failures.length}
                </span>
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
        <div className="bg-[#080b11] rounded-xl border border-white/10 overflow-hidden font-mono">
          <div className="px-3 py-2 bg-[#0c1017] border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Таблица сравнения сетевых метрик
            </span>
            <span className="text-[10px] text-cyan-400 font-mono">
              Целевой порог SLA: ≥ 90.0%
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#0c1017] text-slate-400 border-b border-white/10 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Наземный пункт</th>
                  <th className="py-2.5 px-3">Параметр</th>
                  <th className="py-2.5 px-3 text-cyan-300">Вариант A</th>
                  <th className="py-2.5 px-3 text-purple-300">Вариант B</th>
                  <th className="py-2.5 px-3">Дельта (B - A)</th>
                  <th className="py-2.5 px-3">SLA статус (B)</th>
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
                        <td className="py-2.5 px-3 font-bold text-slate-200" rowSpan={3}>
                          {c.id} ({c.lat_deg}°N)
                        </td>
                        <td className="py-2 px-3 text-slate-200 font-medium">
                          Доступность SLA
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {(mA.availability_ratio * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-3 text-white font-bold">
                          {(mB.availability_ratio * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-3">
                          {renderDeltaPct(mA.availability_ratio, mB.availability_ratio)}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={meetsSlaB ? 'emerald' : 'amber'}>
                            {meetsSlaB ? 'SLA ≥90% OK' : 'Ниже нормы'}
                          </Badge>
                        </td>
                      </tr>

                      {/* Row 2: Max Gap */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 text-slate-400">Макс. перерыв связи</td>
                        <td className="py-2 px-3 text-slate-300">
                          {formatDurationHuman(mA.max_gap_s)}
                        </td>
                        <td className="py-2 px-3 text-slate-200 font-medium">
                          {formatDurationHuman(mB.max_gap_s)}
                        </td>
                        <td className="py-2 px-3">
                          {renderDeltaTime(mA.max_gap_s, mB.max_gap_s)}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">—</td>
                      </tr>

                      {/* Row 3: Hops */}
                      <tr className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 text-slate-400">Среднее число хопов</td>
                        <td className="py-2 px-3 text-slate-300">{mA.avg_hops.toFixed(1)}</td>
                        <td className="py-2 px-3 text-slate-200 font-medium">
                          {mB.avg_hops.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {(mB.avg_hops - mA.avg_hops) > 0 ? `+${(mB.avg_hops - mA.avg_hops).toFixed(1)}` : (mB.avg_hops - mA.avg_hops).toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">—</td>
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
