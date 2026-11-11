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
  Star,
  Flame,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
    subtitle: 'Concluídos no Instagram / Facebook',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    icon: CheckCircle2,
  },
];

/**
 * Preview de mídia do card com detecção de falha de carregamento (onError)
 * e fallback automático para outras fotos do card ou aviso de mídia expirada/excluída.
 */
const PostCardMediaPreview: React.FC<{ post: SocialPost }> = ({ post }) => {
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (post.reelsCoverUrl) list.push(post.reelsCoverUrl);
    if (post.coverUrl) list.push(post.coverUrl);
    if (post.feedMedia && post.feedMedia.length > 0) list.push(...post.feedMedia);
    if (post.storiesMedia && post.storiesMedia.length > 0) list.push(...post.storiesMedia);
    if (post.media && post.media.length > 0) list.push(...post.media);
    return Array.from(new Set(list.filter(Boolean)));
  }, [post]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const currentMedia = candidates[currentIndex];

  if (!currentMedia || allFailed) {
    return (
      <div className="h-44 bg-black/60 border-b border-white/5 flex flex-col items-center justify-center p-3 text-center">
        <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold text-amber-300">Mídia indisponível</p>
        <p className="text-[10px] text-white/40 mt-0.5">Link expirado ou excluído no Kanban</p>
        <span className="mt-2 text-[10px] font-semibold text-pink-400 underline decoration-pink-400/40">
          Clique para reanexar foto/vídeo
        </span>
      </div>
    );
  }

  const isVid = isVideoUrl(currentMedia);

  return (
    <div className="relative bg-black/50 h-44 flex items-center justify-center overflow-hidden">
      {isVid ? (
        <video
          src={currentMedia}
          muted
          playsInline
          preload="metadata"
          onError={() => {
            if (currentIndex + 1 < candidates.length) {
              setCurrentIndex(currentIndex + 1);
            } else {
              setAllFailed(true);
            }
          }}
          className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <img
          src={currentMedia}
          alt=""
          loading="lazy"
          onError={() => {
            if (currentIndex + 1 < candidates.length) {
              setCurrentIndex(currentIndex + 1);
            } else {
              setAllFailed(true);
            }
          }}
          className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
        />
      )}

      {/* Badges no Topo */}
      <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1 max-w-[80%]">
        <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/15 text-[10px] font-black uppercase tracking-wider text-white flex items-center gap-1">
          {(() => {
            const activeLabels: string[] = [];
            if ((post.feedMedia?.length ?? 0) > 0) activeLabels.push('Feed');
            if ((post.reelsMedia?.length ?? 0) > 0) activeLabels.push('Reels');
            if ((post.storiesMedia?.length ?? 0) > 0) activeLabels.push('Stories');
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
                {post.placement === 'feed' && <Layers className="w-3 h-3 text-pink-400" />}
                {post.placement === 'stories' && <ImageIcon className="w-3 h-3 text-orange-400" />}
                {post.placement === 'reels' && <Film className="w-3 h-3 text-purple-400" />}
                {PLACEMENT_LABELS[post.placement]}
              </>
            );
          })()}
        </span>

        {post.reelsCoverUrl && (
          <span className="px-1.5 py-0.5 rounded-md bg-purple-600 text-white text-[9px] font-black uppercase shadow flex items-center gap-0.5">
            <Film className="w-2.5 h-2.5" /> Capa Reels
          </span>
        )}

        {post.repeatTotal && (
          <span className="px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-[9px] font-black uppercase shadow flex items-center gap-0.5">
            <Flame className="w-2.5 h-2.5" /> Dia {post.repeatIndex || 1}/{post.repeatTotal}
          </span>
        )}
      </div>

      {post.media.length > 1 && (
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-sm border border-white/15 text-[10px] font-bold text-white">
          {post.media.length} fotos
        </span>
      )}
    </div>
  );
};

