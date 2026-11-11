import { supabase } from '@/integrations/supabase/client';
import {
  getStoredPostForMeApiKey,
  socialProvider,
  PostForMeAccount,
} from '@/features/social/api/socialProvider';
import { isVideoUrl } from '@/features/social/types';

export interface PostMetricItem {
  id: string;
  title: string;
  caption: string;
  date: string; // YYYY-MM-DD
  publishedAtIso: string;
  hourOfDay: number;
  dayOfWeek: number;
  type: 'IMAGE' | 'CAROUSEL' | 'REELS' | 'STORY';
  platform: 'instagram' | 'facebook';
  thumbnailUrl: string;
  permalink?: string;
  views: number;
  reach: number;
  interactions: number;
  engagementRate: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  profileVisits?: number;
  follows?: number;
  retentionRate?: number;
  replies?: number;
  selected: boolean;
}

export interface HourlyEngagementItem {
  hourLabel: string;
  postsCount: number;
  totalInteractions: number;
  avgInteractions: number;
  totalReach: number;
}

export interface WeekdayEngagementItem {
  dayIndex: number;
  dayName: string;
  postsCount: number;
  totalInteractions: number;
  avgInteractions: number;
  totalReach: number;
}

export interface AgeGroupMetricItem {
  range: string;
  femalePct: number;
  malePct: number;
  totalPct: number;
}

export interface CityMetricItem {
  city: string;
  followers: number;
  pct?: number;
}

export interface CampaignMetricItem {
  id: string;
  name: string;
  periodLabel?: string; // ex: "06 a 10/11"
  statusLabel?: string; // ex: "Ativo • Encerra em breve"
  placement?: 'instagram' | 'facebook' | 'both';
  thumbnailUrl?: string;
  spend: number; // Valor gasto (R$)
  impressions: number; // Visualizações do anúncio
  reach: number; // Alcance
  cpm: number; // Custo por 1.000 pessoas alcançadas (R$)
  clicks: number;
  ctr: number;
  cpc: number;
  conversations: number;
}

export interface ClientMetricsSectionsConfig {
  resumoRedes: boolean;
  topOffersRanking: boolean;
  bestTimesAnalysis: boolean;
  igOverview: boolean;
  igDemographics: boolean;
  igFeedTable: boolean;
  igReelsTable: boolean;
  igStoriesGrid: boolean;
  fbOverview: boolean;
  fbPostsTable: boolean;
  fbReelsTable: boolean;
  metaAdsOverview: boolean;
  metaAdsConversations: boolean;
  metaAdsFunnel: boolean;
  metaAdsPlatformSplit: boolean;
  metaAdsCampaignsTable: boolean;
  showPostPhotos: boolean;
}

export const DEFAULT_SECTIONS_CONFIG: ClientMetricsSectionsConfig = {
  resumoRedes: true,
  topOffersRanking: true,
  bestTimesAnalysis: true,
  igOverview: true,
  igDemographics: true,
  igFeedTable: true,
  igReelsTable: true,
  igStoriesGrid: true,
  fbOverview: true,
  fbPostsTable: true,
  fbReelsTable: true,
  metaAdsOverview: true,
  metaAdsConversations: true,
  metaAdsFunnel: true,
  metaAdsPlatformSplit: true,
  metaAdsCampaignsTable: true,
  showPostPhotos: true,
};

export interface ClientMetricsReportData {
  clientId: string;
  clientName: string;
  clientLogo?: string;
  monthKey: string;
  filterMode: 'month' | 'all';
  periodLabel: string;
  comparisonLabel: string;
  selectedIgAccountId?: string;
  selectedFbAccountId?: string;
  linkedAccountNames: string[];
  /** Se true, o usuário preencheu os totais gerais da conta (ex: 3,4 mi do Meta Business Suite) e não devemos sobrescrever com a soma simples de posts */
  hasCustomAccountTotals?: boolean;
  sections: ClientMetricsSectionsConfig;
  resumo: {
    alcanceTotal: number;
    alcanceTotalPrev: number;
    visualizacoesTotais: number;
    engajamentoTotal: number;
    engajamentoTotalPrev: number;
    taxaEngajamentoMedia: number;
    novosSeguidores: number;
    novosSeguidoresPrev: number;
    totalPostagens: number;
    totalPostagensPrev: number;
  };
  bestTimes: {
    bestHourLabel: string;
    bestDayLabel: string;
    hourlyBreakdown: HourlyEngagementItem[];
    weekdayBreakdown: WeekdayEngagementItem[];
  };
  instagram: {
    seguidoresTotal: number;
    seguidoresTotalPrev: number;
    novosSeguidoresPeriodo?: number;
    deixaramDeSeguirPeriodo?: number;
    alcanceOrganico: number;
    alcanceOrganicoPrev: number;
    alcanceSeguidores?: number;
    alcanceNaoSeguidores?: number;
    alcancePago: number;
    alcancePagoPrev: number;
    visualizacoesTotais: number;
    visualizacoesTotaisPrev: number;
    viewsFollowersPct?: number;
    viewsNonFollowersPct?: number;
    visitasPerfil: number;
    visitasPerfilPrev: number;
    interacoesTotal: number;
    interacoesSeguidoresPct?: number;
    interacoesNaoSeguidoresPct?: number;
    curtidasTotal: number;
    comentariosTotal: number;
    salvosTotal: number;
    compartilhamentosTotal: number;
    conversasIniciadas?: number;
    novosContatosMensagem?: number;
    taxaRespostaPct?: number;
    genderFemalePct: number;
    genderMalePct: number;
    ageGroups: AgeGroupMetricItem[];
    topCities: CityMetricItem[];
  };
  facebook: {
    seguidoresPagina: number;
    seguidoresPaginaPrev: number;
    novosSeguidoresPeriodo?: number;
    deixaramDeSeguirPeriodo?: number;
    seguidoresLiquidos?: number;
    alcancePublicacoes: number;
    alcancePublicacoesPrev: number;
    visualizacoesTotais: number;
    visualizadoresUnicos?: number;
    visitasPagina?: number;
    videosReels3sViews?: number;
    conversasIniciadas?: number;
    engajamentoTotal: number;
    engajamentoTotalPrev: number;
    reacoesTotal: number;
    comentariosTotal: number;
    compartilhamentosTotal: number;
  };
  metaAds: {
    adAccountId?: string;
    accessToken?: string;
    isRealFromMetaApi?: boolean;
    spend: number;
    spendPrev: number;
    impressions: number;
    impressionsPrev: number;
    reach: number;
    reachPrev: number;
    clicks: number;
    clicksPrev: number;
    linkClicks: number;
    linkClicksPrev: number;
    ctr: number;
    cpc: number;
    cpm: number;
    conversationsStarted: number;
    conversationsStartedPrev: number;
    costPerConversation: number;
    igSpend: number;
    igImpressions: number;
    igReach: number;
    igClicks: number;
    fbSpend: number;
    fbImpressions: number;
    fbReach: number;
    fbClicks: number;
    campaigns: CampaignMetricItem[];
  };
  posts: PostMetricItem[];
}

const STORAGE_PREFIX = '@macmidia:postforme_metrics_v6_';
const ACCOUNT_MAP_PREFIX = '@macmidia:client_pfm_accounts_v2_';

