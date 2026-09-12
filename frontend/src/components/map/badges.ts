import type { BadgeLayoutItem } from './types'

interface PlacedBox {
  l: number
  r: number
  t: number
  b: number
}

export function drawBadgesWithLayout(
  targetCtx: CanvasRenderingContext2D,
  items: BadgeLayoutItem[]
): void {
  if (items.length === 0) return

  const measured = items.map((item) => {
    targetCtx.font = item.font
    const tw = targetCtx.measureText(item.text).width
    const px = 4
    const py = 1.5
    const w = tw + px * 2
    const h = 14 + py * 2
    return {
      item,
      w,
      h,
      prefY: item.prefOffsetY ?? -15,
    }
  })

  // Sort descending by priority (higher priority gets placed first)
  measured.sort((a, b) => b.item.priority - a.item.priority)

  const placed: Array<
    PlacedBox & {
      lx: number
      ly: number
      anchorX: number
      anchorY: number
      item: BadgeLayoutItem
    }
  > = []

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
