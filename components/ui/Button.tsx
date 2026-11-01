import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Bouton STANDA — une seule définition des styles (class-variance-authority).
 *   <Button>Valider</Button>                       → bleu marine
 *   <Button variant="accent" size="lg">…</Button>  → orange (action principale)
 *   <a className={buttonVariants({ variant: "outline" })}>…</a>  → même style sur un lien
 */
export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
  {
    variants: {
      variant: {
        primary: "bg-navy text-white hover:bg-navy-dark",
        accent: "bg-accent text-white hover:bg-accent-dark",
        outline: "border border-navy/15 bg-white text-navy hover:border-navy",
        ghost: "bg-transparent text-navy hover:bg-navy/5",
        danger: "bg-red-600 text-white hover:bg-red-700"
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        md: "h-11 px-5 text-[14px]",
        lg: "h-12 px-6 text-[15px]"
      },
      block: { true: "w-full" }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, block, type = "button", ...props }, ref) {
  return <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
});

export default Button;
