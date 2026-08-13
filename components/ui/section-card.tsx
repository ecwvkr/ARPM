export function SectionCard({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-2 rounded-3xl bg-muted/40 p-4 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-bold text-foreground">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
