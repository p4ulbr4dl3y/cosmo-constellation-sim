import { WORLD_LANDMASSES } from '../../data/worldCoastline'
import { R_EARTH } from '../../lib/orbit'
import type { Snapshot } from '../../types/scenario'
import { drawBadgesWithLayout } from './badges'
import { defaultPlaneColor, isSegmentVisible3D, planeColors, project3D } from './projection'
import type { BadgeLayoutItem, HoveredNodeInfo } from './types'

// Static Cartesian 3D coordinates on unit sphere * R_EARTH for 0-allocation, 0-trig rendering
interface PrecomputedLandmass {
  points: Array<{ gx: number; gy: number; gz: number }>
}

const PRECOMPUTED_LANDMASSES: PrecomputedLandmass[] = WORLD_LANDMASSES.map((land) => ({
  points: land.points.map(([lon, lat]) => {
    const latRad = (lat * Math.PI) / 180
    const lonRad = (lon * Math.PI) / 180
    return {
      gx: R_EARTH * Math.cos(latRad) * Math.cos(lonRad),
      gy: R_EARTH * Math.cos(latRad) * Math.sin(lonRad),
      gz: R_EARTH * Math.sin(latRad),
    }
  }),
}))

export interface Render3DOptions {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  zoom: number
  globeRotX: number
  globeRotY: number
  snapshot: Snapshot
  groundPositions: Array<{
    id: string
    name: string
    role: string
    lat_deg: number
    lon_deg: number
    x: number
    y: number
    z: number
  }>
  groundIds: Set<string>
  activeRoute: string[]
  showIsl: boolean
  showGroundLinks: boolean
  showLabels: boolean
  showUnlaunched: boolean
  selectedClientId: string
  inspectedSatId: string | null
  hoveredNode: HoveredNodeInfo | null
}

