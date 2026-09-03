import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CapiBloques | Programa tu Wemos D1 R32 jugando',
  description:
    'Editor visual para crear, simular y exportar programas no bloqueantes para Wemos D1 R32.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
