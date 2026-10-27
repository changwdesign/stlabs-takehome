import { Bot, Fingerprint, Globe, Hand, KeyRound, LayoutDashboard, Mail, User, Zap } from 'lucide-react'
import type { Automation, StepActor, StepTool } from '@/data/types'
import { SlackIcon } from '@/components/ui/SlackIcon'
import { cn } from '@/lib/cn'

/**
 * Every step says who acts and in what system. Agent reads as the brand tile
 * so automated work is distinguishable from a person's at a glance, matching
 * how the activity timeline already treats the Agent.
 */
const actors: Record<StepActor, { label: string; chip: string; icon: typeof Bot }> = {
  agent: { label: 'Agent', chip: 'bg-accent-soft text-accent', icon: Bot },
  assignee: { label: 'You', chip: 'bg-surface-pill text-ink', icon: User },
  requester: { label: 'Requester', chip: 'bg-avatar-warm/30 text-avatar-warm-ink', icon: User },
  third_party: { label: 'Third party', chip: 'bg-surface-pill text-ink-muted', icon: User },
}

/**
 * Agent steps split on whether they need a person. Both variants share one
 * shape — the Agent segment plus a filled mode segment — and differ only in
 * the mode's icon, label and tone, so the difference reads before the note.
 */
const agentModes: Partial<
  Record<Automation['kind'], { label: string; segment: string; icon: typeof Bot }>
> = {
  auto: { label: 'Auto', segment: 'bg-accent/20 text-accent', icon: Zap },
  confirm: {
    label: 'Needs approval',
    segment: 'bg-step-confirm/20 text-step-confirm',
    icon: Hand,
  },
}

export function StepActorTag({
  actor,
  automation,
  className,
}: {
  actor: StepActor
  automation?: Automation['kind']
  className?: string
}) {
  const meta = actors[actor]
  const Icon = meta.icon
  const mode = actor === 'agent' && automation ? agentModes[automation] : undefined
  const ModeIcon = mode?.icon
  return (
    <span
      className={cn(
        'inline-flex h-5 items-stretch overflow-hidden rounded-md text-[11px] font-medium leading-4',
        meta.chip,
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 px-1.5">
        <Icon className="h-3 w-3 shrink-0" strokeWidth={1.9} />
        {meta.label}
      </span>
      {mode && ModeIcon ? (
        <span className={cn('inline-flex items-center gap-1 px-1.5', mode.segment)}>
          <ModeIcon className="h-3 w-3 shrink-0" strokeWidth={1.9} />
          {mode.label}
        </span>
      ) : null}
    </span>
  )
}

export function ToolTag({ tool, className }: { tool: StepTool; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 text-[11px] leading-4 text-ink-muted',
        className,
      )}
    >
      <ToolIcon icon={tool.icon} />
      {tool.label}
    </span>
  )
}

function ToolIcon({ icon }: { icon?: StepTool['icon'] }) {
  switch (icon) {
    case 'slack':
      return <SlackIcon className="h-3 w-3" />
    case 'onepassword':
      return <KeyRound className="h-3 w-3" strokeWidth={1.9} />
    case 'okta':
      return <Fingerprint className="h-3 w-3" strokeWidth={1.9} />
    case 'portal':
      return <LayoutDashboard className="h-3 w-3" strokeWidth={1.9} />
    case 'mail':
      return <Mail className="h-3 w-3" strokeWidth={1.9} />
    case 'browser':
      return <Globe className="h-3 w-3" strokeWidth={1.9} />
    default:
      return null
  }
}
