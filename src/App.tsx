/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { TouchControls } from './components/TouchControls';
import { HeroRastarEngine } from './game/engine';
import { GameState, type BikeTierId, type HudSnapshot, type InputState } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  gameState: GameState.MENU,
  score: 0,
  bankScore: 0,
  bestScore: 0,
  isNewBest: false,
  equippedBikeId: 'glamour_125',
  unlockedBikes: ['glamour_125'],
  speedKmh: 0,
  speedNorm: 0,
  fuelPercent: 100,
  fuelAmount: 100,
  fuelCapacity: 100,
  isRefueling: false,
  isInFuelZone: false,
  nearestPumpMeters: 592,
  isInShowroomZone: false,
  nearestShowroomMeters: 31,
  nextUnlockBikeId: 'xtreme_160r',
  combo: 1,
  comboTimerNorm: 0,
  feverActive: false,
  distanceMeters: 0,
  wrecksCount: 0,
  pedKnockCount: 0,
  nearMissCount: 0,
  ruleBreakCount: 0,
  collectiblesCount: 0,
  angryMobCount: 0,
  activeViolation: null,
  funnyMessage: null,
  latestPopup: null,
  mission: {
    titleBn: 'গাড়ি চুরমার করুন',
    progress: 0,
    target: 4,
    reward: 500,
  },
  rankTitleBn: 'পাড়ার নতুন বাইকার',
  screenFlashTone: 'none',
  gameOverReasonBn: '',
  gameOverReasonEn: '',
  gameOverRoastsBn: [],
  lapCount: 1,
  zoneLabelBn: 'তেজগাঁও • নিলয় হিরো ফ্ল্যাগশিপ (৮৮ তাজউদ্দিন এভ.)',
  isOnElevatedRoad: false,
  turnCueBn: null,
  upcomingLight: null,
  upcomingLightMeters: 0,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HeroRastarEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new HeroRastarEngine(container, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    engineRef.current?.startGame();
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!engineRef.current) return;
    const next = engineRef.current.toggleMute();
    setMuted(next);
  }, []);

  const handleToggleTouchControls = useCallback(() => {
    setShowTouchControls((prev) => {
      if (prev) {
        engineRef.current?.releaseAllTouchControls();
      }
      return !prev;
    });
  }, []);

  const handleTouchControl = useCallback((control: keyof InputState, pressed: boolean) => {
    engineRef.current?.setTouchControl(control, pressed);
  }, []);

  const handleOpenShowroom = useCallback(() => {
    engineRef.current?.openShowroomFromMenu();
  }, []);

  const handleCloseShowroom = useCallback(() => {
    engineRef.current?.closeShowroom();
  }, []);

  const handleSelectBike = useCallback((bikeId: BikeTierId) => {
    return engineRef.current?.purchaseOrEquipBike(bikeId);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-amber-950 select-none">
      {/* Isolated WebGL viewport container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Full-viewport Game Shell HUD */}
      <GameHUD
        hud={hud}
        muted={muted}
        showTouchControls={showTouchControls}
        onStart={handleStart}
        onToggleMute={handleToggleMute}
        onToggleTouchControls={handleToggleTouchControls}
        onOpenShowroom={handleOpenShowroom}
        onCloseShowroom={handleCloseShowroom}
        onSelectBike={handleSelectBike}
      />

      {/* Lower-center multi-touch driving cluster (BRAKE centered) */}
      <TouchControls
        visible={hud.gameState === GameState.PLAYING && showTouchControls}
        onControlChange={handleTouchControl}
      />
    </main>
  );
}
