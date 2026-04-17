import { useNavigate } from "react-router-dom"
import { useEffect, useRef, useState } from "react"
import { ArrowUpRight, ArrowRight } from "lucide-react"
import { AnimatedRevenueChart } from "./animated-revenue-chart"

function useCountUp(end: number, duration: number, start: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number; let raf: number
    const animate = (t: number) => { if (!startTime) startTime = t; const p = Math.min((t - startTime) / duration, 1); setCount(Math.floor((1 - Math.pow(1 - p, 4)) * end)); if (p < 1) raf = requestAnimationFrame(animate) }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [end, duration, start])
  return count
}

export function CTASection() {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && !isVisible) setIsVisible(true) }, { threshold: 0.2 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [isVisible])

  const response = useCountUp(100, 2000, isVisible)
  const platforms = useCountUp(4, 1200, isVisible)
  const languages = useCountUp(15, 2000, isVisible)

  return (
    <section ref={ref} className="py-32 px-6 relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-normal leading-tight max-w-4xl mx-auto mb-6 font-serif">Ready to automate your hosting?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-10">Built for short-term rental hosts on Airbnb, VRBO, Booking.com and Hotels.com. Never miss a guest message again — Alfred replies in seconds, around the clock.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate("/sign-up")} className="relative flex items-center justify-center gap-0 bg-foreground text-background rounded-full pl-6 pr-1.5 py-1.5 transition-all duration-300 group overflow-hidden">
              <span className="text-sm pr-4">Get started free</span>
              <span className="w-10 h-10 bg-background rounded-full flex items-center justify-center"><ArrowUpRight className="w-4 h-4 text-foreground" /></span>
            </button>
            <button onClick={() => navigate("/dashboard")} className="relative flex items-center justify-center gap-0 border border-border rounded-full pl-6 pr-1.5 py-1.5 transition-all duration-300 group overflow-hidden">
              <span className="absolute inset-0 bg-foreground rounded-full scale-x-0 origin-right group-hover:scale-x-100 transition-transform duration-300" />
              <span className="text-sm text-foreground group-hover:text-background pr-4 relative z-10 transition-colors duration-300">See your dashboard</span>
              <span className="w-10 h-10 rounded-full flex items-center justify-center relative z-10">
                <ArrowRight className="w-4 h-4 text-foreground group-hover:opacity-0 absolute transition-opacity duration-300" />
                <ArrowUpRight className="w-4 h-4 text-foreground group-hover:text-background opacity-0 group-hover:opacity-100 transition-all duration-300" />
              </span>
            </button>
          </div>
        </div>
        <div className="flex justify-center mb-16"><AnimatedRevenueChart /></div>
        <div className="flex flex-col items-center md:flex-row md:items-start justify-center gap-12 md:gap-16">
          <div className="text-center flex-1 max-w-[240px]">
            <div className="flex items-baseline justify-center gap-0.5"><p className="text-6xl md:text-7xl font-light text-foreground leading-none">{response}</p><p className="text-4xl md:text-5xl font-light text-foreground leading-none">%</p></div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-2">Messages Answered</p><p className="text-xs text-muted-foreground/70 mt-1">Every inquiry gets a reply — no exceptions</p>
          </div>
          <div className="text-center flex-1 max-w-[240px]">
            <p className="text-6xl md:text-7xl font-light text-foreground leading-none">{platforms}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-2">Platforms Integrated</p><p className="text-xs text-muted-foreground/70 mt-1">Airbnb · VRBO · Booking.com · Hotels.com</p>
          </div>
          <div className="text-center flex-1 max-w-[240px]">
            <div className="flex items-baseline justify-center gap-0.5"><p className="text-6xl md:text-7xl font-light text-foreground leading-none">{languages}</p><p className="text-4xl md:text-5xl font-light text-foreground leading-none">+</p></div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-2">Languages Supported</p><p className="text-xs text-muted-foreground/70 mt-1">Replies to guests in their own language</p>
          </div>
        </div>
      </div>
    </section>
  )
}
