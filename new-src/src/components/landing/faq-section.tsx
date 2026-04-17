import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"

const faqs = [
  { question: "How does Host4Me's AI work?", answer: "Our AI analyzes your property, market data, and guest patterns to automate messaging, optimize pricing, and generate listing descriptions. It learns and improves over time to maximize your occupancy and revenue." },
  { question: "What does Host4Me cost?", answer: "Host4Me offers flexible plans starting with a free tier for a single property. Our Pro plan covers up to 10 properties with full AI features, and our Enterprise plan is designed for large-scale hosts and property managers." },
  { question: "Does Host4Me work with Airbnb and VRBO?", answer: "Yes! Host4Me integrates with all major booking platforms including Airbnb, VRBO, Booking.com, and more. We sync your calendars, messages, and pricing across all channels automatically." },
  { question: "How does automated guest communication work?", answer: "Our AI concierge responds to guest inquiries instantly, sends check-in instructions, handles common questions, and even writes personalized review responses — all in the guest's preferred language." },
  { question: "Can I still control my properties manually?", answer: "Absolutely. Host4Me gives you full control with AI-powered suggestions. You can approve or override any AI decision, set custom rules, and choose which tasks to automate and which to handle yourself." },
  { question: "Is my data secure?", answer: "Yes, we use bank-level encryption and never share your data with third parties. All guest information is handled in compliance with Canadian privacy laws and PIPEDA regulations." },
]

export function FAQSection() {
  return (
    <section id="faq" className="py-32 px-6 pb-80">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-normal mb-6 text-balance font-serif">Frequently asked questions</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">Everything you need to know about Host4Me. Have a question not listed? Contact our support.</p>
        </div>
        <Accordion type="single" collapsible className="space-y-3 py-0 my-0">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-foreground/30">
              <AccordionTrigger className="text-left text-base font-medium text-foreground hover:no-underline py-5">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed text-sm">{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
