import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Public API: API-key authenticated (bookings) or free-busy only (availability)
  "/api/public(.*)",
  // Public booking pages
  "/book(.*)",
  // Public "manage your booking" page — token-gated instead of Clerk-gated
  "/manage(.*)",
  // Scheduled jobs — no Clerk session (called by Vercel Cron), protected by CRON_SECRET instead
  "/api/cron(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
