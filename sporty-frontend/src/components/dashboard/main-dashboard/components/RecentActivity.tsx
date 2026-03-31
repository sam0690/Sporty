import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ActivityItem } from "@/components/dashboard/main-dashboard/types";

type RecentActivityProps = {
  items: ActivityItem[];
};

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <Card className="rounded-2xl border border-gray-100 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-medium text-gray-900">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <div className="grid grid-cols-[1.2fr_2fr_auto] gap-3 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <span>Event</span>
            <span>Details</span>
            <span>Time</span>
          </div>
          <ul>
            {items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[1.2fr_2fr_auto] gap-3 border-t border-gray-100 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-gray-900">{item.title}</span>
                <span className="text-gray-500">{item.detail}</span>
                <span className="text-gray-500">{item.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
