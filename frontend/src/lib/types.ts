export type VisitsData = Record<string, Record<string, number>>
export type RangeKey = 'day' | 'yesterday' | 'last7' | 'last30' | 'month' | 'year' | 'all' | 'daterange'
export type HotRangeKey = 'day' | 'yesterday' | 'month' | 'year' | 'all'

export type TimedVisits = Record<RangeKey, VisitsData> & Record<HotRangeKey, VisitsData>

export type SiteDump = {
  count: number
  logs: Record<string, number>
  visits: TimedVisits
}

export type UserDump = {
  id: string
  token: string
  uuid: string
  isSubscribed: boolean
  prefs: Record<string, string>
}

export type Dump = {
  sites: Record<string, SiteDump>
  user: UserDump
  meta: Record<string, string>
}

export type EventSourceData = {
  type: 'dump' | 'archive' | 'oldest-archive-date' | 'nouser'
  payload: unknown
}

export type SiteRow = {
  site: string
  total: number
  search: number
  social: number
  direct: number
  color: string
}

export type LinePoint = Record<string, string | number> & { bucket: string }
export type Slice = { name: string; value: number; key: string; fill: string }

export type ReadyDashboard = {
  status: 'ready'
  dump: Dump
  selectedSite: string
  selectedRange: RangeKey
  setSelectedSite: (site: string) => void
  setSelectedRange: (range: RangeKey) => void
  loadCustomRange: (from: string, to: string) => Promise<void>
  tableRows: SiteRow[]
  lineData: LinePoint[]
  lineConfig: import('@/components/ui/chart').ChartConfig
}

export type DashboardState =
  | ReadyDashboard
  | { status: 'connecting' | 'nouser' | 'error'; error?: string }
