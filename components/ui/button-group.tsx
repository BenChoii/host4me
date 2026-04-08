import * as React from 'react'
import { cn } from '@/lib/utils'

const ButtonGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'inline-flex rounded-md border border-zinc-200 shadow-sm',
      className
    )}
    {...props}
  />
))
ButtonGroup.displayName = 'ButtonGroup'

const ButtonGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'flex-1 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-zinc-200',
      className
    )}
    {...props}
  />
))
ButtonGroupItem.displayName = 'ButtonGroupItem'

export { ButtonGroup, ButtonGroupItem }
