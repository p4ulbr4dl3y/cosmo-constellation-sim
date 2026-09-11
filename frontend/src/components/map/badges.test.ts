import { describe, it, expect, vi } from 'vitest'
import { drawBadgesWithLayout } from './badges'
import type { BadgeLayoutItem } from './types'

describe('Badge Collision-Free Layout (drawBadgesWithLayout)', () => {
  const mockContext = () => {
    return {
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      globalAlpha: 1,
      textAlign: '',
      textBaseline: '',
      measureText: vi.fn().mockReturnValue({ width: 40 }),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      roundRect: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D
  }

  it('returns immediately without errors when items list is empty', () => {
    const ctx = mockContext()
    drawBadgesWithLayout(ctx, [])
    expect(ctx.save).not.toHaveBeenCalled()
  })

  it('draws a single badge correctly with pill and text', () => {
    const ctx = mockContext()
    const item: BadgeLayoutItem = {
      text: 'CL1',
      anchorX: 100,
      anchorY: 100,
      priority: 10,
      font: '12px sans-serif',
      textColor: '#ffffff',
      bgColor: '#000000',
      borderColor: '#333333',
    }

    drawBadgesWithLayout(ctx, [item])
    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.roundRect).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
    expect(ctx.fillText).toHaveBeenCalledWith('CL1', expect.any(Number), expect.any(Number))
    expect(ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('skips drawing when item opacity is <= 0.05', () => {
    const ctx = mockContext()
    const item: BadgeLayoutItem = {
      text: 'FADED',
      anchorX: 100,
      anchorY: 100,
      priority: 5,
      opacity: 0.02,
      font: '12px sans-serif',
      textColor: '#fff',
      bgColor: '#000',
      borderColor: '#111',
    }

    drawBadgesWithLayout(ctx, [item])
    expect(ctx.save).not.toHaveBeenCalled()
    expect(ctx.fillText).not.toHaveBeenCalled()
  })

  it('applies globalAlpha when opacity is between 0.05 and 1.0', () => {
    const ctx = mockContext()
    const item: BadgeLayoutItem = {
      text: 'ALPHA',
      anchorX: 100,
      anchorY: 100,
      priority: 5,
      opacity: 0.7,
      font: '12px sans-serif',
      textColor: '#fff',
      bgColor: '#000',
      borderColor: '#111',
    }

    drawBadgesWithLayout(ctx, [item])
    expect(ctx.globalAlpha).toBe(0.7)
    expect(ctx.fillText).toHaveBeenCalled()
  })

  it('draws leader line when badge is pushed far from anchor (dist > 22)', () => {
    const ctx = mockContext()
    // Position overlapping items to force candidates far away
    const items: BadgeLayoutItem[] = [
      {
        text: 'Item 1',
        anchorX: 100,
        anchorY: 100,
        priority: 10,
        font: '12px sans-serif',
        textColor: '#fff',
        bgColor: '#000',
        borderColor: '#111',
      },
      {
        text: 'Item 2',
        anchorX: 100,
        anchorY: 100,
        prefOffsetY: -40, // offset > 22 forces leader line
        priority: 5,
        font: '12px sans-serif',
        textColor: '#fff',
        bgColor: '#000',
        borderColor: '#111',
      },
    ]

    drawBadgesWithLayout(ctx, items)
    expect(ctx.setLineDash).toHaveBeenCalledWith([2, 2])
    expect(ctx.setLineDash).toHaveBeenCalledWith([])
  })

  it('handles multiple colliding badges and arranges them without crashing', () => {
    const ctx = mockContext()
    // Create 15 densely packed badges at same coordinate
    const items: BadgeLayoutItem[] = Array.from({ length: 15 }, (_, i) => ({
      text: `Badge ${i}`,
      anchorX: 200,
      anchorY: 200,
      priority: i,
      font: '12px sans-serif',
      textColor: '#fff',
      bgColor: '#000',
      borderColor: '#111',
    }))

    drawBadgesWithLayout(ctx, items)
    expect(ctx.fillText).toHaveBeenCalledTimes(15)
  })
})
