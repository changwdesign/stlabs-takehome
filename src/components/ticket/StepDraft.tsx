import { useLayoutEffect, useRef } from 'react'
import { Check, Eye, Paperclip, RotateCcw, X } from 'lucide-react'
import type { DraftAttachment } from '@/data/types'
import type { StepDraftState } from '@/state/types'
import { Button, focusRing } from '@/components/ui/Button'
import { SlackIcon } from '@/components/ui/SlackIcon'
import { TextArea } from '@/components/ui/TextArea'
import { cn } from '@/lib/cn'

/**
 * The message an agent step drafted, shown on the step itself: who it goes
 * to, where, the text and every attachment — everything that will leave the
 * portal, editable in place, posted from here. Once sent it stays as the
 * record of what actually went out.
 */
export function StepDraft({
  to,
  draft,
  sent = false,
  onChange,
  onReset,
  onPost,
}: {
  /** Recipient's display name. */
  to: string
  draft: StepDraftState
  sent?: boolean
  onChange?: (patch: Partial<Pick<StepDraftState, 'body' | 'attachments'>>) => void
  onReset?: () => void
  onPost?: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const textArea = useRef<HTMLTextAreaElement>(null)

  // Grow to fit: the whole message is what's being reviewed, so none of it
  // should hide behind an inner scrollbar.
  useLayoutEffect(() => {
    const el = textArea.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft.body, sent])

  const attach = (files: FileList | null) => {
    if (!files?.length) return
    const added = Array.from(files).map((file) => ({ name: file.name, size: formatSize(file.size) }))
    onChange?.({ attachments: [...draft.attachments, ...added] })
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-canvas">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle px-3 py-2 text-[12px] text-ink-muted">
        {sent ? (
          <Check className="h-3.5 w-3.5 text-step-done" strokeWidth={2.25} />
        ) : (
          <SlackIcon className="h-3.5 w-3.5" />
        )}
        <span>
          {sent ? 'Sent to ' : 'To '}
          <span className="font-medium text-ink">{to}</span> · reply in the original Slack thread
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-ink-faint">
          <Eye className="h-3 w-3" strokeWidth={1.75} />
          Public reply
        </span>
      </div>

      {sent ? (
        <p className="whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-relaxed text-ink-muted">
          {draft.body}
        </p>
      ) : (
        <TextArea
          ref={textArea}
          aria-label={`Message to ${to}`}
          rows={3}
          value={draft.body}
          onChange={(event) => onChange?.({ body: event.target.value })}
          className="overflow-hidden px-3 py-2.5 text-[13px]"
        />
      )}

      {draft.attachments.length > 0 || !sent ? (
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2.5">
          {draft.attachments.map((file, i) => (
            <AttachmentChip
              key={`${file.name}-${i}`}
              file={file}
              onRemove={
                sent
                  ? undefined
                  : () => onChange?.({ attachments: draft.attachments.filter((_, j) => j !== i) })
              }
            />
          ))}
          {!sent ? (
            <>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-ink-muted transition-colors hover:text-ink',
                  focusRing,
                )}
              >
                <Paperclip className="h-3.5 w-3.5" strokeWidth={1.75} />
                Attach file
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                  attach(event.target.files)
                  event.target.value = ''
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {!sent ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-3 py-2">
          <span className="text-[12px] text-ink-faint">
            {draft.edited ? 'Edited by you' : 'Drafted by the agent'} · nothing sent yet
          </span>
          <div className="ml-auto flex items-center gap-2">
            {draft.edited ? (
              <Button
                variant="ghost"
                icon={<RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />}
                onClick={onReset}
              >
                Reset to agent’s draft
              </Button>
            ) : null}
            <Button
              variant="primary"
              icon={<SlackIcon className="h-3.5 w-3.5" />}
              disabled={!draft.body.trim()}
              onClick={onPost}
            >
              Post to Slack
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function AttachmentChip({ file, onRemove }: { file: DraftAttachment; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-surface-raised/40 py-1 pl-2 pr-1.5 text-[12px] text-ink">
      <Paperclip className="h-3 w-3 text-ink-muted" strokeWidth={1.75} />
      {file.name}
      <span className="text-ink-faint">{file.size}</span>
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${file.name}`}
          onClick={onRemove}
          className={cn('rounded p-0.5 text-ink-muted transition-colors hover:text-ink', focusRing)}
        >
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      ) : null}
    </span>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
