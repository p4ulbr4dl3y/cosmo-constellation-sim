import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Radio,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import type { Scenario, ClientTimeline, TimelineSlot } from '../types/scenario'
import { Card, Button } from './ui'

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

  const handleGanttClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const fraction = Math.max(0, Math.min(1, clickX / rect.width))
    const clickedTime = Math.floor((fraction * horizon_s) / step_s) * step_s
    onTimeChange(clickedTime)
  }

  const handleGanttMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
    clientId: string
  ) => {
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
        y: rect.top - 12,
      })
    }
  }

  return (
    <Card noPadding className="p-2.5 flex flex-col gap-2 select-none">
      {/* Top Row: Playback Controls & Time readout */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Play / Step Buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            size="icon"
            variant="outline"
            onClick={() => onTimeChange(0)}
            title="Перемотать в начало (00:00:00)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => onTimeChange(Math.max(0, currentTime - step_s))}
            title="Шаг назад (-120с)"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            variant={isPlaying ? 'outline' : 'primary'}
            onClick={() => setIsPlaying((v) => !v)}
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
            className="w-24"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current text-[#c4f042]" />
                <span className="text-[#c4f042]">PAUSE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>PLAY</span>
              </>
            )}
          </Button>

          <Button
            size="icon"
            variant="outline"
            onClick={() => onTimeChange(Math.min(horizon_s - step_s, currentTime + step_s))}
            title="Шаг вперед (+120с)"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>

          {/* Speed Selector */}
          <div className="flex items-center ml-2 bg-[#080b11] rounded-lg border border-[#182232] p-0.5 text-xs font-mono">
            {[1, 5, 20, 60].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? 'bg-[#c4f042]/15 text-[#c4f042] font-bold border border-[#c4f042]/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Current Time Display */}
        <div className="flex items-center gap-2.5 font-mono">
          <div className="flex items-center gap-2 bg-[#080b11] border border-[#182232] px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-[#c4f042] animate-pulse" />
            <span className="text-sm font-bold text-slate-100 tracking-wider">
              {formatTime(currentTime)}
            </span>
            <span className="text-[11px] text-slate-400">
              / 24:00:00
            </span>
          </div>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            T+{currentTime}s (dt={step_s}s)
          </span>
        </div>
      </div>

      {/* Main Scrubber Slider */}
      <div className="relative w-full flex flex-col py-0.5">
        <input
          type="range"
          min={0}
          max={horizon_s - step_s}
          step={step_s}
          value={currentTime}
          onChange={(e) => onTimeChange(Number(e.target.value))}
          className="w-full h-1.5 bg-[#141b26] rounded-sm appearance-none cursor-pointer accent-[#c4f042] focus:outline-none"
        />
        {/* Hour tick marks */}
        <div className="flex justify-between text-[9px] font-mono text-slate-400 pt-1 select-none">
          <span>00:00</span>
          <span>04:00</span>
          <span>08:00</span>
          <span>12:00</span>
          <span>16:00</span>
          <span>20:00</span>
          <span>24:00</span>
        </div>
      </div>

      {/* Gantt Availability Diagram */}
      <div className="flex flex-col gap-1 mt-0.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono uppercase">
          <span className="font-semibold text-slate-300 tracking-wider flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-[#c4f042]" />
            ДОСТУПНОСТЬ ТРАССЫ (00:00 - 24:00 UTC)
          </span>
          <div className="flex items-center gap-3 text-[9px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-[#c4f042]" /> СВЯЗЬ ДО ШЛЮЗА
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-red-500" /> ПЕРЕРЫВ
            </span>
          </div>
        </div>

        {/* Client Gantt Bars */}
        <div className="relative flex flex-col gap-1 bg-[#080b11] p-1.5 rounded-lg border border-[#182232]">
          {/* Vertical Playhead across all rows */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#c4f042] z-10 pointer-events-none shadow-[0_0_8px_#c4f042]"
            style={{ left: `calc(${playheadPercent}% + 88px * (1 - ${playheadPercent / 100}))` }}
          />

          {clients.map((c) => {
            const tl = timelines[c.id]
            const isSelected = c.id === selectedClientId
            const availRatio = tl ? (tl.metrics.availability_ratio * 100).toFixed(1) : '0'
            const meetsTarget = tl ? tl.metrics.availability_ratio >= scenario.environment.target_availability : false

            return (
              <div
                key={c.id}
                className={`flex items-center gap-2 rounded-md transition-colors ${
                  isSelected ? 'bg-[#c4f042]/5' : ''
                }`}
              >
                {/* Client Label & Badge */}
                <button
                  onClick={() => onSelectClient(c.id)}
                  className={`w-20 shrink-0 text-left px-1.5 py-0.5 rounded-md font-mono text-xs flex items-center justify-between border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#c4f042]/15 border-[#c4f042]/60 text-[#c4f042] font-bold'
                      : 'bg-[#0c1017] border-[#182232] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span>{c.id}</span>
                  <span
                    className={`text-[9px] font-mono ${
                      meetsTarget ? 'text-[#c4f042]' : 'text-amber-400'
                    }`}
                  >
                    {availRatio}%
                  </span>
                </button>

                {/* The Timeline Bar */}
                <div
                  onClick={handleGanttClick}
                  onMouseMove={(e) => handleGanttMouseMove(e, c.id)}
                  onMouseLeave={() => setTooltipData(null)}
                  className="relative flex-1 h-5 bg-[#0c1017] rounded-sm overflow-hidden cursor-pointer flex border border-[#182232]"
                >
                  {tl &&
                    tl.slots.map((slot, idx) => {
                      return (
                        <div
                          key={idx}
                          style={{ width: `${100 / totalSlots}%` }}
                          className={`h-full ${
                            slot.hasPath
                              ? 'bg-[#c4f042]/85 hover:bg-[#c4f042]'
                              : 'bg-red-500/80 hover:bg-red-400'
                          }`}
                        />
                      )
                    })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Tooltip */}
      {tooltipData && (
        <div
          className="fixed z-50 pointer-events-none bg-[#0c1017] text-slate-100 text-xs px-3 py-2 rounded-lg border border-[#c4f042]/50 shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltipData.x, top: tooltipData.y }}
        >
          <div className="flex items-center gap-2 font-mono font-bold text-[#c4f042] border-b border-[#182232] pb-1 mb-1">
            <span>{tooltipData.clientId}</span>
            <span>{formatTime(tooltipData.slot.t_s)}</span>
            <span className="text-[10px] text-slate-400">
              (t={tooltipData.slot.t_s}s)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {tooltipData.slot.hasPath ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-[#c4f042]" />
                <span className="text-[#c4f042] font-semibold">
                  Связь доступна (Хопов: {tooltipData.slot.hops})
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-300 font-semibold">
                  Перерыв связи: {tooltipData.slot.reason || 'Нет пути'}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
