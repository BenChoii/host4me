'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

const plans = [
  {
    name: 'Starter',
    price: '$29',
    period: '/month',
    description: 'Perfect for hosts with a few listings',
    features: ['Up to 3 properties', 'AI guest messaging', 'Style learning', 'Email support'],
  },
  {
    name: 'Professional',
    price: '$79',
    period: '/month',
    description: 'For serious short-term rental hosts',
    features: ['Up to 15 properties', 'All Starter features', 'Multi-platform sync', 'Telegram escalation', 'Weekly performance reports'],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'pricing',
    description: 'For property management companies',
    features: ['Unlimited properties', 'All Pro features', 'API access', 'Dedicated account manager', 'Custom integrations'],
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-zinc-600">Choose the plan that fits your hosting portfolio</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, index) => (
            <Card key={index} className={plan.popular ? 'border-[#f27d26] shadow-lg' : ''}>
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-zinc-600 ml-2">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <Button className={`w-full mb-6 ${plan.popular ? 'bg-[#f27d26] hover:bg-[#d96a1d]' : ''}`} variant={plan.popular ? 'default' : 'outline'}>
                  Get Started
                </Button>
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-[#f27d26]" />
                      <span className="text-sm text-zinc-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
