export type SocialPostStatus = 'para_postar' | 'programado' | 'publicando' | 'erro' | 'postado';
export type SocialPlacement = 'feed' | 'stories' | 'reels';

export interface SocialPost {
  id: string;
  kanbanCardId?: string;
  calendarClientId?: string;
  title: string;
  status: SocialPostStatus;
  placement: SocialPlacement;
  media: string[];
  /** Imagens marcadas para Feed dentro deste mesmo card */
  feedMedia?: string[];
  /** Imagens marcadas para Stories dentro deste mesmo card */
  storiesMedia?: string[];
  /** Vídeos/mídias marcados para Reels dentro deste mesmo card */
  reelsMedia?: string[];
  caption: string;
  scheduledAt?: string;
  publishedAt?: string;
  provider: string;
  providerPostId?: string;
  permalink?: string;
  errorMessage?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  /** URL da capa selecionada para o Feed (primeira imagem do carrossel) — opcional */
  coverUrl?: string;
  /** URL da thumbnail/capa do Reels — opcional */
  reelsCoverUrl?: string;
  /** Data final da oferta recorrente (YYYY-MM-DD) — posts diários até essa data */
  repeatUntilDate?: string;
  /** ID que agrupa posts de uma mesma oferta recorrente */
  repeatGroupId?: string;
  /** Índice dentro do grupo de repetição (1, 2, 3...) */
  repeatIndex?: number;
  /** Total de posts no grupo de repetição */
  repeatTotal?: number;
}

export const PLACEMENT_LABELS: Record<SocialPlacement, string> = {
  feed: 'Feed',
  stories: 'Stories',
  reels: 'Reels',
};

export const INSTAGRAM_CAPTION_LIMIT = 2200;
export const INSTAGRAM_CAROUSEL_LIMIT = 10;

export function mapSocialPost(row: any): SocialPost {
  return {
    id: row.id,
    kanbanCardId: row.kanban_card_id || undefined,
    calendarClientId: row.calendar_client_id || undefined,
    title: row.title || '',
    status: row.status,
    placement: row.placement,
    media: Array.isArray(row.media) ? row.media.filter((m: unknown) => typeof m === 'string') : [],
    feedMedia: Array.isArray(row.feed_media)
      ? row.feed_media.filter((m: unknown) => typeof m === 'string')
      : undefined,
    storiesMedia: Array.isArray(row.stories_media)
      ? row.stories_media.filter((m: unknown) => typeof m === 'string')
      : undefined,
    reelsMedia: Array.isArray(row.reels_media)
      ? row.reels_media.filter((m: unknown) => typeof m === 'string')
      : undefined,
    caption: row.caption || '',
    scheduledAt: row.scheduled_at || undefined,
    publishedAt: row.published_at || undefined,
    provider: row.provider || 'postforme',
    providerPostId: row.provider_post_id || undefined,
    permalink: row.permalink || undefined,
    errorMessage: row.error_message || undefined,
    createdBy: row.created_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    coverUrl: row.cover_url || undefined,
    reelsCoverUrl: row.reels_cover_url || undefined,
    repeatUntilDate: row.repeat_until_date || undefined,
    repeatGroupId: row.repeat_group_id || undefined,
    repeatIndex: row.repeat_index ?? undefined,
    repeatTotal: row.repeat_total ?? undefined,
  };
}

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?|#|$)/i;
const NON_MEDIA_EXT = /\.(pdf|doc|docx|xls|xlsx|odt|ods|zip|rar|psd|ai|cdr)(\?|$)/i;

export function isVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:video/')) return true;
  return VIDEO_EXT.test(url);
}

/** URLs de mídia (imagem ou vídeo) que podem ir para o Instagram */
export function isPostableMediaUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:') || url.startsWith('blob:')) return false; // o provedor precisa de URL pública acessível
  if (NON_MEDIA_EXT.test(url)) return false;
  return true;
}
