import React from 'react';
import { FinanceEntry } from '../types/finance-types';

interface FinanceCalendarProps {
  entries: FinanceEntry[];
  currentDate: Date;
  onDayClick: (dateStr: string) => void;
}

export function FinanceCalendar({ entries, currentDate, onDayClick }: FinanceCalendarProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDayIndex }, (_, i) => i);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const getDayEntries = (day: number) => {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return {
      dayStr,
      entries: entries.filter(e => e.date === dayStr)
    };
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950/40">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="p-3 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 auto-rows-[100px] border-b border-zinc-800/50">
        {paddingDays.map(i => (
          <div key={`pad-${i}`} className="p-2 border-r border-b border-zinc-800/50 bg-zinc-950/30 opacity-40" />
        ))}
        
        {days.map(day => {
          const { dayStr, entries: dayEntries } = getDayEntries(day);
          const entradas = dayEntries.filter(e => e.type === 'entrada');
          const saidas = dayEntries.filter(e => e.type === 'saida');
          
          const totalEntradas = entradas.reduce((sum, e) => sum + Number(e.amount), 0);
          const totalSaidas = saidas.reduce((sum, e) => sum + Number(e.amount), 0);
          const isToday = dayStr === todayStr;
          
          return (
            <div 
              key={day} 
              onClick={() => onDayClick(dayStr)}
              className="p-2 border-r border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors cursor-pointer flex flex-col justify-between"
            >
              <div className="flex justify-end">
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-red-600 text-white' : 'text-zinc-400'}`}>
                  {day}
                </span>
              </div>
              
              <div className="space-y-0.5 mt-auto">
                {totalEntradas > 0 && (
                  <div className="text-[11px] text-green-400 font-medium truncate">
                    +{formatCurrency(totalEntradas)}
                  </div>
                )}
                {totalSaidas > 0 && (
                  <div className="text-[11px] text-red-400 font-medium truncate">
                    -{formatCurrency(totalSaidas)}
                  </div>
                )}
                {dayEntries.length > 0 && totalEntradas === 0 && totalSaidas === 0 && (
                  <div className="flex gap-1 mt-1">
                    {dayEntries.slice(0, 4).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
