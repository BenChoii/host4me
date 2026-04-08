'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Brain, Shield, BarChart3 } from 'lucide-react'

const services = [
  {
    icon: MessageSquare,
    title: 'Guest Communication',
    description: 'Alfred handles all guest messages across platforms with your personal tone',
  },
  {
    icon: Brain,
    title: 'Style Intelligence',
    description: 'Learns from your message history — formal, friendly, or funny, Alfred adapts',
  },
  {
    icon: Shield,
    title: 'Smart Escalation',
    description: 'Financial requests and emergencies get routed to you instantly via Telegram',
  },
  {
    icon: BarChart3,
    title: 'Performance Insights',
    description: 'Weekly reports on response times, guest satisfaction, and booking trends',
  },
]

export function ServicesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">How Alfred Works</h2>
          <p className="text-xl text-zinc-600">Three steps to hands-free property management</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => {
            const Icon = service.icon
            return (
              <Card key={index}>
                <CardHeader>
                  <Icon className="h-8 w-8 text-[#f27d26] mb-2" />
                  <CardTitle className="text-lg">{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{service.description}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
