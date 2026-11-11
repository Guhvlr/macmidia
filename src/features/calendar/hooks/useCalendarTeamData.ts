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
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', LINKS_SETTINGS_KEY)
          .maybeSingle();
        if (mounted && data?.value) {
          const parsed = JSON.parse(data.value);
          if (parsed && typeof parsed === 'object') {
            setLinks(parsed);
            localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(parsed));
          }
        }
      } catch {
        // fallback local
      }
    };
    fetchLinks();

    const channel = supabase
      .channel('calendar_team_links_sync')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: `key=eq.${LINKS_SETTINGS_KEY}`,
        },
        payload => {
          if (payload.new && (payload.new as any).value) {
            try {
              const parsed = JSON.parse((payload.new as any).value);
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
    try {
      await supabase.from('settings').upsert({
        key: LINKS_SETTINGS_KEY,
        value: JSON.stringify(next),
      });
    } catch (err) {
      console.warn('Erro ao salvar vínculo de equipe no Supabase:', err);
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
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', settingsKey)
          .maybeSingle();
        if (mounted && data?.value) {
          const parsed = JSON.parse(data.value);
          if (parsed && typeof parsed === 'object') {
            setLoadout({
              notes: parsed.notes || '',
              items: Array.isArray(parsed.items) ? parsed.items : [],
              folders: Array.isArray(parsed.folders) ? parsed.folders : [],
              updatedAt: parsed.updatedAt,
            });
            localStorage.setItem(storageKey, JSON.stringify(parsed));
          }
        }
      } catch {
        // fallback local
      }
    };
    fetchRemote();

    const channel = supabase
      .channel(`emp_loadout_${employeeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: `key=eq.${settingsKey}`,
        },
        payload => {
          if (payload.new && (payload.new as any).value) {
            try {
              const parsed = JSON.parse((payload.new as any).value);
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
      try {
        await supabase.from('settings').upsert({
          key: settingsKey,
          value: JSON.stringify(withTime),
        });
      } catch (err) {
        console.warn('Erro ao salvar loadout no Supabase:', err);
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
