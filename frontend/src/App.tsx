import { useState, useMemo, useEffect } from 'react'
import type { Scenario } from './types/scenario'
import { PRESET_SCENARIOS } from './data/presets'
import { calculateSnapshot, calculateFullTimeline } from './lib/orbit'
import { Header } from './components/Header'
import { NetworkMap } from './components/NetworkMap'
import { TimelinePlayer } from './components/TimelinePlayer'
import { MetricsPanel } from './components/MetricsPanel'
import { ConfigEditor } from './components/ConfigEditor'
import { ComparisonView } from './components/ComparisonView'

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
  const [activeTab, setActiveTab] = useState<'monitor' | 'config' | 'compare'>('monitor')

  // A/B Comparison scenarios
  const [variantA, setVariantA] = useState<Scenario | null>(PRESET_SCENARIOS[0].data)
  const [variantB, setVariantB] = useState<Scenario | null>(PRESET_SCENARIOS[1].data)

  // Try fetching scenarios from backend API if available
  useEffect(() => {
    fetch('/api/presets')
      .then((res) => {
        if (res.ok) return res.json()
        return null
      })
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          // Backend API is online!
          console.log('Backend /api/presets connected:', data)
        }
      })
      .catch(() => {
        // Backend not running; fallback to local calculation
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

  // Satellites on current active route for selected client
  const activeRouteSats = useMemo(() => {
    const route = snapshot.routes[selectedClientId] || []
    return route.filter((node) => node.startsWith('S'))
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
    const isCurrentlyFailed = scenario.failures.some(
      (f) => f.satellite_id === satId && f.start_s <= currentTime && currentTime < f.end_s
    )

    if (isCurrentlyFailed) {
      // Remove failure covering currentTime
      const updated = {
        ...scenario,
        failures: scenario.failures.filter(
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
        failures: [...scenario.failures, { satellite_id: satId, start_s, end_s }],
      }
      setScenario(updated)
    }
  }

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
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
      />

      {/* Main Content Area */}
      <main className="flex-1 p-3 flex flex-col gap-3 max-w-[1600px] w-full mx-auto">
        {activeTab === 'monitor' && (
          <div className="flex-1 flex flex-col gap-3 min-h-[85vh]">
            {/* Upper Split: Map (65%) & Metrics (35%) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[460px]">
              {/* Map & Network Visualization */}
              <div className="lg:col-span-8 min-h-[420px] h-[55vh] lg:h-auto flex">
                <NetworkMap
                  scenario={scenario}
                  snapshot={snapshot}
                  selectedClientId={selectedClientId}
                  onSelectClient={setSelectedClientId}
                  onToggleFailure={handleToggleFailure}
                />
              </div>

              {/* Metrics & Active Route Panel */}
              <div className="lg:col-span-4 flex flex-col">
                <MetricsPanel
                  scenario={scenario}
                  snapshot={snapshot}
                  timelines={timelines}
                  selectedClientId={selectedClientId}
                  onSelectClient={setSelectedClientId}
                />
              </div>
            </div>

            {/* Bottom Scrubber & Gantt Availability Diagram */}
            <TimelinePlayer
              scenario={scenario}
              currentTime={currentTime}
              onTimeChange={setCurrentTime}
              timelines={timelines}
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
            />
          </div>
        )}

        {activeTab === 'config' && (
          <div className="flex-1 py-2">
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
          <div className="flex-1 py-2">
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
      </main>
    </div>
  )
}
