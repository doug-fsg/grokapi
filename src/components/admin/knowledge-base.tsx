"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  parseKnowledge,
  serializeKnowledge,
  type KnowledgeEntry,
} from "@/lib/knowledge/entries";

const STARTERS = ["Horários", "Preços", "Produtos", "O que não prometer"];

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function KnowledgeBase({ value, onChange }: Props) {
  const [items, setItems] = useState<KnowledgeEntry[]>(() => parseKnowledge(value));
  const [synced, setSynced] = useState(value);

  if (value !== synced && serializeKnowledge(parseKnowledge(value)) !== serializeKnowledge(items)) {
    setSynced(value);
    setItems(parseKnowledge(value));
  } else if (value !== synced) {
    setSynced(value);
  }

  function commit(next: KnowledgeEntry[]) {
    setItems(next);
    const serialized = serializeKnowledge(next);
    setSynced(serialized);
    onChange(serialized);
  }

  function update(index: number, patch: Partial<KnowledgeEntry>) {
    commit(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {STARTERS.map((title) => (
          <Button
            key={title}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => commit([...items, { title, body: "" }])}
          >
            + {title}
          </Button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={index}
          className="space-y-2 rounded-lg border border-[var(--grokbott-hairline)] p-3"
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label>Assunto</Label>
              <Input
                value={item.title}
                onChange={(e) => update(index, { title: e.target.value })}
                placeholder="Ex.: Horários"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-5"
              onClick={() => commit(items.filter((_, i) => i !== index))}
            >
              Remover
            </Button>
          </div>
          <div className="space-y-1">
            <Label>O que o bot deve saber</Label>
            <Textarea
              value={item.body}
              rows={4}
              onChange={(e) => update(index, { body: e.target.value })}
              placeholder="Fatos objetivos. Sem isso, o Grok não tem o dado."
            />
          </div>
        </div>
      ))}
      {!items.length && (
        <p className="rounded-md border border-dashed border-[var(--grokbott-hairline)] p-3 text-sm text-[var(--grokbott-text-secondary)]">
          Nenhum assunto ainda. Adicione horários, preços, produtos e limites.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setItems([...items, { title: "", body: "" }])}
      >
        + Assunto
      </Button>
    </div>
  );
}
