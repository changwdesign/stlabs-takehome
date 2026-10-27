import type { ReactNode } from 'react'
import { IconSidebar } from './IconSidebar'

/** Sidebar plus one scrolling column — every page that isn't the inbox. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <IconSidebar />
      <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[980px] flex-col gap-7 px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
