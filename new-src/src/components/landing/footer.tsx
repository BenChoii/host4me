import { X, Globe, Camera, Users } from "lucide-react"

const footerLinks = {
  product: [{ label: "Features", href: "#" },{ label: "Pricing", href: "#" },{ label: "Integrations", href: "#" },{ label: "App", href: "#" }],
  company: [{ label: "About", href: "#" },{ label: "Careers", href: "#" },{ label: "Press", href: "#" },{ label: "Blog", href: "#" }],
  legal: [{ label: "Terms", href: "#" },{ label: "Privacy", href: "#" },{ label: "Cookies", href: "#" },{ label: "Legal", href: "#" }],
  support: [{ label: "Help Center", href: "#" },{ label: "Contact", href: "#" },{ label: "FAQ", href: "#" },{ label: "Report", href: "#" }],
}

export function Footer() {
  return (
    <div className="relative">
      <div className="absolute -top-[20vw] left-0 right-0 w-full h-[50vw] z-0 overflow-hidden">
        <img src="/images/footer-bg.png" alt="Tuscan landscape" className="w-full h-full object-cover" />
      </div>
      <div className="absolute -top-[10vw] sm:-top-[14vw] lg:-top-[15vw] left-0 right-0 h-[22vw] sm:h-[26vw] lg:h-[28vw] flex items-end justify-center overflow-hidden pointer-events-none z-10">
        <h2 className="font-bold text-center text-[14vw] sm:text-[17vw] md:text-[19vw] lg:text-[20vw] leading-[0.85] tracking-tighter text-white whitespace-nowrap">HOST4ME</h2>
      </div>
      <footer id="contact" className="relative z-20 border-t border-border py-16 px-6 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <a href="/" className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                <span className="text-base font-medium text-foreground">Host4Me</span>
              </a>
              <p className="text-sm text-muted-foreground mb-6">AI-powered property management.</p>
              <div className="flex gap-4">
                {[X, Globe, Camera, Users].map((Icon, i) => (
                  <a key={i} href="#" className="w-9 h-9 border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"><Icon className="w-4 h-4" /></a>
                ))}
              </div>
            </div>
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-medium text-foreground mb-4 uppercase tracking-wider">{title}</h4>
                <ul className="space-y-3">{links.map((link, i) => <li key={i}><a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{link.label}</a></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground">© 2026 Host4Me. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Host4Me Inc. — AI-powered property management platform</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
