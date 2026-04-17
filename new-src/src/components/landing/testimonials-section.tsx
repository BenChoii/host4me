import { useState, useEffect, useRef } from "react"

const testimonials = [
  { name: "Sarah Chen", role: "Host in Vancouver", content: "Host4Me's AI handles all my guest messages now. My response time went from hours to seconds!", avatar: "/placeholder.svg?height=48&width=48" },
  { name: "James Mitchell", role: "Host in Toronto", content: "The dynamic pricing alone boosted my revenue by 30%. This platform is a game changer.", avatar: "/placeholder.svg?height=48&width=48" },
  { name: "Priya Sharma", role: "Host in Calgary", content: "Managing 5 properties used to be a full-time job. With Host4Me, it takes me minutes a day.", avatar: "/placeholder.svg?height=48&width=48" },
]
const testimonials2 = [
  { name: "Michael Torres", role: "Host in Montreal", content: "The automated cleaning coordination is brilliant. Everything runs like clockwork now.", avatar: "/placeholder.svg?height=48&width=48" },
  { name: "Emily Nguyen", role: "Host in Ottawa", content: "I went from 1 to 8 listings in 6 months thanks to Host4Me. Scaling has never been easier.", avatar: "/placeholder.svg?height=48&width=48" },
  { name: "David Wilson", role: "Host in Whistler", content: "The AI concierge gives my guests a 5-star experience without me lifting a finger.", avatar: "/placeholder.svg?height=48&width=48" },
]

const dup1 = [...testimonials, ...testimonials, ...testimonials]
const dup2 = [...testimonials2, ...testimonials2, ...testimonials2]

export function TestimonialsSection() {
  const [isPaused, setIsPaused] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollRef2 = useRef<HTMLDivElement>(null)

  useEffect(() => { const t = setTimeout(() => { if (scrollRef2.current) scrollRef2.current.scrollLeft = scrollRef2.current.scrollWidth / 3; setIsInitialized(true) }, 100); return () => clearTimeout(t) }, [])

  useEffect(() => {
    if (isPaused || !isInitialized || !scrollRef.current) return
    const el = scrollRef.current; let raf: number; let active = true
    const scroll = () => { if (!active || !el) return; el.scrollLeft += 1; if (el.scrollLeft >= el.scrollWidth / 3) el.scrollLeft = 0; raf = requestAnimationFrame(scroll) }
    raf = requestAnimationFrame(scroll)
    return () => { active = false; cancelAnimationFrame(raf) }
  }, [isPaused, isInitialized])

  useEffect(() => {
    if (isPaused || !isInitialized || !scrollRef2.current) return
    const el = scrollRef2.current; let raf: number; let active = true
    const scroll = () => { if (!active || !el) return; el.scrollLeft -= 1; if (el.scrollLeft <= 0) el.scrollLeft = el.scrollWidth / 3; raf = requestAnimationFrame(scroll) }
    raf = requestAnimationFrame(scroll)
    return () => { active = false; cancelAnimationFrame(raf) }
  }, [isPaused, isInitialized])

  const handlers = { onMouseEnter: () => setIsPaused(true), onMouseLeave: () => setIsPaused(false), onTouchStart: () => setIsPaused(true), onTouchEnd: () => setIsPaused(false) }

  const renderCard = (t: typeof testimonials[0], i: number) => (
    <div key={i} className="flex-shrink-0 w-full sm:w-[400px] bg-card border border-border rounded-2xl p-8 border-none py-4">
      <div className="flex items-start gap-4 mb-6">
        <img src={t.avatar || "/placeholder.svg"} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
        <p className="text-foreground leading-relaxed flex-1 text-lg">&ldquo;{t.content}&rdquo;</p>
      </div>
      <div className="mt-auto"><p className="text-foreground text-sm font-bold">{t.name}</p><p className="text-muted-foreground text-xs">{t.role}</p></div>
    </div>
  )

  return (
    <section id="testimonials" className="py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16"><h2 className="text-4xl md:text-5xl font-normal leading-tight font-serif">What hosts are saying</h2></div>
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div ref={scrollRef} className="flex gap-6 overflow-x-hidden" {...handlers} style={{ scrollBehavior: "auto" }}>{dup1.map(renderCard)}</div>
          </div>
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div ref={scrollRef2} className="flex gap-6 overflow-x-hidden" {...handlers} style={{ scrollBehavior: "auto" }}>{dup2.map(renderCard)}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
