'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const blogs = [
  {
    id: 1,
    title: 'How AI Is Changing Short-Term Rental Hosting',
    description: 'Why the best Airbnb hosts are letting AI handle guest communication — and seeing better reviews.',
    date: 'Mar 10, 2026',
  },
  {
    id: 2,
    title: '5 Ways to Improve Your Airbnb Response Rate',
    description: 'Response time is the #1 factor in Superhost status. Here\'s how to nail it every time.',
    date: 'Mar 18, 2026',
  },
  {
    id: 3,
    title: 'Shadow Mode: How to Trust Your AI Property Manager',
    description: 'Start with Alfred in approval mode, then graduate to full autonomy. Here\'s the playbook.',
    date: 'Mar 25, 2026',
  },
]

export function BlogSection() {
  return (
    <section className="py-20 bg-gradient-to-b from-white to-zinc-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">From the Blog</h2>
          <p className="text-xl text-zinc-600">Tips and insights for modern short-term rental hosts</p>
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
