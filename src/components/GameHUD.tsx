import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Fuel,
  Gamepad2,
  Gauge,
  Lock,
  MapPin,
  Music,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Smartphone,
  Smile,
  Store,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { BIKE_ORDER, BIKE_SPECS, GameState, type BikeTierId, type HudSnapshot, type MotionStatus } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  sfxMuted: boolean;
  musicMuted: boolean;
  showTouchControls: boolean;
  motionActive: boolean;
  motionStatus: MotionStatus;
  onStart: () => void;
  onToggleMute: () => void;
  onToggleSfxMute: () => void;
  onToggleMusicMute: () => void;
  onToggleTouchControls: () => void;
  onToggleMotion: () => void;
  onOpenShowroom: () => void;
  onCloseShowroom: () => void;
  onSelectBike: (bikeId: BikeTierId) => { ok: boolean; message: string } | void;
  onTogglePause: () => void;
  onResumeGame: () => void;
}

const TitleLockupSVG: React.FC = () => (
  <svg
    viewBox="0 0 560 132"
    className="w-full max-w-[440px] h-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
    aria-label="হিরো রাস্তার রাজা - Hero Rastar Raja"
  >
    <defs>
      <linearGradient id="heroRed" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ef4444" />
        <stop offset="55%" stopColor="#dc2626" />
        <stop offset="100%" stopColor="#991b1b" />
      </linearGradient>
      <linearGradient id="goldTrim" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#fef08a" />
      </linearGradient>
    </defs>
    {/* Dhaka Rickshaw-Art Ribbon */}
    <path d="M22 20 L538 12 L520 84 L12 92 Z" fill="#111827" stroke="url(#goldTrim)" strokeWidth="4" />
    <path d="M34 26 L166 23 L152 78 L24 81 Z" fill="url(#heroRed)" />
    <text
      x="97"
      y="62"
      textAnchor="middle"
      fill="#ffffff"
      fontSize="34"
      fontWeight="800"
      fontFamily="Noto Sans Bengali, sans-serif"
    >
      হিরো
    </text>
    <text
      x="344"
      y="62"
      textAnchor="middle"
      fill="url(#goldTrim)"
      fontSize="34"
      fontWeight="800"
      fontFamily="Noto Sans Bengali, sans-serif"
    >
      রাস্তার রাজা
    </text>
    <rect x="64" y="94" width="432" height="30" rx="6" fill="#065f46" stroke="#fde047" strokeWidth="2" />
    <text
      x="280"
      y="114"
      textAnchor="middle"
      fill="#fef9c3"
      fontSize="15"
      fontWeight="700"
      fontFamily="Noto Sans Bengali, sans-serif"
    >
      Niloy Motors Ltd.
    </text>
  </svg>
);

const BikeSilhouetteSVG: React.FC<{ accentHex: string; tier: 1 | 2 | 3 }> = ({ accentHex, tier }) => (
  <svg viewBox="0 0 180 84" className="w-full h-16" aria-hidden="true">
    {/* Ground shadow */}
    <ellipse cx="90" cy="76" rx="64" ry="5" fill="#020617" opacity="0.6" />
    {/* Rear & Front wheels */}
    <circle cx="40" cy="58" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="4" />
    <circle cx="40" cy="58" r="7" fill={accentHex} opacity="0.85" />
    <circle cx="140" cy="58" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="4" />
    <circle cx="140" cy="58" r="7" fill={accentHex} opacity="0.85" />
    {/* Swingarm & Exhaust */}
    <path d="M40 58 L76 54 L94 60 L44 63 Z" fill="#475569" />
    <path d="M26 54 L66 57 L68 62 L24 58 Z" fill="#cbd5e1" />
    {/* Frame & Engine block */}
    <path d="M62 38 L94 34 L112 52 L74 56 Z" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
    {/* Fuel Tank + Tier Fairing */}
    {tier === 1 && (
      <path d="M52 34 L84 26 L108 32 L98 44 L54 42 Z" fill={accentHex} stroke="#f8fafc" strokeWidth="1.5" />
    )}
    {tier === 2 && (
      <>
        <path d="M46 32 L86 24 L116 32 L106 46 L52 42 Z" fill={accentHex} stroke="#fef08a" strokeWidth="1.8" />
        <path d="M98 34 L124 38 L118 52 L92 48 Z" fill="#0f172a" stroke={accentHex} strokeWidth="1.5" />
      </>
    )}
    {tier === 3 && (
      <>
        <path d="M42 30 L84 22 L122 26 L136 38 L108 50 L48 42 Z" fill={accentHex} stroke="#fef08a" strokeWidth="2" />
        <path d="M116 20 L132 16 L128 28 Z" fill="#38bdf8" opacity="0.85" />
        <path d="M88 38 L126 42 L114 55 L82 52 Z" fill="#0f172a" stroke="#fde047" strokeWidth="1.5" />
      </>
    )}
    {/* Seat & Tail */}
    <path d="M36 30 L68 32 L72 39 L30 35 Z" fill="#090d16" />
    {/* Fork & Headlight */}
    <line x1="112" y1="24" x2="140" y2="58" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
    <polygon points="122,26 138,30 132,38 118,34" fill="#fef08a" />
  </svg>
);

/**
 * Nearest ancestor that can actually scroll vertically right now.
 * Used to decide whether the wheel should zoom or be handed back to the
 * browser for scrolling.
 */
function getScrollableParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Wheel / pinch / button zoom for the scrollable overlay cards (menu + game over).
 * The card is scaled with the CSS `zoom` property so its layout reflows and the
 * surrounding overlay can scroll to reach the enlarged content.
 */
