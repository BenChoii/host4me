'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section id="contact" className="py-20 bg-gradient-to-r from-zinc-900 to-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl font-bold mb-6">Ready to Let Alfred Handle Your Guests?</h2>
        <p className="text-xl text-zinc-300 mb-8 max-w-2xl mx-auto">
          Join hosts across British Columbia who have reclaimed their time with AI-powered property management
        </p>
        <Button size="lg" className="bg-[#f27d26] text-white hover:bg-[#d96a1d]">
          Get Started Now
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}
