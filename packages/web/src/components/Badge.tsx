import type { CSSProperties, HTMLAttributes } from 'react'
import { cn } from '../lib/utils'

/** A small pill. `color` (if given) sets a solid background; else a neutral state pill. */
export function Badge({
  children,
  color,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { color?: string }) {
  const style: CSSProperties | undefined = color ? { backgroundColor: color } : undefined
  return (
    <span className={cn('badge', color ? undefined : 'state', className)} style={style} {...rest}>
      {children}
    </span>
  )
}
