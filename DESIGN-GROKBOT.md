# Design e identidade visual — ManyTalks Bot

**Produto:** plataforma **ManyTalks Bot** (ManyTalks + biblioteca + Asaas + dashboard)  
**Marca:** [BRAND.md](./BRAND.md) · **Produto:** [PRODUTO-GROK-MANYTALKS.md](./PRODUTO-GROK-MANYTALKS.md)

**Nota de marca:** ManyTalks Bot é o nome do produto (ex-GrokBot). A identidade **evoca** assistente cósmico / preciso, **sem** usar a marca Grok/xAI ([brand guidelines](https://x.ai/legal/brand-guidelines)). Ícone **órbita + núcleo** é seu.

---

## 0. Referências na internet (o que existe)

Não há um **design system público oficial “GrokBot”** da xAI para terceiros. O que dá para usar como **referência de tokens** (não de marca):

| Fonte | O que é | Útil para |
|-------|---------|-----------|
| [Grok iOS — DESIGN.md](https://github.com/Meliwat/awesome-ios-design-md/blob/main/design-md/misc/grok/DESIGN.md) | Engenharia reversa da UI do app Grok (comunidade) | Dark monochrome, superfícies `#16181C`…, branco como “accent funcional”, azul X só em links |
| [xAI — shadcn design](https://www.shadcn.io/design/xai) | Paleta marketing xAI | `canvas #0A0A0A`, acentos **sunset** `#FF7A17`, **dusk** `#7C3AED` (ilustrações / detalhes) |
| [assistant-ui — Grok clone](https://www.assistant-ui.com/examples/grok) | Clone de chat Grok | **Light + dark** com composer pill, botão primário **invertido** por tema |
| [OpenBot — UI foundation](https://openbot.atomgit.com/ui-foundation.html) | DS open-source (CopilotKit) | **`--openbot-*` tokens**, dark default, `tokens-light.css`, `data-openbot-color-scheme`, opção **System / Light / Dark** |
| [OpenBot — brand](https://openbot.run/brand) | Marca lilás do OpenBot | Referência de **white-label** (`brand.yaml` + `theme.css`); **não** copiar lilás — GrokBot usa paleta Grok/xAI-like |

**App Grok oficial (iOS):** documentado como **dark-only** na comunidade; **light** não é produto Grok, mas faz sentido no **seu painel** (como OpenBot e clones).

**Direção GrokBot:** estética **Grok/xAI** (preto, tipografia limpa, pouca cor) + **sua** cor de produto (sunset/órbita) + **arquitetura de tema** estilo **OpenBot** (dark / light / system).

---

## 1. Posicionamento visual (uma frase)

**“Console de missão — preciso no escuro, claro de dia — bot que vende e atende.”**

| Atributo | Significado na UI |
|----------|-------------------|
| **Preciso** | Dados alinhados, tabelas legíveis, status claros (ok / erro / pausado) |
| **Cósmico** | Fundos profundos, gradientes sutis, sensação de profundidade |
| **Confiável** | Pagamentos e dashboard transmitem segurança, não “brinquedo” |
| **Seu, não genérico** | Detalhes distintivos (orbita, pulso, tipografia) — não “mais um admin Tailwind cinza” |

---

## 2. Público e superfícies

| Superfície | Quem vê | Tom visual |
|------------|---------|------------|
| **Admin** | Só você | Denso, eficiente, sidebar, muitos estados |
| **Biblioteca** | Só você | Cards de pacote, tags, versões |
| **Wizard** | Só você | Passos claros, checklist, testes de conexão |
| **Dashboard vendas** | Cliente (com senha) | Mais ar, gráficos, menos ruído técnico |
| **Login dashboard** | Cliente | Minimalista, confiança, sem dados vazados |

Mesmo **design system** (tokens); **densidade** diferente (admin compacto, dashboard respirado).

---

## 3. Tema: dark, light e system

### Comportamento (estilo OpenBot)

| Modo | Comportamento |
|------|----------------|
| **Dark** | Tokens dark (padrão na 1ª visita) |
| **Light** | Mesmos papéis semânticos, valores invertidos |
| **System** | `prefers-color-scheme` |

- Admin: **Configurações → Aparência** (Dark / Light / System), persistido (localStorage ou perfil).  
- Dashboard cliente: herda preferência do navegador ou toggle discreto no header.  
- Atributo no `<html>`: `data-grokbott-theme="dark" | "light"` (e `system` resolvido no JS).

### Arquivos de tokens (quando codar)

```text
packages/brand/src/tokens.css        # --grokbott-* valores dark
packages/brand/src/tokens-light.css  # sobrescreve valores no light
```

Regra OpenBot: **só cores em `tokens*.css`**; componentes usam `--grokbott-surface-1`, nunca hex solto.

---

## 3.1 Tokens semânticos — dark (referência Grok + xAI)

| Token | Hex dark | Uso |
|-------|----------|-----|
| `--grokbott-canvas` | `#0A0A0A` | Fundo (xAI canvas; próximo de OLED `#000`) |
| `--grokbott-surface-1` | `#16181C` | Sidebar, inputs (Grok surface 1) |
| `--grokbott-surface-2` | `#1E2126` | Cards, sheets |
| `--grokbott-surface-3` | `#272A2E` | Hover, chips ativos |
| `--grokbott-hairline` | `#2F3336` | Bordas |
| `--grokbott-text-primary` | `#E7E9EA` | Corpo (Grok; não branco puro em parágrafos longos) |
| `--grokbott-text-secondary` | `#71767B` | Meta, placeholders |
| `--grokbott-text-tertiary` | `#4D5156` | Contadores, hints |

### Marca GrokBot (não é azul do X)

| Token | Hex dark | Uso |
|-------|----------|-----|
| `--grokbott-accent-sunset` | `#FF7A17` | Marca: orbita, gráficos, badge “ativo” (xAI sunset) |
| `--grokbott-accent-dusk` | `#7C3AED` | KPI, funil, ícone bot |
| `--grokbott-primary-invert-bg` | `#FFFFFF` | Botão primário **fill** (estilo botão Send Grok) |
| `--grokbott-primary-invert-fg` | `#0A0A0A` | Texto/ícone no primário dark |
| `--grokbott-link` | `#1D9BF0` | **Só** links externos (padrão X/Grok) |

### Semânticos (iguais nos dois temas, ajustar contraste)

| Token | Hex | Uso |
|-------|-----|-----|
| `--grokbott-success` | `#00BA7C` | Pago, token OK (Grok success) |
| `--grokbott-warning` | `#FFD400` | Avisos |
| `--grokbott-danger` | `#F4212E` | Erros (Grok error) |

---

## 3.2 Tokens semânticos — light

Paridade **first-class** (referência: Grok DESIGN.md invertido + [Grok clone assistant-ui](https://www.assistant-ui.com/examples/grok)).

| Token | Hex light | Uso |
|-------|-----------|-----|
| `--grokbott-canvas` | `#FDFDFD` | Fundo |
| `--grokbott-surface-1` | `#F7F9F9` | Painéis |
| `--grokbott-surface-2` | `#FFFFFF` | Cards |
| `--grokbott-surface-3` | `#EFF3F4` | Hover |
| `--grokbott-hairline` | `#E5E5E5` | Bordas |
| `--grokbott-text-primary` | `#0F1419` | Títulos e corpo |
| `--grokbott-text-secondary` | `#536471` | Meta |
| `--grokbott-text-tertiary` | `#8B98A5` | Hints |

| Token | Hex light | Uso |
|-------|-----------|-----|
| `--grokbott-primary-invert-bg` | `#0D0D0D` | Botão primário fill |
| `--grokbott-primary-invert-fg` | `#FFFFFF` | Ícone/texto no primário light |

Acentos **sunset/dusk** permanecem; fundos de badge usam alpha sobre canvas.

### Gradiente de marca (dark e light)

```css
/* Login dashboard — só hero */
[data-grokbott-theme="dark"] .hero-brand {
  background: radial-gradient(ellipse 80% 50% at 50% -20%,
    rgba(124, 58, 237, 0.22), transparent 60%), var(--grokbott-canvas);
}
[data-grokbott-theme="light"] .hero-brand {
  background: radial-gradient(ellipse 80% 50% at 50% -20%,
    rgba(255, 122, 23, 0.12), transparent 60%), var(--grokbott-canvas);
}
```

---

## 4. Tipografia

| Papel | Fonte sugerida | Alternativa |
|-------|----------------|-------------|
| **UI / corpo** | [Geist](https://vercel.com/font) ou Inter | System-ui |
| **Títulos / display** | **Space Grotesk** ou Geist Sans semibold | Título “científico” |
| **Código / IDs** | Geist Mono | account_id, slugs, logs |

| Nível | Tamanho | Peso |
|-------|---------|------|
| Display (login) | 32–40px | 600 |
| H1 (página) | 24px | 600 |
| H2 (seção) | 18px | 600 |
| Body | 14px | 400 |
| Caption / meta | 12px | 400 |

**Line-height:** 1.5 corpo; 1.2 títulos.

---

## 5. Logo e ícone (direção, não arte final)

### Conceito: **Núcleo + órbita**

- Círculo sólido (núcleo do bot) + arco fino incompleto (órbita) + opcional ponto satélite.  
- Lembra assistente em órbita, não rosto humano — evita uncanny e marca alheia.

### Wordmark

- **Grok** em semibold + **Bot** em regular ou cor `text-secondary`  
- Ou um só bloco: **GrokBot** com acento âmbar na letra **o** ou no arco do ícone.

### Favicon

- Apenas o núcleo + arco (legível 16px).

### App icon (PWA futuro)

- Mesmo símbolo em `bg-base` com glow violeta suave.

**Entregável design:** export SVG + PNG 512; variantes mono para sidebar recolhida.

---

## 6. Iconografia e ilustração

- **Ícones:** Lucide (linha 1.5px) — combina com shadcn.  
- **Bot ativo:** íone `Sparkles` ou custom orbit com `accent`.  
- **ManyTalks:** badge “MT” ou ícone `MessagesSquare` + `info`.  
- **Asaas:** `CreditCard` / `QrCode` conforme modo cobrança.  
- **Evitar:** mascote Grok oficial, logo X, gradientes neon exagerados (hackathon).

### Estados do GrokBot na lista

| Estado | Visual |
|--------|--------|
| Ativo | Ponto verde + anel âmbar pulsante (CSS suave) |
| Pausado | Âmbar apagado |
| Erro | Vermelho + tooltip último erro |
| Config incompleta | Warning + checklist |

---

## 7. Layout e componentes (shadcn + tokens)

### Admin

```
┌──────────┬────────────────────────────────────┐
│ Sidebar  │  Header (breadcrumb + ação)          │
│ (logo)   ├────────────────────────────────────┤
│ GrokBots │  Conteúdo                          │
│ Biblioteca│                                    │
│ Config   │                                    │
└──────────┴────────────────────────────────────┘
```

- Sidebar `bg-elevated`, largura 240px (64px recolhida).  
- Item ativo: barra esquerda `accent` 3px + `accent-muted` background.

### Wizard

- Stepper horizontal no topo (7 passos).  
- Card central max-width 720px.  
- Botões “Testar conexão” com feedback inline (success/danger).

### Dashboard cliente

- Sem sidebar ManyTalks; topo com nome da empresa + período.  
- Cards KPI em grid 2×2 mobile, 4×1 desktop.  
- Gráfico funil: barras horizontais `glow-violet` → `accent` por estágio.

### Biblioteca

- Grid de cards “pacote” com tag versão (`v1.2`), chips (Vendas, Kanban, Asaas).

---

## 8. Motion

| Uso | Regra |
|-----|--------|
| Transição páginas | 150ms ease |
| Pulsor “bot respondendo” | opacity 0.4→1 em 2s loop — só em status live |
| Números KPI | count-up opcional ao carregar dashboard |
| **Não** | Parallax, partículas pesadas, animação em tabelas grandes |

---

## 9. Voz e microcopy (tom GrokBot)

| Situação | Tom | Exemplo |
|----------|-----|---------|
| Sucesso técnico | Seco, confiante | “ManyTalks conectado.” |
| Erro | Claro, ação | “Kanban negou (403). Use token com permissão CRM.” |
| Wizard | Guia | “Escolha as inboxes que o GrokBot atende.” |
| Dashboard cliente | Profissional, sem IA | “Vendas — novembro 2025” (sem “Grok disse…”) |
| Pagamento | Tranquilizador | “Link gerado. Válido até …” |

**Personalidade:** inteligente e direto; **não** sarcasmo estilo persona Grok nas mensagens de **UI** (isso fica no bot ao cliente, se quiser no pacote).

---

## 10. Acessibilidade

- Contraste texto: WCAG AA mínimo (`#A1A1AA` em `#12151C` validar).  
- Focus ring: `accent` 2px offset.  
- Não depender só de cor (ícone + label em estados).  
- Dashboard: gráficos com tabela alternativa expandível.

---

## 11. Implementação técnica (quando codar)

- **Stack UI:** React + **shadcn/ui** + variáveis `--grokbott-*` → `--background`, `--primary`, etc.  
- Inspirar estrutura em [OpenBot tokens](https://openbot.atomgit.com/ui-foundation.html): um par de arquivos CSS + toggle de tema.  
- Opcional: tema shadcn pré-mapeado [xAI](https://www.shadcn.io/design/xai) como ponto de partida, trocando primário para **sunset + invert button**.  
- **Fontes:** Inter/Geist (Grok usa Inter com `slashed-zero` em números — opcional em IDs e KPIs).  
- **Storybook:** toolbar “Color scheme” (dark / light), como OpenBot.

---

## 12. Checklist de aprovação (você valida)

- [ ] **Dark + Light + System** no MVP do front  
- [ ] Paleta **Grok monochrome + sunset/dusk** (não lilás OpenBot)  
- [ ] Botão primário **invertido** por tema (estilo Grok Send)  
- [ ] Logo órbita + núcleo  
- [ ] Admin denso / dashboard respirado  
- [ ] Links externos com `#1D9BF0`; marca com sunset  

### Variações para decidir

| Opção | A | B |
|-------|---|---|
| Marca / gráficos | Sunset `#FF7A17` (xAI) | Âmbar `#F59E0B` (mais quente) |
| Canvas dark | `#0A0A0A` (xAI) | `#000000` (Grok iOS OLED) |
| Tipografia títulos | Inter only (mais Grok) | Space Grotesk títulos + Inter corpo |
| Nome na UI | GrokBot | White-label só no dashboard cliente |

---

## 13. Próximos passos de design

1. Você escolhe A/B acima + aprova checklist.  
2. Esboço logo SVG simples (ou brief para designer).  
3. Mock **uma** tela admin (lista GrokBots) + **login dashboard** + **KPI dashboard** (Figma ou código estático).  
4. Congelar tokens em `DESIGN-GROKBOT.md` e gerar tema shadcn.

---

*Identidade evoca “bot cósmico de operação”; produto permanece ManyTalks + Asaas como integrações de confiança, não como submarca.*
