import { Home, Key, Shield } from "lucide-react"
import { useState, useEffect, useRef } from "react"

const services = [
  { icon: Home, title: "AI-powered listings", description: "Auto-generated descriptions, optimized photos, and smart pricing suggestions for every property." },
  { icon: Key, title: "Automated guest management", description: "AI handles guest communication, check-in instructions, and review responses around the clock." },
  { icon: Shield, title: "Smart operations", description: "Coordinated cleaning schedules, maintenance alerts, and real-time performance dashboards." },
]

function AnimatedIcon({ Icon }: { Icon: any; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false)
  const iconRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true) }, { threshold: 0.3 })
    if (iconRef.current) observer.observe(iconRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={iconRef} className="relative">
      <Icon className={`text-foreground h-16 w-16 ${isVisible ? "animate-draw-icon" : ""}`} strokeWidth={1} />
    </div>
  )
}

export function ServicesSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true) }, { threshold: 0.2 })
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="how-it-works" className="py-32 px-6 pb-24 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-0">
        <span className="font-bold text-center text-[18vw] sm:text-[16vw] md:text-[14vw] lg:text-[12vw] leading-none tracking-tighter text-zinc-100 whitespace-nowrap">MISSION</span>
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div ref={sectionRef} className="relative px-6 lg:px-8 py-16 lg:py-10 mb-32 overflow-hidden rounded-3xl">
          <div className="absolute inset-0 w-full h-full">
            <img src="/images/7aecbceb-cbd3-4cbd-901c-dd0125d41525.png" alt="Beautiful house" className={`w-full h-full object-cover transition-transform duration-1000 ease-out ${isVisible ? "scale-100" : "scale-110"}`} />
            <div className="absolute inset-0 bg-black/20" />
          </div>

          <div className="relative z-10 grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="order-1 lg:order-2">
              <p className="text-sm uppercase tracking-[0.2em] text-white/80 font-medium mb-4">Our mission</p>
              <h2 className="font-sans md:text-4xl lg:text-5xl font-medium text-white text-balance mb-8 text-5xl">Property management, reimagined with AI</h2>
              <div className="space-y-6 text-white/90 leading-relaxed">
                <p>At Host4Me, we believe managing rental properties should be effortless. Our AI-powered platform automates guest communication, optimizes pricing, and coordinates operations — so you can scale without the stress.</p>
                <p>Every listing is optimized, every guest interaction handled. We've reimagined property management to make it intelligent, efficient, and hands-free.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-normal mb-6 text-balance font-serif">Everything you need to host</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">A complete AI-powered platform to manage your rental properties from listing to checkout.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div key={index} className="group p-8 rounded-3xl hover:bg-zinc-50 transition-colors duration-300 text-center">
              <div className="mb-6 flex justify-center"><AnimatedIcon Icon={service.icon} delay={index * 0.2} /></div>
              <h3 className="text-xl font-medium mb-3 text-foreground">{service.title}</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
