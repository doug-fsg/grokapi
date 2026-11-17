import { PageHeader } from "@/components/admin/page-header";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Card } from "@/components/ui/card";
import {
  manytalksEnvStatus,
  manytalksServiceToken,
  masterEncryptionKey,
} from "@/lib/env";
import { getServiceProfile } from "@/lib/manytalks/service";

export default async function SettingsPage() {
  const mt = manytalksEnvStatus();
  let profile: Awaited<ReturnType<typeof getServiceProfile>> | null = null;
  let profileError: string | null = null;
  if (manytalksServiceToken()) {
    try {
      profile = await getServiceProfile();
    } catch (err) {
      profileError = err instanceof Error ? err.message : "Erro ao ler profile";
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configurações"
        lede="Aparência deste navegador e o que o servidor já leu do .env."
      />
      <Card className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Aparência</h2>
        <ThemeToggle />
      </Card>
      <Card className="space-y-3 text-sm">
        <h2 className="font-display text-lg font-semibold">Servidor</h2>
        <ul className="divide-y divide-border">
          <StatusRow
            label="Criptografia"
            ok={Boolean(masterEncryptionKey())}
            okText="MASTER_ENCRYPTION_KEY presente"
            badText="Faltando MASTER_ENCRYPTION_KEY"
          />
        </ul>
      </Card>
      <Card className="space-y-3 text-sm">
        <h2 className="font-display text-lg font-semibold">ManyTalks</h2>
        <p>
          Base:{" "}
          <span className="font-mono text-[var(--grokbott-text-primary)]">{mt.base}</span>
        </p>
        <ul className="space-y-1 text-[var(--grokbott-text-secondary)]">
          <li>
            SERVICE_TOKEN:{" "}
            {mt.serviceConfigured ? "ok — accounts, inboxes, API" : "faltando"}
          </li>
          <li>
            PLATFORM_TOKEN:{" "}
            {mt.platformConfigured ? "ok (opcional)" : "vazio (ok)"}
          </li>
        </ul>
        {profile && (
          <div className="rounded-md border border-[var(--grokbott-hairline)] bg-[var(--grokbott-surface-3)] p-3">
            <p>
              Logado como <strong>{profile.email ?? profile.name}</strong> ({profile.role})
            </p>
            <ul className="mt-2 space-y-1">
              {profile.accounts.map((a) => (
                <li key={a.id} className="font-mono text-xs">
                  #{a.id} {a.name} {a.role ? `(${a.role})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {profileError && (
          <p className="text-[var(--grokbott-danger)]">{profileError}</p>
        )}
        <p className="text-xs text-[var(--grokbott-text-tertiary)]">
          Um SERVICE_TOKEN no .env cobre as accounts do perfil. No wizard: account +
          inboxes → publicar. Reinicie o{" "}
          <code className="font-mono">pnpm dev</code> após editar o .env.
        </p>
      </Card>
      <Card className="space-y-2 text-sm">
        <h2 className="font-display text-lg font-semibold">Escalar / réplicas</h2>
        <p className="text-[var(--grokbott-text-secondary)]">
          Passo a passo pós-deploy:{" "}
          <a href="/settings/scaling" className="underline">
            Como escalar
          </a>
        </p>
      </Card>
      <Card className="space-y-2 text-sm">
        <h2 className="font-display text-lg font-semibold">Publicar um cliente</h2>
        <ol className="list-decimal space-y-1 pl-5 text-[var(--grokbott-text-secondary)]">
          <li>SERVICE_TOKEN no .env — uma vez.</li>
          <li>Novo ManyTalks Bot → wizard → publicar.</li>
          <li>No bot: checklist “Ligar o bot” (ManyTalks + respostas; Asaas se cobrar).</li>
          <li>Editar base / regras → Publicar de novo (sem redeploy).</li>
        </ol>
      </Card>
    </div>
  );
}

function StatusRow({
  label,
  ok,
  okText,
  badText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <span>{label}</span>
      <span className={ok ? "text-[var(--grokbott-success)]" : "text-[var(--grokbott-danger)]"}>
        {ok ? okText : badText}
      </span>
    </li>
  );
}
