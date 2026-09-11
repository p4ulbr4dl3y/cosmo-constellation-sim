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
  }, [isPlaying, playbackSpeed, step_s, horizon_s, onTimeChange])

  // Format seconds to HH:MM:SS
  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec))
    const hrs = Math.floor(s / 3600)
    const mins = Math.floor((s % 3600) / 60)
    const secs = s % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Keyboard shortcut: Space toggles play/pause, Left/Right steps
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space') {
        e.preventDefault()
        setIsPlaying((v) => !v)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        onTimeChange(Math.max(0, currentTime - step_s))
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        onTimeChange(Math.min(horizon_s - step_s, currentTime + step_s))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTime, step_s, horizon_s, onTimeChange])

  // Playhead percentage for range slider and Gantt marker
  const playheadPercent = useMemo(() => {
    return (currentTime / horizon_s) * 100
  }, [currentTime, horizon_s])

  // Client lists for Gantt
  const clients = useMemo(() => {
    return scenario.ground_sites.filter((g) => g.role === 'client')
  }, [scenario.ground_sites])

  // Handle Gantt bar click to seek
  const handleGanttClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, clickX / rect.width))
    const clickedSlot = Math.floor(ratio * totalSlots)
    const targetTime = clickedSlot * step_s
    onTimeChange(Math.min(horizon_s - step_s, targetTime))
  }

  // Handle Gantt hover for tooltip
  const handleGanttMouseMove = (
    e: React.MouseEvent<HTMLDivElement>,
    clientId: string
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const ratio = Math.max(0, Math.min(1, clickX / rect.width))
    const clickedSlot = Math.floor(ratio * totalSlots)
    const tl = timelines[clientId]
    if (tl && tl.slots[clickedSlot]) {
      setTooltipData({
        clientId,
        slot: tl.slots[clickedSlot],
        x: e.clientX,
        y: rect.top - 10,
      })
    }
  }

  return (
    <div className="bg-[#080d17] border border-[#162238] rounded-lg p-2.5 flex flex-col gap-2 shadow-xl select-none">
      {/* Top Row: Playback Controls & Time readout */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Play / Step Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTimeChange(0)}
            title="Перемотать в начало (00:00:00)"
            className="p-1.5 rounded bg-[#0d1424] hover:bg-[#141f36] border border-[#1c2a44] text-slate-400 hover:text-slate-100 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            onClick={() => onTimeChange(Math.max(0, currentTime - step_s))}
            title="Шаг назад (-120с)"
            className="p-1.5 rounded bg-[#0d1424] hover:bg-[#141f36] border border-[#1c2a44] text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsPlaying((v) => !v)}
            title={isPlaying ? 'Пауза (Пробел)' : 'Воспроизведение (Пробел)'}
            className={`px-3 py-1 rounded font-mono text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isPlaying
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-400 shadow-sm'
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
            className="p-1.5 rounded bg-[#0d1424] hover:bg-[#141f36] border border-[#1c2a44] text-slate-400 hover:text-slate-100 transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center ml-2 bg-[#0d1424] rounded border border-[#1c2a44] p-0.5 text-xs font-mono">
            {[1, 5, 20, 60].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
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
          <div className="flex items-center gap-2 bg-[#050810] border border-[#1a263c] px-2.5 py-1 rounded">
            <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-sm font-bold text-slate-100 tracking-wider">
              {formatTime(currentTime)}
            </span>
            <span className="text-[11px] text-slate-500">
              / 24:00:00
            </span>
          </div>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
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
          className="w-full h-1 bg-[#151f33] rounded-sm appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
        />
        {/* Hour tick marks */}
        <div className="flex justify-between text-[9px] font-mono text-slate-500 pt-1 select-none">
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
            <Radio className="w-3 h-3 text-cyan-400" />
            ДОСТУПНОСТЬ ТРАССЫ (00:00 - 24:00 UTC)
          </span>
          <div className="flex items-center gap-3 text-[9px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-emerald-500" /> СВЯЗЬ ДО ШЛЮЗА
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-xs bg-red-500" /> ПЕРЕРЫВ
            </span>
          </div>
        </div>

        {/* Client Gantt Bars */}
        <div className="relative flex flex-col gap-1 bg-[#050810] p-1.5 rounded border border-[#141e30]">
          {/* Vertical Playhead across all rows */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-10 pointer-events-none shadow-[0_0_8px_#22d3ee]"
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
                className={`flex items-center gap-2 rounded transition-colors ${
                  isSelected ? 'bg-cyan-950/20' : ''
                }`}
              >
                {/* Client Label & Badge */}
                <button
                  onClick={() => onSelectClient(c.id)}
                  className={`w-20 shrink-0 text-left px-1.5 py-0.5 rounded font-mono text-xs flex items-center justify-between border transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 font-bold'
                      : 'bg-[#101726] border-[#1e2a3f] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span>{c.id}</span>
                  <span
                    className={`text-[9px] font-mono ${
                      meetsTarget ? 'text-emerald-400' : 'text-amber-400'
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
                  className="relative flex-1 h-5 bg-[#121927] rounded overflow-hidden cursor-pointer flex border border-[#1a263d]"
                >
                  {tl &&
                    tl.slots.map((slot, idx) => {
                      return (
                        <div
                          key={idx}
                          style={{ width: `${100 / totalSlots}%` }}
                          className={`h-full ${
                            slot.hasPath
                              ? 'bg-emerald-500/85 hover:bg-emerald-400'
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
          className="fixed z-50 pointer-events-none bg-[#0a101d] text-slate-100 text-xs px-3 py-2 rounded-lg border border-cyan-500/50 shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-full"
          style={{ left: tooltipData.x, top: tooltipData.y }}
        >
          <div className="flex items-center gap-2 font-mono font-bold text-cyan-300 border-b border-slate-700 pb-1 mb-1">
            <span>{tooltipData.clientId}</span>
            <span>{formatTime(tooltipData.slot.t_s)}</span>
            <span className="text-[10px] text-slate-400">
              (t={tooltipData.slot.t_s}s)
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            {tooltipData.slot.hasPath ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">
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
    </div>
  )
}
