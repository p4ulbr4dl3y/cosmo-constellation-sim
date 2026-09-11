import { describe, it, expect, vi } from 'vitest'
import {
  clampPan2D,
  project2D,
  project3D,
  isSegmentVisible3D,
  drawLine2DWithAntimeridian,
  planeColors,
  defaultPlaneColor,
} from './projection'
import { R_EARTH } from '../../lib/orbit'

describe('Map Projection Utils', () => {
  describe('planeColors & defaultPlaneColor', () => {
    it('defines colors for P1, P2, P3 and default', () => {
      expect(planeColors.P1).toBeDefined()
      expect(planeColors.P2).toBeDefined()
      expect(planeColors.P3).toBeDefined()
      expect(defaultPlaneColor).toBeDefined()
      expect(planeColors.P1.stroke).toBe('#38bdf8')
    })
  })

  describe('clampPan2D', () => {
    it('returns 0,0 when zoom <= 1', () => {
      expect(clampPan2D({ x: 100, y: -50 }, 1.0, 1000, 800)).toEqual({ x: 0, y: 0 })
      expect(clampPan2D({ x: 50, y: 50 }, 0.5, 1000, 800)).toEqual({ x: 0, y: 0 })
    })

    it('clamps pan within max bounds when zoom > 1', () => {
      // w = 1000, zoom = 2 -> maxPanX = (1000 * 1) / 2 = 500
      // h = 800, zoom = 2 -> maxPanY = (800 * 1) / 2 = 400
      expect(clampPan2D({ x: 300, y: -200 }, 2.0, 1000, 800)).toEqual({ x: 300, y: -200 })
      expect(clampPan2D({ x: 700, y: -600 }, 2.0, 1000, 800)).toEqual({ x: 500, y: -400 })
      expect(clampPan2D({ x: -900, y: 500 }, 2.0, 1000, 800)).toEqual({ x: -500, y: 400 })
    })
  })

  describe('project2D', () => {
    it('projects origin (lon: 0, lat: 0) to canvas center with zoom 1 and pan 0', () => {
      const [x, y] = project2D(0, 0, 1000, 500, 1, { x: 0, y: 0 })
      expect(x).toBeCloseTo(500, 1)
      expect(y).toBeCloseTo(250, 1)
    })

    it('projects top-left (-180, 90) and bottom-right (180, -90)', () => {
      const [tlX, tlY] = project2D(-180, 90, 1000, 500, 1, { x: 0, y: 0 })
      expect(tlX).toBeCloseTo(0, 1)
      expect(tlY).toBeCloseTo(0, 1)

      const [brX, brY] = project2D(180, -90, 1000, 500, 1, { x: 0, y: 0 })
      expect(brX).toBeCloseTo(1000, 1)
      expect(brY).toBeCloseTo(500, 1)
    })

    it('preserves true aspect ratio without non-uniform stretching on wide canvas', () => {
      // Width is 1600, height is 400 -> 2:1 map is 800x400
      const [p1x, p1y] = project2D(0, 0, 1600, 400, 1, { x: 0, y: 0 })
      const [p2x] = project2D(30, 0, 1600, 400, 1, { x: 0, y: 0 })
      const [, p2y] = project2D(0, 30, 1600, 400, 1, { x: 0, y: 0 })

      expect(p1x).toBeCloseTo(800, 1)
      expect(p1y).toBeCloseTo(200, 1)

      const scaleX = Math.abs(p2x - p1x)
      const scaleY = Math.abs(p1y - p2y)
      // 30 deg lon must equal 30 deg lat in pixels (no polygon squashing/stretching)
      expect(scaleX).toBeCloseTo(scaleY, 2)
    })

    it('projects coordinates linearly beyond -180 and 180 deg for seamless grid continuation', () => {
      const [x180] = project2D(180, 0, 1000, 500, 1, { x: 0, y: 0 })
      const [x210] = project2D(210, 0, 1000, 500, 1, { x: 0, y: 0 })
      const [x0] = project2D(0, 0, 1000, 500, 1, { x: 0, y: 0 })
      const [x30] = project2D(30, 0, 1000, 500, 1, { x: 0, y: 0 })

      expect(x210 - x180).toBeCloseTo(x30 - x0, 2)
    })
  })

  describe('project3D', () => {
    it('projects point directly facing camera (front hemisphere)', () => {
      // Point at (0, R_EARTH, 0), no rotations
      const proj = project3D(0, R_EARTH, 0, 1, 800, 800, 0, 0, 1)
      expect(proj.visible).toBe(true)
      expect(proj.depth).toBeCloseTo(R_EARTH, 1)
      expect(proj.x).toBeCloseTo(400, 1)
      expect(proj.y).toBeCloseTo(400, 1)
    })

    it('identifies back hemisphere occluded by Earth globe disc', () => {
      // Point behind Earth center (0, -R_EARTH, 0)
      const proj = project3D(0, -R_EARTH, 0, 1, 800, 800, 0, 0, 1)
      // Depth is negative, distToCenter is 0 < R_EARTH -> not visible
      expect(proj.visible).toBe(false)
      expect(proj.depth).toBeLessThan(0)

      // Point slightly inside Earth limb on back side (0.99 * R_EARTH) is occluded
      const projNearLimb = project3D(R_EARTH * 0.99, -R_EARTH, 0, 1, 800, 800, 0, 0, 1)
      expect(projNearLimb.visible).toBe(false)
    })

    it('keeps high-altitude satellite visible even on back hemisphere if outside globe disc', () => {
      // High-altitude satellite behind Earth but off to the side (x2 > R_EARTH)
      const proj = project3D(R_EARTH * 1.5, -R_EARTH, 0, 1, 800, 800, 0, 0, 1)
      expect(proj.visible).toBe(true)
    })

    it('applies rotation angles rotX and rotY correctly', () => {
      const pRot = project3D(R_EARTH, 0, 0, 1, 800, 800, Math.PI / 4, Math.PI / 2, 1)
      expect(pRot.x).toBeDefined()
      expect(pRot.y).toBeDefined()
    })
  })

  describe('isSegmentVisible3D', () => {
    it('returns true when both endpoints are on front hemisphere (depth > 0)', () => {
      const p1 = { x: 400, y: 300, visible: true, depth: 100 }
      const p2 = { x: 450, y: 320, visible: true, depth: 50 }
      expect(isSegmentVisible3D(p1, p2, 200, 400, 300)).toBe(true)
    })

    it('returns false when either endpoint is not visible', () => {
      const p1 = { x: 400, y: 300, visible: true, depth: 100 }
      const p2 = { x: 400, y: 300, visible: false, depth: -100 }
      expect(isSegmentVisible3D(p1, p2, 200, 400, 300)).toBe(false)
    })

    it('returns true when segment is completely in outer space outside globe radius', () => {
      // Globe radius 200, cx: 400, cy: 300. Segment at x: 650 to 660 (distance ~250 > 200)
      const p1 = { x: 650, y: 300, visible: true, depth: 50 }
      const p2 = { x: 650, y: 350, visible: true, depth: -50 }
      expect(isSegmentVisible3D(p1, p2, 200, 400, 300)).toBe(true)
    })

    it('returns false when segment crosses into Earth disc and an endpoint has depth <= 0', () => {
      // Segment crosses center of globe (400, 300) with one endpoint behind Earth
      const p1 = { x: 400, y: 150, visible: true, depth: 100 }
      const p2 = { x: 400, y: 450, visible: true, depth: -50 }
      expect(isSegmentVisible3D(p1, p2, 200, 400, 300)).toBe(false)
    })

    it('returns true when front node inside disc connects to visible limb sat in space', () => {
      // p1 is ground station at center of globe (400, 300), depth +100
      // p2 is satellite at x: 650 (> 200 rim), depth -50
      // At horizon plane (depth = 0), t = 100 / 150 = 2/3, x = 400 + 250*(2/3) = 566.7 -> dist = 166.7
      // But if p1 is near the rim inside disc (x: 580) and p2 is in space (x: 650), depth crosses at > 200
      const p1 = { x: 580, y: 300, visible: true, depth: 50 }
      const p2 = { x: 650, y: 300, visible: true, depth: -50 }
      // Horizon crossing at t = 0.5 -> x = 615 (> 200 from center 400), back portion is entirely > 200
      expect(isSegmentVisible3D(p1, p2, 200, 400, 300)).toBe(true)
    })

    it('strictly rejects back-hemisphere chord penetrating rim without tolerance factor', () => {
      // Globe radius 200, cx: 400, cy: 300.
      // Endpoints at x: 599 (distance 199 < 200 from center)
      const p1 = { x: 599, y: 280, visible: true, depth: -100 }
      const p2 = { x: 599, y: 320, visible: true, depth: -100 }
      expect(isSegmentVisible3D(p1, p2, 200, 400, 300)).toBe(false)
    })
  })

  describe('drawLine2DWithAntimeridian', () => {
    const mockCtx = () => {
      return {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
      } as unknown as CanvasRenderingContext2D
    }

    it('draws a single segment when not crossing antimeridian', () => {
      const ctx = mockCtx()
      drawLine2DWithAntimeridian(ctx, 10, 20, 30, 40, 1000, 500, 1, { x: 0, y: 0 })
      expect(ctx.beginPath).toHaveBeenCalledTimes(1)
      expect(ctx.moveTo).toHaveBeenCalledTimes(1)
      expect(ctx.lineTo).toHaveBeenCalledTimes(1)
      expect(ctx.stroke).toHaveBeenCalledTimes(1)
    })

    it('splits into two segments when crossing antimeridian from west to east (lon1 > lon2)', () => {
      const ctx = mockCtx()
      // 170 to -170: dLon is -340, abs(dLon) > 180, lon1 > lon2
      drawLine2DWithAntimeridian(ctx, 170, 10, -170, 20, 1000, 500, 1, { x: 0, y: 0 })
      expect(ctx.beginPath).toHaveBeenCalledTimes(2)
      expect(ctx.moveTo).toHaveBeenCalledTimes(2)
      expect(ctx.lineTo).toHaveBeenCalledTimes(2)
      expect(ctx.stroke).toHaveBeenCalledTimes(2)
    })

    it('splits into two segments when crossing antimeridian from east to west (lon1 < lon2)', () => {
      const ctx = mockCtx()
      // -170 to 170: dLon is 340, abs(dLon) > 180, lon1 < lon2
      drawLine2DWithAntimeridian(ctx, -170, 10, 170, 20, 1000, 500, 1, { x: 0, y: 0 })
      expect(ctx.beginPath).toHaveBeenCalledTimes(2)
      expect(ctx.moveTo).toHaveBeenCalledTimes(2)
      expect(ctx.lineTo).toHaveBeenCalledTimes(2)
      expect(ctx.stroke).toHaveBeenCalledTimes(2)
    })
  })

  describe('isArtificialAntimeridianEdge', () => {
    it('detects antimeridian boundary cuts at +-180', async () => {
      const { isArtificialAntimeridianEdge } = await import('./render2D')
      expect(isArtificialAntimeridianEdge([180, 68.96], [180, 64.98])).toBe(true)
      expect(isArtificialAntimeridianEdge([-180, 64.98], [-180, 68.96])).toBe(true)
      expect(isArtificialAntimeridianEdge([180, -84.71], [180, -90])).toBe(true)
      expect(isArtificialAntimeridianEdge([180, -90], [-180, -90])).toBe(true)
    })

    it('preserves natural coastline edges', async () => {
      const { isArtificialAntimeridianEdge } = await import('./render2D')
      expect(isArtificialAntimeridianEdge([178.6, 69.4], [180, 68.96])).toBe(false)
      expect(isArtificialAntimeridianEdge([140, 50], [141, 51])).toBe(false)
    })
  })
})
