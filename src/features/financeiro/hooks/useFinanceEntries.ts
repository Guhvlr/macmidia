import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/useApp';
import { FinanceEntry, FinanceFilters, FinanceMonthlySummary, FinanceProjectionRow, FinanceCategoryBreakdown } from '../types/finance-types';
import { getFifthBusinessDay } from '../utils/business-days';
import { calculateInstallmentDueDate } from '../utils/installment-dates';
import { toast } from 'sonner';

export function useFinanceEntries() {
  const { loggedUserId } = useApp();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async (month: number, year: number, filters?: FinanceFilters) => {
    if (!loggedUserId) return;
    setLoading(true);
    
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    
    try {
      let query = supabase
        .from('financial_entries')
        .select('*, category:financial_categories(*)')
        .eq('user_id', loggedUserId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.category) query = query.eq('category_id', filters.category);
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.paymentMethod) query = query.eq('payment_method', filters.paymentMethod);
      if (filters?.search) {
        query = query.or(`description.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEntries((data || []) as unknown as FinanceEntry[]);
    } catch (error: any) {
      console.error('Error fetching entries:', error);
      if (error?.message?.includes('does not exist')) {
        toast.error('Execute o script SQL no Supabase para criar as tabelas.');
      } else {
        toast.error('Erro ao carregar registros: ' + (error?.message || ''));
      }
    } finally {
      setLoading(false);
    }
  }, [loggedUserId]);

  const createEntry = async (data: Partial<FinanceEntry> & { is_salary_fifth_day?: boolean; is_installment?: boolean }) => {
    if (!loggedUserId) {
      toast.error('Usuário não autenticado.');
      return null;
    }
    try {
      const { category, id, created_at, updated_at, is_salary_fifth_day, is_installment, ...cleanData } = data as any;
      const totalMonths = Number(cleanData.recurring_months) || 1;
      const isRecurring = !!cleanData.is_recurring && totalMonths > 1;

      const groupId = isRecurring ? crypto.randomUUID() : null;
      const originalDueDay = cleanData.date ? parseInt(cleanData.date.split('-')[2], 10) : new Date().getDate();

      // Se for parcelado, ajusta a descrição da 1ª parcela
      let firstDescription = cleanData.description;
      if (isRecurring && is_installment) {
        firstDescription = `${cleanData.description} (1/${totalMonths})`;
      }

      const entryData = {
        user_id: loggedUserId,
        description: firstDescription,
        amount: Number(cleanData.amount) || 0,
        date: cleanData.date,
        type: cleanData.type || 'saida',
        category_id: cleanData.category_id && cleanData.category_id !== '' ? cleanData.category_id : null,
        status: cleanData.status || 'previsto',
        payment_method: cleanData.payment_method || '',
        client_name: cleanData.client_name || '',
        notes: cleanData.notes || '',
        is_recurring: isRecurring,
        recurring_months: isRecurring ? totalMonths : 0,
        installment_group_id: groupId,
        installment_number: isRecurring ? 1 : null,
        installment_total: isRecurring ? totalMonths : null,
        original_due_day: isRecurring ? originalDueDay : null
      };
      
      const { data: newEntry, error } = await supabase
        .from('financial_entries')
        .insert([entryData])
        .select('*, category:financial_categories(*)')
        .single();
        
      if (error) throw error;

      // Criar entradas recorrentes / parcelas futuras
      if (isRecurring) {
        const recurringEntries = [];
        
        for (let i = 1; i < totalMonths; i++) {
          let nextDateStr = '';
          if (is_salary_fifth_day) {
            const baseDate = new Date(cleanData.date + 'T12:00:00');
            let nextYear = baseDate.getFullYear();
            let nextMonth = baseDate.getMonth() + 1 + i;
            while (nextMonth > 12) {
              nextMonth -= 12;
              nextYear += 1;
            }
            nextDateStr = getFifthBusinessDay(nextYear, nextMonth);
          } else {
            nextDateStr = calculateInstallmentDueDate(cleanData.date, i);
          }

          let recDescription = cleanData.description;
          if (is_installment) {
            recDescription = `${cleanData.description} (${i + 1}/${totalMonths})`;
          }
          
          recurringEntries.push({
            user_id: loggedUserId,
            description: recDescription,
            amount: entryData.amount,
            date: nextDateStr,
            type: entryData.type,
            category_id: entryData.category_id,
            status: entryData.status, // Always 'previsto' for future? Using form status here.
            payment_method: entryData.payment_method,
            client_name: entryData.client_name,
            notes: entryData.notes,
            is_recurring: true,
            recurring_months: totalMonths - i,
            installment_group_id: groupId,
            installment_number: i + 1,
            installment_total: totalMonths,
            original_due_day: originalDueDay
          });
        }
        
        if (recurringEntries.length > 0) {
          const { error: recError } = await supabase
            .from('financial_entries')
            .insert(recurringEntries);
            
          if (recError) console.error('Error creating recurring entries:', recError);
        }
      }

      toast.success('Registro criado com sucesso!');
      return newEntry;
    } catch (error: any) {
      console.error('Error creating entry:', error);
      if (error?.message?.includes('does not exist')) {
        toast.error('Execute o script SQL no Supabase para criar as tabelas.');
      } else {
        toast.error(error?.message || 'Erro ao criar registro');
      }
      return null;
    }
  };

  const updateEntry = async (id: string, data: Partial<FinanceEntry> & { propagate_future?: boolean, is_salary_fifth_day?: boolean }) => {
    if (!loggedUserId) return null;
    try {
      // 1. Buscar o registro atual para ver se faz parte de um grupo
      const currentEntry = entries.find(e => e.id === id);
      if (!currentEntry) throw new Error("Registro não encontrado");

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (data.description !== undefined) updateData.description = data.description;
      if (data.amount !== undefined) updateData.amount = Number(data.amount) || 0;
      if (data.date !== undefined) updateData.date = data.date;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.category_id !== undefined) updateData.category_id = data.category_id || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
      if (data.client_name !== undefined) updateData.client_name = data.client_name;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.is_recurring !== undefined) updateData.is_recurring = data.is_recurring;
      
      const isGrouped = !!currentEntry.installment_group_id;
      const groupId = currentEntry.installment_group_id;
      const currentNumber = currentEntry.installment_number || 1;
      const oldTotal = currentEntry.installment_total || 1;
      let newTotal = data.recurring_months !== undefined ? data.recurring_months : oldTotal;

      // Converter para parcelado se antes não era (Teste D)
      if (!isGrouped && data.recurring_months && data.recurring_months > 1) {
        updateData.installment_group_id = crypto.randomUUID();
        updateData.installment_number = 1;
        updateData.installment_total = data.recurring_months;
        updateData.original_due_day = currentEntry.date ? parseInt(currentEntry.date.split('-')[2], 10) : new Date().getDate();
        updateData.recurring_months = data.recurring_months;
        newTotal = data.recurring_months;
      } else if (isGrouped && data.recurring_months !== undefined) {
        updateData.installment_total = newTotal;
        updateData.recurring_months = newTotal;
      }

      // Atualizar o registro principal
      const { data: updated, error } = await supabase
        .from('financial_entries')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', loggedUserId)
        .select('*, category:financial_categories(*)')
        .single();

      if (error) throw error;
      
      let finalUpdated = updated as unknown as FinanceEntry;

      // Se propagar para as próximas OU virou parcelado OU mudou a quantidade
      if (data.propagate_future || (!isGrouped && newTotal > 1) || (isGrouped && newTotal !== oldTotal)) {
        const activeGroupId = updateData.installment_group_id || groupId;
        const activeTotal = newTotal;
        
        // Buscar todas as parcelas do grupo
        const { data: groupEntries } = await supabase
          .from('financial_entries')
          .select('*')
          .eq('installment_group_id', activeGroupId)
          .eq('user_id', loggedUserId);
          
        const existingNumbers = new Set((groupEntries || []).map(e => e.installment_number));
        const originalDueDay = updateData.original_due_day || currentEntry.original_due_day || parseInt(updated.date.split('-')[2], 10);
        
        // 1. Atualizar as parcelas futuras existentes (apenas se data.propagate_future for true)
        if (data.propagate_future && activeGroupId) {
          const futureUpdates = { ...updateData };
          delete futureUpdates.status; // Não propagar status
          delete futureUpdates.date; // Não propagar data (cada parcela tem a sua)
          delete futureUpdates.installment_number;
          
          await supabase
            .from('financial_entries')
            .update(futureUpdates)
            .eq('installment_group_id', activeGroupId)
            .eq('user_id', loggedUserId)
            .gt('installment_number', currentNumber)
            .neq('status', 'pago'); // Nunca atualizar as já pagas
        }

        // Se a quantidade de parcelas mudou para menos, deletar as excedentes futuras (se não estiverem pagas)
        if (activeTotal < oldTotal && activeGroupId) {
          await supabase
            .from('financial_entries')
            .delete()
            .eq('installment_group_id', activeGroupId)
            .eq('user_id', loggedUserId)
            .gt('installment_number', activeTotal)
            .neq('status', 'pago');
        }

        // Se a quantidade mudou para mais (ou acabou de virar parcelado), criar as faltantes
        if (activeTotal > currentNumber && activeGroupId) {
          const entriesToCreate = [];
          
          // O base date é o do currentEntry ou da edição
          const baseDateStr = updateData.date || currentEntry.date;
          
          for (let i = currentNumber + 1; i <= activeTotal; i++) {
            if (!existingNumbers.has(i)) {
              // Calcular data correta
              const monthsToAdd = i - currentNumber;
              let nextDateStr = '';
              if (data.is_salary_fifth_day) {
                const baseDate = new Date(baseDateStr + 'T12:00:00');
                let nextYear = baseDate.getFullYear();
                let nextMonth = baseDate.getMonth() + 1 + monthsToAdd;
                while (nextMonth > 12) { nextMonth -= 12; nextYear += 1; }
                nextDateStr = getFifthBusinessDay(nextYear, nextMonth);
              } else {
                nextDateStr = calculateInstallmentDueDate(baseDateStr, monthsToAdd);
              }

              // Descrição
              const baseDesc = updateData.description || currentEntry.description;
              const recDescription = baseDesc.replace(/\s\(\d+\/\d+\)$/, '') + ` (${i}/${activeTotal})`;

              entriesToCreate.push({
                user_id: loggedUserId,
                description: recDescription,
                amount: updateData.amount !== undefined ? updateData.amount : currentEntry.amount,
                date: nextDateStr,
                type: updateData.type || currentEntry.type,
                category_id: updateData.category_id !== undefined ? updateData.category_id : currentEntry.category_id,
                status: 'previsto',
                payment_method: updateData.payment_method !== undefined ? updateData.payment_method : currentEntry.payment_method,
                client_name: updateData.client_name !== undefined ? updateData.client_name : currentEntry.client_name,
                notes: updateData.notes !== undefined ? updateData.notes : currentEntry.notes,
                is_recurring: true,
                recurring_months: activeTotal, // Opcional manter
                installment_group_id: activeGroupId,
                installment_number: i,
                installment_total: activeTotal,
                original_due_day: originalDueDay
              });
            }
          }
          
          if (entriesToCreate.length > 0) {
            await supabase.from('financial_entries').insert(entriesToCreate);
          }
        }
        
        // Sempre forçar reload completo após edições em lote
        fetchEntries(new Date().getMonth() + 1, new Date().getFullYear());
      } else {
        setEntries(prev => prev.map(e => e.id === id ? finalUpdated : e));
      }

      toast.success('Registro atualizado');
      return finalUpdated;
    } catch (error: any) {
      console.error('Error updating entry:', error);
      toast.error(error?.message || 'Erro ao atualizar');
      return null;
    }
  };

  const toggleStatus = async (entry: FinanceEntry) => {
    if (!loggedUserId) return;
    const newStatus = entry.status === 'pago' ? 'previsto' : 'pago';
    
    // Otimistic update
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: newStatus } : e));
    
    try {
      const { error } = await supabase
        .from('financial_entries')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', entry.id)
        .eq('user_id', loggedUserId);

      if (error) throw error;
      
      if (newStatus === 'pago') {
        toast.success(entry.type === 'entrada' ? 'Entrada marcada como Recebida! 🎉' : 'Despesa marcada como Paga! ✅');
      } else {
        toast.info('Status alterado para Previsto');
      }
    } catch (error: any) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alternar status');
      // Revert
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: entry.status } : e));
    }
  };

  const bulkUpdateStatus = async (ids: string[], newStatus: 'pago' | 'previsto') => {
    if (!loggedUserId || ids.length === 0) return;
    setEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: newStatus } : e));
    try {
      const { error } = await supabase
        .from('financial_entries')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('user_id', loggedUserId);

      if (error) throw error;
      toast.success(`${ids.length} item(ns) alterado(s) para ${newStatus === 'pago' ? 'Pago' : 'Previsto'}!`);
    } catch (error: any) {
      console.error('Error bulk updating status:', error);
      toast.error('Erro ao atualizar itens selecionados');
    }
  };

  const bulkDeleteEntries = async (ids: string[]) => {
    if (!loggedUserId || ids.length === 0) return;
    try {
      const { error } = await supabase
        .from('financial_entries')
        .delete()
        .in('id', ids)
        .eq('user_id', loggedUserId);

      if (error) throw error;
      setEntries(prev => prev.filter(e => !ids.includes(e.id)));
      toast.success(`${ids.length} lançamento(s) excluído(s)!`);
    } catch (error: any) {
      console.error('Error bulk deleting:', error);
      toast.error('Erro ao excluir itens selecionados');
    }
  };

  const deleteEntry = async (id: string, deleteFuture: boolean = false) => {
    if (!loggedUserId) return false;
    try {
      if (deleteFuture) {
        const currentEntry = entries.find(e => e.id === id);
        if (currentEntry?.installment_group_id && currentEntry?.installment_number) {
          const { error } = await supabase
            .from('financial_entries')
            .delete()
            .eq('installment_group_id', currentEntry.installment_group_id)
            .gte('installment_number', currentEntry.installment_number)
            .eq('user_id', loggedUserId);
            
          if (error) throw error;
          setEntries(prev => prev.filter(e => !(e.installment_group_id === currentEntry.installment_group_id && e.installment_number! >= currentEntry.installment_number!)));
          toast.success('Parcelas excluídas com sucesso');
          return true;
        }
      }
      
      const { error } = await supabase
        .from('financial_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', loggedUserId);

      if (error) throw error;
      
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success('Registro excluído');
      return true;
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      toast.error('Erro ao excluir');
      return false;
    }
  };

  const duplicateEntry = async (id: string) => {
    if (!loggedUserId) return null;
    try {
      const entryToDup = entries.find(e => e.id === id);
      if (!entryToDup) return null;
      
      const { id: _, created_at, updated_at, category, ...rest } = entryToDup as any;
      const { data: newEntry, error } = await supabase
        .from('financial_entries')
        .insert([{ 
          ...rest, 
          user_id: loggedUserId,
          category_id: rest.category_id || null 
        }])
        .select('*, category:financial_categories(*)')
        .single();
        
      if (error) throw error;
      
      toast.success('Registro duplicado com sucesso');
      return newEntry;
    } catch (error: any) {
      console.error('Error duplicating entry:', error);
      toast.error('Erro ao duplicar registro');
      return null;
    }
  };

  const getMonthSummary = useCallback((): FinanceMonthlySummary => {
    const result = entries.reduce((acc, entry) => {
      const amount = Number(entry.amount) || 0;
      if (entry.type === 'entrada') {
        acc.totalEntradas += amount;
        if (entry.status === 'pago') acc.entradasRecebidas += amount;
      } else {
        acc.totalSaidas += amount;
        if (entry.status === 'pago') acc.saidasPagas += amount;
      }
      return acc;
    }, {
      totalEntradas: 0,
      totalSaidas: 0,
      saldo: 0,
      entradasRecebidas: 0,
      saidasPagas: 0
    });
    result.saldo = result.totalEntradas - result.totalSaidas;
    return result;
  }, [entries]);

  const getCategoryBreakdown = useCallback((type: 'entrada' | 'saida'): FinanceCategoryBreakdown[] => {
    const breakdown = entries
      .filter(e => e.type === type)
      .reduce((acc, entry) => {
        const catName = entry.category?.name || 'Sem Categoria';
        const color = entry.category?.color || '#cbd5e1';
        if (!acc[catName]) acc[catName] = { category: catName, color, amount: 0, percentage: 0 };
        acc[catName].amount += Number(entry.amount) || 0;
        return acc;
      }, {} as Record<string, FinanceCategoryBreakdown>);
      
    const total = Object.values(breakdown).reduce((sum, item) => sum + item.amount, 0);
    
    return Object.values(breakdown).map(item => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0
    })).sort((a, b) => b.amount - a.amount);
  }, [entries]);

  const getProjection = useCallback(async (startMonth: number, startYear: number, months: number): Promise<FinanceProjectionRow[]> => {
    if (!loggedUserId) return [];
    try {
      const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
      
      let endYear = startYear;
      let endMonth = startMonth + months;
      while (endMonth > 12) {
        endMonth -= 12;
        endYear++;
      }
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${new Date(endYear, endMonth, 0).getDate()}`;
      
      const { data, error } = await supabase
        .from('financial_entries')
        .select('amount, type, date')
        .eq('user_id', loggedUserId)
        .gte('date', startDate)
        .lte('date', endDate);
        
      if (error) throw error;
      
      const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const projection: Record<string, FinanceProjectionRow> = {};
      
      for (let i = 0; i < months; i++) {
        let y = startYear;
        let m = startMonth + i;
        while (m > 12) { m -= 12; y++; }
        
        const key = `${String(m).padStart(2, '0')}/${y}`;
        const label = `${monthNames[m - 1]}/${y}`;
        projection[key] = { month: label, entradas: 0, saidas: 0, saldo: 0 };
      }
      
      data?.forEach(entry => {
        const dateObj = new Date(entry.date + 'T12:00:00');
        const key = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
        if (projection[key]) {
          if (entry.type === 'entrada') projection[key].entradas += Number(entry.amount) || 0;
          else projection[key].saidas += Number(entry.amount) || 0;
        }
      });
      
      return Object.values(projection).map(p => ({ ...p, saldo: p.entradas - p.saidas }));
    } catch (error) {
      console.error('Error fetching projection:', error);
      return [];
    }
  }, [loggedUserId]);

  const exportCSV = useCallback((month: number, year: number) => {
    if (entries.length === 0) {
      toast.info('Nenhum dado para exportar');
      return;
    }
    
    const headers = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Status', 'Método Pagamento', 'Cliente'];
    const csvContent = entries.map(e => {
      return [
        e.date,
        e.type,
        e.category?.name || 'Sem categoria',
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.amount,
        e.status,
        e.payment_method,
        `"${(e.client_name || '').replace(/"/g, '""')}"`
      ].join(',');
    });
    
    const csvStr = [headers.join(','), ...csvContent].join('\n');
    const blob = new Blob(['\ufeff' + csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `financeiro_${month}_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [entries]);

  return {
    entries,
    loading,
    fetchEntries,
    createEntry,
    updateEntry,
    toggleStatus,
    bulkUpdateStatus,
    deleteEntry,
    bulkDeleteEntries,
    duplicateEntry,
    getMonthSummary,
    getProjection,
    getCategoryBreakdown,
    exportCSV
  };
}
