type PageContainerProps = {
  size?: "default" | "wide";
  className?: string;
  children: React.ReactNode;
};

const sizeClass = {
  default: "max-w-6xl",
  wide: "max-w-7xl",
} as const;

export function PageContainer({
  size = "default",
  className = "",
  children,
}: PageContainerProps) {
  return (
    <section className={`mx-auto w-full ${sizeClass[size]} ${className}`}>
      {children}
    </section>
  );
}
