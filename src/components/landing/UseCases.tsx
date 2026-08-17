"use client";

import { useState } from "react";
import { useCases } from "@/components/landing/content";
import { Reveal } from "@/components/landing/Reveal";
import { Eyebrow, Section } from "@/components/landing/ui";

export function UseCases() {
  const [active, setActive] = useState<(typeof useCases)[number]["id"]>(useCases[0].id);
  const selected = useCases.find((item) => item.id === active) ?? useCases[0];

  return (
    <Section id="use-cases">
      <Reveal>
        <Eyebrow>Automation opportunities</Eyebrow>
        <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-cloud sm:text-4xl">
          What can be automated?
        </h2>
      </Reveal>
      <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {useCases.map((item) => {
            const on = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                aria-pressed={on}
                className={`rounded-2xl border p-5 text-left transition-colors ${
                  on ? "border-brand/40 bg-brand/8" : "border-white/10 bg-ink-2 hover:border-white/16"
                }`}
              >
                <h3 className="text-lg font-medium text-cloud">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-mist">{item.description}</p>
              </button>
            );
          })}
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-2 p-5 sm:p-6">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-mist uppercase">Workflow</p>
          <h3 className="mt-2 text-xl font-medium text-cloud">{selected.title}</h3>
          <ol className="mt-6 space-y-0">
            {selected.flow.map((step, index) => (
              <li key={step} className="flex flex-col items-start">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-ink text-xs text-mist">
                    {index + 1}
                  </span>
                  <span className="text-sm text-cloud">{step}</span>
                </div>
                {index < selected.flow.length - 1 ? (
                  <span className="relative ml-4 h-5 w-px bg-gradient-to-b from-brand to-brand-3">
                    <span className="landing-packet" />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}
