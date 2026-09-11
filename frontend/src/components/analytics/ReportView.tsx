import React from 'react'
import type { Scenario, ClientTimeline } from '../../types/scenario'
import { Badge, Card, CardHeader, CardTitle, Button } from '../ui'

interface ReportViewProps {
  currentScenario?: Scenario
  timelines?: Record<string, ClientTimeline>
}

export const ReportView: React.FC<ReportViewProps> = ({
  currentScenario,
  timelines,
}) => {
  // Compute current scenario live availability if timelines provided
  const liveStats = React.useMemo(() => {
    if (!timelines || Object.keys(timelines).length === 0) return null
    const clientTimelines = Object.values(timelines)
    const ratios = clientTimelines.map((t) => t.metrics.availability_ratio)
    const meanAvail = ratios.reduce((a, b) => a + b, 0) / ratios.length
    const minAvail = Math.min(...ratios)
    const allMeetTarget = clientTimelines.every(
      (t) =>
        t.metrics.availability_ratio >= (currentScenario?.environment.target_availability ?? 0.9)
    )
    return {
      meanAvail: (meanAvail * 100).toFixed(2),
      minAvail: (minAvail * 100).toFixed(2),
      allMeetTarget,
    }
  }, [timelines, currentScenario?.environment.target_availability])

  return (
    <div className="h-full flex flex-col gap-2 font-mono text-xs overflow-y-auto max-w-[1500px] mx-auto w-full">
      {/* 1. Header & Quick Context */}
      <div className="bg-[#121215] px-3 py-2 rounded-lg border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-zinc-100 uppercase tracking-wider text-xs">
            АНАЛИТИЧЕСКИЙ ОТЧЁТ И СИНТЕЗ РЕКОМЕНДАЦИЙ
          </span>
          <Badge variant="neutral">КЕЙС 2 · АРКТИКА</Badge>
          <Badge variant="neutral">48 КА · 3 ПЛОСКОСТИ</Badge>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {liveStats ? (
            <Badge
              variant={liveStats.allMeetTarget ? 'emerald' : 'amber'}
              className="px-2 py-0.5 text-xs font-mono"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  liveStats.allMeetTarget ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span>АКТИВНЫЙ СЦЕНАРИЙ: {liveStats.meanAvail}%</span>
            </Badge>
          ) : (
            <Badge variant="emerald" className="px-2 py-0.5 text-xs font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>БАЗОВЫЙ SLA: 98.10%</span>
            </Badge>
          )}

          <a
            href="https://github.com/p4ulbr4dl3y/cosmo-constellation-sim/blob/main/docs/RECOMMENDATIONS.md"
            target="_blank"
            rel="noreferrer"
            tabIndex={-1}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="Открыть документацию в docs/RECOMMENDATIONS.md"
            >
              <span>docs/ ↗</span>
            </Button>
          </a>
        </div>
      </div>

      {/* 2. Core Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Section 1: Deployment Stages */}
        <Card className="flex flex-col gap-2">
          <CardHeader>
            <CardTitle>1. Динамика этапов развёртывания</CardTitle>
            <span className="text-[10px] text-zinc-400 font-mono">720 шагов / 24 ч</span>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            {/* Stage 1 */}
            <div className="p-2.5 rounded-md bg-[#0d0d10] border border-zinc-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Очередь 1</span>
                  <span className="text-zinc-300 font-mono">16 КА</span>
                </div>
                <div className="text-base font-bold font-mono text-rose-400 mt-1">18.56%</div>
                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-rose-500 h-full" style={{ width: '18.56%' }} />
                </div>
              </div>
              <div className="text-[10px] text-zinc-400 mt-2">
                1 плоскость · разрывы связи
              </div>
            </div>

            {/* Stage 2 */}
            <div className="p-2.5 rounded-md bg-[#0d0d10] border border-zinc-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Очередь 2</span>
                  <span className="text-zinc-300 font-mono">32 КА</span>
                </div>
                <div className="text-base font-bold font-mono text-amber-400 mt-1">64.80%</div>
                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-amber-400 h-full" style={{ width: '64.80%' }} />
                </div>
              </div>
              <div className="text-[10px] text-zinc-400 mt-2">
                2 плоскости · окна без связи
              </div>
            </div>

            {/* Stage 3 */}
            <div className="p-2.5 rounded-md bg-[#0d0d10] border border-zinc-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Очередь 3</span>
                  <span className="text-zinc-300 font-mono">48 КА</span>
                </div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-1">98.10%</div>
                <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-emerald-400 h-full" style={{ width: '98.10%' }} />
                </div>
              </div>
              <div className="text-[10px] text-emerald-400 mt-2 font-medium">
                3 плоскости · норма SLA
              </div>
            </div>
          </div>

          <div className="p-2 rounded-md bg-[#0d0d10] border border-zinc-800/80 text-[11px] text-zinc-300 leading-relaxed">
            <span className="text-zinc-100 font-semibold uppercase">Вывод орбитальной механики:</span>{' '}
            1 плоскость замыкает внутриплоскостной пояс, но суточное вращение Земли (15°/ч) уводит её из видимости пунктов на 3–5 витков. Непрерывность в Арктике гарантируют только <span className="text-zinc-100 font-semibold">3 плоскости с разносом узлов ΔΩ = 60°</span>.
          </div>
        </Card>

        {/* Section 2: Vulnerability Analysis */}
        <Card className="flex flex-col gap-2">
          <CardHeader>
            <CardTitle>2. Матрица уязвимостей и узких мест</CardTitle>
            <Badge variant="neutral">3 ФАКТОРА</Badge>
          </CardHeader>

          <div className="space-y-1.5">
            <div className="p-2 rounded-md bg-[#0d0d10] border border-zinc-800 flex items-start gap-2">
              <Badge variant="red" className="shrink-0">SPOF</Badge>
              <div className="flex-1">
                <div className="font-semibold text-zinc-200">Одиночный шлюз Мурманск (G_MUR)</div>
                <div className="text-zinc-400 text-[11px] mt-0.5 leading-tight">
                  Вызывает <span className="text-rose-400 font-medium">58.5% всех остаточных отказов</span> (24 шага no_gateway_satellite). При аварии станции доступность падает до 0%.
                </div>
              </div>
            </div>

            <div className="p-2 rounded-md bg-[#0d0d10] border border-zinc-800 flex items-start gap-2">
              <Badge variant="amber" className="shrink-0">ISL</Badge>
              <div className="flex-1">
                <div className="font-semibold text-zinc-200">Порог дальности ISL (сценарий 04)</div>
                <div className="text-zinc-400 text-[11px] mt-0.5 leading-tight">
                  При лимите 2000 км доступность падает до <span className="text-amber-400 font-medium">68.29%</span> (644 шага isl_disconnected) из-за разрыва межплоскостных связей.
                </div>
              </div>
            </div>

            <div className="p-2 rounded-md bg-[#0d0d10] border border-zinc-800 flex items-start gap-2">
              <Badge variant="cyan" className="shrink-0">NODE</Badge>
              <div className="flex-1">
                <div className="font-semibold text-zinc-200">Отказ 10 аппаратов (сценарий 03)</div>
                <div className="text-zinc-400 text-[11px] mt-0.5 leading-tight">
                  Сетка сохраняет <span className="text-cyan-300 font-medium">80.88% доступности</span>. Алгоритм Dijkstra обходит аварии; среднее число хопов растет с 2.8 до 4.2.
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 3: Recommendations */}
        <Card className="flex flex-col gap-2 lg:col-span-2">
          <CardHeader>
            <CardTitle>3. Инженерные рекомендации по устойчивости</CardTitle>
            <Badge variant="emerald">ЦЕЛЕВОЙ ЭФФЕКТ: SLA &gt; 99.7%</Badge>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Rec 1 */}
            <div className="p-2.5 rounded-md bg-[#0d0d10] border border-zinc-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-200 font-semibold">Резервный шлюз</span>
                  <span className="text-[10px] text-zinc-500 font-mono">01</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Размещение 2-го шлюза в восточном секторе (Тикси 71.6°N или Анадырь 64.7°N). Устраняет единую точку отказа (SPOF).
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">Прирост SLA:</span>
                <span className="text-emerald-400 font-bold font-mono">98.1% → 99.7%</span>
              </div>
            </div>

            {/* Rec 2 */}
            <div className="p-2.5 rounded-md bg-[#0d0d10] border border-zinc-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-200 font-semibold">Порог ISL ≥ 2800 км</span>
                  <span className="text-[10px] text-zinc-500 font-mono">02</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Энергетический потенциал межспутникового линка радио/лазер не менее 2800 км для устойчивости сетки на высоких широтах.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">Связность рёбер:</span>
                <span className="text-cyan-300 font-bold font-mono">100% выше 60°N</span>
              </div>
            </div>

            {/* Rec 3 */}
            <div className="p-2.5 rounded-md bg-[#0d0d10] border border-zinc-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-200 font-semibold">Фазировка Walker Delta</span>
                  <span className="text-[10px] text-zinc-500 font-mono">03</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Сдвиг истинной аномалии между соседними плоскостями на ΔM = 7.5°. Исключает регулярные слепые пятна между витками.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">Слепые зоны:</span>
                <span className="text-zinc-200 font-bold font-mono">Исключены</span>
              </div>
            </div>

            {/* Rec 4 */}
            <div className="p-2.5 rounded-md bg-[#0d0d10] border border-zinc-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-200 font-semibold">Кольцевой Rerouting</span>
                  <span className="text-[10px] text-zinc-500 font-mono">04</span>
                </div>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  Автоматическое замыкание трафика по кольцу плоскости при разрыве межплоскостного линка с субсекундной сходимостью.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
                <span className="text-zinc-400">Сходимость:</span>
                <span className="text-amber-400 font-bold font-mono">&lt; 1 с</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 4: Operating Envelope */}
        <div className="bg-[#121215] p-2.5 rounded-lg border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 lg:col-span-2 text-[11px] text-zinc-400">
          <div>
            <span className="text-zinc-200 font-semibold uppercase">Границы применимости модели:</span>{' '}
            Оптимизировано для широт &gt; 60°N (Арктика). Базовый расчет радиовидимости: угол места θ ≥ 10°.
          </div>
          <div className="shrink-0">
            <Badge variant="neutral">СХЕМА: cosmo-A-1.0 / cosmo-A-result-1.0</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
