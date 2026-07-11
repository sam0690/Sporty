import { Navbar } from "@/components/landing/navbar";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-shell flex min-h-screen flex-col bg-background text-fg-1">
      <Navbar />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
