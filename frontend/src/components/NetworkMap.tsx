import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import {
  Crosshair,
  ZapOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
} from 'lucide-react'
import type { Scenario, Snapshot } from '../types/scenario'
import { WORLD_LANDMASSES } from '../data/worldCoastline'
import { R_EARTH, getGroundPositions } from '../lib/orbit'

interface NetworkMapProps {
  scenario: Scenario
  snapshot: Snapshot
  selectedClientId: string
  onSelectClient: (clientId: string) => void
  onToggleFailure: (satId: string) => void
}

// Plane color palette
const planeColors: Record<string, { stroke: string; glow: string; fill: string }> = {
  P1: { stroke: '#00e5ff', glow: 'rgba(0, 229, 255, 0.4)', fill: '#00b4d8' },
  P2: { stroke: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', fill: '#a855f7' },
  P3: { stroke: '#34d399', glow: 'rgba(52, 211, 153, 0.4)', fill: '#10b981' },
}
const defaultPlaneColor = { stroke: '#60a5fa', glow: 'rgba(96, 165, 250, 0.4)', fill: '#3b82f6' }

export const NetworkMap: React.FC<NetworkMapProps> = ({
  scenario,
  snapshot,
  selectedClientId,
  onSelectClient,
  onToggleFailure,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Map state
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d')
  const [showIsl, setShowIsl] = useState<boolean>(true)
  const [showGroundLinks, setShowGroundLinks] = useState<boolean>(true)
  const [showLabels, setShowLabels] = useState<boolean>(false)
  const [showUnlaunched, setShowUnlaunched] = useState<boolean>(true)

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1.0)
  const [pan2d, setPan2d] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // 3D globe rotation angles (default: focused on Russian Arctic / Northern Sea Route)
  const [globeRotX, setGlobeRotX] = useState<number>(-1.1)
  const [globeRotY, setGlobeRotY] = useState<number>(-1.05)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Selected or hovered satellite for detail card
  const [inspectedSatId, setInspectedSatId] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<{ id: string; type: 'sat' | 'ground'; x: number; y: number } | null>(null)

  // Precomputed ground positions
  const groundPositions = useMemo(() => getGroundPositions(scenario), [scenario])
  const groundIds = useMemo(() => new Set(groundPositions.map((g) => g.id)), [groundPositions])
  const gatewayIds = useMemo(
    () => new Set(groundPositions.filter((g) => g.role === 'gateway').map((g) => g.id)),
    [groundPositions]
  )

  // Active route for selected client
  const activeRoute = useMemo(() => {
    return snapshot.routes[selectedClientId] || []
  }, [snapshot.routes, selectedClientId])

  // Coordinate lookup maps for antimeridian & link calculations
  const coordMap = useMemo(() => {
    const map = new Map<string, { lon: number; lat: number }>()
    for (const g of groundPositions) {
      map.set(g.id, { lon: g.lon_deg, lat: g.lat_deg })
    }
    for (const s of snapshot.satellites) {
      map.set(s.id, { lon: s.lon_deg, lat: s.lat_deg })
    }
    return map
  }, [groundPositions, snapshot.satellites])

  // Clamp 2D pan so map viewport never exposes empty space outside boundaries
  const clampPan2D = useCallback((pan: { x: number; y: number }, curZoom: number, w: number, h: number) => {
    if (curZoom <= 1.0) return { x: 0, y: 0 }
    const maxPanX = (w * (curZoom - 1)) / 2
    const maxPanY = (h * (curZoom - 1)) / 2
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, pan.x)),
      y: Math.max(-maxPanY, Math.min(maxPanY, pan.y)),
    }
  }, [])

  // 2D Projection helper: maps (lon, lat) to canvas coordinates with zoom and pan
  const project2D = useCallback(
    (lon: number, lat: number, width: number, height: number): [number, number] => {
      const cx = width / 2
      const cy = height / 2
      const baseNormX = (lon + 180) / 360
      const baseNormY = (90 - lat) / 180
      const clampedPan = clampPan2D(pan2d, zoom, width, height)
      const x = cx + (baseNormX * width - cx) * zoom + clampedPan.x
      const y = cy + (baseNormY * height - cy) * zoom + clampedPan.y
      return [x, y]
    },
    [zoom, pan2d, clampPan2D]
  )

  // 3D Orthographic Projection helper with zoom and depth occlusion
  const project3D = useCallback(
    (
      gx: number,
      gy: number,
      gz: number,
      radiusRatio: number,
      width: number,
      height: number,
      rotX: number,
      rotY: number
    ): { x: number; y: number; visible: boolean; distToCenter: number; depth: number } => {
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
      const visible = y2 > 0 || distToCenter >= R_EARTH * 0.98

      return { x: screenX, y: screenY, visible, distToCenter, depth: y2 }
    },
    [zoom]
  )

  // Switch view mode with appropriate zoom limits
  const handleSetViewMode = (mode: '2d' | '3d') => {
    setViewMode(mode)
    if (mode === '2d') {
      setZoom((z) => Math.max(1.0, z))
      setPan2d({ x: 0, y: 0 })
    }
  }

  // Focus view on the Russian Arctic / Northern Sea Route
  const focusArctic = () => {
    setViewMode('3d')
    setGlobeRotX(-1.15)
    setGlobeRotY(-1.05)
    setZoom(1.35)
  }

  // Reset zoom, pan, and angles to default
  const resetView = () => {
    setZoom(1.0)
    setPan2d({ x: 0, y: 0 })
    if (viewMode === '3d') {
      setGlobeRotX(-1.1)
      setGlobeRotY(-1.05)
    }
  }

  const zoomIn = () => {
    const maxZ = viewMode === '2d' ? 4.0 : 3.0
    setZoom((z) => Math.min(maxZ, Number((z + 0.25).toFixed(2))))
  }

  const zoomOut = () => {
    const minZ = viewMode === '2d' ? 1.0 : 0.8
    setZoom((z) => {
      const nextZ = Math.max(minZ, Number((z - 0.25).toFixed(2)))
      if (nextZ <= 1.0 && viewMode === '2d') {
        setPan2d({ x: 0, y: 0 })
      }
      return nextZ
    })
  }

  // Native non-passive wheel listener for smooth zoom
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const minZ = viewMode === '2d' ? 1.0 : 0.8
      const maxZ = viewMode === '2d' ? 4.0 : 3.0
      const factor = e.deltaY < 0 ? 1.12 : 0.89

      setZoom((z) => {
        const next = Math.min(maxZ, Math.max(minZ, Number((z * factor).toFixed(2))))
        if (next <= 1.0 && viewMode === '2d') {
          setPan2d({ x: 0, y: 0 })
        }
        return next
      })
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [viewMode])

  // Handle canvas mouse drag (3D rotation or 2D pan)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
  }

  const handleMouseMove = (
    e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      dragStartRef.current = { x: e.clientX, y: e.clientY }

      if (viewMode === '3d') {
        setGlobeRotY((prev) => prev + dx * 0.008)
        setGlobeRotX((prev) => Math.max(-1.45, Math.min(1.45, prev + dy * 0.008)))
      } else {
        if (zoom > 1.0) {
          const w = canvas.clientWidth
          const h = canvas.clientHeight
          setPan2d((prev) => clampPan2D({ x: prev.x + dx, y: prev.y + dy }, zoom, w, h))
        }
      }
      return
    }

    // Hit test satellites or ground stations
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    let hit: { id: string; type: 'sat' | 'ground'; x: number; y: number } | null = null

    // Check ground stations
    for (const g of groundPositions) {
      let px = 0, py = 0, vis = true
      if (viewMode === '2d') {
        ;[px, py] = project2D(g.lon_deg, g.lat_deg, width, height)
      } else {
        const p = project3D(g.x, g.y, g.z, 1.0, width, height, globeRotX, globeRotY)
        px = p.x
        py = p.y
        vis = p.depth > -50
      }
      if (vis && Math.hypot(mouseX - px, mouseY - py) < 14) {
        hit = { id: g.id, type: 'ground', x: px, y: py }
        break
      }
    }

    // Check satellites
    if (!hit) {
      for (const s of snapshot.satellites) {
        if (!showUnlaunched && !s.active && !s.failed) continue
        let px = 0, py = 0, vis = true
        if (viewMode === '2d') {
          ;[px, py] = project2D(s.lon_deg, s.lat_deg, width, height)
        } else {
          const p = project3D(s.x_km, s.y_km, s.z_km, 1.0, width, height, globeRotX, globeRotY)
          px = p.x
          py = p.y
          vis = p.visible
        }
        if (vis && Math.hypot(mouseX - px, mouseY - py) < 12) {
          hit = { id: s.id, type: 'sat', x: px, y: py }
          break
        }
      }
    }

    setHoveredNode(hit)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
  }

  const handleCanvasClick = () => {
    if (hoveredNode) {
      if (hoveredNode.type === 'sat') {
        setInspectedSatId(hoveredNode.id)
      } else if (hoveredNode.type === 'ground') {
        const site = groundPositions.find((g) => g.id === hoveredNode.id)
        if (site && site.role === 'client') {
          onSelectClient(site.id)
        }
      }
    }
  }

  // Helper for drawing 2D lines with seamless wrap-around across +-180 antimeridian
  const drawLine2DWithAntimeridian = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      lon1: number,
      lat1: number,
      lon2: number,
      lat2: number,
      width: number,
      height: number
    ) => {
      const dLon = lon2 - lon1
      if (Math.abs(dLon) > 180) {
        if (lon1 > lon2) {
          const totalSpan = 180 - lon1 + (lon2 + 180)
          const t = (180 - lon1) / (totalSpan || 1)
          const latMid = lat1 + t * (lat2 - lat1)

          const [p1x, p1y] = project2D(lon1, lat1, width, height)
          const [eRx, eRy] = project2D(180, latMid, width, height)
          const [eLx, eLy] = project2D(-180, latMid, width, height)
          const [p2x, p2y] = project2D(lon2, lat2, width, height)

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

          const [p1x, p1y] = project2D(lon1, lat1, width, height)
          const [eLx, eLy] = project2D(-180, latMid, width, height)
          const [eRx, eRy] = project2D(180, latMid, width, height)
          const [p2x, p2y] = project2D(lon2, lat2, width, height)

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
        const [p1x, p1y] = project2D(lon1, lat1, width, height)
        const [p2x, p2y] = project2D(lon2, lat2, width, height)
        ctx.beginPath()
        ctx.moveTo(p1x, p1y)
        ctx.lineTo(p2x, p2y)
        ctx.stroke()
      }
    },
    [project2D]
  )

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Setup high DPI
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }
    ctx.resetTransform()
    ctx.scale(dpr, dpr)

    // Background cosmic deep space
    ctx.fillStyle = '#07090e'
    ctx.fillRect(0, 0, width, height)

    // Subtle star dust
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % width
      const sy = (i * 293.7) % height
      ctx.fillRect(sx, sy, 1, 1)
    }

    // --- COLLISION-FREE BADGE LAYOUT HELPER ---
    interface BadgeLayoutItem {
      id: string
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

    function drawBadgesWithLayout(targetCtx: CanvasRenderingContext2D, items: BadgeLayoutItem[]) {
      if (items.length === 0) return

      const measured = items.map((item) => {
        targetCtx.font = item.font
        const tw = targetCtx.measureText(item.text).width
        const px = 4
        const py = 1.5
        const w = tw + px * 2
        const h = 13 + py * 2
        return {
          item,
          w,
          h,
          prefY: item.prefOffsetY ?? -15,
        }
      })

      // Sort descending by priority (higher priority gets placed first)
      measured.sort((a, b) => b.item.priority - a.item.priority)

      interface PlacedBox {
        l: number
        r: number
        t: number
        b: number
      }

      const placed: Array<PlacedBox & { lx: number; ly: number; anchorX: number; anchorY: number; item: BadgeLayoutItem }> = []

      const overlaps = (b1: PlacedBox, b2: PlacedBox, pad = 3) => {
        return !(b1.r < b2.l - pad || b1.l > b2.r + pad || b1.b < b2.t - pad || b1.t > b2.b + pad)
      }

      for (const m of measured) {
        const { item, w, h, prefY } = m
        const x = item.anchorX
        const y = item.anchorY

        // Multi-level candidate positions: near, opposite side, stepped offsets, horizontal flanks
        const candidates = [
          { cx: x, cy: y + prefY },
          { cx: x, cy: y - prefY },
          { cx: x, cy: y + prefY * 1.8 },
          { cx: x, cy: y - prefY * 1.8 },
          { cx: x - w * 0.6 - 6, cy: y + prefY * 0.4 },
          { cx: x + w * 0.6 + 6, cy: y + prefY * 0.4 },
          { cx: x - w * 0.7 - 6, cy: y },
          { cx: x + w * 0.7 + 6, cy: y },
          { cx: x, cy: y + prefY * 2.5 },
          { cx: x, cy: y - prefY * 2.5 },
          { cx: x - w * 0.8 - 8, cy: y - prefY * 0.5 },
          { cx: x + w * 0.8 + 8, cy: y - prefY * 0.5 },
        ]

        let best: (PlacedBox & { cx: number; cy: number }) | null = null

        for (const c of candidates) {
          const box: PlacedBox = {
            l: c.cx - w / 2,
            r: c.cx + w / 2,
            t: c.cy - h / 2,
            b: c.cy + h / 2,
          }
          if (!placed.some((p) => overlaps(box, p))) {
            best = { ...box, cx: c.cx, cy: c.cy }
            break
          }
        }

        if (!best) {
          best = {
            cx: x,
            cy: y + prefY,
            l: x - w / 2,
            r: x + w / 2,
            t: y + prefY - h / 2,
            b: y + prefY + h / 2,
          }
        }

        placed.push({
          l: best.l,
          r: best.r,
          t: best.t,
          b: best.b,
          lx: best.cx,
          ly: best.cy,
          anchorX: x,
          anchorY: y,
          item,
        })
      }

      // Draw all badges with collision-free layout
      for (const p of placed) {
        const { item, lx, ly, anchorX, anchorY, l, r, t, b } = p
        const w = r - l
        const h = b - t
        const opacity = item.opacity ?? 1
        if (opacity <= 0.05) continue

        targetCtx.save()
        if (opacity < 1) {
          targetCtx.globalAlpha = opacity
        }

        // Leader line if displaced significantly from anchor
        const dist = Math.hypot(lx - anchorX, ly - anchorY)
        if (dist > 22) {
          targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
          targetCtx.lineWidth = 1
          targetCtx.setLineDash([2, 2])
          targetCtx.beginPath()
          targetCtx.moveTo(anchorX, anchorY)
          const edgeX = Math.max(l, Math.min(r, anchorX))
          const edgeY = Math.max(t, Math.min(b, anchorY))
          targetCtx.lineTo(edgeX, edgeY)
          targetCtx.stroke()
          targetCtx.setLineDash([])
        }

        // Badge pill
        targetCtx.fillStyle = item.bgColor
        targetCtx.strokeStyle = item.borderColor
        targetCtx.lineWidth = item.borderWidth ?? 1
        targetCtx.beginPath()
        targetCtx.roundRect(l, t, w, h, 3.5)
        targetCtx.fill()
        targetCtx.stroke()

        // Badge text
        targetCtx.font = item.font
        targetCtx.fillStyle = item.textColor
        targetCtx.textAlign = 'center'
        targetCtx.textBaseline = 'middle'
        targetCtx.fillText(item.text, lx, ly)

        targetCtx.restore()
      }
    }

    // --- 2D RENDER FUNCTION ---
    function render2DMap(ctx: CanvasRenderingContext2D, width: number, height: number) {
      ctx.save()
      ctx.rect(0, 0, width, height)
      ctx.clip()

      const badges2D: BadgeLayoutItem[] = []

      // In 2D: Ocean fills entire canvas viewport at all times (no ugly black border box)
      ctx.fillStyle = '#0b1322'
      ctx.fillRect(0, 0, width, height)

      // Lat/lon grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.lineWidth = 1
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
      ctx.font = '9px monospace'

      // Longitude lines every 30 deg + labels
      for (let lon = -180; lon <= 180; lon += 30) {
        const [x, yTop] = project2D(lon, 90, width, height)
        const [, yBot] = project2D(lon, -90, width, height)
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
        const [xLeft, y] = project2D(-180, lat, width, height)
        const [xRight] = project2D(180, lat, width, height)
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
      const [eqX1, eqY] = project2D(-180, 0, width, height)
      const [eqX2] = project2D(180, 0, width, height)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(eqX1, eqY)
      ctx.lineTo(eqX2, eqY)
      ctx.stroke()

      // Northern Sea Route / Arctic Operation Zone (65°N - 85°N, 30°E - 180°E)
      const [nsrX1, nsrY2] = project2D(30, 65, width, height)
      const [nsrX2, nsrY1] = project2D(180, 85, width, height)
      ctx.fillStyle = 'rgba(6, 182, 212, 0.05)'
      ctx.fillRect(nsrX1, nsrY1, nsrX2 - nsrX1, nsrY2 - nsrY1)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)'
      ctx.strokeRect(nsrX1, nsrY1, nsrX2 - nsrX1, nsrY2 - nsrY1)

      // Arctic Circle (66.5°N)
      const [arcX1, arcticY] = project2D(-180, 66.56, width, height)
      const [arcX2] = project2D(180, 66.56, width, height)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(arcX1, arcticY)
      ctx.lineTo(arcX2, arcticY)
      ctx.stroke()
      ctx.setLineDash([])

      // Arctic circle label
      ctx.fillStyle = 'rgba(56, 189, 248, 0.9)'
      ctx.font = 'bold 9px monospace'
      ctx.fillText('СЕВЕРНЫЙ ПОЛЯРНЫЙ КРУГ // 66.5°N', Math.max(10, arcX1 + 10), arcticY - 4)

      // Draw Landmasses
      ctx.fillStyle = '#111a2c'
      ctx.strokeStyle = '#1d2d47'
      ctx.lineWidth = 1

      for (const land of WORLD_LANDMASSES) {
        ctx.beginPath()
        for (let i = 0; i < land.points.length; i++) {
          const [lon, lat] = land.points[i]
          const [px, py] = project2D(lon, lat, width, height)
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
        satPosMap.set(s.id, project2D(s.lon_deg, s.lat_deg, width, height))
      }

      const groundPosMap = new Map<string, [number, number]>()
      for (const g of groundPositions) {
        groundPosMap.set(g.id, project2D(g.lon_deg, g.lat_deg, width, height))
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
          drawLine2DWithAntimeridian(ctx, c1.lon, c1.lat, c2.lon, c2.lat, width, height)
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
            drawLine2DWithAntimeridian(ctx, c1.lon, c1.lat, c2.lon, c2.lat, width, height)
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

          drawLine2DWithAntimeridian(ctx, c1.lon, c1.lat, c2.lon, c2.lat, width, height)

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

    // --- 3D ORTHOGRAPHIC GLOBE RENDER FUNCTION ---
    function render3DGlobe(ctx: CanvasRenderingContext2D, width: number, height: number) {
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

      for (const land of WORLD_LANDMASSES) {
        const pts = land.points
        const n = pts.length
        let allFront = true
        let allBack = true

        const vList: Array<{ x: number; y: number; z: number; depth: number; sx: number; sy: number }> = []

        for (let i = 0; i < n; i++) {
          const lon = pts[i][0]
          const lat = pts[i][1]
          const latRad = (lat * Math.PI) / 180
          const lonRad = (lon * Math.PI) / 180
          const gx = R_EARTH * Math.cos(latRad) * Math.cos(lonRad)
          const gy = R_EARTH * Math.cos(latRad) * Math.sin(lonRad)
          const gz = R_EARTH * Math.sin(latRad)

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
            sx: cx + x2 * scale,
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
            fillPath.push([cx + ix * scale, cy - iz * scale])
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
              const ang2 = Math.atan2(cy - iz * scale - cy, cx + ix * scale - cx)
              let diff = ang2 - ang1
              while (diff > Math.PI) diff -= 2 * Math.PI
              while (diff < -Math.PI) diff += 2 * Math.PI
              const steps = Math.max(4, Math.ceil(Math.abs(diff) / (Math.PI / 12)))
              for (let s = 1; s <= steps; s++) {
                const a = ang1 + (s / steps) * diff
                fillPath.push([cx + Math.cos(a) * globeRadius, cy + Math.sin(a) * globeRadius])
              }
            } else {
              fillPath.push([cx + ix * scale, cy - iz * scale])
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
            ctx.lineTo(cx + ix * scale, cy - iz * scale)
          } else if (curr.depth < 0 && nxt.depth >= 0) {
            const t = curr.depth / (curr.depth - nxt.depth || 1)
            let ix = curr.x + t * (nxt.x - curr.x)
            let iz = curr.z + t * (nxt.z - curr.z)
            const d = Math.hypot(ix, iz)
            if (d > 0) {
              ix = (ix / d) * R_EARTH
              iz = (iz / d) * R_EARTH
            }
            ctx.moveTo(cx + ix * scale, cy - iz * scale)
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
          const p = project3D(gx, gy, gz, 1.0, width, height, globeRotX, globeRotY)
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
          project3D(s.x_km, s.y_km, s.z_km, 1.0, width, height, globeRotX, globeRotY)
        )
      }

      const ground3DMap = new Map<string, { x: number; y: number; visible: boolean; depth: number }>()
      for (const g of groundPositions) {
        ground3DMap.set(
          g.id,
          project3D(g.x, g.y, g.z, 1.0, width, height, globeRotX, globeRotY)
        )
      }

      // Draw ISL links in 3D
      if (showIsl) {
        ctx.lineWidth = 1
        for (const [u, v] of snapshot.edges) {
          if (groundIds.has(u) || groundIds.has(v)) continue
          const p1 = sat3DMap.get(u)
          const p2 = sat3DMap.get(v)
          if (!p1 || !p2 || (!p1.visible && !p2.visible)) continue

          const bothFront = p1.depth > 0 && p2.depth > 0
          ctx.strokeStyle = bothFront ? 'rgba(125, 211, 252, 0.35)' : 'rgba(125, 211, 252, 0.08)'
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
          if (!p1 || !p2 || (!p1.visible && !p2.visible)) continue

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
          if (!p1 || !p2 || (!p1.visible && !p2.visible)) continue

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
        if (!p || p.depth < -50) continue
        const isGateway = g.role === 'gateway'
        const isSelected = g.id === selectedClientId

        ctx.fillStyle = isGateway ? '#38bdf8' : isSelected ? '#00f0ff' : '#94a3b8'
        ctx.beginPath()
        ctx.arc(p.x, p.y, isGateway ? 5.5 : isSelected ? 6 : 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()

        const labelText = isGateway ? 'G_MUR · ШЛЮЗ' : g.id
        const depthOpacity = Math.max(0.15, Math.min(1, (p.depth + 40) / 140))
        badges3D.push({
          id: g.id,
          text: labelText,
          anchorX: p.x,
          anchorY: p.y,
          priority: isSelected ? 100 : isGateway ? 80 : 50,
          font: isSelected ? 'bold 9px monospace' : '8px monospace',
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
          const depthOpacity = Math.max(0.15, Math.min(1, (p.depth + 40) / 140))
          badges3D.push({
            id: sat.id,
            text: sat.id,
            anchorX: p.x,
            anchorY: p.y,
            priority: isOnRoute ? 90 : isHovered ? 70 : 30,
            font: isOnRoute || isHovered ? 'bold 9px monospace' : '8px monospace',
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

    if (viewMode === '2d') {
      render2DMap(ctx, width, height)
    } else {
      render3DGlobe(ctx, width, height)
    }
  }, [
    viewMode,
    snapshot,
    scenario,
    selectedClientId,
    showIsl,
    showGroundLinks,
    showLabels,
    showUnlaunched,
    globeRotX,
    globeRotY,
    activeRoute,
    groundPositions,
    groundIds,
    gatewayIds,
    coordMap,
    project2D,
    project3D,
    drawLine2DWithAntimeridian,
    inspectedSatId,
    hoveredNode,
    zoom,
  ])

  // Find detailed data for inspected satellite
  const inspectedSat = inspectedSatId
    ? snapshot.satellites.find((s) => s.id === inspectedSatId)
    : null

  // Count active ISL edges attached to inspected sat
  const inspectedSatDegree = useMemo(() => {
    if (!inspectedSatId) return 0
    return snapshot.edges.filter(([u, v]) => u === inspectedSatId || v === inspectedSatId).length
  }, [inspectedSatId, snapshot.edges])

  const isMinZoom = viewMode === '2d' ? zoom <= 1.0 : zoom <= 0.8
  const isMaxZoom = viewMode === '2d' ? zoom >= 4.0 : zoom >= 3.0

  return (
    <div className="relative w-full h-full flex flex-col bg-[#07090e] select-none overflow-hidden rounded-xl border border-white/10">
      {/* Dedicated Map Header Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-2 bg-[#0c1017] px-2.5 py-1.5 border-b border-white/10 font-mono text-[11px] z-10">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 2D / 3D Mode Switcher */}
          <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => handleSetViewMode('2d')}
              className={`px-2 py-0.5 font-bold rounded-md transition-all cursor-pointer ${
                viewMode === '2d' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2D
            </button>
            <button
              onClick={() => handleSetViewMode('3d')}
              className={`px-2 py-0.5 font-bold rounded-md transition-all cursor-pointer ${
                viewMode === '3d' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3D
            </button>
          </div>

          <div className="h-3 w-px bg-white/10 mx-0.5" />

          {/* Arctic Focus */}
          <button
            onClick={focusArctic}
            title="Сфокусировать 3D-глобус на Арктике"
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>Арктика</span>
          </button>

          <div className="h-3 w-px bg-white/10 mx-0.5" />

          {/* Zoom Controls */}
          <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 gap-0.5">
            <button
              onClick={zoomOut}
              disabled={isMinZoom}
              title="Отдалить карту"
              className={`p-1 rounded transition-colors ${
                isMinZoom
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="px-1 text-[10px] text-slate-300 min-w-[32px] text-center font-medium">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={isMaxZoom}
              title="Приблизить карту"
              className={`p-1 rounded transition-colors ${
                isMaxZoom
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
              }`}
            >
              <ZoomIn className="w-3 h-3" />
            </button>
            <button
              onClick={resetView}
              title="Сбросить масштаб и положение (100%)"
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <div className="h-3 w-px bg-white/10 mx-0.5" />

          {/* Layer Toggles */}
          <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 gap-0.5">
            <button
              onClick={() => setShowIsl((v) => !v)}
              title="Межспутниковые линии (ISL)"
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                showIsl ? 'bg-white/20 text-white font-medium' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ISL
            </button>

            <button
              onClick={() => setShowGroundLinks((v) => !v)}
              title="Линии Земля-Спутник (GSL)"
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                showGroundLinks
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              GSL
            </button>

            <button
              onClick={() => setShowLabels((v) => !v)}
              title="Номера спутников (ID)"
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                showLabels
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ID
            </button>

            <button
              onClick={() => setShowUnlaunched((v) => !v)}
              title="Спутники последующих этапов"
              className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                showUnlaunched
                  ? 'bg-white/20 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Резерв
            </button>
          </div>
        </div>

        {/* Orbit Plane Legend in Header */}
        <div className="hidden sm:flex items-center gap-2 bg-black/40 px-2 py-1 rounded-md border border-white/10 font-mono text-[10px]">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00e5ff]" />
            <span className="text-slate-400">P1</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#c084fc]" />
            <span className="text-slate-400">P2</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            <span className="text-slate-400">P3</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span className="text-slate-400">ОТКАЗ</span>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseLeave={() => setIsDragging(false)}
          onClick={handleCanvasClick}
          className={`w-full h-full block ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        />

      {/* Floating HUD Card for Inspected Satellite */}
      {inspectedSat && (
        <div className="absolute bottom-3 left-3 z-20 bg-[#0c1017]/95 backdrop-blur p-3 rounded-lg border border-white/10 max-w-xs text-xs font-mono shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  inspectedSat.failed
                    ? 'bg-rose-500'
                    : inspectedSat.active
                    ? 'bg-emerald-400'
                    : 'bg-slate-500'
                }`}
              />
              <span className="font-bold text-xs tracking-wider text-white">
                КА {inspectedSat.id}
              </span>
              <span className="text-[10px] bg-black/40 text-slate-400 border border-white/10 px-1.5 py-0.5 rounded">
                {inspectedSat.plane_id}
              </span>
            </div>
            <button
              onClick={() => setInspectedSatId(null)}
              className="text-slate-500 hover:text-white text-sm leading-none px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1 text-[10px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">СТАТУС:</span>
              <span
                className={
                  inspectedSat.failed
                    ? 'text-rose-400 font-bold'
                    : inspectedSat.active
                    ? 'text-emerald-400 font-semibold'
                    : 'text-slate-400'
                }
              >
                {inspectedSat.failed
                  ? 'ОТКАЗ'
                  : inspectedSat.active
                  ? 'В РАБОТЕ'
                  : 'РЕЗЕРВ'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ОЧЕРЕДЬ:</span>
              <span>ПАРТИЯ #{inspectedSat.launch_batch}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ШИР / ДОЛГ:</span>
              <span>
                {Math.abs(inspectedSat.lat_deg).toFixed(1)}°{inspectedSat.lat_deg >= 0 ? ' с.ш.' : ' ю.ш.'},{' '}
                {Math.abs(inspectedSat.lon_deg).toFixed(1)}°{inspectedSat.lon_deg >= 0 ? ' в.д.' : ' з.д.'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">СВЯЗИ (ISL):</span>
              <span className="text-cyan-400 font-bold">{inspectedSatDegree} линков</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ECEF (X, Y, Z):</span>
              <span className="text-[9px] text-slate-400">
                [{Math.round(inspectedSat.x_km)}, {Math.round(inspectedSat.y_km)}, {Math.round(inspectedSat.z_km)}] км
              </span>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-2 pt-2 border-t border-white/10">
            <button
              onClick={() => onToggleFailure(inspectedSat.id)}
              className={`w-full h-7 px-2 rounded-md text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                inspectedSat.failed
                  ? 'bg-emerald-600/30 hover:bg-emerald-600/50 border-emerald-500/40 text-emerald-200'
                  : 'bg-white/5 hover:bg-rose-950/40 border-white/10 hover:border-rose-800/50 text-slate-300 hover:text-rose-300'
              }`}
            >
              {inspectedSat.failed ? (
                <>
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Восстановить связь</span>
                </>
              ) : (
                <>
                  <ZapOff className="w-3.5 h-3.5" />
                  <span>Имитировать отказ КА</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
