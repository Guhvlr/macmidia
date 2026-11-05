import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Instagram,
  Send,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Layers,
  Image as ImageIcon,
  Film,
  ExternalLink,
  Clock,
  ArrowLeft,
  Folder,
  Loader2,
  KeyRound,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useApp } from '@/contexts/useApp';
import { useSocialPosts } from '../hooks/useSocialPosts';
import { isVideoUrl, PLACEMENT_LABELS, SocialPost } from '../types';
import { SocialPostComposerDialog } from '../components/SocialPostComposerDialog';
import {
  getStoredPostForMeApiKey,
  savePostForMeApiKey,
  socialProvider,
} from '../api/socialProvider';

const COLUMNS = [
  {
    key: 'para_postar' as const,
    title: 'Para Postar',
    subtitle: 'Aguardando legenda / envio',
    badgeClass: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    dotClass: 'bg-pink-500',
    icon: Send,
  },
  {
    key: 'programado' as const,
    title: 'Programado',
    subtitle: 'Agendados com data e hora',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    dotClass: 'bg-purple-500',
    icon: CalendarIcon,
  },
  {
    key: 'erro' as const,
    title: 'Deu Erro',
    subtitle: 'Falha no envio — clique para revisar',
    badgeClass: 'bg-red-500/20 text-red-300 border-red-500/30',
    dotClass: 'bg-red-500',
    icon: AlertTriangle,
  },
  {
    key: 'postado' as const,
    title: 'Postado',
    subtitle: 'Concluídos no Instagram',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
];

const SocialPostingHub: React.FC = () => {
  const navigate = useNavigate();
  const { calendarClients, kanbanCards } = useApp();
  const { posts, loading, fetchPosts, createPost, updatePost, deletePost, submitPost } =
    useSocialPosts();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  React.useEffect(() => {
    getStoredPostForMeApiKey().then(k => {
      setHasApiKey(Boolean(k));
      if (k) setApiKeyInput(k);
    });
  }, []);

  const handleSaveApiKey = async () => {
    await savePostForMeApiKey(apiKeyInput);
    setHasApiKey(Boolean(apiKeyInput.trim()));
    setApiKeyModalOpen(false);
    toast.success(
      apiKeyInput.trim()
        ? 'Chave da API Post for Me salva e ativada com sucesso!'
        : 'Chave da API removida.'
    );
  };

  const clientMap = useMemo(() => {
    const map = new Map<string, (typeof calendarClients)[number]>();
    calendarClients.forEach(c => map.set(c.id, c));
    return map;
  }, [calendarClients]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter(post => {
      if (clientFilter !== 'all' && post.calendarClientId !== clientFilter) {
        return false;
      }
      if (!q) return true;
      const client = post.calendarClientId ? clientMap.get(post.calendarClientId) : undefined;
      return (
        post.title.toLowerCase().includes(q) ||
        post.caption.toLowerCase().includes(q) ||
        (client?.name.toLowerCase().includes(q) ?? false) ||
        (client?.instagramUsername?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [posts, clientFilter, searchQuery, clientMap]);

  const postsByColumn = useMemo(() => {
    const grouped: Record<'para_postar' | 'programado' | 'erro' | 'postado', SocialPost[]> = {
      para_postar: [],
      programado: [],
      erro: [],
      postado: [],
    };
    filteredPosts.forEach(p => {
      if (p.status === 'programado' || p.status === 'publicando') {
        grouped.programado.push(p);
      } else if (p.status === 'erro') {
        grouped.erro.push(p);
      } else if (p.status === 'postado') {
        grouped.postado.push(p);
      } else {
        grouped.para_postar.push(p);
      }
    });
    return grouped;
  }, [filteredPosts]);

  const selectedPost = useMemo(
    () => posts.find(p => p.id === selectedPostId) || null,
    [posts, selectedPostId]
  );

  const handleCreateStandalonePost = async () => {
    const created = await createPost({
      title: 'Nova Postagem',
      calendarClientId: clientFilter !== 'all' ? clientFilter : undefined,
      placement: 'feed',
      media: [],
      caption: '',
    });
    if (created) {
      setSelectedPostId(created.id);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      for (const p of posts) {
        if (p.providerPostId) {
          const check = await socialProvider.checkPostStatus(p.providerPostId);
          if (check.ok && check.data) {
            if (check.data.status === 'erro') {
              await updatePost(p.id, {
                status: 'erro',
                errorMessage: check.data.errorMessage || 'Falha ao publicar no Instagram.',
              });
            } else if (check.data.status === 'postado') {
              await updatePost(p.id, {
                status: 'postado',
                publishedAt: p.publishedAt || new Date().toISOString(),
                permalink: check.data.permalink || p.permalink,
                errorMessage: undefined,
              });
            }
          }
        }
      }
      await fetchPosts();
      toast.success('Fila de postagens sincronizada com o Post for Me!');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#08080a]">
      {/* Header */}
      <header className="px-4 md:px-6 py-4 bg-[#121214]/90 backdrop-blur-xl border-b border-white/5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/postagem')}
            className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5"
            title="Voltar para o Kanban de Postagem"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
            <Instagram className="w-5 h-5" />
          </div>

          <div>
            <h1 className="text-lg md:text-xl font-black text-white tracking-tight uppercase">
              Central de Postagem • Instagram
            </h1>
            <p className="text-[11px] text-white/40 font-medium">
              Clique em um card para escolher Feed ou Stories, editar as imagens, escrever a legenda e postar ou programar
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Busca */}
          <div className="relative w-48 sm:w-60">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente ou post..."
              className="h-9 pl-8 bg-white/5 border-white/10 rounded-xl text-xs text-white placeholder:text-white/30"
            />
          </div>

          {/* Filtro por Cliente */}
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[190px] h-9 bg-white/5 border-white/10 rounded-xl text-xs text-white font-semibold">
              <SelectValue placeholder="Filtrar por Cliente" />
            </SelectTrigger>
            <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl">
              <SelectItem value="all">Todos os Clientes</SelectItem>
              {calendarClients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.instagramUsername ? `(${c.instagramUsername})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setApiKeyModalOpen(true)}
            className={`h-9 rounded-xl border text-xs font-bold ${
              hasApiKey
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 mr-1.5" />
            {hasApiKey ? 'API Ativa' : 'Chave API'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/cofre')}
            className="h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold"
          >
            <Folder className="w-3.5 h-3.5 mr-1.5 text-pink-400" />
            Contas Instagram
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleCreateStandalonePost}
            className="h-9 rounded-xl bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-wider shadow-lg"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Novo Post
          </Button>
        </div>
      </header>

      {/* Colunas da Central de Postagem */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 md:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 h-full min-w-[300px]">
            {COLUMNS.map(col => {
              const colPosts = postsByColumn[col.key];
              const Icon = col.icon;
              return (
                <div
                  key={col.key}
                  className="flex flex-col h-full rounded-2xl bg-[#121214]/90 border border-white/5 overflow-hidden"
                >
                  {/* Cabeçalho da Coluna */}
                  <div className="p-4 border-b border-white/5 bg-[#18181b]/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dotClass}`} />
                      <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 opacity-80" />
                          {col.title}
                        </h2>
                        <p className="text-[10px] text-white/40">{col.subtitle}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${col.badgeClass}`}
                    >
                      {colPosts.length}
                    </span>
                  </div>

                  {/* Lista de Cards da Coluna */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                    {colPosts.length === 0 ? (
                      <div className="h-44 rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center p-4 text-white/25 text-xs">
                        <Icon className="w-6 h-6 mb-2 opacity-30" />
                        Nenhum card em "{col.title}"
                      </div>
                    ) : (
                      colPosts.map(post => {
                        const client = post.calendarClientId
                          ? clientMap.get(post.calendarClientId)
                          : undefined;
                        const cover = post.media[0];
                        return (
                          <div
                            key={post.id}
                            onClick={() => setSelectedPostId(post.id)}
                            className={`group rounded-xl bg-[#1C1C1E] hover:bg-[#242428] border transition-all cursor-pointer overflow-hidden shadow-md ${
                              post.status === 'erro'
                                ? 'border-red-500/40 hover:border-red-500/70'
                                : 'border-white/5 hover:border-white/15'
                            }`}
                          >
                            {/* Preview de Imagem ou Vídeo */}
                            {cover ? (
                              <div className="relative bg-black/50 h-44 flex items-center justify-center overflow-hidden">
                                {isVideoUrl(cover) ? (
                                  <video
                                    src={cover}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <img
                                    src={cover}
                                    alt=""
                                    loading="lazy"
                                    className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                                  />
                                )}

                                {/* Badge Formato (Feed / Stories / Reels) */}
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/15 text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1">
                                  {(() => {
                                    const activeLabels: string[] = [];
                                    if ((post.feedMedia?.length ?? 0) > 0) activeLabels.push('Feed');
                                    if ((post.reelsMedia?.length ?? 0) > 0) activeLabels.push('Reels');
                                    if ((post.storiesMedia?.length ?? 0) > 0)
                                      activeLabels.push('Stories');
                                    if (activeLabels.length > 1) {
                                      return (
                                        <>
                                          <Layers className="w-3 h-3 text-pink-400" />
                                          {activeLabels.join(' + ')}
                                        </>
                                      );
                                    }
                                    return (
                                      <>
                                        {post.placement === 'feed' && (
                                          <Layers className="w-3 h-3 text-pink-400" />
                                        )}
                                        {post.placement === 'stories' && (
                                          <ImageIcon className="w-3 h-3 text-orange-400" />
                                        )}
                                        {post.placement === 'reels' && (
                                          <Film className="w-3 h-3 text-purple-400" />
                                        )}
                                        {PLACEMENT_LABELS[post.placement]}
                                      </>
                                    );
                                  })()}
                                </span>

                                {/* Quantidade de imagens */}
                                {post.media.length > 1 && (
                                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/15 text-[10px] font-bold text-white">
                                    {post.media.length} fotos
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="h-24 bg-black/30 flex items-center justify-center text-white/25 text-xs">
                                <ImageIcon className="w-5 h-5 mr-1.5 opacity-40" /> Sem imagem selecionada
                              </div>
                            )}

                            {/* Info do Cliente + Data / Status */}
                            <div className="p-3 space-y-2">
                              {/* Cliente vinculado + Botão Excluir */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-600 to-orange-500 flex items-center justify-center text-[10px] font-black text-white overflow-hidden shrink-0">
                                    {client?.logoUrl ? (
                                      <img
                                        src={client.logoUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      (client?.name || post.title || 'C').substring(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-white truncate">
                                      {client?.name || post.title}
                                    </p>
                                    {client?.instagramUsername && (
                                      <p className="text-[10px] text-pink-400 font-semibold truncate">
                                        {client.instagramUsername}
                                        {client.facebookPageName
                                          ? ` • FB: ${client.facebookPageName}`
                                          : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={async e => {
                                    e.stopPropagation();
                                    await deletePost(post.id);
                                    toast.success(
                                      post.status === 'programado'
                                        ? 'Agendamento cancelado e excluído!'
                                        : 'Card removido!'
                                    );
                                  }}
                                  title={
                                    post.status === 'programado'
                                      ? 'Cancelar agendamento no Post for Me e excluir'
                                      : 'Excluir card do painel'
                                  }
                                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 flex items-center justify-center shrink-0 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {post.title && client?.name && post.title !== client.name && (
                                <p className="text-[11px] text-white/70 font-medium line-clamp-1">
                                  {post.title}
                                </p>
                              )}

                              {post.caption && (
                                <p className="text-[11px] text-white/45 line-clamp-2 leading-relaxed">
                                  {post.caption}
                                </p>
                              )}

                              {/* Data Programada */}
                              {post.scheduledAt && post.status !== 'postado' && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-lg w-fit">
                                  <Clock className="w-3 h-3" />
                                  Programado:{' '}
                                  {new Date(post.scheduledAt).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              )}

                              {/* Data Postado */}
                              {post.status === 'postado' && (
                                <div className="flex items-center justify-between gap-2 pt-1">
                                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Postado em{' '}
                                    {new Date(post.publishedAt || post.updatedAt).toLocaleString(
                                      'pt-BR',
                                      {
                                        day: '2-digit',
                                        month: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      }
                                    )}
                                  </span>
                                  {post.permalink && (
                                    <a
                                      href={post.permalink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="text-[10px] font-bold text-pink-400 hover:underline flex items-center gap-1"
                                    >
                                      Abrir <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Motivo do Erro */}
                              {post.status === 'erro' && (
                                <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/25 text-[10px] text-red-300 flex items-start gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                  <span className="line-clamp-2">
                                    {post.errorMessage || 'Erro ao publicar. Clique para revisar e tentar novamente.'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Compositor (Legenda, Feed/Stories, Seleção de Imagens e Agendamento) */}
      <SocialPostComposerDialog
        post={selectedPost}
        open={Boolean(selectedPost)}
        onOpenChange={open => {
          if (!open) setSelectedPostId(null);
        }}
        clients={calendarClients}
        kanbanCards={kanbanCards}
        onUpdatePost={updatePost}
        onCreatePost={createPost}
        onDeletePost={deletePost}
        onSubmitPost={submitPost}
      />

      {/* Modal para colar a Chave de API do Post for Me */}
      <Dialog open={apiKeyModalOpen} onOpenChange={setApiKeyModalOpen}>
        <DialogContent className="max-w-md bg-[#121214] border-white/10 text-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <KeyRound className="w-5 h-5 text-pink-500" />
              Chave da API • Post for Me
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50">
              No painel do Post for Me, clique em <strong>Chaves de API</strong> no menu lateral esquerdo, gere uma chave e cole abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              type="password"
              placeholder="Cole sua API Key aqui..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              className="bg-white/5 border-white/10 rounded-xl h-11 text-xs font-mono text-white"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setApiKeyModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveApiKey}
                className="rounded-xl bg-gradient-to-r from-pink-600 to-orange-500 text-white text-xs font-bold px-5"
              >
                Salvar Chave API
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SocialPostingHub;
