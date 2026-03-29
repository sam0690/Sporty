"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen">
        <aside className="hidden w-64 border-r border-surface-200 bg-white lg:block">
          <div className="p-6">
            <h2 className="text-lg font-bold text-primary">Sporty</h2>
          </div>
        </aside>

        <main className="flex-1 bg-surface-50 p-6">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
