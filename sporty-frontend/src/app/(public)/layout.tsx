import { Navbar } from "@/components/landing/navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-shell min-h-screen bg-surface">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
