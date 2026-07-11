"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

type DropZoneProps = {
  id: string;
  disabled?: boolean;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
};

export function DropZone({
  id,
  disabled = false,
  className = "",
  activeClassName = "",
  children,
}: DropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver && !disabled ? activeClassName : ""}`.trim()}
      aria-disabled={disabled}
    >
      {children}
    </div>
  );
}
