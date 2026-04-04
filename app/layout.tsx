import type { Metadata } from "next";
import "./globals.css";
import { Poppins } from 'next/font/google';


export const metadata: Metadata = {
  title: "Guardian — AI Agent Firewall",
  description: "Policy-based firewall for AI agents, powered by Auth0",
};

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}