import { useState, useMemo, useEffect } from 'react'
import type { Scenario } from './types/scenario'
import { PRESET_SCENARIOS } from './data/presets'
import { calculateSnapshot, calculateFullTimeline } from './lib/orbit'
import { Header } from './components/layout/Header'
import { NetworkMap } from './components/map/NetworkMap'
import { TimelinePlayer } from './components/timeline/TimelinePlayer'
import { MetricsPanel } from './components/analytics/MetricsPanel'
import { ConfigEditor } from './components/config/ConfigEditor'
import { ComparisonView } from './components/analytics/ComparisonView'
import { ReportView } from './components/analytics/ReportView'

export default function App() {
  // Active scenario state
  const defaultScenario = PRESET_SCENARIOS[0].data
  const [scenario, setScenario] = useState<Scenario>(defaultScenario)
  const [initialScenario, setInitialScenario] = useState<Scenario>(defaultScenario)

  // Simulation time in seconds
  const [currentTime, setCurrentTime] = useState<number>(0)

  // Selected client for focused route inspection
  const [selectedClientId, setSelectedClientId] = useState<string>('C65')

  // Current tab view
  const [activeTab, setActiveTab] = useState<'monitor' | 'config' | 'compare' | 'report'>('monitor')

  // A/B Comparison scenarios
  const [variantA, setVariantA] = useState<Scenario | null>(PRESET_SCENARIOS[0].data)
  const [variantB, setVariantB] = useState<Scenario | null>(PRESET_SCENARIOS[1].data)

  const [isBackendOnline, setIsBackendOnline] = useState<boolean>(false)

  // Dual-engine detection: verify FastAPI backend availability
  useEffect(() => {
    fetch('/api/presets')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setIsBackendOnline(true)
        } else {
          setIsBackendOnline(false)
        }
      })
      .catch(() => {
        setIsBackendOnline(false)
      })
  }, [])

  // Full day calculation for availability Gantt & SLA metrics
  const { timelines } = useMemo(() => {
    return calculateFullTimeline(scenario)
  }, [scenario])

  // Current moment snapshot (satellite positions, active links, route)
  const snapshot = useMemo(() => {
    return calculateSnapshot(scenario, currentTime)
  }, [scenario, currentTime])

  // Satellites on current active route for selected client (intermediate nodes on [client, sat1, ..., gw])
  const activeRouteSats = useMemo(() => {
    const route = snapshot.routes[selectedClientId] || []
    return route.length >= 3 ? route.slice(1, -1) : []
  }, [snapshot.routes, selectedClientId])

  const isModified = useMemo(() => {
    return JSON.stringify(scenario) !== JSON.stringify(initialScenario)
  }, [scenario, initialScenario])

  // Handlers
  const handleSelectPreset = (preset: Scenario) => {
    setScenario(preset)
    setInitialScenario(preset)
    setCurrentTime(0)
  }

  const handleLoadCustomJson = (custom: Scenario) => {
    setScenario(custom)
    setInitialScenario(custom)
    setCurrentTime(0)
  }

  const handleResetScenario = () => {
    setScenario(initialScenario)
  }

  // Toggle failure for specific satellite
  const handleToggleFailure = (satId: string) => {
    const currentFailures = scenario.failures ?? []
    const isCurrentlyFailed = currentFailures.some(
      (f) => f.satellite_id === satId && f.start_s <= currentTime && currentTime < f.end_s
    )

    if (isCurrentlyFailed) {
      // Remove failure covering currentTime
      const updated = {
        ...scenario,
        failures: currentFailures.filter(
          (f) => !(f.satellite_id === satId && f.start_s <= currentTime && currentTime < f.end_s)
        ),
      }
      setScenario(updated)
    } else {
      // Add 4-hour failure window
      const start_s = Math.max(0, currentTime - 60)
      const end_s = Math.min(scenario.environment.horizon_s, currentTime + 14400)
      const updated = {
        ...scenario,
        failures: [...currentFailures, { satellite_id: satId, start_s, end_s }],
      }
      setScenario(updated)
    }
  }

  return (
    <div className="h-screen w-screen bg-[#07090e] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Navigation Bar */}
      <Header
        currentScenario={scenario}
        onSelectPreset={handleSelectPreset}
        onLoadCustomJson={handleLoadCustomJson}
        onResetScenario={handleResetScenario}
        timelines={timelines}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isModified={isModified}
        isBackendOnline={isBackendOnline}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 p-1.5 sm:p-2 flex flex-col gap-2 overflow-hidden w-full">
        {activeTab === 'monitor' && (
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto lg:overflow-hidden pr-0.5">
            {/* Upper Split: Map (65%) & Metrics (35%) */}
            <div className="shrink-0 lg:shrink lg:flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2">
              {/* Map & Network Visualization */}
              <div className="lg:col-span-8 h-[290px] sm:h-[380px] lg:h-full min-h-[250px] lg:min-h-0 flex overflow-hidden rounded-xl border border-white/10">
                <NetworkMap
                  scenario={scenario}
                  snapshot={snapshot}
                  selectedClientId={selectedClientId}
                  onSelectClient={setSelectedClientId}
                  onToggleFailure={handleToggleFailure}
                />
              </div>

              {/* Metrics & Active Route Panel */}
              <div className="lg:col-span-4 min-h-[300px] lg:h-full lg:min-h-0 flex flex-col overflow-hidden">
                <MetricsPanel
                  scenario={scenario}
                  snapshot={snapshot}
                  timelines={timelines}
                  selectedClientId={selectedClientId}
                  onSelectClient={setSelectedClientId}
                  onToggleFailure={handleToggleFailure}
                />
              </div>
            </div>

            {/* Bottom Scrubber & Gantt Availability Diagram */}
            <div className="shrink-0">
              <TimelinePlayer
                scenario={scenario}
                currentTime={currentTime}
                onTimeChange={setCurrentTime}
                timelines={timelines}
                selectedClientId={selectedClientId}
                onSelectClient={setSelectedClientId}
              />
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-1">
            <ConfigEditor
              scenario={scenario}
              onUpdateScenario={setScenario}
              onResetScenario={handleResetScenario}
              activeRouteSats={activeRouteSats}
              currentTime={currentTime}
            />
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-1">
            <ComparisonView
              currentScenario={scenario}
              variantA={variantA}
              variantB={variantB}
              onSetVariantA={setVariantA}
              onSetVariantB={setVariantB}
              onLoadVariantIntoEditor={(scen) => {
                setScenario(scen)
                setActiveTab('monitor')
              }}
            />
          </div>
        )}

        {activeTab === 'report' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-1">
            <ReportView />
          </div>
        )}
      </main>
    </div>
  )
}
