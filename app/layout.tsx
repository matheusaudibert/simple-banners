import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simple Banners",
  description:
    "Gerador de banners simples: foto, título, subtítulo, sub-subtítulo e colagem — exporta PNG.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-canvas text-ink antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
