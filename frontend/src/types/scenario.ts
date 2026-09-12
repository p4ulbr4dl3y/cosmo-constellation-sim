/**
 * Орбитальная плоскость спутниковой группировки.
 */
export interface Plane {
  id: string
  raan_deg: number
  phase_deg: number
}

/**
 * Космический аппарат созвездия.
 */
export interface Satellite {
  id: string
  plane_id: string
  slot_deg: number
  launch_batch: number
}

/**
 * Наземный пункт связи (клиентский терминал или базовый шлюз).
 */
export interface GroundSite {
  id: string
  name: string
  role: 'client' | 'gateway'
  lat_deg: number
  lon_deg: number
}

/**
 * Временной интервал отказа космического аппарата.
 */
export interface Failure {
  satellite_id: string
  start_s: number
  end_s: number
}

/**
 * Временной интервал отключения или техобслуживания наземного шлюза.
 */
export interface GatewayOutage {
  gateway_id: string
  start_s: number
  end_s: number
}

/**
 * Параметры внешней среды и баллистической конфигурации созвездия.
 */
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

/**
 * Конфигурация орбитального построения созвездия.
 */
export interface Design {
  launch_stage: number
  planes: Plane[]
  satellites: Satellite[]
}

/**
 * Полное описание сценария моделирования спутниковой группировки (схема cosmo-A-1.0).
 */
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

/**
 * Мгновенное расчетное состояние космического аппарата.
 */
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

/**
 * Мгновенный снимок состояния созвездия и сетевой топологии на расчетную секунду t_s.
 */
export interface Snapshot {
  t_s: number
  satellites: SatelliteSnapshot[]
  edges: [string, string, number][] // Ребра графа: [узел1, узел2, расстояние_км]
  elevations: Record<string, Record<string, number>> // Углы места: пункт -> спутник -> градусы
  routes: Record<string, string[]> // Маршруты: клиент -> последовательность узлов связи
  outageReasons: Record<string, string> // Текстовая причина отсутствия связи
  outageCodes?: Record<string, string> // Код причины сбоя связи
}

/**
 * Итоговые агрегированные показатели качества связи для клиента.
 */
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

/**
 * Запись маршрута доставки пакетов для клиента на момент времени t_s.
 */
export interface RouteRecord {
  t_s: number
  client_id: string
  path: string[]
}

/**
 * Результаты моделирования функционирования группировки (схема cosmo-A-result-1.0).
 */
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

/**
 * Состояние доступности канала связи в отдельном дискретном интервале времени.
 */
export interface TimelineSlot {
  t_s: number
  hasPath: boolean
  isVisible: boolean
  hops: number
  path?: string[]
  reason?: string
  failureCode?: string
}

/**
 * Временная шкала клиента со всеми расчетными интервалами и сводными метриками.
 */
export interface ClientTimeline {
  clientId: string
  name: string
  slots: TimelineSlot[]
  metrics: ClientMetrics
}
