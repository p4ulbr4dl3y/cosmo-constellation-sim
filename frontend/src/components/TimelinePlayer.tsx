import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react'
import type { Scenario, ClientTimeline, TimelineSlot } from '../types/scenario'

interface TimelinePlayerProps {
  scenario: Scenario
  currentTime: number // seconds
  onTimeChange: (newTime: number) => void
  timelines: Record<string, ClientTimeline>
  selectedClientId: string
  onSelectClient: (clientId: string) => void
}

export const TimelinePlayer: React.FC<TimelinePlayerProps> = ({
  scenario,
  currentTime,
  onTimeChange,
  timelines,
  selectedClientId,
  onSelectClient,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(5) // 5x multiplier

  // Gantt hover tooltip state
  const [tooltipData, setTooltipData] = useState<{
    clientId: string
    slot: TimelineSlot
    x: number
    y: number
  } | null>(null)

  const horizon_s = scenario.environment.horizon_s // 86400
  const step_s = scenario.environment.step_s // 120
  const totalSlots = Math.floor(horizon_s / step_s)

  // Playback timer loop
  const isPlayingRef = useRef(isPlaying)
  const currentTimeRef = useRef(currentTime)
  const speedRef = useRef(playbackSpeed)

  useEffect(() => {
    isPlayingRef.current = isPlaying
    currentTimeRef.current = currentTime
    speedRef.current = playbackSpeed
  }, [isPlaying, currentTime, playbackSpeed])

  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      const nextTime = currentTimeRef.current + step_s
      if (nextTime >= horizon_s) {
        onTimeChange(0)
      } else {
        onTimeChange(nextTime)
      }
    }, Math.max(20, 1000 / (playbackSpeed || 1)))

    return () => clearInterval(interval)
  }, [isPlaying, horizon_s, step_s, onTimeChange, playbackSpeed])

  // Keyboard shortcut: Space to toggle play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying((v) => !v)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        onTimeChange(Math.min(horizon_s - step_s, currentTimeRef.current + step_s))
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        onTimeChange(Math.max(0, currentTimeRef.current - step_s))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [horizon_s, step_s, onTimeChange])

  // Time format helper
  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = Math.floor(totalSeconds % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const clients = useMemo(() => {
    return scenario.ground_sites.filter((g) => g.role === 'client')
  }, [scenario.ground_sites])

  const playheadPercent = (currentTime / horizon_s) * 100

  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const handleSeek = (clientX: number) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const clickedTime = Math.min(
      horizon_s - step_s,
      Math.floor((fraction * horizon_s) / step_s) * step_s
    )
    onTimeChange(clickedTime)
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setTooltipData(null)
    handleSeek(e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) {
      handleSeek(e.clientX)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleGanttMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
    clientId: string
  ) => {
    if (isDragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const hoverX = e.clientX - rect.left
    const fraction = Math.max(0, Math.min(1, hoverX / rect.width))
    const hoveredSlotIdx = Math.min(
      totalSlots - 1,
      Math.max(0, Math.floor(fraction * totalSlots))
    )

    const tl = timelines[clientId]
    if (tl && tl.slots[hoveredSlotIdx]) {
      setTooltipData({
        clientId,
        slot: tl.slots[hoveredSlotIdx],
        x: e.clientX,
        y: rect.top - 8,
      })
    }
  }

  return (
    <div className="p-2 bg-[#090b10] border border-white/10 rounded-xl flex flex-col gap-1.5 select-none font-mono">
      {/* Top Row: Playback Controls & Time readout */}
      <div className="flex items-center justify-between gap-2">
        {/* Play / Step Buttons & Speed */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTimeChange(0)}
            title="В начало (00:00:00)"
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onTimeChange(Math.max(0, currentTime - step_s))}
            title="Шаг назад (-120с)"
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsPlaying((v) => !v)}
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
            className={`h-7 px-2.5 rounded-md text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isPlaying
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/10 hover:bg-white/15 border-white/15 text-white'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </button>

          <button
            onClick={() => onTimeChange(Math.min(horizon_s - step_s, currentTime + step_s))}
            title="Шаг вперед (+120с)"
            className="h-7 w-7 rounded-md flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center ml-1 bg-white/5 rounded-md border border-white/10 p-0.5 text-xs h-7">
            {[1, 5, 20, 60].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 h-full rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-white/20 text-white font-medium'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Current Time Display */}
        <div className="h-7 flex items-center gap-1.5 bg-[#0c1017] border border-white/10 px-2.5 rounded-md text-xs font-mono">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-white tracking-wider">
            {formatTime(currentTime)}
          </span>
          <span className="text-[11px] text-slate-400">/ 24:00:00 UTC</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
            Связь
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Обрыв
          </span>
        </div>
      </div>

      {/* Gantt & Timeline Scrubber Area */}
      <div className="flex gap-1.5 bg-black/40 p-2 rounded-lg border border-white/10">
        {/* Left Column: Client Pills */}
        <div className="w-14 shrink-0 flex flex-col gap-1.5">
          <div className="h-3.5 flex items-center justify-center text-[9px] text-slate-400 font-mono">
            UTC
          </div>
          {clients.map((c) => {
            const tl = timelines[c.id]
            const isSelected = c.id === selectedClientId
            const availRatio = tl ? (tl.metrics.availability_ratio * 100).toFixed(1) : '0'
            const meetsTarget = tl
              ? tl.metrics.availability_ratio >= scenario.environment.target_availability
              : false

            return (
              <button
                key={c.id}
                onClick={() => onSelectClient(c.id)}
                className={`h-4.5 px-1 rounded text-[10px] flex items-center justify-between border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200 font-bold'
                    : 'bg-[#0c1017] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{c.id}</span>
                <span
                  className={`text-[9px] ${
                    meetsTarget ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {availRatio}%
                </span>
              </button>
            )
          })}
        </div>

        {/* Right Column: Unified Timeline & Gantt strips */}
        <div
          ref={timelineRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative flex-1 flex flex-col gap-1.5 cursor-ew-resize select-none"
        >
          {/* Vertical Playhead Cursor spanning through ruler and all 3 Gantt bars */}
          <div
            className="absolute top-0 bottom-0 w-px bg-cyan-400 pointer-events-none z-20 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            style={{ left: `${playheadPercent}%` }}
          >
            {/* Precision top needle marker */}
            <div className="w-2 h-2 -translate-x-[3.5px] -translate-y-0.5 rotate-45 bg-cyan-400" />
          </div>

          {/* Time Ruler */}
          <div className="relative h-3.5 w-full">
            {[0, 4, 8, 12, 16, 20, 24].map((h) => {
              const pct = (h / 24) * 100
              const label = `${String(h).padStart(2, '0')}:00`
              return (
                <div
                  key={h}
                  className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
                  style={{
                    left: `${pct}%`,
                    transform:
                      h === 0
                        ? 'translateX(0%)'
                        : h === 24
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  }}
                >
                  <span className="font-mono text-[9px] text-slate-400">{label}</span>
                  <div className="w-px h-1 bg-white/20 mt-auto" />
                </div>
              )
            })}
          </div>

          {/* Gantt Strips */}
          {clients.map((c) => {
            const tl = timelines[c.id]
            return (
              <div
                key={c.id}
                onMouseMove={(e) => handleGanttMouseMove(e, c.id)}
                onMouseLeave={() => setTooltipData(null)}
                className="relative w-full h-4.5 bg-[#0c1017] rounded-xs overflow-hidden flex border border-white/5"
              >
                {tl &&
                  tl.slots.map((slot, idx) => (
                    <div
                      key={idx}
                      style={{ width: `${100 / totalSlots}%` }}
                      className={`h-full ${
                        slot.hasPath
                          ? 'bg-emerald-600/40 hover:bg-emerald-500/60'
                          : 'bg-rose-500 hover:bg-rose-400 shadow-xs'
                      }`}
                    />
                  ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Tooltip */}
      {tooltipData && (
        <div
          className="fixed z-50 pointer-events-none bg-[#0c1017]/95 text-slate-100 text-[11px] px-2.5 py-1.5 rounded-lg border border-white/15 shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltipData.x, top: tooltipData.y }}
        >
          <div className="flex items-center gap-2 font-bold text-cyan-300 border-b border-white/10 pb-1 mb-1">
            <span>{tooltipData.clientId}</span>
            <span>{formatTime(tooltipData.slot.t_s)}</span>
            <span className="text-[9px] text-slate-400">
              (T+{tooltipData.slot.t_s}s)
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            {tooltipData.slot.hasPath ? (
              <span className="text-emerald-400 font-semibold">
                Связь активна (Хопов: {tooltipData.slot.hops})
              </span>
            ) : (
              <span className="text-rose-400 font-semibold">
                Обрыв: {tooltipData.slot.reason || 'Нет пути'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
