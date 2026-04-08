'use client'

import * as React from 'react'
import * as RechartsPrimitive from 'recharts'
import { ChartContainer } from 'recharts'

const ChartContext = React.createContext<{
  config: ChartConfig
} | null>(null)

export interface ChartConfig {
  [key: string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & ({
    color?: string
    theme?: Record<string, string>
  } | {
    color?: string
    theme?: Record<string, string>
  })
}

const useChart = () => {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error('useChart must be used within a <ChartContainer />')
  }
  return context
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, { color, theme }]) => color || theme)

  if (colorConfig.length === 0) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: [
          `
            :root {
          `,
          ...colorConfig.map(([key, { color }]) => `--color-${key}: ${color};`),
          `
            }
          `,
          `[data-theme="dark"] {`,
          ...colorConfig.map(([key, { theme }]) => (theme?.dark ? `--color-${key}: ${theme.dark};` : '')),
          `
            }
          `,
        ].join('\n'),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> &
    Pick<RechartsPrimitive.TooltipProps, 'active' | 'payload' | 'label'>
>(({ active, payload, label, className, indicator = 'dot', hideLabel = false, hideIndicator = false, ...props }, ref) => {
  const { config } = useChart()

  if (!active || !payload || payload.length === 0) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== 'line'
  const items = payload.map(({ color: payloadColor, name, value }) => {
    const config_entry = config[name as keyof typeof config] || {}
    const indicatorColor = (
      payloadColor ||
      config_entry?.color
    )

    return (
      <div key={`${name}-${value}`} className={`flex w-full flex-shrink-0 flex-col gap-2 rounded-md border border-zinc-200 bg-white p-2 text-xs text-zinc-950 shadow-xl`}>
        {!hideLabel && label && !nestLabel && <span className="text-zinc-700">{label}</span>}
        <div className="flex items-center gap-2">
          {!hideIndicator && <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-zinc-200" style={{ backgroundColor: indicatorColor }} />}
          <div className="flex flex-1 justify-between gap-8">
            <span className="text-zinc-700">{name}</span>
            <span className="flex items-baseline gap-1 font-mono font-medium tabular-nums text-zinc-950">
              {value}
            </span>
          </div>
        </div>
      </div>
    )
  })

  return (
    <div
      ref={ref}
      className={cn('grid min-w-[8rem] gap-1.5', className)}
      {...props}
    >
      {items}
    </div>
  )
})
ChartTooltipContent.displayName = 'ChartTooltip'

const cn = (...classes: any[]) => classes.filter(Boolean).join(' ')

export { ChartContainer, ChartStyle, ChartContext, useChart, ChartTooltip, ChartTooltipContent }
