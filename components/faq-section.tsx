'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const faqs = [
  {
    question: 'How do I get started?',
    answer: 'Simply sign up for an account, add your properties, and start managing them through our platform. Our onboarding process takes just a few minutes.',
  },
  {
    question: 'What features are included?',
    answer: 'host4me includes tenant management, rent collection, maintenance tracking, financial reporting, and much more. Check our pricing page for detailed feature lists.',
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we use enterprise-grade encryption and security measures to protect your data. All information is stored securely and backed up regularly.',
  },
  {
    question: 'Can I integrate with other tools?',
    answer: 'Yes, host4me integrates with popular accounting software, payment processors, and other property management tools.',
  },
  {
    question: 'Do you offer customer support?',
    answer: 'We provide 24/7 customer support via email, chat, and phone. Our team is ready to help you with any questions.',
  },
  {
    question: 'What is your pricing model?',
    answer: 'We offer flexible pricing plans based on the number of properties you manage. There are no hidden fees or long-term contracts required.',
  },
]

export function FAQSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-zinc-900 mb-4">Frequently Asked Questions</h2>
          <p className="text-xl text-zinc-600">Find answers to common questions about host4me</p>
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
