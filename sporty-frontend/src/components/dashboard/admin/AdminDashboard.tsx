"use client";

import Link from "next/link";
import { ROUTES } from "@/lib/route.config";
import { useAdminUsers } from "@/hooks/admin/useAdminUsers";
import { useAdminLeagues } from "@/hooks/admin/useAdminLeagues";
import { useAdminAuditLog } from "@/hooks/admin/useAdminAuditLog";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-surface p-5">
      <p className="section-label">{label}</p>
      <p className="mt-2 font-display text-5xl tracking-[-0.02em] text-accent">{value}</p>
    </div>
  );
}

function NavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="block card-surface p-5 transition-colors hover:border-white/25 hover:no-underline"
    >
      <p className="font-sans text-sm font-700 uppercase tracking-[2px] text-fg-1">
        {title}
      </p>
      <p className="mt-1 text-xs text-fg-3">{description}</p>
    </Link>
  );
}

export function AdminDashboard() {
  const { data: users } = useAdminUsers({ page: 1, pageSize: 1 });
  const { data: leagues } = useAdminLeagues({ page: 1, pageSize: 1 });
  const { data: auditLog } = useAdminAuditLog({ page: 1, pageSize: 1 });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl tracking-[-0.02em] text-fg-1">Admin</h1>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard label="Total Users" value={users?.total ?? "—"} />
        <StatCard label="Total Leagues" value={leagues?.total ?? "—"} />
        <StatCard label="Admin Actions Logged" value={auditLog?.total ?? "—"} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NavCard
          href={ROUTES.ADMIN_USERS.path}
          title="Users"
          description="Suspend, reactivate, force-logout, and manage roles."
        />
        <NavCard
          href={ROUTES.ADMIN_LEAGUES.path}
          title="Leagues"
          description="Platform-wide league oversight and overrides."
        />
        <NavCard
          href={ROUTES.ADMIN_AUDIT_LOG.path}
          title="Audit Log"
          description="Every admin action, who did it, and why."
        />
        <NavCard
          href={ROUTES.ADMIN_SCORING.path}
          title="Scoring"
          description="Recalculate windows and lock/unlock transfers or lineups."
        />
        <NavCard
          href={ROUTES.ADMIN_PLAYERS.path}
          title="Players"
          description="Edit player data and trigger repricing."
        />
        <NavCard
          href={ROUTES.ADMIN_TRANSACTIONS.path}
          title="Transactions"
          description="Override trades, waivers, and reverse transfers."
        />
        <NavCard
          href={ROUTES.ADMIN_JOBS.path}
          title="Jobs"
          description="Celery worker/beat status and Kafka consumer liveness."
        />
        <NavCard
          href={ROUTES.ADMIN_CONFIG.path}
          title="Config"
          description="Runtime feature-flag overrides."
        />
        <NavCard
          href={ROUTES.ADMIN_TICKETS.path}
          title="Tickets"
          description="Support queue — assign, reply, resolve."
        />
      </div>
    </div>
  );
}
