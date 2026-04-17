import { Header } from "../components/landing/header"
import { HeroSection } from "../components/landing/hero-section"
import { StatsSection } from "../components/landing/stats-section"
import { ServicesSection } from "../components/landing/services-section"
import { FeaturesSection } from "../components/landing/features-section"
import { PricingSection } from "../components/landing/pricing-section"
import { CTASection } from "../components/landing/cta-section"
import { TestimonialsSection } from "../components/landing/testimonials-section"
import { FAQSection } from "../components/landing/faq-section"
import { Footer } from "../components/landing/footer"

export default function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <StatsSection />
      <ServicesSection />
      <FeaturesSection />
      <CTASection />
      <PricingSection />
      <TestimonialsSection />
      <FAQSection />
      <Footer />
    </main>
  )
}
