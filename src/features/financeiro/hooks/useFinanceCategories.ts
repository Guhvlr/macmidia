import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/contexts/useApp';
import { FinanceCategory, DEFAULT_CATEGORIES } from '../types/finance-types';
import { toast } from 'sonner';

export function useFinanceCategories() {
  const { loggedUserId } = useApp();
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!loggedUserId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('financial_categories')
        .select('*')
        .eq('user_id', loggedUserId)
        .order('name');

      if (error) throw error;
      setCategories((data || []) as FinanceCategory[]);
    } catch (error: any) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  }, [loggedUserId]);

  const seedDefaultCategories = useCallback(async () => {
    if (!loggedUserId) return;
    try {
      const { data, error } = await supabase
        .from('financial_categories')
        .select('id')
        .eq('user_id', loggedUserId)
        .limit(1);

      if (error) return;

      if (data && data.length === 0) {
        const categoriesToInsert = DEFAULT_CATEGORIES.map(cat => ({
          ...cat,
          user_id: loggedUserId
        }));

        const { error: insertError } = await supabase
          .from('financial_categories')
          .insert(categoriesToInsert);

        if (insertError) {
          console.error('Error inserting default categories:', insertError);
          return;
        }
        
        await fetchCategories();
      }
    } catch (error: any) {
      console.error('Error seeding categories:', error);
    }
  }, [loggedUserId, fetchCategories]);

  useEffect(() => {
    if (loggedUserId) {
      seedDefaultCategories().then(() => fetchCategories());
    }
  }, [loggedUserId, seedDefaultCategories, fetchCategories]);

  const createCategory = async (name: string, type: string, color: string) => {
    if (!loggedUserId) return null;
    try {
      const { data, error } = await supabase
        .from('financial_categories')
        .insert([{ user_id: loggedUserId, name, type, color, is_default: false }])
        .select()
        .single();

      if (error) throw error;
      
      setCategories(prev => [...prev, data as FinanceCategory].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success('Categoria criada com sucesso');
      return data;
    } catch (error: any) {
      console.error('Error creating category:', error);
      toast.error(error?.message || 'Erro ao criar categoria');
      return null;
    }
  };

  const updateCategory = async (id: string, updates: Partial<Omit<FinanceCategory, 'id' | 'user_id' | 'created_at'>>) => {
    if (!loggedUserId) return null;
    try {
      const { data, error } = await supabase
        .from('financial_categories')
        .update(updates)
        .eq('id', id)
        .eq('user_id', loggedUserId)
        .select()
        .single();

      if (error) throw error;
      
      setCategories(prev => prev.map(c => c.id === id ? data as FinanceCategory : c));
      toast.success('Categoria atualizada');
      return data;
    } catch (error: any) {
      console.error('Error updating category:', error);
      toast.error(error?.message || 'Erro ao atualizar categoria');
      return null;
    }
  };

  const deleteCategory = async (id: string) => {
    if (!loggedUserId) return false;
    try {
      // Check if entries use this category
      const { data: entries, error: countError } = await supabase
        .from('financial_entries')
        .select('id')
        .eq('category_id', id)
        .eq('user_id', loggedUserId)
        .limit(1);

      if (countError) throw countError;

      if (entries && entries.length > 0) {
        toast.error('Não é possível excluir: existem lançamentos nesta categoria.');
        return false;
      }

      const { error } = await supabase
        .from('financial_categories')
        .delete()
        .eq('id', id)
        .eq('user_id', loggedUserId);

      if (error) throw error;
      
      setCategories(prev => prev.filter(c => c.id !== id));
      toast.success('Categoria excluída');
      return true;
    } catch (error: any) {
      console.error('Error deleting category:', error);
      toast.error(error?.message || 'Erro ao excluir categoria');
      return false;
    }
  };

  return {
    categories,
    loading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory
  };
}