export function render3DGlobe(options: Render3DOptions): void {
  const {
    ctx,
    width,
    height,
    zoom,
    globeRotX,
    globeRotY,
    snapshot,
    groundPositions,
    groundIds,
    activeRoute,
    showIsl,
    showGroundLinks,
    showLabels,
    showUnlaunched,
    selectedClientId,
    inspectedSatId,
    hoveredNode,
  } = options

  const cx = width / 2
  const cy = height / 2
  const globeRadius = Math.min(width, height) * 0.42 * zoom
  const badges3D: BadgeLayoutItem[] = []

  // Atmospheric halo
  const halo = ctx.createRadialGradient(cx, cy, globeRadius * 0.95, cx, cy, globeRadius * 1.3)
  halo.addColorStop(0, 'rgba(14, 165, 233, 0.18)')
  halo.addColorStop(0.4, 'rgba(56, 189, 248, 0.06)')
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, globeRadius * 1.3, 0, Math.PI * 2)
  ctx.fill()

  // Earth base ocean
  const oceanGrad = ctx.createRadialGradient(
    cx - globeRadius * 0.35,
    cy - globeRadius * 0.35,
    globeRadius * 0.1,
    cx,
    cy,
    globeRadius
  )
  oceanGrad.addColorStop(0, '#122749')
  oceanGrad.addColorStop(0.7, '#0b162a')
  oceanGrad.addColorStop(1, '#050a14')

  ctx.fillStyle = oceanGrad
  ctx.beginPath()
  ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2)
  ctx.fill()

  // Clip strictly inside Earth sphere for surface landmasses
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2)
  ctx.clip()

  // Draw 3D Landmasses
  ctx.fillStyle = '#1e304a'
  ctx.strokeStyle = '#2e4970'
  ctx.lineWidth = 1

  const cosY = Math.cos(globeRotY)
  const sinY = Math.sin(globeRotY)
  const cosX = Math.cos(globeRotX)
  const sinX = Math.sin(globeRotX)
  const scale = globeRadius / R_EARTH

  for (const land of PRECOMPUTED_LANDMASSES) {
    const pts = land.points
    const n = pts.length
    let allFront = true
    let allBack = true

    const vList: Array<{
      x: number
      y: number
      z: number
      depth: number
      sx: number
      sy: number
    }> = []

    for (let i = 0; i < n; i++) {
      const pt = pts[i]
      const gx = pt.gx
      const gy = pt.gy
      const gz = pt.gz

      const x1 = cosY * gx + sinY * gy
      const y1 = -sinY * gx + cosY * gy
      const x2 = x1
      const y2 = cosX * y1 - sinX * gz
      const z2 = sinX * y1 + cosX * gz

      if (y2 < 0) allFront = false
      if (y2 >= 0) allBack = false

      vList.push({
        x: x2,
        y: y2,
        z: z2,
        depth: y2,
        sx: cx - x2 * scale,
        sy: cy - z2 * scale,
      })
    }

    if (allBack) continue

    if (allFront) {
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        if (i === 0) ctx.moveTo(vList[i].sx, vList[i].sy)
        else ctx.lineTo(vList[i].sx, vList[i].sy)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      continue
    }

    // Polygon crosses the horizon: clip to front hemisphere with rim arc interpolation
    const fillPath: Array<[number, number]> = []

    for (let i = 0; i < n; i++) {
      const curr = vList[i]
      const nxt = vList[(i + 1) % n]
      const currIn = curr.depth >= 0
      const nxtIn = nxt.depth >= 0

      if (currIn && nxtIn) {
        fillPath.push([nxt.sx, nxt.sy])
      } else if (currIn && !nxtIn) {
        // Exiting horizon: find exit point on horizon circle
        const t = curr.depth / (curr.depth - nxt.depth || 1)
        let ix = curr.x + t * (nxt.x - curr.x)
        let iz = curr.z + t * (nxt.z - curr.z)
        const d = Math.hypot(ix, iz)
        if (d > 0) {
          ix = (ix / d) * R_EARTH
          iz = (iz / d) * R_EARTH
        }
        fillPath.push([cx - ix * scale, cy - iz * scale])
      } else if (!currIn && nxtIn) {
        // Entering horizon: find entering point on horizon circle
        const t = curr.depth / (curr.depth - nxt.depth || 1)
        let ix = curr.x + t * (nxt.x - curr.x)
        let iz = curr.z + t * (nxt.z - curr.z)
        const d = Math.hypot(ix, iz)
        if (d > 0) {
          ix = (ix / d) * R_EARTH
          iz = (iz / d) * R_EARTH
        }
        // Add arc along horizon rim from previous exit to this entrance
        if (fillPath.length > 0) {
          const lastPt = fillPath[fillPath.length - 1]
          const ang1 = Math.atan2(lastPt[1] - cy, lastPt[0] - cx)
          const ang2 = Math.atan2(cy - iz * scale - cy, cx - ix * scale - cx)
          let diff = ang2 - ang1
          while (diff > Math.PI) diff -= 2 * Math.PI
          while (diff < -Math.PI) diff += 2 * Math.PI
          const steps = Math.max(4, Math.ceil(Math.abs(diff) / (Math.PI / 12)))
          for (let s = 1; s <= steps; s++) {
            const a = ang1 + (s / steps) * diff
            fillPath.push([cx + Math.cos(a) * globeRadius, cy + Math.sin(a) * globeRadius])
          }
        } else {
          fillPath.push([cx - ix * scale, cy - iz * scale])
        }
        fillPath.push([nxt.sx, nxt.sy])
      }
    }

    // If polygon started in back and ended in back, connect last exit to first entrance along rim
    if (fillPath.length >= 2) {
      const pStart = fillPath[0]
      const pEnd = fillPath[fillPath.length - 1]
      const dStart = Math.hypot(pStart[0] - cx, pStart[1] - cy)
      const dEnd = Math.hypot(pEnd[0] - cx, pEnd[1] - cy)
      if (Math.abs(dStart - globeRadius) < 2 && Math.abs(dEnd - globeRadius) < 2) {
        const ang1 = Math.atan2(pEnd[1] - cy, pEnd[0] - cx)
        const ang2 = Math.atan2(pStart[1] - cy, pStart[0] - cx)
        let diff = ang2 - ang1
        while (diff > Math.PI) diff -= 2 * Math.PI
        while (diff < -Math.PI) diff += 2 * Math.PI
        const steps = Math.max(4, Math.ceil(Math.abs(diff) / (Math.PI / 12)))
        for (let s = 1; s < steps; s++) {
          const a = ang1 + (s / steps) * diff
          fillPath.push([cx + Math.cos(a) * globeRadius, cy + Math.sin(a) * globeRadius])
        }
      }
    }

    // Fill continent cleanly inside horizon
    if (fillPath.length >= 3) {
      ctx.beginPath()
      for (let i = 0; i < fillPath.length; i++) {
        if (i === 0) ctx.moveTo(fillPath[i][0], fillPath[i][1])
        else ctx.lineTo(fillPath[i][0], fillPath[i][1])
      }
      ctx.closePath()
      ctx.fill()
    }

    // Stroke ONLY real front coastlines (not artificial horizon cuts)
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const curr = vList[i]
      const nxt = vList[(i + 1) % n]
      if (curr.depth >= 0 && nxt.depth >= 0) {
        ctx.moveTo(curr.sx, curr.sy)
        ctx.lineTo(nxt.sx, nxt.sy)
      } else if (curr.depth >= 0 && nxt.depth < 0) {
        const t = curr.depth / (curr.depth - nxt.depth || 1)
        let ix = curr.x + t * (nxt.x - curr.x)
        let iz = curr.z + t * (nxt.z - curr.z)
        const d = Math.hypot(ix, iz)
        if (d > 0) {
          ix = (ix / d) * R_EARTH
          iz = (iz / d) * R_EARTH
        }
        ctx.moveTo(curr.sx, curr.sy)
        ctx.lineTo(cx - ix * scale, cy - iz * scale)
      } else if (curr.depth < 0 && nxt.depth >= 0) {
        const t = curr.depth / (curr.depth - nxt.depth || 1)
        let ix = curr.x + t * (nxt.x - curr.x)
        let iz = curr.z + t * (nxt.z - curr.z)
        const d = Math.hypot(ix, iz)
        if (d > 0) {
          ix = (ix / d) * R_EARTH
          iz = (iz / d) * R_EARTH
        }
        ctx.moveTo(cx - ix * scale, cy - iz * scale)
        ctx.lineTo(nxt.sx, nxt.sy)
      }
    }
    ctx.stroke()
  }

  // Latitude rings: Equator & Arctic Circle
  const drawLatCircle = (latDeg: number, strokeColor: string, isDashed = false) => {
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1
    if (isDashed) ctx.setLineDash([3, 4])
    ctx.beginPath()
    let started = false
    for (let lon = -180; lon <= 180; lon += 4) {
      const latRad = (latDeg * Math.PI) / 180
      const lonRad = (lon * Math.PI) / 180
      const gx = R_EARTH * Math.cos(latRad) * Math.cos(lonRad)
      const gy = R_EARTH * Math.cos(latRad) * Math.sin(lonRad)
      const gz = R_EARTH * Math.sin(latRad)
      const p = project3D(gx, gy, gz, 1.0, width, height, globeRotX, globeRotY, zoom)
      if (p.depth > 0) {
        if (!started) {
          ctx.moveTo(p.x, p.y)
          started = true
        } else {
          ctx.lineTo(p.x, p.y)
        }
      } else {
        started = false
      }
    }
    ctx.stroke()
    if (isDashed) ctx.setLineDash([])
  }

  drawLatCircle(0, 'rgba(56, 189, 248, 0.25)')
  drawLatCircle(66.5, 'rgba(56, 189, 248, 0.55)', true)

  ctx.restore() // unclip globe

  // Globe rim highlight
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2)
  ctx.stroke()

  // 3D Projected Satellites & Ground Stations
  const sat3DMap = new Map<string, { x: number; y: number; visible: boolean; depth: number }>()
  for (const s of snapshot.satellites) {
    sat3DMap.set(
      s.id,
      project3D(s.x_km, s.y_km, s.z_km, 1.0, width, height, globeRotX, globeRotY, zoom)
    )
  }

  const ground3DMap = new Map<string, { x: number; y: number; visible: boolean; depth: number }>()
  for (const g of groundPositions) {
    ground3DMap.set(
      g.id,
      project3D(g.x, g.y, g.z, 1.0, width, height, globeRotX, globeRotY, zoom)
    )
  }

  // Draw ISL links in 3D
  if (showIsl) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)'
    for (const [u, v] of snapshot.edges) {
      if (groundIds.has(u) || groundIds.has(v)) continue
      const p1 = sat3DMap.get(u)
      const p2 = sat3DMap.get(v)
      if (!p1 || !p2) continue
      if (!isSegmentVisible3D(p1, p2, globeRadius, cx, cy)) continue

      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
    }
  }

  // Draw Ground-to-Sat links in 3D
  if (showGroundLinks) {
    ctx.lineWidth = 1.2
    ctx.setLineDash([2, 3])
    for (const [u, v] of snapshot.edges) {
      const isGroundU = groundIds.has(u)
      const isGroundV = groundIds.has(v)
      if (!isGroundU && !isGroundV) continue

      const p1 = isGroundU ? ground3DMap.get(u) : sat3DMap.get(u)
      const p2 = isGroundV ? ground3DMap.get(v) : sat3DMap.get(v)
      if (!p1 || !p2) continue

      const groundPt = isGroundU ? p1 : p2
      if (groundPt.depth <= 0) continue
      if (!isSegmentVisible3D(p1, p2, globeRadius, cx, cy)) continue

      const groundId = isGroundU ? u : v
      ctx.strokeStyle =
        groundId === selectedClientId ? 'rgba(250, 204, 21, 0.75)' : 'rgba(148, 163, 184, 0.3)'
      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // Draw ACTIVE ROUTE in 3D
  if (activeRoute.length >= 2) {
    ctx.save()
    ctx.strokeStyle = '#00f0ff'
    ctx.lineWidth = 2.5
    ctx.shadowColor = 'rgba(0, 240, 255, 0.6)'
    ctx.shadowBlur = 4

    for (let k = 0; k < activeRoute.length - 1; k++) {
      const u = activeRoute[k]
      const v = activeRoute[k + 1]
      const p1 = ground3DMap.get(u) || sat3DMap.get(u)
      const p2 = ground3DMap.get(v) || sat3DMap.get(v)
      if (!p1 || !p2) continue
      if (!isSegmentVisible3D(p1, p2, globeRadius, cx, cy)) continue

      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Draw Ground Stations in 3D
  for (const g of groundPositions) {
    const p = ground3DMap.get(g.id)
    if (!p || p.depth <= 0) continue
    const isGateway = g.role === 'gateway'
    const isSelected = g.id === selectedClientId

    ctx.fillStyle = isGateway ? '#38bdf8' : isSelected ? '#00f0ff' : '#94a3b8'
    ctx.beginPath()
    ctx.arc(p.x, p.y, isGateway ? 5.5 : isSelected ? 6 : 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.stroke()

    const labelText = isGateway ? 'G_MUR (шлюз)' : g.id
    const depthOpacity = Math.max(0.2, Math.min(1, p.depth / 140))
    badges3D.push({
      id: g.id,
      text: labelText,
      anchorX: p.x,
      anchorY: p.y,
      priority: isSelected ? 100 : isGateway ? 80 : 50,
      font: isSelected ? 'bold 11px monospace' : '10px monospace',
      textColor: isSelected ? '#00f0ff' : isGateway ? '#7dd3fc' : '#cbd5e1',
      borderColor: isSelected
        ? '#00f0ff'
        : isGateway
        ? 'rgba(56, 189, 248, 0.45)'
        : 'rgba(255, 255, 255, 0.12)',
      bgColor: 'rgba(7, 10, 18, 0.88)',
      borderWidth: 1,
      prefOffsetY: g.id === 'C65' || g.id === 'C72' ? 15 : -15,
      opacity: depthOpacity,
    })
  }

  // Draw Satellites in 3D
  for (const sat of snapshot.satellites) {
    if (!sat.active && !showUnlaunched) continue
    const p = sat3DMap.get(sat.id)
    if (!p || !p.visible) continue

    const pCol = planeColors[sat.plane_id] || defaultPlaneColor
    const isOnRoute = activeRoute.includes(sat.id)

    if (sat.failed) {
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
      ctx.fill()
    } else if (!sat.active) {
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = isOnRoute ? '#00f0ff' : pCol.stroke
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = isOnRoute ? 2 : 1
      ctx.beginPath()
      ctx.arc(p.x, p.y, isOnRoute ? 6 : 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    const isHovered = hoveredNode?.type === 'sat' && hoveredNode.id === sat.id
    const showThisSatLabel = showLabels || isOnRoute || inspectedSatId === sat.id || isHovered

    if (showThisSatLabel && p.visible) {
      const depthOpacity = p.depth > 0 ? Math.max(0.3, Math.min(1, p.depth / 140)) : 0.6
      badges3D.push({
        id: sat.id,
        text: sat.id,
        anchorX: p.x,
        anchorY: p.y,
        priority: isOnRoute ? 90 : isHovered ? 70 : 30,
        font: isOnRoute || isHovered ? 'bold 11px monospace' : '10px monospace',
        textColor: isOnRoute ? '#00f0ff' : isHovered ? '#ffffff' : '#94a3b8',
        borderColor: isOnRoute
          ? '#00f0ff'
          : isHovered
          ? 'rgba(255, 255, 255, 0.4)'
          : 'rgba(255, 255, 255, 0.1)',
        bgColor: 'rgba(7, 10, 18, 0.88)',
        borderWidth: 1,
        prefOffsetY: isOnRoute ? -14 : 11,
        opacity: depthOpacity,
      })
    }
  }

  // Draw collision-free 3D badges
  drawBadgesWithLayout(ctx, badges3D)
}
