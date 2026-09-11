import React from 'react'

export const ReportView: React.FC = () => {
  return (
    <div className="h-full flex flex-col gap-2 font-mono text-xs overflow-y-auto max-w-[1500px] mx-auto w-full">
      {/* Action Header */}
      <div className="bg-[#0c1017] px-2.5 sm:px-3 py-2 rounded-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">
            АНАЛИТИКА УСТОЙЧИВОСТИ И ИНЖЕНЕРНЫЙ ОТЧЕТ
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hidden sm:inline-flex">
            КРИТЕРИИ 1–3
          </span>
          <span className="text-[10px] text-slate-400 hidden md:inline">
            // 48 КА · 3 плоскости · i=87° · h=550 км
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>SLA 98.10% (НОРМА ≥90%)</span>
          </div>

          <a
            href="https://github.com/p4ulbr4dl3y/cosmo-constellation-sim/blob/main/docs/RECOMMENDATIONS.md"
            target="_blank"
            rel="noreferrer"
            className="h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-mono font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Открыть подробный отчет в docs/"
          >
            <span>docs/ ↗</span>
          </a>
        </div>
      </div>

      {/* Grid: 4 Core Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {/* Section 1: Launch Stages Dynamics */}
        <div className="bg-[#0c1017] p-3 rounded-xl border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">
              1. Динамика этапов развёртывания
            </span>
            <span className="text-[10px] text-slate-400 font-mono">720 шагов / 24 ч</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-rose-500/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>1-я очередь</span>
                  <span className="text-rose-400 font-mono">16 КА</span>
                </div>
                <div className="text-base font-bold font-mono text-rose-400 mt-1">18.56%</div>
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-rose-500 h-full" style={{ width: '18.56%' }} />
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                1 плоскость · разрывы до 13 ч
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-amber-500/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>2-я очередь</span>
                  <span className="text-amber-400 font-mono">32 КА</span>
                </div>
                <div className="text-base font-bold font-mono text-amber-400 mt-1">64.80%</div>
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-amber-400 h-full" style={{ width: '64.80%' }} />
                </div>
              </div>
              <div className="text-[10px] text-slate-400 mt-2">
                2 плоскости · окна без связи
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-emerald-500/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>3-я очередь</span>
                  <span className="text-emerald-400 font-mono">48 КА</span>
                </div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-1">98.10%</div>
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1.5">
                  <div className="bg-emerald-400 h-full" style={{ width: '98.10%' }} />
                </div>
              </div>
              <div className="text-[10px] text-emerald-300 mt-2 font-medium">
                3 плоскости · SLA выполнен
              </div>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] text-slate-300 leading-relaxed">
            <span className="text-cyan-300 font-semibold uppercase">Орбитальная физика:</span> 1-я очередь (16 КА) создает внутриплоскостную цепь, но суточное вращение Земли (15°/ч) уводит плоскость из видимости пунктов на 3–5 витков. Непрерывность в Арктике гарантируют только <span className="text-white font-semibold">3 плоскости с разнесением узлов ΔΩ = 60°</span>.
          </div>
        </div>

        {/* Section 2: Vulnerability Analysis */}
        <div className="bg-[#0c1017] p-3 rounded-xl border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">
              2. Анализ уязвимостей (Матрица рисков)
            </span>
            <span className="text-[10px] font-mono text-amber-400">
              3 ФАКТОРА РИСКА
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-start gap-2">
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono border border-rose-500/30 shrink-0">
                SPOF
              </span>
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Одиночный шлюз Мурманск (G_MUR)</div>
                <div className="text-slate-400 text-[11px] mt-0.5 leading-tight">
                  Вызывает <span className="text-rose-300 font-medium">58.5% всех остаточных отказов</span> (24 шага no_gateway_satellite). При аварии станции доступность падает до 0%.
                </div>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-start gap-2">
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30 shrink-0">
                ISL
              </span>
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Чувствительность к дальности ISL (сценарий 04)</div>
                <div className="text-slate-400 text-[11px] mt-0.5 leading-tight">
                  При лимите 2000 км доступность падает до <span className="text-amber-300 font-medium">68.29%</span> (644 шага isl_disconnected) из-за разрыва межплоскостных связей.
                </div>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-start gap-2">
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono border border-cyan-500/30 shrink-0">
                NODE
              </span>
              <div className="flex-1">
                <div className="font-semibold text-slate-200">Отказ 10 аппаратов (сценарий 03)</div>
                <div className="text-slate-400 text-[11px] mt-0.5 leading-tight">
                  Сетка сохраняет <span className="text-cyan-300 font-medium">80.88% доступности</span>. Алгоритм Dijkstra обходит аварии с ростом средней длины пути с 2.8 до 4.2 хопа.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Recommendations */}
        <div className="bg-[#0c1017] p-3 rounded-xl border border-white/10 flex flex-col gap-2 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-xs">
              3. Обоснованные рекомендации по повышению устойчивости
            </span>
            <span className="text-[10px] font-mono text-emerald-400">ПРОЕКТНЫЙ ЭФФЕКТ: SLA &gt; 99.7%</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
              <div>
                <div className="text-emerald-400 font-semibold mb-1">
                  Резервный шлюз
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Размещение 2-го шлюза в восточном секторе (<span className="text-slate-200">Тикси 71.6°N</span> или <span className="text-slate-200">Анадырь 64.7°N</span>).
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Устраняет SPOF:</span>
                <span className="text-emerald-300 font-bold font-mono">98.1% → 99.7%</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
              <div>
                <div className="text-cyan-400 font-semibold mb-1">
                  Порог ISL ≥ 2800 км
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Энергетический потенциал межспутникового линка радио/лазер не менее 2800 км.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Связность ребер:</span>
                <span className="text-cyan-300 font-bold font-mono">100% выше 60°N</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
              <div>
                <div className="text-indigo-400 font-semibold mb-1">
                  Фазировка Walker Delta
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Сдвиг истинной аномалии между соседними плоскостями на <span className="text-slate-200">ΔM = 7.5°</span>.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Слепые пятна:</span>
                <span className="text-indigo-300 font-bold font-mono">Исключены</span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between">
              <div>
                <div className="text-amber-400 font-semibold mb-1">
                  Кольцевой Rerouting
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Автоматическое замыкание трафика по кольцу плоскости при разрыве межплоскостного линка.
                </p>
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Сходимость:</span>
                <span className="text-amber-300 font-bold font-mono">&lt; 1 с</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Engineering Limitations */}
        <div className="bg-[#0c1017] p-3 rounded-xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 lg:col-span-2">
          <div className="text-[11px] text-slate-400">
            <span className="text-slate-200 font-semibold uppercase">Границы применимости модели:</span>{' '}
            Оптимизировано для широт &gt; 60°N (Арктика). Базовый расчет: угол места θ ≥ 10°. При закрытом рельефе (θ ≥ 15°) доступность снижается на 1.4%.
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/10">
              СХЕМА: cosmo-A-1.0
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
