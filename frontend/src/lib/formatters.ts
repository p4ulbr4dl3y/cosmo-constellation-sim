/**
 * Утилиты форматирования времени и числовых метрик.
 */

/**
 * Преобразует время в секундах в формат ЧЧ:ММ для поля ввода (диапазон от 00:00 до 23:59).
 */
export function secondsToTimeInputValue(totalSec: number): string {
  const clamped = Math.max(0, Math.min(86400, totalSec))
  if (clamped >= 86400) return '23:59'
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Преобразует время в секундах в строку формата ЧЧ:ММ (до 24:00 включительно).
 */
export function secondsToHHMM(totalSec: number): string {
  if (totalSec >= 86400) return '24:00'
  const clamped = Math.max(0, totalSec)
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Преобразует строку времени ЧЧ:ММ в секунды от начала суток (0..86400).
 */
export function hhmmToSeconds(hhmm: string): number {
  const parts = hhmm.split(':')
  if (parts.length < 2) return 0
  const h = parseInt(parts[0], 10) || 0
  const m = parseInt(parts[1], 10) || 0
  if (h === 23 && m === 59) return 86400
  return Math.min(86400, Math.max(0, h * 3600 + m * 60))
}

/**
 * Формирует человекочитаемое представление длительности в минутах и часах.
 */
export function formatDurationHuman(sec: number): string {
  if (!sec || sec <= 0) return '0 мин'
  const totalMinutes = Math.round(sec / 60)
  if (totalMinutes < 60) return `${totalMinutes} мин`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

/**
 * Преобразует секунды в точный формат ЧЧ:ММ:СС.
 */
export function formatTimeHms(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds)
  const h = Math.floor(clamped / 3600)
  const m = Math.floor((clamped % 3600) / 60)
  const s = Math.floor(clamped % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Форматирует долю (0..1) в процентное представление с заданной точностью.
 */
export function formatPercent(ratio: number, digits: number = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`
}
