import { supabase } from '@/integrations/supabase/client';

/**
 * Adaptador do provedor de postagem (Post for Me).
 *
 * 1. Usa o proxy `/api/postforme` (configurado no Vite e na Vercel) apontando para
 *    `https://api.postforme.dev/v1` com a chave salva em `settings` / `localStorage`.
 * 2. Se um card tiver imagem em `data:` ou `blob:`, faz upload automático para o
 *    bucket público `kanban_assets` antes de enviar ao Post for Me.
 * 3. Consulta `/social-post-results` para confirmar se o Instagram publicou com sucesso
 *    (salvando o link direto do post) ou se a Meta retornou algum erro.
 */

const POSTFORME_PROXY_URL = '/api/postforme';
const POSTFORME_BASE_URL = 'https://api.postforme.dev/v1';
const LOCAL_API_KEY_STORAGE = 'macmidia_postforme_api_key';

export interface PostForMeAccount {
  id: string;
  platform: string;
  username?: string;
  name?: string;
  user_id?: string;
  profile_picture_url?: string;
  external_id?: string;
  status?: string;
}

export interface ProviderResult<T = Record<string, unknown>> {
  ok: boolean;
  code?: string;
  message?: string;
  data?: T;
}

function normalizeStr(val?: string): string {
  return (val || '')
    .trim()
    .replace(/^@/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export async function getStoredPostForMeApiKey(): Promise<string | null> {
  const localKey = localStorage.getItem(LOCAL_API_KEY_STORAGE);
  try {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'postforme_api_key')
      .maybeSingle();
    if (data?.value && data.value.trim()) {
      localStorage.setItem(LOCAL_API_KEY_STORAGE, data.value.trim());
      return data.value.trim();
    }
  } catch {
    // ignore
  }
  return localKey && localKey.trim() ? localKey.trim() : null;
}

export async function savePostForMeApiKey(apiKey: string): Promise<boolean> {
  const clean = apiKey.trim();
  if (clean) {
    localStorage.setItem(LOCAL_API_KEY_STORAGE, clean);
  } else {
    localStorage.removeItem(LOCAL_API_KEY_STORAGE);
  }

  try {
    const { error } = await supabase.from('settings').upsert({
      key: 'postforme_api_key',
      value: clean,
    });
    if (error) {
      console.warn('Aviso ao salvar postforme_api_key no banco (salvo localmente):', error);
    }
    return true;
  } catch {
    return true;
  }
}

async function directPostForMeRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; message?: string }> {
  const apiKey = await getStoredPostForMeApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      message: 'Chave da API Post for Me ainda não configurada.',
    };
  }

  try {
    let res = await fetch(`${POSTFORME_PROXY_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json') && res.status === 404) {
      res = await fetch(`${POSTFORME_BASE_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detailStr =
        Array.isArray(json?.errors)
          ? json.errors
              .map((e: any) =>
                typeof e === 'string' ? e : e?.message || JSON.stringify(e)
              )
              .join('; ')
          : typeof json?.details === 'string'
            ? json.details
            : Array.isArray(json?.details)
              ? json.details.map((d: any) => d?.message || JSON.stringify(d)).join('; ')
              : '';
      const baseMsg =
        (Array.isArray(json?.message) ? json.message.join(', ') : json?.message) ||
        json?.error?.message ||
        (typeof json?.error === 'string' ? json.error : '') ||
        `Erro ${res.status} retornado pelo Post for Me.`;
      const errMsg = detailStr ? `${baseMsg}: ${detailStr}` : baseMsg;
      return {
        ok: false,
        status: res.status,
        message: errMsg,
      };
    }

    return { ok: true, status: res.status, data: json as T };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      message: err?.message || 'Erro de rede ao comunicar com Post for Me.',
    };
  }
}

const VIDEO_URL_RE = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?|#|$)/i;

/**
 * Quando uma arte de Feed (ex: 4:5 1080x1350 ou 1:1 1080x1080) é enviada para o Stories,
 * o Instagram corta as laterais se ela não estiver na proporção 9:16 (1080x1920).
 * Esta função verifica a proporção da imagem e, se não for 9:16, encaixa a arte inteira
 * centralizada num canvas 1080x1920 com fundo degradê/suave extraído das próprias cores
 * do topo e da base da arte (igual ao comportamento nativo do Instagram Stories).
 */
