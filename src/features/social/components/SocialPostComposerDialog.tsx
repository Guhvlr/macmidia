import React, { useEffect, useRef, useState } from 'react';
import {
  Instagram,
  Calendar as CalendarIcon,
  Clock,
  Send,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Plus,
  AlertTriangle,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Loader2,
  CheckCircle2,
  Facebook,
  Sparkles,
  Flame,
  Zap,
  Film,
  Star,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { compressImageToBlob } from '@/lib/utils';
import type { CalendarClient, KanbanCard } from '@/contexts/app-types';
import {
  INSTAGRAM_CAPTION_LIMIT,
  isVideoUrl,
  SocialPlacement,
  SocialPost,
} from '../types';

interface SocialPostComposerDialogProps {
  post: SocialPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: CalendarClient[];
  kanbanCards: KanbanCard[];
  onUpdatePost: (id: string, updates: Partial<SocialPost>) => Promise<void>;
  onCreatePost: (input: {
    kanbanCardId?: string;
    calendarClientId?: string;
    title: string;
    placement?: SocialPlacement;
    media: string[];
    caption?: string;
    scheduledAt?: string;
  }) => Promise<SocialPost | null>;
  onDeletePost: (id: string) => Promise<void>;
  onSubmitPost: (
    id: string,
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
  ) => Promise<{ ok: boolean; simulated?: boolean }>;
  onCreateRecurringBatch?: (params: {
    basePostId: string;
    startDate: string;
    untilDate: string;
    time: string;
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
  }) => Promise<{ ok: boolean; count: number }>;
}

function toLocalDateTimeParts(iso?: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

export const SocialPostComposerDialog: React.FC<SocialPostComposerDialogProps> = ({
  post,
  open,
  onOpenChange,
  clients,
  kanbanCards,
  onUpdatePost,
  onCreatePost,
  onDeletePost,
  onSubmitPost,
  onCreateRecurringBatch,
}) => {
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState<string>('none');
  const [caption, setCaption] = useState('');
  const [mediaPool, setMediaPool] = useState<string[]>([]);
  // Listas separadas de quais mídias vão para o Feed, Stories e Reels
  const [feedMedia, setFeedMedia] = useState<string[]>([]);
  const [storiesMedia, setStoriesMedia] = useState<string[]>([]);
  const [reelsMedia, setReelsMedia] = useState<string[]>([]);
  // Capa do Reels (Anexar Imagem - Opcional)
  const [reelsCoverUrl, setReelsCoverUrl] = useState<string>('');
  const [isUploadingReelsCover, setIsUploadingReelsCover] = useState(false);
  const reelsCoverInputRef = useRef<HTMLInputElement | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  // Repetição diária de ofertas (válidas até dia X)
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatUntilDate, setRepeatUntilDate] = useState('');
  const [postOnInstagram, setPostOnInstagram] = useState(true);
  const [postOnFacebook, setPostOnFacebook] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [failedMediaUrls, setFailedMediaUrls] = useState<Record<string, boolean>>({});
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<
    { id: string; title: string; badge: string; text: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const linkedKanbanCard = post?.kanbanCardId
    ? kanbanCards.find(c => c.id === post.kanbanCardId) || null
    : null;

  let recurringSummary: { daysCount: number; startFormatted: string; endFormatted: string } | null = null;
  if (isRecurring && repeatUntilDate) {
    const startStr = scheduleDate || new Date().toISOString().split('T')[0];
    const s = new Date(`${startStr}T00:00:00`);
    const e = new Date(`${repeatUntilDate}T00:00:00`);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s) {
      const diffMs = e.getTime() - s.getTime();
      const daysCount = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
      const startFormatted = `${String(s.getDate()).padStart(2, '0')}/${String(s.getMonth() + 1).padStart(2, '0')}`;
      const endFormatted = `${String(e.getDate()).padStart(2, '0')}/${String(e.getMonth() + 1).padStart(2, '0')}`;
      recurringSummary = { daysCount, startFormatted, endFormatted };
    }
  }

  useEffect(() => {
    if (!post || !open) return;
    setTitle(post.title || '');
    const initialClientId = post.calendarClientId || 'none';
    setClientId(initialClientId);
    setCaption(post.caption || '');
    setAiSuggestions([]);

    const c = clients.find(cl => cl.id === initialClientId);
    const hasIg = Boolean(c?.postformeAccountId || c?.instagramUsername);
    const hasFb = Boolean(c?.postformeFacebookAccountId || c?.facebookPageName);
    setPostOnInstagram(hasIg || !hasFb);
    setPostOnFacebook(hasFb);

    const cardImages = Array.isArray(linkedKanbanCard?.images) ? linkedKanbanCard!.images : [];
    const combinedPool = Array.from(new Set([...(post.media || []), ...cardImages]));
    setMediaPool(combinedPool);

    const initialSelected = post.media && post.media.length > 0 ? [...post.media] : combinedPool;
    if (
      (post.feedMedia && post.feedMedia.length > 0) ||
      (post.storiesMedia && post.storiesMedia.length > 0) ||
      (post.reelsMedia && post.reelsMedia.length > 0)
    ) {
      setFeedMedia(post.feedMedia || []);
      setStoriesMedia(post.storiesMedia || []);
      setReelsMedia(post.reelsMedia || []);
    } else if (post.placement === 'reels') {
      setFeedMedia([]);
      setStoriesMedia([]);
      setReelsMedia(initialSelected);
    } else if (post.placement === 'stories') {
      setFeedMedia([]);
      setStoriesMedia(initialSelected);
      setReelsMedia([]);
    } else {
      const vids = initialSelected.filter(isVideoUrl);
      const imgs = initialSelected.filter(u => !isVideoUrl(u));
      setFeedMedia(imgs);
      setStoriesMedia([]);
      setReelsMedia(vids);
    }

    const { date, time } = toLocalDateTimeParts(post.scheduledAt);
    setScheduleDate(date);
    setScheduleTime(time);

    // Inicializa capa do Reels (opcional) e repetição de ofertas
    setReelsCoverUrl(post.reelsCoverUrl || '');
    if (post.repeatUntilDate) {
      setIsRecurring(true);
      setRepeatUntilDate(post.repeatUntilDate);
    } else {
      setIsRecurring(false);
      setRepeatUntilDate('');
    }
  }, [post?.id, open, linkedKanbanCard]);

  if (!post) return null;

  const selectedClient = clients.find(c => c.id === clientId);
  const hasConnectedInstagram = Boolean(
    selectedClient?.postformeAccountId || selectedClient?.instagramUsername
  );
  const hasConnectedFacebook = Boolean(
    selectedClient?.postformeFacebookAccountId || selectedClient?.facebookPageName
  );

  const hasFeedSelected = feedMedia.length > 0;
  const hasStoriesSelected = storiesMedia.length > 0;
  const hasReelsSelected = reelsMedia.length > 0;

  const toggleImageFeed = (url: string) => {
    setFeedMedia(prev =>
      prev.includes(url) ? prev.filter(item => item !== url) : [...prev, url]
    );
  };

  const toggleImageStories = (url: string) => {
    setStoriesMedia(prev =>
      prev.includes(url) ? prev.filter(item => item !== url) : [...prev, url]
    );
  };

  const toggleImageReels = (url: string) => {
    setReelsMedia(prev =>
      prev.includes(url) ? prev.filter(item => item !== url) : [...prev, url]
    );
  };

  // Botões rápidos no topo ("Todos no Feed" / "Todos no Stories" / "Todos no Reels")
  const handleTopToggleFeed = () => {
    if (hasFeedSelected) {
      setFeedMedia([]);
    } else {
      setFeedMedia([...mediaPool]);
    }
  };

  const handleTopToggleStories = () => {
    if (hasStoriesSelected) {
      setStoriesMedia([]);
    } else {
      setStoriesMedia([...mediaPool]);
    }
  };

  const handleTopToggleReels = () => {
    if (hasReelsSelected) {
      setReelsMedia([]);
    } else {
      const onlyVideos = mediaPool.filter(isVideoUrl);
      setReelsMedia(onlyVideos.length > 0 ? onlyVideos : [...mediaPool]);
    }
  };

  const moveMediaInPool = (url: string, direction: -1 | 1) => {
    setMediaPool(prev => {
      const idx = prev.indexOf(url);
      if (idx === -1) return prev;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      // Mantém a ordem do Feed, Stories e Reels sincronizada com a ordem visual
      setFeedMedia(f => copy.filter(u => f.includes(u)));
      setStoriesMedia(s => copy.filter(u => s.includes(u)));
      setReelsMedia(r => copy.filter(u => r.includes(u)));
      return copy;
    });
  };

  const removeMediaFromPool = (url: string) => {
    setMediaPool(prev => prev.filter(item => item !== url));
    setFeedMedia(prev => prev.filter(item => item !== url));
    setStoriesMedia(prev => prev.filter(item => item !== url));
    setReelsMedia(prev => prev.filter(item => item !== url));
  };

  const handleUploadNewMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      const uploadedVideoUrls: string[] = [];
      const uploadedImageUrls: string[] = [];
      for (const file of files) {
        const isVidFile = file.type.startsWith('video/');
        let uploadPayload: Blob | File = file;
        let contentType = file.type || (isVidFile ? 'video/mp4' : 'image/jpeg');

        if (file.type.startsWith('image/')) {
          try {
            uploadPayload = await compressImageToBlob(file);
            contentType = 'image/jpeg';
          } catch (e) {
            console.warn('Fallback para arquivo original no upload:', e);
            uploadPayload = file;
          }
        }

        const ext = isVidFile
          ? file.name.split('.').pop() || 'mp4'
          : 'jpg';
        const path = `social/${post.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('kanban_assets')
          .upload(path, uploadPayload, { upsert: true, contentType });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('kanban_assets').getPublicUrl(path);
        if (pub?.publicUrl) {
          uploadedUrls.push(pub.publicUrl);
          if (isVidFile || isVideoUrl(pub.publicUrl)) {
            uploadedVideoUrls.push(pub.publicUrl);
          } else {
            uploadedImageUrls.push(pub.publicUrl);
          }
        }
      }

      if (uploadedUrls.length > 0) {
        setMediaPool(prev => [...prev, ...uploadedUrls]);
        // Vídeos vão automaticamente marcados como Reels!
        if (uploadedVideoUrls.length > 0) {
          setReelsMedia(prev => [...prev, ...uploadedVideoUrls]);
        }
        // Imagens vão para Feed (ou Stories se só Stories estiver selecionado)
        if (uploadedImageUrls.length > 0) {
          if (hasStoriesSelected && !hasFeedSelected) {
            setStoriesMedia(prev => [...prev, ...uploadedImageUrls]);
          } else {
            setFeedMedia(prev => [...prev, ...uploadedImageUrls]);
          }
        }
        toast.success(
          uploadedVideoUrls.length > 0
            ? 'Vídeo adicionado e marcado como Reels automaticamente!'
            : uploadedUrls.length === 1
              ? 'Imagem adicionada ao post!'
              : `${uploadedUrls.length} arquivos adicionados ao post!`
        );
      }
    } catch (err) {
      console.error('Erro no upload de mídia social:', err);
      toast.error('Erro ao enviar arquivo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadReelsCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingReelsCover(true);
    try {
      let uploadPayload: Blob | File = file;
      if (file.type.startsWith('image/')) {
        try {
          uploadPayload = await compressImageToBlob(file);
        } catch (e) {
          console.warn('Fallback para arquivo original na capa do Reels:', e);
          uploadPayload = file;
        }
      }
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `social/reels_cover/${post.id}/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('kanban_assets')
        .upload(path, uploadPayload, { upsert: true, contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('kanban_assets').getPublicUrl(path);
      if (pub?.publicUrl) {
        setReelsCoverUrl(pub.publicUrl);
        toast.success('Imagem de capa do Reels anexada com sucesso!');
      }
    } catch (err) {
      console.error('Erro no upload da capa do Reels:', err);
      toast.error('Erro ao anexar capa do Reels.');
    } finally {
      setIsUploadingReelsCover(false);
      if (reelsCoverInputRef.current) reelsCoverInputRef.current.value = '';
    }
  };

  const handleGenerateAICaptions = async (
    preferredStyle: 'auto' | 'ofertas' | 'calmo' | 'curto' = 'auto'
  ) => {
    const candidateMedia = feedMedia.length > 0 ? feedMedia : mediaPool;
    const imagesToRead = candidateMedia.filter(u => !isVideoUrl(u)).slice(0, 3);
    if (
      imagesToRead.length === 0 &&
      candidateMedia.length === 0 &&
      !linkedKanbanCard?.description &&
      !caption.trim()
    ) {
      toast.warning('Adicione pelo menos 1 arte/mídia ao card para a IA gerar a legenda.');
      return;
    }

    setIsGeneratingCaption(true);
    try {
      const { data: settingsData } = await (supabase as any)
        .from('settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .maybeSingle();

      const apiKey = settingsData?.value?.trim();
      if (!apiKey) {
        toast.error('Chave da OpenAI não encontrada na tabela settings (openai_api_key).');
        return;
      }

      const clientName = selectedClient?.name || title || 'nosso cliente';
      const clientHandle = selectedClient?.instagramUsername || '';
      const cardText = linkedKanbanCard?.description || '';

      const systemPrompt = `Você é um copywriter de redes sociais especializado em supermercados, atacarejos e varejo alimentar no Brasil.
Sua missão é gerar legendas de alto engajamento para Instagram e Facebook para o cliente "${clientName}".

SIGA ESTRITAMENTE ESTE PADRÃO EM TODAS AS OPÇÕES:
- Comece com o nome da campanha + nome do supermercado (Ex: "Sacolão da Economia no Supermercado Garotão!" ou "Quinta da Carne no Bem Atacarejo!").
- Use linguagem comercial, direta, natural e animada.
- Faça 2 ou 3 parágrafos curtos.
- Deixe uma linha em branco entre os parágrafos.
- Use poucos emojis, sempre relacionados ao tema, no máximo 2 a 5 na legenda toda.
- Finalize com uma chamada para ação (CTA).
- Use no máximo 5 hashtags, todas no final.
- Não use negrito (proibido asteriscos ** ou qualquer formatação em negrito).
- Não mencione na legenda os produtos nem os preços que aparecem nas ofertas.
- Não invente datas, preços, produtos, horários ou regras.
- Não coloque preço do produto em hipótese alguma.
- Entregue somente a legenda pronta (sem saudações, introduções ou aspas).

Retorne OBRIGATORIAMENTE um JSON válido com 3 opções que sigam 100% esse padrão:
{
  "ofertas": "Legenda seguindo todas as regras acima, com tom comercial mais vibrante e foco em economia e vantagens para a família",
  "calmo": "Legenda seguindo todas as regras acima, com tom convidativo, acolhedor e focado no dia a dia",
  "curto": "Legenda seguindo todas as regras acima, com 2 parágrafos bem curtos e objetivos + CTA + hashtags"
}`;

      const userContent: any[] = [
        {
          type: 'text',
          text: `Cliente / Supermercado: ${clientName} ${clientHandle ? `(${clientHandle})` : ''}
Título do Card: ${title}
${cardText ? `Briefing/Observações: ${cardText}\n` : ''}
PADRÃO OBRIGATÓRIO A SEGUIR:
- Comece com o nome da campanha + nome do supermercado "${clientName}".
- Use linguagem comercial, direta, natural e animada.
- Faça 2 ou 3 parágrafos curtos.
- Deixe uma linha em branco entre os parágrafos.
- Use poucos emojis, sempre relacionados ao tema, no máximo 2 a 5 na legenda toda.
- Finalize com uma chamada para ação.
- Use no máximo 5 hashtags, todas no final.
- Não use negrito.
- Não mencione na legenda os produtos nem os preços que aparecem nas ofertas.
- Não invente datas, preços, produtos, horários ou regras.
- NÃO COLOQUE PREÇO DO PRODUTO.
- Entregue somente a legenda pronta.
Gere o JSON com as 3 opções ("ofertas", "calmo", "curto") seguindo rigorosamente essas instruções.`,
        },
      ];

      for (const imgUrl of imagesToRead) {
        if (imgUrl && (imgUrl.startsWith('http') || imgUrl.startsWith('data:'))) {
          userContent.push({
            type: 'image_url',
            image_url: { url: imgUrl },
          });
        }
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erro na API da IA (${response.status})`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(rawContent);

      const sanitizeCaption = (raw?: string): string => {
        if (!raw) return '';
        let text = raw.trim();

        // Remove aspas no início/fim
        text = text.replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim();

        // Remove eventuais prefixos (ex: "Legenda:", "Opção 1:")
        text = text.replace(/^(Legenda|Opção\s*\d*|Sugestão\s*\d*)\s*:\s*/i, '').trim();

        // Remove asteriscos de markdown (**negrito** ou *itálico*)
        text = text.replace(/\*/g, '');

        // Converte caracteres unicode negrito/itálico se houver
        text = text.normalize('NFKD');

        // Remove qualquer menção acidental a preços (ex: R$ 9,99 ou 9,99)
        text = text.replace(/R\$\s*\d+([.,]\d{2})?/gi, '').replace(/\b\d+,\d{2}\b/g, '');

        // Remove múltiplos espaços horizontais
        text = text.replace(/[ \t]{2,}/g, ' ');

        // Normaliza quebras de linha para manter exatamente 1 linha em branco entre parágrafos
        text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

        // Garante no máximo 5 hashtags no final
        const parts = text.split('\n\n');
        const lastPart = parts[parts.length - 1] || '';
        if (lastPart.includes('#')) {
          const words = lastPart.split(/\s+/);
          const hashtags = words.filter(w => w.startsWith('#')).slice(0, 5);
          const nonHashtags = words.filter(w => !w.startsWith('#'));
          const rebuiltLast = [...nonHashtags, ...hashtags].join(' ').trim();
          if (rebuiltLast) {
            parts[parts.length - 1] = rebuiltLast;
            text = parts.join('\n\n');
          }
        }

        return text.trim();
      };

      const suggestions = [
        {
          id: 'ofertas',
          title: '🔥 Comercial / Ofertas',
          badge: 'Comercial & Animada',
          text: sanitizeCaption(parsed.ofertas),
        },
        {
          id: 'calmo',
          title: '✨ Convidativa / Acolhedora',
          badge: 'Natural & Leve',
          text: sanitizeCaption(parsed.calmo),
        },
        {
          id: 'curto',
          title: '⚡ Curta & Direta',
          badge: '2 Parágrafos',
          text: sanitizeCaption(parsed.curto),
        },
      ].filter(s => s.text.length > 0);

      setAiSuggestions(suggestions);

      if (suggestions.length > 0) {
        const chosen =
          preferredStyle === 'calmo'
            ? suggestions.find(s => s.id === 'calmo') || suggestions[0]
            : preferredStyle === 'curto'
              ? suggestions.find(s => s.id === 'curto') || suggestions[0]
              : suggestions.find(s => s.id === 'ofertas') || suggestions[0];

        setCaption(chosen.text);
        toast.success('IA leu a arte e gerou 3 sugestões de legenda!');
      }
    } catch (err: any) {
      console.error('Erro ao gerar legenda com IA:', err);
      toast.error('Não foi possível gerar a legenda automática agora.');
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const buildScheduledIso = (): string | undefined => {
    if (!scheduleDate) return undefined;
    const timePart = scheduleTime || '09:00';
    const dt = new Date(`${scheduleDate}T${timePart}:00`);
    if (Number.isNaN(dt.getTime())) return undefined;
    return dt.toISOString();
  };

  const handleSaveDraft = async () => {
    if (!hasFeedSelected && !hasStoriesSelected && !hasReelsSelected) {
      toast.warning('Marque pelo menos 1 arquivo como Feed, Stories ou Reels.');
      return;
    }

    const scheduledIso = buildScheduledIso();
    const baseTitle = (title.trim() || post.title).replace(
      /\s*\((Feed|Stories|Reels)\)\s*$/i,
      ''
    );
    const targetPlacement: SocialPlacement =
      hasReelsSelected && !hasFeedSelected && !hasStoriesSelected
        ? 'reels'
        : hasStoriesSelected && !hasFeedSelected && !hasReelsSelected
          ? 'stories'
          : 'feed';
    const combinedMedia = Array.from(
      new Set([...feedMedia, ...reelsMedia, ...storiesMedia])
    );

    await onUpdatePost(post.id, {
      title: baseTitle,
      calendarClientId: clientId === 'none' ? undefined : clientId,
      placement: targetPlacement,
      media: combinedMedia,
      feedMedia,
      storiesMedia,
      reelsMedia,
      caption: hasFeedSelected || hasReelsSelected ? caption : '',
      scheduledAt: scheduledIso,
      reelsCoverUrl: reelsCoverUrl || undefined,
      repeatUntilDate: isRecurring && repeatUntilDate ? repeatUntilDate : undefined,
    });
    toast.success('Alterações salvas no card!');
    onOpenChange(false);
  };

  const handlePublishOrSchedule = async () => {
    if (!hasFeedSelected && !hasStoriesSelected && !hasReelsSelected) {
      toast.warning('Marque pelo menos 1 arquivo como Feed, Stories ou Reels.');
      return;
    }

    if (clientId === 'none') {
      toast.warning('Selecione qual é o cliente vinculado antes de postar.');
      return;
    }

    if (!postOnInstagram && !postOnFacebook) {
      toast.warning('Selecione pelo menos 1 rede social (Instagram e/ou Facebook).');
      return;
    }

    const targetNetworks: ('instagram' | 'facebook')[] = [];
    if (postOnInstagram) targetNetworks.push('instagram');
    if (postOnFacebook) targetNetworks.push('facebook');

    const scheduledIso = buildScheduledIso();
    const baseTitle = (title.trim() || post.title).replace(
      /\s*\((Feed|Stories|Reels)\)\s*$/i,
      ''
    );
    const targetPlacement: SocialPlacement =
      hasReelsSelected && !hasFeedSelected && !hasStoriesSelected
        ? 'reels'
        : hasStoriesSelected && !hasFeedSelected && !hasReelsSelected
          ? 'stories'
          : 'feed';
    const combinedMedia = Array.from(
      new Set([...feedMedia, ...reelsMedia, ...storiesMedia])
    );
    const finalCaption = hasFeedSelected || hasReelsSelected ? caption : '';

    // Se for campanha de repetição diária de ofertas
    if (isRecurring && repeatUntilDate && onCreateRecurringBatch) {
      setIsSubmitting(true);
      try {
        const res = await onCreateRecurringBatch({
          basePostId: post.id,
          startDate: scheduleDate || new Date().toISOString().split('T')[0],
          untilDate: repeatUntilDate,
          time: scheduleTime || selectedClient?.defaultPostTime || '09:00',
          calendarClientId: clientId === 'none' ? undefined : clientId,
          title: baseTitle,
          caption: finalCaption,
          media: combinedMedia,
          feedMedia,
          storiesMedia,
          reelsMedia,
          reelsCoverUrl: reelsCoverUrl || undefined,
          targetNetworks,
          socialAccountId: selectedClient?.postformeAccountId,
          instagramUsername: selectedClient?.instagramUsername,
          facebookAccountId: selectedClient?.postformeFacebookAccountId,
          facebookPageName: selectedClient?.facebookPageName,
        });

        if (res.ok) {
          onOpenChange(false);
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdatePost(post.id, {
        title: baseTitle,
        calendarClientId: clientId,
        placement: targetPlacement,
        media: combinedMedia,
        feedMedia,
        storiesMedia,
        reelsMedia,
        caption: finalCaption,
        scheduledAt: scheduledIso,
        reelsCoverUrl: reelsCoverUrl || undefined,
        repeatUntilDate: isRecurring && repeatUntilDate ? repeatUntilDate : undefined,
      });

      const res = await onSubmitPost(post.id, {
        hasConnectedAccount: hasConnectedInstagram || hasConnectedFacebook,
        socialAccountId: selectedClient?.postformeAccountId,
        instagramUsername: selectedClient?.instagramUsername,
        facebookAccountId: selectedClient?.postformeFacebookAccountId,
        facebookPageName: selectedClient?.facebookPageName,
        targetNetworks,
        caption: finalCaption,
        media: combinedMedia,
        feedMedia,
        storiesMedia,
        reelsMedia,
        placement: targetPlacement,
        scheduledAt: scheduledIso,
        reelsCoverUrl: reelsCoverUrl || undefined,
      });

      if (res.ok) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isScheduledFuture = Boolean(
    scheduleDate &&
      new Date(`${scheduleDate}T${scheduleTime || '09:00'}:00`).getTime() > Date.now() + 30_000
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-4xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] bg-[#121214] border-white/10 text-white p-0 rounded-none sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 bg-[#1C1C1E] border-b border-white/5 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shrink-0">
              <Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                Configurar Postagem (Instagram & Facebook)
              </DialogTitle>
              <DialogDescription className="text-[11px] sm:text-xs text-white/40 line-clamp-1 sm:line-clamp-none">
                Escolha em qual rede postar, Feed/Stories/Reels, legenda e horário.
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 rounded-lg text-white/60 hover:text-white shrink-0 sm:hidden"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {post.status === 'erro' && post.errorMessage && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-red-200 mb-0.5">
                  Motivo do erro na última tentativa:
                </strong>
                {post.errorMessage}
              </div>
            </div>
          )}

          {post.status === 'postado' && post.errorMessage && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-amber-200 mb-0.5">
                  Aviso da publicação:
                </strong>
                {post.errorMessage}
              </div>
            </div>
          )}

          {/* 1. Cliente Vinculado, Redes Sociais (Instagram / Facebook) e Feed / Stories */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">
                1. Cliente Vinculado
              </label>
              <Select
                value={clientId}
                onValueChange={val => {
                  setClientId(val);
                  const cl = clients.find(x => x.id === val);
                  const ig = Boolean(cl?.postformeAccountId || cl?.instagramUsername);
                  const fb = Boolean(cl?.postformeFacebookAccountId || cl?.facebookPageName);
                  setPostOnInstagram(ig || !fb);
                  setPostOnFacebook(fb);
                }}
              >
                <SelectTrigger className="h-11 bg-white/5 border-white/10 rounded-xl text-white text-xs font-semibold">
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-xl z-[99999]">
                  <SelectItem value="none">Sem cliente selecionado</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span>{c.name}</span>
                        {c.instagramUsername && (
                          <span className="text-[10px] text-pink-400 font-bold">
                            ({c.instagramUsername})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClient && !hasConnectedInstagram && !hasConnectedFacebook && (
                <p className="text-[11px] text-amber-400 pl-1">
                  Vincule o Instagram/Facebook em Contas Instagram.
                </p>
              )}
            </div>

            {/* Onde Postar: Instagram e/ou Facebook */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">
                2. Em Qual Rede Postar?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPostOnInstagram(v => !v)}
                  className={`h-11 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    postOnInstagram
                      ? 'bg-gradient-to-r from-pink-600 to-purple-600 border-pink-400 text-white shadow-lg shadow-pink-600/20'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Instagram className="w-4 h-4 shrink-0" />
                  <span className="truncate">Instagram</span>
                  {postOnInstagram && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setPostOnFacebook(v => !v)}
                  className={`h-11 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    postOnFacebook
                      ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Facebook className="w-4 h-4 shrink-0" />
                  <span className="truncate">Facebook</span>
                  {postOnFacebook && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                </button>
              </div>
              {selectedClient && (
                <p className="text-[10px] text-white/45 truncate pl-1">
                  {postOnInstagram && selectedClient.instagramUsername
                    ? `IG: ${selectedClient.instagramUsername} `
                    : ''}
                  {postOnFacebook
                    ? selectedClient.facebookPageName
                      ? `• FB: ${selectedClient.facebookPageName}`
                      : '• (Selecione a pág. Facebook no Banco de Dados)'
                    : ''}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 ml-1">
                3. Formato (Feed / Stories / Reels)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={handleTopToggleFeed}
                  className={`h-11 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                    hasFeedSelected
                      ? 'bg-pink-600 border-pink-400 text-white shadow-lg shadow-pink-600/25'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  Feed ({feedMedia.length})
                </button>

                <button
                  type="button"
                  onClick={handleTopToggleStories}
                  className={`h-11 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                    hasStoriesSelected
                      ? 'bg-orange-500 border-orange-300 text-white shadow-lg shadow-orange-500/25'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                  Stories ({storiesMedia.length})
                </button>

                <button
                  type="button"
                  onClick={handleTopToggleReels}
                  className={`h-11 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                    hasReelsSelected
                      ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/25'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Film className="w-3.5 h-3.5 shrink-0" />
                  Reels ({reelsMedia.length})
                </button>
              </div>
            </div>
          </div>

          {/* 2. Imagens e Vídeos do Card: em cada item você escolhe [Feed], [Stories] e/ou [Reels] */}
          <div className="space-y-3 bg-white/[0.02] border border-white/10 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-pink-400" />
                  Mídias do Card ({mediaPool.length})
                </h4>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Embaixo de cada arquivo, clique em <strong className="text-pink-400">Feed</strong>,{' '}
                  <strong className="text-orange-400">Stories</strong> ou{' '}
                  <strong className="text-purple-400">Reels (Vídeo)</strong> para definir onde será postado.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/mp4,video/quicktime,video/webm,video/*"
                  multiple
                  className="hidden"
                  onChange={handleUploadNewMedia}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-[11px] font-bold"
                >
                  {isUploading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Adicionar Imagem ou Vídeo
                </Button>
              </div>
            </div>

            {mediaPool.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-white/10 rounded-xl text-xs text-white/40">
                Nenhuma imagem ou vídeo vinculado a este card. Clique em "Adicionar Imagem ou Vídeo" acima.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                {mediaPool.map((url, idx) => {
                  const isFeed = feedMedia.includes(url);
                  const isStories = storiesMedia.includes(url);
                  const isReels = reelsMedia.includes(url);
                  const isVid = isVideoUrl(url);
                  const feedOrder = feedMedia.indexOf(url) + 1;
                  const storiesOrder = storiesMedia.indexOf(url) + 1;
                  const reelsOrder = reelsMedia.indexOf(url) + 1;

                  return (
                    <div
                      key={url}
                      className={`group rounded-xl overflow-hidden border-2 bg-[#18181c] flex flex-col transition-all ${
                        isReels
                          ? 'border-purple-500 shadow-lg'
                          : isFeed && isStories
                            ? 'border-purple-500 shadow-lg'
                            : isFeed
                              ? 'border-pink-500/80 shadow-md'
                              : isStories
                                ? 'border-orange-500/80 shadow-md'
                                : 'border-white/10 opacity-60'
                      }`}
                    >
                      {/* Preview de Imagem ou Vídeo */}
                      <div className="relative bg-black/60 h-48 flex items-center justify-center overflow-hidden">
                        {failedMediaUrls[url] ? (
                          <div className="flex flex-col items-center justify-center p-3 text-center text-amber-300">
                            <AlertTriangle className="w-6 h-6 mb-1 text-amber-400" />
                            <span className="text-[11px] font-bold">Arquivo indisponível</span>
                            <span className="text-[9px] text-white/50 mt-0.5">
                              Link expirado ou excluído no Kanban
                            </span>
                          </div>
                        ) : isVid ? (
                          <video
                            src={url}
                            controls
                            muted
                            playsInline
                            preload="metadata"
                            onError={() => setFailedMediaUrls(prev => ({ ...prev, [url]: true }))}
                            className="w-full h-full object-contain p-1.5"
                          />
                        ) : (
                          <img
                            src={url}
                            alt=""
                            onError={() => setFailedMediaUrls(prev => ({ ...prev, [url]: true }))}
                            className="w-full h-full object-contain p-1.5"
                          />
                        )}

                        {/* Badges de Ordem no topo */}
                        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1">
                          {isVid && (
                            <span className="px-2 py-0.5 rounded-md bg-black/80 border border-purple-400/40 text-purple-300 text-[10px] font-black uppercase shadow flex items-center gap-1">
                              <Film className="w-2.5 h-2.5" /> Vídeo
                            </span>
                          )}
                          {isFeed && (
                            <span className="px-2 py-0.5 rounded-md bg-pink-600 text-white text-[10px] font-black uppercase shadow">
                              Feed #{feedOrder}
                            </span>
                          )}
                          {isStories && (
                            <span className="px-2 py-0.5 rounded-md bg-orange-500 text-white text-[10px] font-black uppercase shadow">
                              Stories #{storiesOrder}
                            </span>
                          )}
                          {isReels && (
                            <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-black uppercase shadow">
                              Reels #{reelsOrder}
                            </span>
                          )}
                        </div>

                        {/* Botão Excluir Mídia */}
                        <button
                          type="button"
                          onClick={() => removeMediaFromPool(url)}
                          title="Remover este arquivo"
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/80 hover:bg-red-600 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Setas de reordenar quando houver mais de 1 mídia */}
                        {mediaPool.length > 1 && (
                          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/80 rounded-lg p-1 border border-white/10">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveMediaInPool(url, -1)}
                              className="p-1 text-white/70 hover:text-white disabled:opacity-25"
                              title="Mover para trás"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === mediaPool.length - 1}
                              onClick={() => moveMediaInPool(url, 1)}
                              className="p-1 text-white/70 hover:text-white disabled:opacity-25"
                              title="Mover para frente"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Botões de seleção por mídia: [Feed], [Stories] e [Reels] */}
                      <div className="p-2 bg-[#1C1C1E] border-t border-white/5 grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleImageFeed(url)}
                          className={`h-8 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                            isFeed
                              ? 'bg-pink-600 text-white shadow-sm'
                              : 'bg-white/5 text-white/45 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Layers className="w-3 h-3 shrink-0" />
                          Feed
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleImageStories(url)}
                          className={`h-8 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                            isStories
                              ? 'bg-orange-500 text-white shadow-sm'
                              : 'bg-white/5 text-white/45 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <ImageIcon className="w-3 h-3 shrink-0" />
                          Stories
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleImageReels(url)}
                          className={`h-8 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                            isReels
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-white/5 text-white/45 hover:bg-white/10 hover:text-white'
                          }`}
                          title="Publicar como vídeo no Reels"
                        >
                          <Film className="w-3 h-3 shrink-0" />
                          Reels
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Anexar Imagem de Capa do Reels (Aparece somente quando houver Reels selecionado) */}
          {hasReelsSelected && (
            <div className="bg-purple-950/20 border border-purple-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-300 flex items-center justify-center border border-purple-500/40 shrink-0">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-purple-200 flex items-center gap-1.5">
                      Capa do Reels (Opcional)
                    </h4>
                    <p className="text-[11px] text-purple-300/60">
                      Anexe uma imagem para ser a capa do Reels no Instagram. Se não anexar, o Instagram usa o frame do vídeo automaticamente.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={reelsCoverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUploadReelsCover}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={isUploadingReelsCover}
                    onClick={() => reelsCoverInputRef.current?.click()}
                    className="h-8 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold shadow-md shadow-purple-600/25"
                  >
                    {isUploadingReelsCover ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {reelsCoverUrl ? 'Trocar Imagem de Capa' : 'Anexar Imagem de Capa'}
                  </Button>

                  {reelsCoverUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setReelsCoverUrl('')}
                      className="h-8 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[11px] font-bold border border-red-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>

              {reelsCoverUrl ? (
                <div className="flex items-center gap-3 p-2.5 bg-black/40 rounded-xl border border-purple-500/30">
                  <div className="w-16 h-24 rounded-lg overflow-hidden bg-black border border-purple-500/50 shrink-0 shadow">
                    <img
                      src={reelsCoverUrl}
                      alt="Capa Reels"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200 text-[10px] font-black uppercase border border-purple-400/40 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Capa Anexada ✓
                    </span>
                    <p className="text-[11px] text-white/80 font-medium">
                      Esta imagem será enviada como a capa oficial do seu Reels.
                    </p>
                    <p className="text-[10px] text-white/40">
                      Caso queira trocar, clique em "Trocar Imagem de Capa" acima.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-3 px-4 text-center border border-dashed border-purple-500/25 rounded-xl text-[11px] text-purple-300/50 bg-black/20">
                  Nenhuma imagem anexada. O Instagram usará a imagem do início do vídeo.
                </div>
              )}
            </div>
          )}

          {/* 3. Caixinha de Legenda — APARECE SE TIVER FEED OU REELS SELECIONADO */}
          {hasFeedSelected || hasReelsSelected ? (
            <div className="space-y-3 animate-in fade-in duration-200 bg-white/[0.02] border border-white/10 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-pink-400">
                    Legenda ({hasReelsSelected && !hasFeedSelected ? 'Reels' : hasReelsSelected ? 'Feed & Reels' : 'Feed'})
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      caption.length > INSTAGRAM_CAPTION_LIMIT
                        ? 'text-red-400 font-bold'
                        : 'text-white/40'
                    }`}
                  >
                    ({caption.length} / {INSTAGRAM_CAPTION_LIMIT})
                  </span>
                </div>

                {/* Botões de Legenda Automática com IA (lê a imagem do post!) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isGeneratingCaption}
                    onClick={() => handleGenerateAICaptions('auto')}
                    className="h-8 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white text-[11px] font-black shadow-md"
                    title="A IA lê a imagem da arte automaticamente e cria 3 opções de legenda"
                  >
                    {isGeneratingCaption ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {isGeneratingCaption ? 'Lendo Arte com IA...' : 'Gerar Legenda com IA'}
                  </Button>

                  <button
                    type="button"
                    disabled={isGeneratingCaption}
                    onClick={() => handleGenerateAICaptions('ofertas')}
                    className="h-8 px-2.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
                    title="Gera legenda comercial animada focada na campanha e na economia"
                  >
                    <Flame className="w-3 h-3" />
                    Comercial / Ofertas
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingCaption}
                    onClick={() => handleGenerateAICaptions('calmo')}
                    className="h-8 px-2.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
                    title="Gera legenda convidativa e acolhedora para o dia a dia"
                  >
                    <Sparkles className="w-3 h-3" />
                    Convidativa / Leve
                  </button>

                  <button
                    type="button"
                    disabled={isGeneratingCaption}
                    onClick={() => handleGenerateAICaptions('curto')}
                    className="h-8 px-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
                    title="Gera legenda direta ao ponto em 2 parágrafos curtos"
                  >
                    <Zap className="w-3 h-3" />
                    Curta (2 Parágrafos)
                  </button>
                </div>
              </div>

              <Textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Escreva a legenda ou clique em 'Gerar Legenda com IA' acima para a IA ler a arte automaticamente..."
                className="min-h-[120px] bg-black/40 border-white/10 rounded-xl text-sm text-white placeholder:text-white/25 resize-y p-3.5"
              />

              {/* Sugestões geradas pela IA para trocar com 1 clique */}
              {aiSuggestions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    Sugestões da IA baseadas na arte (clique para usar):
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {aiSuggestions.map(s => {
                      const isCurrent = caption.trim() === s.text.trim();
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setCaption(s.text)}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all ${
                            isCurrent
                              ? 'bg-pink-500/15 border-pink-500 text-white shadow-md'
                              : 'bg-black/30 border-white/10 text-white/75 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-black text-white">{s.title}</span>
                              {isCurrent && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-white/65 line-clamp-4 whitespace-pre-line leading-relaxed">
                              {s.text}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-pink-400">
                            {isCurrent ? 'Em uso na legenda' : 'Clicar para usar esta →'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-3 rounded-xl bg-orange-500/10 border border-orange-500/20 text-xs text-orange-300 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span>
                Modo <strong>Stories</strong> selecionado — não é necessário preencher legenda.
              </span>
            </div>
          )}

          {/* 4. Data e Hora para Programar (opcional) */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <CalendarIcon className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Programar Data e Horário (Opcional)
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedClient) {
                      toast.warning('Selecione o cliente primeiro.');
                      return;
                    }
                    if (!selectedClient.defaultPostTime) {
                      toast.warning(
                        `O cliente "${selectedClient.name}" ainda não tem um horário padrão salvo no Banco de Dados (aba Instagram).`
                      );
                      return;
                    }
                    const now = new Date();
                    const targetTime = selectedClient.defaultPostTime;
                    const [hhStr, minStr] = targetTime.split(':');
                    const hh = Number(hhStr) || 0;
                    const min = Number(minStr) || 0;

                    const candidateToday = new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      now.getDate(),
                      hh,
                      min,
                      0
                    );

                    // Inteligência de horário: se o horário padrão de hoje já passou (ex: 07:00 da manhã),
                    // programa automaticamente para esse mesmo horário no DIA SEGUINTE (amanhã)!
                    const chosenDate =
                      candidateToday.getTime() > Date.now() + 60_000
                        ? candidateToday
                        : new Date(
                            now.getFullYear(),
                            now.getMonth(),
                            now.getDate() + 1,
                            hh,
                            min,
                            0
                          );

                    const yyyy = chosenDate.getFullYear();
                    const mm = String(chosenDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(chosenDate.getDate()).padStart(2, '0');
                    const dateStr = `${yyyy}-${mm}-${dd}`;
                    const isTomorrow = chosenDate.getDate() !== now.getDate();

                    setScheduleDate(dateStr);
                    setScheduleTime(targetTime);

                    if (isTomorrow) {
                      toast.success(
                        `Como ${targetTime} de hoje já passou, programamos para amanhã (${dd}/${mm}) às ${targetTime}!`
                      );
                    } else {
                      toast.success(
                        `Horário do cliente preenchido: Hoje (${dd}/${mm}) às ${targetTime}!`
                      );
                    }
                  }}
                  className="h-7 px-3 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 text-[11px] font-black flex items-center gap-1.5 transition-all shadow-sm"
                  title="Puxa o horário do cliente no Banco de Dados (se o horário de hoje já passou, agenda para amanhã automaticamente)"
                >
                  <Clock className="w-3.5 h-3.5 text-purple-300" />
                  Horário do Cliente
                  {selectedClient?.defaultPostTime ? ` (${selectedClient.defaultPostTime})` : ''}
                </button>
              </div>

              {scheduleDate && (
                <button
                  type="button"
                  onClick={() => {
                    setScheduleDate('');
                    setScheduleTime('');
                  }}
                  className="text-[11px] text-white/40 hover:text-white underline"
                >
                  Limpar agendamento (postar na hora)
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase ml-1">
                  Data da Postagem
                </label>
                <Input
                  type="date"
                  value={scheduleDate}
                  onChange={e => {
                    setScheduleDate(e.target.value);
                    if (e.target.value && !scheduleTime) {
                      setScheduleTime('09:00');
                    }
                  }}
                  className="bg-white/5 border-white/10 rounded-xl h-11 text-xs text-white [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/40 uppercase ml-1">
                  Horário
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                    className="bg-white/5 border-white/10 rounded-xl h-11 pl-9 text-xs text-white [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-white/40">
              Se você escolher uma data/horário futuro, ele vai para a coluna{' '}
              <strong className="text-purple-300">Programado</strong> e, assim que der o horário, move sozinho para{' '}
              <strong className="text-emerald-300">Postado</strong>.
            </p>

            {/* Repetição Diária de Ofertas (ex: até o dia 30) */}
            <div className="pt-3 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                    <Flame className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      Repetir Postagem Diária (Ofertas)
                    </h5>
                    <p className="text-[10px] text-white/50">
                      Posta todos os dias até a data final da promoção (ex: até dia 30)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !isRecurring;
                    setIsRecurring(next);
                    if (next && !repeatUntilDate) {
                      const base = scheduleDate ? new Date(scheduleDate) : new Date();
                      base.setDate(base.getDate() + 3);
                      const yyyy = base.getFullYear();
                      const mm = String(base.getMonth() + 1).padStart(2, '0');
                      const dd = String(base.getDate()).padStart(2, '0');
                      setRepeatUntilDate(`${yyyy}-${mm}-${dd}`);
                      if (!scheduleDate) {
                        const now = new Date();
                        setScheduleDate(
                          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
                            now.getDate()
                          ).padStart(2, '0')}`
                        );
                      }
                      if (!scheduleTime) setScheduleTime(selectedClient?.defaultPostTime || '09:00');
                    }
                  }}
                  className={`h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isRecurring
                      ? 'bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/25'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  {isRecurring ? 'Repetição Ativada ✓' : 'Ativar Repetição Diária'}
                </button>
              </div>

              {isRecurring && (
                <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/25 space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-orange-300 uppercase ml-1">
                        Oferta Válida Até o Dia:
                      </label>
                      <Input
                        type="date"
                        value={repeatUntilDate}
                        onChange={e => setRepeatUntilDate(e.target.value)}
                        className="bg-black/40 border-orange-500/30 rounded-xl h-11 text-xs text-white [color-scheme:dark]"
                      />
                    </div>

                    <div className="flex flex-col justify-center">
                      {recurringSummary ? (
                        <div className="text-xs text-orange-200 bg-orange-500/20 rounded-lg p-2.5 border border-orange-500/30 space-y-1">
                          <p className="font-black flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-orange-300 shrink-0" />
                            {recurringSummary.daysCount} postagens diárias programadas!
                          </p>
                          <p className="text-[11px] text-orange-200/80">
                            De <strong>{recurringSummary.startFormatted}</strong> até{' '}
                            <strong>{recurringSummary.endFormatted}</strong> todos os dias às{' '}
                            <strong>{scheduleTime || '09:00'}</strong>.
                          </p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-orange-300/70 pt-2">
                          Selecione uma data final válida para calcular os dias da oferta.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:px-6 sm:py-4 bg-[#1C1C1E] border-t border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await onDeletePost(post.id);
                toast.success(
                  post.status === 'programado'
                    ? 'Agendamento cancelado no Post for Me e removido da fila!'
                    : 'Card removido da Central de Postagem.'
                );
                onOpenChange(false);
              }}
              className="h-10 px-3 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">
                {post.status === 'programado'
                  ? 'Cancelar Agendamento e Excluir'
                  : 'Excluir do Painel'}
              </span>
              <span className="sm:hidden">Excluir</span>
            </Button>

            {post.status === 'postado' && (
              <a
                href={
                  post.permalink ||
                  (selectedClient?.instagramUsername
                    ? `https://www.instagram.com/${selectedClient.instagramUsername.replace(/^@/, '')}/`
                    : 'https://www.instagram.com/')
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-pink-400"
                title="A Meta exige que posts já publicados no feed sejam apagados clicando nos 3 pontinhos dentro do próprio Instagram"
              >
                <span className="hidden sm:inline">Abrir no Instagram (Apagar do Feed)</span>
                <span className="sm:hidden">Instagram</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveDraft}
              className="flex-1 sm:flex-initial h-11 sm:h-10 px-4 rounded-xl text-xs font-bold"
            >
              Salvar Rascunho
            </Button>

            <Button
              type="button"
              onClick={handlePublishOrSchedule}
              disabled={isSubmitting}
              className={`flex-1 sm:flex-initial h-11 sm:h-10 px-5 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-lg ${
                isRecurring
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'
                  : 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-500 hover:to-orange-400'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isRecurring ? (
                <Flame className="w-4 h-4 mr-2" />
              ) : isScheduledFuture ? (
                <CalendarIcon className="w-4 h-4 mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isRecurring
                ? `Programar (${recurringSummary?.daysCount || 1}d)`
                : isScheduledFuture
                  ? 'Programar'
                  : 'Postar Agora'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
