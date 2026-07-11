"use client";

import { Button } from "@/components/ui/Button";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, pageSize, total, hasNext, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex items-center justify-between border-t border-white/8 px-5 py-3">
      <span className="font-barlow-condensed text-xs uppercase tracking-[2px] text-fg-3">
        Page {page} of {totalPages} &middot; {total} total
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Prev
        </Button>
        <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
