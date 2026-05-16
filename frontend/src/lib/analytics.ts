import type {
  Dump,
  RangeKey,
  SiteRow,
  LinePoint,
  Slice,
  TimedVisits,
  VisitsData,
} from './types'
import { colors, searchEngines, socialSites } from './constants'
import type { ChartConfig } from '@/components/ui/chart'

export type DateWindow = { from: string; to: string }

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function sumObject(values: Record<string, number> = {}) {
  return sum(Object.values(values))
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en').format(value)
}

export function siteKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'value'
}

export function getUTCOffset() {
  return String(Math.round(-new Date().getTimezoneOffset() / 60))
}

export function hourLabel(hour: string) {
  const parsed = Number(hour)
  if (Number.isNaN(parsed)) return hour
  if (parsed === 0) return '12a'
  if (parsed === 12) return '12p'
  return parsed < 12 ? `${parsed}a` : `${parsed - 12}p`
}

export function emptyVisitData(): VisitsData {
  return {
    date: {}, hour: {}, weekday: {}, ref: {},
    country: {}, device: {}, platform: {},
    browser: {}, lang: {}, screen: {}, page: {},
  }
}

export function emptyTimedVisits(): TimedVisits {
  return {
    day: emptyVisitData(),
    yesterday: emptyVisitData(),
    last7: emptyVisitData(),
    last30: emptyVisitData(),
    month: emptyVisitData(),
    year: emptyVisitData(),
    all: emptyVisitData(),
    daterange: emptyVisitData(),
  }
}

export function countTotal(visits: VisitsData) {
  return sumObject(visits.date ?? {})
}

export function countDirect(visits: VisitsData) {
  return countTotal(visits) - sumObject(visits.ref ?? {})
}

export function countMatchingRefs(visits: VisitsData, domains: Set<string>) {
  return Object.entries(visits.ref ?? {}).reduce(
    (total, [ref, count]) => total + (domains.has(topLevelDomain(ref)) ? count : 0),
    0,
  )
}

export function topLevelDomain(ref: string) {
  return /(?:www\.){0,1}([-\w]+\.(?:[-\w]+\.xn--[-\w]+|[-\w]{2,}|[-\w]+\.[-\w]{2})$)/i.exec(ref)?.[1] ?? ref
}

export function counterTrend(
  allVisits: TimedVisits,
  range: RangeKey,
  counter: (visits: VisitsData) => number,
) {
  const next = ({
    day: 'yesterday', yesterday: 'last7', last7: 'last30',
    last30: 'all', month: 'year', year: 'all', all: 'all', daterange: 'all',
  } as Record<RangeKey, RangeKey>)[range]
  const count = counter(allVisits[range] ?? emptyVisitData())
  const nextCount = counter(allVisits[next] ?? emptyVisitData())
  const percent = Math.round((count / Math.max(1, nextCount) - 1) * 100)
  return {
    trend: percent < 0 ? 'negative' : percent > 0 ? 'positive' : 'stability',
    percent: percent === 0 ? '' : `${Math.abs(percent)}%`,
  }
}

export function mergeVisits(visits: VisitsData[]): VisitsData {
  const result: VisitsData = {}
  for (const visit of visits)
    for (const [dimension, values] of Object.entries(visit ?? {}))
      for (const [key, count] of Object.entries(values ?? {}))
        result[dimension] = {
          ...(result[dimension] ?? {}),
          [key]: (result[dimension]?.[key] ?? 0) + count,
        }
  return result
}

export function patchVisit(visit: VisitsData): VisitsData {
  return { ...emptyVisitData(), ...visit, ref: visit.ref ?? {} }
}

export function patchDump(
  dump: Dump,
  archives: Record<string, Record<string, VisitsData>>,
  customRange: Record<string, VisitsData>,
): Dump {
  const next = normalizeDumpPayload(JSON.parse(JSON.stringify(dump)))
  for (const site of Object.keys(next.sites)) {
    const visits = next.sites[site].visits ?? emptyTimedVisits()
    next.sites[site].visits = visits
    visits.last7 = patchVisit(mergeVisits([visits.day, visits.yesterday, archives['-7:-2']?.[site] ?? emptyVisitData()]))
    visits.last30 = patchVisit(mergeVisits([visits.day, visits.yesterday, archives['-30:-2']?.[site] ?? emptyVisitData()]))
    visits.daterange = patchVisit(customRange[site] ?? emptyVisitData())
  }
  return next
}