function useCardZoom(active: boolean, minZoom = 0.6, maxZoom = 1.75) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1);

  const applyZoom = useCallback(
    (next: number) => {
      const clamped = Math.round(Math.min(maxZoom, Math.max(minZoom, next)) * 100) / 100;
      zoomRef.current = clamped;
      setZoom(clamped);
    },
    [minZoom, maxZoom]
  );

  useEffect(() => {
    if (!active) return;
    const el = cardRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Ctrl/Cmd + wheel always zooms, matching normal browser conventions.
      // Otherwise, if the card already overflows its scroll container, let the
      // wheel scroll instead of trapping the player at a zoom they can't pan.
      if (!e.ctrlKey && !e.metaKey && getScrollableParent(el)) return;

      e.preventDefault();
      e.stopPropagation();
      const delta = Math.abs(e.deltaY) < 40 ? -e.deltaY * 0.004 : e.deltaY < 0 ? 0.08 : -0.08;
      applyZoom(zoomRef.current + delta);
    };

    const getTouchDist = (touches: TouchList) =>
      Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchStartDistRef.current = getTouchDist(e.touches);
        pinchStartZoomRef.current = zoomRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDistRef.current > 0) {
        e.preventDefault();
        e.stopPropagation();
        const dist = getTouchDist(e.touches);
        applyZoom(pinchStartZoomRef.current * (dist / pinchStartDistRef.current));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartDistRef.current = 0;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [active, applyZoom]);

  return {
    cardRef,
    zoom,
    zoomIn: () => applyZoom(zoomRef.current + 0.12),
    zoomOut: () => applyZoom(zoomRef.current - 0.12),
    resetZoom: () => applyZoom(1),
  };
}

