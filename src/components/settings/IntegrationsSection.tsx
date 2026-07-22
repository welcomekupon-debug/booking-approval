"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { formatRelativeTime } from "@/lib/relativeTime";

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * Online booking & API panel:
 * • the salon's public booking link
 * • API keys for machine callers (n8n → POST /api/public/bookings)
 */
export function IntegrationsSection() {
  const { salonSlug } = useWorkspace();
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bookingUrl =
    typeof window !== "undefined" && salonSlug
      ? `${window.location.origin}/book/${salonSlug}`
      : "";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) throw new Error((await res.json()).error);
      setKeys((await res.json()).keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load API keys.");
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function createKey() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create key.");
      setFreshKey(body.key);
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create key.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this key? Anything using it will stop working.")) {
      return;
    }
    await fetch("/api/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Public booking link */}
      <Card className="animate-fade-up">
        <div className="px-6 pt-5 pb-4 border-b border-ink-50 dark:border-ink-800">
          <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">
            Your booking page
          </h2>
          <p className="text-xs text-ink-400 mt-1">
            Share this link anywhere — customers see live availability and book
            directly.
          </p>
        </div>
        <div className="px-6 py-5">
          {salonSlug ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate text-sm font-semibold text-gold-700 dark:text-gold-300 bg-gold-50 dark:bg-gold-900/20 border border-gold-200 dark:border-gold-800 rounded-xl px-4 py-2.5">
                {bookingUrl || `/book/${salonSlug}`}
              </code>
              <Button
                variant="secondary"
                icon={copied === "url" ? "check" : "note"}
                onClick={() => copy(bookingUrl, "url")}
              >
                {copied === "url" ? "Copied" : "Copy"}
              </Button>
              <a
                href={`/book/${salonSlug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-2 rounded-xl bg-ink-900 text-white dark:bg-ink-50 dark:text-ink-900 hover:opacity-90 transition-opacity"
              >
                Preview
                <Icon name="arrowRight" className="w-4 h-4" />
              </a>
            </div>
          ) : (
            <p className="text-sm text-ink-400">
              Complete onboarding to get your booking link.
            </p>
          )}
          <p className="text-[11px] text-ink-400 mt-3">
            Only services marked “Active” in Settings → Services are bookable
            online.
          </p>
        </div>
      </Card>

      {/* API keys */}
      <Card className="animate-fade-up">
        <div className="px-6 pt-5 pb-4 border-b border-ink-50 dark:border-ink-800">
          <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">
            API keys
          </h2>
          <p className="text-xs text-ink-400 mt-1">
            For machine access — e.g. your n8n workflow posting Tally bookings
            to <code className="text-[11px]">POST /api/public/bookings</code>{" "}
            with header{" "}
            <code className="text-[11px]">Authorization: Bearer &lt;key&gt;</code>.
          </p>
        </div>
        <div className="px-6 py-5">
          {/* One-time key reveal */}
          {freshKey && (
            <div className="mb-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                Copy this key now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate text-xs font-mono bg-white dark:bg-ink-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  {freshKey}
                </code>
                <Button
                  size="sm"
                  variant="success"
                  icon={copied === "key" ? "check" : "note"}
                  onClick={() => copy(freshKey, "key")}
                >
                  {copied === "key" ? "Copied" : "Copy"}
                </Button>
                <button
                  onClick={() => setFreshKey(null)}
                  className="p-1.5 text-emerald-700 hover:text-emerald-900 transition-colors"
                  aria-label="Dismiss"
                >
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Create */}
          <div className="flex gap-2 mb-5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder='Key name — e.g. "n8n"'
              className="max-w-xs"
              onKeyDown={(e) => e.key === "Enter" && createKey()}
            />
            <Button
              variant="primary"
              icon="plus"
              loading={creating}
              disabled={!newName.trim()}
              onClick={createKey}
            >
              Create key
            </Button>
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5 mb-4">
              {error}
            </p>
          )}

          {/* List */}
          {keys === null ? (
            <p className="text-sm text-ink-400">Loading…</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-ink-400">No API keys yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-ink-50 dark:divide-ink-800">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 py-3">
                  <Icon name="shield" className="w-4 h-4 text-gold-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                      {k.name}{" "}
                      <code className="text-[11px] text-ink-400 font-mono">
                        {k.prefix}…
                      </code>
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {k.lastUsedAt
                        ? `Last used ${formatRelativeTime(k.lastUsedAt)}`
                        : "Never used"}
                    </p>
                  </div>
                  {k.revokedAt ? (
                    <Badge tone="grey">Revoked</Badge>
                  ) : (
                    <>
                      <Badge tone="green" dot>
                        Active
                      </Badge>
                      <button
                        onClick={() => revoke(k.id)}
                        className="p-2 rounded-xl text-ink-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        aria-label={`Revoke ${k.name}`}
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
