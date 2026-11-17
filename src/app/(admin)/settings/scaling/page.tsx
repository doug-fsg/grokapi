import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { appUrl } from "@/lib/utils";

export default function ScalingPage() {
  const base = appUrl();
  const library = `${base}/api/library/v1`;
  const hooks = `${base}/api/hooks`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Como escalar"
        lede="Réplicas do runtime só precisam da Biblioteca + token. Negócio continua só no painel."
      />
      <Card className="space-y-4 text-sm">
        <ol className="list-decimal space-y-3 pl-5 text-[var(--grokbott-text-secondary)]">
          <li>
            Crie o <strong className="text-[var(--grokbott-text-primary)]">ManyTalks Bot</strong> no
            painel (<Link href="/grokbots" className="underline">/grokbots</Link>).
          </li>
          <li>
            Conclua o wizard e clique em <strong>Publicar</strong> — sem publicar, webhooks e a
            Biblioteca ficam em skip.
          </li>
          <li>
            Copie a <strong>Library URL</strong> e o <strong>runtime token</strong> (
            <code className="font-mono">grk_live_…</code>) na aba Runtime do bot.
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-[var(--grokbott-canvas)] p-3 font-mono text-xs">
              {library}/manifest{"\n"}
              Authorization: Bearer grk_live_…
            </pre>
          </li>
          <li>
            Configure o <strong>webhook de respostas</strong> do Grok no checklist do bot (URL +
            chave). Ao publicar, o Grok recebe <code className="font-mono">manifest_published</code>.
            Alternativa: <code className="font-mono">PUT {library}/outbound-webhook</code> com o runtime
            token.
          </li>
          <li>
            Aponte webhooks ManyTalks para{" "}
            <code className="font-mono">{hooks}/manytalks</code> e Asaas para{" "}
            <code className="font-mono">{hooks}/asaas/[grokbotId]</code> (URL exata no checklist do
            bot).
          </li>
          <li>
            Nova instância (VPS, segundo processo): mesmo <code className="font-mono">DATABASE_URL</code>{" "}
            ou réplica só de leitura da Biblioteca; edite regras somente no painel e{" "}
            <strong>republica</strong> — tokens antigos seguem válidos por até 24h após rotação
            (grace dos 2 últimos ativos).
          </li>
        </ol>
      </Card>
      <p className="text-xs text-[var(--grokbott-text-tertiary)]">
        Referência: PLANO-COMPLETO.md §16.
      </p>
    </div>
  );
}