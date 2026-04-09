# helpdesk-cli

CLI para operadores do helpdesk: faça perguntas em linguagem natural sobre os tickets da sua organização. A ferramenta usa o **Vercel AI SDK** com chamadas ao **backend HTTP** (`GET /api/tickets`, detalhe do ticket e métricas do dashboard); os dados ficam restritos ao `organizationId` do JWT.

## Pré-requisitos

- **Bun** 1.2+ (gerenciador de pacotes e runtime usados no monorepo; [bun.sh](https://bun.sh))
- **Node.js** 20+ (recomendado para ferramentas que ainda invocam o binário `node`, por exemplo o Vitest)
- Backend em execução (por padrão `http://localhost:3000`)
- Conta OpenAI e **`OPENAI_API_KEY`**

## Instalação

Na raiz do monorepo, após `make setup`, as dependências do CLI já são instaladas. Ou diretamente:

```bash
cd packages/cli
bun install
```

Na raiz do monorepo, `bun install` já instala todos os workspaces. O executável `helpdesk` aponta para `src/index.ts` e roda direto com o Bun (sem passo de build obrigatório). Use `bun run build` só se precisar de `dist/` para publicar ou rodar com Node.

### Tornar o comando global (opcional)

```bash
cd packages/cli
bun link
```

Depois você pode usar `helpdesk` em qualquer pasta. Sem o link, use `bun src/index.ts` / `bun run start --`, ou `bun run dev` em modo watch.

## Variáveis de ambiente

| Variável               | Obrigatória            | Descrição                                                                                         |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`       | Sim (`question`)       | Chave da API OpenAI.                                                                              |
| `OPENAI_MODEL`         | Não                    | Modelo (default `gpt-5.4-nano`).                                                                  |
| `HELPDESK_API_URL`     | Não                    | URL do backend (default `http://localhost:3000`).                                                 |
| `HELPDESK_TOKEN`       | Uma das opções de auth | JWT retornado pelo sign-in (recomendado para scripts).                                            |
| `HELPDESK_EMAIL`       | Se não usar token      | Email do operador (pode ser trocado por `--email` / `-e`).                                        |
| `HELPDESK_PASSWORD`    | Se não usar token      | Senha (pode ser trocada por `--password` / `-p`; evite em produção — fica no histórico do shell). |
| `HELPDESK_TOKEN_CACHE` | Não                    | Caminho do arquivo de sessão (default: ver abaixo).                                               |

Um arquivo **`.env`** na pasta atual (ou acima) é carregado automaticamente via `dotenv`.

### Sessão em disco (evita exportar o token a cada comando)

Depois de `helpdesk login`, o JWT é gravado em arquivo com permissão restrita (`0600`), associado à `HELPDESK_API_URL` atual. Os próximos `helpdesk question` reutilizam esse token **sem** `HELPDESK_TOKEN` e sem passar senha de novo.

- Caminho default: `$XDG_STATE_HOME/helpdesk-cli/token.json`, ou `~/.local/state/helpdesk-cli/token.json` se `XDG_STATE_HOME` não estiver definido.
- Dentro de **uma mesma execução** do processo, o token também fica em memória após o primeiro uso (várias chamadas HTTP do agente não releem o arquivo).
- Ordem de resolução: `HELPDESK_TOKEN` (env) → arquivo de sessão (válido e não expirado) → sign-in com email/senha (por padrão grava sessão; use `--no-save` no `login` ou `question` para não gravar).

`helpdesk logout` apaga apenas o arquivo de sessão; variáveis de ambiente não são alteradas.

## Comandos

### Ajuda

```bash
helpdesk --help
helpdesk question --help
helpdesk login --help
helpdesk logout --help
```

### `helpdesk question`

Envia a pergunta ao modelo; o modelo pode chamar ferramentas que consultam a API:

- **listTickets** — lista com filtros (`status`, `search`, `limit`, `offset`)
- **getTicket** — detalhe por `id`
- **getDashboardMetrics** — métricas (`period`: `7d`, `30d`, `90d`)

**Exemplos**

```bash
export OPENAI_API_KEY="..."

# Depois de um login (sessão salva), só precisa da pergunta:
helpdesk question "Quantos tickets estão com status new?"

# Ou com token explícito (ignora sessão em disco)
export HELPDESK_TOKEN="<jwt>"
helpdesk question --text "Resuma os tickets abertos"

helpdesk question -t "Quem está com o ticket 42?"
```

### `helpdesk login`

Autentica, **grava a sessão** para os próximos comandos e ainda imprime o JWT na saída padrão (útil para scripts que exportam `HELPDESK_TOKEN`). Credenciais: **`--email` / `-e`** e **`--password` / `-p`**, ou `HELPDESK_EMAIL` / `HELPDESK_PASSWORD` (flags têm precedência). Use **`--no-save`** para só imprimir o token sem atualizar o arquivo de sessão.

```bash
helpdesk login -e "operador@exemplo.com" -p 'sua-senha'
# próximos: helpdesk question "..."  (sem token na env)

# Apenas imprimir token, sem gravar sessão
helpdesk login --no-save -e "op@exemplo.com" -p '...'
```

O comando **`question`** também aceita `-e` / `-p` quando não há token em env nem sessão válida; após o sign-in a sessão é gravada. Use **`question --no-save`** para não atualizar o arquivo.

### `helpdesk logout`

Remove o arquivo de sessão em disco.

**Segurança:** senha na linha de comando pode aparecer em `ps` e no histórico do shell; depois do primeiro `login`, sessão em disco reduz essa necessidade. Em máquinas compartilhadas, use `logout` ao terminar ou prefira token de curta duração.

## Desenvolvimento

```bash
bun run typecheck   # tsc --noEmit (TypeScript na raiz do monorepo)
bun run build       # opcional: emite dist/ para Node
bun run dev -- question "Teste"   # Bun em watch
```

## Limitações

- Respostas dependem dos dados que as ferramentas conseguem buscar (paginação: se `total` for maior que o `limit`, o modelo deve combinar várias chamadas ou avisar).
- Não há acesso direto ao banco: toda informação vem da API autenticada do backend.
