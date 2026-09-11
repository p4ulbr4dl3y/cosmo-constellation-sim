import type {
  Scenario,
  Snapshot,
  SatelliteSnapshot,
  ClientTimeline,
  ClientMetrics,
  ResultExport,
  RouteRecord,
} from '../types/scenario'

export const R_EARTH = 6371.0
export const MU = 398600.435507
export const OMEGA = (2 * Math.PI) / 86164.09054

export interface GroundPos {
  id: string
  name: string
  role: 'client' | 'gateway'
  lat_deg: number
  lon_deg: number
  x: number
  y: number
  z: number
}

export function getGroundPositions(scenario: Scenario): GroundPos[] {
  return scenario.ground_sites.map((g) => {
    const lat = (g.lat_deg * Math.PI) / 180
    const lon = (g.lon_deg * Math.PI) / 180
    return {
      ...g,
      x: R_EARTH * Math.cos(lat) * Math.cos(lon),
      y: R_EARTH * Math.cos(lat) * Math.sin(lon),
      z: R_EARTH * Math.sin(lat),
    }
  })
}

export function calculateSnapshot(scenario: Scenario, t_s: number): Snapshot {
  const { environment, design, ground_sites, failures, gateway_outages } = scenario
  const r = R_EARTH + environment.altitude_km
  const n = Math.sqrt(MU / Math.pow(r, 3))
  const inc = (environment.inclination_deg * Math.PI) / 180
  const th = (environment.earth_angle0_deg * Math.PI) / 180 + OMEGA * t_s
  const cosTh = Math.cos(th)
  const sinTh = Math.sin(th)

  const planeMap = new Map(design.planes.map((p) => [p.id, p]))

  const activeFailures = new Set<string>()
  for (const f of failures) {
    if (f.start_s <= t_s && t_s < f.end_s) {
      activeFailures.add(f.satellite_id)
    }
  }

  const activeGateways = new Set<string>()
  for (const g of ground_sites) {
    if (g.role === 'gateway') {
      const isOut = gateway_outages.some(
        (o) => o.gateway_id === g.id && o.start_s <= t_s && t_s < o.end_s
      )
      if (!isOut) {
        activeGateways.add(g.id)
      }
    }
  }

  // Calculate satellite positions
  const satSnapshots: SatelliteSnapshot[] = []
  const satIndexMap = new Map<string, number>()

  for (let i = 0; i < design.satellites.length; i++) {
    const sat = design.satellites[i]
    const p = planeMap.get(sat.plane_id) || { raan_deg: 0, phase_deg: 0 }
    const u = ((sat.slot_deg + p.phase_deg) * Math.PI) / 180 + n * t_s
    const om = (p.raan_deg * Math.PI) / 180

    const cu = Math.cos(u)
    const su = Math.sin(u)
    const co = Math.cos(om)
    const so = Math.sin(om)
    const cosInc = Math.cos(inc)
    const sinInc = Math.sin(inc)

    // Inertial coordinates
    const xi = r * (co * cu - so * su * cosInc)
    const yi = r * (so * cu + co * su * cosInc)
    const zi = r * su * sinInc

    // Earth-fixed coordinates
    const x = cosTh * xi + sinTh * yi
    const y = -sinTh * xi + cosTh * yi
    const z = zi

    const isFailed = activeFailures.has(sat.id)
    const isLaunched = sat.launch_batch <= design.launch_stage
    const isActive = isLaunched && !isFailed

    const lat_deg = (Math.asin(Math.max(-1, Math.min(1, z / r))) * 180) / Math.PI
    const lon_deg = (Math.atan2(y, x) * 180) / Math.PI

    satSnapshots.push({
      id: sat.id,
      plane_id: sat.plane_id,
      x_km: x,
      y_km: y,
      z_km: z,
      lat_deg,
      lon_deg,
      active: isActive,
      failed: isFailed,
      launch_batch: sat.launch_batch,
    })
    satIndexMap.set(sat.id, i)
  }

  // Calculate ISL edges between active satellites
  const edges: [string, string, number][] = []
  const islRange = environment.isl_range_km
  const islRangeSq = islRange * islRange
  const rEarthSq = R_EARTH * R_EARTH

  // Adjacency for pathfinding: nodeId -> array of neighbor ids
  const adj = new Map<string, string[]>()
  const addEdge = (u: string, v: string) => {
    let listU = adj.get(u)
    if (!listU) {
      listU = []
      adj.set(u, listU)
    }
    listU.push(v)

    let listV = adj.get(v)
    if (!listV) {
      listV = []
      adj.set(v, listV)
    }
    listV.push(u)
  }

  const numSats = satSnapshots.length
  for (let i = 0; i < numSats; i++) {
    const s1 = satSnapshots[i]
    if (!s1.active) continue

    for (let j = i + 1; j < numSats; j++) {
      const s2 = satSnapshots[j]
      if (!s2.active) continue

      const dx = s2.x_km - s1.x_km
      const dy = s2.y_km - s1.y_km
      const dz = s2.z_km - s1.z_km
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq <= islRangeSq) {
        // Line-of-sight check: distance from Earth center to segment
        const denom = distSq
        const num = -(s1.x_km * dx + s1.y_km * dy + s1.z_km * dz)
        const lam = Math.max(0, Math.min(1, denom > 1e-12 ? num / denom : 0))

        const cx = s1.x_km + lam * dx
        const cy = s1.y_km + lam * dy
        const cz = s1.z_km + lam * dz
        const closestSq = cx * cx + cy * cy + cz * cz

        if (closestSq > rEarthSq) {
          const dist = Math.sqrt(distSq)
          edges.push([s1.id, s2.id, dist])
          addEdge(s1.id, s2.id)
        }
      }
    }
  }

  // Calculate Ground site elevations & links
  const groundPositions = getGroundPositions(scenario)
  const elevations: Record<string, Record<string, number>> = {}
  const minEl = environment.min_elevation_deg

  for (const g of groundPositions) {
    elevations[g.id] = {}
    const isGatewayActive = g.role === 'client' || activeGateways.has(g.id)

    for (let i = 0; i < numSats; i++) {
      const s = satSnapshots[i]
      if (!s.active) continue

      const difX = s.x_km - g.x
      const difY = s.y_km - g.y
      const difZ = s.z_km - g.z
      const dl = Math.sqrt(difX * difX + difY * difY + difZ * difZ)

      const dot = difX * (g.x / R_EARTH) + difY * (g.y / R_EARTH) + difZ * (g.z / R_EARTH)
      const cosZen = Math.max(-1, Math.min(1, dot / dl))
      const elDeg = (Math.asin(cosZen) * 180) / Math.PI

      elevations[g.id][s.id] = elDeg

      if (elDeg >= minEl && isGatewayActive) {
        edges.push([g.id, s.id, dl])
        addEdge(g.id, s.id)
      }
    }
  }

  // Find shortest route for each client to any active gateway (BFS)
  const routes: Record<string, string[]> = {}
  const outageReasons: Record<string, string> = {}

  for (const g of groundPositions) {
    if (g.role !== 'client') continue

    // Check if client has visible sats
    const visibleSats = Object.entries(elevations[g.id] || {}).filter(
      ([, el]) => el >= minEl
    )
    const clientHasVisible = visibleSats.length > 0

    // Check gateway status
    let anyGatewayActive = false
    let anyGatewayVisible = false
    for (const gw of groundPositions) {
      if (gw.role === 'gateway' && activeGateways.has(gw.id)) {
        anyGatewayActive = true
        const gwVisible = Object.entries(elevations[gw.id] || {}).some(
          ([, el]) => el >= minEl
        )
        if (gwVisible) anyGatewayVisible = true
      }
    }

    // BFS from client
    const queue: string[] = [g.id]
    const visited = new Set<string>([g.id])
    const parentMap = new Map<string, string>()
    let targetGateway: string | null = null

    while (queue.length > 0) {
      const curr = queue.shift()!
      if (activeGateways.has(curr)) {
        targetGateway = curr
        break
      }

      const neighbors = adj.get(curr) || []
      for (const next of neighbors) {
        if (!visited.has(next)) {
          // Ground nodes cannot relay traffic
          const isGround = groundPositions.some((gp) => gp.id === next)
          if (isGround && !activeGateways.has(next)) {
            continue
          }
          visited.add(next)
          parentMap.set(next, curr)
          queue.push(next)
        }
      }
    }

    if (targetGateway) {
      const path: string[] = []
      let curr: string | undefined = targetGateway
      while (curr) {
        path.unshift(curr)
        curr = parentMap.get(curr)
      }
      routes[g.id] = path
    } else {
      routes[g.id] = []
      if (!anyGatewayActive) {
        outageReasons[g.id] = 'Шлюз отключен (Gateway outage)'
      } else if (!clientHasVisible) {
        outageReasons[g.id] = `Нет спутников над ${g.id} (уг. места < ${minEl}°)`
      } else if (!anyGatewayVisible) {
        outageReasons[g.id] = `Нет спутников над шлюзом (уг. места < ${minEl}°)`
      } else {
        outageReasons[g.id] = 'Разрыв ISL связности в созвездии'
      }
    }
  }

  return {
    t_s,
    satellites: satSnapshots,
    edges,
    elevations,
    routes,
    outageReasons,
  }
}