export function makeTableRows(dump: Dump, range: RangeKey): SiteRow[] {
  return Object.entries(dump.sites).map(([site, value], index) => {
    const visits = (value.visits ?? emptyTimedVisits())[range] ?? emptyVisitData()
    return {
      site,
      total: countTotal(visits),
      search: countMatchingRefs(visits, searchEngines),
      social: countMatchingRefs(visits, socialSites),
      direct: countDirect(visits),
      color: colors[index % colors.length],
    }
  })
}

export function makeLineData(dump: Dump, range: RangeKey, customWindow?: DateWindow): LinePoint[] {
  const groupedBySite = Object.fromEntries(
    Object.entries(dump.sites).map(([site, siteDump]) => [
      site,
      graphSeries((siteDump.visits ?? emptyTimedVisits())[range] ?? emptyVisitData(), range, customWindow),
    ]),
  )
  const buckets = new Set<string>()
  for (const grouped of Object.values(groupedBySite))
    grouped.labels.forEach((label) => buckets.add(label))
  return Array.from(buckets).map((bucket) => {
    const point: LinePoint = { bucket }
    for (const [site, grouped] of Object.entries(groupedBySite))
      point[siteKey(site)] = grouped.map[bucket] ?? 0
    return point
  })
}

export function makeLineConfig(dump: Dump): ChartConfig {
  return Object.keys(dump.sites).reduce(
    (acc, site, index) => ({
      ...acc,
      [siteKey(site)]: { label: site, color: colors[index % colors.length] },
    }),
    {} as ChartConfig,
  )
}

export function toSlices(values: Record<string, number> = {}): Slice[] {
  return Object.entries(groupData(values, 7))
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      key: siteKey(name),
      fill: colors[index % colors.length],
    }))
}

export function groupData(values: Record<string, number>, limit: number) {
  const entries = Object.entries(values).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1])
  const top = entries.slice(0, limit)
  const other = sum(entries.slice(limit).map(([, value]) => value))
  return Object.fromEntries(other ? [...top, ['Other', other]] : top)
}

export function normalizeHours(hours: Record<string, number>) {
  return Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => [hourLabel(String(hour)), hours[String(hour)] ?? 0]),
  )
}

export function graphSeries(visits: VisitsData, range: RangeKey, customWindow?: DateWindow) {
  const grouped = groupDates(normalizeDateWindow(visits.date ?? {}, range, customWindow))
  if (grouped.labels.length === 1 || range === 'yesterday' || range === 'day') {
    const hours = normalizeHours(visits.hour ?? {})
    return { labels: Object.keys(hours), map: hours }
  }
  return {
    labels: grouped.labels,
    map: Object.fromEntries(grouped.labels.map((label, index) => [label, grouped.values[index] ?? 0])),
  }
}

export function groupDates(dates: Record<string, number>) {
  const entries = Object.entries(dates).sort(([a], [b]) => a.localeCompare(b))
  const groupedByWeek: Record<string, number> = {}
  const groupedByMonth: Record<string, number> = {}
  const groupedByYear: Record<string, number> = {}
  for (const [date, value] of entries) {
    const d = new Date(`${date}T00:00:00Z`)
    const week = `CW${weekNumber(d)}`
    const month = d.toLocaleString('en', {
      month: entries.length <= 366 ? 'long' : 'short',
      year: entries.length > 366 ? 'numeric' : undefined,
      timeZone: 'UTC',
    })
    const year = String(d.getUTCFullYear())
    groupedByWeek[week] = (groupedByWeek[week] ?? 0) + value
    groupedByMonth[month] = (groupedByMonth[month] ?? 0) + value
    groupedByYear[year] = (groupedByYear[year] ?? 0) + value
  }
  let grouped = Object.fromEntries(entries)
  if (Object.keys(grouped).length > 31) grouped = groupedByWeek
  if (Object.keys(grouped).length > 16) grouped = groupedByMonth
  if (Object.keys(grouped).length > 32) grouped = groupedByYear
  return { labels: Object.keys(grouped), values: Object.values(grouped) }
}

export function normalizeDateWindow(
  dates: Record<string, number>,
  range: RangeKey,
  customWindow?: DateWindow,
) {
  const window = dateWindowForRange(range, customWindow)
  if (!window) return dates
  return Object.fromEntries(
    dateKeys(window.from, window.to).map((date) => [date, dates[date] ?? 0]),
  )
}

export function dateWindowForRange(range: RangeKey, customWindow?: DateWindow): DateWindow | null {
  const today = startOfLocalDay(new Date())
  if (range === 'last7') return { from: dateKey(addDays(today, -6)), to: dateKey(today) }
  if (range === 'last30') return { from: dateKey(addDays(today, -29)), to: dateKey(today) }
  if (range === 'month') return { from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateKey(today) }
  if (range === 'year') return { from: dateKey(new Date(today.getFullYear(), 0, 1)), to: dateKey(today) }
  if (range === 'daterange' && customWindow) return customWindow
  return null
}

