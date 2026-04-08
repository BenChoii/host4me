'use client'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'John Smith',
    title: 'Property Manager',
    content: 'host4me has been a game-changer for my property management business. The automation features alone have saved me hours every week.',
    rating: 5,
  },
  {
    name: 'Sarah Johnson',
    title: 'Real Estate Investor',
    content: 'Excellent platform with outstanding customer support. I recommend host4me to all my investor friends.',
    rating: 5,
  },
  {
    name: 'Mike Davis',
    title: 'Landlord',
    content: 'Finally, a property management tool that actually works. No more spreadsheets for me!',
    rating: 5,
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">What Our Users Say</h2>
          <p className="text-xl text-zinc-600">Join thousands of satisfied customers</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex gap-1 mb-2">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <h3 className="font-semibold text-lg">{testimonial.name}</h3>
                <CardDescription>{testimonial.title}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-600">{testimonial.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
