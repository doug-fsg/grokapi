export function PageHeader({
  title,
  lede,
  action,
}: {
  title: string;
  lede?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div className="min-w-0">
        <h1 className="font-display text-[1.75rem] font-semibold leading-none tracking-tight">
          {title}
        </h1>
        {lede ? (
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--grokbott-text-secondary)]">
            {lede}
          </p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
