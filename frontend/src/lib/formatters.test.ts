import { describe, it, expect } from 'vitest'
import {
  secondsToTimeInputValue,
  secondsToHHMM,
  hhmmToSeconds,
  formatDurationHuman,
  formatTimeHms,
  formatPercent,
} from './formatters'

describe('Formatters utility', () => {
  it('formats seconds to time input value (HH:MM)', () => {
    expect(secondsToTimeInputValue(0)).toBe('00:00')
    expect(secondsToTimeInputValue(3660)).toBe('01:01')
    expect(secondsToTimeInputValue(86400)).toBe('23:59')
  })

  it('formats seconds to HH:MM string', () => {
    expect(secondsToHHMM(0)).toBe('00:00')
    expect(secondsToHHMM(7200)).toBe('02:00')
    expect(secondsToHHMM(86400)).toBe('24:00')
  })

  it('parses HH:MM to seconds', () => {
    expect(hhmmToSeconds('00:00')).toBe(0)
    expect(hhmmToSeconds('01:30')).toBe(5400)
    expect(hhmmToSeconds('23:59')).toBe(86400)
    expect(hhmmToSeconds('invalid')).toBe(0)
  })

  it('formats duration into human-readable russian string', () => {
    expect(formatDurationHuman(0)).toBe('0 мин')
    expect(formatDurationHuman(180)).toBe('3 мин')
    expect(formatDurationHuman(3600)).toBe('1 ч')
    expect(formatDurationHuman(3900)).toBe('1 ч 5 мин')
  })

  it('formats time to HH:MM:SS', () => {
    expect(formatTimeHms(0)).toBe('00:00:00')
    expect(formatTimeHms(3665)).toBe('01:01:05')
  })

  it('formats ratios to percentages', () => {
    expect(formatPercent(0.9812)).toBe('98.1%')
    expect(formatPercent(0.9812, 2)).toBe('98.12%')
  })
})
