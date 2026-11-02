"use client";
/** Apparition douce au défilement (désactivée si la personne a réduit les animations). */
import { motion, useReducedMotion } from "motion/react";

type Props = { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "li" };

export default function Reveal({ children, delay = 0, className, as = "div" }: Props) {
  const reduce = useReducedMotion();
  if (reduce) return as === "li" ? <li className={className}>{children}</li> : <div className={className}>{children}</div>;
  const anim = {
    className,
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
  };
  return as === "li" ? <motion.li {...anim}>{children}</motion.li> : <motion.div {...anim}>{children}</motion.div>;
}
