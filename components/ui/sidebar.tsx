'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('border-r border-zinc-200 bg-white', className)}
    {...props}
  />
))
Sidebar.displayName = 'Sidebar'

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col p-4', className)}
    {...props}
  />
))
SidebarContent.displayName = 'SidebarContent'

const SidebarItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('py-2', className)}
    {...props}
  />
))
SidebarItem.displayName = 'SidebarItem'

export { Sidebar, SidebarContent, SidebarItem }
