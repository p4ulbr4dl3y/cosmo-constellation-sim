import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Badge } from './Badge'
import { Button } from './Button'
import { Card, CardHeader, CardTitle } from './Card'
import { StatCard } from './StatCard'

describe('UI Primitives (Server Rendered Strings)', () => {
  describe('Badge', () => {
    it('renders with default neutral variant', () => {
      const html = renderToString(<Badge>Default</Badge>)
      expect(html).toContain('Default')
      expect(html).toContain('bg-white/[0.04]')
    })

    it('renders all variant themes', () => {
      const variants = ['cyan', 'lime', 'emerald', 'amber', 'red', 'blue', 'neutral'] as const
      for (const v of variants) {
        const html = renderToString(<Badge variant={v}>{`Variant ${v}`}</Badge>)
        expect(html).toContain(`Variant ${v}`)
      }
    })
  })

  describe('Button', () => {
    it('renders button with label and variants', () => {
      const html = renderToString(<Button variant="primary" size="md">Click Me</Button>)
      expect(html).toContain('Click Me')
      expect(html).toContain('bg-white/12')
    })

    it('renders disabled state', () => {
      const html = renderToString(<Button disabled>Disabled Action</Button>)
      expect(html).toContain('disabled=""')
      expect(html).toContain('disabled:opacity-40')
    })

    it('renders sizes including icon and lg', () => {
      const htmlIcon = renderToString(<Button size="icon">X</Button>)
      expect(htmlIcon).toContain('w-7 h-7')

      const htmlLg = renderToString(<Button size="lg">Large</Button>)
      expect(htmlLg).toContain('h-9')
    })
  })

  describe('Card', () => {
    it('renders card with header and title', () => {
      const html = renderToString(
        <Card variant="accent">
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <p>Body content</p>
        </Card>
      )
      expect(html).toContain('System Overview')
      expect(html).toContain('Body content')
      expect(html).toContain('bg-sky-500/10')
    })

    it('supports noPadding option and subtle variant', () => {
      const html = renderToString(<Card variant="subtle" noPadding>Content</Card>)
      expect(html).toContain('bg-[#090d14]')
      expect(html).not.toContain('p-3 sm:p-4')
    })
  })

  describe('StatCard', () => {
    it('renders basic metric with value and sublabel', () => {
      const html = renderToString(
        <StatCard label="Availability" value="99.8%" sublabel="SLA Target 90%" />
      )
      expect(html).toContain('Availability')
      expect(html).toContain('99.8%')
      expect(html).toContain('SLA Target 90%')
    })

    it('renders accent variant with trend and trendLabel', () => {
      const html = renderToString(
        <StatCard
          label="Latency"
          value="45 ms"
          variant="accent"
          trend="up"
          trendLabel="+5%"
          badge={<Badge variant="cyan">LIVE</Badge>}
        />
      )
      expect(html).toContain('Latency')
      expect(html).toContain('45 ms')
      expect(html).toContain('+5%')
      expect(html).toContain('LIVE')
    })

    it('renders compact variant', () => {
      const html = renderToString(
        <StatCard label="Loss" value="0%" variant="compact" sublabel="ok" />
      )
      expect(html).toContain('Loss')
      expect(html).toContain('0%')
      expect(html).toContain('ok')
    })

    it('renders down and neutral trends', () => {
      const htmlNeutral = renderToString(
        <StatCard label="Jitter" value="1ms" trend="neutral" trendLabel="flat" />
      )
      expect(htmlNeutral).toContain('flat')

      const htmlDown = renderToString(
        <StatCard label="Error Rate" value="1.2%" trend="down" trendLabel="-2.1%" />
      )
      expect(htmlDown).toContain('-2.1%')
    })
  })
})
