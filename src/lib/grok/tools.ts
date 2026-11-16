import type { ManifestV1 } from "@/lib/types/manifest";

export function toolsFromPolicy(manifest: ManifestV1) {
  const tools: unknown[] = [
    {
      type: "function",
      function: {
        name: "lookup_knowledge",
        description: "Busca fatos oficiais. Envie query (string). Chame quando quiser.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Tema ou palavras-chave" },
          },
          required: ["query"],
        },
      },
    },
  ];
  const p = manifest.tools_policy;
  if (p.send_reply) {
    tools.push({
      type: "function",
      function: {
        name: "send_reply",
        description: "Publica mensagem ao cliente. content (string). Token ManyTalks já está no servidor.",
        parameters: {
          type: "object",
          properties: {
            content: { type: "string", description: "Texto público na conversa" },
          },
          required: ["content"],
        },
      },
    });
  }
  if (p.set_conversation_labels) {
    tools.push({
      type: "function",
      function: {
        name: "set_conversation_labels",
        description:
          "Merge de etiquetas: add[] e remove[]. Só títulos do manifest.limits. Chame quando quiser.",
        parameters: {
          type: "object",
          properties: {
            add: { type: "array", items: { type: "string" } },
            remove: { type: "array", items: { type: "string" } },
          },
        },
      },
    });
  }
  if (p.move_kanban_card) {
    tools.push({
      type: "function",
      function: {
        name: "move_kanban_card",
        description:
          "Move card no kanban. stage_id obrigatório; deal_value e position opcionais. Pipeline/token no servidor.",
        parameters: {
          type: "object",
          properties: {
            stage_id: { type: "string" },
            deal_value: { type: "number" },
            position: { type: "integer" },
          },
          required: ["stage_id"],
        },
      },
    });
  }
  if (p.create_payment_link && manifest.asaas.allow_payment_link) {
    tools.push({
      type: "function",
      function: {
        name: "create_payment_link",
        description:
          "Asaas: cria link (name, value; description opcional). api_key no servidor. Retorna url.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: { type: "number" },
            description: { type: "string" },
          },
          required: ["name", "value"],
        },
      },
    });
  }
  if (p.create_pix_charge && manifest.asaas.allow_pix_copy) {
    tools.push({
      type: "function",
      function: {
        name: "create_pix_charge",
        description:
          "Asaas: PIX (customer_name, value). api_key no servidor. Retorna copia-e-cola.",
        parameters: {
          type: "object",
          properties: {
            customer_name: { type: "string" },
            value: { type: "number" },
            description: { type: "string" },
          },
          required: ["customer_name", "value"],
        },
      },
    });
  }
  return tools;
}
