import React from 'react';

interface ToggleChipProps {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

// A labelled on/off switch. The state is exposed to assistive tech through aria-checked, so the
// label does not need to repeat "ON" / "OFF".
export const ToggleChip: React.FC<ToggleChipProps> = ({ on, onClick, children }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
      on
        ? 'border-sky-400/40 bg-sky-400/10 text-sky-200'
        : 'border-slate-700 bg-slate-950/60 text-slate-400 hover:text-slate-200'
    }`}
  >
    <span
      className={`relative h-3.5 w-6 shrink-0 rounded-full transition ${on ? 'bg-sky-400' : 'bg-slate-700'}`}
      aria-hidden="true"
    >
      <i
        className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-slate-950 transition-all ${
          on ? 'left-3' : 'left-0.5'
        }`}
      />
    </span>
    {children}
  </button>
);
