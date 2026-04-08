'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'

const features = [
  {
    title: 'Tenant Management',
    description: 'Easily manage tenant information, leases, and communications',
  },
  {
    title: 'Rent Collection',
    description: 'Automated rent collection with multiple payment options',
  },
  {
    title: 'Maintenance Tracking',
    description: 'Track and manage property maintenance and repairs',
  },
  {
    title: 'Financial Reports',
    description: 'Comprehensive financial reports and analytics',
  },
  {
    title: 'Document Storage',
    description: 'Secure storage for all your property documents',
  },
  {
    title: '24/7 Support',
    description: 'Round-the-clock customer support for all your needs',
  },
]

export function FeaturesSection() {
  return (
    <section className="py-20 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">Powerful Features</h2>
          <p className="text-xl text-zinc-600">Everything you need to manage your rental properties</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardHeader>
                <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
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
