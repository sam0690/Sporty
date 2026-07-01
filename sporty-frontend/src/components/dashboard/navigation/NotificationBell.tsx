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
    const initialLoadId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    const id = window.setInterval(() => {
      void loadNotifications();
    }, 300_000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(initialLoadId);
    };
  }, []);

  const onRead = async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    );
    try {
      await markNotificationRead(id);
    } catch {
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
          color="#DC2626"
        >
          <ActionIcon
            variant="transparent"
            aria-label="Notifications"
            className={cn(
              "border border-border bg-transparent text-ink-muted transition-colors hover:border-border-strong hover:text-ink",
              className,
            )}
            onClick={() => setOpened((value) => !value)}
          >
            <Bell size={16} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
        }}
      >
        <Text
          fw={700}
          size="xs"
          mb="xs"
          style={{
            fontFamily: "var(--font-condensed)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--ink)",
          }}
        >
          Notifications
        </Text>

        {loading ? (
          <Text size="sm" style={{ color: "var(--ink-muted)" }}>
            Loading notifications...
          </Text>
        ) : items.length === 0 ? (
          <Text size="sm" style={{ color: "var(--ink-muted)" }}>
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
                    "w-full rounded-sm border px-3 py-2 text-left text-sm transition-colors",
                    item.is_read
                      ? "border-border bg-transparent text-ink-muted hover:border-border-strong hover:text-ink"
                      : "border-primary/25 bg-primary-soft text-ink hover:border-primary/50",
                  )}
                >
                  <p>{item.message}</p>
                  <p className="mt-1 text-xs text-ink-muted">
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
