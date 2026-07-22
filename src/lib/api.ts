import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/errors";

/**
 * Route wrapper: translates typed errors into HTTP responses so route
 * handlers contain zero error-handling boilerplate.
 */
export async function handleRoute<T>(
  fn: () => Promise<T>
): Promise<NextResponse> {
  try {
    const result = await fn();
    return NextResponse.json(result ?? { success: true });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return NextResponse.json(
        {
          error: `Invalid input${first ? `: ${first.path.join(".")} — ${first.message}` : "."}`,
        },
        { status: 400 }
      );
    }
    console.error("[api]", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
