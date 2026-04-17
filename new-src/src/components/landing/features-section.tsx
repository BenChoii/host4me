import { Check } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { motion } from "motion/react"
import { RealtimePropertyCard } from "./realtime-property-card"

const features = ["List a property in 5 minutes","AI-generated descriptions","Automated guest messaging","24/7 AI concierge","Dynamic pricing engine","Real-time analytics"]

export function FeaturesSection() {
  return (
    <section id="features" className="py-32 px-6 relative overflow-hidden">
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-center pointer-events-none z-0">
        <span className="font-bold text-center text-[20vw] sm:text-[18vw] md:text-[16vw] lg:text-[14vw] leading-none tracking-tighter text-zinc-100 whitespace-nowrap">MANAGE</span>
      </div>
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1"><RealtimePropertyCard /></div>
          <div className="order-1 lg:order-2 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
              <h2 className="text-4xl md:text-5xl font-normal mb-6 text-balance font-serif">Manage your properties with AI</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">Track your revenue, automate guest communication, and optimize pricing from a single intelligent dashboard.</p>
            </motion.div>
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <motion.div key={index} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: index * 0.1 }} viewport={{ once: true }} className="flex items-center p-3 rounded-xl hover:bg-zinc-50 transition-colors duration-300 gap-2 py-1">
                  <div className="w-6 h-6 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-md"><Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} /></div>
                  <span className="text-sm text-foreground">{feature}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
