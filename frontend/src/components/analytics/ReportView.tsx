import React from 'react'
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Radio,
  Satellite,
  Compass,
  ArrowRight,
  FileText,
} from 'lucide-react'

export const ReportView: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto space-y-4 pr-1 text-slate-200">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-[#0c1017] border border-blue-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
              Критерии 1–3 (до 35 баллов)
            </span>
            <span className="text-xs text-slate-400 font-mono">КосмоХакатон 2026 // Кейс 2</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white mt-1">
            Инженерный анализ устойчивости и рекомендации
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Обоснование конфигурации группировки (48 КА), динамика этапов запуска, диагностика уязвимостей и практические меры повышения SLA до 99.7%.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            Целевой SLA 98.10% (Норма: ≥90%)
          </div>
        </div>
      </div>

      {/* Grid: 4 Core Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Section 1: Launch Stages Dynamics */}
        <div className="bg-[#0e131d] border border-white/[0.08] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Satellite className="w-4 h-4 text-cyan-400" />
              1. Динамика этапов развёртывания
            </h3>
            <span className="text-[11px] font-mono text-slate-400">720 шагов / 24 часа</span>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <div className="text-[11px] text-slate-400 font-medium">1-я очередь</div>
              <div className="text-base font-bold font-mono text-rose-400 mt-1">18.56%</div>
              <div className="text-[10px] text-rose-300/80 mt-0.5">16 КА (1 пл.)</div>
              <div className="text-[9px] text-slate-400 mt-1">Разрывы до 13 ч</div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-[11px] text-slate-400 font-medium">2-я очередь</div>
              <div className="text-base font-bold font-mono text-amber-400 mt-1">64.80%</div>
              <div className="text-[10px] text-amber-300/80 mt-0.5">32 КА (2 пл.)</div>
              <div className="text-[9px] text-slate-400 mt-1">Окна без связи</div>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-[11px] text-emerald-400 font-medium">3-я (Полная)</div>
              <div className="text-base font-bold font-mono text-emerald-400 mt-1">98.10%</div>
              <div className="text-[10px] text-emerald-300/80 mt-0.5">48 КА (3 пл.)</div>
              <div className="text-[9px] text-emerald-400/90 mt-1">SLA достигнут</div>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            <strong className="text-white">Физический вывод:</strong> 1-я очередь (16 КА) дает внутриплоскостную цепочку, но суточное вращение Земли (15°/ч) уводит плоскость из видимости пунктов на 3–5 витков. Непрерывность в Арктике достигается только при объединении <span className="text-cyan-300">3 плоскостей с разнесением узлов ΔΩ = 60°</span>.
          </p>
        </div>

        {/* Section 2: Vulnerability Analysis */}
        <div className="bg-[#0e131d] border border-white/[0.08] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              2. Анализ уязвимостей (Матрица рисков)
            </h3>
            <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Выявлено 3 фактора
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5">
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono shrink-0">
                SPOF
              </span>
              <div>
                <div className="font-medium text-slate-200">Одиночный шлюз Мурманск (G_MUR)</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Дает <strong>58.5% всех остаточных отказов</strong> в штатном режиме (24 шага no_gateway_satellite). При отказе станции связь падает до 0%.
                </div>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono shrink-0">
                ISL
              </span>
              <div>
                <div className="font-medium text-slate-200">Чувствительность к дальности ISL (сценарий 04)</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  При лимите 2000 км доступность падает до <strong>68.29%</strong> (644 шага isl_disconnected) из-за разрыва связей между расходящимися плоскостями.
                </div>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-start gap-2.5">
              <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono shrink-0">
                NODE
              </span>
              <div>
                <div className="font-medium text-slate-200">Отказ 10 аппаратов (сценарий 03)</div>
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Доступность сохраняется на уровне <strong>80.88%</strong>. Алгоритм Dijkstra успешно обходит аварийные узлы с ростом хопов с 2.8 до 4.2.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Concrete Recommendations */}
        <div className="bg-[#0e131d] border border-white/[0.08] rounded-xl p-4 flex flex-col gap-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              3. Обоснованные рекомендации по повышению устойчивости
            </h3>
            <span className="text-[11px] font-mono text-emerald-400">Проектный эффект: SLA &gt; 99.7%</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                  <Radio className="w-3.5 h-3.5" />
                  Резервный шлюз
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Размещение 2-го шлюза в восточном секторе (<strong>Тикси</strong> 71.6°N или <strong>Анадырь</strong> 64.7°N).
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] text-slate-400">
                Устраняет 100% простоев шлюза. <span className="text-emerald-300 font-mono font-medium">SLA: 98.1% → 99.7%</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
                  <Compass className="w-3.5 h-3.5" />
                  Порог ISL ≥ 2800 км
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Обеспечение энергетического потенциала радио/лазерного ISL линка не менее 2800 км.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] text-slate-400">
                Гарантирует 100% связность сетки межплоскостных ребер выше 60°N.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold mb-1">
                  <Satellite className="w-3.5 h-3.5" />
                  Фазировка Walker Delta
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Сдвиг истинной аномалии между соседними плоскостями на <span className="font-mono text-indigo-300">ΔM = 7.5°</span>.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] text-slate-400">
                Шахматный порядок исключает одновременные слепые пятна над абонентами.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                  <ArrowRight className="w-3.5 h-3.5" />
                  Кольцевой Rerouting
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Автоматическое замыкание трафика по кольцу внутри плоскости при выпадении межплоскостного линка.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/[0.06] text-[10px] text-slate-400">
                Время сходимости маршрута &lt;1 с без прерывания сессий абонентов.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Engineering Limitations */}
      <div className="bg-[#0e131d] border border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold text-white">Ограничения применимости модели:</span>
            <span className="text-slate-400 ml-1.5">
              Оптимизировано для широт &gt;60°N (Арктика). Расчет выполнен для угла места антенн θ ≥ 10°. При горном рельефе с θ ≥ 15° доступность снижается на 1.4%.
            </span>
          </div>
        </div>
        <a
          href="https://github.com/p4ulbr4dl3y/cosmo-constellation-sim/blob/main/docs/RECOMMENDATIONS.md"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-slate-200 transition-colors flex items-center gap-1"
        >
          <span>Полный отчет в docs/</span>
          <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
