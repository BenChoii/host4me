'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const blogs = [
  {
    id: 1,
    title: 'Getting Started with Property Management',
    description: 'Learn the basics of managing your rental properties effectively.',
    date: 'Jan 15, 2024',
  },
  {
    id: 2,
    title: 'Maximizing Your Rental Income',
    description: 'Strategies to increase your property revenue throughout the year.',
    date: 'Jan 20, 2024',
  },
  {
    id: 3,
    title: 'Tenant Screening Best Practices',
    description: 'How to find and keep the best tenants for your properties.',
    date: 'Jan 25, 2024',
  },
]

export function BlogSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-white to-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">Latest Blog Posts</h2>
          <p className="text-xl text-zinc-600">Stay updated with property management insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {blogs.map((blog) => (
            <Card key={blog.id}>
              <CardHeader>
                <CardTitle className="text-lg">{blog.title}</CardTitle>
                <CardDescription>{blog.date}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-zinc-600 mb-4">{blog.description}</p>
                <Button variant="outline" className="w-full">Read More</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
