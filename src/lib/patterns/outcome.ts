/** Classifica conversa pelo texto (modo automático). */

const WIN_RE = [
  /matricul/i,
  /inscri[cç][aã]o confirm/i,
  /pagamento confirm/i,
  /pagamento aprov/i,
  /pix (foi )?receb/i,
  /compra (aprov|confirm|feita)/i,
  /contrato assin/i,
  /\bfechamos\b/i,
  /venda conclu/i,
  /pedido confirmad/i,
  /acesso liberad/i,
  /seja bem[- ]vind/i,
  /boleto pago/i,
  /j[aá] (est[aá] )?pago/i,
];

const LOSE_RE = [
  /n[aã]o tenho interesse/i,
  /sem interesse/i,
  /\bdesisti\b/i,
  /muito caro/i,
  /n[aã]o vou (fechar|comprar|matricul)/i,
  /agora n[aã]o/i,
  /depois eu (vejo|penso)/i,
  /n[aã]o [eé] pra mim/i,
  /n[aã]o quero mais/i,
  /pode cancelar/i,
];

const SUPPORT_RE = [
  /protocolo/i,
  /\bbug\b/i,
  /n[aã]o funciona/i,
  /chamado de suporte/i,
  /abrir (um )?ticket/i,
  /reclama[cç][aã]o t[eé]cnica/i,
];

const COMMERCIAL_RE = [
  /pre[cç]o/i,
  /proposta/i,
  /or[cç]amento/i,
  /plano /i,
  /mensalidade/i,
  /assinatura/i,
  /matricul/i,
  /comprar/i,
  /fechar/i,
  /investimento/i,
  /desconto/i,
];

const PROPOSAL_RE = [
  /proposta/i,
  /or[cç]amento/i,
  /enviei o (link|valor|plano)/i,
  /fica (por )?(r\$|rs)/i,
  /plano (mensal|anual)/i,
];

export type InferredOutcome = "fechou" | "nao_fechou" | "indefinido";
export type ConvDomainGuess = "venda" | "suporte" | "indefinido";

export type OutcomeGuess = {
  outcome: InferredOutcome;
  how: string;
  domain: ConvDomainGuess;
  hadProposal: boolean;
  lostOpportunity: boolean;
};

export function classifyOutcomeFromLines(
  lines: string[],
  opts?: { status?: string; lastFrom?: "cliente" | "agente" | null; auto?: boolean },
): OutcomeGuess {
  const blob = lines.slice(-30).join("\n");
  const hadProposal = PROPOSAL_RE.some((re) => re.test(blob));
  const supportHits = SUPPORT_RE.filter((re) => re.test(blob)).length;
  const salesHits = COMMERCIAL_RE.filter((re) => re.test(blob)).length;
  let domain: ConvDomainGuess = "indefinido";
  if (opts?.auto) {
    if (salesHits > supportHits && salesHits > 0) domain = "venda";
    else if (supportHits > salesHits && supportHits > 0) domain = "suporte";
  }

  if (opts?.auto && domain === "suporte") {
    return {
      outcome: "indefinido",
      how: "suporte (fora da comparação comercial)",
      domain,
      hadProposal,
      lostOpportunity: false,
    };
  }

  if (WIN_RE.some((re) => re.test(blob))) {
    return {
      outcome: "fechou",
      how: "texto (sinal de fechamento)",
      domain: domain === "indefinido" ? "venda" : domain,
      hadProposal,
      lostOpportunity: false,
    };
  }
  if (LOSE_RE.some((re) => re.test(blob))) {
    return {
      outcome: "nao_fechou",
      how: "texto (recusa/desistir)",
      domain: domain === "indefinido" ? "venda" : domain,
      hadProposal,
      lostOpportunity: true,
    };
  }

  if (opts?.auto && domain === "venda") {
    if (hadProposal) {
      return {
        outcome: "nao_fechou",
        how: "comercial com proposta, sem fechamento claro",
        domain,
        hadProposal: true,
        lostOpportunity: true,
      };
    }
    const resolved = String(opts?.status ?? "").toLowerCase() === "resolved";
    if (resolved && opts?.lastFrom === "agente") {
      return {
        outcome: "nao_fechou",
        how: "comercial resolvida sem resposta — oportunidade perdida",
        domain,
        hadProposal,
        lostOpportunity: true,
      };
    }
  }

  const resolved = String(opts?.status ?? "").toLowerCase() === "resolved";
  if (resolved && opts?.lastFrom === "agente") {
    return {
      outcome: "nao_fechou",
      how: "resolvida sem resposta final do cliente",
      domain,
      hadProposal,
      lostOpportunity: domain === "venda",
    };
  }
  return {
    outcome: "indefinido",
    how: "sem sinal claro no texto",
    domain,
    hadProposal,
    lostOpportunity: false,
  };
}
