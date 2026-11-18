import React, { useCallback, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flame,
  Volume2,
} from 'lucide-react';
import type { InputState } from '../game/types';

interface TouchControlsProps {
  onControlChange: (control: keyof InputState, pressed: boolean) => void;
  visible: boolean;
}

interface HoldButtonProps {
  control: keyof InputState;
  ariaLabel: string;
  primaryLabel: string;
  subLabel?: string;
  primaryBengali?: boolean;
  className: string;
  activeClassName: string;
  onControlChange: (control: keyof InputState, pressed: boolean) => void;
  children: React.ReactNode;
}

const HoldButton: React.FC<HoldButtonProps> = ({
  control,
  ariaLabel,
  primaryLabel,
  subLabel,
  primaryBengali = false,
  className,
  activeClassName,
  onControlChange,
  children,
}) => {
  const [pressed, setPressed] = useState(false);
  const activePointerId = useRef<number | null>(null);

  const release = useCallback(() => {
    if (activePointerId.current !== null) {
      activePointerId.current = null;
      setPressed(false);
      onControlChange(control, false);
    }
  }, [control, onControlChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Safe fallback if pointer capture is unsupported
    }
    try {
      navigator.vibrate?.(12);
    } catch {
      // Haptics are best-effort only
    }
    setPressed(true);
    onControlChange(control, true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (activePointerId.current === e.pointerId) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
      release();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerId.current === e.pointerId && e.pointerType === 'mouse') {
      release();
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={release}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      className={`touch-none select-none relative flex flex-col items-center justify-center rounded-2xl border-2 backdrop-blur-sm transition-all duration-75 ${
        pressed
          ? `${activeClassName} translate-y-[3px] scale-[0.96]`
          : `${className} shadow-[0_5px_0_rgba(0,0,0,0.45),0_9px_18px_rgba(0,0,0,0.4)]`
      }`}
    >
      {/* Glossy keycap highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1.5 top-1 h-[38%] rounded-t-xl bg-gradient-to-b from-white/20 to-transparent"
      />
      {children}
      <span
        className={`relative ${
          primaryBengali ? 'font-bengali text-xs font-bold' : 'text-[10px] font-extrabold tracking-wider'
        } leading-none mt-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]`}
      >
        {primaryLabel}
      </span>
      {subLabel && (
        <span className="relative text-[8px] font-bold tracking-wider uppercase leading-none opacity-85 mt-0.5">
          {subLabel}
        </span>
      )}
    </button>
  );
};

export const TouchControls: React.FC<TouchControlsProps> = ({ onControlChange, visible }) => {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center px-2 pb-[env(safe-area-inset-bottom,0px)]"
      style={{ maxWidth: 'calc(100vw - 16px)' }}
    >
      {/* Two rows of three equal columns.
          Row 1: বুস্ট (BOOST) | ^ চলুন (ACCEL) | হর্ন (HORN)
          Row 2: < বাম (LEFT) | v পেছনে (REV) | > ডান (RIGHT) */}
      <div
        className="grid grid-cols-3 gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: 'repeat(3, minmax(4.5rem, 5.1rem))' }}
      >
        <HoldButton
          control="boost"
          ariaLabel="Boost"
          primaryLabel="বুস্ট"
          subLabel="BOOST"
          primaryBengali
          onControlChange={onControlChange}
          className="w-full h-[3.15rem] sm:h-[3.75rem] bg-gradient-to-b from-sky-700/90 to-sky-950/95 border-sky-300/70 text-sky-50"
          activeClassName="w-full h-[3.15rem] sm:h-[3.75rem] bg-sky-400 border-sky-100 text-slate-950 ring-2 ring-white/80 shadow-[0_0_22px_rgba(56,189,248,0.75)]"
        >
          <Flame className="w-4 h-4 sm:w-[1.15rem] sm:h-[1.15rem]" />
        </HoldButton>

        <HoldButton
          control="accelerate"
          ariaLabel="Accelerate"
          primaryLabel="^ চলুন"
          subLabel="ACCEL"
          primaryBengali
          onControlChange={onControlChange}
          className="w-full h-[3.5rem] sm:h-[4.15rem] bg-gradient-to-b from-emerald-600/92 to-emerald-900/95 border-emerald-300/85 text-emerald-50"
          activeClassName="w-full h-[3.5rem] sm:h-[4.15rem] bg-emerald-400 border-emerald-100 text-slate-950 ring-2 ring-white/85 shadow-[0_0_24px_rgba(52,211,153,0.8)]"
        >
          <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6" />
        </HoldButton>

        <HoldButton
          control="horn"
          ariaLabel="Horn"
          primaryLabel="হর্ন"
          subLabel="HORN"
          primaryBengali
          onControlChange={onControlChange}
          className="w-full h-[3.15rem] sm:h-[3.75rem] bg-gradient-to-b from-amber-600/90 to-amber-900/95 border-amber-300/75 text-amber-50"
          activeClassName="w-full h-[3.15rem] sm:h-[3.75rem] bg-amber-400 border-amber-100 text-slate-950 ring-2 ring-white/80 shadow-[0_0_22px_rgba(251,191,36,0.75)]"
        >
          <Volume2 className="w-4 h-4 sm:w-[1.15rem] sm:h-[1.15rem]" />
        </HoldButton>

        <HoldButton
          control="left"
          ariaLabel="Steer Left"
          primaryLabel="< বাম"
          subLabel="LEFT"
          primaryBengali
          onControlChange={onControlChange}
          className="w-full h-[3.3rem] sm:h-[3.85rem] bg-gradient-to-b from-slate-700/92 to-slate-950/95 border-slate-300/70 text-white"
          activeClassName="w-full h-[3.3rem] sm:h-[3.85rem] bg-amber-400 border-white text-slate-950 ring-2 ring-white/85 shadow-[0_0_22px_rgba(251,191,36,0.8)]"
        >
          <ArrowLeft className="w-[1.2rem] h-[1.2rem] sm:w-[1.35rem] sm:h-[1.35rem]" />
        </HoldButton>

        <HoldButton
          control="reverse"
          ariaLabel="Reverse"
          primaryLabel="v পেছনে"
          subLabel="REV"
          primaryBengali
          onControlChange={onControlChange}
          className="w-full h-[3.3rem] sm:h-[3.85rem] bg-gradient-to-b from-slate-700/92 to-slate-950/95 border-amber-400/75 text-amber-100"
          activeClassName="w-full h-[3.3rem] sm:h-[3.85rem] bg-amber-500 border-white text-slate-950 ring-2 ring-white/85 shadow-[0_0_22px_rgba(245,158,11,0.8)]"
        >
          <ArrowDown className="w-[1.2rem] h-[1.2rem] sm:w-[1.35rem] sm:h-[1.35rem]" />
        </HoldButton>

        <HoldButton
          control="right"
          ariaLabel="Steer Right"
          primaryLabel="ডান >"
          subLabel="RIGHT"
          primaryBengali
          onControlChange={onControlChange}
          className="w-full h-[3.3rem] sm:h-[3.85rem] bg-gradient-to-b from-slate-700/92 to-slate-950/95 border-slate-300/70 text-white"
          activeClassName="w-full h-[3.3rem] sm:h-[3.85rem] bg-amber-400 border-white text-slate-950 ring-2 ring-white/85 shadow-[0_0_22px_rgba(251,191,36,0.8)]"
        >
          <ArrowRight className="w-[1.2rem] h-[1.2rem] sm:w-[1.35rem] sm:h-[1.35rem]" />
        </HoldButton>
      </div>
    </div>
  );
};
