import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Instagram,
  CheckCircle2,
  RefreshCw,
  Unlink,
  Loader2,
  KeyRound,
  Search,
  Facebook,
  ShieldAlert,
  Clock,
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
import { toast } from 'sonner';
import type { CalendarClient } from '@/contexts/app-types';
import {
  getStoredPostForMeApiKey,
  PostForMeAccount,
  savePostForMeApiKey,
  socialProvider,
} from '../api/socialProvider';

interface ClientInstagramSectionProps {
  client: CalendarClient;
  onUpdateClient: (id: string, updates: Partial<CalendarClient>) => Promise<void>;
}

export const ClientInstagramSection: React.FC<ClientInstagramSectionProps> = ({
  client,
  onUpdateClient,
}) => {
  const [username, setUsername] = useState(client.instagramUsername || '');
  const [accountId, setAccountId] = useState(client.postformeAccountId || '');
  const [facebookName, setFacebookName] = useState(client.facebookPageName || '');
  const [facebookAccountId, setFacebookAccountId] = useState(
    client.postformeFacebookAccountId || ''
  );
  const [defaultTime, setDefaultTime] = useState(client.defaultPostTime || '');

  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Conta pendente de confirmação ao clicar na lista
  const [pendingAccount, setPendingAccount] = useState<PostForMeAccount | null>(null);

  // API Key e contas carregadas do Post for Me
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiKeyBox, setShowApiKeyBox] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<PostForMeAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  const normalizeHandle = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
  };

  const loadAccountsFromPostForMe = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const res = await socialProvider.listAccounts();
      if (res.ok && res.data?.accounts) {
        const sorted = [...res.data.accounts].sort((a, b) => {
          const aIg = String(a.platform || '').toLowerCase().includes('instagram') ? 0 : 1;
          const bIg = String(b.platform || '').toLowerCase().includes('instagram') ? 0 : 1;
          if (aIg !== bIg) return aIg - bIg;
          return String(a.username || a.name || '').localeCompare(
            String(b.username || b.name || '')
          );
        });
        setAvailableAccounts(sorted);
      }
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    setUsername(client.instagramUsername || '');
    setAccountId(client.postformeAccountId || '');
    setFacebookName(client.facebookPageName || '');
    setFacebookAccountId(client.postformeFacebookAccountId || '');
    setDefaultTime(client.defaultPostTime || '');
    getStoredPostForMeApiKey().then(key => {
      const exists = Boolean(key);
      setHasApiKey(exists);
      if (key) {
        setApiKeyInput(key);
        loadAccountsFromPostForMe();
      }
    });
  }, [
    client.id,
    client.instagramUsername,
    client.postformeAccountId,
    client.facebookPageName,
    client.postformeFacebookAccountId,
    client.defaultPostTime,
    loadAccountsFromPostForMe,
  ]);

  const handleSaveApiKeyHere = async () => {
    if (!apiKeyInput.trim()) {
      toast.warning('Cole a Chave de API gerada lá em "Chaves de API" no Post for Me.');
      return;
    }
    setIsSavingKey(true);
    try {
      await savePostForMeApiKey(apiKeyInput.trim());
      setHasApiKey(true);
      setShowApiKeyBox(false);
      toast.success('Chave de API salva! Carregando suas contas do Post for Me...');
      await loadAccountsFromPostForMe();
    } finally {
      setIsSavingKey(false);
    }
  };

  const hasIg = Boolean(client.postformeAccountId || client.instagramUsername || accountId);
  const hasFb = Boolean(
    client.postformeFacebookAccountId || client.facebookPageName || facebookAccountId
  );

  // Filtra as contas pelo campo de busca
  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase().replace(/^@/, '');
    if (!q) return availableAccounts;
    return availableAccounts.filter(acc => {
      const u = String(acc.username || '').toLowerCase();
      const n = String(acc.name || '').toLowerCase();
      const id = String(acc.id || '').toLowerCase();
      return u.includes(q) || n.includes(q) || id.includes(q);
    });
  }, [availableAccounts, accountSearch]);

  const handleConfirmSelectAccount = async () => {
    if (!pendingAccount) return;
    const acc = pendingAccount;
    const isIg = String(acc.platform || (acc as any).provider || '')
      .toLowerCase()
      .includes('instagram');

    setIsSaving(true);
    try {
      if (isIg) {
        const cleanHandle = normalizeHandle(acc.username || acc.name || acc.id);
        setUsername(cleanHandle);
        setAccountId(acc.id);
        await onUpdateClient(client.id, {
          instagramUsername: cleanHandle,
          postformeAccountId: acc.id,
          instagramConnectedAt: new Date().toISOString(),
        });
        toast.success(`Instagram ${cleanHandle} vinculado a ${client.name}!`);
      } else {
        const fbLabel = (acc.username || acc.name || acc.id).trim();
        setFacebookName(fbLabel);
        setFacebookAccountId(acc.id);
        await onUpdateClient(client.id, {
          facebookPageName: fbLabel,
          postformeFacebookAccountId: acc.id,
          instagramConnectedAt: client.instagramConnectedAt || new Date().toISOString(),
        });
        toast.success(`Facebook "${fbLabel}" vinculado a ${client.name}!`);
      }
      setPendingAccount(null);
    } catch {
      toast.error('Erro ao vincular conta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlinkInstagram = async () => {
    await onUpdateClient(client.id, {
      instagramUsername: undefined,
      postformeAccountId: undefined,
    });
    setUsername('');
    setAccountId('');
    toast.success('Conta do Instagram desvinculada.');
  };

  const handleUnlinkFacebook = async () => {
    await onUpdateClient(client.id, {
      facebookPageName: undefined,
      postformeFacebookAccountId: undefined,
    });
    setFacebookName('');
    setFacebookAccountId('');
    toast.success('Conta do Facebook desvinculada.');
  };

  const handleSyncConnection = async () => {
    setIsSyncing(true);
    try {
      await loadAccountsFromPostForMe();
      toast.success('Lista de contas atualizada do Post for Me!');
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingIsIg = pendingAccount
    ? String(pendingAccount.platform || (pendingAccount as any).provider || '')
        .toLowerCase()
        .includes('instagram')
    : false;
  const pendingLabel = pendingAccount
    ? pendingIsIg
      ? normalizeHandle(pendingAccount.username || pendingAccount.name || pendingAccount.id)
      : pendingAccount.username || pendingAccount.name || pendingAccount.id
    : '';

  return (
    <div className="space-y-6 pb-10">
      {/* Caixa da Chave de API do Post for Me (só aparece se não tiver chave salva) */}
      {(!hasApiKey || showApiKeyBox) && (
        <div className="rounded-2xl p-5 bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-300">
              <KeyRound className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-wider">
                Conectar Chave de API do Post for Me
              </span>
            </div>
            {hasApiKey && (
              <button
                type="button"
                onClick={() => setShowApiKeyBox(false)}
                className="text-xs text-white/50 hover:text-white"
              >
                Fechar
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="password"
              placeholder="Cole aqui a Chave de API..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              className="bg-black/40 border-white/15 rounded-xl h-11 text-xs font-mono text-white flex-1"
            />
            <Button
              type="button"
              onClick={handleSaveApiKeyHere}
              disabled={isSavingKey}
              className="h-11 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shrink-0"
            >
              {isSavingKey ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4 mr-2" />
              )}
              Salvar Chave e Carregar Contas
            </Button>
          </div>
        </div>
      )}

      {/* 2 Caixas no Topo: Conta do Instagram Vinculada + Conta do Facebook Vinculada */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card Instagram */}
        <div
          className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
            hasIg
              ? 'bg-pink-500/10 border-pink-500/35'
              : 'bg-white/[0.02] border-white/10'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                hasIg
                  ? 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shadow-md'
                  : 'bg-white/5 text-white/40'
              }`}
            >
              <Instagram className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Instagram
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    hasIg
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {hasIg ? 'Vinculado' : 'Não selecionado'}
                </span>
              </div>
              <p className="text-xs text-white/80 truncate mt-0.5 font-semibold">
                {hasIg
                  ? client.instagramUsername || username
                  : 'Selecione uma conta de Instagram abaixo'}
              </p>
            </div>
          </div>

          {hasIg && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUnlinkInstagram}
              className="h-8 px-2.5 rounded-lg text-[11px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
            >
              <Unlink className="w-3.5 h-3.5 mr-1" />
              Tirar
            </Button>
          )}
        </div>

        {/* Card Facebook */}
        <div
          className={`rounded-2xl p-4 border flex items-center justify-between gap-3 ${
            hasFb
              ? 'bg-blue-500/10 border-blue-500/35'
              : 'bg-white/[0.02] border-white/10'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                hasFb ? 'bg-blue-600 text-white shadow-md' : 'bg-white/5 text-white/40'
              }`}
            >
              <Facebook className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Facebook
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    hasFb
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-white/10 text-white/40'
                  }`}
                >
                  {hasFb ? 'Vinculado' : 'Não selecionado'}
                </span>
              </div>
              <p className="text-xs text-white/80 truncate mt-0.5 font-semibold">
                {hasFb
                  ? client.facebookPageName || facebookName
                  : 'Selecione uma página de Facebook abaixo'}
              </p>
            </div>
          </div>

          {hasFb && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUnlinkFacebook}
              className="h-8 px-2.5 rounded-lg text-[11px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
            >
              <Unlink className="w-3.5 h-3.5 mr-1" />
              Tirar
            </Button>
          )}
        </div>
      </div>

      {/* Horário Padrão de Postagem deste Cliente */}
      <div className="rounded-2xl p-4 bg-purple-500/10 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                Horário Padrão de Postagem deste Cliente
              </span>
              {client.defaultPostTime && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/30">
                  {client.defaultPostTime}
                </span>
              )}
            </div>
            <p className="text-[11px] text-white/60 mt-0.5">
              Defina o horário fixo que este cliente costuma postar (ex: <strong>20:00</strong>). Lá
              no Auto Post, basta clicar em <strong>"Horário do Cliente"</strong> para puxar o dia
              de hoje nesse horário!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Input
            type="time"
            value={defaultTime}
            onChange={e => setDefaultTime(e.target.value)}
            className="w-32 h-10 bg-black/40 border-white/15 rounded-xl text-xs font-bold text-white"
          />
          <Button
            type="button"
            disabled={isSaving}
            onClick={async () => {
              setIsSaving(true);
              try {
                await onUpdateClient(client.id, {
                  defaultPostTime: defaultTime || undefined,
                });
                toast.success(
                  defaultTime
                    ? `Horário padrão (${defaultTime}) salvo para ${client.name}!`
                    : `Horário padrão removido de ${client.name}.`
                );
              } finally {
                setIsSaving(false);
              }
            }}
            className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-wider shadow-md"
          >
            Salvar Horário
          </Button>
        </div>
      </div>

      {/* Lista de contas do Post for Me para pesquisar e selecionar */}
      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Contas Disponíveis no Post for Me ({availableAccounts.length})
            </h4>
            <p className="text-[11px] text-white/50 mt-0.5">
              Pesquise e clique na conta de <strong className="text-pink-400">Instagram</strong> e na
              conta de <strong className="text-blue-400">Facebook</strong> de{' '}
              <strong className="text-white">{client.name}</strong>:
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-white/30 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={accountSearch}
                onChange={e => setAccountSearch(e.target.value)}
                placeholder="Pesquisar conta ex: macmidia..."
                className="h-9 pl-8 bg-black/40 border-white/10 rounded-xl text-xs text-white"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSyncConnection}
              disabled={isSyncing || isLoadingAccounts}
              className="h-9 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
              title="Recarregar contas do Post for Me"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${
                  isSyncing || isLoadingAccounts ? 'animate-spin' : ''
                }`}
              />
              Atualizar
            </Button>
          </div>
        </div>

        {isLoadingAccounts ? (
          <div className="py-12 flex items-center justify-center text-white/40 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
            Carregando contas conectadas no Post for Me...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-white/10 rounded-xl text-xs text-white/40">
            Nenhuma conta encontrada com "{accountSearch}".
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1"
            onWheel={e => e.stopPropagation()}
          >
            {filteredAccounts.map(acc => {
              const isIg = String(acc.platform || (acc as any).provider || '')
                .toLowerCase()
                .includes('instagram');
              const isSelected = isIg
                ? accountId === acc.id || client.postformeAccountId === acc.id
                : facebookAccountId === acc.id || client.postformeFacebookAccountId === acc.id;
              const label = acc.username || acc.name || acc.id;

              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => setPendingAccount(acc)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
                    isSelected
                      ? isIg
                        ? 'bg-pink-500/25 border-pink-500 text-white shadow-md'
                        : 'bg-blue-500/25 border-blue-500 text-white shadow-md'
                      : 'bg-black/30 border-white/10 text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className={`inline-block text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        isIg ? 'bg-pink-500/25 text-pink-300' : 'bg-blue-500/25 text-blue-300'
                      }`}
                    >
                      {isIg ? 'Instagram' : 'Facebook'}
                    </span>
                    <span className="text-xs font-bold truncate">{label}</span>
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmação ao clicar em uma conta */}
      <Dialog
        open={Boolean(pendingAccount)}
        onOpenChange={open => {
          if (!open) setPendingAccount(null);
        }}
      >
        <DialogContent className="max-w-md bg-[#141417] border-white/10 text-white rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-white">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Confirmar Vínculo de Conta?
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60 pt-1">
              Confira se você clicou na conta certa antes de vincular a este cliente:
            </DialogDescription>
          </DialogHeader>

          {pendingAccount && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/45 font-semibold">Cliente no Sistema:</span>
                  <strong className="text-white font-black">{client.name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/45 font-semibold">Rede Social:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      pendingIsIg
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {pendingIsIg ? 'Instagram' : 'Facebook'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/45 font-semibold">Conta Selecionada:</span>
                  <strong
                    className={`font-black ${pendingIsIg ? 'text-pink-400' : 'text-blue-400'}`}
                  >
                    {pendingLabel}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPendingAccount(null)}
                  className="h-10 px-4 rounded-xl text-xs font-bold text-white/70 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmSelectAccount}
                  className={`h-10 px-5 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-lg ${
                    pendingIsIg
                      ? 'bg-gradient-to-r from-pink-600 to-orange-500 hover:from-pink-500 hover:to-orange-400'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  )}
                  Confirmar Vínculo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