export function calculateFullTimeline(scenario: Scenario): {
  timelines: Record<string, ClientTimeline>
  allSnapshots?: Map<number, Snapshot>
} {
  const { environment, ground_sites } = scenario
  const step_s = environment.step_s
  const horizon_s = environment.horizon_s
  const totalSlots = Math.floor(horizon_s / step_s)

  const clients = ground_sites.filter((g) => g.role === 'client')
  const clientTimelines: Record<string, ClientTimeline> = {}

  for (const c of clients) {
    clientTimelines[c.id] = {
      clientId: c.id,
      name: c.name,
      slots: [],
      metrics: {
        client_id: c.id,
        name: c.name,
        visibility_ratio: 0,
        availability_ratio: 0,
        max_gap_s: 0,
        avg_hops: 0,
        total_slots: totalSlots,
        available_slots: 0,
        visible_slots: 0,
      },
    }
  }

  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    const t_s = slotIdx * step_s
    const snap = calculateSnapshot(scenario, t_s)

    for (const c of clients) {
      const path = snap.routes[c.id] || []
      const hasPath = path.length > 0
      const visibleSats = Object.values(snap.elevations[c.id] || {}).some(
        (el) => el >= environment.min_elevation_deg
      )
      const hops = hasPath ? path.length - 1 : 0
      const reason = !hasPath ? snap.outageReasons[c.id] : undefined

      clientTimelines[c.id].slots.push({
        t_s,
        hasPath,
        isVisible: visibleSats,
        hops,
        reason,
      })
    }
  }

  // Compute final metrics for each client
  for (const c of clients) {
    const tl = clientTimelines[c.id]
    let availCount = 0
    let visCount = 0
    let totalHops = 0
    let currentGapSlots = 0
    let maxGapSlots = 0

    for (const slot of tl.slots) {
      if (slot.isVisible) visCount++
      if (slot.hasPath) {
        availCount++
        totalHops += slot.hops
        if (currentGapSlots > maxGapSlots) {
          maxGapSlots = currentGapSlots
        }
        currentGapSlots = 0
      } else {
        currentGapSlots++
      }
    }
    if (currentGapSlots > maxGapSlots) {
      maxGapSlots = currentGapSlots
    }

    tl.metrics.available_slots = availCount
    tl.metrics.visible_slots = visCount
    tl.metrics.availability_ratio = totalSlots > 0 ? availCount / totalSlots : 0
    tl.metrics.visibility_ratio = totalSlots > 0 ? visCount / totalSlots : 0
    tl.metrics.max_gap_s = maxGapSlots * step_s
    tl.metrics.avg_hops = availCount > 0 ? totalHops / availCount : 0
  }

  return { timelines: clientTimelines }
}

export function exportResultFile(
  scenario: Scenario,
  timelines: Record<string, ClientTimeline>
): ResultExport {
  const routes: RouteRecord[] = []
  const { environment, ground_sites } = scenario
  const step_s = environment.step_s
  const horizon_s = environment.horizon_s
  const totalSlots = Math.floor(horizon_s / step_s)
  const clients = ground_sites.filter((g) => g.role === 'client')

  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    const t_s = slotIdx * step_s
    const snap = calculateSnapshot(scenario, t_s)

    for (const c of clients) {
      routes.push({
        t_s,
        client_id: c.id,
        path: snap.routes[c.id] || [],
      })
    }
  }

  const summary_metrics: Record<string, ClientMetrics> = {}
  for (const [id, tl] of Object.entries(timelines)) {
    summary_metrics[id] = tl.metrics
  }

  return {
    schema_version: 'cosmo-A-result-1.0',
    meta: {
      generator: 'CosmoConstellation Studio v1.0',
      calculated_at: new Date().toISOString(),
    },
    effective_scenario: scenario,
    routes,
    summary_metrics,
  }
}
