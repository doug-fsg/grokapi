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
  if (p.create_contact || p.update_contact || p.start_conversation) {
    tools.push({
      type: "function",
      function: {
        name: "search_contacts",
        description:
          "Busca contatos por nome, email ou telefone (q). Use antes de criar duplicado. Nunca exclui.",
        parameters: {
          type: "object",
          properties: { q: { type: "string", description: "Termo de busca" } },
          required: ["q"],
        },
      },
    });
  }
  if (p.create_contact) {
    tools.push({
      type: "function",
      function: {
        name: "create_contact",
        description:
          "Cria contato no ManyTalks. inbox_id opcional (default: 1ª inbox do bot). Nunca exclua contatos.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone_number: { type: "string" },
            inbox_id: { type: "integer" },
            identifier: { type: "string" },
            custom_attributes: { type: "object" },
          },
        },
      },
    });
  }
  if (p.update_contact) {
    tools.push({
      type: "function",
      function: {
        name: "update_contact",
        description:
          "Atualiza contato existente (PATCH). contact_id obrigatório se não vier do contexto. Proibido excluir.",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "integer" },
            name: { type: "string" },
            email: { type: "string" },
            phone_number: { type: "string" },
            identifier: { type: "string" },
            custom_attributes: { type: "object" },
          },
        },
      },
    });
  }
  if (p.start_conversation) {
    tools.push({
      type: "function",
      function: {
        name: "start_conversation",
        description:
          "Servidor: acha ou cria contato, abre conversa na inbox, envia 1ª mensagem e atribui ao agente do bot. Use só para falar com alguém que ainda não tem conversa aberta — não duplique send_reply na mesma conversa.",
        parameters: {
          type: "object",
          properties: {
            contact_id: { type: "integer", description: "Se já souber o contato" },
            phone_number: { type: "string", description: "E.164 ou com máscara" },
            name: { type: "string", description: "Nome se precisar criar contato" },
            inbox_id: { type: "integer", description: "Default: 1ª inbox do bot" },
            first_message: { type: "string", description: "Primeira mensagem pública" },
            assign: {
              type: "boolean",
              description: "Default true — usa assignee do manifest",
            },
          },
        },
      },
    });
  }
  if (p.assign_conversation) {
    tools.push({
      type: "function",
      function: {
        name: "assign_conversation",
        description:
          "Atribui a conversa atual ao agente configurado no painel (default_assignee_id). Sem argumentos.",
        parameters: { type: "object", properties: {} },
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
