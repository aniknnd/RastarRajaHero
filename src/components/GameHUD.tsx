import React from 'react';
import {
  AlertTriangle,
  Compass,
  Flame,
  Fuel,
  Gamepad2,
  MapPin,
  Play,
  RotateCcw,
  Skull,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { GameState, type HudSnapshot } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  muted: boolean;
  showTouchControls: boolean;
  onStart: () => void;
  onToggleMute: () => void;
  onToggleTouchControls: () => void;
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
      fontSize="14"
      fontWeight="700"
      fontFamily="Noto Sans Bengali, sans-serif"
    >
      নিটল-নিলয় গ্রুপ নিবেদিত • HERO RASTAR RAJA (DHAKA)
    </text>
  </svg>
);

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  muted,
  showTouchControls,
  onStart,
  onToggleMute,
  onToggleTouchControls,
}) => {
  const lowFuel = hud.fuelPercent <= 25;

  // === MENU SCREEN ===
  if (hud.gameState === GameState.MENU) {
    return (
      <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
        {/* Top bar: Best Score + Audio Toggle */}
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2 bg-slate-950/88 border border-amber-400/55 px-3.5 py-2 rounded-xl shadow-lg">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="font-bengali text-xs font-bold text-amber-200">সেরা স্কোর</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400">(Best)</span>
            <span className="text-base font-bold tabular-nums text-white">{hud.bestScore.toLocaleString()}</span>
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
              <div className="text-xs leading-snug text-emerald-50">
                <p className="font-bengali font-bold text-amber-300 text-[13px]">
                  তেল (Fuel/Petrol) ফুরিয়ে গেলে বাম পাশের &ldquo;তেল পাম্প&rdquo;-এ বা ডাউনটাউন পাম্পে থামুন!
                </p>
                <p className="text-emerald-100/90 mt-0.5 text-[11px]">
                  Keep-left Dhaka rules: Left lanes go forward, oncoming traffic is on the right. Slow below 20 km/h on any green-yellow Fuel Pad to attach the refuel hose (তেল ভরুন). Explore side streets too!
                </p>
              </div>
            </div>

            {/* Rule-Breaker / Smash-Everything Dhaka Pitch */}
            <div className="flex items-center gap-2 bg-red-950/80 border border-amber-400/50 rounded-xl px-2.5 py-2 text-[11px] text-amber-100">
              <Skull className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bengali font-semibold leading-snug">
                সব গাড়ি সিগনাল মানবে — কিন্তু আপনি <strong className="text-amber-300">নিয়ম ভেঙে সব ভেঙ্গে চুরে</strong> এগিয়ে যাবেন! (বাস/ট্রাক ও ক্ষিপ্ত জনতা থেকে সাবধান)
              </span>
            </div>

            {/* Control hint */}
<div className="text-[11px] text-slate-200 bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-center">
              <span className="font-bengali text-amber-300 font-bold">নিয়ন্ত্রণ (Controls):</span>{' '}
              W / ↑ চলুন · S / ↓ পেছনে · A/D বা ,/. ডান-বাম · Shift বুস্ট · Space হ্যান্ডব্রেক · H হর্ন · স্পর্শে তালিকা নিচে দেখুন
            </div>

            <button
              type="button"
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 active:scale-[0.98] text-white font-bold text-lg tracking-wider py-3.5 rounded-xl border-2 border-amber-200 shadow-lg transition-transform cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span className="font-bengali text-xl font-extrabold">শুরু করুন</span>
              <span className="text-xs font-bold uppercase tracking-widest text-amber-100">
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
        {/* Top-Left: স্কোর (Score), সেরা (Best), কম্বো (Combo), Violations & Angry Mob */}
        <div className="flex flex-col gap-1.5">
          <div className="bg-slate-950/88 border border-amber-400/55 rounded-xl px-3 py-2 shadow-lg min-w-[152px]">
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
          </div>

          {/* Zone Pill & Rule-Breaker Counter */}
          <div className="flex flex-wrap items-center gap-1.5">
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

        {/* Top-Right: গতি (Speedometer + Bar), তেল (Fuel), পাম্প দূরত্ব, Utility Buttons */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="bg-slate-950/88 border border-slate-600 rounded-xl px-3 py-2 shadow-lg min-w-[154px]">
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
                  <Fuel className="w-3.5 h-3.5" /> তেল <span className="text-[9px] font-sans opacity-80">(Fuel)</span>
                </span>
                <span className={`font-bold tabular-nums ${lowFuel ? 'text-red-300' : 'text-white'}`}>
                  {hud.fuelPercent}%
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
                  <MapPin className="w-3 h-3 text-amber-400" /> পাম্প:
                </span>
                <span className="tabular-nums font-bold text-amber-300">{hud.nearestPumpMeters}m</span>
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

      {/* Refueling Banner */}
      {(hud.isRefueling || (hud.isInFuelZone && hud.fuelPercent < 99)) && (
        <div className="relative z-10 mx-auto mb-44 sm:mb-40 bg-emerald-900/95 border-2 border-emerald-300 text-white rounded-xl px-4 py-2 shadow-xl text-center">
          {hud.isRefueling ? (
            <p className="font-bengali text-sm font-bold text-amber-200 flex items-center justify-center gap-1.5">
              <Flame className="w-4 h-4 text-sky-300" />
              তেল ভরা হচ্ছে (Refueling)... {hud.fuelPercent}%
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
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/70 pointer-events-auto">
          <div className="w-full max-w-md bg-slate-950 border-2 border-amber-400 rounded-2xl p-5 shadow-2xl space-y-4 text-center">
            <div>
              {hud.isNewBest ? (
                <div className="inline-block bg-amber-400 text-slate-950 text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md mb-2">
                  নতুন রেকর্ড! • NEW HIGH SCORE!
                </div>
              ) : pointsToBest > 0 ? (
                <div className="inline-block bg-sky-950 border border-sky-400/60 text-sky-200 text-[11px] font-bold px-2.5 py-0.5 rounded-md mb-2 font-bengali">
                  সেরা রেকর্ড ভাঙতে আর মাত্র {pointsToBest.toLocaleString()} পয়েন্ট বাকি!
                </div>
              ) : null}
              <h2 className="font-bengali text-2xl sm:text-3xl font-extrabold text-red-400 tracking-wide">
                খেলা শেষ! <span className="text-base font-sans text-red-300">(RIDE OVER)</span>
              </h2>
              <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-amber-400/40 rounded-lg px-3 py-1 mt-1.5">
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

            <div className="grid grid-cols-2 gap-2.5 text-left">
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-3">
                <div className="text-[10px] uppercase text-slate-400 font-bold">
                  <span className="font-bengali text-xs text-slate-300 mr-1">মোট স্কোর</span> (Score)
                </div>
                <div className="text-2xl font-extrabold tabular-nums text-white">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-3">
                <div className="text-[10px] uppercase text-amber-300 font-bold">
                  <span className="font-bengali text-xs mr-1">সেরা স্কোর</span> (Best)
                </div>
                <div className="text-2xl font-extrabold tabular-nums text-amber-300">
                  {hud.bestScore.toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  <span className="font-bengali">দূরত্ব / নিয়ম ভঙ্গ</span>
                </span>
                <span className="text-sm font-bold tabular-nums text-white">
                  {hud.distanceMeters}m · <span className="text-rose-300">{hud.ruleBreakCount}x</span>
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between">
                <span className="text-xs text-slate-300">
                  <span className="font-bengali">চুরমার / পিকআপ</span>
                </span>
                <span className="text-sm font-bold tabular-nums text-emerald-300">
                  {hud.wrecksCount} · <span className="text-amber-300">{hud.collectiblesCount}</span>
                </span>
              </div>
            </div>

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
