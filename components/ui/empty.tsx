import * as React from 'react'
import { cn } from '@/lib/utils'

const Empty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center', className)}
    {...props}
  />
))
Empty.displayName = 'Empty'

const EmptyIcon = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-4xl text-zinc-300', className)} {...props} />
))
EmptyIcon.displayName = 'EmptyIcon'

const EmptyTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('mt-4 text-lg font-semibold text-zinc-900', className)} {...props} />
))
EmptyTitle.displayName = 'EmptyTitle'

const EmptyDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('mt-2 text-sm text-zinc-500', className)} {...props} />
))
EmptyDescription.displayName = 'EmptyDescription'

export { Empty, EmptyIcon, EmptyTitle, EmptyDescription }
