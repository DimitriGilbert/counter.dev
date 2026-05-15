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

import type { RangeKey, ReadyDashboard, SiteRow, Slice, VisitsData, Dump } from '@/lib/types'
import { ranges, piePanels, searchEngines, socialSites, colors } from '@/lib/constants'
import {
  formatNumber,
  siteKey,
  getUTCOffset,
  sumObject,
  sum,
  countTotal,
  countDirect,
  countMatchingRefs,
  counterTrend,
  toSlices,
  normalizeHours,
  downloadCSV,
  trendSummary,
  groupDates,
  postAndReload,
  copyText,
  emptyVisitData,
  emptyTimedVisits,
} from '@/lib/analytics'
import { useCounterDump } from '@/hooks/use-counter-dump'

export const Route = createFileRoute('/')({
  component: Dashboard,
  errorComponent: ({ error }) => (
    <StateScreen
      title="Dashboard failed"
      detail={error instanceof Error ? error.message : 'An unexpected error occurred.'}
      tone="error"
      action={<Button onClick={() => window.location.reload()}>Reload</Button>}
    />
  ),
})

const columnHelper = createColumnHelper<SiteRow>()

const columns = [
  columnHelper.accessor('site', {
    header: 'Site',
    cell: ({ row }) => (
      <div className="flex items-center gap-2.5">
        <span className="size-2 rounded-full" style={{ backgroundColor: row.original.color }} />
        <span className="font-medium text-sm">{row.original.site}</span>
      </div>
    ),
  }),
  columnHelper.accessor('total', {
    header: 'Total',
    cell: (info) => <span className="font-mono text-sm tabular-nums">{formatNumber(info.getValue())}</span>,
  }),
  columnHelper.accessor('search', {
    header: 'Search',
    cell: (info) => <span className="font-mono text-sm tabular-nums">{formatNumber(info.getValue())}</span>,
  }),
  columnHelper.accessor('social', {
    header: 'Social',
    cell: (info) => <span className="font-mono text-sm tabular-nums">{formatNumber(info.getValue())}</span>,
  }),
  columnHelper.accessor('direct', {
    header: 'Direct',
    cell: (info) => <span className="font-mono text-sm tabular-nums">{formatNumber(info.getValue())}</span>,
  }),
]

function Dashboard() {
  const dashboard = useCounterDump()

  if (dashboard.status === 'connecting') {
    return <DashboardSkeleton />
  }

  if (dashboard.status === 'nouser') {
    return <AuthScreen />
  }

  if (dashboard.status === 'error') {
    return (
      <StateScreen
        title="Stream disconnected"
        detail={dashboard.error ?? 'The live event stream failed.'}
        tone="error"
        action={<Button onClick={() => window.location.reload()}>Reconnect</Button>}
      />
    )
  }

  return <ReadyDashboardView dashboard={dashboard} />
}

