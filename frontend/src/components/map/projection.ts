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
  const baseNormX = (lon + 180) / 360
  const baseNormY = (90 - lat) / 180
  const clampedPan = clampPan2D(pan2d, zoom, width, height)
  const x = cx + (baseNormX * width - cx) * zoom + clampedPan.x
  const y = cy + (baseNormY * height - cy) * zoom + clampedPan.y
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
