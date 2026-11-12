import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LINKS_STORAGE_KEY = '@macmidia:calendar_client_employee_links';
const LINKS_SETTINGS_KEY = 'calendar_client_employee_links';

export interface LoadoutChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  date?: string; // YYYY-MM-DD
  clientId?: string;
  clientName?: string;
  createdAt: string;
}

export interface LoadoutFolderClient {
  id: string;
  name: string;
  clientId?: string;
  completed: boolean;
  completedAt?: string;
}

export interface LoadoutFolder {
  id: string;
  title: string; // Ex: "Dia Nacional do Café", "Consciência Negra"
  date?: string; // YYYY-MM-DD
  clients: LoadoutFolderClient[];
  createdAt: string;
}

export interface EmployeeCalendarLoadout {
  notes: string;
  items: LoadoutChecklistItem[];
  folders: LoadoutFolder[];
  updatedAt?: string;
}

/**
 * Gerencia o vínculo entre Clientes do Calendário e Funcionários da Equipe
 * (persistido em Supabase `settings` + `localStorage`).
 */
export function useCalendarTeamLinks() {
  const [links, setLinks] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem(LINKS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    let mounted = true;
    const fetchLinks = async () => {
      try {
        // 1. Tenta buscar em social_posts (onde membros e visitantes têm permissão completa de leitura)
        const { data: postRow } = await (supabase as any)
          .from('social_posts')
          .select('caption')
          .eq('provider', 'system_team_links')
          .eq('title', LINKS_SETTINGS_KEY)
          .maybeSingle();

        let parsed: any = null;
        if (postRow?.caption) {
          try {
            parsed = JSON.parse(postRow.caption);
          } catch {
            // ignore
          }
        }

        // 2. Fallback para settings (legado)
        if (!parsed) {
          const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', LINKS_SETTINGS_KEY)
            .maybeSingle();
          if (data?.value) {
            try {
              parsed = JSON.parse(data.value);
            } catch {
              // ignore
            }
          }
        }

        if (mounted && parsed && typeof parsed === 'object') {
          setLinks(parsed);
          localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(parsed));
        }
      } catch {
        // fallback local
      }
    };
    fetchLinks();

    // Sincroniza em tempo real via tabela social_posts (aberta para toda a equipe)
    const channel = supabase
      .channel('calendar_team_links_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_posts',
          filter: `title=eq.${LINKS_SETTINGS_KEY}`,
        },
        payload => {
          const newRow = payload.new as any;
          if (newRow && newRow.provider === 'system_team_links' && newRow.caption) {
            try {
              const parsed = JSON.parse(newRow.caption);
              if (parsed && typeof parsed === 'object') {
                setLinks(parsed);
                localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(parsed));
              }
            } catch {
              // ignore
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const saveLinks = useCallback(async (next: Record<string, string[]>) => {
    setLinks(next);
    localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(next));

    // Salva em social_posts (aberto para todos os papéis: ADMIN, USER, GUEST)
    try {
      const { data: existing } = await (supabase as any)
        .from('social_posts')
        .select('id')
        .eq('provider', 'system_team_links')
        .eq('title', LINKS_SETTINGS_KEY)
        .maybeSingle();

      if (existing?.id) {
        await (supabase as any)
          .from('social_posts')
          .update({
            caption: JSON.stringify(next),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await (supabase as any)
          .from('social_posts')
          .insert({
            provider: 'system_team_links',
            title: LINKS_SETTINGS_KEY,
            caption: JSON.stringify(next),
            status: 'para_postar',
            placement: 'feed',
          });
      }
    } catch (err) {
      console.warn('Erro ao salvar vínculos no social_posts:', err);
    }

    // Backup silencioso em settings (se admin)
    try {
      await supabase.from('settings').upsert({
        key: LINKS_SETTINGS_KEY,
        value: JSON.stringify(next),
      });
    } catch {
      // Ignora erro de permissão para não-admins
    }
  }, []);

  const toggleClientEmployee = useCallback(
    async (clientId: string, employeeId: string) => {
      const current = links[clientId] || [];
      const exists = current.includes(employeeId);
      const updatedForClient = exists
        ? current.filter(id => id !== employeeId)
        : [...current, employeeId];
      const next = {
        ...links,
        [clientId]: updatedForClient,
      };
      await saveLinks(next);
    },
    [links, saveLinks]
  );

  const setClientEmployees = useCallback(
    async (clientId: string, employeeIds: string[]) => {
      const next = {
        ...links,
        [clientId]: employeeIds,
      };
      await saveLinks(next);
    },
    [links, saveLinks]
  );

  const getClientEmployees = useCallback(
    (clientId: string): string[] => {
      return links[clientId] || [];
    },
    [links]
  );

  const getEmployeeClients = useCallback(
    (employeeId: string): string[] => {
      return Object.entries(links)
        .filter(([, empIds]) => Array.isArray(empIds) && empIds.includes(employeeId))
        .map(([clientId]) => clientId);
    },
    [links]
  );

  return {
    links,
    toggleClientEmployee,
    setClientEmployees,
    getClientEmployees,
    getEmployeeClients,
  };
}

/**
 * Gerencia o Checklist + Rascunho (Loadout) sempre visível de um funcionário específico.
 */
export function useEmployeeCalendarLoadout(employeeId?: string) {
  const storageKey = `@macmidia:emp_loadout_${employeeId || 'default'}`;
  const settingsKey = `emp_calendar_loadout_${employeeId || 'default'}`;

  const [loadout, setLoadout] = useState<EmployeeCalendarLoadout>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          notes: parsed.notes || '',
          items: Array.isArray(parsed.items) ? parsed.items : [],
          folders: Array.isArray(parsed.folders) ? parsed.folders : [],
          updatedAt: parsed.updatedAt,
        };
      }
      return { notes: '', items: [], folders: [] };
    } catch {
      return { notes: '', items: [], folders: [] };
    }
  });

  useEffect(() => {
    if (!employeeId) return;
    // Carrega do localStorage imediatamente ao trocar de funcionário
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setLoadout({
          notes: parsed.notes || '',
          items: Array.isArray(parsed.items) ? parsed.items : [],
          folders: Array.isArray(parsed.folders) ? parsed.folders : [],
          updatedAt: parsed.updatedAt,
        });
      } else {
        setLoadout({ notes: '', items: [], folders: [] });
      }
    } catch {
      setLoadout({ notes: '', items: [], folders: [] });
    }

    let mounted = true;
    const fetchRemote = async () => {
      try {
        // 1. Tenta carregar de social_posts (onde todos os membros e visitantes têm permissão garantida)
        const { data: postRow } = await (supabase as any)
          .from('social_posts')
          .select('caption')
          .eq('provider', 'system_loadout')
          .eq('title', settingsKey)
          .maybeSingle();

        let parsed: any = null;
        if (postRow?.caption) {
          try {
            parsed = JSON.parse(postRow.caption);
          } catch {
            // ignore
          }
        }

        // 2. Se não encontrou em social_posts, tenta fallback em settings (legado)
        if (!parsed) {
          const { data: settingsRow } = await supabase
            .from('settings')
            .select('value')
            .eq('key', settingsKey)
            .maybeSingle();
          if (settingsRow?.value) {
            try {
              parsed = JSON.parse(settingsRow.value);
            } catch {
              // ignore
            }
          }
        }

        // Verifica se há dados locais salvos previamente
        const localRaw = localStorage.getItem(storageKey);
        let localData: any = null;
        if (localRaw) {
          try {
            localData = JSON.parse(localRaw);
          } catch {
            // ignore
          }
        }
        const hasLocalData =
          localData &&
          ((Array.isArray(localData.folders) && localData.folders.length > 0) ||
            (Array.isArray(localData.items) && localData.items.length > 0) ||
            Boolean(localData.notes));

        const hasRemoteData =
          parsed &&
          ((Array.isArray(parsed.folders) && parsed.folders.length > 0) ||
            (Array.isArray(parsed.items) && parsed.items.length > 0) ||
            Boolean(parsed.notes));

        // Se o banco remoto ainda estiver vazio mas o usuário tem dados locais, sobe para o banco
        if (!hasRemoteData && hasLocalData) {
          persistLoadout(localData);
          return;
        }

        if (mounted && parsed && typeof parsed === 'object') {
          const remoteData: EmployeeCalendarLoadout = {
            notes: parsed.notes || '',
            items: Array.isArray(parsed.items) ? parsed.items : [],
            folders: Array.isArray(parsed.folders) ? parsed.folders : [],
            updatedAt: parsed.updatedAt,
          };
          setLoadout(remoteData);
          localStorage.setItem(storageKey, JSON.stringify(remoteData));
        }
      } catch (err) {
        console.warn('Erro ao carregar loadout remoto:', err);
      }
    };
    fetchRemote();

    // Sincronização em tempo real via tabela social_posts (aberta para toda a equipe)
    const channel = supabase
      .channel(`emp_loadout_${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_posts',
          filter: `title=eq.${settingsKey}`,
        },
        payload => {
          const newRow = payload.new as any;
          if (newRow && newRow.provider === 'system_loadout' && newRow.caption) {
            try {
              const parsed = JSON.parse(newRow.caption);
              if (parsed && typeof parsed === 'object') {
                setLoadout({
                  notes: parsed.notes || '',
                  items: Array.isArray(parsed.items) ? parsed.items : [],
                  folders: Array.isArray(parsed.folders) ? parsed.folders : [],
                  updatedAt: parsed.updatedAt,
                });
                localStorage.setItem(storageKey, JSON.stringify(parsed));
              }
            } catch {
              // ignore
            }
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [employeeId, settingsKey, storageKey]);

  const persistLoadout = useCallback(
    async (next: EmployeeCalendarLoadout) => {
      const withTime = { ...next, updatedAt: new Date().toISOString() };
      setLoadout(withTime);
      localStorage.setItem(storageKey, JSON.stringify(withTime));
      if (!employeeId) return;

      // 1. Salva em social_posts (onde membros USER e GUEST têm permissão total de INSERT/UPDATE)
      try {
        const { data: existing } = await (supabase as any)
          .from('social_posts')
          .select('id')
          .eq('provider', 'system_loadout')
          .eq('title', settingsKey)
          .maybeSingle();

        if (existing?.id) {
          await (supabase as any)
            .from('social_posts')
            .update({
              caption: JSON.stringify(withTime),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await (supabase as any)
            .from('social_posts')
            .insert({
              provider: 'system_loadout',
              title: settingsKey,
              caption: JSON.stringify(withTime),
              status: 'para_postar',
              placement: 'feed',
            });
        }
      } catch (err) {
        console.warn('Erro ao salvar loadout em social_posts:', err);
      }

      // 2. Backup secundário em settings (se admin)
      try {
        await supabase.from('settings').upsert({
          key: settingsKey,
          value: JSON.stringify(withTime),
        });
      } catch {
        // Ignora erro de RLS para não-admins
      }
    },
    [employeeId, settingsKey, storageKey]
  );

  const addChecklistItem = useCallback(
    (params: { text: string; date?: string; clientId?: string; clientName?: string }) => {
      if (!params.text.trim()) return;
      const newItem: LoadoutChecklistItem = {
        id: crypto.randomUUID(),
        text: params.text.trim(),
        completed: false,
        date: params.date || undefined,
        clientId: params.clientId || undefined,
        clientName: params.clientName || undefined,
        createdAt: new Date().toISOString(),
      };
      persistLoadout({
        ...loadout,
        items: [newItem, ...loadout.items],
      });
    },
    [loadout, persistLoadout]
  );

  const toggleChecklistItem = useCallback(
    (itemId: string) => {
      const nextItems = loadout.items.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      );
      persistLoadout({
        ...loadout,
        items: nextItems,
      });
    },
    [loadout, persistLoadout]
  );

  const updateChecklistItemDate = useCallback(
    (itemId: string, date: string) => {
      const nextItems = loadout.items.map(item =>
        item.id === itemId ? { ...item, date: date || undefined } : item
      );
      persistLoadout({
        ...loadout,
        items: nextItems,
      });
    },
    [loadout, persistLoadout]
  );

  const removeChecklistItem = useCallback(
    (itemId: string) => {
      const nextItems = loadout.items.filter(item => item.id !== itemId);
      persistLoadout({
        ...loadout,
        items: nextItems,
      });
    },
    [loadout, persistLoadout]
  );

  const clearCompletedItems = useCallback(() => {
    const nextItems = loadout.items.filter(item => !item.completed);
    persistLoadout({
      ...loadout,
      items: nextItems,
    });
  }, [loadout, persistLoadout]);

  const updateNotes = useCallback(
    (notes: string) => {
      persistLoadout({
        ...loadout,
        notes,
      });
    },
    [loadout, persistLoadout]
  );

  const addFolder = useCallback(
    (title: string, date?: string) => {
      if (!title.trim()) return;
      const newFolder: LoadoutFolder = {
        id: crypto.randomUUID(),
        title: title.trim(),
        date: date || undefined,
        clients: [],
        createdAt: new Date().toISOString(),
      };
      persistLoadout({
        ...loadout,
        folders: [newFolder, ...(loadout.folders || [])],
      });
    },
    [loadout, persistLoadout]
  );

  const removeFolder = useCallback(
    (folderId: string) => {
      const nextFolders = (loadout.folders || []).filter(f => f.id !== folderId);
      persistLoadout({
        ...loadout,
        folders: nextFolders,
      });
    },
    [loadout, persistLoadout]
  );

  const addClientToFolder = useCallback(
    (folderId: string, clientName: string, clientId?: string) => {
      if (!clientName.trim()) return;
      const nextFolders = (loadout.folders || []).map(f => {
        if (f.id !== folderId) return f;
        const exists = f.clients.some(
          c =>
            (clientId && c.clientId === clientId) ||
            c.name.toLowerCase() === clientName.trim().toLowerCase()
        );
        if (exists) return f;
        const newClient: LoadoutFolderClient = {
          id: crypto.randomUUID(),
          name: clientName.trim(),
          clientId: clientId || undefined,
          completed: false,
        };
        return {
          ...f,
          clients: [...f.clients, newClient],
        };
      });
      persistLoadout({
        ...loadout,
        folders: nextFolders,
      });
    },
    [loadout, persistLoadout]
  );

  const addMultipleClientsToFolder = useCallback(
    (folderId: string, clientsToAdd: { id?: string; name: string }[]) => {
      const nextFolders = (loadout.folders || []).map(f => {
        if (f.id !== folderId) return f;
        const existingNames = new Set(f.clients.map(c => c.name.toLowerCase()));
        const existingIds = new Set(f.clients.map(c => c.clientId).filter(Boolean));
        const newEntries: LoadoutFolderClient[] = [];
        for (const item of clientsToAdd) {
          if (!item.name.trim()) continue;
          if (existingNames.has(item.name.toLowerCase())) continue;
          if (item.id && existingIds.has(item.id)) continue;
          newEntries.push({
            id: crypto.randomUUID(),
            name: item.name.trim(),
            clientId: item.id || undefined,
            completed: false,
          });
        }
        return {
          ...f,
          clients: [...f.clients, ...newEntries],
        };
      });
      persistLoadout({
        ...loadout,
        folders: nextFolders,
      });
    },
    [loadout, persistLoadout]
  );

  const toggleClientInFolder = useCallback(
    (folderId: string, clientFolderId: string) => {
      const nextFolders = (loadout.folders || []).map(f => {
        if (f.id !== folderId) return f;
        return {
          ...f,
          clients: f.clients.map(c =>
            c.id === clientFolderId
              ? {
                  ...c,
                  completed: !c.completed,
                  completedAt: !c.completed ? new Date().toISOString() : undefined,
                }
              : c
          ),
        };
      });
      persistLoadout({
        ...loadout,
        folders: nextFolders,
      });
    },
    [loadout, persistLoadout]
  );

  const removeClientFromFolder = useCallback(
    (folderId: string, clientFolderId: string) => {
      const nextFolders = (loadout.folders || []).map(f => {
        if (f.id !== folderId) return f;
        return {
          ...f,
          clients: f.clients.filter(c => c.id !== clientFolderId),
        };
      });
      persistLoadout({
        ...loadout,
        folders: nextFolders,
      });
    },
    [loadout, persistLoadout]
  );

  return {
    loadout,
    addChecklistItem,
    toggleChecklistItem,
    updateChecklistItemDate,
    removeChecklistItem,
    clearCompletedItems,
    updateNotes,
    addFolder,
    removeFolder,
    addClientToFolder,
    addMultipleClientsToFolder,
    toggleClientInFolder,
    removeClientFromFolder,
  };
}
