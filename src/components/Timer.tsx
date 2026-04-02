import { useState, useEffect, memo } from 'react';
import { Play, Pause } from 'lucide-react';

interface TimerProps {
  timeSpent: number;
  timerRunning: boolean;
  timerStart?: number;
  onToggle: () => void;
}

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const Timer = memo(({ timeSpent, timerRunning, timerStart, onToggle }: TimerProps) => {
  const [display, setDisplay] = useState(timeSpent);

  useEffect(() => {
    if (!timerRunning) {
      setDisplay(timeSpent);
      return;
    }
    // Use requestAnimationFrame-based interval for better perf
    let rafId: number;
    let lastUpdate = Date.now();
    
    const tick = () => {
      const now = Date.now();
      // Only update visual every 1s to minimize re-renders
      if (now - lastUpdate >= 1000) {
        const elapsed = timerStart ? Math.floor((now - timerStart) / 1000) : 0;
        setDisplay(timeSpent + elapsed);
        lastUpdate = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    
    // Initial calc
    const elapsed = timerStart ? Math.floor((Date.now() - timerStart) / 1000) : 0;
    setDisplay(timeSpent + elapsed);
    
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [timerRunning, timerStart, timeSpent]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={`p-1.5 rounded-lg transition-all duration-200 ${
          timerRunning
            ? 'bg-primary/15 text-primary hover:bg-primary/25 shadow-[0_0_12px_hsl(0_80%_52%/0.1)]'
            : 'hover:bg-secondary text-muted-foreground hover:text-primary'
        }`}
      >
        {timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      </button>
      <span className={`font-mono text-[11px] tracking-wider tabular-nums ${timerRunning ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
        {formatTime(display)}
      </span>
    </div>
  );
});

Timer.displayName = 'Timer';

export default Timer;
