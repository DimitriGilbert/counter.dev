import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { BarChart3 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

import '../styles.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link to="/" className="flex items-center gap-3 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 aria-hidden="true" />
            </span>
            Counter
          </Link>
          <nav className="flex items-center gap-3">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              TanStack Router
            </Badge>
            <Button asChild variant="ghost" size="sm">
              <a href="https://counter.dev/app#demo">Demo</a>
            </Button>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="flex w-full flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-8">
        <Separator />
        <p>Privacy-friendly analytics, prepared for a modern frontend migration.</p>
      </footer>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
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
