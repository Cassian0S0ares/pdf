# Mapa de funções do Adobe Acrobat DC (referência)

Inventário usado como referência de funcionalidades para o LivrePDF.
Nenhum código, recurso gráfico ou texto da Adobe é copiado — apenas a
lista de funções serve de checklist.

## Fonte e método

- Instalação analisada: `C:\Program Files (x86)\Adobe\Acrobat DC`,
  `Acrobat.exe` versão **20.6.20042** (Acrobat DC 2020, x86).
- Análise estática apenas (nenhum binário foi executado):
  - 36 definições de ferramentas em `Acrobat\AcroApp\ENU\*.aapp`
    (XML, namespace `http://ns.adobe.com/acrobat/app/2014`), cada uma com
    `title`, `description`, lista de `<Command>` e layouts (`TopBar`, `RHP`).
  - 35 plug-ins em `Acrobat\plug_ins\*.api` (DLLs), identificados pelo
    `FileDescription` do recurso de versão PE.

## Arquitetura observada

- Núcleo de visualização + plug-ins `.api` carregados na inicialização.
- "Apps" de ferramentas declarados em XML: cada app lista comandos e
  define onde aparecem (barra superior, painel direito). UI declarativa
  sobre comandos implementados nos plug-ins.

## Plug-ins (`plug_ins\*.api`)

| Plug-in | Descrição |
|---|---|
| Accessibility, MakeAccessible | Acessibilidade, verificação e correção |
| AcroForm | Formulários |
| Annots | Anotações/comentários |
| Catalog, Search | Indexação e busca |
| Checkers, Preflight | Verificação/preflight |
| Compare | Comparar PDFs |
| DigSig, PPKLite | Assinatura digital, segurança por chave pública |
| DistillerPI | Template/Distiller |
| DropboxStorage, StorageConnectors | Armazenamento em nuvem |
| DVA | DVA |
| eBook | DRM |
| EScript | JavaScript |
| HTML2PDF, WebPDF, weblink | HTML/Web → PDF, links |
| IA32 | Acesso à internet |
| ImageConversion | Conversão de imagens |
| Multimedia | Multimídia |
| PaperCapture, Scan | Scan e OCR |
| PDDom | Modelo de documento |
| ReadOutLoud | Leitura em voz alta |
| reflow | Refluxo de texto |
| SaveAsRTF, SaveAsXML | Exportação |
| SendMail | Enviar por e-mail |
| Spelling | Ortografia |
| TouchUp | Edição de texto/imagem |
| Updater | Atualização |
| XPS2PDF | XPS → PDF |

## Ferramentas (`AcroApp\ENU\*.aapp`) e comandos principais

| Ferramenta | Comandos/funções observados |
|---|---|
| **Viewer / Home** | visualização, busca (`Find`) |
| **Comment** | Highlight, Underline, StrikeOut, Text (nota), FreeText, FreeTextCallout, Typewriter, Ink, EraseInk, Line, LineArrow, PolyLine, Polygon, PolygonCloud, Square, Circle, Caret, Replace, Stamp, FileAttachment, Sound, CommentList, filtrar/ordenar comentários |
| **Edit PDF** | TouchUpEditPDFTool, AddTextbox, AddImage, EditImage, ReplaceImage, formatação (fonte, tamanho, cor, negrito/itálico/sublinhado, sobrescrito/subscrito, listas, alinhamento, espaçamento), rotacionar/espelhar imagem, Crop, HeaderFooter, Watermark, BatesNumbering, DocBackground, Link, NewBookmark, AddFileAttachment, Thread, OCR automático |
| **Organize Pages** | Delete, Extract, Insert, Replace, Rotate CW/CCW, Split, CropPages, NumberPages, PageProperties, SetTransitions, BatesNumbering |
| **Combine Files** | adicionar arquivos, reordenar, inserir páginas, vista lista/miniaturas |
| **Prepare Form** | detectar campos (FindsFormFields), TextField, CheckBox, RadioButton, ComboBox, ListBox, Button, DateField, Barcode, alinhar/distribuir/centralizar campos, limpar formulário, importar/exportar dados, distribuir/rastrear formulário |
| **Fill & Sign** | texto, ✓, ✗, ●, linha, círculo, assinatura/iniciais, assinatura digital |
| **Certificates** | assinar com certificado, certificar, carimbo de tempo, validar assinaturas |
| **Protect** | criptografar com senha, restringir edição, remover informações ocultas, políticas de segurança |
| **Redact** | marcar para redação, aplicar redações, sanitizar documento |
| **Compress / Optimize PDF** | reduzir tamanho, PDF Optimizer (imagens, fontes, fast web view) |
| **Create PDF** | arquivo único, múltiplos arquivos, scanner, página web, área de transferência, captura de tela, página em branco |
| **Export PDF** | Word, Excel, PowerPoint, RTF, HTML, imagem (JPEG/PNG/TIFF/JPEG2000), EPS/PS, TXT, XML |
| **Scan & OCR** | capturar páginas, OCR com idioma, correção de OCR, limpeza/correção de perspectiva |
| **Compare Files** | comparar lado a lado/sobreposição, só texto, navegar diferenças |
| **Measure** | distância, perímetro, área, geolocalização |
| **Stamp** | carimbos padrão e personalizados |
| **Accessibility** | verificação completa, relatório, texto alternativo, ordem de leitura, autotag |
| **PDF Standards** | salvar como PDF/A, PDF/E, PDF/X, preflight |
| **Print Production** | preflight, conversão de cor, gerenciador de tintas, achatamento, linhas finas, marcas de impressão, trapping |
| **Action Wizard** | ações/fluxos automatizados, ferramentas personalizadas |
| **Index** | catálogo, índice embutido |
| **JavaScript** | JS do documento, ações do documento, depurador |
| **Rich Media** | 3D, vídeo, som, botões |
| **Adobe Sign / Share / Send for Comments** | serviços em nuvem Adobe (fora do escopo) |

## Limitações da análise

- Apenas o que as definições XML e metadados PE declaram; o comportamento
  interno dos plug-ins não foi decompilado.
- Comandos listados em XML não garantem que todos estejam habilitados
  nesta edição/licença.
