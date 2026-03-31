"use client";

type Activity = {
  type: "transfer" | "lineup";
  description: string;
  date: string;
};

type RecentActivityProps = {
  recentActivity: Activity[];
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RecentActivity({ recentActivity }: RecentActivityProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5">
      <h3 className="text-base font-medium text-gray-900">Recent Activity</h3>

      <ul className="mt-4 space-y-3">
        {recentActivity.map((activity, index) => (
          <li key={`${activity.type}-${activity.date}-${index}`} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 p-3">
            <div>
              <p className="text-sm text-gray-900">{activity.description}</p>
              <p className="mt-1 text-xs text-gray-500">{activity.type === "transfer" ? "Transfer" : "Lineup"}</p>
            </div>
            <span className="text-xs text-gray-500">{formatDate(activity.date)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type { Activity };
