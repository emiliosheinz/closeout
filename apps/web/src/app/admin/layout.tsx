import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s | Administração", default: "Administração" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-dvh bg-paper">{children}</div>;
}
