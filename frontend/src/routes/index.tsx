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
import { ArrowDownUp, Download, Eye, EyeOff, Globe, Laptop, Monitor, Plus, Settings, Smartphone, Tablet, Terminal } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { RangeKey, ReadyDashboard, SiteRow, Slice, Dump } from '@/lib/types'
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
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full" style={{ backgroundColor: row.original.color }} />
        <span className="font-medium text-xs">{row.original.site}</span>
      </div>
    ),
  }),
  columnHelper.accessor('total', {
    header: 'Total',
    cell: (info) => <span className="font-mono text-xs tabular-nums">{formatNumber(info.getValue())}</span>,
  }),
  columnHelper.accessor('search', {
    header: 'Search',
    cell: (info) => <span className="font-mono text-xs tabular-nums">{formatNumber(info.getValue())}</span>,
  }),
  columnHelper.accessor('social', {
    header: 'Social',
    cell: (info) => <span className="font-mono text-xs tabular-nums">{formatNumber(info.getValue())}</span>,
  }),
  columnHelper.accessor('direct', {
    header: 'Direct',
    cell: (info) => <span className="font-mono text-xs tabular-nums">{formatNumber(info.getValue())}</span>,
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
    dump, selectedSite, selectedRange, connection,
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
  const searchVisits = countMatchingRefs(rangeData, searchEngines)
  const socialVisits = countMatchingRefs(rangeData, socialSites)
  const directVisits = countDirect(rangeData)

  const primaryPies = ['ref', 'country'] as const
  const secondaryPies = ['lang', 'screen'] as const

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6">
      {/* Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <RangeBar
            selectedRange={selectedRange}
            setSelectedRange={setSelectedRange}
            loadCustomRange={loadCustomRange}
          />
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge status={connection} />
          <ShareActions dump={dump} />
        </div>
      </div>

      {/* ====== OVERVIEW: 2/3 chart | 1/3 table ====== */}
      <section className="mb-8">
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card className="border-border/40 shadow-none pt-4 pb-0 gap-0">
            <div className="px-4 pb-2">
              <span className="text-sm font-medium tracking-tight">
                Visit trends &middot; {selectedRangeLabel(selectedRange)}
              </span>
            </div>
            <div className="px-4 pb-4">
              <ChartContainer config={lineConfig} className="h-[320px] w-full">
                <LineChart accessibilityLayer data={lineData} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
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
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 0 }}
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </div>
          </Card>

          <Card className="border-border/40 shadow-none pt-4 pb-0 gap-0">
            <div className="px-4 pb-2">
              <span className="text-sm font-medium tracking-tight">Site comparison</span>
            </div>
            <div className="px-4 pb-4">
              <SiteTable table={table} selectedSite={effectiveSite} onSelectSite={setSelectedSite} />
            </div>
          </Card>
        </div>
      </section>

      {/* ====== SITE DETAIL ====== */}
      <section>
        {/* Site selector bar */}
        <div className="sticky top-[52px] z-30 -mx-5 mb-5 flex flex-col gap-3 border-b border-border/40 bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Select value={effectiveSite} onValueChange={setSelectedSite}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {siteNames
                  .sort((a, b) => dump.sites[b].count - dump.sites[a].count)
                  .map((site, index) => (
                    <SelectItem key={site} value={site}>
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                        <span>{site}</span>
                        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                          {formatNumber(dump.sites[site].count)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">
              {formatNumber(totalVisits)} <span className="font-sans text-xs">visits</span>
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => downloadCSV(effectiveSite, selectedRange, rangeData)}
            >
              <Download size={12} />
              <span className="ml-1">CSV</span>
            </Button>
            {!dump.meta.sessionless ? <DeleteSite site={effectiveSite} /> : null}
          </div>
        </div>

        {/* 1. KPI row — headline numbers */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Visits"
            value={totalVisits}
            comparison={counterTrend(siteVisits, selectedRange, countTotal)}
          />
          <MetricCard
            label="Direct"
            value={directVisits}
            comparison={counterTrend(siteVisits, selectedRange, countDirect)}
          />
          <MetricCard
            label="Search"
            value={searchVisits}
            comparison={counterTrend(siteVisits, selectedRange, (v) => countMatchingRefs(v, searchEngines))}
          />
          <MetricCard
            label="Social"
            value={socialVisits}
            comparison={counterTrend(siteVisits, selectedRange, (v) => countMatchingRefs(v, socialSites))}
          />
        </div>

        {/* 2. Visited pages — first detail row after headline metrics */}
        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_2fr]">
          <PiePanel
            key={`${effectiveSite}-${selectedRange}-page`}
            title="Visited pages"
            data={toSlices(rangeData.page)}
          />
          <PagesTable data={rangeData.page ?? {}} />
        </div>

        {/* 3. Recent visits + acquisition/location breakdowns */}
        <div className="mb-5 grid gap-3 lg:grid-cols-3">
          <VisitLogs logs={siteDump.logs} />
          {primaryPies.map((dimension) => {
            const panel = piePanels.find(([d]) => d === dimension)
            return (
              <PiePanel
                key={`${effectiveSite}-${selectedRange}-${dimension}`}
                title={panel?.[1] ?? dimension}
                data={toSlices(rangeData[dimension])}
              />
            )
          })}
        </div>

        {/* 4. Audience breakdown — replaces device/platform/browser pie trio */}
        <div className="mb-5">
          <AudienceStackedBars
            device={rangeData.device ?? {}}
            platform={rangeData.platform ?? {}}
            browser={rangeData.browser ?? {}}
          />
        </div>

        {/* 5. Secondary breakdowns — Languages, Screen */}
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          {secondaryPies.map((dimension) => {
            const panel = piePanels.find(([d]) => d === dimension)
            return (
              <PiePanel
                key={`${effectiveSite}-${selectedRange}-${dimension}`}
                title={panel?.[1] ?? dimension}
                data={toSlices(rangeData[dimension])}
              />
            )
          })}
        </div>

        {/* 6. Temporal patterns — moved down, less prominent */}
        <div className="mb-5 grid gap-3 lg:grid-cols-3">
          <DynamicsPanel dates={rangeData.date ?? {}} />
          <BarListPanel title="Hours" data={normalizeHours(rangeData.hour ?? {})} />
          <BarListPanel title="Weekdays" data={rangeData.weekday ?? {}} />
        </div>

        {/* 7. Admin / bottom */}
        <div className="grid gap-3">
          <TrackingCode uuid={dump.user.uuid} />
        </div>
      </section>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-6">
      <div className="mb-6 flex gap-3">
        <div className="skeleton h-7 w-64" />
      </div>
      <div className="mb-8">
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="skeleton h-[380px]" />
          <div className="skeleton h-[380px]" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
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
    <div className="rounded-xl border border-border/40 bg-card p-4 transition-all duration-200 hover:border-border/70 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
        {formatNumber(value)}
      </p>
      {comparison.percent && (
        <span
          className={`mt-2 inline-block rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums ${
            isPositive
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : isNegative
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
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
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
              selectedRange === range.value && !showCustom
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            }`}
          >
            {range.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(true)}
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
            showCustom
              ? 'bg-foreground text-background shadow-sm'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-7 text-xs" />
          <span className="text-[11px] text-muted-foreground">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-7 text-xs" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
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
              <TableHead key={header.id} className="text-[10px] px-2 py-1.5">
                <button
                  className="flex items-center gap-1 text-left"
                  onClick={header.column.getToggleSortingHandler()}
                  type="button"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <ArrowDownUp size={9} className="text-muted-foreground" />
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
            className="cursor-pointer text-xs transition-colors"
            onClick={() => onSelectSite(row.original.site)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className="px-2 py-1.5">
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
    <Card className="border-border/40 shadow-none pt-4 pb-0 gap-0">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</span>
        <span className="font-mono text-sm tabular-nums tracking-tight">
          {data.length ? formatNumber(sum(data.map((d) => d.value))) : 'No data'}
        </span>
      </div>
      <CardContent className="px-4 pb-4">
        <ChartContainer config={config} className="mx-auto aspect-square max-h-[180px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((item) => (
                <Cell key={item.key} fill={item.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" className="flex-wrap gap-1 text-[9px]" />}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function PagesTable({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
  const total = sum(entries.map(([, value]) => value))

  return (
    <Card className="border-border/40 shadow-none pt-4 pb-0 gap-0">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Visited pages</span>
        <span className="font-mono text-sm tabular-nums tracking-tight">
          {formatNumber(total)} views
        </span>
      </div>
      <div className="px-4 pb-4">
        <div className="h-72 rounded-lg border border-border/30">
          <ScrollArea className="h-full">
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-3 py-2 text-[10px]">Page</TableHead>
                  <TableHead className="w-24 px-3 py-2 text-right text-[10px]">Views</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length ? entries.map(([page, value]) => (
                  <TableRow key={page}>
                    <TableCell className="max-w-0 truncate px-3 py-2 font-mono text-[11px] text-muted-foreground" title={page}>
                      {page}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right font-mono text-[11px] tabular-nums">
                      {formatNumber(value)}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={2} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No page views yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </table>
          </ScrollArea>
        </div>
      </div>
    </Card>
  )
}

function AudienceStackedBars({ device, platform, browser }: {
  device: Record<string, number>
  platform: Record<string, number>
  browser: Record<string, number>
}) {
  const groups = [
    { id: 'device', title: 'Devices', data: device },
    { id: 'platform', title: 'Platforms', data: platform },
    { id: 'browser', title: 'Browsers', data: browser },
  ] as const

  return (
    <Card className="border-border/40 shadow-none pt-4 pb-0 gap-0">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Audience</span>
        <span className="text-sm font-medium tracking-tight text-muted-foreground">Device, platform, browser</span>
      </div>
      <CardContent className="grid gap-5 px-4 pb-4 lg:grid-cols-2">
        <AudienceCompositionChart groups={groups} />
        <Tabs defaultValue="device" className="min-w-0">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="device">Devices</TabsTrigger>
            <TabsTrigger value="platform">Platforms</TabsTrigger>
            <TabsTrigger value="browser">Browsers</TabsTrigger>
          </TabsList>
          {groups.map((group) => (
            <TabsContent key={group.id} value={group.id} className="mt-3">
              <BreakdownTable title={group.title} data={group.data} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function AudienceCompositionChart({ groups }: {
  groups: ReadonlyArray<{ id: string; title: string; data: Record<string, number> }>
}) {
  return (
    <div className="rounded-xl border border-border/30 bg-secondary/20 p-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium tracking-tight">Composition chart</p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">top 5 + other</span>
      </div>
      <div className="grid gap-5">
        {groups.map((group) => (
          <AudienceChartRow key={group.id} title={group.title} data={group.data} />
        ))}
      </div>
    </div>
  )
}

function AudienceChartRow({ title, data }: { title: string; data: Record<string, number> }) {
  const segments = breakdownSegments(data)
  const total = Math.max(1, sum(segments.map(([, value]) => value)))

  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium text-muted-foreground">{title}</span>
        <span className="font-mono text-[11px] tabular-nums">{formatNumber(total)}</span>
      </div>
      <div className="flex h-7 overflow-hidden rounded-lg bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
        {segments.length ? segments.map(([name, value], index) => (
          <span
            key={name}
            className="flex min-w-[3px] items-center justify-center overflow-hidden text-[9px] font-medium text-zinc-950/70"
            title={`${title} / ${name}: ${formatNumber(value)}`}
            style={{
              width: `${(value / total) * 100}%`,
              backgroundColor: colors[index % colors.length],
            }}
          >
            {(value / total) > 0.16 ? Math.round((value / total) * 100) + '%' : ''}
          </span>
        )) : null}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map(([name], index) => (
          <span key={name} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

function BreakdownTable({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
  const total = Math.max(1, sum(entries.map(([, value]) => value)))

  return (
    <div className="h-64 rounded-lg border border-border/30">
      <ScrollArea className="h-full">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="px-3 py-2 text-[10px]">{title}</TableHead>
              <TableHead className="w-20 px-3 py-2 text-right text-[10px]">Count</TableHead>
              <TableHead className="w-20 px-3 py-2 text-right text-[10px]">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length ? entries.map(([name, value]) => (
              <TableRow key={name}>
                <TableCell className="max-w-0 truncate px-3 py-2 text-[11px] text-muted-foreground" title={name}>
                  {name}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-[11px] tabular-nums">
                  {formatNumber(value)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {Math.round((value / total) * 100)}%
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="px-3 py-8 text-center text-xs text-muted-foreground">
                  No {title.toLowerCase()} data yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </ScrollArea>
    </div>
  )
}

function breakdownSegments(data: Record<string, number>) {
  const entries = Object.entries(data)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
  const top = entries.slice(0, 5)
  const other = sum(entries.slice(5).map(([, value]) => value))
  return other ? [...top, ['Other', other] as [string, number]] : top
}

function DynamicsPanel({ dates }: { dates: Record<string, number> }) {
  const grouped = groupDates(dates)
  const vals = grouped.values
  const trend = vals.length < 3
    ? { title: 'Good stability', detail: 'Not enough data for a trend.' }
    : trendSummary(vals)

  return (
    <Card className="border-border/40 shadow-none pt-4 pb-0 gap-0">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Dynamics</span>
        <span className="text-sm font-medium tracking-tight">{trend.title}</span>
      </div>
      <CardContent className="px-4 pb-4">
        <p className="text-xs text-muted-foreground leading-relaxed">{trend.detail}</p>
      </CardContent>
    </Card>
  )
}

function BarListPanel({ title, data }: { title: string; data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data))
  return (
    <Card className="border-border/40 shadow-none pt-4 pb-0 gap-0">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</span>
        <span className="font-mono text-sm tabular-nums tracking-tight">
          {formatNumber(sumObject(data))}
        </span>
      </div>
      <CardContent className="flex flex-col gap-1 px-4 pb-4">
        {Object.entries(data).slice(0, 12).map(([key, value]) => (
          <div className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2" key={key}>
            <span className="truncate text-[11px] text-muted-foreground">{key}</span>
            <span className="h-1 rounded-full bg-muted">
              <span
                className="block h-1 rounded-full transition-all duration-300"
                style={{
                  width: `${(value / max) * 100}%`,
                  backgroundColor: 'oklch(from var(--accent) l c h)',
                }}
              />
            </span>
            <span className="text-right font-mono text-[11px] tabular-nums">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ConnectionBadge({ status }: { status: import('@/lib/types').ConnectionStatus }) {
  const config = {
    connecting: { label: 'Connecting', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    live: { label: 'Live', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    reconnecting: { label: 'Reconnecting', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  }[status]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${config.className}`}>
      <span className={`size-1.5 rounded-full ${
        status === 'live'
          ? 'bg-emerald-500 animate-pulse'
          : 'bg-amber-500'
      }`} />
      {config.label}
    </span>
  )
}

function ShareActions({ dump }: { dump: Dump }) {
  const [error, setError] = React.useState('')
  const baseUrl = `${window.location.origin}/app-next/`
  const shareLink = `${baseUrl}?user=${encodeURIComponent(dump.user.id)}&token=${encodeURIComponent(dump.user.token)}`

  if (dump.meta.sessionless) {
    return (
      <Badge variant="secondary" className="text-[11px] font-normal">
        <Eye size={11} className="mr-1" />
        Viewing {dump.user.id} as guest
      </Badge>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {dump.user.token ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground"
          onClick={() => copyText(shareLink).catch((err) =>
            setError(err instanceof Error ? err.message : 'Copy failed'),
          )}
        >
          <Eye size={12} />
          <span className="ml-1">Guest URL</span>
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground"
          onClick={() => postAndReload('/resettoken').catch((err) => setError(err.message))}
        >
          <EyeOff size={12} />
          <span className="ml-1">Enable guest</span>
        </Button>
      )}
      {dump.user.token && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground"
          onClick={() => postAndReload('/deletetoken').catch((err) => setError(err.message))}
        >
          Remove guest
        </Button>
      )}
      <Button asChild size="sm" variant="outline" className="h-7 text-[11px] text-muted-foreground">
        <a href="#tracking-code"><Plus size={12} className="mr-1" />Add site</a>
      </Button>
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
  const [status, setStatus] = React.useState<'idle' | 'copied' | 'error'>('idle')
  const server = window.location.origin
  const code = `<script src="${server}/script.js" data-id="${uuid}" data-utcoffset="${getUTCOffset()}" data-server="${server}"></script>`
  return (
    <Card id="tracking-code" className="border-border/40 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-1 px-4 pt-4">
        <div>
          <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.1em]">Add website</CardDescription>
          <CardTitle className="text-sm font-medium tracking-tight">Tracking code</CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px] text-muted-foreground"
          onClick={() => {
            copyText(code)
              .then(() => {
                setStatus('copied')
                window.setTimeout(() => setStatus('idle'), 1500)
              })
              .catch(() => setStatus('error'))
          }}
        >
          {status === 'copied' ? 'Copied' : status === 'error' ? 'Copy failed' : 'Copy'}
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-3.5 text-[11px] leading-relaxed text-zinc-400">
          <code>{code}</code>
        </pre>
      </CardContent>
    </Card>
  )
}

function VisitLogs({ logs }: { logs: Record<string, number> }) {
  const entries = Object.entries(logs)
    .sort((a, b) => b[1] - a[1])
    .map(([log]) => parseLogEntry(log))
    .filter(Boolean) as Array<{ time: string; country: string; referrer: string; device: string; platform: string }>

  return (
    <Card className="border-border/40 shadow-none pt-4 pb-0 gap-0">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Recent visits</span>
        <span className="font-mono text-sm tabular-nums tracking-tight">{entries.length}</span>
      </div>
      <div className="px-4 pb-4">
        <div className="h-52 rounded-lg border border-border/30">
          <ScrollArea className="h-full">
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2 py-1.5 text-[10px]">Time</TableHead>
                  <TableHead className="w-7 px-1 py-1.5" title="Country"><Globe size={10} className="text-muted-foreground" /></TableHead>
                  <TableHead className="px-2 py-1.5 text-[10px]">Source</TableHead>
                  <TableHead className="w-6 px-1 py-1.5" title="Device"><Monitor size={10} className="text-muted-foreground" /></TableHead>
                  <TableHead className="w-6 px-1 py-1.5" title="OS"><Laptop size={10} className="text-muted-foreground" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length ? entries.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-2 py-1 font-mono text-[11px] text-muted-foreground">{entry.time}</TableCell>
                    <TableCell className="px-1 py-1 text-sm leading-none">{countryFlag(entry.country) || '—'}</TableCell>
                    <TableCell className="max-w-0 truncate px-2 py-1 font-mono text-[11px] text-muted-foreground" title={entry.referrer}>
                      {stripProtocol(entry.referrer) || 'Direct'}
                    </TableCell>
                    <TableCell className="px-1 py-1" title={entry.device}><DeviceIcon device={entry.device} /></TableCell>
                    <TableCell className="px-1 py-1" title={entry.platform}><PlatformIcon platform={entry.platform} /></TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">
                      No recent visits
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </table>
          </ScrollArea>
        </div>
      </div>
    </Card>
  )
}

function DeleteSite({ site }: { site: string }) {
  const [confirm, setConfirm] = React.useState('')
  const [error, setError] = React.useState('')
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs text-destructive">
          <Settings size={12} />
          <span className="ml-1">Delete</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {site} permanently?</DialogTitle>
          <DialogDescription>
            This removes all visit data, archive records, and logs for this site.
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
          <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
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
          <CardTitle className="text-xl font-semibold tracking-tight">Welcome back</CardTitle>
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

function countryFlag(code: string) {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1F1E6 + c.charCodeAt(0) - 65))
}

function stripProtocol(url: string) {
  return url.replace(/^https?:\/\//, '')
}

function parseLogEntry(log: string) {
  const bracketEnd = log.indexOf(']')
  if (bracketEnd === -1) return null
  const datetime = log.slice(1, bracketEnd)
  const time = datetime.split(' ')[1]?.slice(0, 5) || ''
  const rest = log.slice(bracketEnd + 1).trim()
  const parts = rest.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  const platform = parts.pop() || ''
  const device = parts.pop() || ''
  const remaining = parts
  let country = ''
  let referrer = ''
  if (remaining.length >= 1 && /^[A-Za-z]{2}$/.test(remaining[0])) {
    country = remaining.shift()!
  }
  referrer = remaining.join(' ')
  return { time, country, referrer, device, platform }
}

function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase()
  const props = { size: 14, className: 'text-muted-foreground' }
  if (d.includes('phone') || d.includes('mobile')) return <Smartphone {...props} />
  if (d.includes('tablet') || d.includes('ipad')) return <Tablet {...props} />
  return <Monitor {...props} />
}

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase()
  const props = { size: 14, className: 'text-muted-foreground' }
  if (p.includes('android')) return <Smartphone {...props} />
  if (p.includes('ios') || p.includes('iphone') || p.includes('ipad')) return <Tablet {...props} />
  if (p.includes('mac')) return <Laptop {...props} />
  if (p.includes('linux')) return <Terminal {...props} />
  if (p.includes('windows')) return <Monitor {...props} />
  return <Globe {...props} />
}
