'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CreditCard, Wrench, BarChart3 } from 'lucide-react'

const services = [
  {
    icon: Users,
    title: 'Tenant Management',
    description: 'Manage all your tenant information and communications in one place',
  },
  {
    icon: CreditCard,
    title: 'Automated Collections',
    description: 'Collect rent automatically with multiple payment options',
  },
  {
    icon: Wrench,
    title: 'Maintenance Tracking',
    description: 'Keep track of all maintenance requests and repairs',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Get detailed insights into your property performance',
  },
]

export function ServicesSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">Our Services</h2>
          <p className="text-xl text-zinc-600">Everything you need to succeed as a property manager</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => {
            const Icon = service.icon
            return (
              <Card key={index}>
                <CardHeader>
                  <Icon className="h-8 w-8 text-zinc-900 mb-2" />
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
