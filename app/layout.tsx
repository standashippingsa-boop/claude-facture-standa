import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "STANDA COMMERCIAL — Gestion de colis & facturation",
  description: "Logiciel interne de gestion de colis et de facturation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ht">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
