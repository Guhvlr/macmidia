export interface ReleaseNoteConfig {
  /**
   * Identificador único desta atualização.
   * Sempre que quiser que o aviso apareça 1 vez para cada funcionário,
   * basta criar um novo ID (ex: '2026-10-29-v1') e deixar `enabled: true`.
   */
  id: string;
  /**
   * Define se os funcionários verão o aviso com o que foi alterado:
   * - true: Exibe uma janela 1 única vez para cada usuário cadastrado ler as novidades e clicar em "OK".
   * - false: Atualização silenciosa (mostra apenas o botão normal de atualizar/F5, sem listar alterações).
   */
  enabled: boolean;
  title: string;
  date: string;
  items: string[];
}

export const CURRENT_RELEASE_NOTE: ReleaseNoteConfig = {
  id: '2026-10-29-v1',
  enabled: true,
  title: 'Novidades e Melhorias no Sistema',
  date: '29/10/2026',
  items: [
    'Ordem dos Cards: Ao mover um card para outra coluna (como Postagem), ele agora cai sempre em 1º lugar no topo.',
    'Reordenação Manual: Você também pode arrastar os cards para cima ou para baixo dentro da mesma coluna para organizar como preferir.',
    'Mais Velocidade e Busca Melhorada: Movimentação de cards sem travamentos e pesquisa no topo mais precisa (encontra todos os cards e ordena pelos mais recentes).',
    'IA de Código de Barras: Correção para produtos em KG — a IA não adiciona mais o número "1" na frente de KG quando não havia no texto original.',
    'Comentários do Card: Agora é possível excluir uma imagem específica de um comentário ou apagar o comentário inteiro.',
    'Etiquetas e Membros: Liberada a rolagem com o scroll (bolinha) do mouse dentro da lista de etiquetas e membros do card.',
  ],
};