const CardZoomBar: React.FC<{
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
}> = ({ zoom, onZoomOut, onZoomIn, onReset }) => (
  <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
    <span className="font-bengali truncate">মাউস হুইল / দুই আঙুলে জুম</span>
    <div className="inline-flex items-center gap-0.5 bg-slate-900 border border-slate-700 rounded-lg p-0.5 shrink-0">
      <button
        type="button"
        onClick={onZoomOut}
        aria-label="Zoom out"
        className="p-1 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onReset}
        title="Reset zoom"
        className="px-1.5 py-0.5 rounded hover:bg-slate-800 font-bold tabular-nums text-amber-300 cursor-pointer whitespace-nowrap"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        aria-label="Zoom in"
        className="p-1 rounded hover:bg-slate-800 text-slate-200 cursor-pointer"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  sfxMuted,
  musicMuted,
  showTouchControls,
  motionActive,
  motionStatus,
  onStart,
  onToggleMute,
  onToggleSfxMute,
  onToggleMusicMute,
  onToggleTouchControls,
  onToggleMotion,
  onOpenShowroom,
  onCloseShowroom,
  onSelectBike,
  onTogglePause,
  onResumeGame,
}) => {
  const [showroomFeedback, setShowroomFeedback] = useState<string | null>(null);
  const lowFuel = hud.fuelPercent <= 25;
  const menuZoom = useCardZoom(hud.gameState === GameState.MENU);
  const gameOverZoom = useCardZoom(hud.gameState === GameState.GAME_OVER);

  useEffect(() => {
    if (hud.gameState !== GameState.SHOWROOM) {
      setShowroomFeedback(null);
    }
  }, [hud.gameState]);
  const activeBike = BIKE_SPECS[hud.equippedBikeId];
  const nextBike = hud.nextUnlockBikeId ? BIKE_SPECS[hud.nextUnlockBikeId] : null;
  const canAffordNext = nextBike ? hud.bankScore >= nextBike.cost : false;
  const nextUnlockProgressPct = nextBike
    ? Math.min(100, Math.round((hud.bankScore / Math.max(1, nextBike.cost)) * 100))
    : 100;

  const handleBikeAction = (bikeId: BikeTierId) => {
    const res = onSelectBike(bikeId);
    if (res && !res.ok && res.message) {
      setShowroomFeedback(res.message);
    } else {
      setShowroomFeedback(null);
    }
  };

  // === NILOY HERO SHOWROOM MODAL ===
  if (hud.gameState === GameState.SHOWROOM) {
    return (
      <div className="fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-5 bg-slate-950/75 pointer-events-auto overflow-y-auto">
        {/* Top Showroom Header */}
        <div className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-2.5 bg-gradient-to-r from-slate-950 via-red-950/90 to-slate-950 border-2 border-amber-400 rounded-2xl px-4 py-3 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-600 border-2 border-amber-300 flex items-center justify-center shrink-0 shadow">
              <Store className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bengali text-lg sm:text-xl font-extrabold text-amber-300 leading-tight">
                  নিলয় হিরো শোরুম • NILOY HERO SHOWROOM
                </h2>
                <span className="bg-emerald-500/20 border border-emerald-400 text-emerald-200 text-[11px] font-bengali font-bold px-2 py-0.5 rounded-md">
                  স্যালুট বস! স্বাগতম!
                </span>
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                নিলয় মোটরস লি. টিম আপনাকে স্যালুট জানাচ্ছে — বাইক বেছে নিলেই সাথে সাথে খেলা শুরু হবে!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900 border border-amber-400/60 rounded-xl px-3.5 py-2 text-right">
              <div className="font-bengali text-[11px] font-bold text-amber-300">হিরো ব্যাংক (Hero Bank)</div>
              <div className="text-lg sm:text-xl font-extrabold tabular-nums text-white leading-tight">
                {hud.bankScore.toLocaleString()} <span className="text-xs font-bold text-amber-400">pts</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowroomFeedback(null);
                onCloseShowroom();
              }}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-500 hover:border-amber-300 text-white px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-amber-300" />
              <span className="font-bengali">ফিরুন</span>
              <span className="text-[11px] text-slate-300">(Esc)</span>
            </button>
          </div>
        </div>

        {/* Center space keeps the rotating 3D bike partly visible on desktop, cards below */}
        <div className="max-w-5xl w-full mx-auto my-auto pt-3 space-y-2.5">
          {showroomFeedback && (
            <div className="bg-amber-400 text-slate-950 border-2 border-slate-950 rounded-xl px-4 py-2 text-center font-bengali text-sm font-extrabold shadow-lg">
              {showroomFeedback}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BIKE_ORDER.map((bikeId) => {
              const spec = BIKE_SPECS[bikeId];
              const isOwned = hud.unlockedBikes.includes(bikeId);
              const isEquipped = hud.equippedBikeId === bikeId;
              const canAfford = hud.bankScore >= spec.cost;
              const remaining = Math.max(0, spec.cost - hud.bankScore);
              const topSpeedKmh = Math.round(spec.maxBoostMps * 3.4);
              const burnPct = Math.round((1 - spec.fuelBurnMult) * 100);

              return (
                <div
                  key={bikeId}
                  className={`flex flex-col justify-between rounded-2xl p-4 shadow-2xl border-2 transition-colors ${
                    isEquipped
                      ? 'bg-slate-950/95 border-emerald-400'
                      : isOwned
                        ? 'bg-slate-950/92 border-sky-400/70'
                        : canAfford
                          ? 'bg-slate-950/95 border-amber-400'
                          : 'bg-slate-950/90 border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span
                        className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md text-slate-950"
                        style={{ backgroundColor: spec.accentHex }}
                      >
                        Tier {spec.tier}
                      </span>
                      {isEquipped ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 font-bengali">
                          <CheckCircle2 className="w-3.5 h-3.5" /> ব্যবহৃত হচ্ছে
                        </span>
                      ) : isOwned ? (
                        <span className="text-xs font-bold text-sky-300 font-bengali">মালিকানাধীন (Owned)</span>
                      ) : (
                        <span className="text-xs font-extrabold tabular-nums text-amber-300">
                          {spec.cost.toLocaleString()} pts
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-900/95 border border-slate-800 rounded-xl px-3 py-2 mb-2.5">
                      <BikeSilhouetteSVG accentHex={spec.accentHex} tier={spec.tier} />
                    </div>

                    <h3 className="font-bengali text-lg font-extrabold text-white leading-snug">{spec.nameBn}</h3>
                    <p className="text-xs font-semibold text-slate-400">{spec.nameEn}</p>

                    {/* Smash Power Box */}
                    <div className="mt-2 bg-red-950/65 border border-red-400/40 rounded-lg px-2.5 py-1.5 flex items-start gap-2">
                      <Shield className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div className="text-xs leading-snug">
                        <div className="font-bengali font-bold text-amber-200">{spec.smashSummaryBn}</div>
                        <div className="text-[11px] text-slate-300">{spec.smashSummaryEn}</div>
                      </div>
                    </div>

                    {/* Specs Grid */}
                    <div className="grid grid-cols-2 gap-1.5 mt-2.5 text-xs">
                      <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Fuel className="w-3 h-3 text-emerald-400" /> ট্যাংক / খরচ
                        </div>
                        <div className="font-bold tabular-nums text-white mt-0.5">
                          {spec.fuelCapacity}L{' '}
                          <span className="text-emerald-300 text-[11px]">
                            ({burnPct === 0 ? '1.0x' : `-${burnPct}% burn`})
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-sky-400" /> কম্বো / নাইট্রো
                        </div>
                        <div className="font-bold tabular-nums text-white mt-0.5">
                          {spec.comboHoldSec}s <span className="text-sky-300">/ {spec.nitroDurationSec}s</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 col-span-2 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5 text-amber-400" /> সর্বোচ্চ গতি (Top Boost)
                        </span>
                        <span className="font-bold tabular-nums text-amber-300">{topSpeedKmh} km/h</span>
                      </div>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="mt-3">
                    {isEquipped ? (
                      <button
                        type="button"
                        onClick={() => handleBikeAction(bikeId)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-200 text-white font-bold text-sm cursor-pointer"
                      >
                        <span className="font-bengali">বর্তমান বাইক · চালান (PLAY)</span>
                      </button>
                    ) : isOwned ? (
                      <button
                        type="button"
                        onClick={() => handleBikeAction(bikeId)}
                        className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 border border-sky-200 text-white font-bold text-sm cursor-pointer"
                      >
                        <span className="font-bengali">এই বাইক চালান (EQUIP FREE)</span>
                      </button>
                    ) : canAfford ? (
                      <button
                        type="button"
                        onClick={() => handleBikeAction(bikeId)}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 border border-amber-200 text-slate-950 font-extrabold text-sm cursor-pointer shadow-lg"
                      >
                        <span className="font-bengali">আপগ্রেড করুন</span> (-{spec.cost.toLocaleString()} pts)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBikeAction(bikeId)}
                        className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:border-slate-500"
                      >
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-bengali tabular-nums">
                          আরও {remaining.toLocaleString()} পয়েন্ট লাগবে
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // === PAUSE OVERLAY ===
  if (hud.gameState === GameState.PAUSE) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 pointer-events-auto overflow-y-auto">
        <div className="w-full max-w-sm bg-slate-950 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 text-center my-auto">
          <div>
            <div className="inline-block bg-amber-400 text-slate-950 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md mb-1.5">
              বিরতি • PAUSED
            </div>
            <h2 className="font-bengali text-2xl sm:text-3xl font-extrabold text-amber-300 tracking-wide">
              খেলা থামানো হয়েছে
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              চাপ দিন <span className="font-bengali">Esc</span> আবার চালু করতে
            </p>
          </div>

          {/* Audio controls: independent SFX + Music toggles */}
          <div className="grid grid-cols-2 gap-2 text-left">
            <button
              type="button"
              onClick={onToggleSfxMute}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold cursor-pointer ${
                sfxMuted
                  ? 'bg-slate-900 border-slate-600 text-slate-400 hover:border-amber-300'
                  : 'bg-slate-900 border-emerald-400/70 text-emerald-200 hover:border-emerald-300'
              }`}
            >
              {sfxMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              <span className="font-bengali">{sfxMuted ? 'প্রভাব বন্ধ' : 'প্রভাব চালু'}</span>
              <span className="text-[10px] text-slate-400">(SFX)</span>
            </button>

            <button
              type="button"
              onClick={onToggleMusicMute}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold cursor-pointer ${
                musicMuted
                  ? 'bg-slate-900 border-slate-600 text-slate-400 hover:border-amber-300'
                  : 'bg-slate-900 border-sky-400/70 text-sky-200 hover:border-sky-300'
              }`}
            >
              {musicMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-sky-400" />}
              <span className="font-bengali">{musicMuted ? 'সঙ্গীত বন্ধ' : 'সঙ্গীত চালু'}</span>
              <span className="text-[10px] text-slate-400">(Music)</span>
            </button>
          </div>

          {/* Run stats */}
          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bengali">স্কোর</span>
              <span className="text-sm font-bold tabular-nums text-white">{hud.score.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bengali">দূরত্ব</span>
              <span className="text-sm font-bold tabular-nums text-emerald-300">{hud.distanceMeters}m</span>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bengali">তেল</span>
              <span className="text-sm font-bold tabular-nums text-amber-300">{hud.fuelPercent}%</span>
            </div>
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bengali">ল্যাপ</span>
              <span className="text-sm font-bold tabular-nums text-sky-300">{hud.lapCount}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onResumeGame}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] text-white font-bold text-base py-3.5 rounded-xl border-2 border-emerald-200 shadow-lg cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            <span className="font-bengali text-lg font-extrabold">চালিয়ে যান</span>
            <span className="text-xs uppercase tracking-wider text-emerald-100">(RESUME · Esc)</span>
          </button>
        </div>
      </div>
    );
  }

  // === MENU SCREEN ===
  if (hud.gameState === GameState.MENU) {
    return (
      <div className="fixed inset-0 z-20 pointer-events-auto overflow-auto overscroll-contain">
        <div className="min-h-full flex flex-col gap-3 p-4 sm:p-6">
          {/* Top bar: Best Score + Hero Bank + Audio Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-950/88 border border-amber-400/55 px-3.5 py-2 rounded-xl shadow-lg">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-bengali text-xs font-bold text-amber-200">সেরা স্কোর</span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">(Best)</span>
              <span className="text-base font-bold tabular-nums text-white">{hud.bestScore.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/88 border border-emerald-400/55 px-3.5 py-2 rounded-xl shadow-lg">
              <Store className="w-4 h-4 text-emerald-400" />
              <span className="font-bengali text-xs font-bold text-emerald-200">হিরো ব্যাংক</span>
              <span className="text-base font-bold tabular-nums text-amber-300">{hud.bankScore.toLocaleString()}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center gap-1.5 bg-slate-950/88 border border-slate-600 hover:border-amber-400 px-3 py-2 rounded-xl text-xs font-semibold text-slate-100 shadow-lg cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            <span className="font-bengali">{muted ? 'শব্দ বন্ধ' : 'শব্দ চালু'}</span>
            <span className="text-[10px] text-slate-400">({muted ? 'Muted' : 'Sound'})</span>
          </button>
        </div>

        {/* Bottom-center Title & Compact Play Card leaving upper 3D Metro + Dhaka street open */}
          <div className="mt-auto w-full max-w-lg mx-auto pointer-events-auto">
            <div className="mx-auto w-full max-w-[440px]">
              <TitleLockupSVG />
            </div>

            <div
              ref={menuZoom.cardRef}
              style={{ zoom: menuZoom.zoom, touchAction: 'pan-x pan-y' }}
              className="w-full bg-slate-950/90 border-2 border-amber-400/60 rounded-2xl p-4 shadow-2xl space-y-2.5"
            >
            <CardZoomBar
              zoom={menuZoom.zoom}
              onZoomOut={menuZoom.zoomOut}
              onZoomIn={menuZoom.zoomIn}
              onReset={menuZoom.resetZoom}
            />
            {/* Fueling & City Grid Guide */}
            <div className="flex items-start gap-2.5 bg-emerald-950/85 border border-emerald-500/50 rounded-xl p-2.5">
              <Fuel className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-sm leading-snug text-emerald-50">
                <p className="font-bengali font-bold text-amber-300 text-[15px]">
                  তেল (Fuel/Petrol) ফুরিয়ে গেলে বাম পাশের &ldquo;তেল পাম্প&rdquo;-এ বা ডাউনটাউন পাম্পে থামুন!
                </p>
                <p className="font-bengali text-emerald-100/95 mt-1 text-[13px] leading-snug">
                  ঢাকার বাম লেনের নিয়ম: বাম লেন দিয়ে সামনে এগোন, ডান পাশে বিপরীত দিকের গাড়ি। সবুজ-হলুদ তেল প্যাডে গতি কমালেই পাইপ লেগে তেল ভরা শুরু হবে—পাশের রাস্তাগুলোও ঘুরে দেখুন!
                </p>
              </div>
            </div>

            {/* Rule-Breaker / Smash-Everything + Showroom Upgrade Pitch */}
            <div className="flex items-center gap-2 bg-red-950/80 border border-amber-400/50 rounded-xl px-2.5 py-2 text-[13px] text-amber-100">
              <Skull className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bengali font-semibold leading-snug">
                সব গাড়ি সিগনাল মানবে — আপনি <strong className="text-amber-300">নিয়ম ভেঙে</strong> এগিয়ে যান! ১,০০,০০০ ও ২,০০,০০০ পয়েন্টে <strong className="text-emerald-300">নিলয় হিরো শোরুমে</strong> গিয়ে বড় বাইক নিন — বাস-ট্যাংকারও চুরমার!
              </span>
            </div>

            {/* Equipped Bike + Showroom Button */}
            <div className="flex items-center justify-between gap-2 bg-slate-900/95 border border-slate-700 rounded-xl px-3 py-2">
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400 font-bengali">
                  বর্তমান বাইক (Tier {activeBike.tier}) · ট্যাংক {activeBike.fuelCapacity}L
                </div>
                <div className="font-bengali text-sm font-extrabold text-white truncate">{activeBike.nameBn}</div>
              </div>
              <button
                type="button"
                onClick={onOpenShowroom}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold cursor-pointer border ${
                  canAffordNext
                    ? 'bg-amber-400 text-slate-950 border-amber-100 shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border-amber-400/50'
                }`}
              >
                <Store className="w-4 h-4" />
                <span className="font-bengali">নিলয় হিরো শোরুম</span>
                {canAffordNext && <span className="text-[10px] uppercase">(UPGRADE!)</span>}
              </button>
            </div>

            <button
              type="button"
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 active:scale-[0.98] text-white font-bold text-lg tracking-wider py-3.5 rounded-xl border-2 border-amber-200 shadow-lg transition-transform cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span className="font-bengali text-xl font-extrabold">শুরু করুন</span>
              <span className="text-sm font-bold uppercase tracking-widest text-amber-100">
                (START RIDE · Enter)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
    );
  }

  // === SCREEN FLASH OVERLAY CLASS ===
  const flashClass =
    hud.screenFlashTone === 'red'
      ? 'bg-red-600/24 border-4 border-red-500/55'
      : hud.screenFlashTone === 'amber'
        ? 'bg-amber-400/18 border-4 border-amber-300/50'
        : hud.screenFlashTone === 'green'
          ? 'bg-emerald-500/18 border-4 border-emerald-300/50'
          : '';

  // === PLAYING / CRASHED / GAME OVER HUD ===
  const missionPct = Math.min(100, Math.round((hud.mission.progress / Math.max(1, hud.mission.target)) * 100));
  const pointsToBest = Math.max(0, hud.bestScore - hud.score);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none p-2 sm:p-3.5">
      {/* Subtle high-speed / Raja Fever perimeter glow */}
      {hud.gameState === GameState.PLAYING && (hud.speedKmh > 105 || hud.feverActive) && (
        <div
          className={`fixed inset-0 pointer-events-none transition-opacity duration-150 ${
            hud.feverActive
              ? 'border-[3px] sm:border-[5px] border-amber-400/45 shadow-[inset_0_0_32px_rgba(251,191,36,0.22)]'
              : 'border-[2px] sm:border-[4px] border-sky-400/35 shadow-[inset_0_0_24px_rgba(56,189,248,0.18)]'
          }`}
        />
      )}

      {/* Non-blocking impact / refuel screen flash */}
      {hud.screenFlashTone !== 'none' && (
        <div className={`fixed inset-0 pointer-events-none transition-opacity duration-100 ${flashClass}`} />
      )}

      {/* Top Perimeter Row */}
      <div className="relative z-10 flex items-start justify-between gap-1.5 sm:gap-3">
        {/* Top-Left: Compact Score, Bank, Active Bike/Zone, Combo & Mission */}
        <div className="flex flex-col gap-1 max-w-[49%] sm:max-w-[238px]">
          <div className="bg-slate-950/82 border border-amber-400/50 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 shadow-md">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bengali text-[10px] sm:text-xs font-bold text-amber-300 shrink-0">স্কোর</span>
              <span className="text-sm sm:text-xl font-bold tabular-nums leading-none text-white truncate">
                {hud.score.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-0.5 text-[9px] sm:text-[10px] text-slate-300 tabular-nums">
              <span className="truncate">
                <span className="font-bengali text-slate-400">সেরা</span> {hud.bestScore.toLocaleString()}
              </span>
              <span className="text-emerald-300 font-semibold shrink-0">
                <span className="font-bengali">ল্যাপ</span> {hud.lapCount}
              </span>
            </div>

            {/* Compact Hero Bank & Next Bike Progress */}
            <div className="mt-1 pt-1 border-t border-slate-800/90">
              <div className="flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] leading-none">
                <span className="font-bengali text-emerald-300 font-bold truncate">
                  {canAffordNext ? 'আপগ্রেড রেডি!' : `ব্যাংক · T${activeBike.tier}`}
                </span>
                <span className="tabular-nums font-bold text-amber-300 shrink-0">
                  {hud.bankScore.toLocaleString()}
                  {nextBike ? <span className="text-slate-400 font-normal">/{Math.round(nextBike.cost / 1000)}k</span> : ''}
                </span>
              </div>
              {nextBike && (
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full transition-all duration-150 ${
                      canAffordNext ? 'bg-amber-400' : 'bg-sky-400'
                    }`}
                    style={{ width: `${nextUnlockProgressPct}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Compact Zone + Combo + Rule-Break + Mob Chips */}
          <div className="flex flex-wrap items-center gap-1">
            <div className="bg-slate-950/82 border border-slate-700/90 rounded px-1.5 py-0.5 flex items-center gap-1 text-[9px] sm:text-[10px] text-sky-200 max-w-[140px] sm:max-w-[220px]">
              <Compass className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-400 shrink-0" />
              <span className="font-bengali font-semibold truncate">{hud.zoneLabelBn}</span>
            </div>

            {hud.combo > 1 && (
              <div
                className={`${
                  hud.feverActive ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-amber-400'
                } text-slate-950 rounded px-1.5 py-0.5 text-[9px] sm:text-[11px] font-extrabold leading-tight shadow`}
              >
                <div className="flex items-center gap-0.5 tabular-nums">
                  <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                  <span>{hud.feverActive ? 'FEVER ' : ''}x{hud.combo}</span>
                </div>
                <div className="w-full h-[2px] bg-amber-950/30 rounded-full mt-0.5 overflow-hidden">
                  <div
                    className="h-full bg-slate-950 transition-all duration-75"
                    style={{ width: `${Math.round(hud.comboTimerNorm * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {hud.ruleBreakCount > 0 && (
              <div className="bg-rose-950/88 border border-rose-400/60 rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] text-rose-200 tabular-nums">
                <span className="font-bengali">ভঙ্গ</span> <strong className="text-amber-300">{hud.ruleBreakCount}</strong>
              </div>
            )}

            {hud.angryMobCount > 0 && (
              <div className="bg-orange-700/90 border border-amber-300 text-white rounded px-1.5 py-0.5 flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold tabular-nums">
                <Users className="w-2.5 h-2.5 text-amber-200 shrink-0" />
                <span>{hud.angryMobCount}</span>
              </div>
            )}
          </div>

          {/* Ultra-slim Micro-Mission */}
          <div className="bg-slate-950/82 border border-emerald-500/45 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 max-w-[170px] sm:max-w-[225px]">
            <div className="flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] leading-tight">
              <span className="font-bengali font-semibold text-emerald-300 truncate">{hud.mission.titleBn}</span>
              <span className="tabular-nums font-bold text-amber-300 shrink-0">
                {hud.mission.progress}/{hud.mission.target}
              </span>
            </div>
            <div className="w-full h-[3px] bg-slate-800 rounded-full overflow-hidden mt-0.5">
              <div className="h-full bg-emerald-400 transition-all duration-100" style={{ width: `${missionPct}%` }} />
            </div>
          </div>

          {hud.activeViolation && (
            <div className="bg-red-700/92 border border-red-200/80 text-white rounded px-1.5 py-0.5 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold max-w-[170px] sm:max-w-xs">
              <AlertTriangle className="w-2.5 h-2.5 text-amber-300 shrink-0" />
              <span className="font-bengali truncate">{hud.activeViolation}</span>
            </div>
          )}
        </div>

        {/* Desktop Top-Center Dock: keeps center canvas clean */}
        <div className="hidden sm:flex flex-col items-center gap-1 max-w-sm text-center pt-0.5">
          {hud.latestPopup && (
            <div
              className={`rounded-lg px-3 py-1 shadow-md border ${
                hud.latestPopup.tone === 'danger'
                  ? 'bg-red-700/92 border-red-300 text-white'
                  : hud.latestPopup.tone === 'refuel'
                    ? 'bg-emerald-700/92 border-emerald-300 text-white'
                    : hud.latestPopup.tone === 'warning'
                      ? 'bg-amber-600/92 border-amber-200 text-white'
                      : 'bg-slate-950/88 border-amber-400 text-amber-300'
              }`}
            >
              <p className="font-bengali text-xs font-bold leading-tight">
                {hud.latestPopup.title}
                {hud.latestPopup.subtitle && (
                  <span className="text-[11px] font-semibold text-white/95"> · {hud.latestPopup.subtitle}</span>
                )}
              </p>
            </div>
          )}
          {hud.funnyMessage && (
            <div className="bg-amber-400/95 text-slate-950 border border-slate-950 rounded-lg px-3 py-0.5 shadow-md">
              <p className="font-bengali text-xs font-extrabold leading-tight">{hud.funnyMessage}</p>
            </div>
          )}
        </div>

        {/* Top-Right: Compact Speed, Fuel, Nearest Landmarks, Light & Audio */}
        <div className="flex flex-col items-end gap-1 max-w-[48%] sm:max-w-[196px]">
          <div className="bg-slate-950/82 border border-slate-600/80 rounded-lg px-2 py-1 sm:px-2.5 sm:py-1.5 shadow-md w-full">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bengali text-[10px] sm:text-[11px] font-bold text-slate-300">গতি</span>
              <div className="flex items-baseline gap-0.5">
                <span
                  className={`text-base sm:text-2xl font-bold tabular-nums leading-none ${
                    hud.speedKmh > 110
                      ? 'text-sky-300'
                      : hud.speedKmh > 80
                        ? 'text-amber-300'
                        : 'text-white'
                  }`}
                >
                  {hud.speedKmh}
                </span>
                <span className="text-[9px] font-bold text-slate-400">km/h</span>
              </div>
            </div>

            <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.speedKmh > 110 ? 'bg-sky-400' : hud.speedKmh > 80 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.round(hud.speedNorm * 100)}%` }}
              />
            </div>

            {/* Fuel (তেল) Meter */}
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[9px] sm:text-[10px] leading-none mb-0.5">
                <span className={`font-bengali font-bold flex items-center gap-0.5 ${lowFuel ? 'text-red-400' : 'text-emerald-300'}`}>
                  <Fuel className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> তেল
                </span>
                <span className={`font-bold tabular-nums ${lowFuel ? 'text-red-300' : 'text-white'}`}>
                  <span className="hidden sm:inline">{hud.fuelAmount}/{hud.fuelCapacity}L · </span>
                  {hud.fuelPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.isRefueling
                      ? 'bg-sky-400'
                      : lowFuel
                        ? 'bg-red-500'
                        : hud.fuelPercent < 50
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                  }`}
                  style={{ width: `${hud.fuelPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-1.5 text-[9px] sm:text-[10px] text-slate-300 mt-1 tabular-nums whitespace-nowrap">
                <span className="flex items-center gap-0.5 text-emerald-300 font-semibold">
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  <span className="font-bengali text-slate-300 font-normal">পাম্প</span> {hud.nearestPumpMeters}m
                </span>
                <span className={`font-semibold ${canAffordNext ? 'text-amber-300' : 'text-sky-300'}`}>
                  <span className="font-bengali text-slate-300 font-normal">শোরুম</span> {hud.nearestShowroomMeters}m
                </span>
              </div>
            </div>
          </div>

          {/* Signal + Mute + Touch Pad toggle on one compact line */}
          <div className="flex flex-wrap items-center justify-end gap-1 pointer-events-auto max-w-full">
            {hud.upcomingLight && (
              <div className="bg-slate-950/82 border border-slate-600/80 rounded px-1.5 py-1 flex items-center gap-1 text-[9px] sm:text-[10px]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    hud.upcomingLight === 'RED'
                      ? 'bg-red-500'
                      : hud.upcomingLight === 'YELLOW'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                />
                <span className="tabular-nums font-bold text-white">{hud.upcomingLightMeters}m</span>
              </div>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMotion();
              }}
              title={
                motionStatus === 'active'
                  ? 'Motion Steering: On'
                  : motionStatus === 'waiting'
                    ? 'Motion: searching sensor…'
                    : motionStatus === 'insecure'
                      ? 'Motion needs HTTPS'
                      : motionStatus === 'denied'
                        ? 'Motion permission denied'
                        : motionStatus === 'unsupported'
                          ? 'Motion not supported'
                          : 'Motion Steering (tilt device)'
              }
              aria-pressed={motionActive}
              className={`bg-slate-950/82 border hover:border-amber-400 p-1 sm:p-1.5 rounded-md cursor-pointer ${
                motionStatus === 'active'
                  ? 'border-sky-300/80 shadow-[0_0_12px_rgba(56,189,248,0.55)]'
                  : motionStatus === 'waiting'
                    ? 'border-amber-300/80 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                    : motionStatus === 'denied' || motionStatus === 'unsupported' || motionStatus === 'insecure'
                      ? 'border-red-400/70'
                      : 'border-slate-600/80'
              }`}
            >
              <Smartphone
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  motionStatus === 'active'
                    ? 'text-sky-300'
                    : motionStatus === 'waiting'
                      ? 'text-amber-300 animate-pulse'
                      : motionStatus === 'denied' || motionStatus === 'unsupported' || motionStatus === 'insecure'
                        ? 'text-red-400'
                        : 'text-slate-400'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleTouchControls();
              }}
              title="Toggle Touch Controls"
              className="bg-slate-950/82 border border-slate-600/80 hover:border-amber-400 p-1 sm:p-1.5 rounded-md text-slate-200 cursor-pointer"
            >
              <Gamepad2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${showTouchControls ? 'text-amber-300' : 'text-slate-400'}`} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleSfxMute();
              }}
              title={sfxMuted ? 'Unmute SFX' : 'Mute SFX'}
              className="bg-slate-950/82 border border-slate-600/80 hover:border-amber-400 p-1 sm:p-1.5 rounded-md text-slate-200 cursor-pointer"
            >
              {sfxMuted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMusicMute();
              }}
              title={musicMuted ? 'Unmute Music' : 'Mute Music'}
              className="bg-slate-950/82 border border-slate-600/80 hover:border-amber-400 p-1 sm:p-1.5 rounded-md text-slate-200 cursor-pointer"
            >
              <span className="relative flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4">
                <Music className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${musicMuted ? 'text-red-400' : 'text-sky-400'}`} />
              </span>
            </button>
            {hud.gameState === GameState.PLAYING && (
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onTogglePause();
                }}
                title="Pause (Esc)"
                className="bg-slate-950/82 border border-slate-600/80 hover:border-amber-400 p-1 sm:p-1.5 rounded-md text-slate-200 cursor-pointer"
              >
                <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upper-Sky Slim Notification Strip: stays clear of the bike in center viewport */}
      <div className="relative z-10 mt-1 sm:mt-2 flex flex-col items-center gap-1 text-center mx-auto max-w-[90vw] sm:max-w-sm">
        {/* Mobile-only compact single notification toast (priority: latestPopup > funnyMessage) */}
        <div className="flex sm:hidden flex-col items-center w-full">
          {hud.latestPopup ? (
            <div
              className={`rounded-md px-2.5 py-0.5 shadow border max-w-full ${
                hud.latestPopup.tone === 'danger'
                  ? 'bg-red-700/92 border-red-300 text-white'
                  : hud.latestPopup.tone === 'refuel'
                    ? 'bg-emerald-700/92 border-emerald-300 text-white'
                    : hud.latestPopup.tone === 'warning'
                      ? 'bg-amber-600/92 border-amber-200 text-white'
                      : 'bg-slate-950/88 border-amber-400 text-amber-300'
              }`}
            >
              <p className="font-bengali text-[11px] font-bold leading-tight truncate">
                {hud.latestPopup.title}
                {hud.latestPopup.subtitle && (
                  <span className="font-semibold text-white/95"> · {hud.latestPopup.subtitle}</span>
                )}
              </p>
            </div>
          ) : hud.funnyMessage ? (
            <div className="bg-amber-400/95 text-slate-950 border border-slate-950 rounded-md px-2.5 py-0.5 shadow max-w-full">
              <p className="font-bengali text-[11px] font-extrabold leading-tight truncate">{hud.funnyMessage}</p>
            </div>
          ) : null}
        </div>

        {/* Compact Showroom Zone Approach Pill */}
        {hud.isInShowroomZone && hud.gameState === GameState.PLAYING && (
          <div className="bg-slate-950/90 border border-amber-400 text-white rounded-lg px-2.5 py-1 shadow">
            <p className="font-bengali text-[10px] sm:text-xs font-bold text-amber-300 flex items-center justify-center gap-1">
              <Store className="w-3 h-3 text-emerald-300 shrink-0" />
              শোরুম টিম স্যালুট দিচ্ছে · ঢুকতে গতি কমান (≤২৫ km/h)
            </p>
          </div>
        )}

        {/* Compact Refueling Pill */}
        {(hud.isRefueling || (hud.isInFuelZone && hud.fuelPercent < 99)) && (
          <div className="bg-emerald-900/92 border border-emerald-300 text-white rounded-lg px-2.5 py-1 shadow">
            {hud.isRefueling ? (
              <p className="font-bengali text-[11px] sm:text-xs font-bold text-amber-200 flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                তেল ভরা হচ্ছে... {hud.fuelPercent}% ({hud.fuelAmount}/{hud.fuelCapacity}L)
              </p>
            ) : (
              <p className="font-bengali text-[10px] sm:text-xs font-bold text-amber-200">
                তেল নিতে গতি কমান (≤২৪ km/h)
              </p>
            )}
          </div>
        )}

        {/* Compact CRASHED sequence alert (keeps 3D rider chase visible) */}
        {hud.gameState === GameState.CRASHED && (
          <div className="bg-red-950/92 border border-amber-400 rounded-xl px-3 py-1.5 shadow-lg max-w-[86vw] sm:max-w-sm">
            <p className="font-bengali text-xs sm:text-sm font-extrabold text-amber-300 leading-tight">
              থামো! পাবলিক আসছে... (WATCH OUT!)
            </p>
            <p className="font-bengali text-[10px] sm:text-xs text-white mt-0.5 leading-snug">{hud.gameOverReasonBn}</p>
          </div>
        )}
      </div>

      {/* === GAME OVER MODAL === */}
      {hud.gameState === GameState.GAME_OVER && (
        <div className="fixed inset-0 z-40 bg-slate-950/75 pointer-events-auto overflow-auto overscroll-contain">
          <div className="min-h-full flex p-3 sm:p-4">
            <div
              ref={gameOverZoom.cardRef}
              style={{ zoom: gameOverZoom.zoom, touchAction: 'pan-x pan-y' }}
              className="w-full max-w-lg bg-slate-950 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 text-center m-auto"
            >
              <CardZoomBar
                zoom={gameOverZoom.zoom}
                onZoomOut={gameOverZoom.zoomOut}
                onZoomIn={gameOverZoom.zoomIn}
                onReset={gameOverZoom.resetZoom}
              />
              <div>
              {hud.isNewBest ? (
                <div className="inline-block bg-amber-400 text-slate-950 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md mb-1.5">
                  নতুন রেকর্ড! • NEW HIGH SCORE!
                </div>
              ) : pointsToBest > 0 ? (
                <div className="inline-block bg-sky-950 border border-sky-400/60 text-sky-200 text-[11px] font-bold px-2.5 py-0.5 rounded-md mb-1.5 font-bengali">
                  সেরা রেকর্ড ভাঙতে আর মাত্র {pointsToBest.toLocaleString()} পয়েন্ট বাকি!
                </div>
              ) : null}
              <h2 className="font-bengali text-2xl sm:text-3xl font-extrabold text-red-400 tracking-wide">
                খেলা শেষ! <span className="text-base font-sans text-red-300">(RIDE OVER)</span>
              </h2>
              <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-amber-400/40 rounded-lg px-3 py-1 mt-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bengali text-xs font-bold text-amber-300">
                  উপাধি: {hud.rankTitleBn}
                </span>
              </div>
              <p className="font-bengali text-sm font-bold text-amber-200 mt-1.5">
                {hud.gameOverReasonBn}
              </p>
              <p className="text-xs text-slate-300 mt-0.5">{hud.gameOverReasonEn}</p>
            </div>

            {/* Funny Street Reactions / Laughing Comments */}
            {hud.gameOverRoastsBn.length > 0 && (
              <div className="bg-amber-950/60 border border-amber-400/60 rounded-xl p-3 text-left space-y-1.5">
                <div className="font-bengali text-xs font-extrabold text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Smile className="w-4 h-4 text-amber-300 shrink-0" /> পাবলিক ও মামাদের হাস্যরস কমেন্ট:
                </div>
                {hud.gameOverRoastsBn.map((line, i) => (
                  <p
                    key={i}
                    className={`font-bengali leading-snug ${
                      i === 0
                        ? 'text-sm font-extrabold text-white bg-red-950/75 border border-red-400/40 rounded-lg px-2.5 py-1.5'
                        : 'text-xs font-semibold text-amber-100 pl-1'
                    }`}
                  >
                    {i > 0 ? '• ' : ''}
                    {line}
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-left">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-2.5">
                <div className="text-[10px] uppercase text-slate-400 font-bold">
                  <span className="font-bengali text-xs text-slate-300 mr-1">মোট স্কোর</span> (Score)
                </div>
                <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-white">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-2.5">
                <div className="text-[10px] uppercase text-amber-300 font-bold">
                  <span className="font-bengali text-xs mr-1">সেরা স্কোর</span> (Best)
                </div>
                <div className="text-xl sm:text-2xl font-extrabold tabular-nums text-amber-300">
                  {hud.bestScore.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  <span className="font-bengali">দূরত্ব / নিয়ম ভঙ্গ</span>
                </span>
                <span className="text-sm font-bold tabular-nums text-white">
                  {hud.distanceMeters}m · <span className="text-rose-300">{hud.ruleBreakCount}x</span>
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  <span className="font-bengali">চুরমার / পিকআপ</span>
                </span>
                <span className="text-sm font-bold tabular-nums text-emerald-300">
                  {hud.wrecksCount} · <span className="text-amber-300">{hud.collectiblesCount}</span>
                </span>
              </div>
            </div>

            <p className="font-bengali text-xs font-semibold text-amber-200/90">
              নতুন খেলায় স্কোর ও বাইক নতুন করে শুরু হবে।
            </p>

            <button
              type="button"
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.98] text-white font-bold text-base py-3.5 rounded-xl border-2 border-emerald-200 shadow-lg cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              <span className="font-bengali text-lg font-extrabold">আবার খেলুন</span>
              <span className="text-xs uppercase tracking-wider">(RIDE AGAIN · R)</span>
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
