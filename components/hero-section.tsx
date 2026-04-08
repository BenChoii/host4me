'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { AnimatedText } from '@/components/animated-text'

export function HeroSection() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white via-zinc-50 to-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <AnimatedText
            text="Meet Alfred, Your AI Property Manager"
            className="text-4xl md:text-6xl font-bold text-zinc-900 mb-6"
          />
          <p className="text-xl text-zinc-600 mb-8 max-w-2xl mx-auto">
            Host4Me automates guest communication, learns your hosting style, and manages your Airbnb & VRBO listings 24/7 — so you can relax.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-[#f27d26] hover:bg-[#d96a1d]">Get Started Free</Button>
            <Button size="lg" variant="outline">
              Watch Demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
