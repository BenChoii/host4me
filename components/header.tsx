'use client'

import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

export function Logo() {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[#f27d26] font-bold text-2xl italic">/</span>
      <span className="font-bold text-lg tracking-tight">Host4Me</span>
    </div>
  )
}

export function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="border-b border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Logo />

        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-zinc-600 hover:text-zinc-900">Features</a>
          <a href="#pricing" className="text-zinc-600 hover:text-zinc-900">Pricing</a>
          <a href="#faq" className="text-zinc-600 hover:text-zinc-900">FAQ</a>
          <a href="#contact" className="text-zinc-600 hover:text-zinc-900">Contact</a>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Button variant="ghost">Sign In</Button>
          <Button className="bg-[#f27d26] hover:bg-[#d96a1d]">Get Started</Button>
        </div>

        <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white">
          <nav className="flex flex-col p-4 gap-4">
            <a href="#features" className="text-zinc-600 hover:text-zinc-900">Features</a>
            <a href="#pricing" className="text-zinc-600 hover:text-zinc-900">Pricing</a>
            <a href="#faq" className="text-zinc-600 hover:text-zinc-900">FAQ</a>
            <a href="#contact" className="text-zinc-600 hover:text-zinc-900">Contact</a>
            <Button variant="ghost" className="w-full justify-start">Sign In</Button>
            <Button className="w-full bg-[#f27d26] hover:bg-[#d96a1d]">Get Started</Button>
          </nav>
        </div>
      )}
    </header>
  )
}
