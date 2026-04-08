'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'How does Alfred learn my hosting style?',
    answer: 'When you connect your Airbnb or VRBO account, Alfred analyzes your past guest conversations to learn your tone, vocabulary, and communication patterns. Whether you\'re formal, friendly, or casual — Alfred mirrors it.',
  },
  {
    question: 'What platforms does Host4Me support?',
    answer: 'Host4Me currently supports Airbnb and VRBO, with Booking.com coming soon. Alfred manages guest communication across all connected platforms from a single interface.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes. All platform credentials are encrypted with AES-256-GCM. We use enterprise-grade security measures and never store plaintext passwords.',
  },
  {
    question: 'When does Alfred escalate to me?',
    answer: 'Alfred handles routine messages autonomously. Financial requests (refunds, price changes), emergencies, and anything outside your defined comfort zone gets escalated to you instantly via Telegram.',
  },
  {
    question: 'Can I review what Alfred sends before it goes out?',
    answer: 'Yes! You can start in Shadow Mode where Alfred drafts replies for your approval. Once you\'re confident, switch to autonomous mode and Alfred handles everything.',
  },
  {
    question: 'How fast does Alfred respond to guests?',
    answer: 'Alfred responds to guest messages in under 30 seconds, 24/7. This dramatically improves your response rate metrics on Airbnb and VRBO.',
  },
]

export function FAQSection() {
  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-zinc-600">Everything you need to know about Host4Me and Alfred</p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-lg font-medium">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-zinc-600">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
