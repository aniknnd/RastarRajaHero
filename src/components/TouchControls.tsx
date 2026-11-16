import React, { useCallback, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flame,
  OctagonAlert,
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
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={release}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      className={`touch-none select-none flex flex-col items-center justify-center rounded-xl border-2 transition-transform duration-75 active:scale-95 ${
        pressed ? `${activeClassName} scale-95` : className
      }`}
    >
      {children}
      <span
        className={`${
          primaryBengali ? 'font-bengali text-[11px] font-bold' : 'text-[10px] font-extrabold tracking-wider'
        } leading-none mt-0.5`}
      >
        {primaryLabel}
      </span>
      {subLabel && (
        <span className="text-[8px] font-bold tracking-wider uppercase leading-none opacity-80 mt-0.5">
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
      className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 px-2 pb-[env(safe-area-inset-bottom,0px)]"
      style={{ maxWidth: 'calc(100vw - 16px)' }}
    >
      {/* Top row: বুস্ট (BOOST) | ^ চলুন (ACCEL) | হর্ন (HORN) */}
      <div className="grid grid-cols-3 gap-2 items-end">
        <HoldButton
          control="boost"
          ariaLabel="Boost"
          primaryLabel="বুস্ট"
          subLabel="BOOST"
          primaryBengali
          onControlChange={onControlChange}
          className="w-16 h-12 bg-sky-950/88 border-sky-400/75 text-sky-100 shadow-lg"
          activeClassName="w-16 h-12 bg-sky-500 border-sky-200 text-slate-950 shadow-sky-400/50 shadow-lg"
        >
          <Flame className="w-4 h-4" />
        </HoldButton>

        <HoldButton
          control="accelerate"
          ariaLabel="Accelerate"
          primaryLabel="^ চলুন"
          subLabel="ACCEL"
          primaryBengali
          onControlChange={onControlChange}
          className="w-20 h-14 bg-emerald-950/88 border-emerald-400/80 text-emerald-100 shadow-lg"
          activeClassName="w-20 h-14 bg-emerald-500 border-emerald-100 text-slate-950 shadow-lg"
        >
          <ArrowUp className="w-5 h-5" />
        </HoldButton>

        <HoldButton
          control="horn"
          ariaLabel="Horn"
          primaryLabel="হর্ন"
          subLabel="HORN"
          primaryBengali
          onControlChange={onControlChange}
          className="w-16 h-12 bg-amber-950/88 border-amber-400/75 text-amber-100 shadow-lg"
          activeClassName="w-16 h-12 bg-amber-400 border-amber-100 text-slate-950 shadow-lg"
        >
          <Volume2 className="w-4 h-4" />
        </HoldButton>
      </div>

      {/* Middle row: < বাম (LEFT) | BRAKE ব্রেক (DEAD-CENTER) | > ডান (RIGHT) */}
      <div className="grid grid-cols-3 gap-2 items-center">
        <HoldButton
          control="left"
          ariaLabel="Steer Left"
          primaryLabel="< বাম"
          subLabel="LEFT"
          primaryBengali
          onControlChange={onControlChange}
          className="w-16 h-14 bg-slate-900/88 border-slate-400/65 text-white shadow-lg"
          activeClassName="w-16 h-14 bg-amber-400 border-white text-slate-950 shadow-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </HoldButton>

        <HoldButton
          control="brake"
          ariaLabel="Brake"
          primaryLabel="ব্রেক"
          subLabel="BRAKE"
          primaryBengali
          onControlChange={onControlChange}
          className="w-20 h-14 bg-red-900/92 border-red-400 text-red-50 shadow-lg"
          activeClassName="w-20 h-14 bg-red-500 border-white text-white shadow-lg"
        >
          <OctagonAlert className="w-5 h-5" />
        </HoldButton>

        <HoldButton
          control="right"
          ariaLabel="Steer Right"
          primaryLabel="ডান >"
          subLabel="RIGHT"
          primaryBengali
          onControlChange={onControlChange}
          className="w-16 h-14 bg-slate-900/88 border-slate-400/65 text-white shadow-lg"
          activeClassName="w-16 h-14 bg-amber-400 border-white text-slate-950 shadow-lg"
        >
          <ArrowRight className="w-5 h-5" />
        </HoldButton>
      </div>

      {/* Bottom row: v পেছনে (REV) directly under BRAKE */}
      <div className="flex justify-center">
        <HoldButton
          control="reverse"
          ariaLabel="Reverse"
          primaryLabel="v পেছনে"
          subLabel="REV"
          primaryBengali
          onControlChange={onControlChange}
          className="w-20 h-11 bg-slate-900/88 border-amber-500/70 text-amber-100 shadow-lg"
          activeClassName="w-20 h-11 bg-amber-500 border-white text-slate-950 shadow-lg"
        >
          <ArrowDown className="w-4 h-4" />
        </HoldButton>
      </div>
    </div>
  );
};
