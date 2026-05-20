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

export const colors = [
  'oklch(0.76 0.14 65)',
  'oklch(0.68 0.12 175)',
  'oklch(0.65 0.18 10)',
  'oklch(0.58 0.08 260)',
  'oklch(0.72 0.12 290)',
  'oklch(0.60 0.16 300)',
  'oklch(0.70 0.14 140)',
  'oklch(0.64 0.16 40)',
  'oklch(0.74 0.10 220)',
  'oklch(0.62 0.13 330)',
  'oklch(0.68 0.15 95)',
  'oklch(0.66 0.11 200)',
  'oklch(0.72 0.16 355)',
  'oklch(0.60 0.10 310)',
  'oklch(0.74 0.13 120)',
  'oklch(0.64 0.14 25)',
  'oklch(0.70 0.09 245)',
  'oklch(0.66 0.17 80)',
  'oklch(0.62 0.12 195)',
  'oklch(0.72 0.15 345)',
  'oklch(0.68 0.11 160)',
  'oklch(0.74 0.16 5)',
  'oklch(0.60 0.14 275)',
  'oklch(0.66 0.10 55)',
  'oklch(0.70 0.13 185)',
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
