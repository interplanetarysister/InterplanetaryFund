import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

function parseTimeline(timeline) {
  if (!timeline) return [];
  const lines = timeline.split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length === 1) {
    return [{ date: '', title: lines[0], description: '' }];
  }
  return lines.map((line) => {
    const m = line.match(/^([^::\-—]+)[::\-—]\s*(.*)$/);
    return m ? { date: m[1].trim(), title: m[2].trim(), description: '' } : { date: '', title: line, description: '' };
  });
}

export default function Timeline({ timeline, campaignId }) {
  const milestones = parseTimeline(timeline);
  const storageKey = `kindred:milestones:${campaignId}`;
  const [completed, setCompleted] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setCompleted(raw ? JSON.parse(raw) : {});
    } catch {
      setCompleted({});
    }
  }, [storageKey]);

  const toggle = (i) => {
    const next = { ...completed, [i]: !completed[i] };
    setCompleted(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  return (
    <div className="relative pl-6">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />
      <ol className="space-y-5">
        {milestones.map((m, i) => {
          const done = !!completed[i];
          return (
            <li key={i} className="relative">
              <button
                onClick={() => toggle(i)}
                aria-label={done ? 'Mark milestone incomplete' : 'Mark milestone complete'}
                className={cn(
                  'absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                  done ? 'bg-emerald-400 border-emerald-400' : 'bg-[#0B0F0E] border-white/20 hover:border-emerald-400'
                )}
              >
                {done && <Check className="w-2.5 h-2.5 text-[#0B0F0E]" strokeWidth={3} />}
              </button>
              <div className={cn('transition-opacity', done && 'opacity-60')}>
                {m.date && <p className="text-[11px] uppercase tracking-wider text-emerald-400 mb-0.5">{m.date}</p>}
                <p className={cn('text-sm font-medium', done && 'line-through text-stone-500')}>{m.title}</p>
                {m.description && <p className="text-xs text-stone-500 mt-0.5">{m.description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}