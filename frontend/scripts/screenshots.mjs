import { createServer } from 'vite'
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.resolve(rootDir, '../docs/assets')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

async function run() {
  console.log('🚀 Запуск Vite сервера...')
  const server = await createServer({
    root: rootDir,
    server: { port: 5199, host: '127.0.0.1' },
    logLevel: 'error',
  })
  await server.listen()
  const port = server.config.server.port || 5199
  const url = `http://127.0.0.1:${port}`

  console.log(`🌐 Vite запущен: ${url}`)
  console.log('🎭 Запуск Playwright Chromium...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    // 1. Главный экран (2D ЦУП)
    console.log('📸 1/5: Главный экран (2D ЦУП)...')
    await page.screenshot({
      path: path.join(outDir, 'frontend_verified.png'),
      fullPage: false,
    })

    // 2. 3D глобус
    console.log('📸 2/5: 3D Глобус...')
    const btn3d = page.locator('button', { hasText: '3D' }).first()
    if (await btn3d.isVisible()) {
      await btn3d.click()
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(outDir, 'globe_3d.png'),
        fullPage: false,
      })
      // Вернем обратно на 2D
      const btn2d = page.locator('button', { hasText: '2D' }).first()
      if (await btn2d.isVisible()) await btn2d.click()
      await page.waitForTimeout(500)
    }

    // 3. A/B Сравнение
    console.log('📸 3/5: A/B Сравнение...')
    const btnCompare = page.locator('button[title="Сравнение"]')
    if (await btnCompare.isVisible()) {
      await btnCompare.click()
      await page.waitForTimeout(800)
      await page.screenshot({
        path: path.join(outDir, 'ab_comparison.png'),
        fullPage: false,
      })
    }

    // 4. Аналитика и рекомендации
    console.log('📸 4/5: Аналитика...')
    const btnReport = page.locator('button[title="Аналитика"]')
    if (await btnReport.isVisible()) {
      await btnReport.click()
      await page.waitForTimeout(800)
      await page.screenshot({
        path: path.join(outDir, 'analytics_report.png'),
        fullPage: false,
      })
    }

    // 5. Конфигуратор
    console.log('📸 5/5: Конфигурация группировки...')
    const btnConfig = page.locator('button[title="Конфигурация"]')
    if (await btnConfig.isVisible()) {
      await btnConfig.click()
      await page.waitForTimeout(800)
      await page.screenshot({
        path: path.join(outDir, 'config_editor.png'),
        fullPage: false,
      })
    }

    console.log('✅ Скриншоты успешно сохранены в docs/assets/')
  } finally {
    await browser.close()
    await server.close()
  }
}

run().catch((err) => {
  console.error('❌ Ошибка снятия скриншотов:', err)
  process.exit(1)
})