const SocialPostingHub: React.FC = () => {
  const navigate = useNavigate();
  const { calendarClients, kanbanCards, loggedUserRole, loggedUserClientLink } = useApp();
  const {
    posts,
    loading,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
    clearPostedPosts,
    submitPost,
    createRecurringOfferBatch,
  } = useSocialPosts();

  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [activeMobileCol, setActiveMobileCol] = useState<'para_postar' | 'programado' | 'erro' | 'postado'>('para_postar');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearingPosted, setIsClearingPosted] = useState(false);
  const [showClearPostedDialog, setShowClearPostedDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<SocialPost | null>(null);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditData, setAuditData] = useState<{
    totalResults: number;
    totalSocialPosts: number;
    storiesPostsCount: number;
    feedPostsCount: number;
    totalAccountTargetsInPosts: number;
    totalMediaItemsInPosts: number;
    instagramCount: number;
    facebookCount: number;
    successCount: number;
    failedCount: number;
    byAccount: {
      accountId: string;
      name: string;
      username: string;
      platform: string;
      total: number;
      success: number;
      failed: number;
    }[];
  } | null>(null);

  const handleOpenAudit = async () => {
    setAuditModalOpen(true);
    setIsAuditing(true);
    try {
      const res = await socialProvider.auditPostResults();
      if (res.ok && res.data) {
        setAuditData(res.data);
      } else {
        toast.error(res.message || 'Não foi possível consultar /v1/social-post-results.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao consultar auditoria do Post for Me.');
    } finally {
      setIsAuditing(false);
    }
  };

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

  const allowedGuestClientIds = useMemo(
    () =>
      loggedUserRole === 'GUEST'
        ? (loggedUserClientLink || '')
            .split(',')
            .map(id => id.trim())
            .filter(Boolean)
        : [],
    [loggedUserRole, loggedUserClientLink]
  );

  const visibleClients = useMemo(() => {
    if (loggedUserRole === 'GUEST') {
      return calendarClients.filter(c => allowedGuestClientIds.includes(c.id));
    }
    return calendarClients;
  }, [calendarClients, loggedUserRole, allowedGuestClientIds]);

  const visibleKanbanCards = useMemo(() => {
    if (loggedUserRole === 'GUEST') {
      return kanbanCards.filter(
        c => c.calendarClientId && allowedGuestClientIds.includes(c.calendarClientId)
      );
    }
    return kanbanCards;
  }, [kanbanCards, loggedUserRole, allowedGuestClientIds]);

  const filteredPosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return posts.filter(post => {
      // Restrição para Visitantes (GUEST): exibe SOMENTE os cards vinculados aos clientes dele
      const effectiveClientId =
        post.calendarClientId ||
        (post.kanbanCardId
          ? kanbanCards.find(k => k.id === post.kanbanCardId)?.calendarClientId
          : undefined);

      if (loggedUserRole === 'GUEST') {
        if (!effectiveClientId || !allowedGuestClientIds.includes(effectiveClientId)) {
          return false;
        }
      }

      if (clientFilter !== 'all' && effectiveClientId !== clientFilter) {
        return false;
      }
      if (!q) return true;
      const client = effectiveClientId ? clientMap.get(effectiveClientId) : undefined;
      return (
        post.title.toLowerCase().includes(q) ||
        post.caption.toLowerCase().includes(q) ||
        (client?.name.toLowerCase().includes(q) ?? false) ||
        (client?.instagramUsername?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [posts, clientFilter, searchQuery, clientMap, loggedUserRole, allowedGuestClientIds, kanbanCards]);

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
    () => filteredPosts.find(p => p.id === selectedPostId) || null,
    [filteredPosts, selectedPostId]
  );

  const handleCreateStandalonePost = async () => {
    const defaultClientId =
      clientFilter !== 'all'
        ? clientFilter
        : loggedUserRole === 'GUEST' && allowedGuestClientIds.length > 0
          ? allowedGuestClientIds[0]
          : undefined;
    const defaultClient = defaultClientId ? clientMap.get(defaultClientId) : undefined;
    const created = await createPost({
      title: defaultClient?.name || 'Nova Postagem',
      calendarClientId: defaultClientId,
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
                errorMessage: check.data.warning,
              });
            } else if (check.data.status === 'programado' && p.status !== 'programado') {
              // Ainda está agendado no Post for Me: volta o card para "Programado"
              await updatePost(p.id, {
                status: 'programado',
                publishedAt: undefined,
                permalink: undefined,
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

  const renderColumnCards = (colKey: 'para_postar' | 'programado' | 'erro' | 'postado') => {
    const colPosts = postsByColumn[colKey];
    const col = COLUMNS.find(c => c.key === colKey)!;
    const Icon = col.icon;

    if (colPosts.length === 0) {
      return (
        <div className="h-44 rounded-xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center p-4 text-white/25 text-xs">
          <Icon className="w-6 h-6 mb-2 opacity-30" />
          Nenhum card em "{col.title}"
        </div>
      );
    }

    return colPosts.map(post => {
      const client = post.calendarClientId
        ? clientMap.get(post.calendarClientId)
        : undefined;
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
          {/* Preview de Mídia com Fallback Inteligente */}
          <PostCardMediaPreview post={post} />

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
                onClick={e => {
                  e.stopPropagation();
                  setPostToDelete(post);
                }}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 flex items-center justify-center transition-colors shrink-0"
                title="Excluir Post"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Snippet da Legenda */}
            {post.caption && (
              <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                {post.caption}
              </p>
            )}

            {/* Rodapé do Card: Data / Status */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3 h-3 opacity-60" />
                {post.scheduledAt ? (
                  <>
                    {new Date(post.scheduledAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    às{' '}
                    {new Date(post.scheduledAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </>
                ) : (
                  'Não agendado'
                )}
              </span>

              {post.status === 'postado' && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                  Publicado ✓
                </span>
              )}
              {post.status === 'programado' && (
                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold border border-purple-500/20">
                  Programado
                </span>
              )}
              {post.status === 'erro' && (
                <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                  Erro
                </span>
              )}
            </div>

            {/* Link direto para a postagem no Instagram (quando já postado) */}
            {post.status === 'postado' && (
              <div className="pt-1 flex items-center justify-end">
                {post.permalink ? (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[10px] font-bold text-pink-400 hover:underline flex items-center gap-1"
                  >
                    Ver no Instagram <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : (
                  <a
                    href={
                      client?.instagramUsername
                        ? `https://www.instagram.com/${client.instagramUsername.replace(/^@/, '')}/`
                        : 'https://www.instagram.com/'
                    }
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

            {/* Alerta/Aviso quando postado (ex: Facebook unknown error que posta mesmo assim) */}
            {post.status === 'postado' && post.errorMessage && (
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-300 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  {post.errorMessage}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#08080a]">
      {/* Header */}
      <header className="px-3 sm:px-6 py-3 sm:py-4 bg-[#121214]/90 backdrop-blur-xl border-b border-white/5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/postagem')}
            className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 shrink-0"
            title="Voltar para o Kanban de Postagem"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-white tracking-tight uppercase truncate">
              Central de Postagem
            </h1>
            <p className="hidden sm:block text-[11px] text-white/40 font-medium">
              Clique em um card para escolher Feed ou Stories, editar imagens, legenda e programar
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Busca */}
          <div className="relative flex-1 sm:w-52 min-w-[140px]">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente..."
              className="h-9 pl-8 bg-white/5 border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 w-full"
            />
          </div>

          {/* Filtro por Cliente */}
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full sm:w-[170px] h-9 bg-white/5 border-white/10 rounded-xl text-xs text-white font-semibold">
              <SelectValue placeholder="Filtrar por Cliente" />
            </SelectTrigger>
            <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl">
              <SelectItem value="all">
                {loggedUserRole === 'GUEST' ? 'Meus Clientes' : 'Todos os Clientes'}
              </SelectItem>
              {visibleClients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.instagramUsername ? `(${c.instagramUsername})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
            {loggedUserRole !== 'GUEST' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setApiKeyModalOpen(true)}
                  className={`h-9 px-2.5 rounded-xl border text-xs font-bold ${
                    hasApiKey
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                  }`}
                  title={hasApiKey ? 'Chave de API ativa' : 'Configurar chave de API'}
                >
                  <KeyRound className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">{hasApiKey ? 'API Ativa' : 'Chave API'}</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenAudit}
                  className="h-9 px-2.5 rounded-xl border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold"
                  title="Auditar consumo e disparos em /v1/social-post-results"
                >
                  <Layers className="w-3.5 h-3.5 sm:mr-1.5 text-purple-400" />
                  <span className="hidden sm:inline">Auditoria API</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/cofre')}
                  className="h-9 px-2.5 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold"
                  title="Gerenciar Contas Instagram"
                >
                  <Folder className="w-3.5 h-3.5 sm:mr-1.5 text-pink-400" />
                  <span className="hidden sm:inline">Contas</span>
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-9 px-2.5 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold"
              title="Atualizar fila"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''} sm:mr-1.5`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleCreateStandalonePost}
              className="h-9 px-3 rounded-xl bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-wider shadow-lg"
            >
              <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
              <span>Novo Post</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Barra de Navegação de Colunas no Celular (md:hidden) */}
      <div className="md:hidden flex items-center gap-1.5 p-2 bg-[#121214] border-b border-white/5 overflow-x-auto shrink-0 custom-scrollbar">
        {COLUMNS.map(col => {
          const isSelected = activeMobileCol === col.key;
          const count = postsByColumn[col.key].length;
          const Icon = col.icon;
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => setActiveMobileCol(col.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                isSelected
                  ? 'bg-gradient-to-r from-pink-600 to-orange-500 text-white shadow-md'
                  : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${col.dotClass}`} />
              <Icon className="w-3.5 h-3.5" />
              <span>{col.title}</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-black/40 text-white' : 'bg-white/10 text-white/70'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Colunas da Central de Postagem */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-3 md:p-6">
          {/* Visualização de Coluna Selecionada no Celular (md:hidden) */}
          <div className="md:hidden flex-1 overflow-y-auto space-y-3 custom-scrollbar pb-20">
            {loggedUserRole !== 'GUEST' && activeMobileCol === 'postado' && postsByColumn.postado.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                <span>{postsByColumn.postado.length} post(s) concluído(s)</span>
                <button
                  type="button"
                  disabled={isClearingPosted}
                  onClick={() => setShowClearPostedDialog(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Coluna
                </button>
              </div>
            )}
            {renderColumnCards(activeMobileCol)}
          </div>

          {/* Visualização em Grid Kanban no Tablet/Desktop (hidden md:grid) */}
          <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 h-full min-w-[300px]">
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
                    <div className="flex items-center gap-2">
                      {loggedUserRole !== 'GUEST' && col.key === 'postado' && colPosts.length > 0 && (
                        <button
                          type="button"
                          disabled={isClearingPosted}
                          onClick={e => {
                            e.stopPropagation();
                            setShowClearPostedDialog(true);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-[10px] font-bold transition-all shadow-sm"
                          title="Limpar todos os cards postados"
                        >
                          {isClearingPosted ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3 text-emerald-400" />
                          )}
                          <span>Limpar ({colPosts.length})</span>
                        </button>
                      )}
                      <span
                        className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${col.badgeClass}`}
                      >
                        {colPosts.length}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Cards da Coluna */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                    {renderColumnCards(col.key)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Compositor (Legenda, Feed/Stories, Seleção de Imagens e Agendamento) */}
      {selectedPost && (
        <SocialPostComposerDialog
          key={selectedPost.id}
          post={selectedPost}
          open={Boolean(selectedPost)}
          onOpenChange={open => {
            if (!open) setSelectedPostId(null);
          }}
          clients={visibleClients}
          kanbanCards={visibleKanbanCards}
          onUpdatePost={updatePost}
          onCreatePost={createPost}
          onDeletePost={deletePost}
          onSubmitPost={submitPost}
          onCreateRecurringBatch={createRecurringOfferBatch}
        />
      )}

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

      {/* Modal de Auditoria de Disparos (GET /v1/social-post-results) */}
      <Dialog open={auditModalOpen} onOpenChange={setAuditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-[#121214] border-white/10 text-white rounded-2xl custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <Layers className="w-5 h-5 text-purple-400" />
              Auditoria de Disparos • Post for Me (/v1/social-post-results)
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50">
              Detalhamento em tempo real de cada entrega registrada na API do Post for Me por conta e rede social.
            </DialogDescription>
          </DialogHeader>

          {isAuditing ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-white/60 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span>Consultando /v1/social-post-results e /v1/social-posts...</span>
            </div>
          ) : auditData ? (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-[10px] text-white/40 uppercase font-bold">Social Posts (Pedidos)</div>
                  <div className="text-lg font-black text-white">{auditData.totalSocialPosts}</div>
                  <div className="text-[10px] text-white/40">
                    Feed: {auditData.feedPostsCount} • Stories: {auditData.storiesPostsCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25">
                  <div className="text-[10px] text-purple-300 uppercase font-bold">Entregas (/post-results)</div>
                  <div className="text-lg font-black text-purple-200">{auditData.totalResults}</div>
                  <div className="text-[10px] text-purple-300/70">
                    Contas somadas: {auditData.totalAccountTargetsInPosts}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/25">
                  <div className="text-[10px] text-pink-300 uppercase font-bold">Por Rede</div>
                  <div className="text-sm font-black text-white mt-0.5">
                    IG: {auditData.instagramCount} • FB: {auditData.facebookCount}
                  </div>
                  <div className="text-[10px] text-pink-300/70">
                    Mídias × Contas: {auditData.totalMediaItemsInPosts}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                  <div className="text-[10px] text-emerald-300 uppercase font-bold">Status de Entrega</div>
                  <div className="text-sm font-black text-white mt-0.5">
                    ✓ {auditData.successCount} • ✕ {auditData.failedCount}
                  </div>
                  <div className="text-[10px] text-emerald-300/70">Sucesso vs Falha</div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 space-y-1">
                <div className="font-bold">Por que 179 pedidos viram {auditData.totalMediaItemsInPosts || '672'} no consumo?</div>
                <p className="text-amber-200/80 leading-relaxed">
                  1) Cada card com <strong>Feed + Stories</strong> gera <strong>2 pedidos</strong> separados (1 pro Feed e 1 pro Stories).<br />
                  2) Quando <strong>Instagram + Facebook</strong> estão marcados juntos, cada pedido dispara para <strong>2 contas</strong>.<br />
                  3) Nos <strong>Stories com várias fotos</strong>, diferente do carrossel do Feed, cada foto do Story é publicada individualmente na API da Meta.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-white/80 uppercase tracking-wider">
                  Disparos por Conta ({auditData.byAccount.length} contas)
                </div>
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-white/50 text-[10px] uppercase">
                      <tr>
                        <th className="py-2 px-3">Conta / Cliente</th>
                        <th className="py-2 px-3">Rede</th>
                        <th className="py-2 px-3 text-right">Sucesso</th>
                        <th className="py-2 px-3 text-right">Falha</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {auditData.byAccount.map(acc => (
                        <tr key={acc.accountId} className="hover:bg-white/5">
                          <td className="py-2 px-3 font-medium text-white">
                            {acc.name}
                            {acc.username && acc.username !== acc.name ? (
                              <span className="text-white/40 ml-1">(@{acc.username})</span>
                            ) : null}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                acc.platform === 'facebook'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-pink-500/20 text-pink-300'
                              }`}
                            >
                              {acc.platform}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-400 font-semibold">
                            {acc.success}
                          </td>
                          <td className="py-2 px-3 text-right text-red-400 font-semibold">
                            {acc.failed}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-white">
                            {acc.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-white/50">
              Nenhum dado retornado. Verifique se sua Chave de API está ativa.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação para Excluir Post */}
      <AlertDialog
        open={!!postToDelete}
        onOpenChange={open => {
          if (!open && !isDeletingPost) setPostToDelete(null);
        }}
      >
        <AlertDialogContent className="bg-[#18181B] border border-white/10 text-white max-w-md rounded-2xl shadow-2xl p-6">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-2">
              <Trash2 className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-white">
              {postToDelete?.status === 'programado'
                ? 'Cancelar agendamento e excluir?'
                : 'Excluir post da Central?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-white/60 leading-relaxed">
              {postToDelete?.status === 'programado'
                ? 'Este post está agendado no Post for Me. Ao confirmar, o agendamento remoto será cancelado e o post será excluído permanentemente da Central de Postagem.'
                : 'Deseja excluir permanentemente este post da Central de Postagem? Esta ação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex flex-row items-center justify-end gap-2.5">
            <AlertDialogCancel
              disabled={isDeletingPost}
              className="bg-white/5 hover:bg-white/10 border-white/10 text-white text-xs font-bold rounded-xl h-10 px-4 mt-0"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingPost}
              onClick={async e => {
                e.preventDefault();
                if (!postToDelete) return;
                setIsDeletingPost(true);
                try {
                  const wasScheduled = postToDelete.status === 'programado';
                  await deletePost(postToDelete.id);
                  toast.success(
                    wasScheduled
                      ? 'Agendamento cancelado no Post for Me!'
                      : 'Post excluído com sucesso!'
                  );
                  setPostToDelete(null);
                } catch (err: any) {
                  toast.error(`Erro ao excluir post: ${err?.message || 'Falha desconhecida'}`);
                } finally {
                  setIsDeletingPost(false);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl h-10 px-4 transition-colors flex items-center gap-1.5"
            >
              {isDeletingPost ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {postToDelete?.status === 'programado'
                      ? 'Sim, Cancelar e Excluir'
                      : 'Sim, Excluir Post'}
                  </span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Confirmação para Limpar Coluna Postado */}
      <AlertDialog
        open={showClearPostedDialog}
        onOpenChange={open => {
          if (!open && !isClearingPosted) setShowClearPostedDialog(false);
        }}
      >
        <AlertDialogContent className="bg-[#18181B] border border-white/10 text-white max-w-md rounded-2xl shadow-2xl p-6">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <AlertDialogTitle className="text-base font-bold text-white">
              Limpar coluna "Postado"?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-white/60 leading-relaxed">
              Deseja remover todos os {postsByColumn.postado.length} cards concluídos da coluna "Postado"? Isso remove os posts finalizados para manter sua tela limpa e organizada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-5 flex flex-row items-center justify-end gap-2.5">
            <AlertDialogCancel
              disabled={isClearingPosted}
              className="bg-white/5 hover:bg-white/10 border-white/10 text-white text-xs font-bold rounded-xl h-10 px-4 mt-0"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isClearingPosted}
              onClick={async e => {
                e.preventDefault();
                setIsClearingPosted(true);
                try {
                  await clearPostedPosts();
                  setShowClearPostedDialog(false);
                } catch (err: any) {
                  toast.error(`Erro ao limpar coluna: ${err?.message || 'Falha desconhecida'}`);
                } finally {
                  setIsClearingPosted(false);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-10 px-4 transition-colors flex items-center gap-1.5"
            >
              {isClearingPosted ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Limpando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpar Coluna ({postsByColumn.postado.length})</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SocialPostingHub;
