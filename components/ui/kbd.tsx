import * as React from 'react'

import { cn } from '@/lib/utils'

const kbd = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement>
>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      'inline-flex items-center rounded border border-zinc-200 bg-zinc-100 px-2 py-1.5 font-mono text-sm font-medium text-zinc-900',
      className
    )}
    {...props}
  />
))
kbd.displayName = 'Kbd'

export { kbd }
