import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowDownUp, Download, Eye, EyeOff, Plus, Settings } from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/')({
  component: Dashboard,
  errorComponent: ({ error }) => (
    <StateScreen
      title="Dashboard failed safely"
      detail={error instanceof Error ? error.message : 'An unexpected dashboard error occurred.'}
      tone="error"
      action={<Button onClick={() => window.location.reload()}>Reload dashboard</Button>}
    />
  ),
})

gsap.registerPlugin(ScrollTrigger)

type VisitsData = Record<string, Record<string, number>>
type RangeKey = 'day' | 'yesterday' | 'last7' | 'last30' | 'month' | 'year' | 'all' | 'daterange'
type HotRangeKey = 'day' | 'yesterday' | 'month' | 'year' | 'all'

type TimedVisits = Record<RangeKey, VisitsData> & Record<HotRangeKey, VisitsData>

type SiteDump = {
  count: number
  logs: Record<string, number>
  visits: TimedVisits
}

type UserDump = {
  id: string
  token: string
  uuid: string
  isSubscribed: boolean
  prefs: Record<string, string>
}

type Dump = {
  sites: Record<string, SiteDump>
  user: UserDump
  meta: Record<string, string>
}

type EventSourceData = {
  type: 'dump' | 'archive' | 'oldest-archive-date' | 'nouser'
  payload: unknown
}

type SiteRow = {
  site: string
  total: number
  search: number
  social: number
  direct: number
  color: string
}

type LinePoint = Record<string, string | number> & { bucket: string }
type Slice = { name: string; value: number; key: string; fill: string }

type ReadyDashboard = {
  status: 'ready'
  dump: Dump
  selectedSite: string
  selectedRange: RangeKey
  setSelectedSite: (site: string) => void
  setSelectedRange: (range: RangeKey) => void
  loadCustomRange: (from: string, to: string) => Promise<void>
  tableRows: SiteRow[]
  lineData: LinePoint[]
  lineConfig: ChartConfig
}

type DashboardState =
  | ReadyDashboard
  | { status: 'connecting' | 'nouser' | 'error'; error?: string }

