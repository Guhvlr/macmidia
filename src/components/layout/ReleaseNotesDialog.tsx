import React, { useEffect, useState } from 'react';
import { Rocket, CheckCircle2, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/useApp';
import { supabase } from '@/integrations/supabase/client';
import { CURRENT_RELEASE_NOTE } from '@/config/releaseNotes';

export function ReleaseNotesDialog() {
  const { isAuthenticated, isAuthLoading, loggedUserId, loggedUserRole, systemUsers } = useApp();
  const [open, setOpen] = useState(false);

  const release = CURRENT_RELEASE_NOTE;
  const settingsKey = `release_seen_${release.id}`;
  const localKey = loggedUserId ? `macmidia_release_seen_${release.id}_${loggedUserId}` : '';

  useEffect(() => {
    if (
      !release.enabled ||
      !release.id ||
      release.items.length === 0 ||
      isAuthLoading ||
      !isAuthenticated ||
      !loggedUserId ||
      systemUsers.length === 0
    ) {
      setOpen(false);
      return;
    }

    // Não exibe notas internas de atualização para clientes visitantes (GUEST)
    if (loggedUserRole === 'GUEST') {
      setOpen(false);
      return;
    }

    // 1. Verificação instantânea no navegador para este usuário específico
    if (localKey && localStorage.getItem(localKey) === '1') {
      setOpen(false);
      return;
    }

    let cancelled = false;

    // 2. Verificação no banco (Supabase settings) para garantir 1 única exibição por usuário cadastrado
    const verifyUserSeenStatus = async () => {
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', settingsKey)
          .maybeSingle();

        if (cancelled) return;

        if (data?.value) {
          try {
            const seenUserIds: string[] = JSON.parse(data.value);
            if (Array.isArray(seenUserIds) && seenUserIds.includes(loggedUserId)) {
              localStorage.setItem(localKey, '1');
              setOpen(false);
              return;
            }
          } catch {
            // JSON inválido, segue para exibir
          }
        }

        setOpen(true);
      } catch {
        if (!cancelled) {
          setOpen(true);
        }
      }
    };

    verifyUserSeenStatus();

    return () => {
      cancelled = true;
    };
  }, [
    release.enabled,
    release.id,
    release.items.length,
    isAuthLoading,
    isAuthenticated,
    loggedUserId,
    loggedUserRole,
    systemUsers.length,
    localKey,
    settingsKey,
  ]);

  const handleConfirm = async () => {
    setOpen(false);
    if (!loggedUserId) return;

    if (localKey) {
      localStorage.setItem(localKey, '1');
    }

    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', settingsKey)
        .maybeSingle();

      let seenUserIds: string[] = [];
      if (data?.value) {
        try {
          const parsed = JSON.parse(data.value);
          if (Array.isArray(parsed)) {
            seenUserIds = parsed;
          }
        } catch {
          seenUserIds = [];
        }
      }

      if (!seenUserIds.includes(loggedUserId)) {
        seenUserIds.push(loggedUserId);
        await supabase.from('settings').upsert({
          key: settingsKey,
          value: JSON.stringify(seenUserIds),
        });
      }
    } catch (err) {
      console.error('Erro ao registrar leitura da atualização:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#121214] border border-[#29292e] rounded-2xl shadow-2xl overflow-hidden font-sans relative">
        <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
              <Rocket className="w-5 h-5 text-red-500" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
                  {release.title}
                </h2>
                {release.date && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                    {release.date}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Confira o que foi atualizado no sistema:
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {release.items.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-[13px] text-zinc-200 leading-relaxed"
              >
                <Sparkles className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-[13px] font-bold transition-all shadow-md active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              OK, Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
