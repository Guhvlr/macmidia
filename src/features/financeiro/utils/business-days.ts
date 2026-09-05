/**
 * Helpers para cálculo de dias úteis no Brasil (considerando finais de semana e feriados nacionais fixos)
 */

const BRAZILIAN_FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '11-20': 'Dia da Consciência Negra',
  '12-25': 'Natal',
};

export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const key = `${month}-${day}`;

  if (BRAZILIAN_FIXED_HOLIDAYS[key]) return false;

  return true;
}

/**
 * Retorna a data em formato YYYY-MM-DD do N-ésimo dia útil do mês especificado (ex: 5º dia útil para Salário)
 * @param year Ano (ex: 2026)
 * @param month Mês 1-12 (ex: 8 para Agosto)
 * @param nth Qual dia útil (padrão: 5)
 */
export function getNthBusinessDay(year: number, month: number, nth: number = 5): string {
  const totalDays = new Date(year, month, 0).getDate();
  let businessDaysCount = 0;

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month - 1, d);
    if (isBusinessDay(date)) {
      businessDaysCount++;
      if (businessDaysCount === nth) {
        return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  // Fallback caso termine o mês
  return `${year}-${String(month).padStart(2, '0')}-07`;
}

export function getFifthBusinessDay(year: number, month: number): string {
  return getNthBusinessDay(year, month, 5);
}
