# Library API — Manifest v1 (especificação)

**Base:** `{APP_URL}/api/library/v1`  
**Auth:** `Authorization: Bearer {runtime_token}`

## GET /manifest

### Headers resposta

- `ETag: W/"..."`  
- `Cache-Control: private, max-age=60`  

### Request

- `If-None-Match: W/"..."` → `304` se versão igual

### Response 200

Corpo: objeto **ManifestV1** — ver exemplo em [PLANO-COMPLETO.md](./PLANO-COMPLETO.md) §2.3.

### Erros

| Status | Corpo |
|--------|--------|
| 401 | token inválido/revogado |
| 403 | grokbot desabilitado |
| 426 | `schema_version` não suportada |

## Ciclo de vida

1. Admin altera GrokBot ou pacote.  
2. `POST /admin/grokbots/:id/publish` → `manifest_version++`, snapshot em `grokbots_manifest_snapshots`.  
3. Runtimes atualizam no próximo GET ou após TTL cache.

## Campos sensíveis

Retornados **somente** para `runtime_token` válido (TLS):

- `manytalks.api_access_token`  
- `asaas.api_key`  

Nunca logar em `action_logs` sem redação.

## Versionamento

| `schema_version` | Notas |
|------------------|--------|
| `1.0` | Release inicial |

Mudanças breaking → `2.0` + runtime atualizado em conjunto.
