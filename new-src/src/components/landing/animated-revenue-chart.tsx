import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { TrendingUp, Home, Key, Calendar, Shield } from "lucide-react"

const revenueCategories = [
  { name: "Nightly bookings", icon: Calendar, color: "#3b82f6" },
  { name: "Extended stays", icon: Key, color: "#10b981" },
  { name: "Management fees", icon: Home, color: "#8b5cf6" },
  { name: "AI upsells", icon: Shield, color: "#f59e0b" },
]

function generateRandomData() {
  return revenueCategories.map((cat) => ({ ...cat, value: Math.floor(Math.random() * 30000) + 10000 }))
}

export function AnimatedRevenueChart() {
  const [data, setData] = useState(generateRandomData())
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [growth, setGrowth] = useState(12.5)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => { setTotalRevenue(data.reduce((sum, item) => sum + item.value, 0)) }, [data])
  useEffect(() => { const i = setInterval(() => { setData(generateRandomData()); setGrowth(Math.round((Math.random() * 20 + 5) * 10) / 10) }, 4000); return () => clearInterval(i) }, [])
  useEffect(() => { const i = setInterval(() => { setActiveIndex((prev) => (prev + 1) % revenueCategories.length) }, 2000); return () => clearInterval(i) }, [])

  return (
    <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}
      className="w-full max-w-md mx-auto rounded-3xl bg-white p-8" style={{ boxShadow: "rgba(14,63,126,0.06) 0px 0px 0px 1px, rgba(42,51,69,0.04) 0px 1px 1px -0.5px, rgba(42,51,70,0.06) 0px 6px 6px -3px, rgba(42,51,70,0.06) 0px 12px 12px -6px, rgba(14,63,126,0.06) 0px 24px 24px -12px" }}>
      <div className="mb-8 flex items-center justify-between">
        <div><h3 className="text-lg font-semibold text-slate-900">Hosting Revenue</h3><p className="text-sm text-slate-500">This Quarter</p></div>
        <div className="text-right">
          <motion.p key={totalRevenue} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-slate-900">${totalRevenue.toLocaleString()}</motion.p>
          <motion.div key={growth} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-end gap-1"><TrendingUp className="w-3 h-3 text-emerald-600" /><p className="text-sm font-medium text-emerald-600">+{growth}%</p></motion.div>
        </div>
      </div>
      <div className="h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" animationDuration={1000}>
            {data.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} opacity={index === activeIndex ? 1 : 0.6} style={{ filter: index === activeIndex ? "drop-shadow(0 0 8px " + entry.color + ")" : "none", transition: "all 0.5s ease" }} />))}
          </Pie></PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait"><motion.div key={activeIndex} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.3 }} className="text-center">
            {(() => { const Icon = data[activeIndex].icon; return <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: data[activeIndex].color }} /> })()}
            <p className="text-xs text-slate-500">{data[activeIndex].name}</p>
          </motion.div></AnimatePresence>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {data.map((item, index) => { const Icon = item.icon; const pct = ((item.value / totalRevenue) * 100).toFixed(0); return (
          <motion.div key={item.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0, scale: index === activeIndex ? 1.02 : 1 }} transition={{ delay: index * 0.1, duration: 0.3 }} className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${index === activeIndex ? "bg-slate-50" : ""}`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: item.color + "20" }}><Icon className="w-4 h-4" style={{ color: item.color }} /></div>
            <span className="text-sm text-slate-600 flex-1">{item.name}</span>
            <div className="text-right"><motion.span key={item.value} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm font-semibold text-slate-900 block">${item.value.toLocaleString()}</motion.span><span className="text-xs text-slate-400">{pct}%</span></div>
          </motion.div>
        ) })}
      </div>
    </motion.div>
  )
}
