"use client";

type LoadingStateProps = {
  message: string;
};

export function LoadingState({ message }: LoadingStateProps) {
  return (
    <section className="flex flex-col items-center justify-center py-12 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary-500" />
      <p className="mt-3 text-sm text-secondary">{message}</p>
    </section>
  );
}
