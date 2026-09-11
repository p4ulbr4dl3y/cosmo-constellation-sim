export interface Plane {
  id: string
  raan_deg: number
  phase_deg: number
}

export interface Satellite {
  id: string
  plane_id: string
  slot_deg: number
  launch_batch: number
}

export interface GroundSite {
  id: string
  name: string
  role: 'client' | 'gateway'
  lat_deg: number
  lon_deg: number
}

export interface Failure {
  satellite_id: string
  start_s: number
  end_s: number
}

export interface GatewayOutage {
  gateway_id: string
  start_s: number
  end_s: number
}

export interface Environment {
  altitude_km: number
  inclination_deg: number
  earth_angle0_deg: number
  horizon_s: number
  step_s: number
  min_elevation_deg: number
  isl_range_km: number
  target_availability?: number
}

export interface Design {
  launch_stage: number
  planes: Plane[]
  satellites: Satellite[]
}

export interface Scenario {
  schema_version: 'cosmo-A-1.0'
  meta: {
    id: string
    title: string
  }
  environment: Environment
  design: Design
  ground_sites: GroundSite[]
  failures: Failure[]
  gateway_outages: GatewayOutage[]
}

export interface SatelliteSnapshot {
  id: string
  plane_id: string
  x_km: number
  y_km: number
  z_km: number
  lat_deg: number
  lon_deg: number
  active: boolean
  failed: boolean
  launch_batch: number
}

export interface Snapshot {
  t_s: number
  satellites: SatelliteSnapshot[]
  edges: [string, string, number][] // [node1, node2, dist_km]
  elevations: Record<string, Record<string, number>> // siteId -> satId -> deg
  routes: Record<string, string[]> // clientId -> [clientId, sat..., gatewayId]
  outageReasons: Record<string, string> // clientId -> reason if no route
  outageCodes?: Record<string, string> // clientId -> failure code (no_client_satellite, etc.)
}

export interface ClientMetrics {
  client_id: string
  name: string
  visibility_ratio: number
  availability_ratio: number
  max_gap_s: number
  avg_hops: number
  total_slots: number
  available_slots: number
  visible_slots: number
}

export interface RouteRecord {
  t_s: number
  client_id: string
  path: string[]
}

export interface ResultExport {
  schema_version: 'cosmo-A-result-1.0'
  meta: {
    generator: string
    calculated_at: string
  }
  effective_scenario: Scenario
  routes: RouteRecord[]
  metrics: Record<string, ClientMetrics>
  summary_metrics: Record<string, ClientMetrics>
  summary: {
    average_availability_pct?: number
    min_availability_pct?: number
    all_meet_target?: boolean
    mean_availability: number
    mean_hops: number
    all_clients_meet_sla: boolean
  }
}

export interface TimelineSlot {
  t_s: number
  hasPath: boolean
  isVisible: boolean
  hops: number
  path?: string[]
  reason?: string
  failureCode?: string
}

export interface ClientTimeline {
  clientId: string
  name: string
  slots: TimelineSlot[]
  metrics: ClientMetrics
}
