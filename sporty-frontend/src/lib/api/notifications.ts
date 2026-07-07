import { authApi } from "@/api/auth-api-client";

export type NotificationItem = {
  id: string;
  user_id: string;
  league_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
};

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await authApi.get<NotificationItem[]>("/notifications");
  return res.data;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationItem> {
  const res = await authApi.patch<NotificationItem>(
    `/notifications/${notificationId}/read`,
  );
  return res.data;
}
