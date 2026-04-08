'use client'

const stats = [
  { label: 'Active Properties', value: '10,000+' },
  { label: 'Total Revenue Managed', value: '$500M+' },
  { label: 'Happy Users', value: '50,000+' },
  { label: 'Years in Business', value: '10+' },
]

export function StatsSection() {
  return (
    <section className="py-20 bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-bold mb-2">{stat.value}</div>
              <p className="text-zinc-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