function ReadyDashboardView({ dashboard }: { dashboard: ReadyDashboard }) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'total', desc: true }])
  const {
    dump, selectedSite, selectedRange,
    setSelectedSite, setSelectedRange,
    lineData, lineConfig, tableRows,
    loadCustomRange,
  } = dashboard
  const siteNames = Object.keys(dump.sites)
  const effectiveSite = dump.sites[selectedSite] ? selectedSite : siteNames[0]
  const siteDump = effectiveSite ? dump.sites[effectiveSite] : undefined
  const siteVisits = siteDump?.visits ?? emptyTimedVisits()
  const rangeData = siteVisits[selectedRange] ?? emptyVisitData()

  const table = useReactTable({
    data: tableRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (!siteNames.length || !effectiveSite || !siteDump) {
    return <SetupScreen uuid={dump.user.uuid} />
  }

  const totalVisits = countTotal(rangeData)
  const sortedSites = Object.keys(dump.sites).sort(
    (a, b) => dump.sites[b].count - dump.sites[a].count,
  )

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: site list */}
        <aside className="flex flex-col gap-1 lg:sticky lg:top-[57px] lg:h-[calc(100dvh-57px)] lg:overflow-y-auto lg:pb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Sites
            </h2>
            <ShareActions dump={dump} compact />
          </div>

          <nav className="flex flex-col gap-0.5">
            {sortedSites.map((site) => {
              const isActive = site === effectiveSite
              const siteCount = dump.sites[site].count
              return (
                <button
                  key={site}
                  onClick={() => setSelectedSite(site)}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      isActive ? 'bg-primary-foreground/60' : ''
                    }`}
                    style={!isActive ? { backgroundColor: colors[sortedSites.indexOf(site) % colors.length] } : undefined}
                  />
                  <span className="flex-1 truncate font-medium">{site}</span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}
                  >
                    {formatNumber(siteCount)}
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="mt-4 border-t border-border/40 pt-4">
            <SiteTable table={table} selectedSite={effectiveSite} onSelectSite={setSelectedSite} />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Range selector bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{effectiveSite}</h1>
              <p className="text-sm text-muted-foreground">
                {selectedRangeLabel(selectedRange)} &middot; {formatNumber(totalVisits)} visits
              </p>
            </div>
            <RangeBar
              selectedRange={selectedRange}
              setSelectedRange={setSelectedRange}
              loadCustomRange={loadCustomRange}
            />
          </div>

          {/* KPI row */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Visits"
              value={countTotal(rangeData)}
              comparison={counterTrend(siteVisits, selectedRange, countTotal)}
            />
            <MetricCard
              label="Search"
              value={countMatchingRefs(rangeData, searchEngines)}
              comparison={counterTrend(siteVisits, selectedRange, (v) => countMatchingRefs(v, searchEngines))}
            />
            <MetricCard
              label="Social"
              value={countMatchingRefs(rangeData, socialSites)}
              comparison={counterTrend(siteVisits, selectedRange, (v) => countMatchingRefs(v, socialSites))}
            />
            <MetricCard
              label="Direct"
              value={countDirect(rangeData)}
              comparison={counterTrend(siteVisits, selectedRange, countDirect)}
            />
          </div>

          {/* Line chart */}
          <Card className="border-border/40 shadow-none">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">
                Visit trends
              </CardDescription>
              <CardTitle className="text-base font-medium">
                All sites &middot; {selectedRangeLabel(selectedRange)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={lineConfig} className="h-[320px] w-full">
                <LineChart accessibilityLayer data={lineData} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid vertical={false} stroke="oklch(0.92 0.004 260)" />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fontSize: 11, fontFamily: "'Geist Mono', monospace" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 11, fontFamily: "'Geist Mono', monospace" }}
                  />
                  <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {Object.keys(dump.sites).map((site) => (
                    <Line
                      key={site}
                      type="monotone"
                      dataKey={siteKey(site)}
                      stroke={`var(--color-${siteKey(site)})`}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Secondary panels */}
          <div className="grid gap-3 lg:grid-cols-3">
            <DynamicsPanel dates={rangeData.date ?? {}} />
            <BarListPanel title="Hours" data={normalizeHours(rangeData.hour ?? {})} />
            <BarListPanel title="Weekdays" data={rangeData.weekday ?? {}} />
          </div>

          {/* Pie charts */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {piePanels.map(([dimension, title]) => (
              <PiePanel
                key={`${effectiveSite}-${selectedRange}-${dimension}`}
                title={title}
                data={toSlices(rangeData[dimension])}
              />
            ))}
          </div>

          {/* Bottom actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/40 pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-muted-foreground"
                onClick={() => downloadCSV(effectiveSite, selectedRange, rangeData)}
              >
                <Download size={14} />
                <span className="ml-1.5">CSV</span>
              </Button>
              {!dump.meta.sessionless ? <DeleteSite site={effectiveSite} /> : null}
            </div>
            <ShareActions dump={dump} />
          </div>

          {/* Bottom cards */}
          <div className="grid gap-3 lg:grid-cols-2">
            <TrackingCode uuid={dump.user.uuid} />
            <VisitLogs logs={siteDump.logs} />
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 py-6">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-2">
          <div className="skeleton h-4 w-12" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </aside>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="skeleton h-8 w-32" />
            <div className="skeleton h-8 w-64" />
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          <div className="skeleton h-[320px] w-full" />
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, comparison }: {
  label: string
  value: number
  comparison: { trend: string; percent: string }
}) {
  const isPositive = comparison.trend === 'positive'
  const isNegative = comparison.trend === 'negative'
  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 transition-shadow hover:shadow-sm">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
        {formatNumber(value)}
      </p>
      {comparison.percent && (
        <span
          className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
            isPositive
              ? 'bg-accent/15 text-accent'
              : isNegative
                ? 'bg-destructive/15 text-destructive'
                : 'bg-secondary text-muted-foreground'
          }`}
        >
          {isPositive ? '+' : ''}{comparison.percent}
        </span>
      )}
    </div>
  )
}

