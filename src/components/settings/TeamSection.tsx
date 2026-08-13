"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import { roleLabelsFor } from "@/lib/roleLabels";

type MembershipRole = "owner" | "manager" | "stylist" | "receptionist";

const RANK: Record<MembershipRole, number> = {
  owner: 4,
  manager: 3,
  receptionist: 2,
  stylist: 1,
};

interface MemberRow {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  role: MembershipRole;
  staffId: string | null;
  joinedAt: string;
}

interface InviteRow {
  id: string;
  email: string;
  role: MembershipRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
  acceptUrl: string;
}

interface TeamResponse {
  currentUserId: string;
  currentRole: MembershipRole;
  members: MemberRow[];
  invitations: InviteRow[];
}

/**
 * Hover cloud explaining what each non-owner role can and can't do, sourced
 * from the actual `requireRole` gates in the API routes — not just a guess.
 * Owner is deliberately left out since it can do everything.
 */
function RolePermissionsInfo({
  labels,
}: {
  labels: Record<MembershipRole, string>;
}) {
  const entries: { role: MembershipRole; description: string }[] = [
    {
      role: "manager",
      description:
        "Everything below, plus business settings, services & pricing, promotions, the business logo, and inviting or managing the team.",
    },
    {
      role: "stylist",
      description:
        "Can manage appointments and customers. Reviews are limited to the ones tied to their own linked profile.",
    },
    {
      role: "receptionist",
      description:
        "Can manage appointments and customers. Reviews are limited to the ones tied to their own linked profile.",
    },
  ];

  return (
    <span className="relative inline-flex group/info">
      <button
        type="button"
        className="p-1 rounded-full text-ink-300 hover:text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 transition-colors"
        aria-label="What can each role do?"
      >
        <Icon name="shield" className="w-3.5 h-3.5" />
      </button>
      <span className="pointer-events-none absolute left-0 top-full mt-2 z-40 hidden group-hover/info:block group-focus-within/info:block w-72 rounded-xl bg-ink-900 dark:bg-ink-50 px-4 py-3.5 shadow-pop animate-fade-in">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50 dark:text-ink-900/50 mb-2.5">
          What each role can do
        </span>
        <span className="flex flex-col gap-2.5">
          {entries.map((e) => (
            <span key={e.role} className="block">
              <span className="block text-xs font-bold text-white dark:text-ink-900">
                {labels[e.role]}
              </span>
              <span className="block text-[11px] text-white/75 dark:text-ink-900/75 leading-snug mt-0.5">
                {e.description}
              </span>
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function TeamSection({
  businessCategory,
  staffList,
}: {
  businessCategory: string;
  staffList: { id?: string; name: string }[];
}) {
  const labels = useMemo(
    () => roleLabelsFor(businessCategory as Parameters<typeof roleLabelsFor>[0]),
    [businessCategory]
  );

  const [data, setData] = useState<TeamResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MembershipRole>("stylist");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [freshInviteUrl, setFreshInviteUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't load your team.");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your team.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const myRank = data ? RANK[data.currentRole] : 0;
  const assignableRoles = (Object.keys(RANK) as MembershipRole[])
    .filter((r) => RANK[r] <= myRank)
    .sort((a, b) => RANK[b] - RANK[a]);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't send the invite.");
      setInviteEmail("");
      setFreshInviteUrl(body.acceptUrl ?? null);
      await load();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Couldn't send the invite.");
    } finally {
      setInviting(false);
    }
  }

  async function copyLink(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function revokeInvite(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/team/invite/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(membershipId: string, role: MembershipRole) {
    setBusyId(membershipId);
    setError(null);
    try {
      const res = await fetch(`/api/team/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't change that role.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that role.");
    } finally {
      setBusyId(null);
    }
  }

  async function linkStaff(membershipId: string, staffId: string | null) {
    setBusyId(membershipId);
    setError(null);
    try {
      const res = await fetch(`/api/team/${membershipId}/staff`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't link that staff profile.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't link that staff profile.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(membershipId: string, name: string) {
    if (!window.confirm(`Remove ${name} from your team?`)) return;
    setBusyId(membershipId);
    setError(null);
    try {
      const res = await fetch(`/api/team/${membershipId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't remove that person.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that person.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="animate-fade-up">
        <div className="relative z-20 px-6 pt-5 pb-4 border-b border-ink-50 dark:border-ink-800">
          <div className="flex items-center gap-1">
            <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">
              Team members
            </h2>
            <RolePermissionsInfo labels={labels} />
          </div>
          <p className="text-xs text-ink-400 mt-1">
            Everyone with access to this account, and what they can do.
          </p>
        </div>
        <div className="px-6 py-5">
          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl px-3.5 py-2.5 mb-4">
              {error}
            </p>
          )}

          {!data ? (
            <p className="text-sm text-ink-400">Loading…</p>
          ) : (
            <div className="flex flex-col divide-y divide-ink-50 dark:divide-ink-800">
              {data.members.map((m) => {
                const canManage = RANK[data.currentRole] >= RANK[m.role];
                const isSelf = m.userId === data.currentUserId;
                const canLinkStaff = RANK[data.currentRole] >= RANK.manager;
                const linkedStaff = staffList.find((s) => s.id === m.staffId);
                return (
                  <div key={m.membershipId} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-300 flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(m.name, m.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                          {m.name || m.email}
                          {isSelf && <span className="text-ink-400 font-normal"> (you)</span>}
                        </p>
                        <p className="text-[11px] text-ink-400 truncate">{m.email}</p>
                      </div>
                      {canManage && !isSelf ? (
                        <Select
                          value={m.role}
                          disabled={busyId === m.membershipId}
                          onChange={(e) =>
                            changeRole(m.membershipId, e.target.value as MembershipRole)
                          }
                          className="w-auto text-xs py-1.5"
                        >
                          {assignableRoles.map((r) => (
                            <option key={r} value={r}>
                              {labels[r]}
                            </option>
                          ))}
                          {!assignableRoles.includes(m.role) && (
                            <option value={m.role}>{labels[m.role]}</option>
                          )}
                        </Select>
                      ) : (
                        <Badge tone="grey">{labels[m.role]}</Badge>
                      )}
                      {canManage && !isSelf && (
                        <button
                          onClick={() => removeMember(m.membershipId, m.name || m.email)}
                          disabled={busyId === m.membershipId}
                          className="p-2 rounded-xl text-ink-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          aria-label={`Remove ${m.name || m.email}`}
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {canLinkStaff && (
                      <div className="flex items-center gap-2 mt-2 ml-12">
                        <span className="text-[11px] text-ink-400 shrink-0">
                          Staff profile:
                        </span>
                        <Select
                          value={m.staffId ?? ""}
                          disabled={busyId === m.membershipId}
                          onChange={(e) =>
                            linkStaff(m.membershipId, e.target.value || null)
                          }
                          className="w-auto text-xs py-1"
                        >
                          <option value="">Not linked</option>
                          {staffList
                            .filter((s) => s.id)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </Select>
                        {!linkedStaff && m.staffId && (
                          <span className="text-[11px] text-amber-600">
                            (linked profile no longer exists)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="animate-fade-up">
        <div className="px-6 pt-5 pb-4 border-b border-ink-50 dark:border-ink-800">
          <h2 className="text-base font-bold text-ink-900 dark:text-ink-50">
            Invite someone
          </h2>
          <p className="text-xs text-ink-400 mt-1">
            They&apos;ll get an email with a link to join — no shared logins,
            each person signs in with their own account.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@email.com"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && sendInvite()}
            />
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MembershipRole)}
              className="sm:w-44"
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {labels[r]}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              icon="plus"
              loading={inviting}
              disabled={!inviteEmail.trim()}
              onClick={sendInvite}
            >
              Invite
            </Button>
          </div>
          {inviteError && <p className="text-xs text-rose-600 mt-2">{inviteError}</p>}

          {freshInviteUrl && (
            <div className="mt-4 rounded-xl border border-gold-200 dark:border-gold-800 bg-gold-50/50 dark:bg-gold-900/10 p-4">
              <p className="text-xs font-bold text-ink-700 dark:text-ink-200 mb-2">
                Invite sent. If the email doesn&apos;t arrive, share this link directly —
                it works the same either way.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 truncate text-xs font-mono bg-white dark:bg-ink-900 border border-gold-200 dark:border-gold-800 rounded-lg px-3 py-2">
                  {freshInviteUrl}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={copiedId === "fresh" ? "check" : "note"}
                  onClick={() => copyLink(freshInviteUrl, "fresh")}
                >
                  {copiedId === "fresh" ? "Copied" : "Copy"}
                </Button>
                <button
                  onClick={() => setFreshInviteUrl(null)}
                  className="p-1.5 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-colors"
                  aria-label="Dismiss"
                >
                  <Icon name="x" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {data && data.invitations.length > 0 && (
            <div className="mt-5 flex flex-col divide-y divide-ink-50 dark:divide-ink-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-300 dark:text-ink-600 pb-2">
                Pending invites
              </p>
              {data.invitations.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 py-3">
                  <Icon name="send" className="w-4 h-4 text-ink-300 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">
                      {inv.email}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {labels[inv.role]}
                    </p>
                  </div>
                  <Badge
                    tone={
                      inv.status === "pending"
                        ? "amber"
                        : inv.status === "expired"
                          ? "grey"
                          : "grey"
                    }
                  >
                    {inv.status === "pending" ? "Pending" : inv.status === "expired" ? "Expired" : "Revoked"}
                  </Badge>
                  {inv.status === "pending" && (
                    <>
                      <button
                        onClick={() => copyLink(inv.acceptUrl, inv.id)}
                        className="p-2 rounded-xl text-ink-300 hover:text-gold-600 hover:bg-gold-50 dark:hover:bg-gold-900/20 transition-colors"
                        aria-label={`Copy invite link for ${inv.email}`}
                      >
                        <Icon name={copiedId === inv.id ? "check" : "note"} className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => revokeInvite(inv.id)}
                        disabled={busyId === inv.id}
                        className="p-2 rounded-xl text-ink-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        aria-label={`Revoke invite to ${inv.email}`}
                      >
                        <Icon name="x" className="w-4 h-4" />
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
