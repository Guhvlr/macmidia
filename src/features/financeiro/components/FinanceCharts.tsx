import React, { useState } from 'react';
import { FinanceCategoryBreakdown, FinanceProjectionRow } from '../types/finance-types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface FinanceChartsProps {
  categoryBreakdown: FinanceCategoryBreakdown[];
  projections: FinanceProjectionRow[];
}

export function FinanceCharts({ categoryBreakdown, projections }: FinanceChartsProps) {
  const [activeTab, setActiveTab] = useState<'categorias' | 'projecao'>('categorias');

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex border-b border-zinc-800 mb-6">
        <button
          className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'categorias' ? 'border-b-2 border-red-500 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          onClick={() => setActiveTab('categorias')}
        >
          Saídas por Categoria
        </button>
        <button
          className={`pb-3 px-4 text-sm font-medium transition-colors ${activeTab === 'projecao' ? 'border-b-2 border-red-500 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          onClick={() => setActiveTab('projecao')}
        >
          Projeção Futura
        </button>
      </div>

      {activeTab === 'categorias' && (
        <div className="flex flex-col md:flex-row items-center gap-8 min-h-[300px]">
          {categoryBreakdown.length > 0 ? (
            <>
              <div className="w-full md:w-1/2 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="amount"
                      nameKey="category"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(Number(value))}
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 overflow-y-auto max-h-[280px] pr-2 space-y-3">
                {categoryBreakdown.map(cat => (
                  <div key={cat.category} className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/40">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm font-medium text-zinc-200">{cat.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-zinc-100">{formatCurrency(cat.amount)}</div>
                      <div className="text-xs text-zinc-400">{cat.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="w-full h-[280px] flex items-center justify-center text-zinc-500">
              Nenhuma despesa registrada para este período
            </div>
          )}
        </div>
      )}

      {activeTab === 'projecao' && (
        <div className="h-[320px] w-full pt-2">
          {projections.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={projections}
                margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              Carregando dados de projeção...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
