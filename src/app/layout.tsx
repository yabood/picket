import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Picket',
  description: 'Regulatory-mandate intelligence pipeline for Elastio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
