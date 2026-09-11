import { vi, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Automatically unmount React trees after each test
afterEach(() => {
  cleanup()
})

// 1. Mock HTMLCanvasElement 2D context
const createMockContext2D = () => ({
  canvas: {} as HTMLCanvasElement,
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1.0,
  shadowColor: 'transparent',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,

  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  arcTo: vi.fn(),
  ellipse: vi.fn(),
  rect: vi.fn(),
  roundRect: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  clip: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  translate: vi.fn(),
  transform: vi.fn(),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  measureText: vi.fn((text: string) => ({
    width: (text || '').length * 6,
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2,
  })),
  createLinearGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),
})

HTMLCanvasElement.prototype.getContext = vi.fn(function (
  this: HTMLCanvasElement,
  contextId: string
) {
  if (contextId === '2d') {
    return createMockContext2D()
  }
  return null
}) as unknown as typeof HTMLCanvasElement.prototype.getContext

// Ensure canvas dimensions default to non-zero in test environment
Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
  configurable: true,
  get() {
    return (this as any)._clientWidth ?? 800
  },
  set(val: number) {
    ;(this as any)._clientWidth = val
  },
})

Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return (this as any)._clientHeight ?? 600
  },
  set(val: number) {
    ;(this as any)._clientHeight = val
  },
})

// Mock pointer capture methods
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = vi.fn()
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = vi.fn()
}

// 2. Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

// 3. Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
