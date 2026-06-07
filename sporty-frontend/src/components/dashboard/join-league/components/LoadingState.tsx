"use client";

type LoadingStateProps = {
  message: string;
};

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <section className="flex flex-col items-center justify-center py-12 text-center">
      <span className="h-8 w-8 animate-spin rounded-[3px] border-4 border-[rgba(255,255,255,0.08)] border-t-accent-primary" />
      <p className="mt-3 text-sm text-[#555560]">{message}</p>
    </section>
  );
}
