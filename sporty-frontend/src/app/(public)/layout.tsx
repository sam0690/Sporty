import { Navbar } from "@/components/landing/navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="landing-shell min-h-screen bg-background text-[#f0f0f0]">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
