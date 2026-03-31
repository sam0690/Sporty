import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ActivityItem } from "@/components/dashboard/main-dashboard/types";

type RecentActivityProps = {
  items: ActivityItem[];
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card className="border-border-light bg-surface-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl text-text-primary">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="overflow-hidden rounded-lg border border-border-light">
          <div className="grid grid-cols-[1.2fr_2fr_auto] gap-3 bg-secondary-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            <span>Event</span>
            <span>Details</span>
            <span>Time</span>
          </div>
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[1.2fr_2fr_auto] gap-3 border-t border-border-light bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-text-primary">{item.title}</span>
                <span className="text-text-secondary">{item.detail}</span>
                <span className="text-text-secondary">{item.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
