"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/landing/navbar/constants/navItems";
import { Logo } from "@/components/landing/navbar/components/Logo";
import { MobileMenu } from "@/components/landing/navbar/components/MobileMenu";
import { NavActions } from "@/components/landing/navbar/components/NavActions";
import { NavLinks } from "@/components/landing/navbar/components/NavLinks";

export function NavbarContainer() {
  const pathname = usePathname();
  const [mobileOpenPath, setMobileOpenPath] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobileMenu = () => {
    setMobileOpenPath(null);
  };

  return (
    <header
      className={`sticky top-0 z-header transition-all duration-300 ${
        isScrolled
          ? "border-b border-[rgba(255,255,255,0.08)] bg-[rgba(11,11,16,0.72)] shadow-[0_10px_30px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo onClick={closeMobileMenu} />
          <NavLinks items={NAV_ITEMS} currentPath={pathname} />
        </div>

        <NavActions />

        <MobileMenu
          open={mobileOpenPath === pathname}
          onToggle={() =>
            setMobileOpenPath((prev) => (prev === pathname ? null : pathname))
          }
        >
          <NavLinks
            items={NAV_ITEMS}
            currentPath={pathname}
            mobile
            onNavigate={closeMobileMenu}
          />
          <NavActions mobile onNavigate={closeMobileMenu} />
        </MobileMenu>
      </div>
    </header>
  );
}
