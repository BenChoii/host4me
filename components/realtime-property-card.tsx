'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp } from 'lucide-react'

interface RealtimePropertyCardProps {
  name: string
  status: 'occupied' | 'vacant' | 'maintenance'
  revenue: number
  occupancyRate: number
}

export function RealtimePropertyCard({
  name,
  status,
  revenue,
  occupancyRate,
}: RealtimePropertyCardProps) {
  const statusColors = {
    occupied: 'bg-green-100 text-green-800',
    vacant: 'bg-yellow-100 text-yellow-800',
    maintenance: 'bg-red-100 text-red-800',
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
        <Badge className={statusColors[status]}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">${revenue.toLocaleString()}</div>
        <p className="text-xs text-zinc-500 mt-1">Monthly Revenue</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-zinc-600">Occupancy Rate</span>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">{occupancyRate}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
