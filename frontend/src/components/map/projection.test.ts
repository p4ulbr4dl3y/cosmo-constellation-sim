import { describe, it, expect, vi } from 'vitest'
import {
  clampPan2D,
  project2D,
  project3D,
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
      // Depth is negative, distToCenter is 0 < R_EARTH * 0.98 -> not visible
      expect(proj.visible).toBe(false)
      expect(proj.depth).toBeLessThan(0)
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
})
