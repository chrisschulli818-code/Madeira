# WoodCraft Planner

Aplicação web (SPA) para projeto paramétrico de móveis em MDF/MDP — DIY e profissional.
A partir das medidas externas e das opções de construção, gera automaticamente:

- **Lista de corte** com as medidas reais de cada peça (descontando espessuras), fita de borda e veio;
- **Plano de corte** otimizado (guilhotina 2D com kerf, refilo e veio) com desenho de cada chapa;
- **Lista de compras**: parafusos, minifix/cavilhas, corrediças, dobradiças, puxadores, pinos, cantoneiras, calços, fita de borda;
- **Checklist de ferramentas** (essenciais × opcionais), adaptado ao projeto;
- **Visualização 3D** (Three.js) e **vistas 2D cotadas** (SVG), com destaque sincronizado entre tabela, 3D e plano de corte;
- **Exportação em PDF** (arquivo A4 com especificações, desenhos cotados, lista de corte numerada, portas/gavetas, materiais, plano de corte com legenda, lista de compras e checklist de ferramentas) e **CSV** para a madeireira.

- **Projetos com vários móveis** (ex.: balcão + aéreo + armário), cada um com nome e quantidade de unidades iguais —
  as peças de todos dividem as mesmas chapas no plano de corte;
- **Orçamento** com preços de referência editáveis (chapas, ferragens, serviços da madeireira), mão de obra e margem;
- **Salvar/abrir projetos** em arquivo `.woodcraft.json` para levar a outro computador ou compartilhar.

- **Móvel livre (do zero)**: comece com a tela em branco e monte o móvel painel por painel (medidas, espessura,
  posição, função e fita). As junções são detectadas pelo contato entre painéis de estrutura;
- **Arrastar e encaixar**: prateleiras e gavetas podem ser arrastadas no 3D ou na vista frontal. Nos móveis prontos,
  a prateleira desliza em passos de 32 mm (furação sistema 32) e pode mudar de vão; a gaveta muda de vão e encaixa em
  cima ou embaixo. No móvel livre, prateleiras, painéis e **gavetas (módulo com corrediça)** se ajustam à largura entre
  as laterais e apoiam sobre a peça de baixo, sem se sobrepor;
- **Ambiente (cômodo)**: defina largura, profundidade, pé-direito, portas e janelas e posicione todos os móveis do
  projeto na **planta** ou no **3D**. Ao arrastar, o móvel encosta e gira de costas para a parede mais próxima, encaixa
  nos cantos, alinha lado a lado com os vizinhos e não se sobrepõe (aéreos passam por cima dos balcões). Há botões para
  girar e encostar numa parede, e avisos de porta bloqueada, móvel sobreposto ou fora do cômodo. O PDF traz a planta;
- **Editar dentro do ambiente e "Meus móveis"**: clicando num móvel no ambiente, o painel mostra a posição e o editor
  completo (medidas, vãos, gavetas, peças) com o cômodo atualizando ao vivo. Móveis podem ser salvos em **Meus móveis**
  (biblioteca pessoal no navegador) e colocados em qualquer projeto/ambiente; também é possível importar os móveis de
  um projeto salvo. Móveis novos entram num lugar livre junto às paredes, sem sobrepor nem bloquear portas;
- **Encaixes e montagem**: para cada móvel o app calcula onde as peças se encostam e gera o **mapa de furação** por
  peça (parafuso com pré-furo, minifix + cavilha ou cavilhas coladas, caneco Ø35 e base das dobradiças, pinos de
  prateleira a 37 mm, rasgo do fundo), com cotas u/v a partir do canto de referência, desenho da peça e marcadores no
  3D (chave **Encaixes**), além do **passo a passo de montagem**. No ambiente, módulos vizinhos recebem parafusos de
  união. Tudo vai para o PDF;
- **Tela expandida**: esconde cabeçalho e abas e deixa só o editor e o 3D (botão **Expandir**, Esc para sair).
  **Novo → Do zero** já abre o projeto em branco nesse modo.

Templates: balcão inferior, armário aéreo, guarda-roupa modular, mesa de trabalho e móvel livre. Em cada vão é possível
combinar gavetas e porta, com o gaveteiro em cima ou embaixo.

## Como rodar

```bash
yarn install
yarn start         # http://localhost:5173
yarn test          # testes dos motores de cálculo (Vitest)
yarn build         # typecheck + build de produção
```

Com npm: `npm install` e `npm start`.

## Publicar no Render

O arquivo `render.yaml` já configura um **Static Site** gratuito:

