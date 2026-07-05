"use client";

import { AdminRoute } from "@/components/auth/AdminRoute";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminRoute minRole="support">{children}</AdminRoute>;
}
