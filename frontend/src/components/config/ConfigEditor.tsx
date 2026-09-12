import React, { useState, useMemo, useRef, useEffect } from 'react'
import type { Scenario, Failure, GatewayOutage, GroundSite } from '../../types/scenario'
import { Button } from '../ui'
import { OrbitParams } from './OrbitParams'
import { FailureEditor } from './FailureEditor'

interface ConfigEditorProps {
  scenario: Scenario
  onUpdateScenario: (updated: Scenario) => void
  onResetScenario: () => void
  activeRouteSats: string[]
  currentTime: number
}

export const ConfigEditor: React.FC<ConfigEditorProps> = ({
  scenario,
  onUpdateScenario,
  onResetScenario,
  activeRouteSats,
  currentTime,
}) => {
  const normalizeDraft = (sc: Scenario): Scenario => ({
    ...sc,
    failures: Array.isArray(sc.failures) ? sc.failures : [],
    gateway_outages: Array.isArray(sc.gateway_outages) ? sc.gateway_outages : [],
  })

  const [draft, setDraft] = useState<Scenario>(() => normalizeDraft(JSON.parse(JSON.stringify(scenario))))
  const [prevScenario, setPrevScenario] = useState(scenario)
  if (scenario !== prevScenario) {
    setPrevScenario(scenario)
    setDraft(normalizeDraft(JSON.parse(JSON.stringify(scenario))))
  }

  const gateways = useMemo<GroundSite[]>(
    () => draft.ground_sites.filter((g: GroundSite) => g.role === 'gateway'),
    [draft.ground_sites]
  )

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedUpdateScenario = (next: Scenario) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdateScenario(next)
    }, 150)
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const handleLaunchStageChange = (stage: number) => {
    const next = { ...draft, design: { ...draft.design, launch_stage: stage } }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handlePlaneChange = (planeId: string, field: 'raan_deg' | 'phase_deg', value: number) => {
    const nextPlanes = draft.design.planes.map((p) => {
      if (p.id === planeId) {
        return { ...p, [field]: ((value % 360) + 360) % 360 }
      }
      return p
    })
    const next = { ...draft, design: { ...draft.design, planes: nextPlanes } }
    setDraft(next)
    debouncedUpdateScenario(next)
  }

  const handleEnvChange = (field: 'isl_range_km' | 'min_elevation_deg' | 'altitude_km', value: number) => {
    const next = {
      ...draft,
      environment: {
        ...draft.environment,
        [field]: value,
      },
    }
    setDraft(next)
    debouncedUpdateScenario(next)
  }

  // 1-Click disable satellite on active route
  const handleKillActiveRouteSat = () => {
    if (activeRouteSats.length === 0) return
    const targetSat = activeRouteSats[0]
    const start_s = Math.max(0, currentTime - 60)
    const end_s = Math.min(draft.environment.horizon_s, currentTime + 14400) // 4 hours

    const nextFailures: Failure[] = [
      ...(draft.failures ?? []),
      { satellite_id: targetSat, start_s, end_s },
    ]
    const next = { ...draft, failures: nextFailures }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleAddFailure = (failure: Failure) => {
    const nextFailures: Failure[] = [...(draft.failures ?? []), failure]
    const next = { ...draft, failures: nextFailures }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleRemoveFailure = (idx: number) => {
    const nextFailures = (draft.failures ?? []).filter((_, i) => i !== idx)
    const next = { ...draft, failures: nextFailures }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleAddGatewayOutage = (outage: GatewayOutage) => {
    const nextOutages: GatewayOutage[] = [...(draft.gateway_outages ?? []), outage]
    const next = { ...draft, gateway_outages: nextOutages }
    setDraft(next)
    onUpdateScenario(next)
  }

  const handleRemoveGatewayOutage = (idx: number) => {
    const nextOutages = (draft.gateway_outages ?? []).filter((_, i) => i !== idx)
    const next = { ...draft, gateway_outages: nextOutages }
    setDraft(next)
    onUpdateScenario(next)
  }

  return (
    <div className="flex flex-col gap-2 font-sans text-xs max-w-[1500px] mx-auto w-full">
      {/* Top Action Bar */}
      <div className="bg-[#0b1017] px-3 py-2 rounded-md border border-[#1a2636] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-200">
            Конфигурация симуляции
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stress test */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleKillActiveRouteSat}
            disabled={activeRouteSats.length === 0}
            className={`font-mono transition-colors ${
              activeRouteSats.length > 0
                ? 'border-rose-500/30 text-rose-300 hover:bg-rose-500/15 hover:border-rose-500/60'
                : 'opacity-50'
            }`}
          >
            <span>Отказ {activeRouteSats[0] || 'нет КА'} (4ч)</span>
          </Button>

          {/* Reset */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetScenario}
          >
            <span>Сброс</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1 min-h-0">
        {/* Left: Constellation Geometry & Planes */}
        <OrbitParams
          design={draft.design}
          environment={draft.environment}
          onLaunchStageChange={handleLaunchStageChange}
          onPlaneChange={handlePlaneChange}
          onEnvChange={handleEnvChange}
        />

        {/* Right: Failures & Gateway Outages */}
        <FailureEditor
          satellites={draft.design.satellites}
          gateways={gateways}
          failures={draft.failures}
          gatewayOutages={draft.gateway_outages}
          onAddFailure={handleAddFailure}
          onRemoveFailure={handleRemoveFailure}
          onAddGatewayOutage={handleAddGatewayOutage}
          onRemoveGatewayOutage={handleRemoveGatewayOutage}
        />
      </div>
    </div>
  )
}
