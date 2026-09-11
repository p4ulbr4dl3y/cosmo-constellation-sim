import React, { useEffect, useMemo, useRef, useState } from 'react'
import { getGroundPositions } from '../../lib/orbit'
import { MapControls } from './MapControls'
import { MapSatelliteHUD } from './MapSatelliteHUD'
import { MapTooltip } from './MapTooltip'
import { clampPan2D, project2D, project3D } from './projection'
import { render2DMap } from './render2D'
import { render3DGlobe } from './render3D'
import type { HoveredNodeInfo, MapViewMode, NetworkMapProps } from './types'

export const NetworkMap: React.FC<NetworkMapProps> = ({
  scenario,
  snapshot,
  selectedClientId,
  onSelectClient,
  onToggleFailure,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  })

  // ResizeObserver to track container resizing and keep canvas pixel buffer 1:1 with CSS
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.round(rect.width)
      const h = Math.round(rect.height)
      if (w > 0 && h > 0) {
        setViewportSize((prev) =>
          prev.width === w && prev.height === h ? prev : { width: w, height: h }
        )
      }
    }

    updateSize()

    const ro = new ResizeObserver(() => {
      updateSize()
    })
    ro.observe(container)
    window.addEventListener('resize', updateSize)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  // Map view & layers state
  const [viewMode, setViewMode] = useState<MapViewMode>('2d')
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
  const [hoveredNode, setHoveredNode] = useState<HoveredNodeInfo | null>(null)

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

  // Switch view mode with appropriate zoom limits
  const handleSetViewMode = (mode: MapViewMode) => {
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
    const minZ = 0.5
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
      const minZ = 0.5
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
    const width = viewportSize.width || canvas.clientWidth || 800
    const height = viewportSize.height || canvas.clientHeight || 600
    let hit: HoveredNodeInfo | null = null

    // Check ground stations
    for (const g of groundPositions) {
      let px = 0,
        py = 0,
        vis = true
      if (viewMode === '2d') {
        ;[px, py] = project2D(g.lon_deg, g.lat_deg, width, height, zoom, pan2d)
      } else {
        const p = project3D(g.x, g.y, g.z, 1.0, width, height, globeRotX, globeRotY, zoom)
        px = p.x
        py = p.y
        vis = p.depth > 0
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
        let px = 0,
          py = 0,
          vis = true
        if (viewMode === '2d') {
          ;[px, py] = project2D(s.lon_deg, s.lat_deg, width, height, zoom, pan2d)
        } else {
          const p = project3D(
            s.x_km,
            s.y_km,
            s.z_km,
            1.0,
            width,
            height,
            globeRotX,
            globeRotY,
            zoom
          )
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

    setHoveredNode((prev) => {
      if (!prev && !hit) return prev
      if (prev && hit && prev.id === hit.id && prev.type === hit.type && Math.abs(prev.x - hit.x) < 0.5 && Math.abs(prev.y - hit.y) < 0.5) {
        return prev
      }
      return hit
    })
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

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Setup high DPI
    const dpr = window.devicePixelRatio || 1
    const width = viewportSize.width || canvas.clientWidth || 800
    const height = viewportSize.height || canvas.clientHeight || 600
    if (width === 0 || height === 0) return

    const targetWidth = Math.round(width * dpr)
    const targetHeight = Math.round(height * dpr)
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth
      canvas.height = targetHeight
    }
    ctx.resetTransform()
    ctx.scale(dpr, dpr)

    // Background cosmic deep space
    ctx.fillStyle = '#09090b'
    ctx.fillRect(0, 0, width, height)

    // Subtle star dust
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137.5) % width
      const sy = (i * 293.7) % height
      ctx.fillRect(sx, sy, 1, 1)
    }

    if (viewMode === '2d') {
      render2DMap({
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
      })
    } else {
      render3DGlobe({
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
      })
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
    inspectedSatId,
    hoveredNode,
    zoom,
    pan2d,
    viewportSize.width,
    viewportSize.height,
  ])

  // Find detailed data for inspected satellite
  const inspectedSat = inspectedSatId
    ? snapshot.satellites.find((s) => s.id === inspectedSatId) || null
    : null

  // Count active ISL edges attached to inspected sat
  const inspectedSatDegree = useMemo(() => {
    if (!inspectedSatId) return 0
    return snapshot.edges.filter(([u, v]) => u === inspectedSatId || v === inspectedSatId).length
  }, [inspectedSatId, snapshot.edges])

  return (
    <div className="relative w-full h-full flex flex-col bg-[#06090e] select-none overflow-hidden">
      <MapControls
        viewMode={viewMode}
        onSetViewMode={handleSetViewMode}
        onFocusArctic={focusArctic}
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onResetView={resetView}
        showIsl={showIsl}
        onToggleIsl={() => setShowIsl((v) => !v)}
        showGroundLinks={showGroundLinks}
        onToggleGroundLinks={() => setShowGroundLinks((v) => !v)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        showUnlaunched={showUnlaunched}
        onToggleUnlaunched={() => setShowUnlaunched((v) => !v)}
      />

      {/* Main Canvas Viewport Area */}
      <div ref={containerRef} className="relative flex-1 w-full min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onMouseLeave={() => setIsDragging(false)}
          onClick={handleCanvasClick}
          className={`w-full h-full block ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        />

        <MapTooltip hoveredNode={hoveredNode} />

        <MapSatelliteHUD
          satellite={inspectedSat}
          islDegree={inspectedSatDegree}
          onClose={() => setInspectedSatId(null)}
          onToggleFailure={onToggleFailure}
        />
      </div>
    </div>
  )
}
