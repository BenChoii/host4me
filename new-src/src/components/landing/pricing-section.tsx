import { useRef, useEffect, useState } from "react"
import { PropertyBookingCard } from "./property-booking-card"

const properties = [
  { propertyName: "Whistler Ski Chalet", location: "Whistler, British Columbia", duration: "Min. 3 nights", availableDate: "Available now", image: "/images/property-beach-villa.jpg", pricePerNight: 450, propertyType: "Mountain Chalet", features: ["Ski-in/Ski-out", "Hot Tub", "Mountain Views", "Chef Kitchen"], amenities: ["Free Wifi", "Parking", "8 Guests"], rating: 4.9 },
  { propertyName: "Banff Mountain Cabin", location: "Banff, Alberta", duration: "Min. 2 nights", availableDate: "Year-round", image: "/images/property-mountain-cabin.jpg", pricePerNight: 320, propertyType: "Mountain Cabin", features: ["Fireplace", "Mountain Views", "Hot Tub", "Game Room"], amenities: ["Free Wifi", "Parking", "4 Guests"], rating: 4.8 },
  { propertyName: "Toronto Luxury Condo", location: "Toronto, Ontario", duration: "Min. 1 night", availableDate: "Available now", image: "/images/property-city-loft.jpg", pricePerNight: 280, propertyType: "City Condo", features: ["CN Tower View", "Rooftop Access", "Designer Interior", "Central Location"], amenities: ["Free Wifi", "2 Guests", "Parking"], rating: 4.7 },
  { propertyName: "Niagara Vineyard Estate", location: "Niagara-on-the-Lake, Ontario", duration: "Min. 4 nights", availableDate: "Available now", image: "/images/property-tuscan-estate.jpg", pricePerNight: 520, propertyType: "Vineyard Estate", features: ["Vineyard Views", "Private Pool", "Wine Cellar", "Garden"], amenities: ["Free Wifi", "Parking", "8 Guests"], rating: 4.9 },
  { propertyName: "Tofino Beachfront Cabin", location: "Tofino, British Columbia", duration: "Min. 2 nights", availableDate: "Available now", image: "/images/property-tropical-bungalow.jpg", pricePerNight: 280, propertyType: "Beach Cabin", features: ["Ocean View", "Surfboard Rentals", "Private Deck", "Fire Pit"], amenities: ["Free Wifi", "Parking", "4 Guests"], rating: 4.8 },
  { propertyName: "Muskoka Lakefront Cottage", location: "Muskoka, Ontario", duration: "Min. 3 nights", availableDate: "Year-round", image: "/images/property-lakefront-modern.jpg", pricePerNight: 380, propertyType: "Lakefront Cottage", features: ["Lake Access", "Private Dock", "Panoramic Windows", "Hot Tub"], amenities: ["Free Wifi", "Parking", "6 Guests"], rating: 4.9 },
]

export function PricingSection() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const positionRef = useRef(0)
  const animationRef = useRef<number | undefined>(undefined)
  const duplicatedProperties = [...properties, ...properties, ...properties]

  useEffect(() => {
    const el = scrollRef.current; if (!el) return
    const speed = isHovered ? 0.3 : 1; let lastTime = performance.now()
    const animate = (currentTime: number) => {
      const dt = currentTime - lastTime; lastTime = currentTime
      positionRef.current += speed * (dt / 16)
      const totalWidth = el.scrollWidth / 3
      if (positionRef.current >= totalWidth) positionRef.current = 0
      el.style.transform = `translateX(-${positionRef.current}px)`
      animationRef.current = requestAnimationFrame(animate)
    }
    animationRef.current = requestAnimationFrame(animate)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [isHovered])

  return (
    <section id="pricing" className="py-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-normal mb-6 text-balance font-serif">Properties powered by Host4Me</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">See how hosts are maximizing revenue with AI-optimized listings and automated management.</p>
      </div>
      <div className="relative w-full" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <div ref={scrollRef} className="flex gap-6" style={{ width: "fit-content" }}>
          {duplicatedProperties.map((property, index) => (
            <div key={index} className="flex-shrink-0 w-[85vw] sm:w-[60vw] lg:w-[400px]">
              <PropertyBookingCard {...property} onBook={() => console.log(`Booking ${property.propertyName}`)} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