function RangeBar({ selectedRange, setSelectedRange, loadCustomRange }: {
  selectedRange: RangeKey
  setSelectedRange: (r: RangeKey) => void
  loadCustomRange: (from: string, to: string) => Promise<void>
}) {
  const [showCustom, setShowCustom] = React.useState(false)
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [error, setError] = React.useState('')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {ranges.map((range) => (
          <button
            key={range.value}
            onClick={() => { setSelectedRange(range.value); setShowCustom(false) }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
              selectedRange === range.value && !showCustom
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {range.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
            showCustom
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              if (!from || !to) return
              loadCustomRange(from, to).catch((err) =>
                setError(err instanceof Error ? err.message : 'Failed'),
              )
            }}
          >
            Apply
          </Button>
          {error && (
            <Alert variant="destructive" className="flex-1 py-1.5 text-xs">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}

function SiteTable({ table, selectedSite, onSelectSite }: {
  table: ReturnType<typeof useReactTable<SiteRow>>
  selectedSite: string
  onSelectSite: (site: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => (
              <TableHead key={header.id} className="text-xs">
                <button
                  className="flex items-center gap-1 text-left"
                  onClick={header.column.getToggleSortingHandler()}
                  type="button"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <ArrowDownUp size={10} className="text-muted-foreground" />
                </button>
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-state={row.original.site === selectedSite ? 'selected' : undefined}
            className="cursor-pointer text-xs"
            onClick={() => onSelectSite(row.original.site)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PiePanel({ title, data }: { title: string; data: Slice[] }) {
  const config = data.reduce(
    (acc, item) => ({ ...acc, [item.key]: { label: item.name, color: item.fill } }),
    {} as ChartConfig,
  )
  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader className="pb-1">
        <CardDescription className="text-xs uppercase tracking-widest">{title}</CardDescription>
        <CardTitle className="font-mono text-base tabular-nums">
          {data.length ? formatNumber(sum(data.map((d) => d.value))) : 'No data'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[220px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={78}
              paddingAngle={2}
            >
              {data.map((item) => (
                <Cell key={item.key} fill={item.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" className="flex-wrap gap-1.5 text-[10px]" />}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function DynamicsPanel({ dates }: { dates: Record<string, number> }) {
  const grouped = groupDates(dates)
  const vals = grouped.values
  const trend = vals.length < 3
    ? { title: 'Good stability', detail: 'Not enough data for a trend.' }
    : trendSummary(vals)

  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader className="pb-1">
        <CardDescription className="text-xs uppercase tracking-widest">Dynamics</CardDescription>
        <CardTitle className="text-base font-medium">{trend.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{trend.detail}</p>
      </CardContent>
    </Card>
  )
}

function BarListPanel({ title, data }: { title: string; data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data))
  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader className="pb-1">
        <CardDescription className="text-xs uppercase tracking-widest">{title}</CardDescription>
        <CardTitle className="font-mono text-base tabular-nums">
          {formatNumber(sumObject(data))}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {Object.entries(data).slice(0, 12).map(([key, value]) => (
          <div className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2" key={key}>
            <span className="truncate text-xs text-muted-foreground">{key}</span>
            <span className="h-1.5 rounded-full bg-muted">
              <span
                className="block h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${(value / max) * 100}%`,
                  backgroundColor: 'oklch(from var(--accent) l c h)',
                }}
              />
            </span>
            <span className="text-right font-mono text-xs tabular-nums">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ShareActions({ dump, compact }: { dump: Dump; compact?: boolean }) {
  const [error, setError] = React.useState('')
  const baseUrl = `${window.location.origin}/app-next/`
  const shareLink = `${baseUrl}?user=${encodeURIComponent(dump.user.id)}&token=${encodeURIComponent(dump.user.token)}`

  if (dump.meta.sessionless) {
    return (
      <Badge variant="secondary" className="text-xs font-normal">
        <Eye size={12} className="mr-1" />
        {compact ? dump.user.id : `Viewing ${dump.user.id} as guest`}
      </Badge>
    )
  }

  if (compact) {
    return (
      <Button asChild size="sm" variant="outline" className="h-7 text-xs">
        <a href="#tracking-code"><Plus size={12} className="mr-1" />Add</a>
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {dump.user.token ? (
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground"
          onClick={() => copyText(shareLink).catch((err) =>
            setError(err instanceof Error ? err.message : 'Copy failed'),
          )}
        >
          <Eye size={14} />
          <span className="ml-1.5">Guest URL</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground"
          onClick={() => postAndReload('/resettoken').catch((err) => setError(err.message))}
        >
          <EyeOff size={14} />
          <span className="ml-1.5">Enable guest</span>
        </Button>
      )}
      {dump.user.token && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => postAndReload('/deletetoken').catch((err) => setError(err.message))}
        >
          Remove guest
        </Button>
      )}
      {error && (
        <Alert variant="destructive" className="basis-full">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function TrackingCode({ uuid }: { uuid: string }) {
  const server = window.location.origin
  const code = `<script src="${server}/script.js" data-id="${uuid}" data-utcoffset="${getUTCOffset()}" data-server="${server}"></script>`
  return (
    <Card id="tracking-code" className="border-border/40 shadow-none">
      <CardHeader className="pb-1">
        <CardDescription className="text-xs uppercase tracking-widest">Add website</CardDescription>
        <CardTitle className="text-base font-medium">Tracking code</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-300">
          <code>{code}</code>
        </pre>
      </CardContent>
    </Card>
  )
}

function VisitLogs({ logs }: { logs: Record<string, number> }) {
  const entries = Object.entries(logs).sort((a, b) => b[1] - a[1])
  return (
    <Card className="border-border/40 shadow-none">
      <CardHeader className="pb-1">
        <CardDescription className="text-xs uppercase tracking-widest">Recent visits</CardDescription>
        <CardTitle className="font-mono text-base tabular-nums">
          {entries.length} log entries
        </CardTitle>
      </CardHeader>
      <CardContent className="flex max-h-56 flex-col gap-1.5 overflow-auto">
        {entries.map(([log, ts]) => (
          <div
            key={`${log}-${ts}`}
            className="rounded-md border border-border/40 px-2.5 py-1.5 font-mono text-xs text-muted-foreground"
          >
            {log}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DeleteSite({ site }: { site: string }) {
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState('')
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          <Settings size={14} />
          <span className="ml-1.5">Delete</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {site} permanently?</DialogTitle>
          <DialogDescription>
            This removes hot visit data, archive records, and logs for this site.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-site">Type the domain to confirm</Label>
          <Input
            id="confirm-site"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={site}
          />
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={confirm !== site}
            onClick={() => {
              const form = new FormData()
              form.set('site', site)
              form.set('confirmSite', confirm)
              fetch('/deletesite', { method: 'POST', body: form })
                .then((response) => {
                  if (!response.ok) throw new Error('Delete failed')
                  window.location.href = '/dashboard'
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : 'Delete failed'),
                )
            }}
          >
            Delete permanently
          </Button>
        </DialogFooter>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Delete failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StateScreen({ title, detail, action, tone = 'default' }: {
  title: string
  detail: string
  action?: React.ReactNode
  tone?: 'default' | 'error' | 'loading'
}) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="max-w-md border-border/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          <CardDescription className="text-sm">{detail}</CardDescription>
        </CardHeader>
        {action && <CardContent className="flex flex-col gap-3">{action}</CardContent>}
      </Card>
    </main>
  )
}

function AuthScreen() {
  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <Card className="w-full max-w-md border-border/40 shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">Welcome back</CardTitle>
          <CardDescription>Sign in or create a Counter account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <AuthForm endpoint="/login" submitLabel="Login" redirectTo="/app-next/" />
            </TabsContent>
            <TabsContent value="register">
              <AuthForm endpoint="/register" submitLabel="Create account" redirectTo="/app-next/" includeMail />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  )
}

function AuthForm({ endpoint, submitLabel, redirectTo, includeMail = false }: {
  endpoint: string
  submitLabel: string
  redirectTo: string
  includeMail?: boolean
}) {
  const [error, setError] = React.useState('')
  return (
    <form
      className="mt-4 flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        setError('')
        const form = new FormData(event.currentTarget)
        form.set('utcoffset', getUTCOffset())
        const response = await fetch(endpoint, {
          method: 'POST',
          body: form,
          credentials: 'include',
        })
        if (response.ok) {
          window.location.href = redirectTo
        } else {
          setError(await response.text())
        }
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${endpoint}-user`}>User</Label>
        <Input id={`${endpoint}-user`} name="user" required />
      </div>
      {includeMail && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="mail">Email</Label>
          <Input id="mail" name="mail" type="email" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${endpoint}-password`}>Password</Label>
        <Input id={`${endpoint}-password`} name="password" type="password" required />
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button>{submitLabel}</Button>
    </form>
  )
}

function SetupScreen({ uuid }: { uuid: string }) {
  return (
    <main className="flex min-h-[80vh] items-center justify-center p-6">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <StateScreen
          title="Install your tracking code"
          detail="Add this snippet to your site, then visit the site once. Counter will redirect to the dashboard when visits arrive."
          action={<Button onClick={() => window.location.reload()}>Check again</Button>}
        />
        <TrackingCode uuid={uuid} />
      </div>
    </main>
  )
}

function selectedRangeLabel(range: RangeKey) {
  return ranges.find((item) => item.value === range)?.label ?? 'Custom range'
}
