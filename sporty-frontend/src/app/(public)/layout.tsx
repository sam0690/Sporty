import { Navbar } from "@/components/landing/navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-shell min-h-screen bg-background text-foreground">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
