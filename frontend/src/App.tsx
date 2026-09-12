import { useState, useMemo } from 'react'
import type { Scenario } from './types/scenario'
import { PRESET_SCENARIOS } from './data/presets'
import { calculateSnapshot, calculateFullTimeline } from './lib/orbit'
import { Activity, Sliders, GitCompare, BarChart3 } from 'lucide-react'
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
    <div className="h-[100dvh] w-full bg-[#06090e] text-zinc-100 flex flex-col font-sans select-none overflow-hidden">
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
      <main className="flex-1 min-h-0 p-1.5 sm:p-2 flex flex-col gap-2 overflow-hidden w-full">
        {activeTab === 'monitor' && (
          <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 lg:grid-rows-[1fr_auto] gap-2 overflow-y-auto overflow-x-hidden lg:overflow-hidden">
            {/* Map & Network Visualization */}
            <div className="order-1 lg:col-span-8 lg:row-start-1 h-[45vh] min-h-[280px] sm:h-[400px] lg:h-full lg:min-h-0 flex flex-col overflow-hidden rounded-md border border-[#1a2636] shrink-0 lg:shrink">
              <NetworkMap
                scenario={scenario}
                snapshot={snapshot}
                selectedClientId={selectedClientId}
                onSelectClient={setSelectedClientId}
                onToggleFailure={handleToggleFailure}
              />
            </div>

            {/* Scrubber & Gantt: Mobile order-2 (directly after map), Desktop row-start-2 col-span-12 */}
            <div className="order-2 lg:order-3 lg:col-span-12 lg:row-start-2 shrink-0">
              <TimelinePlayer
                scenario={scenario}
                currentTime={currentTime}
                onTimeChange={setCurrentTime}
                timelines={timelines}
                selectedClientId={selectedClientId}
                onSelectClient={setSelectedClientId}
              />
            </div>

            {/* Metrics & Active Route Panel: Mobile order-3, Desktop row-start-1 col-span-4 */}
            <div className="order-3 lg:order-2 lg:col-span-4 lg:row-start-1 min-h-[300px] lg:h-full lg:min-h-0 flex flex-col overflow-hidden shrink-0 lg:shrink">
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
            <ReportView currentScenario={scenario} timelines={timelines} />
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (iOS / Android Ergonomic Thumb Navigation) */}
      <nav
        aria-label="Мобильная навигация"
        className="md:hidden shrink-0 bg-[#0b1017] border-t border-[#1a2636] z-40 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="grid grid-cols-4 h-12">
          {[
            { value: 'monitor' as const, label: 'Монитор', icon: Activity },
            { value: 'config' as const, label: 'Конфиг', icon: Sliders },
            { value: 'compare' as const, label: 'Сравн.', icon: GitCompare },
            { value: 'report' as const, label: 'Отчет', icon: BarChart3 },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer select-none ${
                  isActive
                    ? 'text-sky-400 font-semibold bg-sky-500/10'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-zinc-400'}`} />
                <span className="text-[10px] tracking-tight">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
