# LivrePDF — Design do MVP

- **Data:** 2026-11-03
- **Status:** aprovado em brainstorming, aguardando revisão da spec
- **Licença do projeto:** MIT
- **Referência de funções:** [`docs/acrobat-feature-map.md`](../../acrobat-feature-map.md)

## 1. Objetivo

Construir do zero um editor de PDF **desktop**, gratuito e open source,
cobrindo as funções mais usadas do Adobe Acrobat DC. Deve ser uma
aplicação instalável (`.exe`/`.msi`, `.dmg`, `.AppImage`/`.deb`), que
funciona 100% offline, sem servidor, sem conta e sem serviços em nuvem.

Não se copia nada da Adobe: o inventário do Acrobat serve apenas como
checklist de funcionalidades.

## 2. Decisões

| Tema | Decisão | Motivo |
|---|---|---|
| Plataforma | Tauri 2 (app desktop) | Instalador pequeno, nativo em Win/Mac/Linux, offline |
| UI | React + TypeScript (dentro do WebView do sistema) | Produtividade; PDF.js é JS |
| Renderização | PDF.js (Apache-2.0), **somente leitura/render** | Padrão do Firefox, camada de texto pronta |
| Motor de escrita | Rust + `lopdf` | Fonte única da verdade, licença permissiva |
| Criptografia/compressão | `qpdf` (Apache-2.0) como sidecar | Maduro, AES-256, linearização, object streams |
| Licença | MIT | Livre de verdade; dependências todas permissivas |
| Plugins | Não no MVP | YAGNI; módulos do core já isolados |

Alternativas descartadas: PDFium como motor único (UI recebe só bitmaps,
sem criptografia/redação); MuPDF (AGPL forçaria AGPL no projeto). PDFium
pode ser plugado depois apenas para edição de texto se `lopdf` não bastar.

## 3. Arquitetura

```
┌──────────── LivrePDF (Tauri 2) ─────────────────┐
│ UI (React + TypeScript)                         │
│  ├─ Viewer: PDF.js (canvas + camada de texto)   │
│  ├─ Camada de edição: overlay SVG/DOM por página│
│  ├─ Painéis: miniaturas, bookmarks, comentários │
│  └─ Store do documento (estado + undo/redo)     │
│              │ IPC: comandos Tauri (JSON)        │
│ Core Rust (crate livrepdf-core, sem UI)         │
│  ├─ doc:      abrir/salvar, sessões, incremental│
│  ├─ pages:    inserir/excluir/girar/extrair/merge│
│  ├─ annots:   anotações nativas com /AP          │
│  ├─ forms:    AcroForm ler/preencher/criar       │
│  ├─ edit:     overlay + edição in-place          │
│  ├─ redact:   remoção real de conteúdo           │
│  └─ security/optimize → qpdf (sidecar)           │
└─────────────────────────────────────────────────┘
```

Princípios:

1. **Core independente da UI.** `livrepdf-core` é uma biblioteca Rust
   pura, testável isoladamente, exposta também por `livrepdf-cli`.
2. **Rust é a fonte da verdade.** PDF.js nunca escreve; só renderiza os
   bytes que o core produz. Evita dois motores divergindo.
3. **Operações explícitas.** A UI emite `Operation`s; o core as aplica.
4. **Módulos com interface estreita.** Cada módulo do core expõe funções
   sobre `&mut Document` e não conhece os demais além de `doc`.

### Estrutura do repositório

```
pdf/
├─ crates/livrepdf-core/   # motor Rust (lib)
├─ crates/livrepdf-cli/    # CLI para testes/automação
├─ app/src-tauri/          # shell Tauri, comandos IPC
├─ app/src/                # UI React
├─ vendor/qpdf/            # binários sidecar por plataforma
└─ docs/
```

## 4. Escopo funcional do MVP

Legenda: ✅ no MVP · ⏭ fase posterior. Entre parênteses, a ferramenta
equivalente do Acrobat.

### 4.1 Viewer (Viewer, Home, Search)

- ✅ Abrir PDF por diálogo, arrastar-e-soltar e associação de arquivo
  `.pdf`; múltiplas abas.
- ✅ Zoom, ajustar à largura/página, rolagem contínua ou página única,
  girar vista.
- ✅ Painel lateral: miniaturas, bookmarks (outline), lista de anotações.
- ✅ Busca de texto com destaque; seleção e cópia de texto.
- ✅ Imprimir via diálogo do sistema.
- ✅ Abrir PDF protegido por senha.
- ⏭ Leitura em voz alta, reflow, modo escuro de página.
- Implementação: PDF.js com virtualização (renderiza só páginas
  visíveis).

