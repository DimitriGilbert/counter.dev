import * as React from 'react'
import type { DashboardState, RangeKey, VisitsData, Dump, TimedVisits, ConnectionStatus } from '@/lib/types'
import {
  normalizeDumpPayload,
  normalizeArchivePayload,
  normalizeCustomRangePayload,
  patchDump,
  makeTableRows,
  makeLineData,
  makeLineConfig,
  getUTCOffset,
  persistPreference,
  emptyTimedVisits,
} from '@/lib/analytics'
import { ranges } from '@/lib/constants'

export function useCounterDump(): DashboardState {
  const [status, setStatus] = React.useState<'connecting' | 'ready' | 'nouser' | 'error'>('connecting')
  const [connection, setConnection] = React.useState<ConnectionStatus>('connecting')
  const [error, setError] = React.useState('')
  const [dump, setDump] = React.useState<Dump | null>(null)
  const [archives, setArchives] = React.useState<Record<string, Record<string, VisitsData>>>({})
  const [customRange, setCustomRange] = React.useState<Record<string, VisitsData>>({})
  const [selectedSite, setSelectedSiteState] = React.useState('')
  const [selectedRange, setSelectedRangeState] = React.useState<RangeKey>('day')

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    params.set('utcoffset', getUTCOffset())
    const source = new EventSource(`/dump?${params.toString()}`)

    source.onopen = () => {
      setConnection('live')
    }

    source.onmessage = (event) => {
      let data: { type: 'dump' | 'archive' | 'oldest-archive-date' | 'nouser'; payload: unknown }
      try {
        data = JSON.parse(event.data)
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
        setConnection('live')
      }
    }
    source.onerror = () => {
      if (status === 'ready' || dump) {
        setConnection('reconnecting')
      } else {
        setStatus('error')
        setError('The live event stream failed before dashboard data was available.')
      }
    }

    return () => source.close()
  }, [])

  const patchedDump = React.useMemo(
    () => (dump ? patchDump(dump, archives, customRange) : null),
    [dump, archives, customRange],
  )

  React.useEffect(() => {
    if (!patchedDump) return
    const sites = Object.keys(patchedDump.sites).sort(
      (a, b) => patchedDump.sites[b].count - patchedDump.sites[a].count,
    )
    if (!selectedSite || !patchedDump.sites[selectedSite]) {
      setSelectedSiteState(
        patchedDump.user.prefs.site && patchedDump.sites[patchedDump.user.prefs.site]
          ? patchedDump.user.prefs.site
          : sites[0] || '',
      )
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

  const tableRows = React.useMemo(
    () => (patchedDump ? makeTableRows(patchedDump, selectedRange) : []),
    [patchedDump, selectedRange],
  )
  const lineData = React.useMemo(
    () => (patchedDump ? makeLineData(patchedDump, selectedRange) : []),
    [patchedDump, selectedRange],
  )
  const lineConfig = React.useMemo(
    () => (patchedDump ? makeLineConfig(patchedDump) : {}),
    [patchedDump],
  )

  if (!patchedDump || status !== 'ready') {
    return { status: status === 'ready' ? 'connecting' : status, error }
  }

  const sites = Object.keys(patchedDump.sites).sort(
    (a, b) => patchedDump.sites[b].count - patchedDump.sites[a].count,
  )
  const effectiveSelectedSite = patchedDump.sites[selectedSite] ? selectedSite : sites[0] || ''

  return {
    status: 'ready' as const,
    connection,
    dump: patchedDump,
    selectedSite: effectiveSelectedSite,
    selectedRange,
    setSelectedSite,
    setSelectedRange,
    loadCustomRange,
    tableRows,
    lineData,
    lineConfig,
  }
}
