import { faqs } from '@/data/seo';
import { Section, SectionHeading } from '@/components/ui/section';
import { Reveal } from '@/components/ui/reveal';

/**
 * Preguntas frecuentes.
 *
 * Usa `<details>` nativo: funciona sin JavaScript, es accesible por teclado
 * de fábrica y los buscadores leen el contenido aunque esté plegado.
 * Las mismas preguntas alimentan el FAQPage del JSON-LD.
 */
export function Faq() {
  return (
    <Section id="preguntas" labelledBy="preguntas-titulo">
      <div className="shell">
        <div className="grid gap-x-[var(--space-gutter)] gap-y-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading
              id="preguntas-titulo"
              index="07"
              eyebrow="Preguntas frecuentes"
              title={
                <>
                  Lo que <span className="heading-highlight">siempre</span> nos preguntan.
                </>
              }
            />
          </div>

          <div className="lg:col-span-7 lg:col-start-6">
            <ul className="border-t border-border">
              {faqs.map((faq, index) => (
                <Reveal as="li" key={faq.question} delay={index * 40}>
                  <details className="group border-b border-border">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-[1.0625rem] font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                      <span>{faq.question}</span>
                      <span
                        aria-hidden="true"
                        className="mt-1 shrink-0 text-[1.1rem] leading-none text-accent transition-transform duration-300 ease-[var(--ease-editorial)] group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="pb-7 text-text-secondary">{faq.answer}</p>
                  </details>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}
