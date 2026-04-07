"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import {
  ActionIcon,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import {
  fetchNotifications,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api/notifications";

type NotificationBellProps = {
  className?: string;
};

export function NotificationBell({ className }: NotificationBellProps) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.is_read).length,
    [items],
  );

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
    const id = window.setInterval(() => {
      void loadNotifications();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const onRead = async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );
    try {
      await markNotificationRead(id);
    } catch {
      // silent rollback fetch to sync state
      void loadNotifications();
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={340}
      position="bottom-end"
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Indicator
          inline
          label={unreadCount > 9 ? "9+" : unreadCount}
          disabled={unreadCount === 0}
          size={16}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Notifications"
            className={className}
            onClick={() => setOpened((value) => !value)}
          >
            <Bell size={18} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown>
        <Text fw={600} size="sm" mb="xs">
          Notifications
        </Text>

        {loading ? (
          <Text size="sm" c="dimmed">
            Loading notifications...
          </Text>
        ) : items.length === 0 ? (
          <Text size="sm" c="dimmed">
            No notifications yet.
          </Text>
        ) : (
          <ScrollArea.Autosize mah={280}>
            <Stack gap="xs">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void onRead(item.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    item.is_read
                      ? "border-gray-100 bg-white text-gray-500"
                      : "border-blue-100 bg-blue-50 text-gray-800"
                  }`}
                >
                  <p>{item.message}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </button>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
