"use client";

import { useEffect, useState } from "react";
import { cn } from "@/utils/classUtils";

interface BackToTopAffixProps {
    threshold?: number;
    className?: string;
}

export default function BackToTopAffix({
    threshold = 300,
    className = "",
}: BackToTopAffixProps) {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsVisible(window.scrollY > threshold);
        };

        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [threshold]);

    if (!isVisible) {
        return null;
    }

    return (
        <button
            type="button"
            aria-label="Back to top"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className={cn(
                "fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-dropdown transition-transform hover:scale-110",
                className,
            )}
        >
            ↑
        </button>
    );
}