async function formatImageForStory9x16(rawUrl: string, index: number): Promise<string | null> {
  if (!rawUrl || VIDEO_URL_RE.test(rawUrl) || rawUrl.startsWith('data:video/')) {
    return null;
  }

  let objectUrl: string | null = null;
  try {
    let img: HTMLImageElement;

    // Tenta primeiro carregar via fetch para Blob (evita problemas de cache e canvas tainting)
    try {
      const fetched = await fetch(rawUrl);
      if (fetched.ok) {
        const blob = await fetched.blob();
        if (blob.type && blob.type.startsWith('video/')) {
          return null;
        }
        objectUrl = URL.createObjectURL(blob);
        img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = err => reject(err);
          el.src = objectUrl!;
        });
      } else {
        throw new Error(`Fetch status ${fetched.status}`);
      }
    } catch {
      // Fallback: carregar diretamente com crossOrigin anonymous
      img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = err => reject(err);
        el.src = rawUrl;
      });
    }

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return null;

    const ratio = w / h;
    // Proporção padrão de Story é 9:16 = 0.5625.
    // Se já estiver entre 0.52 e 0.60, já é formato Story vertical nativo — mantém o original.
    if (ratio >= 0.52 && ratio <= 0.60 && /^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    const TARGET_W = 1080;
    const TARGET_H = 1920;

    // Extrai a cor média do topo e da base da imagem para criar o degradê de fundo igual ao Instagram
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 32;
    sampleCanvas.height = 32;
    const sampleCtx = sampleCanvas.getContext('2d');
    let topColor = 'rgb(24, 24, 28)';
    let bottomColor = 'rgb(24, 24, 28)';

    if (sampleCtx) {
      sampleCtx.drawImage(img, 0, 0, 32, 32);
      const imgData = sampleCtx.getImageData(0, 0, 32, 32).data;
      const avgRowRange = (yStart: number, yEnd: number) => {
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let y = yStart; y < yEnd; y++) {
          for (let x = 0; x < 32; x++) {
            const idx = (y * 32 + x) * 4;
            r += imgData[idx];
            g += imgData[idx + 1];
            b += imgData[idx + 2];
            count++;
          }
        }
        if (!count) return 'rgb(24, 24, 28)';
        return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
      };
      topColor = avgRowRange(0, 4);
      bottomColor = avgRowRange(28, 32);
    }

    const canvas = document.createElement('canvas');
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Preenche o fundo 1080x1920 com degradê suave das cores do topo e da base da arte
    const grad = ctx.createLinearGradient(0, 0, 0, TARGET_H);
    grad.addColorStop(0, topColor);
    grad.addColorStop(0.5, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TARGET_W, TARGET_H);

    // 2. Camada suavemente desfocada para transição natural das cores da arte no topo e base
    try {
      ctx.save();
      ctx.filter = 'blur(55px)';
      ctx.globalAlpha = 0.45;
      ctx.drawImage(img, -40, -40, TARGET_W + 80, TARGET_H + 80);
      ctx.restore();
    } catch {
      // Caso o navegador não suporte ctx.filter, o degradê já garante o fundo
    }

    // 3. Desenha a arte inteira (sem cortar nada nas laterais!) centralizada no Story 1080x1920
    const scale = Math.min(TARGET_W / w, TARGET_H / h);
    const drawW = Math.round(w * scale);
    const drawH = Math.round(h * scale);
    const drawX = Math.round((TARGET_W - drawW) / 2);
    const drawY = Math.round((TARGET_H - drawH) / 2);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    const outBlob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', 0.94)
    );
    if (!outBlob) return null;

    const filePath = `social/story_9x16_${Date.now()}_${index}_${Math.random()
      .toString(36)
      .slice(2, 7)}.jpg`;
    const { error: upErr } = await supabase.storage
      .from('kanban_assets')
      .upload(filePath, outBlob, { upsert: true, contentType: 'image/jpeg' });

    if (!upErr) {
      const { data: pub } = supabase.storage.from('kanban_assets').getPublicUrl(filePath);
      if (pub?.publicUrl) {
        return pub.publicUrl;
      }
    }
  } catch (e) {
    console.warn('Aviso ao formatar imagem para Story 9:16 (usando original):', e);
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return null;
}

