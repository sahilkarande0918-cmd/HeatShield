import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

// Display: Archivo, a signage/wayfinding grotesk. Flat-sided and faintly
// institutional — public infrastructure rather than startup. See the note at
// the top of globals.css for why not Inter / Geist / Space Grotesk.
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

// Body + data: Plex was drawn for civic/enterprise work and ships a Devanagari
// companion, which matters for a tool that has to print Indian ward names.
const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'HeatShield — hyperlocal heat risk, and what to do about it',
  description:
    'Grid-level urban heat risk for Indian cities, forecast 72 hours ahead, with an optimizer that says where to put cooling relief.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        {/* The hero opens on this frame; fetching it with the document is what
            keeps the fold from starting black. */}
        <link rel="preload" as="image" href="/hero-poster.jpg" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