function dateKeys(from: string, to: string) {
  const dates: string[] = []
  for (let date = parseDateKey(from); date <= parseDateKey(to); date = addDays(date, 1))
    dates.push(dateKey(date))
  return dates
}

function parseDateKey(value: string) {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function weekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function trendSummary(vals: number[]) {
  const prev = vals[vals.length - 2] ?? 0
  const prevPrev = vals[vals.length - 3] ?? 0
  if (prevPrev + prev <= 2)
    return { title: 'Good stability', detail: 'Only a few data points in the previous buckets.' }
  const percent = Math.round((prev / Math.max(1, prevPrev) - 1) * 100)
  if (percent > 10) return { title: 'Positive dynamics', detail: `${percent}% growth compared with the previous bucket.` }
  if (percent < -10) return { title: 'Negative dynamics', detail: `${Math.abs(percent)}% decline compared with the previous bucket.` }
  return { title: 'Good stability', detail: 'Traffic is stable compared with the previous bucket.' }
}

export function downloadCSV(site: string, range: RangeKey, data: VisitsData) {
  const rows = ['dimension,type,count']
  for (const [dimension, values] of Object.entries(data))
    for (const [type, count] of Object.entries(values))
      rows.push(`${dimension},${JSON.stringify(type)},${count}`)
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `counter_stats_${range}_${new Date().toISOString().slice(0, 10)}_${site.replace('.', '-')}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function toNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value) || 0
}

export function normalizeNumberMap(payload: unknown): Record<string, number> {
  const raw = isRecord(payload) ? payload : {}
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, toNumber(value)]).filter(([, value]) => Number.isFinite(value)),
  )
}

export function normalizeStringMap(payload: unknown): Record<string, string> {
  const raw = isRecord(payload) ? payload : {}
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, toString(value)]))
}

export function normalizeVisitsData(payload: unknown): VisitsData {
  const raw = isRecord(payload) ? payload : {}
  const visits = emptyVisitData()
  for (const [dimension, values] of Object.entries(raw))
    visits[dimension] = normalizeNumberMap(values)
  return visits
}

export function normalizeTimedVisits(payload: unknown): TimedVisits {
  const raw = isRecord(payload) ? payload : {}
  const visits = emptyTimedVisits()
  for (const range of ['day', 'yesterday', 'last7', 'last30', 'month', 'year', 'all', 'daterange'] as RangeKey[])
    visits[range] = normalizeVisitsData(raw[range])
  return visits
}

export function normalizeDumpPayload(payload: unknown): Dump {
  const raw = isRecord(payload) ? payload : {}
  const rawUser = isRecord(raw.user) ? raw.user : {}
  const rawSites = isRecord(raw.sites) ? raw.sites : {}
  const sites: Record<string, SiteDump> = {}
  for (const [site, value] of Object.entries(rawSites)) {
    if (!isRecord(value)) continue
    sites[site] = {
      count: toNumber(value.count),
      logs: normalizeNumberMap(value.logs),
      visits: normalizeTimedVisits(value.visits),
    }
  }
  return {
    sites,
    user: {
      id: toString(rawUser.id),
      token: toString(rawUser.token),
      uuid: toString(rawUser.uuid),
      isSubscribed: Boolean(rawUser.isSubscribed),
      prefs: normalizeStringMap(rawUser.prefs),
    },
    meta: normalizeStringMap(raw.meta),
  }
}

export function normalizeArchivePayload(payload: unknown): Record<string, Record<string, VisitsData>> {
  const raw = isRecord(payload) ? payload : {}
  const result: Record<string, Record<string, VisitsData>> = {}
  for (const [range, sites] of Object.entries(raw))
    result[range] = normalizeCustomRangePayload(sites)
  return result
}

export function normalizeCustomRangePayload(payload: unknown): Record<string, VisitsData> {
  const raw = isRecord(payload) ? payload : {}
  const result: Record<string, VisitsData> = {}
  for (const [site, visits] of Object.entries(raw))
    result[site] = normalizeVisitsData(visits)
  return result
}

export function persistPreference(url: string, setError: (message: string) => void) {
  fetch(url)
    .then((response) => { if (!response.ok) throw new Error('Preference save failed') })
    .catch((err) => setError(err instanceof Error ? err.message : 'Preference save failed'))
}

export async function postAndReload(url: string) {
  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) throw new Error('Request failed')
  window.location.reload()
}

export async function copyText(value: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value)
    return
  }
  throw new Error('Clipboard is unavailable in this browser')
}
