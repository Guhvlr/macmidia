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
          reels_media: p.reelsMedia || [],
          caption: p.caption || '',
          scheduled_at: p.scheduledAt || null,
          published_at: p.publishedAt || null,
          provider: p.provider || 'postforme',
          provider_post_id: p.providerPostId || null,
          permalink: p.permalink || null,
          error_message: p.errorMessage || null,
          created_at: p.createdAt || new Date().toISOString(),
          cover_url: p.coverUrl || null,
          reels_cover_url: p.reelsCoverUrl || null,
          repeat_until_date: p.repeatUntilDate || null,
          repeat_group_id: p.repeatGroupId || null,
          repeat_index: p.repeatIndex ?? null,
          repeat_total: p.repeatTotal ?? null,
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
          coverUrl: m.coverUrl || localMatch?.coverUrl,
          reelsCoverUrl: m.reelsCoverUrl || localMatch?.reelsCoverUrl,
          repeatUntilDate: m.repeatUntilDate || localMatch?.repeatUntilDate,
          repeatGroupId: m.repeatGroupId || localMatch?.repeatGroupId,
          repeatIndex: m.repeatIndex ?? localMatch?.repeatIndex,
          repeatTotal: m.repeatTotal ?? localMatch?.repeatTotal,
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
          | 'coverUrl'
          | 'reelsCoverUrl'
          | 'repeatUntilDate'
          | 'repeatGroupId'
          | 'repeatIndex'
          | 'repeatTotal'
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
        if (updates.reelsMedia !== undefined) db.reels_media = updates.reelsMedia;
        if (updates.caption !== undefined) db.caption = updates.caption;
        if ('scheduledAt' in updates) db.scheduled_at = updates.scheduledAt || null;
        if ('publishedAt' in updates) db.published_at = updates.publishedAt || null;
        if ('permalink' in updates) db.permalink = updates.permalink || null;
        if ('errorMessage' in updates) db.error_message = updates.errorMessage || null;
        if ('calendarClientId' in updates) db.calendar_client_id = updates.calendarClientId || null;
        if ('providerPostId' in updates) db.provider_post_id = updates.providerPostId || null;
        if ('coverUrl' in updates) db.cover_url = updates.coverUrl || null;
        if ('reelsCoverUrl' in updates) db.reels_cover_url = updates.reelsCoverUrl || null;
        if ('repeatUntilDate' in updates) db.repeat_until_date = updates.repeatUntilDate || null;
        if ('repeatGroupId' in updates) db.repeat_group_id = updates.repeatGroupId || null;
        if ('repeatIndex' in updates) db.repeat_index = updates.repeatIndex ?? null;
        if ('repeatTotal' in updates) db.repeat_total = updates.repeatTotal ?? null;

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
                  errorMessage: check.data.warning,
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
      feedMedia?: string[];
      storiesMedia?: string[];
      reelsMedia?: string[];
      caption?: string;
      scheduledAt?: string;
      status?: SocialPostStatus;
      coverUrl?: string;
      reelsCoverUrl?: string;
      repeatUntilDate?: string;
      repeatGroupId?: string;
      repeatIndex?: number;
      repeatTotal?: number;
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
        feedMedia: input.feedMedia,
        storiesMedia: input.storiesMedia,
        reelsMedia: input.reelsMedia,
        caption: input.caption || '',
        scheduledAt: input.scheduledAt,
        provider: 'postforme',
        createdAt: nowIso,
        updatedAt: nowIso,
        coverUrl: input.coverUrl,
        reelsCoverUrl: input.reelsCoverUrl,
        repeatUntilDate: input.repeatUntilDate,
        repeatGroupId: input.repeatGroupId,
        repeatIndex: input.repeatIndex,
        repeatTotal: input.repeatTotal,
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
            feed_media: newPost.feedMedia || null,
            stories_media: newPost.storiesMedia || null,
            reels_media: newPost.reelsMedia || null,
            caption: newPost.caption,
            scheduled_at: newPost.scheduledAt || null,
            provider: newPost.provider,
            cover_url: newPost.coverUrl || null,
            reels_cover_url: newPost.reelsCoverUrl || null,
            repeat_until_date: newPost.repeatUntilDate || null,
            repeat_group_id: newPost.repeatGroupId || null,
            repeat_index: newPost.repeatIndex ?? null,
            repeat_total: newPost.repeatTotal ?? null,
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
      let providerPostId = existing?.providerPostId;

      // Se não encontrou providerPostId em memória, busca diretamente no Supabase para garantir
      if (!providerPostId && !usingFallback) {
        try {
          const { data } = await (supabase as any)
            .from('social_posts')
            .select('provider_post_id, status')
            .eq('id', id)
            .maybeSingle();
          if (data?.provider_post_id) {
            providerPostId = data.provider_post_id;
          }
        } catch (err) {
          console.warn('Aviso ao consultar provider_post_id no banco antes de excluir:', err);
        }
      }

      // Se o post foi enviado para o Post for Me e não está postado no feed, cancela e exclui lá
      if (providerPostId && existing?.status !== 'postado') {
        const delRes = await socialProvider.deleteRemotePost(providerPostId);
        if (delRes.ok) {
          console.log(`[Post for Me] Post ${providerPostId} excluído com sucesso.`);
        } else {
          console.warn(`[Post for Me] Falha ao excluir post ${providerPostId}:`, delRes.message);
        }
      }

      setPosts(prev => {
        const next = prev.filter(p => p.id !== id);
        writeLocalFallback(next);
        return next;
      });

      if (!usingFallback) {
        const { error } = await (supabase as any).from('social_posts').delete().eq('id', id);
        if (error && !isMissingTableError(error)) {
          console.error('Erro ao excluir social_post no Supabase:', error);
          toast.error('Erro ao remover post da fila.');
        }
      }
    },
    [usingFallback, posts]
  );

  /**
   * Limpa todos os posts da coluna "Postado" de uma vez (para não acumular na tela).
   */
  const clearPostedPosts = useCallback(async (): Promise<{ ok: boolean; count: number }> => {
    const postedList = posts.filter(p => p.status === 'postado');
    if (postedList.length === 0) {
      toast.info('Nenhum card na coluna "Postado" para limpar.');
      return { ok: true, count: 0 };
    }

    const idsToDelete = postedList.map(p => p.id);

    setPosts(prev => {
      const next = prev.filter(p => p.status !== 'postado');
      writeLocalFallback(next);
      return next;
    });

    if (!usingFallback) {
      try {
        const { error } = await (supabase as any)
          .from('social_posts')
          .delete()
          .in('id', idsToDelete);
        if (error && !isMissingTableError(error)) {
          console.error('Erro ao limpar posts postados no Supabase:', error);
          toast.error('Erro ao limpar posts postados no banco de dados.');
          return { ok: false, count: 0 };
        }
      } catch (err) {
        console.error('Erro na exclusão em lote de posts postados:', err);
      }
    }

    toast.success(`${postedList.length} card(s) postado(s) removido(s) com sucesso!`);
    return { ok: true, count: postedList.length };
  }, [posts, usingFallback]);

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
        coverUrl?: string;
        reelsCoverUrl?: string;
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
      const finalCoverUrl = options?.coverUrl ?? target.coverUrl;
      const finalReelsCoverUrl = options?.reelsCoverUrl ?? target.reelsCoverUrl;

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
          caption: '',
        });
      }

      if (jobs.length > 0) {
        let firstPermalink: string | undefined;
        // Mantém IDs de envios anteriores que já deram certo (reenvio só do que falhou)
        const allProviderIds: string[] =
          target.status === 'erro' && target.providerPostId
            ? target.providerPostId.split(',').map(s => s.trim()).filter(Boolean)
            : [];
        const okLabels: string[] = [];
        const failedJobs: { label: string; placement: SocialPlacement; message: string }[] = [];
        const warnings: string[] = [];

        // Uma falha NÃO interrompe os outros formatos (ex: erro no Feed não impede o Stories)
        for (const job of jobs) {
          try {
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
              coverUrl: finalCoverUrl,
              reelsCoverUrl: finalReelsCoverUrl,
            });

            if (!jobRes.ok) {
              failedJobs.push({
                label: job.label,
                placement: job.placement,
                message: jobRes.message || `Falha ao enviar ${job.label}.`,
              });
              continue;
            }

            okLabels.push(job.label);
            if (jobRes.data?.id) allProviderIds.push(jobRes.data.id);
            if (!firstPermalink && jobRes.data?.permalink) firstPermalink = jobRes.data.permalink;
            if (jobRes.data?.warning) warnings.push(`${job.label}: ${jobRes.data.warning}`);
          } catch (jobErr: any) {
            console.error(`Erro ao disparar ${job.label}:`, jobErr);
            failedJobs.push({
              label: job.label,
              placement: job.placement,
              message: jobErr?.message || `Erro inesperado ao enviar ${job.label}.`,
            });
          }
        }

        const combinedProviderId = allProviderIds.length > 0 ? allProviderIds.join(',') : undefined;

        // Se todas as "falhas" foram avisos temporários do Facebook (onde o post saiu no Instagram e gerou ID):
        const isAllFbUnknown =
          failedJobs.length > 0 &&
          failedJobs.every(f => {
            const m = f.message.toLowerCase();
            return (
              m.includes('unknown error') ||
              m.includes('failed to post to facebook') ||
              m.includes('an unknown error occurred')
            );
          });

        if (okLabels.length === 0 && isAllFbUnknown && allProviderIds.length > 0) {
          const labelsStr = jobs.map(j => j.label).join(' + ');
          const warningMsg =
            'Publicado no Instagram. O Facebook retornou aviso temporário da Meta (verifique diretamente na sua página).';
          await updatePost(postId, {
            status: isScheduled ? 'programado' : 'postado',
            publishedAt: isScheduled ? undefined : new Date().toISOString(),
            providerPostId: combinedProviderId,
            permalink: firstPermalink,
            errorMessage: warningMsg,
          });
          toast.warning(
            `${labelsStr} publicado no Instagram! O Facebook retornou aviso temporário da Meta.`
          );
          return { ok: true };
        }

        // Tudo falhou
        if (okLabels.length === 0) {
          const msg = failedJobs.map(f => `Erro no ${f.label}: ${f.message}`).join(' | ');
          await updatePost(postId, {
            status: 'erro',
            errorMessage: msg,
            providerPostId: combinedProviderId,
          });
          toast.error(msg);
          return { ok: false };
        }

        // Parte deu certo, parte falhou: o card fica em "Deu Erro" só com os formatos que falharam
        // marcados, para que o próximo envio mande APENAS eles (sem duplicar o que já saiu).
        if (failedJobs.length > 0) {
          const failedPlacements = new Set(failedJobs.map(f => f.placement));
          const msg =
            `Enviado com sucesso: ${okLabels.join(' + ')}. ` +
            failedJobs.map(f => `Erro no ${f.label}: ${f.message}`).join(' | ') +
            ` — Ao tentar de novo, só ${failedJobs.map(f => f.label).join(' + ')} será reenviado.`;
          await updatePost(postId, {
            status: 'erro',
            errorMessage: msg,
            providerPostId: combinedProviderId,
            feedMedia: failedPlacements.has('feed') ? feedList : [],
            storiesMedia: failedPlacements.has('stories') ? storiesList : [],
            reelsMedia: failedPlacements.has('reels') ? reelsList : [],
          });
          toast.warning(msg);
          return { ok: false };
        }

        const nextStatus: SocialPostStatus = isScheduled ? 'programado' : 'postado';
        const labelsStr = okLabels.join(' + ');
        await updatePost(postId, {
          status: nextStatus,
          publishedAt: isScheduled ? undefined : new Date().toISOString(),
          providerPostId: combinedProviderId,
          permalink: firstPermalink,
          // Aviso (ex: "erro desconhecido" do Facebook que publica mesmo assim) fica visível no card
          errorMessage: warnings.length > 0 ? warnings.join(' | ') : undefined,
        });
        if (warnings.length > 0) {
          toast.warning(
            `${labelsStr} enviado(s). Aviso: o Facebook respondeu "erro desconhecido", mas normalmente publica. Confira na página antes de reenviar.`
          );
        } else {
          toast.success(
            isScheduled
              ? `${labelsStr} programado(s) com sucesso!`
              : `${labelsStr} enviado(s) com sucesso!`
          );
        }
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
        coverUrl: finalCoverUrl,
        reelsCoverUrl: finalReelsCoverUrl,
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

  const createRecurringOfferBatch = useCallback(
    async (params: {
      basePostId: string;
      startDate: string; // YYYY-MM-DD
      untilDate: string; // YYYY-MM-DD
      time: string; // HH:MM
      calendarClientId?: string;
      title: string;
      caption?: string;
      media: string[];
      feedMedia?: string[];
      storiesMedia?: string[];
      reelsMedia?: string[];
      coverUrl?: string;
      reelsCoverUrl?: string;
      targetNetworks?: ('instagram' | 'facebook')[];
      socialAccountId?: string;
      instagramUsername?: string;
      facebookAccountId?: string;
      facebookPageName?: string;
    }): Promise<{ ok: boolean; count: number }> => {
      const timePart = params.time || '09:00';
      const start = new Date(`${params.startDate}T${timePart}:00`);
      const end = new Date(`${params.untilDate}T${timePart}:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        toast.error('Data final da oferta inválida ou anterior à data inicial.');
        return { ok: false, count: 0 };
      }

      const dates: Date[] = [];
      const cur = new Date(start);
      while (cur <= end) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }

      if (dates.length === 0) {
        toast.error('Nenhuma data gerada para o período informado.');
        return { ok: false, count: 0 };
      }

      const repeatGroupId = crypto.randomUUID();
      const totalDays = dates.length;
      let scheduledCount = 0;

      for (let i = 0; i < dates.length; i++) {
        const d = dates[i];
        const dayIso = d.toISOString();
        const dayIndex = i + 1;
        const dayFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        const dayTitle = `${params.title} (Dia ${dayIndex}/${totalDays} • ${dayFormatted})`;

        let targetId = params.basePostId;
        if (i === 0) {
          await updatePost(params.basePostId, {
            title: dayTitle,
            scheduledAt: dayIso,
            coverUrl: params.coverUrl,
            reelsCoverUrl: params.reelsCoverUrl,
            repeatUntilDate: params.untilDate,
            repeatGroupId,
            repeatIndex: dayIndex,
            repeatTotal: totalDays,
          });
        } else {
          const created = await createPost({
            calendarClientId: params.calendarClientId,
            title: dayTitle,
            placement: 'feed',
            media: params.media,
            feedMedia: params.feedMedia,
            storiesMedia: params.storiesMedia,
            reelsMedia: params.reelsMedia,
            caption: params.caption,
            scheduledAt: dayIso,
            status: 'programado',
            coverUrl: params.coverUrl,
            reelsCoverUrl: params.reelsCoverUrl,
            repeatUntilDate: params.untilDate,
            repeatGroupId,
            repeatIndex: dayIndex,
            repeatTotal: totalDays,
          });
          if (created) {
            targetId = created.id;
          } else {
            console.warn(`Falha ao criar post para o dia ${dayFormatted}, pulando agendamento deste dia.`);
            continue;
          }
        }

        const subRes = await submitPost(targetId, {
          socialAccountId: params.socialAccountId,
          instagramUsername: params.instagramUsername,
          facebookAccountId: params.facebookAccountId,
          facebookPageName: params.facebookPageName,
          targetNetworks: params.targetNetworks,
          caption: params.caption,
          media: params.media,
          feedMedia: params.feedMedia,
          storiesMedia: params.storiesMedia,
          reelsMedia: params.reelsMedia,
          scheduledAt: dayIso,
          coverUrl: params.coverUrl,
          reelsCoverUrl: params.reelsCoverUrl,
        });

        if (subRes.ok) scheduledCount++;
      }

      toast.success(
        `Oferta programada com sucesso para ${scheduledCount} dias (até ${params.untilDate})!`
      );
      return { ok: true, count: scheduledCount };
    },
    [updatePost, createPost, submitPost]
  );

  return {
    posts,
    loading,
    usingFallback,
    fetchPosts,
    createPost,
    updatePost,
    deletePost,
    clearPostedPosts,
    submitPost,
    createRecurringOfferBatch,
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
        feed_media: newPost.feedMedia || null,
        stories_media: newPost.storiesMedia || null,
        reels_media: newPost.reelsMedia || null,
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