### 4.2 Comentários (Comments, Annots, Stamp)

- ✅ Highlight, Underline, StrikeOut, nota adesiva (Text), FreeText, Ink,
  Square, Circle, Line/Arrow, Stamp (padrões: Aprovado, Rascunho,
  Confidencial, Revisado; e imagem personalizada).
- ✅ Editar cor, espessura, opacidade; mover, redimensionar, excluir;
  autor e data.
- ✅ Ler e preservar anotações criadas por outros programas.
- ⏭ Polygon/Cloud, Caret/Replace, Sound, respostas em thread, FDF.
- Implementação: overlay SVG captura a interação; Rust grava anotações
  PDF nativas **com aparência (`/AP`)** para exibição correta em
  qualquer leitor.

### 4.3 Organizar + Combinar (Organize Pages, Combine Files)

- ✅ Grade de miniaturas com arrastar para reordenar.
- ✅ Girar, excluir, extrair, inserir (de arquivo ou página em branco),
  substituir, dividir (por intervalo ou a cada N páginas).
- ✅ Combinar vários PDFs e imagens JPG/PNG (imagem vira página).
- ⏭ Bates, numeração de páginas, transições.
- Implementação: `lopdf` copia objetos entre documentos com renumeração;
  preserva bookmarks quando as páginas de destino existem.

### 4.4 Formulários + Assinar (Prepare Form, Fill & Sign)

- ✅ Preencher AcroForm: texto, checkbox, radio, combo/lista; salvar com
  aparências regeneradas.
- ✅ Criar campos básicos: texto, checkbox, campo de assinatura visual.
- ✅ Limpar formulário; achatar formulário (flatten).
- ✅ Fill & Sign: texto livre, ✓, ✗, ●, data, assinatura visual
  (desenhar, digitar ou imagem), assinaturas salvas localmente.
- ⏭ Detecção automática de campos, XFA, scripts JS de cálculo,
  importar/exportar dados, assinatura digital com certificado (PAdES).

### 4.5 Edição (Edit PDF, TouchUp)

- ✅ **Nível 1 — overlay:** adicionar caixa de texto (fonte, tamanho, cor,
  alinhamento); adicionar/mover/redimensionar imagem; cabeçalho/rodapé;
  marca d'água; links (URL ou página); editar bookmarks.
- ✅ **Nível 2 — in-place:** clicar numa linha de texto existente e
  substituir o conteúdo.
  - O core analisa o content stream e mapeia o texto visível para os
    operadores `Tj`/`TJ` usando bbox calculado com as métricas da fonte.
  - Se a fonte embutida tem todos os glifos necessários: reescreve o
    operador.
  - Se faltam glifos (fonte subset): o app avisa e oferece fallback —
    remove os glifos originais da linha e escreve a nova linha como
    texto com fonte similar embutida.
- ✅ Recortar página (CropBox).
- ⏭ Nível 3 (edição de parágrafo com reflow), editar imagem existente,
  fundo de página.

### 4.6 Proteger + Redigir + Comprimir (Protect, Redact, Compress/Optimize)

- ✅ Senha de abertura e de permissões (AES-256); restringir imprimir,
  copiar, editar; remover senha (com a senha conhecida). Via `qpdf`.
- ✅ **Redação real:** marcar área ou texto e aplicar. Remove glifos e
  conteúdo vetorial dentro da área, recorta/mascara imagens sob a área e
  desenha tarja. Confirmação explícita: ação irreversível.
- ✅ Remover informações ocultas: Info, XMP, anexos, JavaScript.
- ✅ Comprimir em 3 níveis (baixo/médio/alto): reamostrar e recomprimir
  imagens em JPEG, `qpdf --object-streams=generate`, remover objetos
  duplicados/não usados.
- ✅ Linearizar (fast web view).
- ⏭ Preflight, PDF/A/X/E.

### 4.7 Fora do MVP

OCR, conversão de/para Word/Excel/PowerPoint, Compare, Measure,
Acessibilidade, Action Wizard, JavaScript, Rich Media, Index, Print
Production e todos os serviços em nuvem (Sign, Share, Review).

## 5. Fluxo de dados

