import React, { useEffect, useState } from 'react';
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
  Play,
  RotateCcw,
  Shield,
  Skull,
  Smile,
  Store,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { BIKE_ORDER, BIKE_SPECS, GameState, type BikeTierId, type HudSnapshot } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  showTouchControls: boolean;
  onStart: () => void;
  onToggleMute: () => void;
  onToggleTouchControls: () => void;
  onOpenShowroom: () => void;
  onCloseShowroom: () => void;
  onSelectBike: (bikeId: BikeTierId) => { ok: boolean; message: string } | void;
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

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  showTouchControls,
  onStart,
  onToggleMute,
  onToggleTouchControls,
  onOpenShowroom,
  onCloseShowroom,
  onSelectBike,
}) => {
  const [showroomFeedback, setShowroomFeedback] = useState<string | null>(null);
  const lowFuel = hud.fuelPercent <= 25;

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

  // === MENU SCREEN ===
  if (hud.gameState === GameState.MENU) {
    return (
      <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
        {/* Top bar: Best Score + Hero Bank + Audio Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
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
        <div className="flex flex-col items-center gap-3 max-w-lg mx-auto w-full mb-1 pointer-events-auto">
          <TitleLockupSVG />

          <div className="w-full bg-slate-950/90 border-2 border-amber-400/60 rounded-2xl p-4 shadow-2xl space-y-2.5">
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
    );
  }

  // === SCREEN FLASH OVERLAY CLASS ===
  const flashClass =
    hud.screenFlashTone === 'red'
      ? 'bg-red-600/28 border-8 border-red-500/60'
      : hud.screenFlashTone === 'amber'
        ? 'bg-amber-400/20 border-8 border-amber-300/55'
        : hud.screenFlashTone === 'green'
          ? 'bg-emerald-500/20 border-8 border-emerald-300/55'
          : '';

  // === PLAYING / CRASHED / GAME OVER HUD ===
  const missionPct = Math.min(100, Math.round((hud.mission.progress / Math.max(1, hud.mission.target)) * 100));
  const pointsToBest = Math.max(0, hud.bestScore - hud.score);

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4">
      {/* Subtle high-speed / Raja Fever perimeter glow */}
      {hud.gameState === GameState.PLAYING && (hud.speedKmh > 105 || hud.feverActive) && (
        <div
          className={`fixed inset-0 pointer-events-none transition-opacity duration-150 ${
            hud.feverActive
              ? 'border-[6px] border-amber-400/45 shadow-[inset_0_0_48px_rgba(251,191,36,0.28)]'
              : 'border-[4px] border-sky-400/35 shadow-[inset_0_0_36px_rgba(56,189,248,0.22)]'
          }`}
        />
      )}

      {/* Non-blocking impact / refuel screen flash */}
      {hud.screenFlashTone !== 'none' && (
        <div className={`fixed inset-0 pointer-events-none transition-opacity duration-100 ${flashClass}`} />
      )}

      {/* Top Perimeter Row */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        {/* Top-Left: স্কোর (Score), হিরো ব্যাংক (Hero Bank), কম্বো, Violations & Angry Mob */}
        <div className="flex flex-col gap-1.5">
          <div className="bg-slate-950/88 border border-amber-400/55 rounded-xl px-3 py-2 shadow-lg min-w-[172px]">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <span className="font-bengali text-xs font-bold text-amber-300">স্কোর</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 ml-1">Score</span>
              </div>
              <span className="text-xl sm:text-2xl font-bold tabular-nums leading-none text-white">
                {hud.score.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-1 text-[11px] text-slate-300">
              <span>
                <span className="font-bengali text-slate-400">সেরা:</span>{' '}
                <strong className="tabular-nums text-amber-200">{hud.bestScore.toLocaleString()}</strong>
              </span>
              <span className="tabular-nums text-emerald-300 font-semibold">
                <span className="font-bengali">ল্যাপ</span> {hud.lapCount}
              </span>
            </div>

            {/* Hero Bank & Next Bike Progress */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-800">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-bengali text-emerald-300 font-bold flex items-center gap-1">
                  <Store className="w-3 h-3" /> ব্যাংক:
                </span>
                <span className="tabular-nums font-extrabold text-amber-300">
                  {hud.bankScore.toLocaleString()}
                </span>
              </div>
              {nextBike ? (
                <div className="mt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className={`font-bengali font-bold ${canAffordNext ? 'text-amber-300' : 'text-slate-400'}`}>
                      {canAffordNext ? 'শোরুমে যান! (Upgrade Ready)' : `টার্গেট Tier ${nextBike.tier}`}
                    </span>
                    <span className="tabular-nums text-slate-300">{nextBike.cost.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full transition-all duration-150 ${
                        canAffordNext ? 'bg-amber-400' : 'bg-sky-400'
                      }`}
                      style={{ width: `${nextUnlockProgressPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[10px] font-bengali font-bold text-emerald-300 mt-0.5">
                  সব হিরো বাইক আনলকড! (Apex Titan)
                </div>
              )}
            </div>
          </div>

          {/* Active Bike Badge + Zone + Rule-Breaker Counter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="bg-slate-950/88 border border-amber-400/50 rounded-lg px-2 py-1 flex items-center gap-1.5 text-[11px] shadow">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeBike.accentHex }}
              />
              <span className="font-bengali font-bold text-white">
                T{activeBike.tier} · {activeBike.nameBn}
              </span>
            </div>
            <div className="bg-slate-950/85 border border-slate-700 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-[11px] text-sky-200 shadow">
              <Compass className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span className="font-bengali font-semibold">{hud.zoneLabelBn}</span>
            </div>
            {hud.ruleBreakCount > 0 && (
              <div className="bg-rose-950/90 border border-rose-400/70 rounded-lg px-2 py-1 text-[11px] text-rose-200 shadow">
                <span className="font-bengali font-bold">নিয়ম ভঙ্গ:</span>{' '}
                <strong className="tabular-nums text-amber-300">{hud.ruleBreakCount}</strong>
              </div>
            )}
          </div>

          {/* Live Micro-Mission Card */}
          <div className="bg-slate-950/88 border border-emerald-500/55 rounded-lg px-2.5 py-1.5 shadow max-w-[230px]">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bengali font-bold text-emerald-300 truncate">
                লক্ষ্য: {hud.mission.titleBn}
              </span>
              <span className="tabular-nums font-bold text-amber-300 shrink-0">
                {hud.mission.progress}/{hud.mission.target}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-100"
                  style={{ width: `${missionPct}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-amber-200 tabular-nums">+{hud.mission.reward}</span>
            </div>
          </div>

          {hud.combo > 1 && (
            <div
              className={`${
                hud.feverActive ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-amber-500'
              } text-slate-950 rounded-lg px-2.5 py-1 shadow-md border border-amber-200`}
            >
              <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                <span className="flex items-center gap-1 font-bengali">
                  <Zap className="w-3.5 h-3.5 fill-current" />{' '}
                  {hud.feverActive ? 'রাজার ঝড়! FEVER' : 'কম্বো (COMBO)'}
                </span>
                <span className="tabular-nums text-sm">x{hud.combo}</span>
              </div>
              <div className="w-full h-1 bg-amber-950/30 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-slate-950 transition-all duration-75"
                  style={{ width: `${Math.round(hud.comboTimerNorm * 100)}%` }}
                />
              </div>
            </div>
          )}

          {hud.angryMobCount > 0 && (
            <div className="bg-orange-700/95 border border-amber-300 text-white rounded-lg px-2.5 py-1.5 shadow-lg flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-200 shrink-0" />
              <span className="font-bengali text-xs font-bold">
                ক্ষিপ্ত জনতা ধাওয়া করছে! ({hud.angryMobCount})
              </span>
            </div>
          )}

          {hud.activeViolation && (
            <div className="bg-red-700/95 border border-red-200 text-white rounded-lg px-2.5 py-1.5 shadow-lg flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
              <span className="font-bengali text-xs font-bold">{hud.activeViolation}</span>
            </div>
          )}
        </div>

        {/* Top-Center: Funny High-Speed Bengali Message & Event Popups */}
        <div className="hidden sm:flex flex-col items-center gap-1.5 max-w-md text-center">
          {hud.funnyMessage && (
            <div className="bg-amber-400 text-slate-950 border-2 border-slate-950 rounded-xl px-4 py-2 shadow-xl">
              <p className="font-bengali text-sm font-extrabold leading-snug">{hud.funnyMessage}</p>
            </div>
          )}
          {hud.latestPopup && (
            <div
              className={`rounded-lg px-3.5 py-1.5 shadow-lg border ${
                hud.latestPopup.tone === 'danger'
                  ? 'bg-red-700/95 border-red-300 text-white'
                  : hud.latestPopup.tone === 'refuel'
                    ? 'bg-emerald-700/95 border-emerald-300 text-white'
                    : hud.latestPopup.tone === 'warning'
                      ? 'bg-amber-600/95 border-amber-200 text-white'
                      : 'bg-slate-950/92 border-amber-400 text-amber-300'
              }`}
            >
              <p className="font-bengali text-xs font-bold">{hud.latestPopup.title}</p>
              {hud.latestPopup.subtitle && (
                <p className="text-[11px] font-bold text-white">{hud.latestPopup.subtitle}</p>
              )}
            </div>
          )}
        </div>

        {/* Top-Right: গতি (Speedometer + Bar), তেল (Fuel), পাম্প ও শোরুম দূরত্ব, Utility Buttons */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="bg-slate-950/88 border border-slate-600 rounded-xl px-3 py-2 shadow-lg min-w-[164px]">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="font-bengali text-[11px] font-bold text-slate-300">গতি</span>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 ml-1">Speed</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-2xl sm:text-3xl font-bold tabular-nums leading-none ${
                    hud.speedKmh > 110
                      ? 'text-sky-300'
                      : hud.speedKmh > 80
                        ? 'text-amber-300'
                        : 'text-white'
                  }`}
                >
                  {hud.speedKmh}
                </span>
                <span className="text-[10px] font-bold text-slate-400">km/h</span>
              </div>
            </div>

            {/* Speedometer bar */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5 border border-slate-700">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.speedKmh > 110
                    ? 'bg-sky-400'
                    : hud.speedKmh > 80
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.round(hud.speedNorm * 100)}%` }}
              />
            </div>

            {/* Fuel (তেল) Meter */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className={`font-bengali font-bold flex items-center gap-1 ${lowFuel ? 'text-red-400' : 'text-emerald-300'}`}>
                  <Fuel className="w-3.5 h-3.5" /> তেল
                </span>
                <span className={`font-bold tabular-nums ${lowFuel ? 'text-red-300' : 'text-white'}`}>
                  {hud.fuelAmount}/{hud.fuelCapacity}L <span className="text-[10px] text-slate-400">({hud.fuelPercent}%)</span>
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
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
              <div className="flex items-center justify-between text-[10px] text-slate-300 mt-1">
                <span className="font-bengali flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" /> পাম্প:
                </span>
                <span className="tabular-nums font-bold text-emerald-300">{hud.nearestPumpMeters}m</span>
              </div>
              <div className="flex items-center justify-between text-[10px] mt-0.5">
                <span className={`font-bengali flex items-center gap-1 ${canAffordNext ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
                  <Store className="w-3 h-3 text-amber-400" /> নিলয় শোরুম:
                </span>
                <span className={`tabular-nums font-bold ${canAffordNext ? 'text-amber-300' : 'text-sky-300'}`}>
                  {hud.nearestShowroomMeters}m
                </span>
              </div>
            </div>
          </div>

          {/* Upcoming Traffic Light Indicator */}
          {hud.upcomingLight && (
            <div className="bg-slate-950/88 border border-slate-600 rounded-lg px-2.5 py-1 flex items-center gap-2 text-[11px]">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  hud.upcomingLight === 'RED'
                    ? 'bg-red-500'
                    : hud.upcomingLight === 'YELLOW'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                }`}
              />
              <span className="font-bengali text-slate-200">সিগন্যাল</span>
              <span className="tabular-nums font-bold text-white">{hud.upcomingLightMeters}m</span>
            </div>
          )}

          {/* Compact Mute + Touch Pad toggle */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleTouchControls();
              }}
              title="Toggle Touch Controls"
              className="bg-slate-950/88 border border-slate-600 hover:border-amber-400 p-1.5 rounded-lg text-slate-200 cursor-pointer"
            >
              <Gamepad2 className={`w-4 h-4 ${showTouchControls ? 'text-amber-300' : 'text-slate-400'}`} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              title={muted ? 'Unmute' : 'Mute'}
              className="bg-slate-950/88 border border-slate-600 hover:border-amber-400 p-1.5 rounded-lg text-slate-200 cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Center Toast (visible on small screens below top HUD) */}
      <div className="relative z-10 flex sm:hidden flex-col items-center gap-1.5 text-center mx-auto max-w-[92vw] mt-1">
        {hud.funnyMessage && (
          <div className="bg-amber-400 text-slate-950 border-2 border-slate-950 rounded-xl px-3 py-1.5 shadow-xl">
            <p className="font-bengali text-xs font-extrabold leading-snug">{hud.funnyMessage}</p>
          </div>
        )}
        {hud.latestPopup && (
          <div className="bg-slate-950/92 border border-amber-400 text-amber-300 rounded-lg px-3 py-1 shadow-md">
            <p className="font-bengali text-xs font-bold">{hud.latestPopup.title}</p>
            {hud.latestPopup.subtitle && (
              <p className="text-[10px] font-semibold text-white">{hud.latestPopup.subtitle}</p>
            )}
          </div>
        )}
      </div>

      {/* Showroom Zone Approach Banner */}
      {hud.isInShowroomZone && hud.gameState === GameState.PLAYING && (
        <div className="relative z-10 mx-auto mb-2 bg-gradient-to-r from-red-950 via-slate-950 to-red-950 border-2 border-amber-400 text-white rounded-xl px-4 py-2 shadow-xl text-center">
          <p className="font-bengali text-xs sm:text-sm font-extrabold text-amber-300 flex items-center justify-center gap-1.5">
            <Store className="w-4 h-4 text-emerald-300" />
            নিলয় হিরো শোরুম টিম স্যালুট দিচ্ছে! ঢুকতে গতি কমান (≤২৫ km/h)
          </p>
        </div>
      )}

      {/* Refueling Banner */}
      {(hud.isRefueling || (hud.isInFuelZone && hud.fuelPercent < 99)) && (
        <div className="relative z-10 mx-auto mb-44 sm:mb-40 bg-emerald-900/95 border-2 border-emerald-300 text-white rounded-xl px-4 py-2 shadow-xl text-center">
          {hud.isRefueling ? (
            <p className="font-bengali text-sm font-bold text-amber-200 flex items-center justify-center gap-1.5">
              <Flame className="w-4 h-4 text-sky-300" />
              তেল ভরা হচ্ছে (Refueling)... {hud.fuelAmount}/{hud.fuelCapacity}L ({hud.fuelPercent}%)
            </p>
          ) : (
            <p className="font-bengali text-xs font-bold text-amber-200">
              তেল নিতে গতি কমান বা থামুন (≤২০ km/h · Slow to refill)
            </p>
          )}
        </div>
      )}

      {/* CRASHED sequence banner before Game Over modal */}
      {hud.gameState === GameState.CRASHED && (
        <div className="relative z-10 mx-auto mb-44 sm:mb-36 bg-red-950/95 border-2 border-amber-400 rounded-2xl px-5 py-3 shadow-2xl text-center max-w-md">
          <p className="font-bengali text-base sm:text-lg font-extrabold text-amber-300">
            থামো! পাবলিক আসছে... (WATCH OUT!)
          </p>
          <p className="font-bengali text-xs text-white mt-0.5">{hud.gameOverReasonBn}</p>
        </div>
      )}

      {/* === GAME OVER MODAL === */}
      {hud.gameState === GameState.GAME_OVER && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 pointer-events-auto overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-950 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3 text-center my-auto">
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
      )}
    </div>
  );
};
