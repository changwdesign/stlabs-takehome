/** Floating chat entry point pinned to the bottom of the detail column. */
export function ChatDock() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
      <button
        type="button"
        className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full border border-accent/70 bg-surface-dock px-5 py-2.5 text-[13px] font-medium text-ink shadow-lg shadow-black/30 transition-colors hover:border-accent"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-accent text-white">
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
            <rect x="2.5" y="4.5" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="6" cy="8.5" r="1" fill="currentColor" />
            <circle cx="10" cy="8.5" r="1" fill="currentColor" />
          </svg>
        </span>
        Chat
        <kbd className="font-sans text-[12px] text-ink-muted">⌘J</kbd>
      </button>
    </div>
  )
}
