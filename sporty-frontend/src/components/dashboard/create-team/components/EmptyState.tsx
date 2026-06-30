"use client";

type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <section className="rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0d0d12] py-12 text-center">
      <div className="mx-auto mb-3 text-4xl" aria-hidden="true">
        🛡️
      </div>
      <p className="font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#555560]">
        {message}
      </p>
    </section>
  );
}
