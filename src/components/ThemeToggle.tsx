import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Alternar para Tema Claro (Light Mode)' : 'Alternar para Tema Escuro (Dark Mode)'}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all duration-300 shadow-sm ${
        theme === 'dark'
          ? 'bg-zinc-900/90 text-amber-400 border-zinc-700/80 hover:bg-zinc-800 hover:border-amber-400/50'
          : 'bg-white text-amber-600 border-zinc-300 hover:bg-zinc-100 hover:border-amber-500/50'
      } ${className}`}
    >
      {theme === 'dark' ? (
        <>
          <Moon className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-300 hidden sm:inline">Escuro</span>
        </>
      ) : (
        <>
          <Sun className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-800 hidden sm:inline">Claro</span>
        </>
      )}
    </button>
  );
}
