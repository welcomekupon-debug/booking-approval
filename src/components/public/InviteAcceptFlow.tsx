"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button, Card } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

type InviteStatus = "pending" | "accepted" | "revoked" | "expired" | "not_found";

interface Props {
  token: string;
  status: InviteStatus;
  salonName: string | null;
  invitedByName: string | null;
  email: string | null;
  roleLabel: string | null;
}

const STATUS_COPY: Record<Exclude<InviteStatus, "pending">, { title: string; body: string }> = {
  accepted: {
    title: "This invite has already been used",
    body: "Whoever accepted it can sign in to get to the dashboard.",
  },
  revoked: {
    title: "This invite was revoked",
    body: "Ask whoever invited you to send a new one.",
  },
  expired: {
    title: "This invite has expired",
    body: "Invite links are only valid for 7 days — ask for a new one.",
  },
  not_found: {
    title: "Invite link not found",
    body: "Double-check the link, or ask whoever invited you to resend it.",
  },
};

export function InviteAcceptFlow({
  token,
  status,
  salonName,
  invitedByName,
  email,
  roleLabel,
}: Props) {
  const router = useRouter();
  const { isSignedIn, user, isLoaded } = useUser();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTarget = `/invite/${token}`;
  const signedInEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const emailMatches = !!email && signedInEmail === email.toLowerCase();

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't accept this invite.");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't accept this invite.");
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-7 animate-fade-up">
        <div className="w-11 h-11 rounded-2xl bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center mb-5">
          <Icon name="users" className="w-5 h-5 text-gold-600" />
        </div>

        {status !== "pending" ? (
          <>
            <h1 className="text-lg font-bold text-ink-900 dark:text-ink-50">
              {STATUS_COPY[status].title}
            </h1>
            <p className="text-sm text-ink-400 mt-2">{STATUS_COPY[status].body}</p>
            {status === "accepted" && (
              <Button variant="primary" className="mt-5" onClick={() => router.push("/")}>
                Go to dashboard
              </Button>
            )}
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-ink-900 dark:text-ink-50">
              You&apos;re invited to join {salonName}
            </h1>
            <p className="text-sm text-ink-400 mt-2">
              {invitedByName ? `${invitedByName} invited` : "You've been invited"} you
              to join as <span className="font-semibold text-ink-600 dark:text-ink-300">{roleLabel}</span>.
              This invite was sent to{" "}
              <span className="font-semibold text-ink-600 dark:text-ink-300">{email}</span>.
            </p>

            {error && (
              <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5 mt-4">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2.5">
              {!isLoaded ? (
                <p className="text-sm text-ink-400">Loading…</p>
              ) : !isSignedIn ? (
                <>
                  <Button
                    variant="primary"
                    onClick={() => router.push(`/sign-up?redirect_url=${encodeURIComponent(redirectTarget)}`)}
                  >
                    Create account &amp; join
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`)}
                  >
                    I already have an account
                  </Button>
                </>
              ) : emailMatches ? (
                <Button variant="primary" loading={accepting} onClick={accept}>
                  Accept &amp; join {salonName}
                </Button>
              ) : (
                <>
                  <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3.5 py-2.5">
                    You&apos;re signed in as {signedInEmail}, but this invite was sent to{" "}
                    {email}. Sign in with that email to accept it.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => router.push(`/sign-in?redirect_url=${encodeURIComponent(redirectTarget)}`)}
                  >
                    Switch account
                  </Button>
                </>
              )}
            </div>
          </>
        )}

        <p className="text-[11px] text-ink-300 dark:text-ink-600 mt-6 text-center">
          Powered by Bookline
        </p>
      </Card>
    </div>
  );
}
