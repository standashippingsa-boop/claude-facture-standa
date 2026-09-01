type BrandIconProps = {
  size?: number;
  className?: string;
  title?: string;
};

export function WhatsAppIcon({ size = 20, className, title }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.8 14.3c-.25.7-1.4 1.3-2 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.15-.2-1.2-1.6-1.2-3.1 0-1.5.8-2.2 1.1-2.5.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.25.6.8 2 .9 2.2.1.2.15.4 0 .6-.1.2-.2.3-.4.5-.2.2-.4.5-.5.6-.2.2-.4.4-.2.8.2.4.9 1.5 1.9 2.4 1.3 1.2 2.4 1.5 2.8 1.7.4.2.6.15.8-.1.2-.25.9-1 1.1-1.4.2-.4.4-.3.7-.2.3.1 1.9.9 2.2 1 .3.15.5.2.6.35.1.15.1.85-.15 1.55Z" />
    </svg>
  );
}

export function InstagramIcon({ size = 20, className, title }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.55" cy="6.55" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ size = 20, className, title }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M13.8 21v-8h2.7l.4-3.1h-3.1V7.95c0-.9.25-1.5 1.54-1.5H17V3.68c-.3-.04-1.32-.13-2.51-.13-2.49 0-4.19 1.52-4.19 4.31v2.04H7.5V13h2.8v8h3.5Z" />
    </svg>
  );
}

export function TikTokIcon({ size = 20, className, title }: BrandIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d="M14.5 3c.38 2.3 1.7 3.7 4 3.84v3.04c-1.48.14-2.77-.34-3.95-1.04v6.34c0 5.6-6.12 7.36-8.58 4.15-1.58-2.07-.61-5.7 2.98-6.25.44-.07.92-.05 1.36.05v3.17c-.34-.1-.7-.13-1.04-.06-1.16.22-1.52 1.52-1.04 2.3.92 1.5 3.87.98 3.85-1.98V3h2.42Z" />
    </svg>
  );
}
