import { HeroSection } from '@/components/hero-section'
import { FeaturesSection } from '@/components/features-section'
import { ServicesSection } from '@/components/services-section'
import { PricingSection } from '@/components/pricing-section'
import { StatsSection } from '@/components/stats-section'
import { TestimonialsSection } from '@/components/testimonials-section'
import { BlogSection } from '@/components/blog-section'
import { FAQSection } from '@/components/faq-section'
import { CTASection } from '@/components/cta-section'

export default function Home() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <ServicesSection />
      <StatsSection />
      <PricingSection />
      <TestimonialsSection />
      <BlogSection />
      <FAQSection />
      <CTASection />
    </main>
  )
}
