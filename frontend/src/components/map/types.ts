import type { Scenario, Snapshot } from '../../types/scenario'

export interface NetworkMapProps {
  scenario: Scenario
  snapshot: Snapshot
  selectedClientId: string
  onSelectClient: (clientId: string) => void
  onToggleFailure: (satId: string) => void
}

export interface BadgeLayoutItem {
  id?: string
  text: string
  anchorX: number
  anchorY: number
  priority: number
  font: string
  textColor: string
  borderColor: string
  bgColor: string
  borderWidth?: number
  prefOffsetY?: number
  opacity?: number
}

export type MapViewMode = '2d' | '3d'

export interface HoveredNodeInfo {
  id: string
  type: 'sat' | 'ground'
  x: number
  y: number
}

export interface PlaneColor {
  stroke: string
  glow: string
  fill: string
}
