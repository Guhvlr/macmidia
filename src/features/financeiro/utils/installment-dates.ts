/**
 * Utilitário para cálculos corretos de vencimentos de parcelas.
 * Resolve o problema de meses que não possuem o dia original da parcela
 * (ex: vencimento original dia 31, mas o mês atual só vai até 28/30).
 */

export function calculateInstallmentDueDate(originalDateStr: string, installmentIndex: number): string {
  // Parsing seguro garantindo que seja interpretado como data local
  // originalDateStr deve estar no formato "YYYY-MM-DD"
  const [year, month, day] = originalDateStr.split('-').map(Number);
  
  // Mês no Javascript Date é zero-indexed, mas para lógica matemática é melhor usar 1-12
  let targetYear = year;
  let targetMonth = month + installmentIndex;
  
  // Tratamento de avanço de ano
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  
  // Último dia do mês de destino
  // Em JS, passar 0 como dia para o próximo mês retorna o último dia do mês atual
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth, 0).getDate();
  
  // O dia da parcela deve ser o menor entre o dia original e o último dia disponível no mês
  const targetDay = Math.min(day, lastDayOfTargetMonth);
  
  // Formatar de volta para YYYY-MM-DD
  const formattedMonth = String(targetMonth).padStart(2, '0');
  const formattedDay = String(targetDay).padStart(2, '0');
  
  return `${targetYear}-${formattedMonth}-${formattedDay}`;
}
