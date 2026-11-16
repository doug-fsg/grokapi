import { Suspense } from "react";
import { LogsClient } from "@/app/(admin)/logs/logs-client";

export default function LogsPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-[var(--grokbott-text-secondary)]">Carregando logs…</p>
      }
    >
      <LogsClient />
    </Suspense>
  );
}
