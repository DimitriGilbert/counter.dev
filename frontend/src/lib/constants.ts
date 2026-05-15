import type { RangeKey } from './types'

export const ranges: Array<{ value: RangeKey; label: string }> = [
  { value: 'day', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
]

export const piePanels = [
  ['ref', 'Sources'],
  ['country', 'Countries'],
  ['device', 'Devices'],
  ['platform', 'Platforms'],
  ['browser', 'Browsers'],
  ['lang', 'Languages'],
  ['screen', 'Screen sizes'],
  ['page', 'Visited pages'],
] as const

export const palette = {
  amber: 'oklch(0.76 0.14 65)',
  teal: 'oklch(0.68 0.12 175)',
  rose: 'oklch(0.65 0.18 10)',
  slate: 'oklch(0.58 0.08 260)',
  emerald: 'oklch(0.65 0.15 163)',
  violet: 'oklch(0.60 0.16 300)',
} as const

export const colors = [
  palette.amber,
  palette.teal,
  palette.rose,
  palette.slate,
  palette.emerald,
  palette.violet,
]

export const searchEngines = new Set([
  'google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com',
  'baidu.com', 'yandex.ru', 'ask.com', 'ecosia.org',
  'qwant.com', 'startpage.com',
])

export const socialSites = new Set([
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 't.co',
  'linkedin.com', 'reddit.com', 'youtube.com', 'pinterest.com',
  'tiktok.com', 'medium.com', 'dev.to', 'indiehackers.com',
  'discord.com', 'quora.com', 'vk.com', 'weibo.com',
])
