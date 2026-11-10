import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = { title: "Instagram · Marcelle Rosa Advocacia" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header>
          <strong>Instagram · MRA</strong>
          <nav>
            <Link href="/">Automações</Link>
            <Link href="/leads">Leads</Link>
            <Link href="/config">Configurações</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
