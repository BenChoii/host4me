'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'

const features = [
  {
    title: 'AI Guest Messaging',
    description: 'Alfred responds to guest inquiries instantly in your unique voice and tone',
  },
  {
    title: 'Voice & Style Learning',
    description: 'Analyzes your past messages to mirror your hospitality style perfectly',
  },
  {
    title: 'Multi-Platform Sync',
    description: 'Manages Airbnb, VRBO, and Booking.com from a single dashboard',
  },
  {
    title: 'Smart Escalation',
    description: 'Knows when to handle it and when to loop you in via Telegram',
  },
  {
    title: 'Automated Check-in/out',
    description: 'Sends timely instructions, codes, and reminders to guests automatically',
  },
  {
    title: '24/7 Coverage',
    description: 'Alfred never sleeps — your guests get instant replies at 3 AM or noon',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">Powerful Features</h2>
          <p className="text-xl text-zinc-600">Everything Alfred handles so you don't have to</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardHeader>
                <CheckCircle className="h-6 w-6 text-[#f27d26] mb-2" />
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
