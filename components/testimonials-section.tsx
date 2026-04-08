'use client'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'James Chen',
    title: 'Airbnb Superhost, Vancouver',
    content: 'Alfred has completely transformed how I manage my 8 listings. Guests get instant replies and I finally sleep through the night.',
    rating: 5,
  },
  {
    name: 'Sarah Mitchell',
    title: 'VRBO Host, Kelowna',
    content: 'The voice learning is incredible — my guests can\'t tell it\'s AI. Alfred sounds exactly like me. I\'ve saved 20+ hours a week.',
    rating: 5,
  },
  {
    name: 'David Park',
    title: 'Property Manager, Victoria',
    content: 'Managing 30 properties used to be chaos. Now Alfred handles guest comms while I focus on growing the business.',
    rating: 5,
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">What Our Hosts Say</h2>
          <p className="text-xl text-zinc-600">Join hosts across British Columbia who trust Alfred</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex gap-1 mb-2">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#f27d26] text-[#f27d26]" />
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
