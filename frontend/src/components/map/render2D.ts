import { WORLD_LANDMASSES } from '../../data/worldCoastline'
import type { Snapshot } from '../../types/scenario'
import { drawBadgesWithLayout } from './badges'
import {
  defaultPlaneColor,
  drawLine2DWithAntimeridian,
  planeColors,
  project2D,
} from './projection'
import type { BadgeLayoutItem, HoveredNodeInfo } from './types'

export interface Render2DOptions {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  zoom: number
  pan2d: { x: number; y: number }
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
  gatewayIds: Set<string>
  activeRoute: string[]
  coordMap: Map<string, { lon: number; lat: number }>
  showIsl: boolean
  showGroundLinks: boolean
  showLabels: boolean
  showUnlaunched: boolean
  selectedClientId: string
  inspectedSatId: string | null
  hoveredNode: HoveredNodeInfo | null
}

export function render2DMap(options: Render2DOptions): void {
  const {
    ctx,
    width,
    height,
    zoom,
    pan2d,
    snapshot,
    groundPositions,
    groundIds,
    gatewayIds,
    activeRoute,
    coordMap,
    showIsl,
    showGroundLinks,
    showLabels,
    showUnlaunched,
    selectedClientId,
    inspectedSatId,
    hoveredNode,
  } = options

  ctx.save()
  ctx.rect(0, 0, width, height)
  ctx.clip()

  const badges2D: BadgeLayoutItem[] = []

  // Ocean background fills viewport
  ctx.fillStyle = '#0b1322'
  ctx.fillRect(0, 0, width, height)

  // Lat/lon grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
  ctx.font = '9px monospace'

  // Longitude lines every 30 deg + labels
  for (let lon = -180; lon <= 180; lon += 30) {
    const [x, yTop] = project2D(lon, 90, width, height, zoom, pan2d)
    const [, yBot] = project2D(lon, -90, width, height, zoom, pan2d)
    ctx.beginPath()
    ctx.moveTo(x, yTop)
    ctx.lineTo(x, yBot)
    ctx.stroke()
    if (lon !== -180 && lon !== 180 && yBot >= 0 && yBot <= height + 20) {
      ctx.fillText(`${lon}°`, x + 3, Math.min(height - 6, yBot - 4))
    }
  }

  // Latitude lines every 30 deg + labels
  for (let lat = -60; lat <= 80; lat += 30) {
    const [xLeft, y] = project2D(-180, lat, width, height, zoom, pan2d)
    const [xRight] = project2D(180, lat, width, height, zoom, pan2d)
    ctx.beginPath()
    ctx.moveTo(xLeft, y)
    ctx.lineTo(xRight, y)
    ctx.stroke()
    const latLabel = lat > 0 ? `${lat}°N` : lat < 0 ? `${Math.abs(lat)}°S` : '0°'
    if (y >= 10 && y <= height - 5) {
      ctx.fillText(latLabel, Math.max(8, xLeft + 6), y - 3)
    }
  }

  // Equator line
  const [eqX1, eqY] = project2D(-180, 0, width, height, zoom, pan2d)
  const [eqX2] = project2D(180, 0, width, height, zoom, pan2d)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(eqX1, eqY)
  ctx.lineTo(eqX2, eqY)
  ctx.stroke()

  // Northern Sea Route / Arctic Operation Zone (65°N - 85°N, 30°E - 180°E)
  const [nsrX1, nsrY2] = project2D(30, 65, width, height, zoom, pan2d)
  const [nsrX2, nsrY1] = project2D(180, 85, width, height, zoom, pan2d)
  ctx.fillStyle = 'rgba(6, 182, 212, 0.05)'
  ctx.fillRect(nsrX1, nsrY1, nsrX2 - nsrX1, nsrY2 - nsrY1)
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)'
  ctx.strokeRect(nsrX1, nsrY1, nsrX2 - nsrX1, nsrY2 - nsrY1)

  // Arctic Circle (66.5°N)
  const [arcX1, arcticY] = project2D(-180, 66.56, width, height, zoom, pan2d)
  const [arcX2] = project2D(180, 66.56, width, height, zoom, pan2d)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(arcX1, arcticY)
  ctx.lineTo(arcX2, arcticY)
  ctx.stroke()
  ctx.setLineDash([])

  // Arctic circle label
  const arcticLabel = 'СЕВЕРНЫЙ ПОЛЯРНЫЙ КРУГ // 66.5°N'
  ctx.font = 'bold 8.5px monospace'
  const arcLabelX = Math.max(28, arcX1 + 36)
  const arcLabelY = arcticY - 4
  const arcLabelW = ctx.measureText(arcticLabel).width
  ctx.fillStyle = 'rgba(7, 12, 22, 0.75)'
  ctx.fillRect(arcLabelX - 4, arcLabelY - 8, arcLabelW + 8, 11)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'
  ctx.strokeRect(arcLabelX - 4, arcLabelY - 8, arcLabelW + 8, 11)
  ctx.fillStyle = 'rgba(56, 189, 248, 0.85)'
  ctx.fillText(arcticLabel, arcLabelX, arcLabelY)

  // Draw Landmasses
  ctx.fillStyle = '#111a2c'
  ctx.strokeStyle = '#1d2d47'
  ctx.lineWidth = 1

  for (const land of WORLD_LANDMASSES) {
    ctx.beginPath()
    for (let i = 0; i < land.points.length; i++) {
      const [lon, lat] = land.points[i]
      const [px, py] = project2D(lon, lat, width, height, zoom, pan2d)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // Precalculate positions
  const satPosMap = new Map<string, [number, number]>()
  for (const s of snapshot.satellites) {
    satPosMap.set(s.id, project2D(s.lon_deg, s.lat_deg, width, height, zoom, pan2d))
  }

  const groundPosMap = new Map<string, [number, number]>()
  for (const g of groundPositions) {
    groundPosMap.set(g.id, project2D(g.lon_deg, g.lat_deg, width, height, zoom, pan2d))
  }

  // Draw ISL links with seamless antimeridian split
  if (showIsl) {
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)'
    for (const [u, v] of snapshot.edges) {
      if (groundIds.has(u) || groundIds.has(v)) continue
      const c1 = coordMap.get(u)
      const c2 = coordMap.get(v)
      if (!c1 || !c2) continue
      drawLine2DWithAntimeridian(ctx, c1.lon, c1.lat, c2.lon, c2.lat, width, height, zoom, pan2d)
    }
  }

  // Draw Ground-to-Satellite links
  if (showGroundLinks) {
    ctx.lineWidth = 1.2
    ctx.setLineDash([2, 3])
    for (const [u, v] of snapshot.edges) {
      const isGroundU = groundIds.has(u)
      const isGroundV = groundIds.has(v)
      if (!isGroundU && !isGroundV) continue

      const groundId = isGroundU ? u : v
      const isGateway = gatewayIds.has(groundId)
      const isSelectedClient = groundId === selectedClientId

      if (isSelectedClient) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)'
      } else if (isGateway) {
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)'
      } else {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
      }

      const c1 = coordMap.get(u)
      const c2 = coordMap.get(v)
      if (c1 && c2) {
        drawLine2DWithAntimeridian(ctx, c1.lon, c1.lat, c2.lon, c2.lat, width, height, zoom, pan2d)
      }
    }
    ctx.setLineDash([])
  }

  // Draw ACTIVE ROUTE
  if (activeRoute.length >= 2) {
    ctx.save()
    ctx.strokeStyle = '#00f0ff'
    ctx.lineWidth = 2.5
    ctx.shadowColor = 'rgba(0, 240, 255, 0.5)'
    ctx.shadowBlur = 4

    for (let k = 0; k < activeRoute.length - 1; k++) {
      const u = activeRoute[k]
      const v = activeRoute[k + 1]
      const c1 = coordMap.get(u)
      const c2 = coordMap.get(v)
      if (!c1 || !c2) continue

      drawLine2DWithAntimeridian(ctx, c1.lon, c1.lat, c2.lon, c2.lat, width, height, zoom, pan2d)

      // Hop badge
      const p1 = groundPosMap.get(u) || satPosMap.get(u)
      const p2 = groundPosMap.get(v) || satPosMap.get(v)
      if (p1 && p2 && Math.abs(c1.lon - c2.lon) <= 180) {
        const midX = (p1[0] + p2[0]) / 2
        const midY = (p1[1] + p2[1]) / 2
        ctx.shadowBlur = 0
        ctx.fillStyle = '#062d3e'
        ctx.strokeStyle = '#00f0ff'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(midX, midY, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#ecfdf5'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${k + 1}`, midX, midY)
      }
    }
    ctx.restore()
  }

  // Draw Ground Stations
  for (const g of groundPositions) {
    const pos = groundPosMap.get(g.id)
    if (!pos) continue
    const [gx, gy] = pos
    const isGateway = g.role === 'gateway'
    const isSelected = g.id === selectedClientId

    // Radar coverage footprint circle clamped in screen pixels
    const footprintRadius = Math.max(22, Math.min(65, width * 0.04 * zoom))
    ctx.fillStyle = isGateway
      ? 'rgba(59, 130, 246, 0.08)'
      : isSelected
      ? 'rgba(234, 179, 8, 0.12)'
      : 'rgba(148, 163, 184, 0.06)'
    ctx.strokeStyle = isGateway
      ? 'rgba(59, 130, 246, 0.3)'
      : isSelected
      ? 'rgba(234, 179, 8, 0.45)'
      : 'rgba(148, 163, 184, 0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(gx, gy, footprintRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    if (isGateway) {
      // Gateway diamond
      ctx.fillStyle = '#38bdf8'
      ctx.strokeStyle = '#0284c7'
      ctx.lineWidth = 2
      ctx.save()
      ctx.translate(gx, gy)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-6, -6, 12, 12)
      ctx.strokeRect(-6, -6, 12, 12)
      ctx.restore()
    } else {
      // Client station
      ctx.fillStyle = isSelected ? '#00f0ff' : '#38bdf8'
      ctx.strokeStyle = isSelected ? '#ffffff' : '#0284c7'
      ctx.lineWidth = isSelected ? 2 : 1.5
      ctx.beginPath()
      ctx.arc(gx, gy, isSelected ? 6.5 : 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    const labelText = isGateway ? 'G_MUR · ШЛЮЗ' : g.id
    badges2D.push({
      id: g.id,
      text: labelText,
      anchorX: gx,
      anchorY: gy,
      priority: isSelected ? 100 : isGateway ? 80 : 50,
      font: isSelected ? 'bold 10px monospace' : '9px monospace',
      textColor: isSelected ? '#00f0ff' : isGateway ? '#7dd3fc' : '#e2e8f0',
      borderColor: isSelected
        ? '#00f0ff'
        : isGateway
        ? 'rgba(56, 189, 248, 0.45)'
        : 'rgba(255, 255, 255, 0.12)',
      bgColor: 'rgba(7, 10, 18, 0.88)',
      borderWidth: isSelected ? 1.5 : 1,
      prefOffsetY: g.id === 'C65' || g.id === 'C72' ? 16 : -16,
    })
  }

  // Draw Satellites
  for (const sat of snapshot.satellites) {
    if (!showUnlaunched && !sat.active && !sat.failed) continue
    const pos = satPosMap.get(sat.id)
    if (!pos) continue
    const [sx, sy] = pos

    const pCol = planeColors[sat.plane_id] || defaultPlaneColor
    const isOnRoute = activeRoute.includes(sat.id)
    const isInspected = inspectedSatId === sat.id

    if (sat.failed) {
      ctx.fillStyle = '#ef4444'
      ctx.strokeStyle = '#fca5a5'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(sx, sy, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('!', sx, sy)
    } else if (!sat.active) {
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 1.5
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.arc(sx, sy, 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    } else {
      if (isOnRoute) {
        ctx.save()
        ctx.fillStyle = '#34d399'
        ctx.strokeStyle = '#ecfdf5'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(sx, sy, 5.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      } else {
        ctx.fillStyle = pCol.stroke
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(sx, sy, isInspected ? 6 : 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }

    const isHovered = hoveredNode?.type === 'sat' && hoveredNode.id === sat.id
    const showThisSatLabel = showLabels || isOnRoute || isInspected || isHovered

    if (showThisSatLabel) {
      badges2D.push({
        id: sat.id,
        text: sat.id,
        anchorX: sx,
        anchorY: sy,
        priority: isOnRoute ? 90 : isInspected || isHovered ? 70 : 30,
        font: isOnRoute || isInspected || isHovered ? 'bold 9px monospace' : '8px monospace',
        textColor: isOnRoute
          ? '#00f0ff'
          : isHovered || isInspected
          ? '#ffffff'
          : sat.failed
          ? '#f87171'
          : !sat.active
          ? '#94a3b8'
          : '#e2e8f0',
        borderColor: isOnRoute
          ? '#00f0ff'
          : isHovered
          ? 'rgba(255, 255, 255, 0.4)'
          : sat.failed
          ? '#ef4444'
          : 'rgba(255, 255, 255, 0.1)',
        bgColor: 'rgba(7, 10, 18, 0.9)',
        borderWidth: 1,
        prefOffsetY: isOnRoute ? -14 : 12,
      })
    }
  }

  // Draw collision-free 2D badges
  drawBadgesWithLayout(ctx, badges2D)

  ctx.restore()
}
