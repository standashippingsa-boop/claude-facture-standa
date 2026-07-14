"use client";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const PUBLIC_PREFIXES = ["/inscription", "/login", "/espace-client", "/reset-password"];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const isPublic = PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  if (isPublic) return <main className="min-h-screen">{children}</main>;
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
