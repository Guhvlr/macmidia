import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  isPostableMediaUrl,
  isVideoUrl,
  mapSocialPost,
  SocialPlacement,
  SocialPost,
  SocialPostStatus,
} from '../types';
import { NOT_CONFIGURED_MESSAGE, socialProvider } from '../api/socialProvider';
import type { KanbanCard } from '@/contexts/app-types';

const LOCAL_STORAGE_FALLBACK_KEY = 'macmidia_social_posts_fallback_v1';

function readLocalFallback(): SocialPost[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalFallback(posts: SocialPost[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, JSON.stringify(posts));
    window.dispatchEvent(new CustomEvent('macmidia:social-posts-updated'));
  } catch {
    // ignore storage quota errors
  }
}

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.details || '').toLowerCase();
  const code = String(error.code || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (msg.includes('social_posts') &&
      (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('not find')))
  );
}

export function useSocialPosts() {
  const [posts, setPosts] = useState<SocialPost[]>(() => readLocalFallback());
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isMissingTableError(error)) {
          setUsingFallback(true);
          setPosts(readLocalFallback());
          setLoading(false);
          return;
        }
        throw error;
      }

      setUsingFallback(false);
      const localItems = readLocalFallback();
      const dbRows = Array.isArray(data) ? data : [];
      const dbIds = new Set(dbRows.map((r: any) => r.id));

      // Se havia posts salvos no navegador antes de criar a tabela no Supabase,
      // envia automaticamente para o Supabase na primeira leitura para sincronizar entre navegadores
      const unsyncedLocals = localItems.filter(l => !dbIds.has(l.id));
      if (unsyncedLocals.length > 0 && dbRows.length === 0) {
        const toInsert = unsyncedLocals.map(p => ({
          id: p.id,
          kanban_card_id: p.kanbanCardId || null,
          calendar_client_id: p.calendarClientId || null,
          title: p.title || 'Post',
          status: p.status || 'para_postar',
          placement: p.placement || 'feed',
          media: p.media || [],
          feed_media: p.feedMedia || [],
          stories_media: p.storiesMedia || [],
          caption: p.caption || '',
          scheduled_at: p.scheduledAt || null,
          published_at: p.publishedAt || null,
          provider: p.provider || 'postforme',
          provider_post_id: p.providerPostId || null,
          permalink: p.permalink || null,
          error_message: p.errorMessage || null,
          created_at: p.createdAt || new Date().toISOString(),
        }));
        await (supabase as any).from('social_posts').upsert(toInsert, { onConflict: 'id' });
        setPosts(localItems);
        setLoading(false);
        return;
      }

      const mapped: SocialPost[] = dbRows.map((row: any) => {
        const m = mapSocialPost(row);
        const localMatch = localItems.find(l => l.id === m.id);
        return {
          ...m,
          providerPostId: m.providerPostId || localMatch?.providerPostId,
          permalink: m.permalink || localMatch?.permalink,
          feedMedia:
            m.feedMedia && m.feedMedia.length > 0 ? m.feedMedia : localMatch?.feedMedia,
          storiesMedia:
            m.storiesMedia && m.storiesMedia.length > 0
              ? m.storiesMedia
              : localMatch?.storiesMedia,
          reelsMedia:
            m.reelsMedia && m.reelsMedia.length > 0
              ? m.reelsMedia
              : localMatch?.reelsMedia,
        };
      });
      setPosts(mapped);
      writeLocalFallback(mapped);
    } catch (err) {
      console.warn('Usando armazenamento local para Central de Postagem:', err);
      setUsingFallback(true);
      setPosts(readLocalFallback());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();

    const handleLocalUpdate = () => {
      setPosts(readLocalFallback());
    };
    window.addEventListener('macmidia:social-posts-updated', handleLocalUpdate);

    const channel = supabase
      .channel('realtime-social-posts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'social_posts' },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('macmidia:social-posts-updated', handleLocalUpdate);
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  const updatePost = useCallback(
    async (
      id: string,
      updates: Partial<
        Pick<
          SocialPost,
          | 'title'
          | 'status'
          | 'placement'
          | 'media'
          | 'feedMedia'
          | 'storiesMedia'
          | 'reelsMedia'
          | 'caption'
          | 'scheduledAt'
          | 'publishedAt'
          | 'permalink'
          | 'errorMessage'
          | 'calendarClientId'
          | 'providerPostId'
        >
      >
    ) => {
      const nowIso = new Date().toISOString();
      setPosts(prev => {
        const next = prev.map(p => (p.id === id ? { ...p, ...updates, updatedAt: nowIso } : p));
        writeLocalFallback(next);
        return next;
      });

      if (!usingFallback) {
        const db: Record<string, unknown> = {};
        if (updates.title !== undefined) db.title = updates.title;
        if (updates.status !== undefined) db.status = updates.status;
        if (updates.placement !== undefined) db.placement = updates.placement;
        if (updates.media !== undefined) db.media = updates.media;
        if (updates.feedMedia !== undefined) db.feed_media = updates.feedMedia;
        if (updates.storiesMedia !== undefined) db.stories_media = updates.storiesMedia;
        if (updates.caption !== undefined) db.caption = updates.caption;
        if ('scheduledAt' in updates) db.scheduled_at = updates.scheduledAt || null;
        if ('publishedAt' in updates) db.published_at = updates.publishedAt || null;
        if ('permalink' in updates) db.permalink = updates.permalink || null;
        if ('errorMessage' in updates) db.error_message = updates.errorMessage || null;
        if ('calendarClientId' in updates) db.calendar_client_id = updates.calendarClientId || null;
        if ('providerPostId' in updates) db.provider_post_id = updates.providerPostId || null;

        const { error } = await (supabase as any).from('social_posts').update(db).eq('id', id);
        if (error && !isMissingTableError(error)) {
          console.error('Erro ao atualizar social_post:', error);
        }
      }
    },
    [usingFallback]
  );

  // Verifica automaticamente a cada 8 segundos:
  // 1) Se algum post "programado" já chegou no horário para movê-lo para "postado"
  // 2) Se algum post recém-enviado ao Post for Me já recebeu o link oficial (permalink) ou erro do Instagram
  useEffect(() => {
    const checkDueAndProcessingPosts = async () => {
      const now = Date.now();
      const currentPosts = readLocalFallback();

      for (const p of currentPosts) {
        const isDueScheduled =
          p.status === 'programado' &&
          p.scheduledAt &&
          new Date(p.scheduledAt).getTime() <= now;

        const isRecentlyPublishedWithoutPermalink =
          p.status === 'postado' &&
          p.providerPostId &&
          !p.permalink &&
          p.publishedAt &&
          now - new Date(p.publishedAt).getTime() < 5 * 60 * 1000;

        if (isDueScheduled) {
          if (p.providerPostId) {
            const check = await socialProvider.checkPostStatus(p.providerPostId);
            if (check.ok && check.data) {
              if (check.data.status === 'erro') {
                await updatePost(p.id, {
                  status: 'erro',
                  errorMessage: check.data.errorMessage || 'Falha ao publicar no Instagram.',
                });
                toast.error(`Erro ao publicar "${p.title}": ${check.data.errorMessage}`);
              } else if (check.data.status === 'postado') {
                await updatePost(p.id, {
                  status: 'postado',
                  publishedAt: new Date().toISOString(),
                  permalink: check.data.permalink,
                  errorMessage: undefined,
                });
                toast.success(`Horário atingido! "${p.title}" foi publicado no Instagram!`);
              }
            }
          } else {
            const nowIso = new Date().toISOString();
            await updatePost(p.id, {
              status: 'postado',
              publishedAt: nowIso,
            });
            toast.success(`Horário atingido! "${p.title}" foi movido para Postado.`);
          }
        } else if (isRecentlyPublishedWithoutPermalink && p.providerPostId) {
          const check = await socialProvider.checkPostStatus(p.providerPostId);
          if (check.ok && check.data) {
            if (check.data.status === 'erro') {
              await updatePost(p.id, {
                status: 'erro',
                errorMessage:
                  check.data.errorMessage || 'O Instagram recusou a publicação após o envio.',
              });
              toast.error(
                `O Instagram retornou erro em "${p.title}": ${check.data.errorMessage}`
              );
            } else if (check.data.permalink) {
              await updatePost(p.id, {
                permalink: check.data.permalink,
              });
            }
          }
        }
      }
    };

    const timer = setInterval(checkDueAndProcessingPosts, 8_000);
    return () => clearInterval(timer);
  }, [updatePost]);

  const createPost = useCallback(
    async (input: {
      kanbanCardId?: string;
      calendarClientId?: string;
      title: string;
      placement?: SocialPlacement;
      media: string[];
      caption?: string;
      scheduledAt?: string;
      status?: SocialPostStatus;
    }): Promise<SocialPost | null> => {
      const nowIso = new Date().toISOString();
      const newPost: SocialPost = {
        id: crypto.randomUUID(),
        kanbanCardId: input.kanbanCardId,
        calendarClientId: input.calendarClientId,
        title: input.title || 'Post sem título',
        status: input.status || 'para_postar',
        placement: input.placement || 'feed',
        media: input.media,
        caption: input.caption || '',
        scheduledAt: input.scheduledAt,
        provider: 'postforme',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setPosts(prev => {
        const next = [newPost, ...prev];
        writeLocalFallback(next);
        return next;
      });

      if (!usingFallback) {
        const { data, error } = await (supabase as any)
          .from('social_posts')
          .insert({
            id: newPost.id,
            kanban_card_id: newPost.kanbanCardId || null,
            calendar_client_id: newPost.calendarClientId || null,
            title: newPost.title,
            status: newPost.status,
            placement: newPost.placement,
            media: newPost.media,
            caption: newPost.caption,
            scheduled_at: newPost.scheduledAt || null,
            provider: newPost.provider,
          })
          .select()
          .maybeSingle();

        if (error) {
          if (isMissingTableError(error)) {
            setUsingFallback(true);
            return newPost;
          }
          console.error('Erro ao criar social_post no Supabase:', error);
          toast.error('Erro ao criar item na fila de postagem.');
          return null;
        }

        if (data) {
          const mapped = mapSocialPost(data);
          setPosts(prev => {
            const next = prev.map(p => (p.id === newPost.id ? mapped : p));
            writeLocalFallback(next);
            return next;
          });
          return mapped;
        }
      }

      return newPost;
    },
    [usingFallback]
  );

  const deletePost = useCallback(
    async (id: string) => {
      const existing = readLocalFallback().find(p => p.id === id) || posts.find(p => p.id === id);
      if (existing?.providerPostId && existing.status === 'programado') {
        await socialProvider.deleteRemotePost(existing.providerPostId);
      }

      setPosts(prev => {
        const next = prev.filter(p => p.id !== id);
        writeLocalFallback(next);
        return next;
      });

      if (!usingFallback) {
        const { error } = await (supabase as any).from('social_posts').delete().eq('id', id);
        if (error && !isMissingTableError(error)) {
          console.error('Erro ao excluir social_post:', error);
          toast.error('Erro ao remover post da fila.');
        }
      }
    },
    [usingFallback, posts]
  );

  /**
   * Envia o post para o provedor (Post for Me) ou agenda se tiver `scheduledAt`.
   */
  const submitPost = useCallback(
    async (
      postId: string,
      options?: {
        hasConnectedAccount?: boolean;
        socialAccountId?: string;
        instagramUsername?: string;
        facebookAccountId?: string;
        facebookPageName?: string;
        targetNetworks?: ('instagram' | 'facebook')[];
        caption?: string;
        media?: string[];
        feedMedia?: string[];
        storiesMedia?: string[];
        reelsMedia?: string[];
        placement?: SocialPlacement;
        scheduledAt?: string;
      }
    ): Promise<{ ok: boolean; simulated?: boolean }> => {
      // Lê do cache local atualizado para nunca pegar estado antigo logo após onUpdatePost
      const latestList = readLocalFallback();
      const target = latestList.find(p => p.id === postId) || posts.find(p => p.id === postId);
      if (!target) return { ok: false };

      const finalMedia = options?.media ?? target.media;
      const finalCaption = options?.caption ?? target.caption;
      const finalPlacement = options?.placement ?? target.placement;
      const finalScheduledAt = options?.scheduledAt ?? target.scheduledAt;

      const isScheduled =
        !!finalScheduledAt && new Date(finalScheduledAt).getTime() > Date.now() + 30_000;

      const hasAnyAccount = Boolean(
        options?.socialAccountId ||
          options?.instagramUsername ||
          options?.facebookAccountId ||
          options?.facebookPageName
      );

      if (!hasAnyAccount) {
        await updatePost(postId, {
          status: 'erro',
          errorMessage:
            'Cliente sem Instagram ou Facebook vinculado. Clique em "Contas Instagram" no topo e escolha as contas deste cliente.',
        });
        toast.error(
          'Este cliente ainda não está com conta vinculada. O card foi para "Deu Erro".'
        );
        return { ok: false };
      }

      const feedList = options?.feedMedia ?? target.feedMedia ?? [];
      const storiesList = options?.storiesMedia ?? target.storiesMedia ?? [];
      const reelsList = options?.reelsMedia ?? target.reelsMedia ?? [];

      // Monta a lista de disparos por formato (Feed, Reels, Stories) dentro de 1 único card (sem duplicar!)
      const jobs: { label: string; placement: SocialPlacement; media: string[]; caption: string }[] =
        [];
      if (feedList.length > 0) {
        jobs.push({
          label: 'Feed',
          placement: 'feed',
          media: feedList,
          caption: finalCaption,
        });
      }
      if (reelsList.length > 0) {
        jobs.push({
          label: 'Reels',
          placement: 'reels',
          media: reelsList,
          caption: finalCaption,
        });
      }
      if (storiesList.length > 0) {
        jobs.push({
          label: 'Stories',
          placement: 'stories',
          media: storiesList,
          caption: 'Stories',
        });
      }

      if (jobs.length > 0) {
        let firstPostId: string | undefined;
        let firstPermalink: string | undefined;

        for (const job of jobs) {
          const jobRes = await socialProvider.publishDirect({
            socialAccountId: options?.socialAccountId || '',
            instagramUsername: options?.instagramUsername,
            facebookAccountId: options?.facebookAccountId,
            facebookPageName: options?.facebookPageName,
            targetNetworks: options?.targetNetworks,
            caption: job.caption,
            media: job.media,
            placement: job.placement,
            scheduledAt: finalScheduledAt,
          });

          if (!jobRes.ok) {
            await updatePost(postId, {
              status: 'erro',
              errorMessage: `Erro no ${job.label}: ${
                jobRes.message || `Falha ao enviar ${job.label}.`
              }`,
            });
            toast.error(`Erro ao enviar ${job.label}: ${jobRes.message}`);
            return { ok: false };
          }

          if (!firstPostId && jobRes.data?.id) firstPostId = jobRes.data.id;
          if (!firstPermalink && jobRes.data?.permalink) firstPermalink = jobRes.data.permalink;
        }

        const nextStatus: SocialPostStatus = isScheduled ? 'programado' : 'postado';
        const labelsStr = jobs.map(j => j.label).join(' + ');
        await updatePost(postId, {
          status: nextStatus,
          publishedAt: isScheduled ? undefined : new Date().toISOString(),
          providerPostId: firstPostId,
          permalink: firstPermalink,
          errorMessage: undefined,
        });
        toast.success(
          isScheduled
            ? `${labelsStr} programado(s) com sucesso!`
            : `${labelsStr} enviado(s) com sucesso!`
        );
        return { ok: true };
      }

      const res = await socialProvider.publishDirect({
        socialAccountId: options?.socialAccountId || '',
        instagramUsername: options?.instagramUsername,
        facebookAccountId: options?.facebookAccountId,
        facebookPageName: options?.facebookPageName,
        targetNetworks: options?.targetNetworks,
        caption: finalCaption,
        media: finalMedia,
        placement: finalPlacement,
        scheduledAt: finalScheduledAt,
      });

      if (res.ok) {
        const nextStatus: SocialPostStatus = isScheduled ? 'programado' : 'postado';
        await updatePost(postId, {
          status: nextStatus,
          publishedAt: isScheduled ? undefined : new Date().toISOString(),
          providerPostId: res.data?.id,
          permalink: res.data?.permalink,
          errorMessage: undefined,
        });
        toast.success(
          isScheduled
            ? 'Postagem programada com sucesso!'
            : 'Postagem enviada com sucesso!'
        );
        return { ok: true };
      }

      await updatePost(postId, {
        status: 'erro',
        errorMessage: res.message || NOT_CONFIGURED_MESSAGE,
      });
      toast.error(res.message || 'Falha ao publicar no Instagram.');
      return { ok: false };
    },
    [posts, updatePost]
  );

  return {
    posts,
    loading,
    usingFallback,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
    submitPost,
  };
}

/**
 * Função auxiliar que pode ser chamada direto do botão "Postar" nos cards do Kanban
 * sem precisar montar o hook inteiro em cada card.
 */
export async function sendKanbanCardToSocialQueue(card: KanbanCard): Promise<SocialPost> {
  const rawImages =
    Array.isArray(card.images) && card.images.length > 0
      ? card.images
      : card.imageUrl
        ? [card.imageUrl]
        : [];

  const media = rawImages.filter(isPostableMediaUrl);
  const finalMedia = media.length > 0 ? media : rawImages;
  const videoUrls = finalMedia.filter(isVideoUrl);
  const imageUrls = finalMedia.filter(u => !isVideoUrl(u));
  const defaultPlacement: SocialPlacement =
    videoUrls.length > 0 && imageUrls.length === 0 ? 'reels' : 'feed';
  const nowIso = new Date().toISOString();

  const newPost: SocialPost = {
    id: crypto.randomUUID(),
    kanbanCardId: card.id,
    calendarClientId: card.calendarClientId || undefined,
    title: card.clientName || 'Postagem',
    status: 'para_postar',
    placement: defaultPlacement,
    media: finalMedia,
    feedMedia: imageUrls,
    reelsMedia: videoUrls,
    caption: card.description || '',
    provider: 'postforme',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Salva também no fallback local imediatamente para resposta instantânea
  const currentLocal = readLocalFallback();
  writeLocalFallback([newPost, ...currentLocal]);

  try {
    const { data, error } = await (supabase as any)
      .from('social_posts')
      .insert({
        id: newPost.id,
        kanban_card_id: newPost.kanbanCardId || null,
        calendar_client_id: newPost.calendarClientId || null,
        title: newPost.title,
        status: newPost.status,
        placement: newPost.placement,
        media: newPost.media,
        caption: newPost.caption,
        provider: newPost.provider,
      })
      .select()
      .maybeSingle();

    if (!error && data) {
      const mapped = mapSocialPost(data);
      const updatedLocal = readLocalFallback().map(p => (p.id === newPost.id ? mapped : p));
      writeLocalFallback(updatedLocal);
      return mapped;
    }
  } catch (err) {
    console.warn('Social queue gravada localmente (tabela social_posts pendente):', err);
  }

  return newPost;
}
