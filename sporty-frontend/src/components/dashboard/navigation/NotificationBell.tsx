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
import { cn } from "@/utils/classUtils";
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
      shadow="xl"
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
            variant="light"
            color="cyan"
            aria-label="Notifications"
            className={cn(
              "border border-white/10 bg-white/6 text-slate-100 transition-all hover:-translate-y-0.5 hover:border-accent-primary/30 hover:bg-accent-primary/10",
              className,
            )}
            onClick={() => setOpened((value) => !value)}
          >
            <Bell size={18} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown className="border border-white/10 bg-[#0b1120] text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <Text fw={700} size="sm" mb="xs" className="text-foreground">
          Notifications
        </Text>

        {loading ? (
          <Text size="sm" c="dimmed" className="text-slate-400">
            Loading notifications...
          </Text>
        ) : items.length === 0 ? (
          <Text size="sm" c="dimmed" className="text-slate-400">
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
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left text-sm transition-all hover:border-accent-primary/30 hover:bg-white/8",
                    item.is_read
                      ? "border-white/10 bg-white/5 text-slate-300"
                      : "border-accent-primary/20 bg-accent-primary/10 text-foreground",
                  )}
                >
                  <p>{item.message}</p>
                  <p className="mt-1 text-xs text-slate-400">
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
