"use client";

import { useState } from "react";
import { faqs } from "@/components/landing/content";
import { Reveal } from "@/components/landing/Reveal";
import { Section } from "@/components/landing/ui";

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section>
      <Reveal>
        <h2 className="text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">Questions</h2>
      </Reveal>
      <div className="mt-8 divide-y divide-white/10 rounded-2xl border border-white/10 bg-ink-2">
        {faqs.map((item, index) => {
          const expanded = open === index;
          return (
            <div key={item.q}>
              <h3>
                <button
                  type="button"
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-cloud sm:text-base"
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  {item.q}
                  <span aria-hidden className="text-mist">
                    {expanded ? "–" : "+"}
                  </span>
                </button>
              </h3>
              {expanded ? <p className="px-5 pb-5 text-sm leading-7 text-mist">{item.a}</p> : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
