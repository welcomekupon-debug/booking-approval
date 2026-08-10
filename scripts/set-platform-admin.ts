import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

// One-off CLI helper — flips is_platform_admin for a user by email.
// Run locally (needs .env.local): npx tsx scripts/set-platform-admin.ts you@example.com
//
// Exists as a fallback for when Drizzle Studio's web UI won't load — this
// talks to the database directly, no browser or proxy involved.

loadEnvConfig(process.cwd());

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/set-platform-admin.ts <email>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (expected in .env.local)");
  process.exit(1);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    const rows = await sql`
      update users
      set is_platform_admin = true, updated_at = now()
      where email = ${email}
      returning id, email, is_platform_admin
    `;

    if (rows.length === 0) {
      console.error(
        `No user found with email "${email}". Sign in to the app at least once first — that's what creates the row.`
      );
      process.exit(1);
    }

    console.log(`Done — ${rows[0].email} is now a platform admin.`);
  } finally {
    await sql.end();
  }
}

main();
