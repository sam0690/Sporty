"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Inbox } from "lucide-react";
import { cn } from "@/utils/classUtils";
import { EmptyState } from "@/components/ui";
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
  const panelRef = useRef<HTMLDivElement>(null);

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

  // Escape-to-close + focus the panel so keyboard users land somewhere
  // sensible on open (dropdown isn't a native <dialog>, so this doesn't come
  // for free the way it does for Modal).
  useEffect(() => {
    if (!opened) {
      return;
    }
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpened(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [opened]);

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
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={opened}
        onClick={() => setOpened((value) => !value)}
        className={cn(
          "relative inline-flex size-8 items-center justify-center rounded-[3px] border border-white/8 bg-transparent text-fg-3 transition-colors hover:border-white/15 hover:text-fg-1",
          className,
        )}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-sans text-[10px] font-700 text-surface-0">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {opened && (
        <>
          {/* Click-outside-to-close, mirrors a native dialog's backdrop click
              without the full-screen modal chrome a bell dropdown doesn't need. */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpened(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Notifications"
            className="absolute left-0 top-full z-50 mt-2 w-[340px] max-w-[calc(100vw-2rem)] card-surface p-3 shadow-xl outline-none"
          >
            <p className="mb-2 font-sans text-xs font-700 uppercase tracking-[2px] text-fg-1">
              Notifications
            </p>

            {loading ? (
              <p className="text-sm text-fg-3">Loading notifications...</p>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No notifications yet"
                className="!border-transparent !bg-transparent !py-6"
              />
            ) : (
              <div className="max-h-[280px] space-y-1.5 overflow-y-auto">
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
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
