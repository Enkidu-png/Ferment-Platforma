import type { Metadata } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { TRPCReactProvider } from '@/trpc/client';
import { Toaster } from '@/components/ui/sonner';

import '../(app)/globals.css';

export const metadata: Metadata = {
  title: 'Admin — Ferment',
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        style={{ fontFamily: "'VCR OSD Mono', monospace" }}
      >
        <NuqsAdapter>
          <TRPCReactProvider>
            {children}
            <Toaster />
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
