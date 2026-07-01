"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
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
                "fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-sm bg-primary text-on-primary shadow-hard-sm transition-transform hover:-translate-y-0.5 hover:shadow-hard",
                className,
            )}
        >
            <ArrowUp className="h-5 w-5" strokeWidth={2} />
        </button>
    );
}
