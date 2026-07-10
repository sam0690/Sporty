"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardNavigation } from "@/components/dashboard/navigation/DashboardNavigation";

export default function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <DashboardNavigation>{children}</DashboardNavigation>
      {modal}
    </ProtectedRoute>
  );
}
