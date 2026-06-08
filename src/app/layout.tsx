import { ClerkProvider, SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
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
      <body className="bg-gray-50 min-h-screen antialiased">
        <ClerkProvider>
          <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
            <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
              <span className="font-semibold text-gray-800">Booking Approvals</span>
              <div className="flex items-center gap-3">
                <Show when="signed-out">
                  <SignInButton mode="modal">
                    <button className="px-4 py-1.5 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors">
                      Sign in
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
                      Sign up
                    </button>
                  </SignUpButton>
                </Show>
                <Show when="signed-in">
                  <UserButton />
                </Show>
              </div>
            </div>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}