const ranges: Array<{ value: RangeKey; label: string }> = [
  { value: 'day', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

const piePanels = [
  ['ref', 'Sources'],
  ['country', 'Countries'],
  ['device', 'Devices'],
  ['platform', 'Platforms'],
  ['browser', 'Browsers'],
  ['lang', 'Languages'],
  ['screen', 'Screen sizes'],
  ['page', 'Visited pages'],
] as const

const colors = [
  'oklch(0.67 0.19 38)',
  'oklch(0.67 0.17 173)',
  'oklch(0.62 0.21 281)',
  'oklch(0.72 0.16 85)',
  'oklch(0.64 0.2 337)',
  'oklch(0.58 0.2 250)',
]

const searchEngines = new Set(['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'baidu.com', 'yandex.ru', 'ask.com', 'ecosia.org', 'qwant.com', 'startpage.com'])
const socialSites = new Set(['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 't.co', 'linkedin.com', 'reddit.com', 'youtube.com', 'pinterest.com', 'tiktok.com', 'medium.com', 'dev.to', 'indiehackers.com', 'discord.com', 'quora.com', 'vk.com', 'weibo.com'])

const columnHelper = createColumnHelper<SiteRow>()

const columns = [
  columnHelper.accessor('site', {
    header: 'Site',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: row.original.color }} />
        <span className="font-medium">{row.original.site}</span>
      </div>
    ),
  }),
  columnHelper.accessor('total', { header: 'Total', cell: (info) => formatNumber(info.getValue()) }),
  columnHelper.accessor('search', { header: 'Search', cell: (info) => formatNumber(info.getValue()) }),
  columnHelper.accessor('social', { header: 'Social', cell: (info) => formatNumber(info.getValue()) }),
  columnHelper.accessor('direct', { header: 'Direct', cell: (info) => formatNumber(info.getValue()) }),
]

function Dashboard() {
  const dashboard = useCounterDump()

  if (dashboard.status === 'connecting') {
    return <StateScreen title="Connecting to live Counter data" detail="Opening the /dump event stream and loading your active account, archives, and site preferences." tone="loading" />
  }

  if (dashboard.status === 'nouser') {
    return <AuthScreen />
  }

  if (dashboard.status === 'error') {
    return <StateScreen title="Dashboard stream disconnected" detail={dashboard.error ?? 'The live event stream failed.'} tone="error" action={<Button onClick={() => window.location.reload()}>Reconnect stream</Button>} />
  }

  return <ReadyDashboardView dashboard={dashboard as ReadyDashboard} />
}

function ReadyDashboardView({ dashboard }: { dashboard: ReadyDashboard }) {
  const scope = React.useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'total', desc: true }])
  const { dump, selectedSite, selectedRange, setSelectedSite, setSelectedRange, lineData, lineConfig, tableRows } = dashboard
  const siteNames = Object.keys(dump.sites)
  const effectiveSelectedSite = dump.sites[selectedSite] ? selectedSite : siteNames[0]
  const siteDump = effectiveSelectedSite ? dump.sites[effectiveSelectedSite] : undefined
  const siteVisits = siteDump?.visits ?? emptyTimedVisits()
  const rangeData = siteVisits[selectedRange] ?? emptyVisitData()

  useGSAP(
    () => {
      if (!scope.current?.querySelector('.dashboard-hero')) return
      gsap.from(scope.current.querySelectorAll('.dashboard-word'), {
        opacity: 0.15,
        y: 18,
        stagger: 0.04,
        scrollTrigger: { trigger: scope.current.querySelector('.dashboard-hero'), start: 'top 70%', end: 'bottom 30%', scrub: true },
      })
      gsap.from(scope.current.querySelectorAll('.analytics-card'), {
        opacity: 0,
        y: 42,
        scale: 0.97,
        stagger: 0.06,
        ease: 'power3.out',
        scrollTrigger: { trigger: scope.current.querySelector('.analytics-grid'), start: 'top 82%' },
      })
    },
    { scope, dependencies: [dump, selectedSite, selectedRange] }
  )

  const table = useReactTable({
    data: tableRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (!siteNames.length || !effectiveSelectedSite || !siteDump) {
    return <SetupScreen uuid={dump.user.uuid} />
  }

  return (
    <main ref={scope} className="w-full max-w-full overflow-x-hidden bg-background">
      <section className="dashboard-hero relative isolate w-full overflow-hidden px-4 py-14 sm:px-8 lg:px-12 lg:py-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,oklch(0.67_0.19_38_/_0.22),transparent_32%),radial-gradient(circle_at_85%_10%,oklch(0.62_0.21_281_/_0.18),transparent_30%),linear-gradient(180deg,var(--background),var(--muted))]" />
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <h1 className="max-w-6xl text-[clamp(3rem,6vw,6.75rem)] leading-[0.92] font-semibold tracking-[-0.08em] text-balance">
              {['Live', 'analytics', 'from', 'your', 'Counter', 'stream'].map((word) => (
                <span className="dashboard-word mr-4 inline-block" key={word}>{word}</span>
              ))}
            </h1>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
              Real site data from `/dump`, including hot Redis visits, archive-backed ranges, sessionless dashboards, and your existing Counter preferences.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <Controls
              dump={dump}
              selectedSite={effectiveSelectedSite}
              selectedRange={selectedRange}
              setSelectedSite={setSelectedSite}
              setSelectedRange={setSelectedRange}
              onCustomRange={dashboard.loadCustomRange}
            />
            <ShareActions dump={dump} />
          </div>
        </div>
      </section>

      <section className="analytics-grid grid-flow-dense grid w-full gap-4 px-4 py-10 sm:px-8 lg:grid-cols-12 lg:px-12">
        <Card className="analytics-card col-span-full lg:col-span-8">
          <CardHeader>
            <CardDescription>All sites</CardDescription>
            <CardTitle>Visits by {selectedRangeLabel(selectedRange).toLowerCase()}</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={lineConfig} className="h-[430px] w-full">
              <LineChart accessibilityLayer data={lineData} margin={{ left: 8, right: 24 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="bucket" tickLine={false} axisLine={false} tickMargin={12} />
                <YAxis tickLine={false} axisLine={false} tickMargin={12} />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <ChartLegend content={<ChartLegendContent />} />
                {Object.keys(dump.sites).map((site) => (
                  <Line key={site} type="monotone" dataKey={siteKey(site)} stroke={`var(--color-${siteKey(site)})`} strokeWidth={3} dot={false} />
                ))}
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="analytics-card col-span-full lg:col-span-4">
          <CardHeader>
            <CardDescription>TanStack Table</CardDescription>
            <CardTitle>Site visit data</CardTitle>
          </CardHeader>
          <CardContent>
            <SiteTable table={table} selectedSite={effectiveSelectedSite} onSelectSite={setSelectedSite} />
          </CardContent>
        </Card>
      </section>

      <section className="w-full px-4 py-10 sm:px-8 lg:px-12">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3">
            <h2 className="text-4xl font-semibold tracking-tight sm:text-6xl">{effectiveSelectedSite}</h2>
            <p className="text-muted-foreground">Real breakdowns from `{selectedRange}` visit dimensions.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadCSV(effectiveSelectedSite, selectedRange, rangeData)}>
              <Download data-icon="inline-start" />
              Download CSV
            </Button>
            {!dump.meta.sessionless ? <DeleteSite site={effectiveSelectedSite} /> : null}
          </div>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <CounterCard label="Visits" value={countTotal(rangeData)} comparison={counterTrend(siteVisits, selectedRange, countTotal)} />
          <CounterCard label="Search engines" value={countMatchingRefs(rangeData, searchEngines)} comparison={counterTrend(siteVisits, selectedRange, (visits) => countMatchingRefs(visits, searchEngines))} />
          <CounterCard label="Social networks" value={countMatchingRefs(rangeData, socialSites)} comparison={counterTrend(siteVisits, selectedRange, (visits) => countMatchingRefs(visits, socialSites))} />
          <CounterCard label="Direct" value={countDirect(rangeData)} comparison={counterTrend(siteVisits, selectedRange, countDirect)} />
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <DynamicsPanel dates={rangeData.date ?? {}} />
          <BarListPanel title="Hours" data={normalizeHours(rangeData.hour ?? {})} />
          <BarListPanel title="Weekdays" data={rangeData.weekday ?? {}} />
        </div>

        <div className="pie-grid grid-flow-dense grid w-full gap-4 md:grid-cols-2 xl:grid-cols-4">
          {piePanels.map(([dimension, title]) => (
            <PiePanel key={`${effectiveSelectedSite}-${selectedRange}-${dimension}`} title={title} data={toSlices(rangeData[dimension])} />
          ))}
        </div>
      </section>

      <section className="grid w-full gap-4 px-4 py-10 sm:px-8 lg:grid-cols-2 lg:px-12">
        <TrackingCode uuid={dump.user.uuid} />
        <VisitLogs logs={siteDump.logs} />
      </section>
    </main>
  )
}

function useCounterDump(): DashboardState {
  const [status, setStatus] = React.useState<'connecting' | 'ready' | 'nouser' | 'error'>('connecting')
  const [error, setError] = React.useState('')
  const [dump, setDump] = React.useState<Dump | null>(null)
  const [archives, setArchives] = React.useState<Record<string, Record<string, VisitsData>>>({})
  const [customRange, setCustomRange] = React.useState<Record<string, VisitsData>>({})
  const [selectedSite, setSelectedSiteState] = React.useState('')
  const [selectedRange, setSelectedRangeState] = React.useState<RangeKey>('day')

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('utcoffset', String(getUTCOffset()))
    const source = new EventSource(`/dump?${params.toString()}`)

    source.onmessage = (event) => {
      let data: EventSourceData
      try {
        data = JSON.parse(event.data) as EventSourceData
      } catch {
        setStatus('error')
        setError('Counter sent an invalid live event payload.')
        source.close()
        return
      }
      if (data.type === 'nouser') {
        setStatus('nouser')
        source.close()
        return
      }
      if (data.type === 'archive') {
        setArchives(normalizeArchivePayload(data.payload))
        return
      }
      if (data.type === 'dump') {
        setDump(normalizeDumpPayload(data.payload))
        setStatus('ready')
      }
    }
    source.onerror = () => {
      setStatus((current) => (current === 'ready' ? current : 'error'))
      setError('The live event stream failed before dashboard data was available.')
    }

    return () => source.close()
  }, [])

  const patchedDump = React.useMemo(() => (dump ? patchDump(dump, archives, customRange) : null), [dump, archives, customRange])

  React.useEffect(() => {
    if (!patchedDump) return
    const sites = Object.keys(patchedDump.sites).sort((a, b) => patchedDump.sites[b].count - patchedDump.sites[a].count)
    if (!selectedSite || !patchedDump.sites[selectedSite]) {
      setSelectedSiteState(patchedDump.user.prefs.site && patchedDump.sites[patchedDump.user.prefs.site] ? patchedDump.user.prefs.site : sites[0] || '')
    }
    const prefRange = patchedDump.user.prefs.range as RangeKey
    if (prefRange && ranges.some((range) => range.value === prefRange)) {
      setSelectedRangeState(prefRange)
    }
  }, [patchedDump, selectedSite])

  const setSelectedSite = React.useCallback((site: string) => {
    setSelectedSiteState(site)
    persistPreference(`/setPrefSite?${encodeURIComponent(site)}`, setError)
  }, [])

  const setSelectedRange = React.useCallback((range: RangeKey) => {
    setSelectedRangeState(range)
    if (range !== 'daterange') persistPreference(`/setPrefRange?${encodeURIComponent(range)}`, setError)
  }, [])

  const loadCustomRange = React.useCallback(async (from: string, to: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set('from', from)
    params.set('to', to)
    const response = await fetch(`/query?${params.toString()}`, { credentials: 'include' })
    if (!response.ok) throw new Error('Failed to fetch custom range')
    setCustomRange(normalizeCustomRangePayload(await response.json()))
    setSelectedRangeState('daterange')
  }, [])

  const tableRows = React.useMemo(() => (patchedDump ? makeTableRows(patchedDump, selectedRange) : []), [patchedDump, selectedRange])
  const lineData = React.useMemo(() => (patchedDump ? makeLineData(patchedDump, selectedRange) : []), [patchedDump, selectedRange])
  const lineConfig = React.useMemo(() => (patchedDump ? makeLineConfig(patchedDump) : {}), [patchedDump])

  if (!patchedDump || status !== 'ready') {
    return { status: status === 'ready' ? 'connecting' : status, error }
  }

  const sites = Object.keys(patchedDump.sites).sort((a, b) => patchedDump.sites[b].count - patchedDump.sites[a].count)
  const effectiveSelectedSite = patchedDump.sites[selectedSite] ? selectedSite : sites[0] || ''

  return { status: 'ready', dump: patchedDump, selectedSite: effectiveSelectedSite, selectedRange, setSelectedSite, setSelectedRange, loadCustomRange, tableRows, lineData, lineConfig }
}

function Controls({ dump, selectedSite, selectedRange, setSelectedSite, setSelectedRange, onCustomRange }: { dump: Dump; selectedSite: string; selectedRange: RangeKey; setSelectedSite: (site: string) => void; setSelectedRange: (range: RangeKey) => void; onCustomRange: (from: string, to: string) => Promise<void> }) {
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [error, setError] = React.useState('')
  const sites = Object.keys(dump.sites).sort((a, b) => dump.sites[b].count - dump.sites[a].count)

  return (
    <Card className="analytics-card">
      <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
        <select className="h-10 rounded-md border bg-background px-3" value={selectedSite} onChange={(event) => setSelectedSite(event.target.value)}>
          {sites.map((site) => <option key={site} value={site}>{site}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3" value={selectedRange} onChange={(event) => setSelectedRange(event.target.value as RangeKey)}>
          {ranges.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
          {selectedRange === 'daterange' ? <option value="daterange">Custom range</option> : null}
        </select>
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button variant="outline" onClick={() => from && to && onCustomRange(from, to).catch((err) => setError(err instanceof Error ? err.message : 'Failed to load range'))}>Load range</Button>
        {error ? <Alert variant="destructive" className="md:col-span-4"><AlertTitle>Custom range failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>
  )
}

function SiteTable({ table, selectedSite, onSelectSite }: { table: ReturnType<typeof useReactTable<SiteRow>>; selectedSite: string; onSelectSite: (site: string) => void }) {
  return (
    <Table>
      <TableHeader>{table.getHeaderGroups().map((group) => <TableRow key={group.id}>{group.headers.map((header) => <TableHead key={header.id}><button className="flex items-center gap-2 text-left" onClick={header.column.getToggleSortingHandler()} type="button">{flexRender(header.column.columnDef.header, header.getContext())}<ArrowDownUp aria-hidden="true" /></button></TableHead>)}</TableRow>)}</TableHeader>
      <TableBody>{table.getRowModel().rows.map((row) => <TableRow key={row.id} data-state={row.original.site === selectedSite ? 'selected' : undefined} className="cursor-pointer" onClick={() => onSelectSite(row.original.site)}>{row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}</TableRow>)}</TableBody>
    </Table>
  )
}

function PiePanel({ title, data }: { title: string; data: Slice[] }) {
  const config = data.reduce((acc, item) => ({ ...acc, [item.key]: { label: item.name, color: item.fill } }), {} as ChartConfig)
  return (
    <Card className="analytics-card">
      <CardHeader><CardDescription>{title}</CardDescription><CardTitle>{data.length ? formatNumber(sum(data.map((item) => item.value))) : 'No data'}</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[260px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={2}>{data.map((item) => <Cell key={item.key} fill={item.fill} />)}</Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap gap-2 text-xs" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function ShareActions({ dump }: { dump: Dump }) {
  const [error, setError] = React.useState('')
  const baseUrl = `${window.location.origin}/app-next/`
  const shareLink = `${baseUrl}?user=${encodeURIComponent(dump.user.id)}&token=${encodeURIComponent(dump.user.token)}`
  if (dump.meta.sessionless) return <Badge variant="secondary"><Eye aria-hidden="true" /> Viewing {dump.user.id} as guest</Badge>
  return (
    <div className="flex flex-wrap gap-2">
      {dump.user.token ? <Button variant="outline" onClick={() => copyText(shareLink).catch((err) => setError(err instanceof Error ? err.message : 'Copy failed'))}><Eye data-icon="inline-start" /> Copy guest URL</Button> : <Button variant="outline" onClick={() => postAndReload('/resettoken').catch((err) => setError(err.message))}><EyeOff data-icon="inline-start" /> Enable guest access</Button>}
      {dump.user.token ? <Button variant="ghost" onClick={() => postAndReload('/deletetoken').catch((err) => setError(err.message))}>Remove guest access</Button> : null}
      <Button asChild><a href="#tracking-code"><Plus data-icon="inline-start" /> Add website</a></Button>
      {error ? <Alert variant="destructive" className="basis-full"><AlertTitle>Action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    </div>
  )
}

function TrackingCode({ uuid }: { uuid: string }) {
  const server = window.location.origin
  const code = `<script src="${server}/script.js" data-id="${uuid}" data-utcoffset="${getUTCOffset()}" data-server="${server}"></script>`
  return <Card id="tracking-code"><CardHeader><CardDescription>Add website</CardDescription><CardTitle>Tracking code</CardTitle></CardHeader><CardContent><pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs"><code>{code}</code></pre></CardContent></Card>
}

function VisitLogs({ logs }: { logs: Record<string, number> }) {
  return <Card><CardHeader><CardDescription>Recent visits</CardDescription><CardTitle>{Object.keys(logs).length} log entries</CardTitle></CardHeader><CardContent className="flex max-h-72 flex-col gap-2 overflow-auto text-sm text-muted-foreground">{Object.entries(logs).sort((a, b) => b[1] - a[1]).map(([log, ts]) => <div key={`${log}-${ts}`} className="rounded-md border p-2">{log}</div>)}</CardContent></Card>
}

function DeleteSite({ site }: { site: string }) {
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState('')
  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="destructive"><Settings data-icon="inline-start" /> Delete site</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {site} permanently?</DialogTitle>
          <DialogDescription>This removes hot visit data, archive records, and logs for this site. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-site">Type the domain to confirm</Label>
          <Input id="confirm-site" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder={site} />
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={confirm !== site} onClick={() => { const form = new FormData(); form.set('site', site); form.set('confirmSite', confirm); fetch('/deletesite', { method: 'POST', body: form }).then((response) => { if (!response.ok) throw new Error('Delete failed'); window.location.href = '/dashboard' }).catch((err) => setError(err instanceof Error ? err.message : 'Delete failed')) }}>Delete permanently</Button>
        </DialogFooter>
        {error ? <Alert variant="destructive"><AlertTitle>Delete failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      </DialogContent>
    </Dialog>
  )
}

function StateScreen({ title, detail, action, tone = 'default' }: { title: string; detail: string; action?: React.ReactNode; tone?: 'default' | 'error' | 'loading' }) {
  return <main className="flex min-h-[70vh] items-center justify-center p-6"><Card className="max-w-xl"><CardHeader><CardTitle className="text-3xl">{title}</CardTitle><CardDescription>{detail}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><Alert variant={tone === 'error' ? 'destructive' : 'default'}><AlertTitle>{tone === 'loading' ? 'Live connection' : 'Status'}</AlertTitle><AlertDescription>{detail}</AlertDescription></Alert>{action}</CardContent></Card></main>
}

function AuthScreen() {
  return <main className="flex min-h-[80vh] items-center justify-center p-6"><Card className="w-full max-w-xl"><CardHeader><CardTitle className="text-4xl">Welcome back</CardTitle><CardDescription>Sign in or create a Counter account without leaving the SPA.</CardDescription></CardHeader><CardContent><Tabs defaultValue="login"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="login">Login</TabsTrigger><TabsTrigger value="register">Register</TabsTrigger></TabsList><TabsContent value="login"><AuthForm endpoint="/login" submitLabel="Login" redirectTo="/app-next/" /></TabsContent><TabsContent value="register"><AuthForm endpoint="/register" submitLabel="Create account" redirectTo="/app-next/" includeMail /></TabsContent></Tabs></CardContent></Card></main>
}

function AuthForm({ endpoint, submitLabel, redirectTo, includeMail = false }: { endpoint: string; submitLabel: string; redirectTo: string; includeMail?: boolean }) {
  const [error, setError] = React.useState('')
  return <form className="mt-4 flex flex-col gap-4" onSubmit={async (event) => { event.preventDefault(); setError(''); const form = new FormData(event.currentTarget); form.set('utcoffset', getUTCOffset()); const response = await fetch(endpoint, { method: 'POST', body: form, credentials: 'include' }); if (response.ok) window.location.href = redirectTo; else setError(await response.text()) }}><div className="flex flex-col gap-2"><Label htmlFor={`${endpoint}-user`}>User</Label><Input id={`${endpoint}-user`} name="user" required /></div>{includeMail ? <div className="flex flex-col gap-2"><Label htmlFor="mail">Email</Label><Input id="mail" name="mail" type="email" /></div> : null}<div className="flex flex-col gap-2"><Label htmlFor={`${endpoint}-password`}>Password</Label><Input id={`${endpoint}-password`} name="password" type="password" required /></div>{error ? <Alert variant="destructive"><AlertTitle>Request failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}<Button>{submitLabel}</Button></form>
}

function SetupScreen({ uuid }: { uuid: string }) {
  return <main className="grid min-h-[80vh] place-items-center p-6"><div className="grid w-full max-w-5xl gap-4 lg:grid-cols-2"><StateScreen title="Install your tracking code" detail="Add this snippet to your site, then visit the site once. Counter will redirect to the dashboard when visits arrive." action={<Button onClick={() => window.location.reload()}>Check again</Button>} /><TrackingCode uuid={uuid} /></div></main>
}

function CounterCard({ label, value, comparison }: { label: string; value: number; comparison: { trend: string; percent: string } }) {
  return <Card><CardHeader><CardDescription>{label}</CardDescription><CardTitle className="text-3xl">{formatNumber(value)}</CardTitle></CardHeader><CardContent><Badge variant={comparison.trend === 'negative' ? 'destructive' : 'secondary'}>{comparison.percent || 'stable'}</Badge></CardContent></Card>
}

function DynamicsPanel({ dates }: { dates: Record<string, number> }) { const grouped = groupDates(dates); const vals = grouped.values; const trend = vals.length < 3 ? { title: 'Good stability', detail: 'Not enough data for a trend.' } : trendSummary(vals); return <Card><CardHeader><CardDescription>Dynamics</CardDescription><CardTitle>{trend.title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{trend.detail}</CardContent></Card> }
function BarListPanel({ title, data }: { title: string; data: Record<string, number> }) { const max = Math.max(1, ...Object.values(data)); return <Card><CardHeader><CardDescription>{title}</CardDescription><CardTitle>{formatNumber(sumObject(data))}</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{Object.entries(data).slice(0, 12).map(([key, value]) => <div className="grid grid-cols-[5rem_1fr_4rem] items-center gap-2 text-sm" key={key}><span className="truncate text-muted-foreground">{key}</span><span className="h-2 rounded-full bg-muted"><span className="block h-2 rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} /></span><span className="text-right font-mono">{value}</span></div>)}</CardContent></Card> }

function patchDump(dump: Dump, archives: Record<string, Record<string, VisitsData>>, customRange: Record<string, VisitsData>): Dump {
  const next = cloneDump(dump)
  for (const site of Object.keys(next.sites)) {
    const visits = next.sites[site].visits ?? emptyTimedVisits()
    next.sites[site].visits = visits
    visits.last7 = patchVisit(mergeVisits([visits.day, visits.yesterday, archives['-7:-2']?.[site] ?? emptyVisitData()]))
    visits.last30 = patchVisit(mergeVisits([visits.day, visits.yesterday, archives['-30:-2']?.[site] ?? emptyVisitData()]))
    visits.daterange = patchVisit(customRange[site] ?? emptyVisitData())
  }
  return next
}

function makeTableRows(dump: Dump, range: RangeKey): SiteRow[] {
  return Object.entries(dump.sites).map(([site, value], index) => {
    const visits = (value.visits ?? emptyTimedVisits())[range] ?? emptyVisitData()
    return { site, total: countTotal(visits), search: countMatchingRefs(visits, searchEngines), social: countMatchingRefs(visits, socialSites), direct: countDirect(visits), color: colors[index % colors.length] }
  })
}

function makeLineData(dump: Dump, range: RangeKey): LinePoint[] {
  const groupedBySite = Object.fromEntries(Object.entries(dump.sites).map(([site, siteDump]) => [site, graphSeries((siteDump.visits ?? emptyTimedVisits())[range] ?? emptyVisitData(), range)]))
  const buckets = new Set<string>()
  for (const grouped of Object.values(groupedBySite)) grouped.labels.forEach((label) => buckets.add(label))
  return Array.from(buckets).map((bucket) => {
    const point: LinePoint = { bucket }
    for (const [site, grouped] of Object.entries(groupedBySite)) point[siteKey(site)] = grouped.map[bucket] ?? 0
    return point
  })
}

function makeLineConfig(dump: Dump): ChartConfig {
  return Object.keys(dump.sites).reduce((acc, site, index) => ({ ...acc, [siteKey(site)]: { label: site, color: colors[index % colors.length] } }), {} as ChartConfig)
}

function mergeVisits(visits: VisitsData[]): VisitsData {
  const result: VisitsData = {}
  for (const visit of visits) for (const [dimension, values] of Object.entries(visit ?? {})) for (const [key, count] of Object.entries(values ?? {})) result[dimension] = { ...(result[dimension] ?? {}), [key]: (result[dimension]?.[key] ?? 0) + count }
  return result
}

function patchVisit(visit: VisitsData): VisitsData { return { ...emptyVisitData(), ...visit, ref: visit.ref ?? {} } }
function emptyVisitData(): VisitsData { return { date: {}, hour: {}, weekday: {}, ref: {}, country: {}, device: {}, platform: {}, browser: {}, lang: {}, screen: {}, page: {} } }
function emptyTimedVisits(): TimedVisits { return { day: emptyVisitData(), yesterday: emptyVisitData(), last7: emptyVisitData(), last30: emptyVisitData(), month: emptyVisitData(), year: emptyVisitData(), all: emptyVisitData(), daterange: emptyVisitData() } }
function toSlices(values: Record<string, number> = {}): Slice[] { return Object.entries(groupData(values, 7)).sort((a, b) => b[1] - a[1]).map(([name, value], index) => ({ name, value, key: siteKey(name), fill: colors[index % colors.length] })) }
function groupData(values: Record<string, number>, limit: number) { const entries = Object.entries(values).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]); const top = entries.slice(0, limit); const other = sum(entries.slice(limit).map(([, value]) => value)); return Object.fromEntries(other ? [...top, ['Other', other]] : top) }
function sumObject(values: Record<string, number> = {}) { return sum(Object.values(values)) }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0) }
function formatNumber(value: number) { return new Intl.NumberFormat('en').format(value) }
function siteKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'value' }
function selectedRangeLabel(range: RangeKey) { return ranges.find((item) => item.value === range)?.label ?? 'Custom range' }
function getUTCOffset() { return String(Math.round(-new Date().getTimezoneOffset() / 60)) }
function hourLabel(hour: string) { const parsed = Number(hour); if (Number.isNaN(parsed)) return hour; if (parsed === 0) return '12 a.m.'; if (parsed === 12) return '12 noon'; return parsed < 12 ? `${parsed} a.m.` : `${parsed - 12} p.m.` }
function downloadCSV(site: string, range: RangeKey, data: VisitsData) { const rows = ['dimension,type,count']; for (const [dimension, values] of Object.entries(data)) for (const [type, count] of Object.entries(values)) rows.push(`${dimension},${JSON.stringify(type)},${count}`); const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `counter_stats_${range}_${new Date().toISOString().slice(0, 10)}_${site.replace('.', '-')}.csv`; link.click(); URL.revokeObjectURL(url) }

function countTotal(visits: VisitsData) { return sumObject(visits.date ?? {}) }
function countDirect(visits: VisitsData) { return countTotal(visits) - sumObject(visits.ref ?? {}) }
function countMatchingRefs(visits: VisitsData, domains: Set<string>) { return Object.entries(visits.ref ?? {}).reduce((total, [ref, count]) => total + (domains.has(topLevelDomain(ref)) ? count : 0), 0) }
function topLevelDomain(ref: string) { return /(?:www\.){0,1}([-\w]+\.(?:[-\w]+\.xn--[-\w]+|[-\w]{2,}|[-\w]+\.[-\w]{2})$)/i.exec(ref)?.[1] ?? ref }
function counterTrend(allVisits: TimedVisits, range: RangeKey, counter: (visits: VisitsData) => number) { const next = ({ day: 'yesterday', yesterday: 'last7', last7: 'last30', last30: 'all', month: 'year', year: 'all', all: 'all', daterange: 'all' } as Record<RangeKey, RangeKey>)[range]; const count = counter(allVisits[range] ?? emptyVisitData()); const nextCount = counter(allVisits[next] ?? emptyVisitData()); const percent = Math.round((count / Math.max(1, nextCount) - 1) * 100); return { trend: percent < 0 ? 'negative' : percent > 0 ? 'positive' : 'stability', percent: percent === 0 ? '' : `${Math.abs(percent)}%` } }
function graphSeries(visits: VisitsData, range: RangeKey) { let grouped = groupDates(visits.date ?? {}); if (grouped.labels.length === 1 || range === 'yesterday' || range === 'day') { const hours = normalizeHours(visits.hour ?? {}); return { labels: Object.keys(hours), map: hours } } return { labels: grouped.labels, map: Object.fromEntries(grouped.labels.map((label, index) => [label, grouped.values[index] ?? 0])) } }
function groupDates(dates: Record<string, number>) { const entries = Object.entries(dates).sort(([a], [b]) => a.localeCompare(b)); const groupedByWeek: Record<string, number> = {}; const groupedByMonth: Record<string, number> = {}; const groupedByYear: Record<string, number> = {}; for (const [date, value] of entries) { const d = new Date(`${date}T00:00:00Z`); const week = `CW${weekNumber(d)}`; const month = d.toLocaleString('en', { month: entries.length <= 366 ? 'long' : 'short', year: entries.length > 366 ? 'numeric' : undefined, timeZone: 'UTC' }); const year = String(d.getUTCFullYear()); groupedByWeek[week] = (groupedByWeek[week] ?? 0) + value; groupedByMonth[month] = (groupedByMonth[month] ?? 0) + value; groupedByYear[year] = (groupedByYear[year] ?? 0) + value } let grouped = Object.fromEntries(entries); if (Object.keys(grouped).length > 31) grouped = groupedByWeek; if (Object.keys(grouped).length > 16) grouped = groupedByMonth; if (Object.keys(grouped).length > 32) grouped = groupedByYear; return { labels: Object.keys(grouped), values: Object.values(grouped) } }
function weekNumber(date: Date) { const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) }
function normalizeHours(hours: Record<string, number>) { return Object.fromEntries(Array.from({ length: 24 }, (_, hour) => [hourLabel(String(hour)), hours[String(hour)] ?? 0])) }
function trendSummary(vals: number[]) { const prev = vals[vals.length - 2] ?? 0; const prevPrev = vals[vals.length - 3] ?? 0; if (prevPrev + prev <= 2) return { title: 'Good stability', detail: 'Only a few data points in the previous buckets.' }; const percent = Math.round((prev / Math.max(1, prevPrev) - 1) * 100); if (percent > 10) return { title: 'Positive dynamics', detail: `${percent}% growth compared with the previous bucket.` }; if (percent < -10) return { title: 'Negative dynamics', detail: `${Math.abs(percent)}% decline compared with the previous bucket.` }; return { title: 'Good stability', detail: 'Traffic is stable compared with the previous bucket.' } }

function normalizeDumpPayload(payload: unknown): Dump {
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

function normalizeArchivePayload(payload: unknown): Record<string, Record<string, VisitsData>> {
  const raw = isRecord(payload) ? payload : {}
  const result: Record<string, Record<string, VisitsData>> = {}
  for (const [range, sites] of Object.entries(raw)) result[range] = normalizeCustomRangePayload(sites)
  return result
}

function normalizeCustomRangePayload(payload: unknown): Record<string, VisitsData> {
  const raw = isRecord(payload) ? payload : {}
  const result: Record<string, VisitsData> = {}
  for (const [site, visits] of Object.entries(raw)) result[site] = normalizeVisitsData(visits)
  return result
}

function normalizeTimedVisits(payload: unknown): TimedVisits {
  const raw = isRecord(payload) ? payload : {}
  const visits = emptyTimedVisits()
  for (const range of ['day', 'yesterday', 'last7', 'last30', 'month', 'year', 'all', 'daterange'] as RangeKey[]) visits[range] = normalizeVisitsData(raw[range])
  return visits
}

function normalizeVisitsData(payload: unknown): VisitsData {
  const raw = isRecord(payload) ? payload : {}
  const visits = emptyVisitData()
  for (const [dimension, values] of Object.entries(raw)) visits[dimension] = normalizeNumberMap(values)
  return visits
}

function normalizeNumberMap(payload: unknown): Record<string, number> {
  const raw = isRecord(payload) ? payload : {}
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, toNumber(value)]).filter(([, value]) => Number.isFinite(value)))
}

function normalizeStringMap(payload: unknown): Record<string, string> {
  const raw = isRecord(payload) ? payload : {}
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, toString(value)]))
}

function cloneDump(dump: Dump): Dump {
  return normalizeDumpPayload(JSON.parse(JSON.stringify(dump)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value) || 0
}

function persistPreference(url: string, setError: (message: string) => void) {
  fetch(url).then((response) => {
    if (!response.ok) throw new Error('Preference save failed')
  }).catch((err) => setError(err instanceof Error ? err.message : 'Preference save failed'))
}

async function postAndReload(url: string) {
  const response = await fetch(url, { method: 'POST' })
  if (!response.ok) throw new Error('Request failed')
  window.location.reload()
}

async function copyText(value: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value)
    return
  }
  throw new Error('Clipboard is unavailable in this browser')
}
