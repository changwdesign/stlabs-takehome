import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Controlled multi-line input. The repo had only an uncontrolled textarea
 * inlined in the composer; agent-drafted content needs to be writable from
 * state, which means a `value`/`onChange` pair. Forwards its ref so a caller
 * can size it to its content.
 */
export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full resize-none bg-transparent text-[14px] leading-relaxed text-ink outline-none placeholder:text-ink-muted',
          className,
        )}
        {...rest}
      />
    )
  },
)
