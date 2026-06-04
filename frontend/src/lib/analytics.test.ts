import { afterEach, describe, expect, it, vi } from 'vitest'

import { graphSeries, makeLineData, normalizeDateWindow, patchDump } from './analytics'
import type { Dump } from './types'

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeDateWindow', () => {
  it('fills relative ranges to the current range start and end dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 10, 12))

    expect(normalizeDateWindow({ '2026-01-08': 4 }, 'last7')).toEqual({
      '2026-01-04': 0,
      '2026-01-05': 0,
      '2026-01-06': 0,
      '2026-01-07': 0,
      '2026-01-08': 4,
      '2026-01-09': 0,
      '2026-01-10': 0,
    })
  })

  it('fills and clamps custom ranges to their selected start and end dates', () => {
    expect(
      normalizeDateWindow(
        {
          '2026-01-01': 99,
          '2026-01-03': 2,
          '2026-01-05': 5,
          '2026-01-09': 99,
        },
        'daterange',
        { from: '2026-01-02', to: '2026-01-06' },
      ),
    ).toEqual({
      '2026-01-02': 0,
      '2026-01-03': 2,
      '2026-01-04': 0,
      '2026-01-05': 5,
      '2026-01-06': 0,
    })
  })
})

describe('graphSeries', () => {
  it('keeps last 30 days on daily buckets even when only one day has visits', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 27, 12))

    const labels = graphSeries(
      { date: { '2026-05-22': 7 }, hour: { '12': 7 } },
      'last30',
    ).labels

    expect(labels).toHaveLength(30)
    expect(labels[0]).toBe('2026-04-28')
    expect(labels[29]).toBe('2026-05-27')
  })

  it('keeps this month on daily buckets instead of falling back to hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 27, 12))

    const labels = graphSeries(
      { date: { '2026-05-22': 7 }, hour: { '12': 7 } },
      'month',
    ).labels

    expect(labels).toHaveLength(27)
    expect(labels[0]).toBe('2026-05-01')
    expect(labels[26]).toBe('2026-05-27')
  })

  it('uses the custom range as the line chart domain when data is sparse', () => {
    expect(
      graphSeries(
        { date: { '2026-01-03': 2, '2026-01-05': 5 } },
        'daterange',
        { from: '2026-01-02', to: '2026-01-06' },
      ).labels,
    ).toEqual(['2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06'])
  })
})

describe('makeLineData', () => {
  it('uses archived visits when building last 7 and last 30 day trends', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 10, 12))

    const dump: Dump = {
      user: { id: '1', token: 'token', uuid: 'uuid', isSubscribed: true, prefs: {} },
      meta: {},
      sites: {
        'example.com': {
          count: 14,
          logs: {},
          visits: {
            day: { date: { '2026-01-10': 5 } },
            yesterday: { date: { '2026-01-09': 4 } },
            last7: { date: {} },
            last30: { date: {} },
            month: { date: {} },
            year: { date: {} },
            all: { date: {} },
            daterange: { date: {} },
          },
        },
      },
    }
    const patched = patchDump(
      dump,
      {
        '-7:-2': { 'example.com': { date: { '2026-01-04': 1, '2026-01-08': 2 } } },
        '-30:-2': { 'example.com': { date: { '2025-12-12': 3, '2026-01-08': 2 } } },
      },
      {},
    )

    expect(makeLineData(patched, 'last7')).toEqual([
      { bucket: '2026-01-04', 'example-com': 1 },
      { bucket: '2026-01-05', 'example-com': 0 },
      { bucket: '2026-01-06', 'example-com': 0 },
      { bucket: '2026-01-07', 'example-com': 0 },
      { bucket: '2026-01-08', 'example-com': 2 },
      { bucket: '2026-01-09', 'example-com': 4 },
      { bucket: '2026-01-10', 'example-com': 5 },
    ])
    expect(makeLineData(patched, 'last30')[0]).toEqual({ bucket: '2025-12-12', 'example-com': 3 })
  })

  it('falls back to all-time date counts when archive data is missing from relative trends', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 10, 12))

    const dump: Dump = {
      user: { id: '1', token: 'token', uuid: 'uuid', isSubscribed: true, prefs: {} },
      meta: {},
      sites: {
        'example.com': {
          count: 9,
          logs: {},
          visits: {
            day: { date: { '2026-01-10': 1 } },
            yesterday: { date: {} },
            last7: { date: {} },
            last30: { date: {} },
            month: { date: {} },
            year: { date: {} },
            all: { date: { '2026-01-06': 8, '2026-01-10': 1 } },
            daterange: { date: {} },
          },
        },
      },
    }

    expect(makeLineData(patchDump(dump, {}, {}), 'last7')).toEqual([
      { bucket: '2026-01-04', 'example-com': 0 },
      { bucket: '2026-01-05', 'example-com': 0 },
      { bucket: '2026-01-06', 'example-com': 8 },
      { bucket: '2026-01-07', 'example-com': 0 },
      { bucket: '2026-01-08', 'example-com': 0 },
      { bucket: '2026-01-09', 'example-com': 0 },
      { bucket: '2026-01-10', 'example-com': 1 },
    ])
  })

  it('sorts buckets chronologically across all sites', () => {
    const dump: Dump = {
      user: { id: '1', token: 'token', uuid: 'uuid', isSubscribed: true, prefs: {} },
      meta: {},
      sites: {
        'example.com': {
          count: 6,
          logs: {},
          visits: {
            day: { date: {} },
            yesterday: { date: {} },
            last7: { date: {} },
            last30: { date: {} },
            month: { date: {} },
            year: { date: {} },
            all: { date: { '2026-05-15': 1, '2026-05-17': 1, '2026-05-20': 1, '2026-05-23': 1, '2026-05-25': 1, '2026-05-27': 1 } },
            daterange: { date: {} },
          },
        },
        'second.example': {
          count: 1,
          logs: {},
          visits: {
            day: { date: {} },
            yesterday: { date: {} },
            last7: { date: {} },
            last30: { date: {} },
            month: { date: {} },
            year: { date: {} },
            all: { date: { '2026-05-22': 1 } },
            daterange: { date: {} },
          },
        },
      },
    }

    expect(makeLineData(dump, 'all').map((point) => point.bucket)).toEqual([
      '2026-05-15',
      '2026-05-17',
      '2026-05-20',
      '2026-05-22',
      '2026-05-23',
      '2026-05-25',
      '2026-05-27',
    ])
  })

  it('aligns all sites to the selected custom range bounds', () => {
    const dump: Dump = {
      user: { id: '1', token: 'token', uuid: 'uuid', isSubscribed: true, prefs: {} },
      meta: {},
      sites: {
        'example.com': {
          count: 1,
          logs: {},
          visits: {
            day: { date: {} },
            yesterday: { date: {} },
            last7: { date: {} },
            last30: { date: {} },
            month: { date: {} },
            year: { date: {} },
            all: { date: {} },
            daterange: { date: { '2026-01-04': 3 } },
          },
        },
      },
    }

    expect(makeLineData(dump, 'daterange', { from: '2026-01-02', to: '2026-01-04' })).toEqual([
      { bucket: '2026-01-02', 'example-com': 0 },
      { bucket: '2026-01-03', 'example-com': 0 },
      { bucket: '2026-01-04', 'example-com': 3 },
    ])
  })
})