1. Em [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
2. Conecte o GitHub e escolha o repositório `Madeira` (branch `main`).
3. Confirme em **Apply**. O Render roda `npm ci && npm run build` e publica a pasta `dist`.

Cada push na `main` gera um novo deploy automaticamente.

> Também funciona como **Web Service**: **Build Command** `yarn install && yarn build` e **Start Command** `yarn start`.
> No Render (variável `RENDER=true`) o `yarn start` serve o build compilado em vez do servidor de desenvolvimento,
> ficando bem abaixo do limite de 512 MB do plano gratuito.

## Stack

React 19 + TypeScript + Vite · Tailwind CSS v4 · componentes no estilo shadcn/ui sobre Radix UI ·
lucide-react · Zustand (com persistência em localStorage) · @react-three/fiber + drei.

## Arquitetura

```
src/
├── types/woodcraft.ts          # Tipos centrais: CabinetParams, CutPiece, HardwareItem, ToolRequirement...
├── engine/                     # Motor algorítmico — TypeScript puro, sem React (testável isoladamente)
│   ├── constants.ts            # Folgas e padrões de marcenaria (rasgo, corrediça, recuos...)
│   ├── templates.ts            # Templates paramétricos e valores padrão
│   ├── cabinetEngine.ts        # Explosão do móvel em peças (descontos de espessura, frentes, gavetas)
│   ├── nestingEngine.ts        # Otimizador de chapas: guilhotina 2D multi-heurística
│   ├── hardwareEngine.ts       # Quantitativo de ferragens, fixadores e fita de borda
│   ├── toolsEngine.ts          # Ferramentas essenciais/opcionais conforme o projeto
│   ├── customEngine.ts         # Móvel livre: painéis posicionados à mão, junções por contato, gavetas
│   ├── roomEngine.ts           # Ambiente: posições automáticas, encaixe nas paredes/vizinhos, avisos
│   ├── joineryEngine.ts        # Encaixes: furação por peça (u/v), dobradiças, pinos, rasgo, passo a passo
│   ├── dragEngine.ts           # Arrastar e encaixar (sistema 32, ímã entre faces, ajuste ao vão)
│   ├── projectEngine.ts        # Soma vários móveis: peças, plano de corte, ferragens, ferramentas
│   ├── budgetEngine.ts         # Orçamento (chapas, insumos, serviços, mão de obra, margem)
│   ├── pricing.ts              # Preços de referência (R$)
│   ├── projectFile.ts          # Salvar/abrir .woodcraft.json (com validação)
│   ├── exporters.ts            # CSV da lista de corte
│   └── __tests__/              # Testes unitários dos motores
├── export/pdfReport.ts         # Gerador do PDF (jsPDF + autotable, carregado sob demanda)
├── store/projectStore.ts       # Zustand: só ENTRADAS do usuário (parâmetros, chapa, materiais, serviços)
├── hooks/ProjectResults.tsx    # Deriva modelo → plano de corte → ferragens → ferramentas (uma vez, via contexto)
├── lib/                        # utilidades (cn, formatação, download, cores, especificações)
└── components/
    ├── ui/                     # Primitivos (Button, Card, Tabs, Slider, Switch, Badge)
    ├── layout/Header.tsx       # Seleção de template, nome do projeto, relatório
    ├── params/                 # Painel lateral: sliders, inputs, editor de vãos, materiais
    ├── viewport/               # Scene3D (R3F, lazy-loaded) e Elevation2D (SVG cotado)
    ├── cutlist/                # Tabela de corte interativa + CSV/impressão
    ├── nesting/                # Plano de corte (resumo + diagrama das chapas)
    ├── hardware/               # Lista de compras
    ├── tools/                  # Checklist de ferramentas
    └── report/PrintReport.tsx  # Relatório A4 (visível apenas na impressão)
```

**Fluxo de dados:** `store (móveis + configurações)` → `buildModel()` por móvel → `AssembledModel { pieces, doors, drawers, joints }` →
`projectPieces()` → `planCutting()` / `projectHardware()` / `projectTools()` → `computeBudget()` → componentes. Nada derivado é guardado no store,
então não existe estado inconsistente.

## Regras de cálculo (resumo)

Convenções: medidas em mm; **comprimento = sentido do veio**; profundidade informada = caixa, sem frentes.

| Peça | Comprimento × Largura |
|---|---|
| Lateral | `H − (rodapé se suspenso)` × `P − fundo` (fundo pregado) ou `P` (fundo em rasgo) |
| Base / tampo / prateleira fixa | `L − 2E` × profundidade da lateral |
| Travessa superior (balcão) | `L − 2E` × 100 (2 un.) |
| Rodapé | `L − 2E` × altura do rodapé, recuado |
| Divisória | altura interna × profundidade útil |
| Fundo pregado | `L − 4` × `H − rodapé − 4` |
| Fundo em rasgo | `(L − 2E + 16 − 2)` × `(altura interna + 16 − 2)` — rasgo 8 mm a 10 mm da traseira |
| Porta (sobreposta) | 1 folha: `vão − folga`; 2 folhas: `(vão − 2·folga) / 2` — vão vai até o centro da divisória |
| Frente de gaveta | gavetas só: `(altura − n·folga) / n`; com porta: altura definida |
| Caixa de gaveta | largura `vão interno − 26` (corrediça 12,7 mm/lado), altura `frente − 40`, profundidade = corrediça comercial |
| Prateleira móvel | `vão − 2` × `profundidade útil − 20` |

Ferragens: dobradiças por altura da porta (2 até 900 mm, 3 até 1500, 4 até 2000, 5 acima),
reta sobre lateral externa e curva sobre divisória; corrediça = maior comprimento comercial que cabe;
parafusos a cada ~150 mm por junção (mín. 2); minifix ≈ 1 a cada 250 mm + cavilha; fita de borda + 10%.

## Plano de corte

`nestingEngine.ts` implementa o *Guillotine Bin Packing* (Jylänki, 2010) com kerf entre peças e refilo nas
bordas. Peças com veio travado não giram em chapas amadeiradas. Como heurísticas gulosas dependem da ordem,
o otimizador testa 120 combinações (5 ordenações × 3 critérios de encaixe × 4 regras de divisão × 2 seleções
de chapa) e fica com a que usa menos chapas (desempate: última chapa mais vazia = retalho maior).
Todos os cortes são de ponta a ponta — compatível com seccionadora e com serra circular + guia.

> As quantidades são estimativas de planejamento. Confira as medidas das ferragens escolhidas
> (dobradiças, corrediças) com o catálogo do fabricante antes de furar.
