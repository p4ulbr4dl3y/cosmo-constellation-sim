import React, { useState } from 'react'
import { Trash2, ChevronDown } from 'lucide-react'
import type { Failure, GatewayOutage, GroundSite, Satellite } from '../../types/scenario'
import { Button, Badge } from '../ui'
import {
  secondsToTimeInputValue,
  secondsToHHMM,
  hhmmToSeconds,
  formatDurationHuman,
} from '../../lib/formatters'

export interface FailureEditorProps {
  satellites: Satellite[]
  gateways: GroundSite[]
  failures: Failure[]
  gatewayOutages: GatewayOutage[]
  onAddFailure: (failure: Failure) => void
  onRemoveFailure: (index: number) => void
  onAddGatewayOutage: (outage: GatewayOutage) => void
  onRemoveGatewayOutage: (index: number) => void
}

export const FailureEditor: React.FC<FailureEditorProps> = ({
  satellites,
  gateways,
  failures,
  gatewayOutages,
  onAddFailure,
  onRemoveFailure,
  onAddGatewayOutage,
  onRemoveGatewayOutage,
}) => {
  const [newFailSat, setNewFailSat] = useState<string>(satellites[0]?.id || 'S01')
  const [newFailStart, setNewFailStart] = useState<number>(21600) // 06:00
  const [newFailEnd, setNewFailEnd] = useState<number>(43200) // 12:00

  const [newGwId, setNewGwId] = useState<string>(gateways[0]?.id || 'G_MUR')
  const [newGwStart, setNewGwStart] = useState<number>(10800) // 03:00
  const [newGwEnd, setNewGwEnd] = useState<number>(21600) // 06:00

  const handleAddFailure = () => {
    if (newFailStart >= newFailEnd) {
      alert('Время начала отказа должно быть меньше времени окончания.')
      return
    }
    const targetSat = satellites.some((s) => s.id === newFailSat)
      ? newFailSat
      : satellites[0]?.id
    if (!targetSat) return

    onAddFailure({ satellite_id: targetSat, start_s: newFailStart, end_s: newFailEnd })
  }

  const handleAddGatewayOutage = () => {
    if (newGwStart >= newGwEnd) {
      alert('Время начала отказа должно быть меньше времени окончания.')
      return
    }
    const targetGwId = gateways.some((g) => g.id === newGwId) ? newGwId : gateways[0]?.id
    if (!targetGwId) return

    onAddGatewayOutage({ gateway_id: targetGwId, start_s: newGwStart, end_s: newGwEnd })
  }

  return (
    <div className="flex flex-col gap-2 lg:overflow-y-auto">
      {/* Satellite Outages */}
      <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
          <span>Отказы спутников ({failures.length})</span>
        </span>

        {/* Add failure row */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#070b10] p-1.5 rounded border border-[#1a2636] text-xs">
          <div className="relative">
            <select
              value={newFailSat}
              onChange={(e) => setNewFailSat(e.target.value)}
              className="h-7 pl-2 pr-7 bg-[#070b10] hover:bg-[#0c131c] border border-[#1a2636] text-zinc-200 text-xs font-mono rounded-md appearance-none focus:outline-none focus:border-[#2a3c54] transition-colors cursor-pointer"
            >
              {satellites.map((s) => (
                <option key={s.id} value={s.id} className="bg-[#070b10] text-zinc-200">
                  {s.id} ({s.plane_id})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md px-1.5 h-7 focus-within:border-cyan-400/40">
              <span className="text-zinc-500 text-[10px] mr-1.5 select-none font-sans">с</span>
              <input
                type="time"
                value={secondsToTimeInputValue(newFailStart)}
                onChange={(e) => setNewFailStart(hhmmToSeconds(e.target.value))}
                className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
              />
            </div>
            <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md px-1.5 h-7 focus-within:border-cyan-400/40">
              <span className="text-zinc-500 text-[10px] mr-1.5 select-none font-sans">по</span>
              <input
                type="time"
                value={secondsToTimeInputValue(newFailEnd)}
                onChange={(e) => setNewFailEnd(hhmmToSeconds(e.target.value))}
                className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddFailure}
            className="w-full sm:w-auto sm:ml-auto hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <span>Добавить</span>
          </Button>
        </div>

        {/* Failures list */}
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
          {failures.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-5 px-3 rounded-md border border-dashed border-[#1a2636] bg-[#070b10]/40 text-center">
              <span className="text-zinc-300 text-xs font-medium">Штатное функционирование КА</span>
              <span className="text-[10px] text-zinc-500 mt-0.5 font-sans">Активных отказов в симуляции нет</span>
            </div>
          ) : (
            failures.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-[#070b10] px-2.5 py-1.5 rounded-md border border-[#1a2636] text-xs"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="red">{f.satellite_id}</Badge>
                  <span className="text-zinc-300 text-[11px]">
                    {secondsToHHMM(f.start_s)} — {secondsToHHMM(f.end_s)}
                  </span>
                  <span className="text-zinc-400 text-[10px]">
                    ({formatDurationHuman(f.end_s - f.start_s)})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveFailure(idx)}
                  className="w-6 h-6 p-0 text-zinc-400 hover:text-rose-400"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Gateway Outages */}
      <div className="bg-[#0b1017] p-3 rounded-md border border-[#1a2636] flex flex-col gap-2.5">
        <span className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
          <span>Окна обслуживания наземных шлюзов ({gatewayOutages.length})</span>
        </span>

        {/* Add gateway outage row */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#070b10] p-1.5 rounded border border-[#1a2636] text-xs">
          {gateways.length > 1 && (
            <div className="relative">
              <select
                value={newGwId}
                onChange={(e) => setNewGwId(e.target.value)}
                className="h-7 pl-2 pr-7 bg-[#070b10] hover:bg-[#0c131c] border border-[#1a2636] text-zinc-200 text-xs font-mono rounded-md appearance-none focus:outline-none focus:border-[#2a3c54] transition-colors cursor-pointer"
              >
                {gateways.map((g) => (
                  <option key={g.id} value={g.id} className="bg-[#070b10] text-zinc-200">
                    {g.id} ({g.name || 'Шлюз'})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs">
            <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md px-1.5 h-7 focus-within:border-cyan-400/40">
              <span className="text-zinc-500 text-[10px] mr-1.5 select-none font-sans">с</span>
              <input
                type="time"
                value={secondsToTimeInputValue(newGwStart)}
                onChange={(e) => setNewGwStart(hhmmToSeconds(e.target.value))}
                className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
              />
            </div>
            <div className="flex items-center bg-[#070b10] border border-[#1a2636] rounded-md px-1.5 h-7 focus-within:border-cyan-400/40">
              <span className="text-zinc-500 text-[10px] mr-1.5 select-none font-sans">по</span>
              <input
                type="time"
                value={secondsToTimeInputValue(newGwEnd)}
                onChange={(e) => setNewGwEnd(hhmmToSeconds(e.target.value))}
                className="bg-transparent text-zinc-200 text-xs font-mono focus:outline-none"
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddGatewayOutage}
            className="w-full sm:w-auto sm:ml-auto hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <span>Добавить</span>
          </Button>
        </div>

        {/* Outages list */}
        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-0.5">
          {gatewayOutages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-5 px-3 rounded-md border border-dashed border-[#1a2636] bg-[#070b10]/40 text-center">
              <span className="text-zinc-300 text-xs font-medium">Шлюзы доступны 24/7</span>
              <span className="text-[10px] text-zinc-500 mt-0.5 font-sans">Окна регламентного обслуживания не назначены</span>
            </div>
          ) : (
            gatewayOutages.map((o, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-[#070b10] px-2.5 py-1.5 rounded-md border border-[#1a2636] text-xs"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="amber">{o.gateway_id}</Badge>
                  <span className="text-zinc-300 text-[11px]">
                    {secondsToHHMM(o.start_s)} — {secondsToHHMM(o.end_s)}
                  </span>
                  <span className="text-zinc-400 text-[10px]">
                    ({formatDurationHuman(o.end_s - o.start_s)})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveGatewayOutage(idx)}
                  className="w-6 h-6 p-0 text-zinc-400 hover:text-rose-400"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
