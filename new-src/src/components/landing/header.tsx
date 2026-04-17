import type React from "react"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Menu, X, ArrowUpRight, ArrowRight } from "lucide-react"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const isScrolled = true
  const navigate = useNavigate()

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const element = document.getElementById(targetId)
    if (element) {
      const headerOffset = 100
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: elementPosition - headerOffset, behavior: "smooth" })
      setIsOpen(false)
    }
  }

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? "px-4 pt-4" : ""}`}>
      <div className={`max-w-7xl mx-auto transition-all duration-300 rounded-2xl ${isScrolled ? "bg-white/70 backdrop-blur-xl border border-zinc-200 px-6 py-3" : "bg-background/90 backdrop-blur-md px-6 py-5"}`}>
        <div className="flex items-center justify-between">
          <a href="#" onClick={handleLogoClick} className="flex items-center gap-2 cursor-pointer">
            <svg className={`w-6 h-6 transition-colors duration-300 ${isScrolled ? "text-black" : "text-foreground"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className={`text-lg font-medium tracking-tight transition-colors duration-300 ${isScrolled ? "text-black" : "text-foreground"}`}>Host4Me</span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {[["how-it-works","About"],["features","Features"],["pricing","Listings"],["testimonials","Testimonials"],["faq","FAQ"]].map(([id,label])=>(
              <a key={id} href={`#${id}`} onClick={(e) => handleSmoothScroll(e, id)} className={`text-sm transition-colors cursor-pointer ${isScrolled ? "text-zinc-600 hover:text-black" : "text-muted-foreground hover:text-foreground"}`}>{label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-1">
            <button onClick={() => navigate("/sign-up")} className={`relative flex items-center gap-0 border rounded-full pl-5 pr-1 py-1 transition-all duration-300 group overflow-hidden ${isScrolled ? "border-zinc-300" : "border-border"}`}>
              <span className={`absolute inset-0 rounded-full scale-x-0 origin-right group-hover:scale-x-100 transition-transform duration-300 ${isScrolled ? "bg-black" : "bg-foreground"}`} />
              <span className={`text-sm pr-3 relative z-10 transition-colors duration-300 ${isScrolled ? "text-black group-hover:text-white" : "text-foreground group-hover:text-background"}`}>Get started</span>
              <span className="w-8 h-8 rounded-full flex items-center justify-center relative z-10">
                <ArrowRight className={`w-4 h-4 group-hover:opacity-0 absolute transition-opacity duration-300 ${isScrolled ? "text-black" : "text-foreground"}`} />
                <ArrowUpRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 ${isScrolled ? "text-black group-hover:text-white" : "text-foreground group-hover:text-background"}`} />
              </span>
            </button>
          </div>

          <button className={`md:hidden transition-colors duration-300 ${isScrolled ? "text-black" : "text-foreground"}`} onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <nav className={`md:hidden mt-6 pb-6 flex flex-col gap-4 border-t pt-6 ${isScrolled ? "border-zinc-200" : "border-border"}`}>
            {[["how-it-works","About"],["features","Features"],["pricing","Listings"],["testimonials","Testimonials"],["faq","FAQ"]].map(([id,label])=>(
              <a key={id} href={`#${id}`} onClick={(e) => handleSmoothScroll(e, id)} className={`transition-colors cursor-pointer ${isScrolled ? "text-zinc-600 hover:text-black" : "text-muted-foreground hover:text-foreground"}`}>{label}</a>
            ))}
            <div className={`flex flex-col gap-3 mt-4 pt-4 border-t ${isScrolled ? "border-zinc-200" : "border-border"}`}>
              <a href="#" onClick={() => navigate("/sign-in")} className={isScrolled ? "text-black" : "text-foreground"}>Login</a>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
