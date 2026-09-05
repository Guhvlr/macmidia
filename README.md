# MacMidia Pro / MacOferta

Um sistema profissional e avançado para gestão de produtos, remoção automática de fundos e geração de ofertas e encartes promocionais em massa. 

Este projeto automatiza a criação de artes para supermercados, farmácias e varejo em geral, integrando-se com serviços em nuvem para inteligência e armazenamento.

## 🚀 Tecnologias Utilizadas

**Frontend:**
- **[React 18](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)**: Base da aplicação.
- **[Vite](https://vitejs.dev/)**: Bundler ultrarrápido.
- **[Tailwind CSS](https://tailwindcss.com/)**: Estilização e design system.
- **[React Konva](https://github.com/konvajs/react-konva)**: Motor de renderização em Canvas 2D (usado no Gerador de Ofertas para desenhar os encartes e permitir arrastar/soltar elementos).
- **[Shadcn/UI](https://ui.shadcn.com/)** + **[Lucide React](https://lucide.dev/)**: Componentes de interface e ícones.

**Backend / Nuvem:**
- **[Supabase](https://supabase.com/)**: Banco de dados PostgreSQL, Autenticação, Storage (Buckets para imagens) e Edge Functions (Deno).
- **[Photoroom API](https://www.photoroom.com/api/)**: Integrado via Supabase Edge Functions para remoção de fundos de imagens de produtos com IA em tempo real.

## 📦 Funcionalidades Principais

1. **Gerador de Ofertas (MacOferta):**
   - Importação em lote de produtos via busca ultra-tolerante.
   - Edição visual de artes promocionais (arrastar, soltar, redimensionar, mudar cores).
   - Motor de exportação que gera PDFs para impressão ou imagens separadas (PNG/ZIP) para WhatsApp e Redes Sociais.
   - Suporte a múltiplas páginas e slots customizáveis.
   - Ícones de preço personalizados (padrões dinâmicos SVG e uploads em nuvem).

2. **Gestão de Produtos:**
   - Cadastro e listagem de milhares de produtos com EAN e código interno.
   - Pipeline de remoção de fundos com processamento assíncrono.
   - Tratamento de imagens (corte de margens vazias e redimensionamento automático).

3. **Kanban de Produtividade:**
   - Gestão de tarefas, aprovações e fluxo de trabalho da equipe de criação.
   - Scroll infinito e interface fluida.

## ⚙️ Como Executar Localmente

**1. Clone e Instale as Dependências**
\`\`\`bash
npm install
\`\`\`

**2. Configure as Variáveis de Ambiente**
Crie um arquivo \`.env\` na raiz do projeto contendo as credenciais do seu Supabase:
\`\`\`env
VITE_SUPABASE_URL="sua_url_do_supabase"
VITE_SUPABASE_ANON_KEY="sua_chave_anonima_do_supabase"
\`\`\`

*Nota: A chave do Photoroom (\`PHOTOROOM_API_KEY\`) deve ser configurada diretamente nos "Secrets" do painel do Supabase, pois é usada de forma segura pelas Edge Functions no backend.*

**3. Inicie o Servidor de Desenvolvimento**
\`\`\`bash
npm run dev
\`\`\`
O sistema estará rodando na porta padronizada (geralmente \`http://localhost:8080\`).

## 📁 Estrutura de Pastas (Principais)

- \`/src/features/offer-generator/\`: Core do Gerador de Encartes. Contém as etapas de importação, edição (Canvas), cores, configurações de badge (ícones de preço) e motor de renderização.
- \`/src/features/products/\`: Listagem e edição em massa de produtos e variações.
- \`/src/contexts/\`: Gerenciamento de estado global (ex: OfferContext.tsx, KanbanContext.tsx).
- \`/supabase/functions/\`: Código fonte das Edge Functions (backend serverless), como o \`remove-background\`.

## 🛠️ Próximos Passos (Tech Debt)
- [ ] Refatorar \`OfferEditorPage.tsx\` e quebrar em subcomponentes menores.
- [ ] Implementar testes unitários e E2E.
- [ ] Trocar cast \`as any\` por tipagens rígidas geradas do PostgreSQL (\`Database\` interface).
- [ ] Otimizar o \`OfferContext\` para reduzir re-renders.
