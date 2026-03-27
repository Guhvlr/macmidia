import { useState, useEffect } from 'react';
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

const Timer = ({ timeSpent, timerRunning, timerStart, onToggle }: TimerProps) => {
  const [display, setDisplay] = useState(timeSpent);

  useEffect(() => {
    if (!timerRunning) {
      setDisplay(timeSpent);
      return;
    }
    const interval = setInterval(() => {
      const elapsed = timerStart ? Math.floor((Date.now() - timerStart) / 1000) : 0;
      setDisplay(timeSpent + elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerStart, timeSpent]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="p-1 rounded hover:bg-secondary transition-colors"
      >
        {timerRunning ? <Pause className="w-3 h-3 text-accent" /> : <Play className="w-3 h-3 text-primary" />}
      </button>
      <span className={`font-mono ${timerRunning ? 'text-accent' : 'text-muted-foreground'}`}>
        {formatTime(display)}
      </span>
    </div>
  );
};

export default Timer;
