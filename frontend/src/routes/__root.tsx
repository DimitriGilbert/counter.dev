import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { BarChart3 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 font-medium tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 aria-hidden="true" size={16} strokeWidth={2} />
            </span>
            <span>Counter</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden font-mono text-[11px] font-normal sm:inline-flex">
              /app-next
            </Badge>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <a href="https://counter.dev/app#demo">Legacy app</a>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="w-full border-t border-border/40 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
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
