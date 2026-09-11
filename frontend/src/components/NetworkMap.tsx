import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import {
  Layers,
  Globe2,
  Map as MapIcon,
  Crosshair,
  Wifi,
  Eye,
  ZapOff,
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
  const [showLabels, setShowLabels] = useState<boolean>(true)
  const [showUnlaunched, setShowUnlaunched] = useState<boolean>(true)

  // 3D globe rotation angles
  const [globeRotX, setGlobeRotX] = useState<number>(1.2) // look down from high latitude
  const [globeRotY, setGlobeRotY] = useState<number>(-1.5)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Selected or hovered satellite for detail card
  const [inspectedSatId, setInspectedSatId] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<{ id: string; type: 'sat' | 'ground'; x: number; y: number } | null>(null)

  // Precomputed ground positions
  const groundPositions = useMemo(() => getGroundPositions(scenario), [scenario])

  // Active route for selected client
  const activeRoute = useMemo(() => {
    return snapshot.routes[selectedClientId] || []
  }, [snapshot.routes, selectedClientId])

  // Plane color palette
  const planeColors: Record<string, { stroke: string; glow: string; fill: string }> = {
    P1: { stroke: '#00e5ff', glow: 'rgba(0, 229, 255, 0.4)', fill: '#00b4d8' },
    P2: { stroke: '#c084fc', glow: 'rgba(192, 132, 252, 0.4)', fill: '#a855f7' },
    P3: { stroke: '#34d399', glow: 'rgba(52, 211, 153, 0.4)', fill: '#10b981' },
  }
  const defaultPlaneColor = { stroke: '#60a5fa', glow: 'rgba(96, 165, 250, 0.4)', fill: '#3b82f6' }

  // 2D Projection helper: maps (lon, lat) to canvas coordinates
  const project2D = useCallback((lon: number, lat: number, width: number, height: number): [number, number] => {
    // Normal equirectangular projection
    const x = ((lon + 180) / 360) * width
    const y = ((90 - lat) / 180) * height
    return [x, y]
  }, [])

  // 3D Orthographic Projection helper: maps (x, y, z) ECEF to 2D screen coordinates on globe
  const project3D = useCallback((
    gx: number,
    gy: number,
    gz: number,
    radiusRatio: number,
    width: number,
    height: number,
    rotX: number,
    rotY: number
  ): { x: number; y: number; visible: boolean } => {
    const cx = width / 2
    const cy = height / 2
    const globeRadius = Math.min(width, height) * 0.42

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
    const visible = y2 > -100 // on front hemisphere

    return { x: screenX, y: screenY, visible }
  }, [])

  // Focus view on the Russian Arctic / Northern Sea Route
  const focusArctic = () => {
    if (viewMode === '3d') {
      setGlobeRotX(1.3)
      setGlobeRotY(-1.4)
    }
  }

  // Handle canvas mouse drag for 3D rotation
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (viewMode !== '3d') return
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    if (isDragging && viewMode === '3d') {
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      setGlobeRotY((prev) => prev + dx * 0.008)
      setGlobeRotX((prev) => Math.max(0.1, Math.min(Math.PI - 0.1, prev + dy * 0.008)))
      dragStartRef.current = { x: e.clientX, y: e.clientY }
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
        vis = p.visible
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
          const p = project3D(s.x_km, s.y_km, s.z_km, (R_EARTH + scenario.environment.altitude_km) / R_EARTH, width, height, globeRotX, globeRotY)
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

  const handleMouseUp = () => {
    setIsDragging(false)
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
    ctx.fillStyle = '#070a12'
    ctx.fillRect(0, 0, width, height)

    // Draw subtle star dust
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137.5) % width)
      const sy = ((i * 293.7) % height)
      ctx.fillRect(sx, sy, 1, 1)
    }

    if (viewMode === '2d') {
      // Draw 2D Equirectangular Earth map
      render2DMap(ctx, width, height)
    } else {
      // Draw 3D Orthographic Globe
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
    project2D,
    project3D,
  ])

  // --- 2D RENDER FUNCTION ---
  const render2DMap = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Ocean background
    ctx.fillStyle = '#0b1322'
    ctx.fillRect(0, 0, width, height)

    // Draw lat/lon grid lines
    ctx.strokeStyle = '#162238'
    ctx.lineWidth = 1

    // Longitude lines every 30 deg
    for (let lon = -180; lon <= 180; lon += 30) {
      const [x] = project2D(lon, 0, width, height)
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }

    // Latitude lines every 30 deg
    for (let lat = -60; lat <= 80; lat += 30) {
      const [, y] = project2D(0, lat, width, height)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Equator line
    const [, eqY] = project2D(0, 0, width, height)
    ctx.strokeStyle = '#1e3252'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, eqY)
    ctx.lineTo(width, eqY)
    ctx.stroke()

    // Arctic Circle (66.5°N) - crucial region for case study
    const [, arcticY] = project2D(0, 66.56, width, height)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, arcticY)
    ctx.lineTo(width, arcticY)
    ctx.stroke()
    ctx.setLineDash([])

    // Arctic circle label
    ctx.fillStyle = 'rgba(56, 189, 248, 0.7)'
    ctx.font = '9px monospace'
    ctx.fillText('СЕВЕРНЫЙ ПОЛЯРНЫЙ КРУГ 66.5°N', 10, arcticY - 4)

    // Draw Landmasses
    ctx.fillStyle = '#141e30'
    ctx.strokeStyle = '#223652'
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

    // Satellite positions map for quick coordinate lookup
    const satPosMap = new Map<string, [number, number]>()
    for (const s of snapshot.satellites) {
      satPosMap.set(s.id, project2D(s.lon_deg, s.lat_deg, width, height))
    }

    // Ground positions map
    const groundPosMap = new Map<string, [number, number]>()
    for (const g of groundPositions) {
      groundPosMap.set(g.id, project2D(g.lon_deg, g.lat_deg, width, height))
    }

    // Draw ISL links
    if (showIsl) {
      ctx.lineWidth = 1
      for (const [u, v] of snapshot.edges) {
        // Skip ground edges here
        if (u.startsWith('C') || u.startsWith('G') || v.startsWith('C') || v.startsWith('G')) continue

        const p1 = satPosMap.get(u)
        const p2 = satPosMap.get(v)
        if (!p1 || !p2) continue

        // Check if edge crosses date line (-180 / +180)
        if (Math.abs(p1[0] - p2[0]) > width * 0.5) continue

        ctx.strokeStyle = 'rgba(125, 211, 252, 0.18)'
        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.stroke()
      }
    }

    // Draw Ground-to-Satellite links
    if (showGroundLinks) {
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      for (const [u, v] of snapshot.edges) {
        const isGroundU = u.startsWith('C') || u.startsWith('G')
        const isGroundV = v.startsWith('C') || v.startsWith('G')
        if (!isGroundU && !isGroundV) continue

        const p1 = isGroundU ? groundPosMap.get(u) : satPosMap.get(u)
        const p2 = isGroundV ? groundPosMap.get(v) : satPosMap.get(v)
        if (!p1 || !p2) continue

        if (Math.abs(p1[0] - p2[0]) > width * 0.5) continue

        const groundId = isGroundU ? u : v
        const isGateway = groundId === 'G_MUR'
        const isSelectedClient = groundId === selectedClientId

        if (isSelectedClient) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)'
        } else if (isGateway) {
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)'
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)'
        }

        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.stroke()
      }
      ctx.setLineDash([])
    }

    // Draw ACTIVE ROUTE with glowing neon green beam
    if (activeRoute.length >= 2) {
      ctx.save()
      ctx.shadowColor = '#10b981'
      ctx.shadowBlur = 12
      ctx.strokeStyle = '#34d399'
      ctx.lineWidth = 3

      for (let k = 0; k < activeRoute.length - 1; k++) {
        const u = activeRoute[k]
        const v = activeRoute[k + 1]
        const p1 = groundPosMap.get(u) || satPosMap.get(u)
        const p2 = groundPosMap.get(v) || satPosMap.get(v)
        if (!p1 || !p2) continue

        if (Math.abs(p1[0] - p2[0]) > width * 0.5) continue

        ctx.beginPath()
        ctx.moveTo(p1[0], p1[1])
        ctx.lineTo(p2[0], p2[1])
        ctx.stroke()

        // Hop badge
        const midX = (p1[0] + p2[0]) / 2
        const midY = (p1[1] + p2[1]) / 2
        ctx.fillStyle = '#065f46'
        ctx.strokeStyle = '#34d399'
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
      ctx.restore()
    }

    // Draw Ground Stations
    for (const g of groundPositions) {
      const pos = groundPosMap.get(g.id)
      if (!pos) continue
      const [gx, gy] = pos
      const isGateway = g.role === 'gateway'
      const isSelected = g.id === selectedClientId

      // Radar coverage footprint circle (approx 10° elevation horizon)
      const footprintRadius = width * 0.05
      ctx.fillStyle = isGateway
        ? 'rgba(59, 130, 246, 0.08)'
        : isSelected
        ? 'rgba(234, 179, 8, 0.12)'
        : 'rgba(148, 163, 184, 0.06)'
      ctx.strokeStyle = isGateway
        ? 'rgba(59, 130, 246, 0.3)'
        : isSelected
        ? 'rgba(234, 179, 8, 0.4)'
        : 'rgba(148, 163, 184, 0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(gx, gy, footprintRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      if (isGateway) {
        // Gateway: Murmansk diamond
        ctx.fillStyle = '#38bdf8'
        ctx.strokeStyle = '#0284c7'
        ctx.lineWidth = 2
        ctx.save()
        ctx.translate(gx, gy)
        ctx.rotate(Math.PI / 4)
        ctx.fillRect(-6, -6, 12, 12)
        ctx.strokeRect(-6, -6, 12, 12)
        ctx.restore()

        // Label
        ctx.fillStyle = '#e0f2fe'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(`⯌ ${g.id} (Шлюз Мурманск)`, gx + 10, gy)
      } else {
        // Client station
        ctx.fillStyle = isSelected ? '#eab308' : '#38bdf8'
        ctx.strokeStyle = isSelected ? '#fef08a' : '#0284c7'
        ctx.lineWidth = isSelected ? 2 : 1.5
        ctx.beginPath()
        ctx.arc(gx, gy, isSelected ? 7 : 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Label
        ctx.fillStyle = isSelected ? '#fef08a' : '#cbd5e1'
        ctx.font = isSelected ? 'bold 11px monospace' : '10px monospace'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(`● ${g.id}`, gx + 9, gy)
      }
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
        // Failed satellite: glowing red
        ctx.fillStyle = '#ef4444'
        ctx.strokeStyle = '#fca5a5'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(sx, sy, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        // Exclamation mark
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 8px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('!', sx, sy)
      } else if (!sat.active) {
        // Unlaunched satellite
        ctx.strokeStyle = '#64748b'
        ctx.lineWidth = 1.5
        ctx.setLineDash([2, 2])
        ctx.beginPath()
        ctx.arc(sx, sy, 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        // Active satellite
        if (isOnRoute) {
          // Highlight satellite on active path
          ctx.save()
          ctx.shadowColor = '#10b981'
          ctx.shadowBlur = 10
          ctx.fillStyle = '#34d399'
          ctx.strokeStyle = '#ecfdf5'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(sx, sy, 6, 0, Math.PI * 2)
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

      // Satellite ID Label
      if (showLabels || isOnRoute || isInspected) {
        ctx.fillStyle = isOnRoute
          ? '#6ee7b7'
          : sat.failed
          ? '#f87171'
          : !sat.active
          ? '#94a3b8'
          : '#e2e8f0'
        ctx.font = isOnRoute || isInspected ? 'bold 9px monospace' : '8px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(sat.id, sx, sy + 6)
      }
    }
  }

  // --- 3D ORTHOGRAPHIC GLOBE RENDER FUNCTION ---
  const render3DGlobe = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const cx = width / 2
    const cy = height / 2
    const globeRadius = Math.min(width, height) * 0.42

    // Space backdrop with faint atmospheric halo
    const halo = ctx.createRadialGradient(cx, cy, globeRadius * 0.9, cx, cy, globeRadius * 1.25)
    halo.addColorStop(0, 'rgba(14, 165, 233, 0.15)')
    halo.addColorStop(0.5, 'rgba(56, 189, 248, 0.05)')
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(cx, cy, globeRadius * 1.3, 0, Math.PI * 2)
    ctx.fill()

    // Earth sphere base (Deep Ocean)
    const oceanGrad = ctx.createRadialGradient(
      cx - globeRadius * 0.3,
      cy - globeRadius * 0.3,
      globeRadius * 0.1,
      cx,
      cy,
      globeRadius
    )
    oceanGrad.addColorStop(0, '#10213d')
    oceanGrad.addColorStop(0.7, '#0b162a')
    oceanGrad.addColorStop(1, '#060d1b')

    ctx.fillStyle = oceanGrad
    ctx.beginPath()
    ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2)
    ctx.fill()

    // Globe clip to keep landmasses strictly on sphere
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2)
    ctx.clip()

    // Draw 3D Landmasses
    ctx.fillStyle = '#1e2f47'
    ctx.strokeStyle = '#2d4366'
    ctx.lineWidth = 1

    for (const land of WORLD_LANDMASSES) {
      ctx.beginPath()
      let first = true
      for (const [lon, lat] of land.points) {
        const latRad = (lat * Math.PI) / 180
        const lonRad = (lon * Math.PI) / 180
        const gx = R_EARTH * Math.cos(latRad) * Math.cos(lonRad)
        const gy = R_EARTH * Math.cos(latRad) * Math.sin(lonRad)
        const gz = R_EARTH * Math.sin(latRad)

        const p = project3D(gx, gy, gz, 1.0, width, height, globeRotX, globeRotY)
        if (p.visible) {
          if (first) {
            ctx.moveTo(p.x, p.y)
            first = false
          } else {
            ctx.lineTo(p.x, p.y)
          }
        }
      }
      ctx.fill()
      ctx.stroke()
    }

    // Latitude rings (Equator and Arctic Circle)
    const drawLatCircle = (latDeg: number, strokeColor: string, isDashed = false) => {
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 1
      if (isDashed) ctx.setLineDash([3, 4])
      ctx.beginPath()
      let started = false
      for (let lon = -180; lon <= 180; lon += 5) {
        const latRad = (latDeg * Math.PI) / 180
        const lonRad = (lon * Math.PI) / 180
        const gx = R_EARTH * Math.cos(latRad) * Math.cos(lonRad)
        const gy = R_EARTH * Math.cos(latRad) * Math.sin(lonRad)
        const gz = R_EARTH * Math.sin(latRad)
        const p = project3D(gx, gy, gz, 1.0, width, height, globeRotX, globeRotY)
        if (p.visible) {
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

    drawLatCircle(0, 'rgba(56, 189, 248, 0.25)') // Equator
    drawLatCircle(66.5, 'rgba(56, 189, 248, 0.5)', true) // Arctic circle

    ctx.restore() // unclip globe

    // Globe rim highlight
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2)
    ctx.stroke()

    // 3D Projected Satellites
    const sat3DMap = new Map<string, { x: number; y: number; visible: boolean }>()
    const rOrbit = (R_EARTH + scenario.environment.altitude_km) / R_EARTH

    for (const s of snapshot.satellites) {
      sat3DMap.set(
        s.id,
        project3D(s.x_km, s.y_km, s.z_km, rOrbit, width, height, globeRotX, globeRotY)
      )
    }

    // 3D Projected Ground Stations
    const ground3DMap = new Map<string, { x: number; y: number; visible: boolean }>()
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
        if (u.startsWith('C') || u.startsWith('G') || v.startsWith('C') || v.startsWith('G')) continue
        const p1 = sat3DMap.get(u)
        const p2 = sat3DMap.get(v)
        if (!p1 || !p2 || (!p1.visible && !p2.visible)) continue

        ctx.strokeStyle = p1.visible && p2.visible ? 'rgba(125, 211, 252, 0.3)' : 'rgba(125, 211, 252, 0.08)'
        ctx.beginPath()
        ctx.moveTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.stroke()
      }
    }

    // Draw Ground-to-Sat links in 3D
    if (showGroundLinks) {
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      for (const [u, v] of snapshot.edges) {
        const isGroundU = u.startsWith('C') || u.startsWith('G')
        const isGroundV = v.startsWith('C') || v.startsWith('G')
        if (!isGroundU && !isGroundV) continue

        const p1 = isGroundU ? ground3DMap.get(u) : sat3DMap.get(u)
        const p2 = isGroundV ? ground3DMap.get(v) : sat3DMap.get(v)
        if (!p1 || !p2 || (!p1.visible && !p2.visible)) continue

        const groundId = isGroundU ? u : v
        ctx.strokeStyle = groundId === selectedClientId ? 'rgba(250, 204, 21, 0.7)' : 'rgba(148, 163, 184, 0.25)'
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
      ctx.shadowColor = '#10b981'
      ctx.shadowBlur = 12
      ctx.strokeStyle = '#34d399'
      ctx.lineWidth = 3

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
      if (!p || !p.visible) continue
      const isGateway = g.role === 'gateway'
      const isSelected = g.id === selectedClientId

      if (isGateway) {
        ctx.fillStyle = '#38bdf8'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(Math.PI / 4)
        ctx.fillRect(-6, -6, 12, 12)
        ctx.strokeRect(-6, -6, 12, 12)
        ctx.restore()

        ctx.fillStyle = '#e0f2fe'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`⯌ ${g.id}`, p.x + 8, p.y)
      } else {
        ctx.fillStyle = isSelected ? '#eab308' : '#38bdf8'
        ctx.strokeStyle = isSelected ? '#fef08a' : '#0284c7'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, isSelected ? 7 : 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = isSelected ? '#fef08a' : '#cbd5e1'
        ctx.font = isSelected ? 'bold 10px monospace' : '9px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`● ${g.id}`, p.x + 8, p.y)
      }
    }

    // Draw Satellites in 3D
    for (const sat of snapshot.satellites) {
      if (!showUnlaunched && !sat.active && !sat.failed) continue
      const p = sat3DMap.get(sat.id)
      if (!p) continue

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
        ctx.fillStyle = isOnRoute ? '#34d399' : pCol.stroke
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = isOnRoute ? 2 : 1
        ctx.beginPath()
        ctx.arc(p.x, p.y, isOnRoute ? 6 : 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }

      if (showLabels && p.visible) {
        ctx.fillStyle = isOnRoute ? '#6ee7b7' : '#94a3b8'
        ctx.font = '8px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(sat.id, p.x, p.y + 6)
      }
    }
  }

  // Find detailed data for inspected satellite
  const inspectedSat = inspectedSatId
    ? snapshot.satellites.find((s) => s.id === inspectedSatId)
    : null

  return (
    <div className="relative w-full h-full flex flex-col bg-[#070a12] select-none overflow-hidden rounded-xl border border-[#1a253a]">
      {/* Map Header Toolbar */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5 bg-[#0d1424]/95 backdrop-blur-md px-2 py-1 rounded-lg border border-[#1e2d47] shadow-xl pointer-events-auto">
          {/* 2D / 3D Mode Switcher */}
          <div className="flex items-center bg-[#131d31] p-0.5 rounded-md border border-[#243756]">
            <button
              onClick={() => setViewMode('2d')}
              className={`px-2 py-1 text-xs font-semibold rounded flex items-center gap-1 transition-all ${
                viewMode === '2d'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>2D Карта</span>
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={`px-2 py-1 text-xs font-semibold rounded flex items-center gap-1 transition-all ${
                viewMode === '3d'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span>3D Глобус</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Arctic Focus Button */}
          <button
            onClick={focusArctic}
            title="Сфокусировать вид на Арктическом регионе (Севморпуть)"
            className="px-2 py-1 rounded bg-[#131d31] hover:bg-[#1a2844] text-slate-300 hover:text-cyan-300 border border-[#243756] text-xs flex items-center gap-1"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Арктика</span>
          </button>

          {/* Toggles */}
          <button
            onClick={() => setShowIsl((v) => !v)}
            className={`px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1 ${
              showIsl
                ? 'bg-cyan-950/70 border-cyan-700/70 text-cyan-300'
                : 'bg-[#131d31] border-[#243756] text-slate-400'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>ISL</span>
          </button>

          <button
            onClick={() => setShowGroundLinks((v) => !v)}
            className={`px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1 ${
              showGroundLinks
                ? 'bg-cyan-950/70 border-cyan-700/70 text-cyan-300'
                : 'bg-[#131d31] border-[#243756] text-slate-400'
            }`}
          >
            <Wifi className="w-3 h-3" />
            <span>Лучи</span>
          </button>

          <button
            onClick={() => setShowLabels((v) => !v)}
            className={`px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1 ${
              showLabels
                ? 'bg-cyan-950/70 border-cyan-700/70 text-cyan-300'
                : 'bg-[#131d31] border-[#243756] text-slate-400'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>ID</span>
          </button>

          <button
            onClick={() => setShowUnlaunched((v) => !v)}
            className={`px-2 py-1 rounded text-xs font-medium border transition-colors flex items-center gap-1 ${
              showUnlaunched
                ? 'bg-cyan-950/70 border-cyan-700/70 text-cyan-300'
                : 'bg-[#131d31] border-[#243756] text-slate-400'
            }`}
            title="Показывать неразвернутые аппараты (резервные очереди)"
          >
            <span>Неактивные</span>
          </button>
        </div>

        {/* Right Toolbar: Client Selector & Legend */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Client quick switcher */}
          <div className="bg-[#0d1424]/95 backdrop-blur-md px-2 py-1 rounded-lg border border-[#1e2d47] shadow-xl flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium">Маршрут:</span>
            {scenario.ground_sites
              .filter((g) => g.role === 'client')
              .map((c) => {
                const hasRoute = (snapshot.routes[c.id] || []).length > 0
                const isSelected = c.id === selectedClientId
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelectClient(c.id)}
                    className={`px-2 py-1 text-xs font-mono font-bold rounded flex items-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                        : 'bg-[#131d31] text-slate-300 hover:bg-[#1a2844]'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasRoute ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />
                    <span>{c.id}</span>
                  </button>
                )
              })}
          </div>

          {/* Orbit Plane Legend */}
          <div className="bg-[#0d1424]/95 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-[#1e2d47] shadow-xl flex items-center gap-2.5 text-[11px] font-mono">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff]" />
              <span className="text-slate-300">P1</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c084fc]" />
              <span className="text-slate-300">P2</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" />
              <span className="text-slate-300">P3</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              <span className="text-slate-300">Отказ</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas View */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
        className={`w-full h-full block ${
          viewMode === '3d' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'
        }`}
      />

      {/* Floating HUD Card for Inspected Satellite */}
      {inspectedSat && (
        <div className="absolute bottom-4 left-4 z-20 bg-[#0d1424]/95 backdrop-blur-md p-3.5 rounded-xl border border-cyan-500/40 shadow-2xl max-w-xs text-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700/60 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  inspectedSat.failed
                    ? 'bg-red-500'
                    : inspectedSat.active
                    ? 'bg-emerald-400'
                    : 'bg-slate-500'
                }`}
              />
              <span className="font-mono font-bold text-sm text-cyan-300">
                Спутник {inspectedSat.id}
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                {inspectedSat.plane_id}
              </span>
            </div>
            <button
              onClick={() => setInspectedSatId(null)}
              className="text-slate-400 hover:text-white text-base leading-none"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Статус:</span>
              <span
                className={
                  inspectedSat.failed
                    ? 'text-red-400 font-bold'
                    : inspectedSat.active
                    ? 'text-emerald-400'
                    : 'text-slate-400'
                }
              >
                {inspectedSat.failed
                  ? 'ОТКАЗ (Failure)'
                  : inspectedSat.active
                  ? 'АКТИВЕН'
                  : 'НЕ ЗАПУЩЕН'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Очередь запуска:</span>
              <span>Партия {inspectedSat.launch_batch}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Широта / Долгота:</span>
              <span>
                {inspectedSat.lat_deg.toFixed(1)}°, {inspectedSat.lon_deg.toFixed(1)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Координаты ECEF (X, Y, Z):</span>
              <span className="text-[10px]">
                {Math.round(inspectedSat.x_km)}, {Math.round(inspectedSat.y_km)},{' '}
                {Math.round(inspectedSat.z_km)} км
              </span>
            </div>
          </div>

          {/* Action button */}
          <div className="mt-3 pt-2 border-t border-slate-700/60">
            <button
              onClick={() => onToggleFailure(inspectedSat.id)}
              className={`w-full py-1.5 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                inspectedSat.failed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  : 'bg-red-600/90 hover:bg-red-500 text-white shadow-md'
              }`}
            >
              {inspectedSat.failed ? (
                <>
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Восстановить спутник</span>
                </>
              ) : (
                <>
                  <ZapOff className="w-3.5 h-3.5" />
                  <span>Отключить спутник (Отказ)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
