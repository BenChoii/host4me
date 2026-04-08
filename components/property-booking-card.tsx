'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Users, DollarSign } from 'lucide-react'

interface PropertyBookingCardProps {
  name: string
  location: string
  price: number
  bedrooms: number
  bathrooms: number
  image?: string
}

export function PropertyBookingCard({
  name,
  location,
  price,
  bedrooms,
  bathrooms,
}: PropertyBookingCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-40" />
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <div className="flex items-center gap-1 text-sm text-zinc-600 mt-2">
          <MapPin className="h-4 w-4" />
          {location}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <Users className="h-4 w-4 mx-auto mb-1" />
            <div className="text-sm font-medium">{bedrooms}</div>
            <div className="text-xs text-zinc-500">Beds</div>
          </div>
          <div className="text-center">
            <Users className="h-4 w-4 mx-auto mb-1" />
            <div className="text-sm font-medium">{bathrooms}</div>
            <div className="text-xs text-zinc-500">Baths</div>
          </div>
          <div className="text-center">
            <DollarSign className="h-4 w-4 mx-auto mb-1" />
            <div className="text-sm font-medium">${price}</div>
            <div className="text-xs text-zinc-500">Price</div>
          </div>
        </div>
        <Button className="w-full">Book Now</Button>
      </CardContent>
    </Card>
  )
}
