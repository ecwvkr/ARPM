export function WidthContainer({
  children,
  mainClassName = "",
}: {
  children: React.ReactNode;
  mainClassName?: string;
}) {
  return (
    <main className={`mx-auto w-full max-w-5xl flex-1 ${mainClassName}`}>
      {children}
    </main>
  );
}
