import * as React from 'react'
import { cn } from '@/lib/utils'

const InputGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center rounded-md border border-zinc-200 bg-white overflow-hidden',
      className
    )}
    {...props}
  />
))
InputGroup.displayName = 'InputGroup'

const InputGroupPrefix = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-center px-3 text-sm text-zinc-500',
      className
    )}
    {...props}
  />
))
InputGroupPrefix.displayName = 'InputGroupPrefix'

const InputGroupSuffix = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center justify-center px-3 text-sm text-zinc-500',
      className
    )}
    {...props}
  />
))
InputGroupSuffix.displayName = 'InputGroupSuffix'

export { InputGroup, InputGroupPrefix, InputGroupSuffix }
