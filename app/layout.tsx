import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Do código à supervisão — Uma pesquisa para explorar",
  description: "Explore uma ilha interativa sobre inteligência artificial e o trabalho de desenvolver software. Pesquisa de Pedro Arthur Oliveira Januário, evolução das ferramentas, evidências e TCC completo.",
  icons: { icon: "/experience/world/poster.webp" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
