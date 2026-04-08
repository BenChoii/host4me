'use client'

import * as React from 'react'
import { OTPInput, SlotProps } from 'input-otp'

import { cn } from '@/lib/utils'

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, ...props }, ref) => (
  <OTPInput
    ref={ref}
    containerClassName={cn('flex gap-2', containerClassName)}
    className={cn('disabled:cursor-not-allowed disabled:opacity-50', className)}
    {...props}
  />
))
InputOTP.displayName = 'InputOTP'

const InputOTPGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center gap-2', className)} {...props} />
))
InputOTPGroup.displayName = 'InputOTPGroup'

const InputOTPSlot = React.forwardRef<
  HTMLDivElement,
  SlotProps & React.HTMLAttributes<HTMLDivElement>
>(({ char, hasFakeCaret, isActive, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative w-10 h-10 text-sm border border-zinc-200 bg-white rounded-md flex items-center justify-center font-medium text-zinc-950 shadow-sm transition-all',
      isActive && 'border-zinc-950 ring-1 ring-zinc-950',
      className
    )}
    {...props}
  >
    {char}
    {hasFakeCaret && (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="animate-caret h-4 w-px bg-zinc-950" />
      </div>
    )}
  </div>
))
InputOTPSlot.displayName = 'InputOTPSlot'

const InputOTPSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props} />
))
InputOTPSeparator.displayName = 'InputOTPSeparator'

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
