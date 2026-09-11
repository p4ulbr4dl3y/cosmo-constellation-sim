import { R_EARTH } from '../../lib/orbit'
import type { PlaneColor } from './types'

export const planeColors: Record<string, PlaneColor> = {
  P1: { stroke: '#38bdf8', glow: 'rgba(56, 189, 248, 0.35)', fill: '#0284c7' },
  P2: { stroke: '#a78bfa', glow: 'rgba(167, 139, 250, 0.35)', fill: '#8b5cf6' },
  P3: { stroke: '#fbbf24', glow: 'rgba(251, 191, 36, 0.35)', fill: '#f59e0b' },
}

export const defaultPlaneColor: PlaneColor = {
  stroke: '#94a3b8',
  glow: 'rgba(148, 163, 184, 0.35)',
  fill: '#64748b',
}

export function clampPan2D(
  pan: { x: number; y: number },
  curZoom: number,
  w: number,
  h: number
): { x: number; y: number } {
  if (curZoom <= 1.0) return { x: 0, y: 0 }
  const maxPanX = (w * (curZoom - 1)) / 2
  const maxPanY = (h * (curZoom - 1)) / 2
  return {
    x: Math.max(-maxPanX, Math.min(maxPanX, pan.x)),
    y: Math.max(-maxPanY, Math.min(maxPanY, pan.y)),
  }
}

export function project2D(
  lon: number,
  lat: number,
  width: number,
  height: number,
  zoom: number,
  pan2d: { x: number; y: number }
): [number, number] {
  const cx = width / 2
  const cy = height / 2
  // Preserve true 2:1 equirectangular aspect ratio (360° lon x 180° lat)
  const mapW = Math.min(width, height * 2)
  const mapH = mapW / 2
  const baseNormX = (lon + 180) / 360
  const baseNormY = (90 - lat) / 180
  const clampedPan = clampPan2D(pan2d, zoom, width, height)
  const x = cx + (baseNormX * mapW - mapW / 2) * zoom + clampedPan.x
  const y = cy + (baseNormY * mapH - mapH / 2) * zoom + clampedPan.y
  return [x, y]
}

export function project3D(
  gx: number,
  gy: number,
  gz: number,
  radiusRatio: number,
  width: number,
  height: number,
  rotX: number,
  rotY: number,
  zoom: number
): { x: number; y: number; visible: boolean; distToCenter: number; depth: number } {
  const cx = width / 2
  const cy = height / 2
  const globeRadius = Math.min(width, height) * 0.42 * zoom

  // Rotate around Y axis
  const cosY = Math.cos(rotY)
  const sinY = Math.sin(rotY)
  const x1 = cosY * gx + sinY * gy
  const y1 = -sinY * gx + cosY * gy
  const z1 = gz

  // Rotate around X axis
  const cosX = Math.cos(rotX)
  const sinX = Math.sin(rotX)
  const x2 = x1
  const y2 = cosX * y1 - sinX * z1
  const z2 = sinX * y1 + cosX * z1

  const scale = (globeRadius / R_EARTH) * radiusRatio
  const screenX = cx + x2 * scale
  const screenY = cy - z2 * scale
  const distToCenter = Math.hypot(x2, z2)

  // Object is visible if on front hemisphere (depth > 0) OR if outside Earth silhouette disc
  const visible = y2 > 0 || distToCenter >= R_EARTH

  return { x: screenX, y: screenY, visible, distToCenter, depth: y2 }
}

export function isSegmentVisible3D(
  p1: { x: number; y: number; visible: boolean; depth: number },
  p2: { x: number; y: number; visible: boolean; depth: number },
  globeRadius: number,
  cx: number,
  cy: number
): boolean {
  if (!p1.visible || !p2.visible) return false

  // Both endpoints on front hemisphere -> completely visible in front of Earth
  if (p1.depth >= 0 && p2.depth >= 0) return true

  // Check 2D distance from Earth center (cx, cy) to segment (p1, p2)
  const x1 = p1.x - cx
  const y1 = p1.y - cy
  const x2 = p2.x - cx
  const y2 = p2.y - cy

  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  const R_SQ = globeRadius * globeRadius

  // Case 1: Both endpoints on back hemisphere (depth <= 0)
  if (p1.depth <= 0 && p2.depth <= 0) {
    if (lenSq === 0) return x1 * x1 + y1 * y1 >= R_SQ
    const t = Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / lenSq))
    const cx_pt = x1 + t * dx
    const cy_pt = y1 + t * dy
    return cx_pt * cx_pt + cy_pt * cy_pt >= R_SQ
  }

  // Case 2: One endpoint on front, one on back.
  // The front portion (depth >= 0) is above/in front of Earth.
  // Only the back portion (depth <= 0) can be occluded by the Earth sphere.
  const t0 = p1.depth / (p1.depth - p2.depth)
  const tBackStart = p1.depth <= 0 ? 0 : t0
  const tBackEnd = p1.depth <= 0 ? t0 : 1

  if (lenSq === 0) return x1 * x1 + y1 * y1 >= R_SQ
  const tUnclamped = -(x1 * dx + y1 * dy) / lenSq
  const tClosest = Math.max(tBackStart, Math.min(tBackEnd, tUnclamped))

  const cx_pt = x1 + tClosest * dx
  const cy_pt = y1 + tClosest * dy
  return cx_pt * cx_pt + cy_pt * cy_pt >= R_SQ
}

export function drawLine2DWithAntimeridian(
  ctx: CanvasRenderingContext2D,
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  width: number,
  height: number,
  zoom: number,
  pan2d: { x: number; y: number }
): void {
  const dLon = lon2 - lon1
  if (Math.abs(dLon) > 180) {
    if (lon1 > lon2) {
      const totalSpan = 180 - lon1 + (lon2 + 180)
      const t = (180 - lon1) / (totalSpan || 1)
      const latMid = lat1 + t * (lat2 - lat1)

      const [p1x, p1y] = project2D(lon1, lat1, width, height, zoom, pan2d)
      const [eRx, eRy] = project2D(180, latMid, width, height, zoom, pan2d)
      const [eLx, eLy] = project2D(-180, latMid, width, height, zoom, pan2d)
      const [p2x, p2y] = project2D(lon2, lat2, width, height, zoom, pan2d)

      ctx.beginPath()
      ctx.moveTo(p1x, p1y)
      ctx.lineTo(eRx, eRy)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(eLx, eLy)
      ctx.lineTo(p2x, p2y)
      ctx.stroke()
    } else {
      const totalSpan = lon1 + 180 + (180 - lon2)
      const t = (lon1 + 180) / (totalSpan || 1)
      const latMid = lat1 + t * (lat2 - lat1)

      const [p1x, p1y] = project2D(lon1, lat1, width, height, zoom, pan2d)
      const [eLx, eLy] = project2D(-180, latMid, width, height, zoom, pan2d)
      const [eRx, eRy] = project2D(180, latMid, width, height, zoom, pan2d)
      const [p2x, p2y] = project2D(lon2, lat2, width, height, zoom, pan2d)

      ctx.beginPath()
      ctx.moveTo(p1x, p1y)
      ctx.lineTo(eLx, eLy)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(eRx, eRy)
      ctx.lineTo(p2x, p2y)
      ctx.stroke()
    }
  } else {
    const [p1x, p1y] = project2D(lon1, lat1, width, height, zoom, pan2d)
    const [p2x, p2y] = project2D(lon2, lat2, width, height, zoom, pan2d)
    ctx.beginPath()
    ctx.moveTo(p1x, p1y)
    ctx.lineTo(p2x, p2y)
    ctx.stroke()
  }
}