```
Usuário age na UI ──► Operation { kind, page, params } ──► fila (undo/redo)
        │                                                   │
        │                              invoke("apply_ops", docId, ops)
        ▼                                                   ▼
 overlay mostra prévia                Rust aplica em lopdf::Document
 instantânea (otimista)                     │ serializa → bytes PDF
        ▲                                   ▼
        └──── PDF.js recarrega páginas afetadas ◄── bytes + páginas sujas
```

- **Sessão:** o core mantém `docId → DocumentSession` (documento em
  memória, caminho de origem, histórico de operações, flag de alterado).
- **Undo/redo:** cada `Operation` registra seu inverso. Operações
  destrutivas (redação, flatten, compressão) gravam snapshot do documento
  antes de executar.
- **Desempenho:** recarregar apenas páginas afetadas; arquivos grandes
  (> 100 MB) lidos via mmap.

### Interface IPC (comandos Tauri)

| Comando | Entrada | Saída |
|---|---|---|
| `open_document` | caminho, senha? | `docId`, metadados, nº de páginas |
| `get_document_bytes` | `docId` | bytes PDF atuais |
| `apply_ops` | `docId`, `Operation[]` | páginas afetadas, nova revisão |
| `undo` / `redo` | `docId` | páginas afetadas, revisão |
| `save` / `save_as` | `docId`, caminho? | ok / `AppError` |
| `close_document` | `docId` | ok |
| `merge_files` | caminhos[] | `docId` novo |
| `protect` / `unprotect` | `docId`, opções | ok / `AppError` |
| `compress` | `docId`, nível | tamanho antes/depois |

## 6. Salvamento

- **Salvar** grava em arquivo temporário no mesmo diretório e renomeia
  atomicamente sobre o original.
- **Incremental** (append) para alterações só de anotações/formulários —
  preserva assinaturas digitais existentes.
- **Reescrita completa** para mudanças estruturais (páginas, edição de
  content stream, redação, compressão).
- **Redação força reescrita completa** e descarta revisões anteriores,
  para que o conteúdo removido não sobreviva no arquivo.
- Salvar como; autosave de recuperação a cada 2 min em
  `%APPDATA%\LivrePDF\recovery` (equivalente por SO); aviso ao fechar
  com alterações não salvas.

## 7. Tratamento de erros

- Todo erro do core é `AppError { code, message, details }` tipado e
  serializável para a UI.
- PDF corrompido: tentativa de reparo (reconstrução da xref); se falhar,
  abre somente leitura via PDF.js com aviso.
- PDF criptografado: solicita senha; permissões restritas são
  respeitadas e a UI mostra o motivo do bloqueio.
- Glifo ausente na edição in-place: oferece fallback (seção 4.5).
- Falha do `qpdf`: mensagem clara, documento inalterado.
- Log local em `%APPDATA%\LivrePDF\logs` (equivalente por SO).

## 8. Testes

- **Core (Rust):** testes unitários por módulo; corpus de PDFs gerados
  nos próprios testes + amostras públicas (pdf.js, qpdf).
- **Round-trip:** abrir → operar → salvar → reabrir; validar com
  `qpdf --check` e carregamento pelo PDF.js.
- **Redação:** após aplicar, extrair texto e conferir que o conteúdo
  removido não existe em nenhum objeto do arquivo.
- **Regressão visual:** render antes/depois e diff de pixels nas
  operações que não devem alterar a aparência.
- **UI:** Vitest (store e componentes); Playwright + `tauri-driver` para
  fluxos E2E (abrir, anotar, salvar).
- **CI:** GitHub Actions compila e testa em Windows, macOS e Linux e
  publica instaladores nas releases.

## 9. Fases de entrega (dentro do MVP)

Cada fase termina com um app funcional e testado.

1. Esqueleto (workspace Rust, Tauri, React, CI) + Viewer
2. Organizar + Combinar
3. Comentários
4. Formulários + Assinar
5. Edição nível 1, depois nível 2
6. Proteger, Redigir, Comprimir
7. Instaladores e primeira release

## 10. Riscos

| Risco | Mitigação |
|---|---|
| Edição in-place falha em fontes subset/CID | Fallback para overlay com fonte embutida; avisar usuário |
| `lopdf` com PDFs malformados | Reparo de xref; modo somente leitura |
| Redação incompleta (texto em XObjects, imagens) | Percorrer Form XObjects recursivamente; teste de extração obrigatório |
| Divergência render PDF.js × arquivo salvo | Rust é fonte única; PDF.js sempre recarrega dos bytes do core |
| Tamanho/licença do sidecar qpdf | Binários oficiais Apache-2.0 por plataforma em `vendor/qpdf` |
