import { useEffect, useRef, useState } from "react"

function useCountUp(end: number, duration = 2000, start: boolean) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number
    let animationFrame: number
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const progress = Math.min((currentTime - startTime) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(easeOutQuart * end))
      if (progress < 1) animationFrame = requestAnimationFrame(animate)
    }
    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [end, duration, start])
  return count
}

export function StatsSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const hoursSaved = useCountUp(3, 1800, isVisible)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && !isVisible) setIsVisible(true) }, { threshold: 0.3 })
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [isVisible])

  return (
    <section id="stats-section" ref={sectionRef} className="py-24 px-6 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className={`text-center mb-16 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Built to save you hours every week</p>
          <h2 className="font-serif text-3xl md:text-4xl font-normal leading-tight max-w-2xl mx-auto text-balance">A tireless concierge for every guest inquiry</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
          <div className={`text-center transition-all duration-1000 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="font-light text-foreground text-4xl md:text-5xl leading-none">&lt;</span>
              <span className="font-light text-foreground text-6xl md:text-7xl leading-none">10</span>
              <span className="font-light text-muted-foreground text-4xl md:text-5xl leading-none">sec</span>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Average Reply Time</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Industry average: 2–4 hours</p>
          </div>
          <div className={`text-center transition-all duration-1000 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <p className="font-light text-foreground mb-2 text-6xl md:text-7xl leading-none">24/7</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Always Online</p>
            <p className="text-xs text-muted-foreground/70 mt-1">No sleep, no time zones, no gaps</p>
          </div>
          <div className={`text-center transition-all duration-1000 delay-400 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="font-light text-foreground text-6xl md:text-7xl leading-none">{hoursSaved}</span>
              <span className="font-light text-foreground text-4xl md:text-5xl leading-none">+</span>
              <span className="font-light text-muted-foreground text-4xl md:text-5xl leading-none ml-1">hrs</span>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Saved Every Week</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Per property, on average</p>
          </div>
        </div>
      </div>
    </section>
  )
}
