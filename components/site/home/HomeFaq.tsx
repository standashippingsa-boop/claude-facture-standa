"use client";
/** Questions fréquentes : accordéon accessible au clavier (Radix). */
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

export type FaqItem = { q: string; a: React.ReactNode };

export default function HomeFaq({ items }: { items: FaqItem[] }) {
  return (
    <Accordion.Root type="single" collapsible className="divide-y divide-std-navy/10 overflow-hidden rounded-2xl bg-white ring-1 ring-std-navy/10">
      {items.map((item, i) => (
        <Accordion.Item key={item.q} value={`q${i}`}>
          <Accordion.Header>
            <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[14.5px] font-semibold text-std-ink transition hover:bg-std-bg focus:outline-none focus-visible:bg-std-bg focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-std-orange">
              {item.q}
              <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-std-mute transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden text-[14px] leading-relaxed text-std-mute data-[state=closed]:animate-none">
            <div className="px-5 pb-4">{item.a}</div>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
