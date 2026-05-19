import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking Approvals",
  description: "Review and approve or decline pending bookings",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen antialiased">{children}</body>
    </html>
  );
}
