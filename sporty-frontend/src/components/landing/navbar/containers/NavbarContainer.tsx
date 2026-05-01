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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobileMenu = () => {
    setMobileOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-header transition-all duration-300 ${isScrolled
          ? "border-b border-accent/20 bg-white/90 shadow-card backdrop-blur-sm"
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
          open={mobileOpen}
          onToggle={() => setMobileOpen((prev) => !prev)}
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
