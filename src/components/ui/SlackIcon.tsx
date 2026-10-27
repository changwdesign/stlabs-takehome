/** Small multi-colour Slack mark used by "View original conversation" links. */
export function SlackIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M5.0 15.2a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5z" fill="#E01E5A" />
      <path d="M6.3 15.2a2.5 2.5 0 0 1 5 0v6.3a2.5 2.5 0 1 1-5 0v-6.3z" fill="#E01E5A" />
      <path d="M8.8 5.0a2.5 2.5 0 1 1 2.5-2.5v2.5H8.8z" fill="#36C5F0" />
      <path d="M8.8 6.3a2.5 2.5 0 0 1 0 5H2.5a2.5 2.5 0 1 1 0-5h6.3z" fill="#36C5F0" />
      <path d="M19.0 8.8a2.5 2.5 0 1 1 2.5 2.5h-2.5V8.8z" fill="#2EB67D" />
      <path d="M17.7 8.8a2.5 2.5 0 0 1-5 0V2.5a2.5 2.5 0 1 1 5 0v6.3z" fill="#2EB67D" />
      <path d="M15.2 19.0a2.5 2.5 0 1 1-2.5 2.5v-2.5h2.5z" fill="#ECB22E" />
      <path d="M15.2 17.7a2.5 2.5 0 0 1 0-5h6.3a2.5 2.5 0 1 1 0 5h-6.3z" fill="#ECB22E" />
    </svg>
  )
}
