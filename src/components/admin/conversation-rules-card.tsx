"use client";

import { Card } from "@/components/ui/card";
import type { ConversationRules } from "@/lib/types/manifest";

type Props = {
  rules: ConversationRules;
  onChange: (next: ConversationRules) => void;
};

export function ConversationRulesCard({ rules, onChange }: Props) {
  return (
    <Card className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">Webhooks para o Grok</h3>
        <p className="text-xs text-[var(--grokbott-text-secondary)]">
          Só <strong>message_created</strong> nas inboxes do bot. Atribuição e ID do atendente vêm do{" "}
          <code className="text-xs">.env</code> (<code>DEFAULT_MANYTALKS_ASSIGNEE_ID</code>, hoje
          775). Se outro humano assumir a conversa, o relay para.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Enviar ao Grok quando a conversa estiver:</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rules.relay_when_unassigned !== false}
            onChange={(e) =>
              onChange({ ...rules, relay_when_unassigned: e.target.checked })
            }
          />
          Não atribuída
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rules.relay_when_assigned_to_me !== false}
            onChange={(e) =>
              onChange({ ...rules, relay_when_assigned_to_me: e.target.checked })
            }
          />
          Atribuída ao atendente padrão (env)
        </label>
        {!rules.relay_when_unassigned && !rules.relay_when_assigned_to_me && (
          <p className="text-xs text-[var(--grokbott-danger)]">
            Marque ao menos uma opção.
          </p>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 border-t border-[var(--grokbott-hairline)] pt-3 text-sm">
        <input
          type="checkbox"
          checked={rules.auto_assign_on_message}
          onChange={(e) =>
            onChange({ ...rules, auto_assign_on_message: e.target.checked })
          }
        />
        Atribuir ao atendente padrão antes de avisar o Grok
      </label>
    </Card>
  );
}