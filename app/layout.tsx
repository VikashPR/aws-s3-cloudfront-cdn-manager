import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Media CDN Manager",
  description: "Open-source media CDN manager with S3 and CloudFront integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
