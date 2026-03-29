import { Navbar } from "@/components/landing/navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-50">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