/**
 * Garante que todas as imagens enviadas ao Post for Me sejam URLs públicas `https://`.
 * Caso alguma imagem esteja em `data:image/...` ou `blob:...`, faz upload automático
 * para o bucket público `kanban_assets` do Supabase.
 * Quando `placement === 'stories'`, adapta automaticamente artes quadradas/4:5 para 9:16 (1080x1920)
 * sem cortar as bordas!
 */
async function ensurePublicMediaUrls(
  mediaUrls: string[],
  placement?: string
): Promise<string[]> {
  const result: string[] = [];

  for (let i = 0; i < mediaUrls.length; i++) {
    const raw = (mediaUrls[i] || '').trim();
    if (!raw) continue;

    if (placement === 'stories') {
      const storyUrl = await formatImageForStory9x16(raw, i);
      if (storyUrl) {
        result.push(storyUrl);
        continue;
      }
    }

    if (/^https?:\/\//i.test(raw)) {
      result.push(raw);
      continue;
    }

    if (raw.startsWith('data:') || raw.startsWith('blob:')) {
      try {
        const fetched = await fetch(raw);
        const blob = await fetched.blob();
        const ext = (blob.type.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
        const filePath = `social/auto_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('kanban_assets')
          .upload(filePath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
        if (!upErr) {
          const { data: pub } = supabase.storage.from('kanban_assets').getPublicUrl(filePath);
          if (pub?.publicUrl) {
            result.push(pub.publicUrl);
            continue;
          }
        }
      } catch (e) {
        console.warn('Falha ao converter imagem local para URL pública:', e);
      }
    }
  }

  return result;
}

async function fetchAllConnectedAccounts(searchUsername?: string): Promise<{
  ok: boolean;
  accounts: PostForMeAccount[];
  message?: string;
}> {
  const extractList = (payload: any): PostForMeAccount[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.accounts)) return payload.accounts;
    return [];
  };

  const collected: PostForMeAccount[] = [];
  const addUnique = (items: PostForMeAccount[]): number => {
    let added = 0;
    for (const item of items) {
      if (item && item.id && !collected.some(x => x.id === item.id)) {
        collected.push(item);
        added++;
      }
    }
    return added;
  };

  // 1. Se temos um username/termo específico para buscar, consulta direto na API também
  if (searchUsername) {
    const clean = searchUsername.trim().replace(/^@/, '');
    if (clean) {
      const byUserRes = await directPostForMeRequest<any>(
        `/social-accounts?username=${encodeURIComponent(clean)}&limit=100`,
        { method: 'GET' }
      );
      if (byUserRes.ok) {
        addUnique(extractList(byUserRes.data));
      } else {
        const byUserFallback = await directPostForMeRequest<any>(
          `/social-accounts?username=${encodeURIComponent(clean)}`,
          { method: 'GET' }
        );
        if (byUserFallback.ok) {
          addUnique(extractList(byUserFallback.data));
        }
      }
    }
  }

  // Função auxiliar para buscar TODAS as páginas (acima de 100 contas!) usando offset
  const fetchPaginated = async (baseQuery: string) => {
    const pageSize = 100;
    for (let page = 0; page < 10; page++) {
      const offset = page * pageSize;
      const sep = baseQuery.includes('?') ? '&' : '?';
      const url = `${baseQuery}${sep}limit=${pageSize}&offset=${offset}`;
      const res = await directPostForMeRequest<any>(url, { method: 'GET' });
      if (!res.ok) {
        if (page === 0) {
          const fallbackRes = await directPostForMeRequest<any>(baseQuery, { method: 'GET' });
          if (fallbackRes.ok) {
            addUnique(extractList(fallbackRes.data));
          }
        }
        break;
      }
      const list = extractList(res.data);
      const added = addUnique(list);
      // Se retornou menos que 100 itens ou não adicionou nenhum item novo, chegamos na última página
      if (list.length < pageSize || added === 0) {
        break;
      }
    }
  };

  // 2. Busca todas as páginas gerais + Instagram + Facebook (para suportar 200, 300+ contas!)
  await fetchPaginated('/social-accounts');
  await fetchPaginated('/social-accounts?platform=instagram');
  await fetchPaginated('/social-accounts?platform=facebook');

  return { ok: true, accounts: collected };
}

async function call<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<ProviderResult<T>> {
  const apiKey = await getStoredPostForMeApiKey();
  if (!apiKey) {
    return {
      ok: false,
      code: 'not_configured',
      message:
        'A chave da API Post for Me ainda não foi cadastrada. Clique em "API Ativa / Chave API" no topo para colar sua chave.',
    };
  }

  if (action === 'connect_link') {
    const res = await directPostForMeRequest<{ url: string }>('/social-accounts/auth-url', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'instagram',
        external_id: payload.clientId || undefined,
      }),
    });

    if (!res.ok || !res.data?.url) {
      return {
        ok: false,
        message: res.message || 'Não foi possível gerar o link OAuth do Instagram.',
      };
    }
    return { ok: true, data: { url: res.data.url } as unknown as T };
  }

  if (action === 'list_accounts') {
    const search = payload.search ? String(payload.search) : undefined;
    const listRes = await fetchAllConnectedAccounts(search);
    if (!listRes.ok) {
      return { ok: false, message: listRes.message };
    }
    return { ok: true, data: { accounts: listRes.accounts } as unknown as T };
  }

  if (action === 'sync_account') {
    const clientId = String(payload.clientId || '');
    const listRes = await fetchAllConnectedAccounts();
    if (!listRes.ok) {
      return { ok: false, message: listRes.message };
    }
    const igAccounts = listRes.accounts.filter(a =>
      String(a.platform || '').toLowerCase().includes('instagram')
    );
    const pool = igAccounts.length > 0 ? igAccounts : listRes.accounts;
    const matched = pool.find(a => a.external_id === clientId) || pool[0];
    if (!matched) {
      return {
        ok: false,
        message: 'Nenhuma conta Instagram conectada encontrada lá no Post for Me ainda.',
      };
    }
    const handle = matched.username
      ? matched.username.startsWith('@')
        ? matched.username
        : `@${matched.username}`
      : undefined;
    return {
      ok: true,
      data: {
        connected: true,
        accountId: matched.id,
        username: handle,
      } as unknown as T,
    };
  }

  if (action === 'publish_direct') {
    const {
      socialAccountId,
      instagramUsername,
      facebookAccountId,
      facebookPageName,
      targetNetworks,
      caption,
      media,
      placement,
      scheduledAt,
    } = payload as {
      socialAccountId: string;
      instagramUsername?: string;
      facebookAccountId?: string;
      facebookPageName?: string;
      targetNetworks?: ('instagram' | 'facebook')[];
      caption?: string;
      media: string[];
      placement: 'feed' | 'stories' | 'reels';
      scheduledAt?: string;
    };

    const networks =
      Array.isArray(targetNetworks) && targetNetworks.length > 0
        ? targetNetworks
        : ['instagram' as const];

    const listRes = await fetchAllConnectedAccounts(
      instagramUsername || facebookPageName || socialAccountId
    );
    if (!listRes.ok) {
      return {
        ok: false,
        message:
          listRes.message ||
          'Não foi possível consultar suas contas no Post for Me. Verifique sua Chave de API.',
      };
    }

    const accounts = listRes.accounts;
    const targetAccountIds: string[] = [];

    // 1. Resolve Instagram se selecionado
    if (networks.includes('instagram')) {
      let resolvedIgId = (socialAccountId || '').trim();
      let validIg = resolvedIgId.startsWith('spc_') || resolvedIgId.startsWith('sa_');

      const igAccounts = accounts.filter(a =>
        String(a.platform || (a as any).provider || '')
          .toLowerCase()
          .includes('instagram')
      );

      const cleanHandle = normalizeStr(instagramUsername);
      const cleanId = normalizeStr(resolvedIgId);

      const matchedIg = igAccounts.find(a => {
        const aId = normalizeStr(a.id);
        const aUserId = normalizeStr(a.user_id);
        const aUsername = normalizeStr(a.username);
        const aName = normalizeStr(a.name);
        return (
          (cleanId && (aId === cleanId || aUserId === cleanId || aUsername === cleanId)) ||
          (cleanHandle &&
            (aUsername === cleanHandle ||
              aName === cleanHandle ||
              aUserId === cleanHandle ||
              aUsername.includes(cleanHandle) ||
              cleanHandle.includes(aUsername)))
        );
      });

      if (matchedIg?.id) {
        resolvedIgId = matchedIg.id;
        validIg = true;
      }

      if (validIg && resolvedIgId) {
        targetAccountIds.push(resolvedIgId);
      } else if (networks.length === 1) {
        const sampleNames = igAccounts
          .slice(0, 5)
          .map(a => `@${a.username || a.name}`)
          .join(', ');
        return {
          ok: false,
          message: `Não encontramos a conta do Instagram "${instagramUsername || socialAccountId || ''}" no Post for Me.${
            sampleNames ? ` Contas disponíveis: ${sampleNames}` : ''
          }`,
        };
      }
    }

    // 2. Resolve Facebook se selecionado
    if (networks.includes('facebook')) {
      let resolvedFbId = (facebookAccountId || '').trim();
      let validFb = resolvedFbId.startsWith('spc_') || resolvedFbId.startsWith('sa_');

      const fbAccounts = accounts.filter(a =>
        String(a.platform || (a as any).provider || '')
          .toLowerCase()
          .includes('facebook')
      );

      const cleanFbName = normalizeStr(facebookPageName);
      const cleanFbId = normalizeStr(resolvedFbId);

      const matchedFb = fbAccounts.find(a => {
        const aId = normalizeStr(a.id);
        const aUserId = normalizeStr(a.user_id);
        const aUsername = normalizeStr(a.username);
        const aName = normalizeStr(a.name);
        return (
          (cleanFbId && (aId === cleanFbId || aUserId === cleanFbId || aUsername === cleanFbId)) ||
          (cleanFbName &&
            (aUsername === cleanFbName ||
              aName === cleanFbName ||
              aUsername.includes(cleanFbName) ||
              aName.includes(cleanFbName) ||
              cleanFbName.includes(aUsername)))
        );
      });

      if (matchedFb?.id) {
        resolvedFbId = matchedFb.id;
        validFb = true;
      }

      if (validFb && resolvedFbId && !targetAccountIds.includes(resolvedFbId)) {
        targetAccountIds.push(resolvedFbId);
      } else if (networks.length === 1) {
        return {
          ok: false,
          message: `Não encontramos a página do Facebook "${facebookPageName || facebookAccountId || ''}" no Post for Me. Selecione a página do Facebook na aba do cliente em Contas Instagram.`,
        };
      }
    }

    if (targetAccountIds.length === 0) {
      return {
        ok: false,
        message:
          'Nenhuma conta válida de Instagram ou Facebook foi encontrada para enviar esta postagem.',
      };
    }

    const publicMediaUrls = await ensurePublicMediaUrls(media || [], placement);
    if (publicMediaUrls.length === 0) {
      return {
        ok: false,
        message: 'Nenhuma imagem com URL pública válida para enviar.',
      };
    }

    const placementMap: Record<string, string> = {
      feed: 'timeline',
      stories: 'stories',
      reels: 'reels',
    };

    const isScheduled =
      Boolean(scheduledAt) && new Date(scheduledAt!).getTime() > Date.now() + 30_000;

    // O validador do Post for Me rejeita string vazia "" com "caption is required".
    // Para Stories (ou post sem legenda), enviamos primeiro um espaço em branco ' ' (que passa no
    // check `if (!caption)` do Post for Me e é ignorado/limpo pela Meta sem criar balão no Story).
    // Caso o validador exija caractere não-espaço no `.trim()`, fazemos fallback automático para
    // Zero-Width Space ('\u200B'), que é 100% invisível e não cria palavra visível no Story.
    const safeCaption =
      placement === 'stories'
        ? ' '
        : caption && caption.trim().length > 0
          ? caption.trim()
          : ' ';

    const platformConfigs: Record<string, unknown> = {};
    if (networks.includes('instagram')) {
      platformConfigs.instagram = {
        placement: placementMap[placement] || 'timeline',
      };
    }
    if (networks.includes('facebook')) {
      platformConfigs.facebook = {
        placement: placementMap[placement] || 'timeline',
      };
    }

    const body: Record<string, unknown> = {
      caption: safeCaption,
      social_accounts: targetAccountIds,
      media: publicMediaUrls.map(url => ({ url })),
      platform_configurations: platformConfigs,
    };

    if (isScheduled && scheduledAt) {
      body.scheduled_at = new Date(scheduledAt).toISOString();
    }

    let res = await directPostForMeRequest<{ id?: string; status?: string }>('/social-posts', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Se o Post for Me fez `.trim()` no espaço simples e pediu caption, reenvia com caractere invisível Zero-Width Space
    if (!res.ok && res.status === 400 && safeCaption === ' ') {
      body.caption = '\u200B';
      res = await directPostForMeRequest<{ id?: string; status?: string }>('/social-posts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    }

    if (!res.ok) {
      return {
        ok: false,
        message: res.message || 'Falha ao enviar postagem para o Post for Me.',
      };
    }

    const providerPostId = res.data?.id;

    // Se for publicação imediata, aguarda alguns segundos e já verifica no Post for Me
    if (!isScheduled && providerPostId) {
      await new Promise(r => setTimeout(r, 4000));
      const check = await checkProviderPostStatus(providerPostId);
      if (check.status === 'erro') {
        return {
          ok: false,
          message: check.errorMessage || 'A rede social recusou a publicação.',
        };
      }
      return {
        ok: true,
        data: {
          id: providerPostId,
          status: 'postado',
          permalink: check.permalink,
          resolvedAccountId: targetAccountIds[0],
        } as unknown as T,
      };
    }

    return {
      ok: true,
      data: {
        id: providerPostId,
        status: isScheduled ? 'programado' : 'postado',
        resolvedAccountId: targetAccountIds[0],
      } as unknown as T,
    };
  }

  if (action === 'delete_remote_post') {
    const providerPostId = String(payload.providerPostId || '');
    if (!providerPostId) {
      return { ok: false, message: 'ID do post no provedor não informado.' };
    }
    const delRes = await directPostForMeRequest(
      `/social-posts/${encodeURIComponent(providerPostId)}`,
      { method: 'DELETE' }
    );
    if (!delRes.ok) {
      return {
        ok: false,
        message:
          delRes.message ||
          'Post já publicado no feed (a API da Meta só permite excluir posts agendados; para apagar do feed publicado, abra o post no Instagram).',
      };
    }
    return { ok: true, data: {} as T };
  }

  if (action === 'check_post_status') {
    const providerPostId = String(payload.providerPostId || '');
    if (!providerPostId) {
      return { ok: false, message: 'ID do post no provedor não informado.' };
    }
    const res = await checkProviderPostStatus(providerPostId);
    return { ok: true, data: res as unknown as T };
  }

  return {
    ok: false,
    code: 'unsupported_action',
    message: `Ação ${action} requer execução direta.`,
  };
}

async function checkProviderPostStatus(providerPostId: string): Promise<{
  status: 'programado' | 'publicando' | 'postado' | 'erro';
  permalink?: string;
  errorMessage?: string;
}> {
  // 1. Consulta resultados detalhados por plataforma (/social-post-results)
  const resultsRes = await directPostForMeRequest<{ data?: any[] }>(
    `/social-post-results?social_post_id=${encodeURIComponent(providerPostId)}`,
    { method: 'GET' }
  );

  if (resultsRes.ok) {
    const items: any[] = Array.isArray(resultsRes.data?.data)
      ? resultsRes.data!.data!
      : Array.isArray(resultsRes.data)
        ? (resultsRes.data as any[])
        : [];

    if (items.length > 0) {
      const failed = items.find(
        item =>
          item.success === false ||
          item.status === 'failed' ||
          item.status === 'error' ||
          Boolean(item.error)
      );
      if (failed) {
        const errDetail =
          failed?.error?.message ||
          failed?.error_message ||
          (typeof failed?.error === 'string' ? failed.error : '') ||
          failed?.message ||
          'Erro retornado pelo Instagram ao publicar a mídia.';
        return {
          status: 'erro',
          errorMessage: errDetail,
        };
      }

      const succeeded = items.find(
        item =>
          item.success === true ||
          item.status === 'published' ||
          item.status === 'success' ||
          Boolean(item.url || item.platform_url || item.permalink)
      );
      if (succeeded) {
        return {
          status: 'postado',
          permalink:
            succeeded.url ||
            succeeded.platform_url ||
            succeeded.permalink ||
            succeeded.platform_data?.url ||
            undefined,
        };
      }
    }
  }

  // 2. Consulta o próprio post (/social-posts/{id})
  const postRes = await directPostForMeRequest<any>(
    `/social-posts/${encodeURIComponent(providerPostId)}`,
    { method: 'GET' }
  );

  if (postRes.ok && postRes.data) {
    const st = String(postRes.data.status || '').toLowerCase();
    if (st === 'failed' || st === 'error') {
      return {
        status: 'erro',
        errorMessage:
          postRes.data.error?.message ||
          postRes.data.error_message ||
          'Falha ao publicar no Instagram.',
      };
    }
    if (st === 'published' || st === 'processed' || st === 'completed') {
      return {
        status: 'postado',
      };
    }
    if (st === 'scheduled') {
      return { status: 'programado' };
    }
  }

  return { status: 'publicando' };
}

export const socialProvider = {
  /** Gera o link de autorização do Instagram para um cliente */
  getConnectLink: (clientId: string) =>
    call<{ url: string }>('connect_link', { clientId }),

  /** Lista todas as contas do Instagram e Facebook já conectadas no seu painel do Post for Me */
  listAccounts: (search?: string) =>
    call<{ accounts: PostForMeAccount[] }>('list_accounts', search ? { search } : {}),

  /** Verifica se o cliente já autorizou e salva o ID da conta */
  syncAccount: (clientId: string) =>
    call<{ connected: boolean; username?: string; accountId?: string }>('sync_account', {
      clientId,
    }),

  /** Desconecta o Instagram do cliente */
  disconnect: (clientId: string) => call('disconnect', { clientId }),

  /** Envia (ou programa) um post da fila via Edge Function */
  publish: (postId: string) => call<{ status: string; id?: string }>('publish', { postId }),

  /** Envia (ou programa) passando os dados diretamente para a API do Post for Me */
  publishDirect: (params: {
    socialAccountId: string;
    instagramUsername?: string;
    facebookAccountId?: string;
    facebookPageName?: string;
    targetNetworks?: ('instagram' | 'facebook')[];
    caption?: string;
    media: string[];
    placement: 'feed' | 'stories' | 'reels';
    scheduledAt?: string;
  }) =>
    call<{
      status: string;
      id?: string;
      permalink?: string;
      resolvedAccountId?: string;
    }>('publish_direct', params),

  /** Exclui/cancela post no Post for Me (funciona para posts programados/rascunhos) */
  deleteRemotePost: (providerPostId: string) =>
    call('delete_remote_post', { providerPostId }),

  /** Consulta o status real do post lá no Post for Me / Instagram */
  checkPostStatus: (providerPostId: string) =>
    call<{
      status: 'programado' | 'publicando' | 'postado' | 'erro';
      permalink?: string;
      errorMessage?: string;
    }>('check_post_status', { providerPostId }),

  /** Cancela um post programado no provedor e volta para "Para Postar" */
  cancel: (postId: string) => call('cancel', { postId }),

  /** Atualiza o status dos posts programados/publicando */
  syncPosts: () => call<{ updated: number }>('sync_posts'),
};

export const NOT_CONFIGURED_MESSAGE =
  'A integração com o Instagram ainda não foi ativada (clique em "Chave API" para colar a chave do Post for Me).';
