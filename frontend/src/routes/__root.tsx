import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { BarChart3 } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5 font-medium tracking-tight transition-opacity hover:opacity-80">
            <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
              <BarChart3 aria-hidden="true" size={14} strokeWidth={2} />
            </span>
            <span className="text-sm">Counter</span>
          </Link>
          <nav className="flex items-center gap-1">
            <ThemeToggle />
            <a
              href="/dashboard"
              className="ml-1 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Legacy app
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="w-full border-t border-border/30 px-5 py-5">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between text-[11px] text-muted-foreground/70">
          <span>Privacy-friendly web analytics</span>
          <span className="font-mono">counter.dev</span>
        </div>
      </footer>

      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[
          {
            name: 'TanStack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </div>
  )
}
