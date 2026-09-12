import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
} from 'lucide-react'
import type { Scenario, ClientTimeline, TimelineSlot } from '../../types/scenario'
import { Button, SegmentedControl, ClientSelector } from '../ui'
import { formatTimeHms } from '../../lib/formatters'

interface TimelinePlayerProps {
  scenario: Scenario
  currentTime: number // seconds
  onTimeChange: (newTime: number) => void
  timelines: Record<string, ClientTimeline>
  selectedClientId: string
  onSelectClient: (clientId: string) => void
}

interface ClientGanttStripProps {
  clientId: string
  slots?: TimelineSlot[]
  totalSlots: number
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>, clientId: string) => void
  onMouseLeave: () => void
}

interface GanttSegment {
  hasPath: boolean
  startIdx: number
  length: number
}

const ClientGanttStrip = React.memo(function ClientGanttStrip({
  clientId,
  slots,
  totalSlots,
  onMouseMove,
  onMouseLeave,
}: ClientGanttStripProps) {
  const segments = useMemo(() => {
    if (!slots || slots.length === 0 || totalSlots <= 0) return []
    const res: GanttSegment[] = []
    let cur: GanttSegment = {
      hasPath: Boolean(slots[0].hasPath),
      startIdx: 0,
      length: 1,
    }
    for (let i = 1; i < slots.length; i++) {
      const hp = Boolean(slots[i].hasPath)
      if (hp === cur.hasPath) {
        cur.length++
      } else {
        res.push(cur)
        cur = { hasPath: hp, startIdx: i, length: 1 }
      }
    }
    res.push(cur)
    return res
  }, [slots, totalSlots])

  return (
    <div
      onMouseMove={(e) => onMouseMove(e, clientId)}
      onMouseLeave={onMouseLeave}
      className="relative w-full h-6 bg-[#070b10] rounded-xs overflow-hidden border border-[#1a2636]/70"
    >
      {segments.map((seg, idx) => {
        const leftPct = (seg.startIdx / totalSlots) * 100
        const widthPct = (seg.length / totalSlots) * 100
        return (
          <div
            key={idx}
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              minWidth: !seg.hasPath ? '2px' : undefined,
            }}
            className={`absolute top-0 bottom-0 pointer-events-none ${
              seg.hasPath
                ? 'bg-emerald-600/35 border-t border-emerald-400/40'
                : 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.6)] z-1'
            }`}
          />
        )
      })}
    </div>
  )
})

