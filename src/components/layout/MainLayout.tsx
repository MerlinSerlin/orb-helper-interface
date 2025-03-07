'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname()
  
  const navItems = [
    { name: 'Dashboard', href: '/' },
    { name: 'Event Generator', href: '/events' },
    { name: 'Backfill Manager', href: '/backfill' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto py-4 px-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Orb Helper</h1>
            <nav className="flex space-x-6">
              {navItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    pathname === item.href ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t py-4">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground">
            Orb Helper Interface
          </p>
        </div>
      </footer>
    </div>
  )
}