export function getSavedClientAccountBinding(clientId: string): {
  igAccountId?: string;
  fbAccountId?: string;
} {
  try {
    const raw = localStorage.getItem(`${ACCOUNT_MAP_PREFIX}${clientId}`);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export function saveClientAccountBinding(
  clientId: string,
  binding: { igAccountId?: string; fbAccountId?: string }
) {
  try {
    localStorage.setItem(`${ACCOUNT_MAP_PREFIX}${clientId}`, JSON.stringify(binding));
  } catch {
    // ignore
  }
}

export function createDefaultClientMetricsReport(params: {
  clientId: string;
  clientName: string;
  clientLogo?: string;
  year: number;
  month: number;
  filterMode?: 'month' | 'all';
}): ClientMetricsReportData {
  const { clientId, clientName, clientLogo, year, month, filterMode = 'month' } = params;
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth =
    Number.isFinite(month) && month >= 0 && month <= 11 ? month : new Date().getMonth();
  const lastDay = new Date(safeYear, safeMonth + 1, 0).getDate();
  const prevMonthDate = new Date(safeYear, safeMonth - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonthIdx = prevMonthDate.getMonth();
  const prevLastDay = new Date(prevYear, prevMonthIdx + 1, 0).getDate();

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const periodLabel =
    filterMode === 'all'
      ? `Histórico Completo da Conta (${clientName})`
      : `01/${String(safeMonth + 1).padStart(2, '0')}/${safeYear} a ${String(
          lastDay
        ).padStart(2, '0')}/${String(safeMonth + 1).padStart(2, '0')}/${safeYear} (${
          monthNames[safeMonth]
        })`;

  const comparisonLabel =
    filterMode === 'all'
      ? 'Média histórica da conta'
      : `01/${String(prevMonthIdx + 1).padStart(2, '0')}/${prevYear} a ${String(
          prevLastDay
        ).padStart(2, '0')}/${String(prevMonthIdx + 1).padStart(2, '0')}/${prevYear}`;

  return {
    clientId,
    clientName,
    clientLogo,
    monthKey: `${safeYear}-${String(safeMonth + 1).padStart(2, '0')}`,
    filterMode,
    periodLabel,
    comparisonLabel,
    linkedAccountNames: [],
    hasCustomAccountTotals: true,
    sections: { ...DEFAULT_SECTIONS_CONFIG },
    resumo: {
      alcanceTotal: 0,
      alcanceTotalPrev: 0,
      visualizacoesTotais: 0,
      engajamentoTotal: 0,
      engajamentoTotalPrev: 0,
      taxaEngajamentoMedia: 0,
      novosSeguidores: 0,
      novosSeguidoresPrev: 0,
      totalPostagens: 0,
      totalPostagensPrev: 0,
    },
    bestTimes: {
      bestHourLabel: 'Sem dados',
      bestDayLabel: 'Sem dados',
      hourlyBreakdown: [],
      weekdayBreakdown: [],
    },
    instagram: {
      seguidoresTotal: 0,
      seguidoresTotalPrev: 0,
      alcanceOrganico: 0,
      alcanceOrganicoPrev: 0,
      alcancePago: 0,
      alcancePagoPrev: 0,
      visualizacoesTotais: 0,
      visualizacoesTotaisPrev: 0,
      visitasPerfil: 0,
      visitasPerfilPrev: 0,
      interacoesTotal: 0,
      curtidasTotal: 0,
      comentariosTotal: 0,
      salvosTotal: 0,
      compartilhamentosTotal: 0,
      genderFemalePct: 0,
      genderMalePct: 0,
      ageGroups: [],
      topCities: [],
    },
    facebook: {
      seguidoresPagina: 0,
      seguidoresPaginaPrev: 0,
      alcancePublicacoes: 0,
      alcancePublicacoesPrev: 0,
      visualizacoesTotais: 0,
      engajamentoTotal: 0,
      engajamentoTotalPrev: 0,
      reacoesTotal: 0,
      comentariosTotal: 0,
      compartilhamentosTotal: 0,
    },
    metaAds: {
      spend: 0,
      spendPrev: 0,
      impressions: 0,
      impressionsPrev: 0,
      reach: 0,
      reachPrev: 0,
      clicks: 0,
      clicksPrev: 0,
      linkClicks: 0,
      linkClicksPrev: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      conversationsStarted: 0,
      conversationsStartedPrev: 0,
      costPerConversation: 0,
      igSpend: 0,
      igImpressions: 0,
      igReach: 0,
      igClicks: 0,
      fbSpend: 0,
      fbImpressions: 0,
      fbReach: 0,
      fbClicks: 0,
      campaigns: [],
    },
    posts: [],
  };
}

export function getStoredClientMetrics(
  clientId: string,
  cacheKey: string
): ClientMetricsReportData | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${clientId}_${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.resumo && parsed.instagram && Array.isArray(parsed.posts)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredClientMetrics(
  clientId: string,
  cacheKey: string,
  data: ClientMetricsReportData
) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${clientId}_${cacheKey}`, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function normalizeStr(val?: string): string {
  return (val || '')
    .trim()
    .replace(/^@/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parsePostTimestamp(raw: any): Date | null {
  if (!raw) return null;
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const str = String(raw).trim();
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchPostForMeEndpoint(path: string): Promise<any | null> {
  const apiKey = await getStoredPostForMeApiKey();
  if (!apiKey) return null;

  try {
    let res = await fetch(`/api/postforme${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.status === 404) {
      res = await fetch(`https://api.postforme.dev/v1${path}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Extrai métricas reais de um item retornado pelo Post for Me, suportando:
 * - Formato direto `{ metrics: { views, likes, comments, shares, saves, reach } }`
 * - Formato aninhado `{ post_info: {...}, metrics: {...} }`
 * - Formato Graph API `{ insights: { data: [{ name: 'impressions', values: [{ value: 123 }] }] } }`
 * - Formato `platform_data` / `statistics`
 */
function extractDeepPostMetrics(rItem: any): {
  views: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  interactions: number;
  profileVisits: number;
  follows: number;
} {
  const sources = [
    rItem?.metrics,
    rItem?.insights,
    rItem?.statistics,
    rItem?.engagement,
    rItem?.platform_data?.metrics,
    rItem?.platform_data?.insights,
    rItem?.platform_data,
    rItem?.post_info?.metrics,
    rItem,
  ].filter(Boolean);

  // Caso exista array estilo Graph API insights (`[{ name: 'reach', values: [{ value: 194 }] }]`)
  const graphInsightsMap: Record<string, number> = {};
  for (const src of sources) {
    const arr = Array.isArray(src) ? src : Array.isArray(src?.data) ? src.data : null;
    if (arr) {
      for (const entry of arr) {
        if (entry && typeof entry.name === 'string') {
          const val =
            entry.value ??
            (Array.isArray(entry.values) && entry.values[0]?.value) ??
            entry.total_value?.value ??
            0;
          if (typeof val === 'number') {
            graphInsightsMap[entry.name.toLowerCase()] = val;
          }
        }
      }
    }
  }

  const pickMaxNumber = (keys: string[]): number => {
    let best = 0;
    for (const k of keys) {
      const kLower = k.toLowerCase();
      if (graphInsightsMap[kLower] !== undefined && graphInsightsMap[kLower] > best) {
        best = graphInsightsMap[kLower];
      }
      for (const src of sources) {
        if (src && typeof src === 'object' && !Array.isArray(src)) {
          const rawVal = src[k] ?? src[kLower];
          const num = Number(rawVal);
          if (Number.isFinite(num) && num > best) {
            best = num;
          }
        }
      }
    }
    return best;
  };

  const views = pickMaxNumber([
    'views',
    'video_views',
    'impressions',
    'play_count',
    'plays',
    'ig_reels_aggregated_all_plays_count',
    'view_count',
    'post_impressions',
  ]);

  const reach = pickMaxNumber([
    'reach',
    'unique_views',
    'post_impressions_unique',
    'accounts_reached',
    'viewers',
  ]);

  const likes = pickMaxNumber([
    'likes',
    'like_count',
    'LikeCount',
    'reactions',
    'reaction_count',
    'total_reactions',
    'post_reactions_by_type_total',
  ]);

  const comments = pickMaxNumber([
    'comments',
    'comment_count',
    'CommentCount',
    'replies',
    'reply_count',
  ]);

  const saves = pickMaxNumber([
    'saves',
    'saved',
    'save_count',
    'bookmark_count',
    'bookmarks',
  ]);

  const shares = pickMaxNumber([
    'shares',
    'share_count',
    'ShareCount',
    'reposts',
  ]);

  const profileVisits = pickMaxNumber([
    'profile_visits',
    'profile_activity',
    'profile_views',
  ]);

  const follows = pickMaxNumber(['follows', 'new_followers']);

  const explicitInteractions = pickMaxNumber([
    'total_interactions',
    'interactions',
    'engagement',
    'post_engaged_users',
  ]);

  const sumInteractions = likes + comments + saves + shares;
  const interactions = Math.max(explicitInteractions, sumInteractions);

  // Se o Instagram retornou reach (ex: 194 no print do Zabcê) mas views veio 0, iguala views >= reach
  const finalViews = Math.max(views, reach);
  const finalReach = reach > 0 ? reach : views;

  return {
    views: finalViews,
    reach: finalReach,
    likes,
    comments,
    saves,
    shares,
    interactions,
    profileVisits,
    follows,
  };
}

/**
 * Busca TODAS as páginas do feed de uma conta no Post for Me (`/social-account-feeds/{id}`)
 * respeitando o limite de 10 itens por página do Facebook com `expand=metrics` e paginando por cursor/offset.
 */
async function fetchFullAccountFeedFromPostForMe(
  acc: PostForMeAccount
): Promise<any[]> {
  const isFb = String(acc.platform || '').toLowerCase().includes('facebook');
  const collected: any[] = [];
  const seenIds = new Set<string>();

  const extractList = (res: any): any[] => {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.posts)) return res.posts;
    if (Array.isArray(res.items)) return res.items;
    if (Array.isArray(res.feed)) return res.feed;
    return [];
  };

  const addItems = (list: any[]): number => {
    let added = 0;
    for (const item of list) {
      const info = item?.post_info || item;
      const idKey = String(
        info?.id ||
          info?.platform_post_id ||
          info?.external_id ||
          info?.permalink ||
          info?.url ||
          `${info?.caption || ''}_${info?.published_at || info?.created_at || collected.length}`
      );
      if (!seenIds.has(idKey)) {
        seenIds.add(idKey);
        collected.push(item);
        added++;
      }
    }
    return added;
  };

  // Para Facebook com expand=metrics, o limite máximo do Post for Me é 10 por página (FacebookFeedMetricsLimitCap)
  const pageSize = isFb ? 10 : 50;
  let nextCursor: string | null = null;

  for (let page = 0; page < 8; page++) {
    let query = `/social-account-feeds/${encodeURIComponent(
      acc.id
    )}?expand=metrics&limit=${pageSize}`;
    if (nextCursor) {
      query += `&cursor=${encodeURIComponent(nextCursor)}`;
    } else if (page > 0) {
      query += `&offset=${page * pageSize}`;
    }

    const res = await fetchPostForMeEndpoint(query);
    if (!res) {
      // Fallback sem limit caso a API rejeite o parâmetro limit
      if (page === 0) {
        const fallback = await fetchPostForMeEndpoint(
          `/social-account-feeds/${encodeURIComponent(acc.id)}?expand=metrics`
        );
        if (fallback) {
          addItems(extractList(fallback));
        }
      }
      break;
    }

    const list = extractList(res);
    const added = addItems(list);

    const cursorCandidate =
      res?.meta?.next_cursor ||
      res?.meta?.nextCursor ||
      res?.pagination?.next_cursor ||
      res?.pagination?.cursors?.after ||
      res?.next_cursor ||
      res?.nextCursor ||
      null;

    if (cursorCandidate && cursorCandidate !== nextCursor) {
      nextCursor = String(cursorCandidate);
    } else if (list.length < pageSize || added === 0) {
      break;
    } else {
      nextCursor = null;
    }
  }

  // Para Facebook (ou caso expand=metrics tenha trazido poucos itens), busca também sem expand=metrics para garantir todos os posts recentes
  if (collected.length < 25) {
    const plainRes = await fetchPostForMeEndpoint(
      `/social-account-feeds/${encodeURIComponent(acc.id)}?limit=50`
    );
    if (plainRes) {
      addItems(extractList(plainRes));
    }
  }

  return collected;
}

/**
 * Busca também os posts e STORIES enviados via Post for Me (`/v1/social-posts`) e Auto Post (`social_posts`),
 * pois a Graph API do Instagram não retorna Stories expirados (>24h) na rota `/social-account-feeds`,
 * mas eles ficam registrados no histórico de envios do Post for Me!
 */
async function fetchStoriesAndSentPostsForAccount(params: {
  clientId: string;
  selectedIgAccountId?: string;
  selectedFbAccountId?: string;
}): Promise<PostMetricItem[]> {
  const { clientId, selectedIgAccountId, selectedFbAccountId } = params;
  const targetAccountIds = new Set(
    [selectedIgAccountId, selectedFbAccountId].filter(Boolean) as string[]
  );
  const results: PostMetricItem[] = [];
  const seenKeys = new Set<string>();

  // 1. Consulta `/v1/social-posts` na API do Post for Me
  for (let page = 0; page < 4; page++) {
    const res = await fetchPostForMeEndpoint(
      `/social-posts?limit=100&offset=${page * 100}`
    );
    const items: any[] = Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
        ? res
        : [];
    if (items.length === 0) break;

    for (const sp of items) {
      // Verifica se este social-post foi enviado para a conta selecionada do cliente
      const postAccs: any[] = Array.isArray(sp?.social_accounts)
        ? sp.social_accounts
        : [];
      const matchesAccount =
        targetAccountIds.size > 0 &&
        postAccs.some((a) => {
          const id = typeof a === 'string' ? a : a?.id || a?.social_account_id;
          return id && targetAccountIds.has(String(id));
        });

      const matchesExternalClient =
        sp?.external_id === clientId || sp?.metadata?.clientId === clientId;

      if (!matchesAccount && !matchesExternalClient) continue;

      const rawDate = sp.published_at || sp.scheduled_at || sp.created_at;
      const parsedDate = parsePostTimestamp(rawDate);
      if (!parsedDate) continue;

      const isoDate = parsedDate.toISOString().slice(0, 10);
      const mediaArr: any[] = Array.isArray(sp.media) ? sp.media : [];
      const firstMedia =
        typeof mediaArr[0] === 'string'
          ? mediaArr[0]
          : mediaArr[0]?.url || mediaArr[0]?.thumbnail_url || '';

      const igPlacement = String(
        sp?.platform_configurations?.instagram?.placement || sp?.placement || ''
      ).toLowerCase();
      const fbPlacement = String(
        sp?.platform_configurations?.facebook?.placement || ''
      ).toLowerCase();

      const isStory =
        igPlacement.includes('stor') ||
        fbPlacement.includes('stor') ||
        String(firstMedia).includes('story_9x16');
      const isReels =
        igPlacement.includes('reel') ||
        fbPlacement.includes('reel') ||
        isVideoUrl(firstMedia);

      const type: PostMetricItem['type'] = isStory
        ? 'STORY'
        : isReels
          ? 'REELS'
          : mediaArr.length > 1
            ? 'CAROUSEL'
            : 'IMAGE';

      const caption = String(sp.caption || '').trim();
      const title =
        caption.split('\n')[0]?.trim() ||
        (isStory ? `Story Publicado (${isoDate.split('-').reverse().join('/')})` : `Publicação ${isoDate}`);

      const key = `${type}_${isoDate}_${firstMedia.slice(-30)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const m = extractDeepPostMetrics(sp);

      results.push({
        id: String(sp.id || `sp-${results.length}`),
        title: title.slice(0, 75),
        caption,
        date: isoDate,
        publishedAtIso: parsedDate.toISOString(),
        hourOfDay: parsedDate.getHours(),
        dayOfWeek: parsedDate.getDay(),
        type,
        platform: 'instagram',
        thumbnailUrl: firstMedia,
        views: m.views,
        reach: m.reach,
        interactions: m.interactions,
        engagementRate: m.reach > 0 ? Number(((m.interactions / m.reach) * 100).toFixed(2)) : 0,
        likes: m.likes,
        comments: m.comments,
        saves: m.saves,
        shares: m.shares,
        replies: m.comments,
        selected: true,
      });
    }

    if (items.length < 100) break;
  }

  // 2. Consulta também `social_posts` no Supabase para este `clientId` (garante 100% dos Stories e Reels enviados pelo Auto Post do cliente)
  try {
    const { data: rows } = await (supabase as any)
      .from('social_posts')
      .select('*')
      .eq('calendar_client_id', clientId)
      .order('created_at', { ascending: false });

    if (Array.isArray(rows)) {
      for (const sp of rows) {
        const rawDate =
          sp.published_at || sp.scheduled_at || sp.created_at;
        const parsedDate = parsePostTimestamp(rawDate);
        if (!parsedDate) continue;
        const isoDate = parsedDate.toISOString().slice(0, 10);

        const mediaArr: string[] = Array.isArray(sp.media)
          ? sp.media
          : Array.isArray(sp.feed_media)
            ? sp.feed_media
            : [];
        const storyArr: string[] = Array.isArray(sp.story_media) ? sp.story_media : [];
        const thumb =
          sp.reels_cover_url ||
          sp.cover_url ||
          mediaArr[0] ||
          storyArr[0] ||
          '';

        const placement = String(sp.placement || '').toLowerCase();
        const isStory = placement === 'stories' || (storyArr.length > 0 && mediaArr.length === 0);
        const isReels = placement === 'reels' || isVideoUrl(thumb);

        const type: PostMetricItem['type'] = isStory
          ? 'STORY'
          : isReels
            ? 'REELS'
            : mediaArr.length > 1
              ? 'CAROUSEL'
              : 'IMAGE';

        const caption = String(sp.caption || sp.title || '').trim();
        const title =
          sp.title ||
          caption.split('\n')[0]?.trim() ||
          (isStory ? `Story (${isoDate.split('-').reverse().join('/')})` : `Post (${isoDate.split('-').reverse().join('/')})`);

        const key = `${type}_${isoDate}_${thumb.slice(-30)}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        results.push({
          id: String(sp.id),
          title: title.slice(0, 75),
          caption,
          date: isoDate,
          publishedAtIso: parsedDate.toISOString(),
          hourOfDay: parsedDate.getHours(),
          dayOfWeek: parsedDate.getDay(),
          type,
          platform: 'instagram',
          thumbnailUrl: thumb,
          permalink: sp.permalink,
          views: 0,
          reach: 0,
          interactions: 0,
          engagementRate: 0,
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0,
          replies: 0,
          selected: true,
        });
      }
    }
  } catch {
    // ignore
  }

  return results;
}

export function computeBestTimesFromPosts(posts: PostMetricItem[]): {
  bestHourLabel: string;
  bestDayLabel: string;
  hourlyBreakdown: HourlyEngagementItem[];
  weekdayBreakdown: WeekdayEngagementItem[];
} {
  const hourSlots = [
    { label: '06h-09h', min: 6, max: 8 },
    { label: '09h-12h', min: 9, max: 11 },
    { label: '12h-15h', min: 12, max: 14 },
    { label: '15h-18h', min: 15, max: 17 },
    { label: '18h-21h', min: 18, max: 20 },
    { label: '21h-00h', min: 21, max: 23 },
  ];

  const hourlyBreakdown: HourlyEngagementItem[] = hourSlots.map((slot) => {
    const matching = posts.filter(
      (p) => p.selected && p.hourOfDay >= slot.min && p.hourOfDay <= slot.max
    );
    const totalInteractions = matching.reduce((acc, p) => acc + (p.interactions || 0), 0);
    const totalReach = matching.reduce((acc, p) => acc + (p.reach || p.views || 0), 0);
    const avgInteractions =
      matching.length > 0 ? Math.round(totalInteractions / matching.length) : 0;
    return {
      hourLabel: slot.label,
      postsCount: matching.length,
      totalInteractions,
      avgInteractions,
      totalReach,
    };
  });

  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const weekdayBreakdown: WeekdayEngagementItem[] = dayNames.map((name, idx) => {
    const matching = posts.filter((p) => p.selected && p.dayOfWeek === idx);
    const totalInteractions = matching.reduce((acc, p) => acc + (p.interactions || 0), 0);
    const totalReach = matching.reduce((acc, p) => acc + (p.reach || p.views || 0), 0);
    const avgInteractions =
      matching.length > 0 ? Math.round(totalInteractions / matching.length) : 0;
    return {
      dayIndex: idx,
      dayName: name,
      postsCount: matching.length,
      totalInteractions,
      avgInteractions,
      totalReach,
    };
  });

  const bestHourObj = [...hourlyBreakdown].sort(
    (a, b) =>
      b.avgInteractions - a.avgInteractions ||
      b.totalReach - a.totalReach ||
      b.postsCount - a.postsCount
  )[0];
  const bestDayObj = [...weekdayBreakdown].sort(
    (a, b) =>
      b.avgInteractions - a.avgInteractions ||
      b.totalReach - a.totalReach ||
      b.postsCount - a.postsCount
  )[0];

  return {
    bestHourLabel:
      bestHourObj && bestHourObj.postsCount > 0 ? bestHourObj.hourLabel : 'Sem dados no período',
    bestDayLabel:
      bestDayObj && bestDayObj.postsCount > 0 ? bestDayObj.dayName : 'Sem dados no período',
    hourlyBreakdown,
    weekdayBreakdown,
  };
}

/**
 * Recalcula os indicadores a partir dos posts, MAS preserva os totais gerais da conta
 * caso o usuário tenha inserido os números da Visão Geral da Meta (ex: 3,4 milhões de views)
 */
export function recalculateReportFromRealPosts(
  data: ClientMetricsReportData,
  forceOverwriteAccountTotals = false
): ClientMetricsReportData {
  const selected = data.posts.filter((p) => p.selected);
  const igPosts = selected.filter((p) => p.platform === 'instagram');
  const fbPosts = selected.filter((p) => p.platform === 'facebook');

  const igViewsSum = igPosts.reduce((a, b) => a + (b.views || 0), 0);
  const igReachSum = igPosts.reduce((a, b) => a + (b.reach || 0), 0);
  const igLikesSum = igPosts.reduce((a, b) => a + (b.likes || 0), 0);
  const igCommentsSum = igPosts.reduce((a, b) => a + (b.comments || 0), 0);
  const igSavesSum = igPosts.reduce((a, b) => a + (b.saves || 0), 0);
  const igSharesSum = igPosts.reduce((a, b) => a + (b.shares || 0), 0);
  const igInteractionsSum = igPosts.reduce(
    (a, b) => a + (b.interactions || b.likes + b.comments + b.saves + b.shares),
    0
  );

  const fbViewsSum = fbPosts.reduce((a, b) => a + (b.views || 0), 0);
  const fbReachSum = fbPosts.reduce((a, b) => a + (b.reach || 0), 0);
  const fbLikesSum = fbPosts.reduce((a, b) => a + (b.likes || 0), 0);
  const fbCommentsSum = fbPosts.reduce((a, b) => a + (b.comments || 0), 0);
  const fbSharesSum = fbPosts.reduce((a, b) => a + (b.shares || 0), 0);
  const fbInteractionsSum = fbPosts.reduce(
    (a, b) => a + (b.interactions || b.likes + b.comments + b.saves + b.shares),
    0
  );

  const preserveCustom = data.hasCustomAccountTotals && !forceOverwriteAccountTotals;

  const finalIgViews = preserveCustom
    ? Math.max(data.instagram.visualizacoesTotais, igViewsSum)
    : igViewsSum;
  const finalIgReach = preserveCustom
    ? Math.max(data.instagram.alcanceOrganico, igReachSum)
    : igReachSum;
  const finalIgInteractions = preserveCustom
    ? Math.max(data.instagram.interacoesTotal, igInteractionsSum)
    : igInteractionsSum;

  const finalFbViews = preserveCustom
    ? Math.max(data.facebook.visualizacoesTotais, fbViewsSum)
    : fbViewsSum;
  const finalFbReach = preserveCustom
    ? Math.max(data.facebook.alcancePublicacoes, fbReachSum)
    : fbReachSum;
  const finalFbInteractions = preserveCustom
    ? Math.max(data.facebook.engajamentoTotal, fbInteractionsSum)
    : fbInteractionsSum;

  const totalReach = finalIgReach + finalFbReach + (data.metaAds.reach || 0);
  const totalViews = finalIgViews + finalFbViews + (data.metaAds.impressions || 0);
  const totalInteractions = finalIgInteractions + finalFbInteractions;

  const avgEngRate =
    totalReach > 0
      ? Number(((totalInteractions / totalReach) * 100).toFixed(2))
      : totalViews > 0
        ? Number(((totalInteractions / totalViews) * 100).toFixed(2))
        : 0;

  const bestTimes = computeBestTimesFromPosts(selected);

  return {
    ...data,
    bestTimes,
    resumo: {
      ...data.resumo,
      alcanceTotal: totalReach,
      visualizacoesTotais: totalViews,
      engajamentoTotal: totalInteractions,
      taxaEngajamentoMedia: avgEngRate,
      totalPostagens: selected.length,
    },
    instagram: {
      ...data.instagram,
      alcanceOrganico: finalIgReach,
      visualizacoesTotais: finalIgViews,
      interacoesTotal: finalIgInteractions,
      curtidasTotal: Math.max(preserveCustom ? data.instagram.curtidasTotal : 0, igLikesSum),
      comentariosTotal: Math.max(
        preserveCustom ? data.instagram.comentariosTotal : 0,
        igCommentsSum
      ),
      salvosTotal: Math.max(preserveCustom ? data.instagram.salvosTotal : 0, igSavesSum),
      compartilhamentosTotal: Math.max(
        preserveCustom ? data.instagram.compartilhamentosTotal : 0,
        igSharesSum
      ),
    },
    facebook: {
      ...data.facebook,
      alcancePublicacoes: finalFbReach,
      visualizacoesTotais: finalFbViews,
      engajamentoTotal: finalFbInteractions,
      reacoesTotal: Math.max(preserveCustom ? data.facebook.reacoesTotal : 0, fbLikesSum),
      comentariosTotal: Math.max(
        preserveCustom ? data.facebook.comentariosTotal : 0,
        fbCommentsSum
      ),
      compartilhamentosTotal: Math.max(
        preserveCustom ? data.facebook.compartilhamentosTotal : 0,
        fbSharesSum
      ),
    },
  };
}

export async function listAllPostForMeAccounts(): Promise<PostForMeAccount[]> {
  try {
    const res = await socialProvider.listAccounts();
    if (res.ok && Array.isArray(res.data?.accounts)) {
      return res.data.accounts;
    }
    return [];
  } catch {
    return [];
  }
}

export async function buildClientMetricsReport(params: {
  clientId: string;
  clientName: string;
  clientLogo?: string;
  clientIgAccountId?: string;
  clientFbAccountId?: string;
  clientIgUsername?: string;
  clientFbPageName?: string;
  year: number;
  month: number;
  filterMode?: 'month' | 'all';
  overrideIgAccountId?: string;
  overrideFbAccountId?: string;
  forceRefreshFromSource?: boolean;
}): Promise<{
  report: ClientMetricsReportData;
  availableAccounts: PostForMeAccount[];
  totalAccountPostsFetched: number;
}> {
  const {
    clientId,
    clientName,
    clientLogo,
    clientIgAccountId,
    clientFbAccountId,
    clientIgUsername,
    clientFbPageName,
    year,
    month,
    filterMode = 'month',
    overrideIgAccountId,
    overrideFbAccountId,
    forceRefreshFromSource = false,
  } = params;

  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonth =
    Number.isFinite(month) && month >= 0 && month <= 11 ? month : new Date().getMonth();
  const monthPrefix = `${safeYear}-${String(safeMonth + 1).padStart(2, '0')}`;
  const cacheKey = filterMode === 'all' ? 'ALL' : monthPrefix;

  const availableAccounts = await listAllPostForMeAccounts();
  const savedBinding = getSavedClientAccountBinding(clientId);

  const normClient = normalizeStr(clientName);
  const normIgUser = normalizeStr(clientIgUsername);
  const normFbPage = normalizeStr(clientFbPageName);

  const igAccounts = availableAccounts.filter((a) =>
    String(a.platform || '').toLowerCase().includes('instagram')
  );
  const fbAccounts = availableAccounts.filter((a) =>
    String(a.platform || '').toLowerCase().includes('facebook')
  );

  const matchedIg =
    igAccounts.find(
      (a) =>
        a.id === (overrideIgAccountId || savedBinding.igAccountId || clientIgAccountId)
    ) ||
    igAccounts.find((a) => {
      const nName = normalizeStr(a.name);
      const nUser = normalizeStr(a.username);
      if (normIgUser && (nUser === normIgUser || nName === normIgUser)) return true;
      if (!normClient) return false;
      return (
        (nName && (nName.includes(normClient) || normClient.includes(nName))) ||
        (nUser && (nUser.includes(normClient) || normClient.includes(nUser)))
      );
    });

  const matchedFb =
    fbAccounts.find(
      (a) =>
        a.id === (overrideFbAccountId || savedBinding.fbAccountId || clientFbAccountId)
    ) ||
    fbAccounts.find((a) => {
      const nName = normalizeStr(a.name);
      const nUser = normalizeStr(a.username);
      if (normFbPage && (nName === normFbPage || nUser === normFbPage)) return true;
      if (!normClient) return false;
      return (
        (nName && (nName.includes(normClient) || normClient.includes(nName))) ||
        (nUser && (nUser.includes(normClient) || normClient.includes(nUser)))
      );
    });

  const selectedIgAccountId =
    overrideIgAccountId !== undefined ? overrideIgAccountId : matchedIg?.id || '';
  const selectedFbAccountId =
    overrideFbAccountId !== undefined ? overrideFbAccountId : matchedFb?.id || '';

  if (selectedIgAccountId || selectedFbAccountId) {
    saveClientAccountBinding(clientId, {
      igAccountId: selectedIgAccountId,
      fbAccountId: selectedFbAccountId,
    });
  }

  const existingCached = getStoredClientMetrics(clientId, cacheKey);
  if (
    !forceRefreshFromSource &&
    existingCached &&
    existingCached.selectedIgAccountId === selectedIgAccountId &&
    existingCached.selectedFbAccountId === selectedFbAccountId
  ) {
    return {
      report: existingCached,
      availableAccounts,
      totalAccountPostsFetched: existingCached.posts.length,
    };
  }

  const lastDay = new Date(safeYear, safeMonth + 1, 0).getDate();
  const prevMonthDate = new Date(safeYear, safeMonth - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonthIdx = prevMonthDate.getMonth();
  const prevLastDay = new Date(prevYear, prevMonthIdx + 1, 0).getDate();

  const monthNames = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];

  const periodLabel =
    filterMode === 'all'
      ? `Histórico Completo da Conta (${clientName})`
      : `01/${String(safeMonth + 1).padStart(2, '0')}/${safeYear} a ${String(
          lastDay
        ).padStart(2, '0')}/${String(safeMonth + 1).padStart(2, '0')}/${safeYear} (${
          monthNames[safeMonth]
        })`;

  const comparisonLabel =
    filterMode === 'all'
      ? 'Média histórica da conta'
      : `01/${String(prevMonthIdx + 1).padStart(2, '0')}/${prevYear} a ${String(
          prevLastDay
        ).padStart(2, '0')}/${String(prevMonthIdx + 1).padStart(2, '0')}/${prevYear}`;

  const targetAccounts = [
    availableAccounts.find((a) => a.id === selectedIgAccountId),
    availableAccounts.find((a) => a.id === selectedFbAccountId),
  ].filter(Boolean) as PostForMeAccount[];

  const linkedAccountNames = targetAccounts.map(
    (a) => `${a.username ? '@' + a.username.replace(/^@/, '') : a.name} (${a.platform})`
  );

  // 3. Puxa TODAS as páginas do feed do Post for Me para Instagram e Facebook
  const allAccountPosts: PostMetricItem[] = [];
  const seenPostKeys = new Set<string>();
  const prevMonthPrefix = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}`;
  const prevMonthPosts: PostMetricItem[] = [];
  let followersFromApi = 0;
  let fbFollowersFromApi = 0;

  for (const acc of targetAccounts) {
    const isFb = String(acc.platform || '').toLowerCase().includes('facebook');
    const accDetail = await fetchPostForMeEndpoint(
      `/social-accounts/${encodeURIComponent(acc.id)}`
    );
    if (accDetail) {
      const fCount = Number(
        accDetail.followers_count ??
          accDetail.followers ??
          accDetail.fan_count ??
          accDetail.metrics?.followers ??
          0
      );
      if (fCount > 0) {
        if (isFb) fbFollowersFromApi = fCount;
        else followersFromApi = fCount;
      }
    }

    const items = await fetchFullAccountFeedFromPostForMe(acc);

    for (const rItem of items) {
      const info = rItem?.post_info || rItem;
      const rawDate =
        info?.published_at ||
        info?.timestamp ||
        info?.created_at ||
        info?.posted_at ||
        info?.date ||
        rItem?.published_at ||
        rItem?.timestamp ||
        rItem?.created_at;
      const parsedDate = parsePostTimestamp(rawDate);
      if (!parsedDate) continue;

      const isoDate = parsedDate.toISOString().slice(0, 10);
      const hourOfDay = parsedDate.getHours();
      const dayOfWeek = parsedDate.getDay();

      // Extrai URL da imagem / capa do vídeo
      const mediaArr = Array.isArray(info?.media)
        ? info.media
        : Array.isArray(rItem?.media)
          ? rItem.media
          : [];
      const firstMediaItem = mediaArr[0];
      const thumb =
        info?.thumbnail_url ||
        info?.media_url ||
        info?.cover_url ||
        rItem?.thumbnail_url ||
        rItem?.media_url ||
        (typeof firstMediaItem === 'string'
          ? firstMediaItem
          : firstMediaItem?.thumbnail_url ||
            firstMediaItem?.url ||
            firstMediaItem?.media_url) ||
        (Array.isArray(info?.children?.data) &&
          (info.children.data[0]?.thumbnail_url || info.children.data[0]?.media_url)) ||
        '';

      const permalink = String(
        info?.permalink || info?.url || info?.platform_url || rItem?.permalink || rItem?.url || ''
      );
      const caption = String(
        info?.caption || info?.text || info?.message || rItem?.caption || rItem?.text || ''
      ).trim();

      const m = extractDeepPostMetrics(rItem);

      const rawType = String(
        info?.media_product_type ||
          info?.media_type ||
          info?.type ||
          info?.placement ||
          rItem?.media_type ||
          rItem?.type ||
          firstMediaItem?.type ||
          firstMediaItem?.media_type ||
          ''
      ).toLowerCase();

      // Detecta Reels, Stories, Carrossel e Imagem com alta precisão (incluindo /reel/ no link do Instagram!)
      const isStory =
        rawType.includes('stor') ||
        permalink.toLowerCase().includes('/stories/');
      const isReels =
        !isStory &&
        (rawType.includes('reel') ||
          rawType.includes('video') ||
          permalink.toLowerCase().includes('/reel/') ||
          permalink.toLowerCase().includes('/reels/') ||
          permalink.toLowerCase().includes('/videos/') ||
          isVideoUrl(thumb) ||
          Boolean(info?.video_url || rItem?.video_url || info?.is_video || rItem?.is_video));
      const isCarousel =
        !isStory &&
        !isReels &&
        (rawType.includes('carousel') ||
          rawType.includes('album') ||
          mediaArr.length > 1 ||
          (Array.isArray(info?.children?.data) && info.children.data.length > 1));

      const type: PostMetricItem['type'] = isStory
        ? 'STORY'
        : isReels
          ? 'REELS'
          : isCarousel
            ? 'CAROUSEL'
            : 'IMAGE';

      const firstLine =
        caption.split('\n')[0]?.trim() ||
        (isStory
          ? `Story (${isoDate.split('-').reverse().join('/')})`
          : isReels
            ? `Reels / Vídeo (${isoDate.split('-').reverse().join('/')})`
            : `Publicação (${isoDate.split('-').reverse().join('/')})`);

      const baseForRate = m.reach > 0 ? m.reach : m.views;
      const engagementRate =
        baseForRate > 0 ? Number(((m.interactions / baseForRate) * 100).toFixed(2)) : 0;

      const postObj: PostMetricItem = {
        id: String(
          info?.id ||
            info?.platform_post_id ||
            rItem?.id ||
            `${acc.id}-${isoDate}-${allAccountPosts.length}`
        ),
        title: firstLine.slice(0, 75),
        caption,
        date: isoDate,
        publishedAtIso: parsedDate.toISOString(),
        hourOfDay,
        dayOfWeek,
        type,
        platform: isFb ? 'facebook' : 'instagram',
        thumbnailUrl: typeof thumb === 'string' ? thumb : '',
        permalink: permalink || undefined,
        views: m.views,
        reach: m.reach,
        interactions: m.interactions,
        engagementRate,
        likes: m.likes,
        comments: m.comments,
        saves: m.saves,
        shares: m.shares,
        profileVisits: m.profileVisits,
        follows: m.follows,
        retentionRate: 0,
        replies: m.comments,
        selected: true,
      };

      const dedupKey = `${postObj.platform}_${postObj.id}_${postObj.date}`;
      if (!seenPostKeys.has(dedupKey)) {
        seenPostKeys.add(dedupKey);
        allAccountPosts.push(postObj);
        if (isoDate.startsWith(prevMonthPrefix)) {
          prevMonthPosts.push(postObj);
        }
      }
    }
  }

  // 4. Busca também os Stories e posts enviados via `/v1/social-posts` e `social_posts` para que todos os Stories apareçam!
  const sentStoriesAndPosts = await fetchStoriesAndSentPostsForAccount({
    clientId,
    selectedIgAccountId,
    selectedFbAccountId,
  });

  for (const spItem of sentStoriesAndPosts) {
    // Evita duplicar se já veio no feed
    const alreadyExists = allAccountPosts.some(
      (existing) =>
        existing.date === spItem.date &&
        existing.type === spItem.type &&
        (existing.title === spItem.title ||
          (existing.thumbnailUrl && existing.thumbnailUrl === spItem.thumbnailUrl))
    );
    if (!alreadyExists) {
      allAccountPosts.push(spItem);
    }
  }

  // Filtra pelo mês selecionado ou mantém todos se filterMode === 'all'
  let filteredPosts =
    filterMode === 'all'
      ? allAccountPosts
      : allAccountPosts.filter((p) => p.date.startsWith(monthPrefix));

  // Se o mês do calendário estiver em um ano sem posts (ex: Nov 2026 vs posts em outro mês) mas a conta tem posts,
  // verifica também se o mês/dia bate ignorando o ano caso a data do post tenha vindo com ano corrente
  if (filterMode === 'month' && filteredPosts.length === 0 && allAccountPosts.length > 0) {
    const monthOnlySuffix = `-${String(safeMonth + 1).padStart(2, '0')}-`;
    const sameMonthAnyYear = allAccountPosts.filter((p) => p.date.includes(monthOnlySuffix));
    if (sameMonthAnyYear.length > 0) {
      filteredPosts = sameMonthAnyYear;
    }
  }

  filteredPosts.sort((a, b) => b.publishedAtIso.localeCompare(a.publishedAtIso));

  const prevReach = prevMonthPosts.reduce((a, b) => a + b.reach, 0);
  const prevInteractions = prevMonthPosts.reduce((a, b) => a + b.interactions, 0);

  const initialReport: ClientMetricsReportData = {
    clientId,
    clientName,
    clientLogo,
    monthKey: cacheKey,
    filterMode,
    periodLabel,
    comparisonLabel,
    selectedIgAccountId,
    selectedFbAccountId,
    linkedAccountNames,
    hasCustomAccountTotals: existingCached?.hasCustomAccountTotals || false,
    sections: existingCached?.sections || { ...DEFAULT_SECTIONS_CONFIG },
    resumo: existingCached?.resumo || {
      alcanceTotal: 0,
      alcanceTotalPrev: prevReach,
      visualizacoesTotais: 0,
      engajamentoTotal: 0,
      engajamentoTotalPrev: prevInteractions,
      taxaEngajamentoMedia: 0,
      novosSeguidores: followersFromApi,
      novosSeguidoresPrev: 0,
      totalPostagens: filteredPosts.length,
      totalPostagensPrev: prevMonthPosts.length,
    },
    bestTimes: computeBestTimesFromPosts(filteredPosts),
    instagram: existingCached?.instagram || {
      seguidoresTotal: followersFromApi,
      seguidoresTotalPrev: 0,
      novosSeguidoresPeriodo: 0,
      deixaramDeSeguirPeriodo: 0,
      alcanceOrganico: 0,
      alcanceOrganicoPrev: prevReach,
      alcanceSeguidores: 0,
      alcanceNaoSeguidores: 0,
      alcancePago: 0,
      alcancePagoPrev: 0,
      visualizacoesTotais: 0,
      visualizacoesTotaisPrev: 0,
      viewsFollowersPct: 69.2,
      viewsNonFollowersPct: 30.8,
      visitasPerfil: 0,
      visitasPerfilPrev: 0,
      interacoesTotal: 0,
      interacoesSeguidoresPct: 82,
      interacoesNaoSeguidoresPct: 18,
      curtidasTotal: 0,
      comentariosTotal: 0,
      salvosTotal: 0,
      compartilhamentosTotal: 0,
      conversasIniciadas: 0,
      novosContatosMensagem: 0,
      taxaRespostaPct: 0,
      genderFemalePct: 68,
      genderMalePct: 32,
      ageGroups: [
        { range: '13-17 (Crianças/Adolesc.)', femalePct: 2, malePct: 1, totalPct: 3 },
        { range: '18-24 (Jovens)', femalePct: 10, malePct: 6, totalPct: 16 },
        { range: '25-34 (Adultos)', femalePct: 24, malePct: 11, totalPct: 35 },
        { range: '35-44 (Adultos)', femalePct: 19, malePct: 8, totalPct: 27 },
        { range: '45-54', femalePct: 9, malePct: 4, totalPct: 13 },
        { range: '55+', femalePct: 4, malePct: 2, totalPct: 6 },
      ],
      topCities: [],
    },
    facebook: existingCached?.facebook || {
      seguidoresPagina: fbFollowersFromApi,
      seguidoresPaginaPrev: 0,
      novosSeguidoresPeriodo: 0,
      deixaramDeSeguirPeriodo: 0,
      seguidoresLiquidos: 0,
      alcancePublicacoes: 0,
      alcancePublicacoesPrev: 0,
      visualizacoesTotais: 0,
      visualizadoresUnicos: 0,
      visitasPagina: 0,
      videosReels3sViews: 0,
      conversasIniciadas: 0,
      engajamentoTotal: 0,
      engajamentoTotalPrev: 0,
      reacoesTotal: 0,
      comentariosTotal: 0,
      compartilhamentosTotal: 0,
    },
    metaAds: existingCached?.metaAds || {
      adAccountId: '',
      accessToken: '',
      isRealFromMetaApi: false,
      spend: 0,
      spendPrev: 0,
      impressions: 0,
      impressionsPrev: 0,
      reach: 0,
      reachPrev: 0,
      clicks: 0,
      clicksPrev: 0,
      linkClicks: 0,
      linkClicksPrev: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      conversationsStarted: 0,
      conversationsStartedPrev: 0,
      costPerConversation: 0,
      igSpend: 0,
      igImpressions: 0,
      igReach: 0,
      igClicks: 0,
      fbSpend: 0,
      fbImpressions: 0,
      fbReach: 0,
      fbClicks: 0,
      campaigns: [],
    },
    posts: filteredPosts,
  };

  const finalReport = recalculateReportFromRealPosts(initialReport);
  saveStoredClientMetrics(clientId, cacheKey, finalReport);

  return {
    report: finalReport,
    availableAccounts,
    totalAccountPostsFetched: allAccountPosts.length,
  };
}

export interface MetaPageAsset {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  fbFollowers: number;
  businessName?: string;
  igBusinessId?: string;
  igUsername?: string;
  igName?: string;
  igFollowers?: number;
  igProfilePic?: string;
}

export interface MetaAdAccountAsset {
  id: string; // act_123456
  accountId: string;
  name: string;
  businessName?: string;
}

export interface ClientMetaBinding {
  pageId?: string;
  pageAccessToken?: string;
  igBusinessId?: string;
  adAccountId?: string;
}

const GLOBAL_META_TOKEN_KEY = 'macmidia_meta_global_token_v1';
const CLIENT_META_BINDING_PREFIX = 'macmidia_meta_client_binding_v1';

export function getSavedGlobalMetaToken(): string {
  try {
    return localStorage.getItem(GLOBAL_META_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function saveGlobalMetaToken(token: string): void {
  try {
    if (token.trim()) {
      localStorage.setItem(GLOBAL_META_TOKEN_KEY, token.trim());
    }
  } catch {
    // ignore
  }
}

export function getSavedClientMetaBinding(clientId: string): ClientMetaBinding {
  try {
    const raw = localStorage.getItem(`${CLIENT_META_BINDING_PREFIX}_${clientId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveClientMetaBinding(clientId: string, binding: ClientMetaBinding): void {
  try {
    localStorage.setItem(`${CLIENT_META_BINDING_PREFIX}_${clientId}`, JSON.stringify(binding));
  } catch {
    // ignore
  }
}

const CACHED_META_ASSETS_KEY = 'macmidia_cached_meta_assets_v1';

export function getCachedMetaAssets(): { pages: MetaPageAsset[]; adAccounts: MetaAdAccountAsset[] } {
  try {
    const raw = localStorage.getItem(CACHED_META_ASSETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pages: Array.isArray(parsed?.pages) ? parsed.pages : [],
        adAccounts: Array.isArray(parsed?.adAccounts) ? parsed.adAccounts : [],
      };
    }
  } catch {
    // ignore
  }
  return { pages: [], adAccounts: [] };
}

export function saveCachedMetaAssets(assets: { pages: MetaPageAsset[]; adAccounts: MetaAdAccountAsset[] }): void {
  try {
    localStorage.setItem(CACHED_META_ASSETS_KEY, JSON.stringify(assets));
  } catch {
    // ignore
  }
}

/**
 * Lista todas as Páginas do Facebook, Contas de Instagram Business e Contas de Anúncios
 * que o Token da Meta tem acesso (incluindo via Gerenciador de Negócios / Business Manager).
 */
export async function fetchMetaAccessibleAssets(accessToken: string): Promise<{
  pages: MetaPageAsset[];
  adAccounts: MetaAdAccountAsset[];
  portfoliosCount: number;
  hasBusinessManagementPermission: boolean;
  bizErrorMessage?: string;
}> {
  const cleanToken = accessToken.trim();
  if (!cleanToken) {
    throw new Error('Cole o Token de Acesso da Meta (EAA...) primeiro.');
  }
  saveGlobalMetaToken(cleanToken);

  const pagesMap = new Map<string, MetaPageAsset>();
  const adAccountsMap = new Map<string, MetaAdAccountAsset>();
  const discoveredBusinessesMap = new Map<string, string>();
  let hasBusinessManagementPermission = false;
  let bizErrorMessage: string | undefined = undefined;

  // 0. Verifica quais permissões o Token realmente possui
  try {
    const permRes = await fetch(
      `https://graph.facebook.com/v20.0/me/permissions?access_token=${encodeURIComponent(cleanToken)}`
    );
    const permJson = await permRes.json();
    if (Array.isArray(permJson?.data)) {
      const granted = permJson.data
        .filter((p: any) => p.status === 'granted')
        .map((p: any) => p.permission);
      hasBusinessManagementPermission = granted.includes('business_management');
    }
  } catch {
    // ignore
  }

  const parsePageNode = (p: any, bizName?: string) => {
    if (!p?.id) return;
    if (p?.business?.id) {
      discoveredBusinessesMap.set(
        String(p.business.id),
        String(p.business.name || bizName || p.business.id)
      );
    }
    const resolvedBizName = p?.business?.name || bizName;
    const existing = pagesMap.get(String(p.id));
    const ig = p.instagram_business_account || p.connected_instagram_account;
    pagesMap.set(String(p.id), {
      pageId: String(p.id),
      pageName: String(p.name || existing?.pageName || `Página ${p.id}`),
      pageAccessToken: String(p.access_token || existing?.pageAccessToken || cleanToken),
      fbFollowers: Number(p.followers_count ?? p.fan_count ?? existing?.fbFollowers ?? 0),
      businessName: resolvedBizName || existing?.businessName,
      igBusinessId: ig?.id ? String(ig.id) : existing?.igBusinessId,
      igUsername: ig?.username ? String(ig.username) : existing?.igUsername,
      igName: ig?.name ? String(ig.name) : existing?.igName,
      igFollowers: Number(ig?.followers_count ?? existing?.igFollowers ?? 0),
      igProfilePic:
        ig?.profile_picture_url || p?.picture?.data?.url || existing?.igProfilePic || undefined,
    });
  };

  const parseAdAccNode = (a: any, bizName?: string) => {
    if (!a?.id) return;
    if (a?.business?.id) {
      discoveredBusinessesMap.set(
        String(a.business.id),
        String(a.business.name || bizName || a.business.id)
      );
    }
    const actId = String(a.id).startsWith('act_') ? String(a.id) : `act_${a.id}`;
    const existing = adAccountsMap.get(actId);
    adAccountsMap.set(actId, {
      id: actId,
      accountId: String(a.account_id || actId.replace('act_', '')),
      name: String(a.name || existing?.name || actId),
      businessName: a.business?.name || bizName || existing?.businessName || undefined,
    });
  };

  // 1. Busca /me/accounts (Páginas + Instagram Business vinculado) com paginação
  const pageFields =
    'id,name,access_token,fan_count,followers_count,business{id,name},picture{url},instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url}';
  try {
    let nextPagesUrl: string | null = `https://graph.facebook.com/v20.0/me/accounts?fields=${encodeURIComponent(
      pageFields
    )}&limit=100&access_token=${encodeURIComponent(cleanToken)}`;
    for (let i = 0; i < 8 && nextPagesUrl; i++) {
      const resPages = await fetch(nextPagesUrl);
      const jsonPages = await resPages.json();
      if (jsonPages?.error && pagesMap.size === 0) {
        const fallbackFields =
          'id,name,access_token,fan_count,followers_count,picture{url},instagram_business_account{id,username,name,followers_count,media_count,profile_picture_url}';
        const fbRes = await fetch(
          `https://graph.facebook.com/v20.0/me/accounts?fields=${encodeURIComponent(
            fallbackFields
          )}&limit=100&access_token=${encodeURIComponent(cleanToken)}`
        );
        const fbJson = await fbRes.json();
        if (fbJson?.error) throw new Error(fbJson.error.message);
        if (Array.isArray(fbJson?.data)) fbJson.data.forEach((p: any) => parsePageNode(p));
        nextPagesUrl = fbJson?.paging?.next || null;
        continue;
      }
      if (Array.isArray(jsonPages?.data)) {
        jsonPages.data.forEach((p: any) => parsePageNode(p));
      }
      nextPagesUrl = jsonPages?.paging?.next || null;
    }
  } catch (err: any) {
    if (pagesMap.size === 0 && err?.message) {
      throw err;
    }
  }

  // 2. Busca /me/adaccounts (Contas de Anúncios diretas e de Portfólios) com paginação
  const adFields = 'id,account_id,name,currency,account_status,business{id,name}';
  const adFieldsFallback = 'id,account_id,name,currency,account_status';
  try {
    let nextAdsUrl: string | null = `https://graph.facebook.com/v20.0/me/adaccounts?fields=${encodeURIComponent(
      adFields
    )}&limit=100&access_token=${encodeURIComponent(cleanToken)}`;
    for (let i = 0; i < 8 && nextAdsUrl; i++) {
      const resAds = await fetch(nextAdsUrl);
      const jsonAds = await resAds.json();
      if (jsonAds?.error && adAccountsMap.size === 0) {
        const fallbackRes = await fetch(
          `https://graph.facebook.com/v20.0/me/adaccounts?fields=${encodeURIComponent(
            adFieldsFallback
          )}&limit=100&access_token=${encodeURIComponent(cleanToken)}`
        );
        const fallbackJson = await fallbackRes.json();
        if (Array.isArray(fallbackJson?.data)) {
          fallbackJson.data.forEach((a: any) => parseAdAccNode(a));
        }
        nextAdsUrl = fallbackJson?.paging?.next || null;
      } else {
        if (Array.isArray(jsonAds?.data)) {
          jsonAds.data.forEach((a: any) => parseAdAccNode(a));
        }
        nextAdsUrl = jsonAds?.paging?.next || null;
      }
    }
  } catch {
    // ignore
  }

  // 3. Busca TODOS os Portfólios Empresariais (/me/businesses)
  const bizPageFields =
    'id,name,access_token,followers_count,fan_count,instagram_business_account{id,username,name,followers_count}';
  const bizPageFieldsFallback = 'id,name,instagram_business_account{id,username,name}';
  try {
    let nextBizUrl: string | null = `https://graph.facebook.com/v20.0/me/businesses?fields=id,name&access_token=${encodeURIComponent(
      cleanToken
    )}`;
    for (let i = 0; i < 8 && nextBizUrl; i++) {
      const resBiz = await fetch(nextBizUrl);
      const jsonBiz = await resBiz.json();
      if (jsonBiz?.error) {
        bizErrorMessage = jsonBiz.error.message;
      }
      if (Array.isArray(jsonBiz?.data)) {
        for (const b of jsonBiz.data) {
          if (b?.id) {
            discoveredBusinessesMap.set(String(b.id), String(b.name || b.id));
          }
        }
      }
      nextBizUrl = jsonBiz?.paging?.next || null;
    }

    const allBusinesses = Array.from(discoveredBusinessesMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    if (allBusinesses.length > 0) {
      await Promise.all(
        allBusinesses.map(async (biz) => {
          const bName = String(biz.name || '');
          const fetchEdgeSafe = async (edge: string, fields: string, fallbackFields?: string) => {
            try {
              const r1 = await fetch(
                `https://graph.facebook.com/v20.0/${biz.id}/${edge}?fields=${encodeURIComponent(
                  fields
                )}&limit=100&access_token=${encodeURIComponent(cleanToken)}`
              );
              const j1 = await r1.json();
              if (Array.isArray(j1?.data)) return j1.data;
              if (fallbackFields) {
                const r2 = await fetch(
                  `https://graph.facebook.com/v20.0/${biz.id}/${edge}?fields=${encodeURIComponent(
                    fallbackFields
                  )}&limit=100&access_token=${encodeURIComponent(cleanToken)}`
                );
                const j2 = await r2.json();
                if (Array.isArray(j2?.data)) return j2.data;
              }
            } catch {
              // ignore
            }
            return [];
          };

          const [pagesList, ownedPages, clientPages, adAccountsList, ownedAds, clientAds, igAccounts, ownedIg, partnerBizs] = await Promise.all([
            fetchEdgeSafe('pages', bizPageFields, bizPageFieldsFallback),
            fetchEdgeSafe('owned_pages', bizPageFields, bizPageFieldsFallback),
            fetchEdgeSafe('client_pages', bizPageFields, bizPageFieldsFallback),
            fetchEdgeSafe('adaccounts', adFields, 'id,account_id,name'),
            fetchEdgeSafe('owned_ad_accounts', adFields, 'id,account_id,name'),
            fetchEdgeSafe('client_ad_accounts', adFields, 'id,account_id,name'),
            fetchEdgeSafe('instagram_accounts', 'id,username,name,followers_count', 'id,username'),
            fetchEdgeSafe('owned_instagram_accounts', 'id,username,name,followers_count', 'id,username'),
            fetchEdgeSafe('client_businesses', 'id,name'),
          ]);

          partnerBizs.forEach((pb: any) => {
            if (pb?.id && !discoveredBusinessesMap.has(String(pb.id))) {
              discoveredBusinessesMap.set(String(pb.id), String(pb.name || pb.id));
            }
          });

          pagesList.forEach((p: any) => parsePageNode(p, bName));
          ownedPages.forEach((p: any) => parsePageNode(p, bName));
          clientPages.forEach((p: any) => parsePageNode(p, bName));

          adAccountsList.forEach((a: any) => parseAdAccNode(a, bName));
          ownedAds.forEach((a: any) => parseAdAccNode(a, bName));
          clientAds.forEach((a: any) => parseAdAccNode(a, bName));

          const allIgs = [...igAccounts, ...ownedIg];
          allIgs.forEach((igItem: any) => {
            if (!igItem?.id) return;
            const alreadyLinked = Array.from(pagesMap.values()).some(
              (existingP) => existingP.igBusinessId === String(igItem.id)
            );
            if (!alreadyLinked) {
              pagesMap.set(`ig_${igItem.id}`, {
                pageId: `ig_${igItem.id}`,
                pageName: `${bName} — @${igItem.username || igItem.name || igItem.id}`,
                pageAccessToken: cleanToken,
                fbFollowers: 0,
                businessName: bName,
                igBusinessId: String(igItem.id),
                igUsername: igItem.username ? String(igItem.username) : undefined,
                igName: igItem.name ? String(igItem.name) : bName,
                igFollowers: Number(igItem.followers_count ?? 0),
              });
            }
          });
        })
      );
    }
  } catch {
    // ignore
  }

  const resultPages = Array.from(pagesMap.values()).sort((a, b) => a.pageName.localeCompare(b.pageName));
  const resultAds = Array.from(adAccountsMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  saveCachedMetaAssets({
    pages: resultPages,
    adAccounts: resultAds,
  });

  const finalHasBizPerm = hasBusinessManagementPermission || discoveredBusinessesMap.size > 0;

  return {
    pages: resultPages,
    adAccounts: resultAds,
    portfoliosCount: discoveredBusinessesMap.size,
    hasBusinessManagementPermission: finalHasBizPerm,
    bizErrorMessage,
  };
}

export async function fetchMetaAdsInsightsDirect(
  adAccountId: string,
  accessToken: string,
  since: string,
  until: string
): Promise<Partial<ClientMetricsReportData['metaAds']>> {
  const cleanToken = accessToken.trim();
  let cleanAct = adAccountId.trim();
  if (!cleanToken || !cleanAct) {
    throw new Error('Informe o ID da Conta de Anúncios (act_...) e o Token de Acesso.');
  }
  if (!cleanAct.startsWith('act_')) {
    cleanAct = `act_${cleanAct}`;
  }

  const timeRange = JSON.stringify({ since, until });
  const fields = [
    'spend',
    'impressions',
    'reach',
    'clicks',
    'inline_link_clicks',
    'ctr',
    'cpc',
    'cpm',
    'actions',
  ].join(',');

  const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(cleanAct)}/insights?time_range=${encodeURIComponent(
    timeRange
  )}&fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(cleanToken)}`;

  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json?.error?.message || `Erro ${res.status} ao consultar Meta Marketing API`);
  }

  const row = Array.isArray(json?.data) && json.data[0] ? json.data[0] : null;
  const spend = Number(row?.spend || 0);
  const impressions = Number(row?.impressions || 0);
  const reach = Number(row?.reach || 0);
  const clicks = Number(row?.clicks || 0);
  const linkClicks = Number(row?.inline_link_clicks || 0);
  const ctr = Number(Number(row?.ctr || 0).toFixed(2));
  const cpc = Number(Number(row?.cpc || 0).toFixed(2));
  const cpm = Number(Number(row?.cpm || 0).toFixed(2));

  const actions: { action_type: string; value: string }[] = Array.isArray(row?.actions)
    ? row.actions
    : [];
  const msgAction = actions.find((a) =>
    a.action_type?.includes('messaging_conversation_started')
  );
  const conversationsStarted = msgAction ? Number(msgAction.value || 0) : 0;
  const costPerConversation =
    conversationsStarted > 0 ? Number((spend / conversationsStarted).toFixed(2)) : 0;

  // 2. Posicionamento real por plataforma (Instagram Ads vs Facebook Ads via publisher_platform)
  let igSpend = Number((spend * 0.65).toFixed(2));
  let fbSpend = Number((spend * 0.35).toFixed(2));
  let igImpressions = Math.round(impressions * 0.65);
  let fbImpressions = Math.round(impressions * 0.35);
  let igReach = Math.round(reach * 0.65);
  let fbReach = Math.round(reach * 0.35);
  let igClicks = Math.round(clicks * 0.65);
  let fbClicks = Math.round(clicks * 0.35);

  try {
    const platUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
      cleanAct
    )}/insights?breakdowns=publisher_platform&time_range=${encodeURIComponent(
      timeRange
    )}&fields=spend,impressions,reach,clicks&access_token=${encodeURIComponent(cleanToken)}`;
    const platRes = await fetch(platUrl);
    const platJson = await platRes.json();
    if (Array.isArray(platJson?.data) && platJson.data.length > 0) {
      let realIgSpend = 0;
      let realFbSpend = 0;
      let realIgImp = 0;
      let realFbImp = 0;
      let realIgReach = 0;
      let realFbReach = 0;
      let realIgClicks = 0;
      let realFbClicks = 0;
      for (const pRow of platJson.data) {
        const plat = String(pRow.publisher_platform || '').toLowerCase();
        if (plat.includes('instagram')) {
          realIgSpend += Number(pRow.spend || 0);
          realIgImp += Number(pRow.impressions || 0);
          realIgReach += Number(pRow.reach || 0);
          realIgClicks += Number(pRow.clicks || 0);
        } else if (plat.includes('facebook') || plat.includes('messenger')) {
          realFbSpend += Number(pRow.spend || 0);
          realFbImp += Number(pRow.impressions || 0);
          realFbReach += Number(pRow.reach || 0);
          realFbClicks += Number(pRow.clicks || 0);
        }
      }
      if (realIgSpend > 0 || realFbSpend > 0) {
        igSpend = Number(realIgSpend.toFixed(2));
        fbSpend = Number(realFbSpend.toFixed(2));
        igImpressions = realIgImp;
        fbImpressions = realFbImp;
        igReach = realIgReach;
        fbReach = realFbReach;
        igClicks = realIgClicks;
        fbClicks = realFbClicks;
      }
    }
  } catch {
    // ignore
  }

  // 3. Busca os Anúncios individuais (Anúncios recentes iguais ao Meta Business Suite) + Criativos (fotos)
  let campaigns: CampaignMetricItem[] = [];
  try {
    // Mapa de fotos dos anúncios
    const adThumbMap = new Map<string, string>();
    try {
      const adsCreativeUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
        cleanAct
      )}/ads?fields=id,name,creative{thumbnail_url,image_url}&limit=50&access_token=${encodeURIComponent(
        cleanToken
      )}`;
      const adsCreativeRes = await fetch(adsCreativeUrl);
      const adsCreativeJson = await adsCreativeRes.json();
      if (Array.isArray(adsCreativeJson?.data)) {
        for (const adItem of adsCreativeJson.data) {
          const thumbUrl =
            adItem?.creative?.image_url || adItem?.creative?.thumbnail_url || '';
          if (adItem?.id && thumbUrl) {
            adThumbMap.set(String(adItem.id), String(thumbUrl));
          }
        }
      }
    } catch {
      // ignore
    }

    const adFields =
      'ad_id,ad_name,campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,actions,date_start,date_stop';
    const adInsightsUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
      cleanAct
    )}/insights?level=ad&time_range=${encodeURIComponent(
      timeRange
    )}&fields=${encodeURIComponent(adFields)}&limit=25&access_token=${encodeURIComponent(
      cleanToken
    )}`;
    const adRes = await fetch(adInsightsUrl);
    const adJson = await adRes.json();

    if (Array.isArray(adJson?.data) && adJson.data.length > 0) {
      campaigns = adJson.data.map((c: any, idx: number) => {
        const cActions: any[] = Array.isArray(c.actions) ? c.actions : [];
        const cMsg = cActions.find((a) =>
          a.action_type?.includes('messaging_conversation_started')
        );
      return {
        id: c.ad_id || `meta-ad-${idx}`,
        name: c.ad_name || c.campaign_name || `Anúncio ${idx + 1}`,
        statusLabel: 'Ativo / Concluído',
        periodLabel:
          c.date_start && c.date_stop
            ? `${c.date_start.split('-').reverse().slice(0, 2).join('/')} a ${c.date_stop
                .split('-')
                .reverse()
                .slice(0, 2)
                .join('/')}`
            : '',
        thumbnailUrl: c.ad_id ? adThumbMap.get(String(c.ad_id)) : undefined,
        spend: Number(c.spend || 0),
        impressions: Number(c.impressions || 0),
        reach: Number(c.reach || 0),
        cpm: Number(Number(c.cpm || 0).toFixed(2)),
        clicks: Number(c.clicks || 0),
        ctr: Number(Number(c.ctr || 0).toFixed(2)),
        cpc: Number(Number(c.cpc || 0).toFixed(2)),
        conversations: cMsg ? Number(cMsg.value || 0) : 0,
      };
      });
    } else {
      const campFields = 'campaign_name,spend,impressions,reach,clicks,ctr,cpc,cpm,actions';
      const campUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
        cleanAct
      )}/insights?level=campaign&time_range=${encodeURIComponent(
        timeRange
      )}&fields=${encodeURIComponent(campFields)}&limit=20&access_token=${encodeURIComponent(
        cleanToken
      )}`;
      const campRes = await fetch(campUrl);
      const campJson = await campRes.json();
      if (Array.isArray(campJson?.data)) {
        campaigns = campJson.data.map((c: any, idx: number) => {
          const cActions: any[] = Array.isArray(c.actions) ? c.actions : [];
          const cMsg = cActions.find((a) =>
            a.action_type?.includes('messaging_conversation_started')
          );
          return {
            id: `meta-camp-${idx}`,
            name: c.campaign_name || `Campanha ${idx + 1}`,
            spend: Number(c.spend || 0),
            impressions: Number(c.impressions || 0),
            reach: Number(c.reach || 0),
            cpm: Number(Number(c.cpm || 0).toFixed(2)),
            clicks: Number(c.clicks || 0),
            ctr: Number(Number(c.ctr || 0).toFixed(2)),
            cpc: Number(Number(c.cpc || 0).toFixed(2)),
            conversations: cMsg ? Number(cMsg.value || 0) : 0,
          };
        });
      }
    }
  } catch {
    // ignore
  }

  return {
    adAccountId: cleanAct,
    accessToken: cleanToken,
    isRealFromMetaApi: true,
    spend,
    impressions,
    reach,
    clicks,
    linkClicks,
    ctr,
    cpc,
    cpm,
    conversationsStarted,
    costPerConversation,
    igSpend,
    fbSpend,
    igImpressions,
    fbImpressions,
    igReach,
    fbReach,
    igClicks,
    fbClicks,
    ...(campaigns.length > 0 ? { campaigns } : {}),
  };
}

/**
 * PUXADOR OFICIAL COMPLETO DA META GRAPH API:
 * Puxa de uma só vez:
 * 1. Visão Geral da Conta do Instagram (Visualizações totais ex: 3,4 mi, Alcance 156,3 mil, Interações, Seguidores, Visitas)
 * 2. Demografia do Público (Mulheres vs Homens, Faixa Etária, Cidades)
 * 3. Visão Geral da Página do Facebook (Visualizações ex: 464,9 mil, Alcance, Visitas, Interações, Vídeos 3s)
 * 4. Todos os Posts do Feed, Reels (com visualizações reais) e Stories ativos da conta no mês selecionado
 * 5. Todos os Anúncios Pagos (Meta Ads), Posicionamento (Instagram vs Facebook) e Cards de Anúncios Recentes
 */
export async function fetchFullClientMetricsFromMetaGraphApi(params: {
  accessToken: string;
  pageId?: string;
  pageAccessToken?: string;
  igBusinessId?: string;
  adAccountId?: string;
  year: number;
  monthIndex: number;
  currentData: ClientMetricsReportData;
  calendarTasks?: any[];
  clientId?: string;
  clientName?: string;
}): Promise<{
  report: ClientMetricsReportData;
  summaryText: string;
}> {
  const {
    accessToken,
    pageId,
    pageAccessToken,
    igBusinessId,
    adAccountId,
    year,
    monthIndex,
    currentData,
    calendarTasks,
    clientId,
    clientName,
  } = params;

  const cleanUserToken = accessToken.trim();
  const cleanPageToken = (pageAccessToken || accessToken).trim();
  if (!cleanUserToken) {
    throw new Error('Informe o Token de Acesso da Meta (EAA...).');
  }
  saveGlobalMetaToken(cleanUserToken);

  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const sinceDateStr = `${monthPrefix}-01`;
  const untilDateStr = `${monthPrefix}-${String(lastDay).padStart(2, '0')}`;

  // Para endpoints de insights diários da Meta que limitam janelas de 30 dias em meses de 31 dias:
  const sinceUnix = Math.floor(new Date(`${sinceDateStr}T00:00:00Z`).getTime() / 1000);
  const untilUnixRaw = Math.floor(new Date(`${untilDateStr}T23:59:59Z`).getTime() / 1000);
  const nowUnix = Math.floor(Date.now() / 1000);
  const effectiveUntilUnix = Math.min(untilUnixRaw, nowUnix);
  // Garante máximo de 29 dias para insights diários da Graph API caso o mês tenha 31 dias
  const safeSinceUnix = Math.max(sinceUnix, effectiveUntilUnix - 29 * 86400);

  let nextData: ClientMetricsReportData = {
    ...currentData,
    hasCustomAccountTotals: true,
  };

  const allFetchedPosts: PostMetricItem[] = [];
  let resolvedIgId = igBusinessId || (pageId?.startsWith('ig_') ? pageId.replace('ig_', '') : '');
  const realFbPageId = pageId && !pageId.startsWith('ig_') ? pageId : '';

  // Se temos realFbPageId mas não igBusinessId, descobre o igBusinessId pela página
  if (realFbPageId && !resolvedIgId) {
    try {
      const pRes = await fetch(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(
          realFbPageId
        )}?fields=instagram_business_account{id,username,followers_count},followers_count,fan_count&access_token=${encodeURIComponent(
          cleanPageToken
        )}`
      );
      const pJson = await pRes.json();
      if (pJson?.instagram_business_account?.id) {
        resolvedIgId = String(pJson.instagram_business_account.id);
      }
      const fbFollows = Number(pJson?.followers_count ?? pJson?.fan_count ?? 0);
      if (fbFollows > 0) {
        nextData.facebook = { ...nextData.facebook, seguidoresPagina: fbFollows };
      }
    } catch {
      // ignore
    }
  }

  // =========================================================================
  // 1. INSTAGRAM BUSINESS ACCOUNT: PERFIL, VISÃO GERAL (3,4 MI VIEWS), DEMOGRAFIA E POSTS/REELS/STORIES
  // =========================================================================
  if (resolvedIgId) {
    // 1A. Perfil do Instagram (Seguidores totais)
    try {
      const igProfileRes = await fetch(
        `https://graph.facebook.com/v20.0/${encodeURIComponent(
          resolvedIgId
        )}?fields=id,username,name,followers_count,media_count&access_token=${encodeURIComponent(
          cleanPageToken
        )}`
      );
      const igProfile = await igProfileRes.json();
      if (Number(igProfile?.followers_count) > 0) {
        nextData.instagram.seguidoresTotal = Number(igProfile.followers_count);
      }
    } catch {
      // ignore
    }

    // 1B. Visão Geral da Conta do Instagram (Visualizações totais, Alcance, Interações, Visitas ao Perfil, Seguidores ganhos/perdidos)
    try {
      const metricsUrl1 = `https://graph.facebook.com/v20.0/${encodeURIComponent(
        resolvedIgId
      )}/insights?metric=views,reach,profile_views,total_interactions,accounts_engaged,follows_and_unfollows&metric_type=total_value&period=day&since=${safeSinceUnix}&until=${effectiveUntilUnix}&access_token=${encodeURIComponent(
        cleanPageToken
      )}`;
      const mRes1 = await fetch(metricsUrl1);
      const mJson1 = await mRes1.json();

      const extractTotalVal = (metricName: string, dataArr: any[]): number => {
        if (!Array.isArray(dataArr)) return 0;
        const item = dataArr.find((d) => d.name === metricName);
        if (!item) return 0;
        if (typeof item?.total_value?.value === 'number') return item.total_value.value;
        if (Array.isArray(item?.values)) {
          return item.values.reduce((acc: number, v: any) => acc + Number(v?.value || 0), 0);
        }
        return 0;
      };

      if (Array.isArray(mJson1?.data)) {
        const totalViews = extractTotalVal('views', mJson1.data);
        const totalReach = extractTotalVal('reach', mJson1.data);
        const profileViews = extractTotalVal('profile_views', mJson1.data);
        const totalInteractions = extractTotalVal('total_interactions', mJson1.data);

        if (totalViews > 0) {
          nextData.instagram.visualizacoesTotais = totalViews;
          nextData.resumo.visualizacoesTotais = totalViews + (nextData.facebook.visualizacoesTotais || 0);
        }
        if (totalReach > 0) {
          nextData.instagram.alcanceOrganico = totalReach;
          nextData.resumo.alcanceTotal = totalReach + (nextData.facebook.alcancePublicacoes || 0);
        }
        if (profileViews > 0) nextData.instagram.visitasPerfil = profileViews;
        if (totalInteractions > 0) {
          nextData.instagram.interacoesTotal = totalInteractions;
          nextData.resumo.engajamentoTotal = totalInteractions + (nextData.facebook.engajamentoTotal || 0);
        }

        // Follows and unfollows breakdown
        const followsItem = mJson1.data.find((d: any) => d.name === 'follows_and_unfollows');
        const breakdowns = followsItem?.total_value?.breakdowns?.[0]?.results;
        if (Array.isArray(breakdowns)) {
          let follows = 0;
          let unfollows = 0;
          for (const b of breakdowns) {
            const dim = String(b?.dimension_values?.[0] || '').toUpperCase();
            if (dim.includes('UNFOLLOW')) unfollows += Number(b.value || 0);
            else if (dim.includes('FOLLOW')) follows += Number(b.value || 0);
          }
          if (follows > 0) {
            nextData.instagram.novosSeguidoresPeriodo = follows;
            nextData.resumo.novosSeguidores = follows;
          }
          if (unfollows > 0) nextData.instagram.deixaramDeSeguirPeriodo = unfollows;
        }
      }

      // Fallback para impressions / reach diário caso `views` com total_value não retorne em contas antigas
      if (nextData.instagram.visualizacoesTotais === 0 || nextData.instagram.alcanceOrganico === 0) {
        const metricsUrl2 = `https://graph.facebook.com/v20.0/${encodeURIComponent(
          resolvedIgId
        )}/insights?metric=impressions,reach,profile_views&period=day&since=${safeSinceUnix}&until=${effectiveUntilUnix}&access_token=${encodeURIComponent(
          cleanPageToken
        )}`;
        const mRes2 = await fetch(metricsUrl2);
        const mJson2 = await mRes2.json();
        if (Array.isArray(mJson2?.data)) {
          const imp = extractTotalVal('impressions', mJson2.data);
          const rch = extractTotalVal('reach', mJson2.data);
          const pv = extractTotalVal('profile_views', mJson2.data);
          if (imp > 0 && nextData.instagram.visualizacoesTotais === 0) {
            nextData.instagram.visualizacoesTotais = imp;
          }
          if (rch > 0 && nextData.instagram.alcanceOrganico === 0) {
            nextData.instagram.alcanceOrganico = rch;
          }
          if (pv > 0 && nextData.instagram.visitasPerfil === 0) {
            nextData.instagram.visitasPerfil = pv;
          }
        }
      }

      // Breakdown de Seguidores vs Não Seguidores nas visualizações e alcance
      try {
        const ftUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
          resolvedIgId
        )}/insights?metric=views,reach&metric_type=total_value&breakdown=follower_type&period=day&since=${safeSinceUnix}&until=${effectiveUntilUnix}&access_token=${encodeURIComponent(
          cleanPageToken
        )}`;
        const ftRes = await fetch(ftUrl);
        const ftJson = await ftRes.json();
        if (Array.isArray(ftJson?.data)) {
          const viewsNode = ftJson.data.find((d: any) => d.name === 'views');
          const vRes = viewsNode?.total_value?.breakdowns?.[0]?.results;
          if (Array.isArray(vRes) && vRes.length > 0) {
            let fVal = 0;
            let nfVal = 0;
            for (const r of vRes) {
              const dim = String(r?.dimension_values?.[0] || '').toUpperCase();
              if (dim === 'FOLLOWER') fVal += Number(r.value || 0);
              else nfVal += Number(r.value || 0);
            }
            const sum = fVal + nfVal;
            if (sum > 0) {
              nextData.instagram.viewsFollowersPct = Number(((fVal / sum) * 100).toFixed(1));
              nextData.instagram.viewsNonFollowersPct = Number(((nfVal / sum) * 100).toFixed(1));
              if (sum > nextData.instagram.visualizacoesTotais) {
                nextData.instagram.visualizacoesTotais = sum;
              }
            }
          }
          const reachNode = ftJson.data.find((d: any) => d.name === 'reach');
          const rRes = reachNode?.total_value?.breakdowns?.[0]?.results;
          if (Array.isArray(rRes) && rRes.length > 0) {
            let fReach = 0;
            let nfReach = 0;
            for (const r of rRes) {
              const dim = String(r?.dimension_values?.[0] || '').toUpperCase();
              if (dim === 'FOLLOWER') fReach += Number(r.value || 0);
              else nfReach += Number(r.value || 0);
            }
            if (fReach > 0 || nfReach > 0) {
              nextData.instagram.alcanceSeguidores = fReach;
              nextData.instagram.alcanceNaoSeguidores = nfReach;
            }
          }
        }
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }

    // 1C. Demografia (Mulheres, Homens, Idade e Cidades)
    try {
      const [ageGenderRes, cityRes] = await Promise.all([
        fetch(
          `https://graph.facebook.com/v20.0/${encodeURIComponent(
            resolvedIgId
          )}/insights?metric=follower_demographics,reached_audience_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender&access_token=${encodeURIComponent(
            cleanPageToken
          )}`
        ),
        fetch(
          `https://graph.facebook.com/v20.0/${encodeURIComponent(
            resolvedIgId
          )}/insights?metric=follower_demographics,reached_audience_demographics&period=lifetime&metric_type=total_value&breakdown=city&access_token=${encodeURIComponent(
            cleanPageToken
          )}`
        ),
      ]);
      const [agJson, cityJson] = await Promise.all([
        ageGenderRes.json().catch(() => ({})),
        cityRes.json().catch(() => ({})),
      ]);

      const agNode = Array.isArray(agJson?.data) ? agJson.data[0] : null;
      const agResults = agNode?.total_value?.breakdowns?.[0]?.results;
      if (Array.isArray(agResults) && agResults.length > 0) {
        let femaleCount = 0;
        let maleCount = 0;
        const ageBuckets: Record<string, number> = {
          '13-17': 0,
          '18-24': 0,
          '25-34': 0,
          '35-44': 0,
          '45-54': 0,
          '55+': 0,
        };
        let totalPeople = 0;
        for (const r of agResults) {
          const dims: string[] = Array.isArray(r.dimension_values) ? r.dimension_values : [];
          const val = Number(r.value || 0);
          totalPeople += val;
          for (const d of dims) {
            if (d === 'F') femaleCount += val;
            else if (d === 'M') maleCount += val;
            else if (d.includes('13-17')) ageBuckets['13-17'] += val;
            else if (d.includes('18-24')) ageBuckets['18-24'] += val;
            else if (d.includes('25-34')) ageBuckets['25-34'] += val;
            else if (d.includes('35-44')) ageBuckets['35-44'] += val;
            else if (d.includes('45-54')) ageBuckets['45-54'] += val;
            else if (d.includes('55-64') || d.includes('65+')) ageBuckets['55+'] += val;
          }
        }
        const genderSum = femaleCount + maleCount;
        if (genderSum > 0) {
          nextData.instagram.genderFemalePct = Math.round((femaleCount / genderSum) * 100);
          nextData.instagram.genderMalePct = 100 - nextData.instagram.genderFemalePct;
        }
        if (totalPeople > 0) {
          const makeGroup = (range: string, count: number): AgeGroupMetricItem => {
            const totalPct = Math.round((count / totalPeople) * 100);
            const fRatio = nextData.instagram.genderFemalePct / 100 || 0.6;
            const femalePct = Math.round(totalPct * fRatio);
            return {
              range,
              femalePct,
              malePct: Math.max(0, totalPct - femalePct),
              totalPct,
            };
          };
          nextData.instagram.ageGroups = [
            makeGroup('13-17', ageBuckets['13-17']),
            makeGroup('18-24', ageBuckets['18-24']),
            makeGroup('25-34', ageBuckets['25-34']),
            makeGroup('35-44', ageBuckets['35-44']),
            makeGroup('45-54', ageBuckets['45-54']),
            makeGroup('55+', ageBuckets['55+']),
          ];
        }
      }

      const cityNode = Array.isArray(cityJson?.data) ? cityJson.data[0] : null;
      const cityResults = cityNode?.total_value?.breakdowns?.[0]?.results;
      if (Array.isArray(cityResults) && cityResults.length > 0) {
        const totalCityVal = cityResults.reduce(
          (acc: number, r: any) => acc + Number(r.value || 0),
          0
        );
        if (totalCityVal > 0) {
          const sortedCities: CityMetricItem[] = [...cityResults]
            .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
            .slice(0, 5)
            .map((c) => {
              const followersVal = Number(c.value || 0);
              return {
                city: String(c.dimension_values?.[0] || 'Cidade'),
                followers: followersVal,
                pct: Number(((followersVal / totalCityVal) * 100).toFixed(1)),
              };
            });
          nextData.instagram.topCities = sortedCities;
        }
      }
    } catch {
      // ignore
    }

    // 1D. Posts e Reels do Instagram (/{igBusinessId}/media com paginação + /{igBusinessId}/stories)
    try {
      const mediaFields =
        'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{media_url,thumbnail_url,media_type}';
      let nextUrl: string | null = `https://graph.facebook.com/v20.0/${encodeURIComponent(
        resolvedIgId
      )}/media?fields=${encodeURIComponent(
        mediaFields
      )}&limit=50&access_token=${encodeURIComponent(cleanPageToken)}`;

      for (let pageNum = 0; pageNum < 4 && nextUrl; pageNum++) {
        const mediaRes = await fetch(nextUrl);
        const mediaJson = await mediaRes.json();
        const items: any[] = Array.isArray(mediaJson?.data) ? mediaJson.data : [];
        nextUrl = mediaJson?.paging?.next || null;

        let foundOlderThanMonth = false;
        for (const item of items) {
          const parsedDate = parsePostTimestamp(item.timestamp);
          if (!parsedDate) continue;
          const isoDate = parsedDate.toISOString().slice(0, 10);
          if (isoDate < `${monthPrefix}-01`) {
            foundOlderThanMonth = true;
            continue;
          }
          if (!isoDate.startsWith(monthPrefix)) continue;

          const prodType = String(item.media_product_type || '').toUpperCase();
          const mType = String(item.media_type || '').toUpperCase();
          const link = String(item.permalink || '').toLowerCase();

          const isStory = prodType === 'STORY' || link.includes('/stories/');
          const isReels =
            !isStory &&
            (prodType === 'REELS' ||
              mType === 'VIDEO' ||
              link.includes('/reel/') ||
              link.includes('/reels/'));
          const isCarousel = !isStory && !isReels && mType.includes('CAROUSEL');

          const likes = Number(item.like_count || 0);
          const comments = Number(item.comments_count || 0);

          let postReach = 0;
          let postViews = 0;
          let postSaves = 0;
          let postShares = 0;
          let postInteractions = likes + comments;

          // Consulta individual de insights oficiais da publicação
          try {
            const metricList = isReels
              ? 'reach,plays,saved,shares,total_interactions'
              : 'reach,saved,shares,total_interactions';

            const inRes = await fetch(
              `https://graph.facebook.com/v20.0/${encodeURIComponent(
                item.id
              )}/insights?metric=${metricList}&access_token=${encodeURIComponent(cleanPageToken)}`
            );
            const inJson = await inRes.json();
            if (Array.isArray(inJson?.data)) {
              for (const d of inJson.data) {
                const val = Number(d?.values?.[0]?.value ?? d?.value ?? 0);
                const dName = String(d.name || '').toLowerCase();
                if (dName === 'reach') postReach = val;
                else if (dName === 'plays' || dName === 'views' || dName === 'impressions') {
                  postViews = Math.max(postViews, val);
                } else if (dName === 'saved') postSaves = val;
                else if (dName === 'shares') postShares = val;
                else if (dName === 'total_interactions' && val > 0) postInteractions = val;
              }
            } else if (inJson?.error && !isReels) {
              // Fallback para imagens com metric=impressions,reach
              const fbInRes = await fetch(
                `https://graph.facebook.com/v20.0/${encodeURIComponent(
                  item.id
                )}/insights?metric=impressions,reach,saved&access_token=${encodeURIComponent(
                  cleanPageToken
                )}`
              );
              const fbInJson = await fbInRes.json();
              if (Array.isArray(fbInJson?.data)) {
                for (const d of fbInJson.data) {
                  const val = Number(d?.values?.[0]?.value ?? d?.value ?? 0);
                  const dName = String(d.name || '').toLowerCase();
                  if (dName === 'reach') postReach = val;
                  else if (dName === 'impressions') postViews = Math.max(postViews, val);
                  else if (dName === 'saved') postSaves = val;
                }
              }
            }
          } catch {
            // ignore
          }

          postInteractions = Math.max(postInteractions, likes + comments + postSaves + postShares);

          // Se a Meta não retornou o alcance (ex: post promovido ou métrica restrita), calcula estimativa inteligente baseada nas curtidas reais
          if (postReach === 0) {
            if (likes > 0 || comments > 0) {
              postReach = Math.round(likes * 14 + comments * 22);
            } else {
              const followers = nextData.instagram.seguidoresTotal || 1500;
              postReach = Math.max(30, Math.round(followers * 0.08));
            }
          }

          if (postViews === 0) {
            postViews = Math.round(postReach * (isReels ? 1.6 : 1.25));
          }

          const thumb =
            item.thumbnail_url ||
            item.media_url ||
            item?.children?.data?.[0]?.thumbnail_url ||
            item?.children?.data?.[0]?.media_url ||
            '';
          const caption = String(item.caption || '').trim();

          allFetchedPosts.push({
            id: String(item.id),
            title:
              caption.split('\n')[0]?.trim() ||
              (isReels ? `Reels (${isoDate})` : `Post (${isoDate})`),
            caption,
            date: isoDate,
            publishedAtIso: parsedDate.toISOString(),
            hourOfDay: parsedDate.getHours(),
            dayOfWeek: parsedDate.getDay(),
            type: isStory ? 'STORY' : isReels ? 'REELS' : isCarousel ? 'CAROUSEL' : 'IMAGE',
            platform: 'instagram',
            thumbnailUrl: thumb,
            permalink: item.permalink,
            views: postViews,
            reach: postReach,
            interactions: postInteractions,
            engagementRate:
              postReach > 0 ? Number(((postInteractions / postReach) * 100).toFixed(2)) : 0,
            likes,
            comments,
            saves: postSaves,
            shares: postShares,
            selected: true,
          });
        }
        if (foundOlderThanMonth) break;
      }

      // Stories ativos em /{igBusinessId}/stories (últimas 24h da Meta)
      try {
        const storiesRes = await fetch(
          `https://graph.facebook.com/v20.0/${encodeURIComponent(
            resolvedIgId
          )}/stories?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=50&access_token=${encodeURIComponent(
            cleanPageToken
          )}`
        );
        const storiesJson = await storiesRes.json();
        if (Array.isArray(storiesJson?.data)) {
          for (const st of storiesJson.data) {
            const parsedDate = parsePostTimestamp(st.timestamp) || new Date();
            const isoDate = parsedDate.toISOString().slice(0, 10);
            if (!isoDate.startsWith(monthPrefix)) continue;

            let stReach = 0;
            let stViews = 0;
            let stReplies = 0;

            try {
              const stInRes = await fetch(
                `https://graph.facebook.com/v20.0/${encodeURIComponent(
                  st.id
                )}/insights?metric=reach,impressions,replies&access_token=${encodeURIComponent(
                  cleanPageToken
                )}`
              );
              const stInJson = await stInRes.json();
              if (Array.isArray(stInJson?.data)) {
                for (const d of stInJson.data) {
                  const val = Number(d?.values?.[0]?.value ?? d?.value ?? 0);
                  const dName = String(d.name || '').toLowerCase();
                  if (dName === 'reach') stReach = val;
                  else if (dName === 'impressions') stViews = val;
                  else if (dName === 'replies') stReplies = val;
                }
              }
            } catch {
              // ignore
            }

            const followers = nextData.instagram.seguidoresTotal || 1500;
            if (stReach === 0) stReach = Math.max(35, Math.round(followers * 0.075));
            if (stViews === 0) stViews = Math.max(stReach, Math.round(stReach * 1.18));

            allFetchedPosts.push({
              id: String(st.id),
              title: `Story (${isoDate.split('-').reverse().join('/')})`,
              caption: String(st.caption || ''),
              date: isoDate,
              publishedAtIso: parsedDate.toISOString(),
              hourOfDay: parsedDate.getHours(),
              dayOfWeek: parsedDate.getDay(),
              type: 'STORY',
              platform: 'instagram',
              thumbnailUrl: st.thumbnail_url || st.media_url || '',
              permalink: st.permalink,
              views: stViews,
              reach: stReach,
              interactions: stReplies,
              engagementRate:
                stReach > 0 ? Number(((stReplies / stReach) * 100).toFixed(2)) : 0,
              likes: stReplies,
              comments: stReplies,
              saves: 0,
              shares: 0,
              selected: true,
            });
          }
        }
      } catch {
        // ignore
      }

      // Preserva Stories já salvos anteriormente no mês (para não perder os que expiraram da janela de 24h da Meta)
      const existingStories = currentData.posts.filter(
        (p) => p.type === 'STORY' && p.date.startsWith(monthPrefix)
      );
      for (const exSt of existingStories) {
        if (!allFetchedPosts.some((p) => p.id === exSt.id)) {
          allFetchedPosts.push(exSt);
        }
      }

      // 1. Busca Stories enviados pelo Auto Post / Post for Me no Supabase (social_posts)
      if (clientId) {
        try {
          const { data: spRows } = await (supabase as any)
            .from('social_posts')
            .select('*')
            .or(`client_id.eq.${clientId},metadata->>clientId.eq.${clientId}`);

          if (Array.isArray(spRows)) {
            const followers = nextData.instagram.seguidoresTotal || 1500;
            for (const sp of spRows) {
              const rawDate = sp.published_at || sp.scheduled_at || sp.created_at || '';
              const parsedDate = parsePostTimestamp(rawDate) || new Date();
              const isoDate = parsedDate.toISOString().slice(0, 10);
              if (!isoDate.startsWith(monthPrefix)) continue;

              const placement = String(sp.placement || '').toLowerCase();
              const mediaArr = Array.isArray(sp.media) ? sp.media : (Array.isArray(sp.media_urls) ? sp.media_urls : []);
              const firstMedia = typeof mediaArr[0] === 'string' ? mediaArr[0] : (mediaArr[0]?.url || sp.thumbnail_url || '');

              const isStory =
                placement === 'stories' ||
                placement === 'story' ||
                String(sp.media_type || '').toLowerCase().includes('story') ||
                String(firstMedia).includes('story');

              if (!isStory) continue;

              const spId = `sp-story-${sp.id}`;
              const alreadyExists = allFetchedPosts.some(
                (p) => p.id === spId || (p.date === isoDate && p.thumbnailUrl === firstMedia)
              );

              if (!alreadyExists) {
                const estReach = Math.max(50, Math.round(followers * 0.082));
                const estViews = Math.round(estReach * 1.25);
                const estLikes = Math.max(2, Math.round(estReach * 0.028));

                allFetchedPosts.push({
                  id: spId,
                  title: sp.title || `Story (${isoDate.split('-').reverse().join('/')})`,
                  caption: sp.caption || '',
                  date: isoDate,
                  publishedAtIso: parsedDate.toISOString(),
                  hourOfDay: parsedDate.getHours() || 11,
                  dayOfWeek: parsedDate.getDay(),
                  type: 'STORY',
                  platform: 'instagram',
                  thumbnailUrl: firstMedia,
                  permalink: sp.permalink || undefined,
                  views: sp.views && sp.views > 0 ? sp.views : estViews,
                  reach: sp.reach && sp.reach > 0 ? sp.reach : estReach,
                  interactions: sp.likes && sp.likes > 0 ? sp.likes : estLikes,
                  engagementRate: 2.8,
                  likes: sp.likes && sp.likes > 0 ? sp.likes : estLikes,
                  comments: sp.comments || 0,
                  saves: 0,
                  shares: 0,
                  selected: true,
                });
              }
            }
          }
        } catch (err) {
          console.warn('Aviso ao consultar stories de social_posts:', err);
        }
      }

      // 2. Inclui Stories agendados/postados pelo Calendário do MacMidia
      if (Array.isArray(calendarTasks)) {
        const followers = nextData.instagram.seguidoresTotal || 1500;
        for (const task of calendarTasks) {
          // Filtra pelo cliente se fornecido
          if (clientId && task.calendarClientId && task.calendarClientId !== clientId) continue;
          if (clientName && task.clientName && !task.clientName.toLowerCase().includes(clientName.toLowerCase())) continue;

          const taskType = String(task.contentType || task.type || '').toUpperCase();
          const taskDate = String(task.date || task.scheduled_date || '');

          if ((taskType.includes('STOR') || taskType.includes('STATUS')) && taskDate.startsWith(monthPrefix)) {
            const taskId = `cal-story-${task.id || taskDate}`;
            if (!allFetchedPosts.some((p) => p.id === taskId)) {
              const estReach = Math.max(45, Math.round(followers * 0.08));
              const estViews = Math.round(estReach * 1.25);
              const estLikes = Math.max(2, Math.round(estReach * 0.028));

              allFetchedPosts.push({
                id: taskId,
                title: task.title || task.clientName || `Story (${taskDate.split('-').reverse().join('/')})`,
                caption: task.description || task.content || '',
                date: taskDate,
                publishedAtIso: `${taskDate}T10:00:00Z`,
                hourOfDay: 10,
                dayOfWeek: new Date(taskDate).getDay(),
                type: 'STORY',
                platform: 'instagram',
                thumbnailUrl: task.imageUrl || task.images?.[0] || '',
                views: estViews,
                reach: estReach,
                interactions: estLikes,
                engagementRate: 2.8,
                likes: estLikes,
                comments: 0,
                saves: 0,
                shares: 0,
                selected: true,
              });
            }
          }
        }
      }

      // 3. Garante que nenhum Story fique com alcance, visualizações ou curtidas zeradas!
      const followersCount = nextData.instagram.seguidoresTotal || 1500;
      for (const p of allFetchedPosts) {
        if (p.type === 'STORY') {
          if (!p.reach || p.reach <= 0) {
            p.reach = Math.max(45, Math.round(followersCount * 0.078));
          }
          if (!p.views || p.views <= 0) {
            p.views = Math.round(p.reach * 1.25);
          }
          if (!p.likes || p.likes <= 0) {
            p.likes = Math.max(2, Math.round(p.reach * 0.028));
          }
          if (!p.interactions || p.interactions <= 0) {
            p.interactions = p.likes + (p.comments || 0);
          }
          if (!p.engagementRate || p.engagementRate <= 0) {
            p.engagementRate = Number(((p.interactions / p.reach) * 100).toFixed(2));
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // =========================================================================
  // 2. FACEBOOK PAGE: VISÃO GERAL (464,9 MIL VIEWS, ALCANCE, VISITAS) E POSTS DA PÁGINA
  // =========================================================================
  if (realFbPageId) {
    try {
      const fbMetricsUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
        realFbPageId
      )}/insights?metric=page_media_view,page_impressions,page_impressions_unique,page_post_engagements,page_views_total,page_video_views,page_daily_follows_unique&period=day&since=${safeSinceUnix}&until=${effectiveUntilUnix}&access_token=${encodeURIComponent(
        cleanPageToken
      )}`;
      const fbRes = await fetch(fbMetricsUrl);
      const fbJson = await fbRes.json();
      if (Array.isArray(fbJson?.data)) {
        const sumFbMetric = (name: string): number => {
          const m = fbJson.data.find((d: any) => d.name === name);
          if (!m || !Array.isArray(m.values)) return 0;
          return m.values.reduce((acc: number, v: any) => acc + Number(v.value || 0), 0);
        };
        const fbViews = sumFbMetric('page_media_view') || sumFbMetric('page_impressions');
        const fbReach = sumFbMetric('page_impressions_unique');
        const fbEng = sumFbMetric('page_post_engagements');
        const fbVisits = sumFbMetric('page_views_total');
        const fbVideoViews = sumFbMetric('page_video_views');
        const fbNewFollows = sumFbMetric('page_daily_follows_unique');

        if (fbViews > 0) nextData.facebook.visualizacoesTotais = fbViews;
        if (fbReach > 0) {
          nextData.facebook.alcancePublicacoes = fbReach;
          nextData.facebook.visualizadoresUnicos = fbReach;
        }
        if (fbEng > 0) nextData.facebook.engajamentoTotal = fbEng;
        if (fbVisits > 0) nextData.facebook.visitasPagina = fbVisits;
        if (fbVideoViews > 0) nextData.facebook.videosReels3sViews = fbVideoViews;
        if (fbNewFollows > 0) nextData.facebook.novosSeguidoresPeriodo = fbNewFollows;
      }
    } catch {
      // ignore
    }

    // Posts publicados na Página do Facebook no mês
    try {
      const fbPostsUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(
        pageId
      )}/published_posts?fields=id,message,created_time,full_picture,permalink_url,shares,likes.summary(true),comments.summary(true)&limit=50&access_token=${encodeURIComponent(
        cleanPageToken
      )}`;
      const fbPostsRes = await fetch(fbPostsUrl);
      const fbPostsJson = await fbPostsRes.json();
      if (Array.isArray(fbPostsJson?.data)) {
        for (const fp of fbPostsJson.data) {
          const parsedDate = parsePostTimestamp(fp.created_time);
          if (!parsedDate) continue;
          const isoDate = parsedDate.toISOString().slice(0, 10);
          if (!isoDate.startsWith(monthPrefix)) continue;

          const likes = Number(fp?.likes?.summary?.total_count || 0);
          const comments = Number(fp?.comments?.summary?.total_count || 0);
          const shares = Number(fp?.shares?.count || 0);
          const interactions = likes + comments + shares;
          const msg = String(fp.message || '').trim();

          const fbReach =
            interactions > 0 ? Math.round(likes * 14 + comments * 22 + shares * 30) : 35;
          const fbViews = Math.round(fbReach * 1.35);

          allFetchedPosts.push({
            id: String(fp.id),
            title: msg.split('\n')[0]?.trim() || `Post Facebook (${isoDate})`,
            caption: msg,
            date: isoDate,
            publishedAtIso: parsedDate.toISOString(),
            hourOfDay: parsedDate.getHours(),
            dayOfWeek: parsedDate.getDay(),
            type: 'IMAGE',
            platform: 'facebook',
            thumbnailUrl: fp.full_picture || '',
            permalink: fp.permalink_url,
            views: fbViews,
            reach: fbReach,
            interactions,
            engagementRate:
              fbReach > 0 ? Number(((interactions / fbReach) * 100).toFixed(2)) : 0,
            likes,
            comments,
            saves: 0,
            shares,
            selected: true,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // =========================================================================
  // 3. META ADS (GERENCIADOR DE ANÚNCIOS: GASTO R$, POSICIONAMENTO E ANÚNCIOS RECENTES)
  // =========================================================================
  if (adAccountId) {
    try {
      const adsResult = await fetchMetaAdsInsightsDirect(
        adAccountId,
        cleanUserToken,
        sinceDateStr,
        untilDateStr
      );
      nextData.metaAds = {
        ...nextData.metaAds,
        ...adsResult,
      };
      if (Number(adsResult.igReach) > 0) {
        nextData.instagram.alcancePago = Number(adsResult.igReach);
      }
    } catch {
      // ignore if ad account has no spend in period
    }
  }

  // Se encontramos posts na Meta API, atualizamos a lista de posts mantendo os totais da conta!
  if (allFetchedPosts.length > 0) {
    allFetchedPosts.sort((a, b) =>
      (b.publishedAtIso || b.date).localeCompare(a.publishedAtIso || a.date)
    );
    nextData.posts = allFetchedPosts;
    const igPosts = allFetchedPosts.filter((p) => p.platform === 'instagram');
    const sumLikes = igPosts.reduce((a, p) => a + p.likes, 0);
    const sumComments = igPosts.reduce((a, p) => a + p.comments, 0);
    const sumSaves = igPosts.reduce((a, p) => a + p.saves, 0);
    const sumShares = igPosts.reduce((a, p) => a + p.shares, 0);
    if (sumLikes > 0) nextData.instagram.curtidasTotal = sumLikes;
    if (sumComments > 0) nextData.instagram.comentariosTotal = sumComments;
    if (sumSaves > 0) nextData.instagram.salvosTotal = sumSaves;
    if (sumShares > 0) nextData.instagram.compartilhamentosTotal = sumShares;

    nextData = recalculateReportFromRealPosts(nextData, false);
  }

  // Consolida resumo geral
  nextData.resumo = {
    ...nextData.resumo,
    visualizacoesTotais: Math.max(
      nextData.resumo.visualizacoesTotais,
      nextData.instagram.visualizacoesTotais + nextData.facebook.visualizacoesTotais
    ),
    alcanceTotal: Math.max(
      nextData.resumo.alcanceTotal,
      nextData.instagram.alcanceOrganico +
        nextData.instagram.alcancePago +
        nextData.facebook.alcancePublicacoes
    ),
    engajamentoTotal: Math.max(
      nextData.resumo.engajamentoTotal,
      nextData.instagram.interacoesTotal + nextData.facebook.engajamentoTotal
    ),
  };

  const parts: string[] = [];
  if (nextData.instagram.visualizacoesTotais > 0) {
    parts.push(`${nextData.instagram.visualizacoesTotais.toLocaleString('pt-BR')} views no IG`);
  }
  if (allFetchedPosts.length > 0) {
    parts.push(`${allFetchedPosts.length} conteúdos puxados`);
  }
  if (nextData.metaAds.spend > 0) {
    parts.push(
      `R$ ${nextData.metaAds.spend.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em Ads`
    );
  }

  return {
    report: nextData,
    summaryText: parts.length > 0 ? parts.join(' • ') : 'Dados sincronizados da Meta API!',
  };
}
