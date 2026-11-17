import { supabase } from '@/integrations/supabase/client';

export type BulkDeleteFilters = {
  olderThanDays: number;
};

export async function calculateBulkDeleteImpact(filters: BulkDeleteFilters) {
  const cutoff = new Date(Date.now() - filters.olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  
  // Pegamos apenas o que será deletado para não sobrecarregar
  const { data, count, error } = await supabase
    .from('kanban_cards')
    .select('id, images, cover_image, comments', { count: 'exact' })
    .not('archived_at', 'is', null)
    .lte('archived_at', cutoff);
    
  if (error) throw error;
  
  let filesToDelete = 0;
  data?.forEach(card => {
     if (card.images && Array.isArray(card.images)) filesToDelete += card.images.length;
     if (card.cover_image) filesToDelete += 1;
     if (card.comments && Array.isArray(card.comments)) {
        card.comments.forEach((c: any) => {
           if (c.attachments && Array.isArray(c.attachments)) {
               filesToDelete += c.attachments.length;
           }
        });
     }
  });

  return {
    cardsCount: count || 0,
    filesCount: filesToDelete,
    cardsData: data || []
  };
}

export async function executeBulkDelete(cardsData: any[]) {
   if (!cardsData || cardsData.length === 0) return;

   // 1. Extrair os caminhos (paths) do Storage
   const pathsToDelete: string[] = [];
   
   const getPath = (url: string) => {
     if (!url || typeof url !== 'string') return null;
     if (url.includes('kanban_assets/')) {
        return url.split('kanban_assets/')[1].split('?')[0];
     }
     return null;
   };

   cardsData.forEach(card => {
       if (card.images && Array.isArray(card.images)) {
           card.images.forEach((img: string) => {
              const p = getPath(img);
              if (p) pathsToDelete.push(p);
           });
       }
       if (card.cover_image) {
           const p = getPath(card.cover_image);
           if (p) pathsToDelete.push(p);
       }
       if (card.comments && Array.isArray(card.comments)) {
           card.comments.forEach((c: any) => {
               if (c.attachments && Array.isArray(c.attachments)) {
                   c.attachments.forEach((att: any) => {
                       const p = getPath(att.url || att);
                       if (p) pathsToDelete.push(p);
                   });
               }
           });
       }
   });

   // 2. Preservar os arquivos do Storage para não afetar cards ativos duplicados ou históricos
   // Os arquivos permanecem íntegros para evitar erros 404 em cards que usam mídias compartilhadas.

   // 3. Apagar as linhas do banco de dados em lotes de 100
   const cardIds = cardsData.map(c => c.id);
   for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
       const batchIds = cardIds.slice(i, i + BATCH_SIZE);
       if (batchIds.length > 0) {
           const { error } = await supabase
               .from('kanban_cards')
               .delete()
               .in('id', batchIds);
               
           if (error) {
               throw error; // Propaga o erro do BD se falhar
           }
       }
   }
}