function formatOutageReason(reason?: string): string {
  if (!reason) return 'нет пути'
  if (reason.includes('no_client_satellite') || reason.includes('Нет спутников над')) {
    return 'вне видимости'
  }
  if (reason.includes('gateway_offline') || reason.includes('Шлюз отключен')) {
    return 'шлюз отключен'
  }
  if (reason.includes('no_gateway_satellite') || reason.includes('над шлюзом')) {
    return 'нет КА над шлюзом'
  }
  if (reason.includes('isl_disconnected') || reason.includes('рассоединен')) {
    return 'меш-сеть разорвана'
  }
  return reason
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

  const horizon_s = scenario.environment.horizon_s || 86400
  const step_s = scenario.environment.step_s || 120
  const totalSlots = Math.floor(horizon_s / step_s)

  const timeRulerTicks = useMemo(() => {
    const totalHours = horizon_s / 3600
    const hourStep = totalHours <= 12 ? 2 : totalHours <= 24 ? 4 : 8
    const ticks: number[] = []
    for (let h = 0; h <= totalHours; h += hourStep) {
      ticks.push(h)
    }
    if (ticks[ticks.length - 1] !== totalHours) {
      ticks.push(totalHours)
    }
    return { ticks, totalHours }
  }, [horizon_s])

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
  const formatTime = formatTimeHms

  const clients = useMemo(() => {
    return scenario.ground_sites.filter((g) => g.role === 'client')
  }, [scenario.ground_sites])

  const playheadPercent = useMemo(() => {
    return Math.min(100, Math.max(0, (currentTime / horizon_s) * 100))
  }, [currentTime, horizon_s])

  const timelineRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const handleSeek = (clientX: number) => {
    if (!timelineRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const ratio = clickX / rect.width
    const targetSeconds = Math.round((ratio * horizon_s) / step_s) * step_s
    onTimeChange(Math.max(0, Math.min(horizon_s - step_s, targetSeconds)))
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

  const speedOptions = [
    { value: 1, label: '1x' },
    { value: 5, label: '5x' },
    { value: 20, label: '20x' },
    { value: 60, label: '60x' },
  ]

  const handleGanttMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>, clientId: string) => {
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
    },
    [isDragging, totalSlots, timelines]
  )

  const handleGanttMouseLeave = React.useCallback(() => {
    setTooltipData(null)
  }, [])

  return (
    <div className="p-2 bg-[#0b1017] border border-[#1a2636] rounded-md flex flex-col gap-1.5 select-none font-mono">
      {/* Top Row: Playback Controls & Time readout */}
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {/* Play / Step Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onTimeChange(0)}
            title="В начало (00:00:00)"
            className="h-7 w-7 border border-[#1a2636] bg-white/5 hover:bg-white/10 shrink-0 p-0 touch-manipulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onTimeChange(Math.max(0, currentTime - step_s))}
            title="Шаг назад (-120с)"
            className="h-7 w-7 border border-[#1a2636] bg-white/5 hover:bg-white/10 shrink-0 p-0 touch-manipulation"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <Button
            type="button"
            variant={isPlaying ? 'accent' : 'primary'}
            size="icon"
            onClick={() => setIsPlaying((v) => !v)}
            aria-label={isPlaying ? 'Пауза' : 'Старт'}
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
            className="h-7 w-7 shrink-0 touch-manipulation"
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onTimeChange(Math.min(horizon_s - step_s, currentTime + step_s))}
            title="Шаг вперед (+120с)"
            className="h-7 w-7 border border-[#1a2636] bg-white/[0.04] hover:bg-white/[0.08] shrink-0 p-0 touch-manipulation"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Current Time Display */}
        <div className="h-7 flex items-center gap-1 sm:gap-1.5 bg-[#070b10] border border-[#1a2636] px-2 sm:px-2.5 rounded text-xs font-mono shrink-0">
          <span className="font-semibold text-white tracking-wider text-[11px] sm:text-xs whitespace-nowrap">
            {formatTime(currentTime)}
          </span>
          <span className="text-[10px] sm:text-[11px] text-zinc-500 whitespace-nowrap">/ {formatTime(horizon_s)}</span>
        </div>
      </div>

      {/* Middle Area: Gantt & Timeline Scrubber Area */}
      <div className="flex gap-1.5 bg-[#070b10] p-2 rounded border border-[#1a2636]">
        {/* Left Column: Client Pills */}
        <div className="w-12 sm:w-14 shrink-0 flex flex-col gap-1.5 pt-[22px]">
          <ClientSelector
            clients={clients}
            selectedClientId={selectedClientId}
            onSelectClient={onSelectClient}
            timelines={timelines}
            targetAvailability={scenario.environment.target_availability ?? 0.9}
            direction="vertical"
            showMetrics={false}
          />
        </div>

        {/* Right Column: Unified Timeline & Gantt strips */}
        <div
          ref={timelineRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative flex-1 flex flex-col gap-1.5 cursor-ew-resize select-none touch-none"
        >
          {/* Vertical Playhead Cursor spanning through ruler and all 3 Gantt bars */}
          <div
            className="absolute top-4 bottom-0 w-px bg-sky-400 pointer-events-none z-20"
            style={{ left: `${playheadPercent}%` }}
          >
            {/* Precision top needle marker below text line */}
            <div className="w-2 h-2 -translate-x-[3.5px] -translate-y-1 rotate-45 bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.75)]" />
          </div>

          {/* Time Ruler */}
          <div className="relative h-4 w-full">
            {timeRulerTicks.ticks.map((h, idx) => {
              const pct = (h / (timeRulerTicks.totalHours || 1)) * 100
              const totalMin = Math.round(h * 60)
              const hh = Math.floor(totalMin / 60)
              const mm = totalMin % 60
              const label = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
              const isDense = idx % 2 !== 0 && h !== 0 && h !== timeRulerTicks.totalHours
              return (
                <div
                  key={h}
                  className={`absolute top-0 bottom-0 flex flex-col items-center pointer-events-none ${
                    isDense ? 'hidden sm:flex' : 'flex'
                  }`}
                  style={{
                    left: `${pct}%`,
                    transform:
                      h === 0
                        ? 'translateX(0%)'
                        : h >= timeRulerTicks.totalHours
                        ? 'translateX(-100%)'
                        : 'translateX(-50%)',
                  }}
                >
                  <span className="font-mono text-[9px] text-zinc-400 leading-none">{label}</span>
                  <div className="w-px h-1 bg-white/20 mt-auto" />
                </div>
              )
            })}
          </div>

          {/* Gantt Strips */}
          {clients.map((c) => (
            <ClientGanttStrip
              key={c.id}
              clientId={c.id}
              slots={timelines[c.id]?.slots}
              totalSlots={totalSlots}
              onMouseMove={handleGanttMouseMove}
              onMouseLeave={handleGanttMouseLeave}
            />
          ))}
        </div>
      </div>

      {/* Bottom Row: Speed Selector & Legend */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        {/* Speed Selector */}
        <div className="flex items-center shrink-0">
          <SegmentedControl
            options={speedOptions}
            value={playbackSpeed}
            onChange={setPlaybackSpeed}
            size="sm"
            className="h-7"
          />
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-xs text-zinc-400 font-sans shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Связь
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.6)]" />
            Обрыв
          </span>
        </div>
      </div>

      {/* Floating Tooltip */}
      {tooltipData && (() => {
        const clampedX =
          typeof window !== 'undefined'
            ? Math.max(90, Math.min(window.innerWidth - 90, tooltipData.x))
            : tooltipData.x
        return (
          <div
            className="fixed z-50 pointer-events-none bg-[#070b10] text-zinc-100 text-[11px] px-2.5 py-1.5 rounded-md border border-[#1a2636] shadow-2xl transform -translate-x-1/2 -translate-y-full mb-1 flex flex-col gap-0.5"
            style={{ left: clampedX, top: tooltipData.y }}
          >
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400 font-medium">
              <span className="text-sky-300 font-semibold">{tooltipData.clientId}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-200">{formatTime(tooltipData.slot.t_s)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono whitespace-nowrap">
              {tooltipData.slot.hasPath ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-semibold">
                    Доступно · {tooltipData.slot.hops} {tooltipData.slot.hops === 1 ? 'хоп' : 'хопа'}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.6)] shrink-0" />
                  <span className="text-rose-400 font-semibold">
                    Обрыв: {formatOutageReason(tooltipData.slot.reason)}
                  </span>
                </>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
