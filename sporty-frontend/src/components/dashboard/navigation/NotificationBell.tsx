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
          color="#e2c368"
        >
          <ActionIcon
            variant="transparent"
            aria-label="Notifications"
            className={cn(
              "border border-white/8 bg-transparent text-fg-3 transition-colors hover:border-white/15 hover:text-fg-1",
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
          background: "#111117",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "3px",
        }}
      >
        <Text
          fw={700}
          size="xs"
          mb="xs"
          style={{
            fontFamily: "var(--font-sans)",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "#f2f2f0",
          }}
        >
          Notifications
        </Text>

        {loading ? (
          <Text size="sm" style={{ color: "#71717d" }}>
            Loading notifications...
          </Text>
        ) : items.length === 0 ? (
          <Text size="sm" style={{ color: "#71717d" }}>
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
                    "w-full rounded-[3px] border px-3 py-2 text-left text-sm transition-colors",
                    item.is_read
                      ? "border-white/8 bg-transparent text-fg-3 hover:border-white/15 hover:text-fg-1"
                      : "border-accent/20 bg-accent/8 text-fg-1 hover:border-accent/40",
                  )}
                >
                  <p>{item.message}</p>
                  <p className="mt-1 text-xs text-fg-3">
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
