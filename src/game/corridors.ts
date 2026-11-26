import * as THREE from 'three';
import {
  buildBikersRestRoom,
  buildDuckMeatStall,
  buildExpresswayBillboard,
  buildExpresswayBuilding,
  buildFlyoverBannerArch,
  buildFlyoverLampPost,
  buildFuelStation,
  buildFootOverbridge,
  buildHighwayDirectionGantry,
  buildMetroRailViaductSegment,
  buildMetroStation,
  buildNeelaMarketStalls,
  buildNiloyHeroShowroom,
  buildTejgaonTurnBillboard,
  buildTongStall,
  buildTrafficLight,
  buildTrafficVehicle,
  buildUTurnSignArch,
  type ShowroomAttendantRig,
  type TrafficLightRig,
} from './models';
import type { ProceduralTextureSet } from './textures';
import { CORRIDOR_CONFIG, GAME_CONFIG, type TrafficLightPhase } from './types';

export type CorridorId =
  | 'metro'
  | 'connector'
  | 'tejgaon'
  | 'mohakhali'
  | 'banani'
  | 'kuril'
  | 'uttara'
  | 'expressway300ft'
  | 'flyover_mohakhali'
  | 'flyover_banani'
  | 'flyover_kuril';

export interface WorldChunk {
  id: string;
  centerX: number;
  centerZ: number;
  halfExtent: number;
  group: THREE.Group;
}

export interface CorridorSurfaceSample {
  groundY: number;
  pitchRad: number;
  onFlyover: boolean;
  corridor: CorridorId;
  deckId: string | null;
}

export interface RestRoomNode {
  id: string;
  labelBn: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CorridorFuelNode {
  id: string;
  label: string;
  padMinX: number;
  padMaxX: number;
  padMinZ: number;
  padMaxZ: number;
  nozzleX: number;
  nozzleY: number;
  nozzleZ: number;
}

export interface CorridorShowroomNode {
  id: string;
  labelBn: string;
  padMinX: number;
  padMaxX: number;
  padMinZ: number;
  padMaxZ: number;
}

export interface CorridorSolidBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CorridorIntersection {
  baseX: number;
  baseZ: number;
  nsLightRigs: TrafficLightRig[];
  ewLightRigs: TrafficLightRig[];
  nsPhase: TrafficLightPhase;
  ewPhase: TrafficLightPhase;
  cycleOffset: number;
  violatedThisPass: boolean;
  bonusAwardedThisPass: boolean;
}

export interface ExpandedCorridorsResult {
  root: THREE.Group;
  chunks: WorldChunk[];
  fuelStations: CorridorFuelNode[];
  showrooms: CorridorShowroomNode[];
  restRooms: RestRoomNode[];
  solidBuildings: CorridorSolidBox[];
  intersections: CorridorIntersection[];
  displayBikes: THREE.Object3D[];
  staff: {
    rig: ShowroomAttendantRig;
    worldX: number;
    baseZ: number;
    baseYaw: number;
    idx: number;
  }[];
}

function smoothstep01(t: number): number {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Evaluates a straight N-S flyover along Z (Mohakhali or Banani).
 */
function evalStraightZFlyover(
  x: number,
  z: number,
  centerX: number,
  halfW: number,
  startZ: number,
  rampLen: number,
  endZ: number,
  peakY: number
): number | null {
  // startZ > endZ (moving North toward -Z)
  if (Math.abs(x - centerX) > halfW) return null;
  if (z > startZ || z < endZ) return null;

  const flatStartZ = startZ - rampLen;
  const flatEndZ = endZ + rampLen;
  if (z >= flatStartZ) {
    return peakY * smoothstep01((startZ - z) / rampLen);
  }
  if (z <= flatEndZ) {
    return peakY * smoothstep01((z - endZ) / rampLen);
  }
  return peakY;
}

interface FlyoverEval {
  y: number;
  id: 'flyover_mohakhali' | 'flyover_banani' | 'flyover_kuril';
  clampX?: number;
  clampZ?: number;
}

/**
 * Evaluates all matching Kuril flyover decks cleanly separated in both XZ and Y:
 *  - Upper Eastbound Skyway (10.6m): x=155 -> R=85.5 arc -> 300ft Eastbound Keep-Left lane z=-2930.5
 *  - Lower Westbound Return Flyover (5.2m): 300ft Westbound Keep-Left lane z=-2909.5 -> R=61.5 arc -> x=168.5
 */
function evalKurilFlyoverCandidates(x: number, z: number): FlyoverEval[] {
  const results: FlyoverEval[] = [];
  const upperPeakY = 10.6;
  const lowerPeakY = 5.2;
  const evalHalfW = 5.3; // Detection corridor wider than clamp (±3.5m) so bikes/cars never drop off deck

  // 1. Upper Eastbound Flyover (10.6m):
  // Approach climb along x=155.0, z=-2735.0 -> -2845.0 (110m)
  if (Math.abs(x - 155.0) <= evalHalfW && z <= -2735.0 && z >= -2845.4) {
    const y = upperPeakY * smoothstep01((-2735.0 - z) / 110.0);
    results.push({ y, id: 'flyover_kuril', clampX: THREE.MathUtils.clamp(x, 155.0 - 3.5, 155.0 + 3.5) });
  }
  // Elevated Arc center (240.5, -2845.0), R=85.5, x <= 240.9, z <= -2844.6
  if (x <= 240.9 && z <= -2844.6) {
    const dx = x - 240.5;
    const dz = z - -2845.0;
    const r = Math.hypot(dx, dz);
    if (Math.abs(r - 85.5) <= evalHalfW) {
      const clampedR = THREE.MathUtils.clamp(r, 85.5 - 3.5, 85.5 + 3.5);
      const scale = r > 0.01 ? clampedR / r : 1;
      results.push({
        y: upperPeakY,
        id: 'flyover_kuril',
        clampX: 240.5 + dx * scale,
        clampZ: -2845.0 + dz * scale,
      });
    }
  }
  // Smooth Upper Eastbound descent onto 300ft Keep-Left middle lane z=-2930.5, x=240.1 -> 425.5 (185m)
  if (Math.abs(z - -2930.5) <= evalHalfW && x >= 240.1 && x <= 425.5) {
    const y = upperPeakY * smoothstep01((425.5 - x) / 185.0);
    results.push({ y, id: 'flyover_kuril', clampZ: THREE.MathUtils.clamp(z, -2930.5 - 3.5, -2930.5 + 3.5) });
  }

  // 2. Lower Westbound Return Flyover (5.2m):
  // Climb from 300ft Westbound Keep-Left middle lane z=-2909.5, x=395.0 -> 229.6 (165m)
  if (Math.abs(z - -2909.5) <= evalHalfW && x <= 395.0 && x >= 229.6) {
    const y = lowerPeakY * smoothstep01((395.0 - x) / 165.0);
    results.push({ y, id: 'flyover_kuril', clampZ: THREE.MathUtils.clamp(z, -2909.5 - 3.5, -2909.5 + 3.5) });
  }
  // Elevated Arc center (230.0, -2848.0), R=61.5, x <= 230.4, z <= -2847.6
  if (x <= 230.4 && z <= -2847.6) {
    const dx = x - 230.0;
    const dz = z - -2848.0;
    const r = Math.hypot(dx, dz);
    if (Math.abs(r - 61.5) <= evalHalfW) {
      const clampedR = THREE.MathUtils.clamp(r, 61.5 - 3.5, 61.5 + 3.5);
      const scale = r > 0.01 ? clampedR / r : 1;
      results.push({
        y: lowerPeakY,
        id: 'flyover_kuril',
        clampX: 230.0 + dx * scale,
        clampZ: -2848.0 + dz * scale,
      });
    }
  }
  // Smooth Lower Westbound descent along x=168.5, z=-2848.4 -> -2725.0 (123m)
  if (Math.abs(x - 168.5) <= evalHalfW && z >= -2848.4 && z <= -2725.0) {
    const y = lowerPeakY * smoothstep01((-2725.0 - z) / 123.0);
    results.push({ y, id: 'flyover_kuril', clampX: THREE.MathUtils.clamp(x, 168.5 - 3.5, 168.5 + 3.5) });
  }

  return results;
}

function getCorridorIdAt(x: number, z: number): CorridorId {
  if (x < 110 && z >= CORRIDOR_CONFIG.METRO_EXT_MIN_Z - 40) {
    if (x > 16 && Math.abs(z - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) <= 22) return 'connector';
    return 'metro';
  }
  if (x > 162) return 'expressway300ft';
  if (z > -1620) return 'tejgaon';
  if (z > -2200) return 'mohakhali';
  if (z > -2750) return 'banani';
  if (z > -3120) return 'kuril';
  return 'uttara';
}

function evalRawHeightAt(
  x: number,
  z: number,
  prevY: number,
  deckLock?: string | null
): { y: number; onFlyover: boolean; flyoverId?: FlyoverEval['id'] } {
  const candidates: FlyoverEval[] = [];

  const mohaY = evalStraightZFlyover(
    x,
    z,
    CORRIDOR_CONFIG.SPINE_X,
    5.1,
    CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_START_Z,
    75,
    CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_END_Z,
    CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_PEAK_Y
  );
  if (mohaY !== null) candidates.push({ y: mohaY, id: 'flyover_mohakhali' });

  const bananiY = evalStraightZFlyover(
    x,
    z,
    CORRIDOR_CONFIG.SPINE_X,
    5.1,
    CORRIDOR_CONFIG.BANANI_FLYOVER_START_Z,
    80,
    CORRIDOR_CONFIG.BANANI_FLYOVER_END_Z,
    CORRIDOR_CONFIG.BANANI_FLYOVER_PEAK_Y
  );
  if (bananiY !== null) candidates.push({ y: bananiY, id: 'flyover_banani' });

  const kurilCandidates = evalKurilFlyoverCandidates(x, z);
  for (const kc of kurilCandidates) {
    candidates.push(kc);
  }

  // Sticky deck lock: a vehicle already on a flyover deck stays locked to THAT
  // deck until the deck surface returns to ~ground at its far touchdown. This
  // prevents a flyover rider from being yanked onto the ground (or another deck)
  // mid-span, and — crucially — stops ground traffic passing UNDER a low ramp
  // from snapping UP onto it (the cause of unfair flyover collisions).
  if (deckLock) {
    const locked = candidates.find((c) => c.id === deckLock);
    if (locked) {
      // Stay on the locked deck while its surface is still meaningfully elevated,
      // OR while the ramp foot is within a small step of the current height.
      if (locked.y > 0.35 || Math.abs(locked.y - prevY) <= 1.85) {
        return { y: locked.y, onFlyover: locked.y > 0.15, flyoverId: locked.id };
      }
      // Deck has returned to ground at touchdown → release the lock below.
    }
    // Locked deck no longer under us (drove off the end) → fall through to normal logic.
  }

  if (candidates.length > 0) {
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (Math.abs(candidates[i].y - prevY) < Math.abs(best.y - prevY)) {
        best = candidates[i];
      }
    }
    // A ground vehicle (prevY ≈ 0, no deck lock) may only mount a flyover at the
    // very FOOT of the ramp (height ≤ 0.6m). This is the key fix: the old 1.85m
    // threshold let ground cars snap onto the low ramp (1–1.8m) and then collide
    // with the player legitimately riding up the flyover.
    if (!deckLock && prevY < 0.3) {
      if (best.y <= 0.6) {
        return { y: best.y, onFlyover: best.y > 0.15, flyoverId: best.id };
      }
      // Low ramp is above the mounting threshold → stay on the ground underneath.
      return { y: 0, onFlyover: false };
    }
    // Already airborne/on a ramp: use the height-proximity lock to stay attached.
    if (Math.abs(best.y - prevY) <= 1.85) {
      return { y: best.y, onFlyover: best.y > 0.15, flyoverId: best.id };
    }
  }

  return { y: 0, onFlyover: false };
}

export function sampleDhakaSurface(
  x: number,
  z: number,
  prevY: number,
  fwdX = 0,
  fwdZ = -1,
  deckLock?: string | null
): CorridorSurfaceSample {
  const cur = evalRawHeightAt(x, z, prevY, deckLock);
  const ahead = evalRawHeightAt(x + fwdX * 0.85, z + fwdZ * 0.85, cur.y, cur.flyoverId ?? null);
  const behind = evalRawHeightAt(x - fwdX * 0.85, z - fwdZ * 0.85, cur.y, cur.flyoverId ?? null);
  const pitchRad = Math.atan2(ahead.y - behind.y, 1.7);

  return {
    groundY: cur.y,
    pitchRad: THREE.MathUtils.clamp(pitchRad, -0.32, 0.32),
    onFlyover: cur.onFlyover,
    corridor: cur.onFlyover && cur.flyoverId ? cur.flyoverId : getCorridorIdAt(x, z),
    deckId: cur.onFlyover && cur.flyoverId ? cur.flyoverId : null,
  };
}

interface DrivableRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const GROUND_DRIVABLE_RECTS: readonly DrivableRect[] = [
  // Metro Rail Downtown Grid (z: -720 .. 0, includes ±34 & ±62 side avenues)
  { minX: -77.1, maxX: 77.1, minZ: -720, maxZ: -1 },
  // Downtown South/Start-End Wide U-Turn Turnaround Loop (behind the spawn, z: -1 .. 78)
  { minX: -25.0, maxX: 25.0, minZ: -1, maxZ: 78 },
  // Metro Rail Extension Corridor (z: -1262 .. -718, Agargaon -> Tejgaon Turnoff)
  { minX: -12.6, maxX: 12.6, minZ: -1280, maxZ: -718 },
  // Metro End Wide U-Turn Turnaround Loop (z: -1262 .. -1198)
  { minX: -19.0, maxX: 19.0, minZ: -1280, maxZ: -1198 },
  // Tejgaon East Connector Link Road (z: -1131 .. -1109, x: 0 .. 150)
  { minX: 0, maxX: 150, minZ: -1131, maxZ: -1109 },
  // Tejgaon -> Mohakhali -> Banani -> Kuril -> Uttara North Highway Spine (includes west showroom/pump bays)
  { minX: 126.4, maxX: 152.0, minZ: CORRIDOR_CONFIG.SPINE_MIN_Z + 4, maxZ: -1006 },
  // Tejgaon South U-Turn Turnaround Plaza
  { minX: 124, maxX: 156, minZ: -1062, maxZ: -1006 },
  // Uttara Wide U-Turn Turnaround Plaza
  { minX: 124, maxX: 156, minZ: CORRIDOR_CONFIG.SPINE_MIN_Z + 4, maxZ: CORRIDOR_CONFIG.UTTARA_UTURN_Z + 45 },
  // 300 Feet South Outbound Carriageway (Eastbound) + Service Edge
  { minX: 140, maxX: CORRIDOR_CONFIG.EXPRESSWAY_MAX_X - 4, minZ: -2916.4, maxZ: -2896.5 },
  // 300 Feet North Inbound Carriageway (Westbound) + Service Edge
  { minX: 140, maxX: CORRIDOR_CONFIG.EXPRESSWAY_MAX_X - 4, minZ: -2943.5, maxZ: -2923.6 },
  // Kuril Flyover Approach & Return Slip Plaza (z: -2765 .. -2685, x: 129.2 .. 175.0)
  { minX: 129.2, maxX: 175.0, minZ: -2765, maxZ: -2685 },
  // Kuril Ground Junction Plaza (connects Spine & 300ft)
  { minX: 129.2, maxX: 220, minZ: -2942, maxZ: -2898 },
  // Mid-Expressway Canal Crossing Bridge (x ~ 796)
  { minX: 778, maxX: 818, minZ: -2941, maxZ: -2899 },
  // Neela Market Canal Crossing Bridge (x ~ 1380)
  { minX: 1356, maxX: 1404, minZ: -2941, maxZ: -2899 },
  // Purbachal End U-Turn Loop Bridge
  { minX: CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 65, maxX: CORRIDOR_CONFIG.EXPRESSWAY_MAX_X - 4, minZ: -2942, maxZ: -2898 },
];

// Extra fuel stations along the Mohakhali -> Uttara spine (both sides), avoiding
// the Mohakhali/Banani flyover decks, the Kuril interchange and the bus terminal.
// Shared by the pump placement and the roadside-building skip so nothing overlaps.
const SPINE_EXTRA_FUEL: readonly { z: number; side: -1 | 1 }[] = [
  { z: -2050, side: 1 },
  { z: -2850, side: 1 },
  { z: -3050, side: -1 },
  { z: -3350, side: 1 },
  { z: -3650, side: -1 },
  { z: -3950, side: 1 },
  { z: -4250, side: -1 },
  { z: -4650, side: 1 },
  { z: -5050, side: -1 },
  { z: -5550, side: 1 },
  { z: -6050, side: -1 },
  { z: -6400, side: 1 },
];

export function clampToDrivableCorridors(
  x: number,
  z: number,
  y: number
): { x: number; z: number; scraped: boolean } {
  // Elevated flyover guardrail clamping as soon as bike/car is on ramp (y > 0.35m)
  if (y > 0.35) {
    if (x < 152 && z > -2100 && z < -1750) {
      const cx = THREE.MathUtils.clamp(x, CORRIDOR_CONFIG.SPINE_X - 4.4, CORRIDOR_CONFIG.SPINE_X + 4.4);
      return { x: cx, z, scraped: cx !== x };
    }
    if (x < 152 && z > -2720 && z < -2380) {
      const cx = THREE.MathUtils.clamp(x, CORRIDOR_CONFIG.SPINE_X - 4.4, CORRIDOR_CONFIG.SPINE_X + 4.4);
      return { x: cx, z, scraped: cx !== x };
    }
    const kurilCandidates = evalKurilFlyoverCandidates(x, z);
    if (kurilCandidates.length > 0) {
      let best = kurilCandidates[0];
      for (let i = 1; i < kurilCandidates.length; i++) {
        if (Math.abs(kurilCandidates[i].y - y) < Math.abs(best.y - y)) {
          best = kurilCandidates[i];
        }
      }
      if (Math.abs(best.y - y) <= 2.2) {
        const nx = best.clampX ?? x;
        const nz = best.clampZ ?? z;
        return { x: nx, z: nz, scraped: Math.hypot(nx - x, nz - z) > 0.01 };
      }
    }
  }

  for (const r of GROUND_DRIVABLE_RECTS) {
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      return { x, z, scraped: false };
    }
  }

  // Project onto the nearest valid drivable rectangle
  let bestX = x;
  let bestZ = z;
  let bestDistSq = Infinity;
  for (const r of GROUND_DRIVABLE_RECTS) {
    const cx = THREE.MathUtils.clamp(x, r.minX, r.maxX);
    const cz = THREE.MathUtils.clamp(z, r.minZ, r.maxZ);
    const dSq = (cx - x) * (cx - x) + (cz - z) * (cz - z);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestX = cx;
      bestZ = cz;
    }
  }

  return { x: bestX, z: bestZ, scraped: bestDistSq > 0.0004 };
}

function buildStraightFlyoverMesh(
  centerX: number,
  startZ: number,
  rampLen: number,
  endZ: number,
  peakY: number,
  halfWidth: number,
  asphaltMat: THREE.Material,
  concreteMat: THREE.Material,
  railMat: THREE.Material,
  lampTheme: 'sky' | 'gold' = 'sky',
  funnyBannerTex?: THREE.CanvasTexture
): THREE.Group {
  const g = new THREE.Group();
  const totalLen = Math.abs(endZ - startZ);
  const segs = 28;
  const dz = totalLen / segs;

  for (let s = 0; s < segs; s++) {
    const z0 = startZ - s * dz;
    const z1 = startZ - (s + 1) * dz;
    const zMid = (z0 + z1) * 0.5;
    const y0 = evalStraightZFlyover(centerX, z0, centerX, halfWidth, startZ, rampLen, endZ, peakY) ?? 0;
    const y1 = evalStraightZFlyover(centerX, z1, centerX, halfWidth, startZ, rampLen, endZ, peakY) ?? 0;
    const yMid = (y0 + y1) * 0.5;
    const segLen = Math.hypot(dz, y1 - y0);
    const pitch = Math.atan2(y1 - y0, dz);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, 0.45, segLen + 0.15), concreteMat);
    slab.position.set(centerX, yMid - 0.22, zMid);
    slab.rotation.x = pitch;
    slab.receiveShadow = true;
    g.add(slab);

    const topRoad = new THREE.Mesh(new THREE.PlaneGeometry(halfWidth * 2 - 0.5, segLen + 0.12), asphaltMat);
    topRoad.position.set(centerX, yMid + 0.03, zMid);
    topRoad.rotation.x = -Math.PI / 2 + pitch;
    topRoad.receiveShadow = true;
    g.add(topRoad);

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, segLen + 0.12), railMat);
      rail.position.set(centerX + side * (halfWidth - 0.16), yMid + 0.42, zMid);
      rail.rotation.x = pitch;
      g.add(rail);
    }

    // Beautiful architectural lamp posts mounted along flyover barriers
    if (yMid > 1.1 && s % 3 === 1) {
      const side = (Math.floor(s / 3) % 2 === 0 ? -1 : 1) as -1 | 1;
      const lamp = buildFlyoverLampPost(side, lampTheme);
      lamp.position.set(centerX + side * (halfWidth - 0.16), yMid + 0.35, zMid);
      lamp.rotation.x = pitch;
      g.add(lamp);
    }

    // Funny Dhaka overhead flyover banner arch at crest
    if (funnyBannerTex && s === Math.floor(segs / 2)) {
      const arch = buildFlyoverBannerArch(funnyBannerTex, halfWidth * 2 - 0.25, 4.95);
      arch.position.set(centerX, yMid, zMid);
      g.add(arch);
    }

    // Support piers under elevated middle section
    if (yMid > 2.4 && s % 4 === 0) {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, yMid - 0.2, 8), concreteMat);
      pier.position.set(centerX, (yMid - 0.2) * 0.5, zMid);
      pier.castShadow = true;
      g.add(pier);
    }
  }

  return g;
}

interface CurvedRampDecor {
  lampTheme?: 'sky' | 'gold';
  banners?: { segIdx: number; tex: THREE.CanvasTexture; accentColor?: number }[];
}

function buildCurvedRampStrip(
  points: { x: number; y: number; z: number }[],
  width: number,
  asphaltMat: THREE.Material,
  concreteMat: THREE.Material,
  railMat: THREE.Material,
  centerLineMat: THREE.Material,
  decor?: CurvedRampDecor
): THREE.Group {
  const g = new THREE.Group();
  const lampTheme = decor?.lampTheme ?? 'sky';
  const bannerMap = new Map<number, { tex: THREE.CanvasTexture; accentColor?: number }>();
  if (decor?.banners) {
    for (const b of decor.banners) {
      bannerMap.set(b.segIdx, b);
    }
  }

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const horizLen = Math.hypot(dx, dz);
    const segLen = Math.hypot(horizLen, dy);
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, horizLen);

    const segGroup = new THREE.Group();
    segGroup.position.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5);
    segGroup.rotation.order = 'YXZ';
    segGroup.rotation.y = yaw;
    segGroup.rotation.x = pitch;

    const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.45, segLen + 0.4), concreteMat);
    slab.position.y = -0.22;
    segGroup.add(slab);

    const deck = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.45, segLen + 0.36), asphaltMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.03;
    deck.receiveShadow = true;
    segGroup.add(deck);

    if (i % 2 === 0) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.24, segLen * 0.65), centerLineMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.y = 0.04;
      segGroup.add(stripe);
    }

    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, segLen + 0.36), railMat);
      rail.position.set(side * (width * 0.5 - 0.14), 0.42, 0);
      segGroup.add(rail);
    }

    // Sleek glowing highway lamp posts spaced evenly along the flyover deck
    if (a.y > 0.7 && i % 4 === 2) {
      const side = (Math.floor(i / 4) % 2 === 0 ? -1 : 1) as -1 | 1;
      const lamp = buildFlyoverLampPost(side, lampTheme);
      lamp.position.set(side * (width * 0.5 - 0.14), 0.36, 0);
      segGroup.add(lamp);
    }

    // Funny Dhaka overhead flyover banners
    const bannerSpec = bannerMap.get(i);
    if (bannerSpec) {
      const arch = buildFlyoverBannerArch(bannerSpec.tex, width - 0.28, 4.95, bannerSpec.accentColor ?? 0xfacc15);
      segGroup.add(arch);
    }

    g.add(segGroup);

    // Support piers: over the 300ft ground carriageway (z < -2896, x > 225) use straddle portal bents where deck > 4.9m!
    if (a.y > 2.0 && i % 4 === 0) {
      if (a.z < -2896 && a.x > 225) {
        if (a.y > 4.9) {
          const portal = new THREE.Group();
          portal.position.set(a.x, 0, a.z);
          portal.rotation.y = yaw;
          const beamY = a.y - 0.55;
          const cross = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.75, 0.9), concreteMat);
          cross.position.set(0, beamY, 0);
          portal.add(cross);
          for (const px of [-6.5, 6.5]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, beamY, 8), concreteMat);
            leg.position.set(px, beamY * 0.5, 0);
            leg.castShadow = true;
            portal.add(leg);
          }
          g.add(portal);
        }
      } else {
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, a.y - 0.2, 8), concreteMat);
        pier.position.set(a.x, (a.y - 0.2) * 0.5, a.z);
        pier.castShadow = true;
        g.add(pier);
      }
    }
  }
  return g;
}

function makeSimpleBuilding(w: number, h: number, d: number, facadeTex: THREE.CanvasTexture, signTex: THREE.CanvasTexture, faceDirX: number): THREE.Group {
  const b = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.72, metalness: 0.05 })
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  b.add(body);

  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.25, 0.5, d + 0.25),
    new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.8 })
  );
  parapet.position.y = h + 0.25;
  b.add(parapet);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1.9, Math.min(d * 0.75, 7.5)),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  signBoard.position.set(faceDirX * (w / 2 + 0.14), 4.2, 0);
  b.add(signBoard);
  return b;
}

function makePalm(scale = 1): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * scale, 0.22 * scale, 4.4 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x78553a, roughness: 0.9 })
  );
  trunk.position.y = 2.2 * scale;
  tree.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.08 * scale, 1.9 * scale), frondMat);
    frond.position.set(Math.sin(a) * 0.9 * scale, 4.35 * scale, Math.cos(a) * 0.9 * scale);
    frond.rotation.y = a;
    frond.rotation.x = 0.28;
    tree.add(frond);
  }
  return tree;
}

/**
 * Bashundhara Residential Area (Bashundhara R/A & Sports City) on the 300ft corridor.
 * A compact but complete gated township: entrance plaza, internal streets, apartment
 * clusters on both sides of the expressway, a school, mosque, shopping complex,
 * lake park and sports ground, plus trees, lamps and Bengali wayfinding signage.
 * Everything is placed at least ~25 m clear of the carriageway so it never blocks
 * the road and reads clearly from the chase camera.
 */
function buildBashundharaTownship(textures: ProceduralTextureSet): {
  group: THREE.Group;
  solidBuildings: CorridorSolidBox[];
} {
  const group = new THREE.Group();
  const solidBuildings: CorridorSolidBox[] = [];
  const Z0 = CORRIDOR_CONFIG.EXPRESSWAY_Z;
  const X_MIN = 300;
  const X_MAX = 710;

  // Deterministic layout so the skyline is identical on every load.
  let seed = 0x42415348; // "BASH"
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const jitter = (a: number, b: number) => a + rnd() * (b - a);

  // Materials tuned for high visibility.
  const roadMat = new THREE.MeshStandardMaterial({ map: textures.cityRoad, roughness: 0.88, metalness: 0.03 });
  const paveMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.85 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.95 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8dfcf, roughness: 0.86 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5, metalness: 0.22 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.16,
    metalness: 0.28,
    emissive: 0x0c4a6e,
    emissiveIntensity: 0.55,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.92 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.86 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.4, metalness: 0.3 });
  const gateMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });

  const addFlat = (w: number, d: number, mat: THREE.Material, x: number, z: number, y = 0.018) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  };

  const addTree = (x: number, z: number, scale = 1) => {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, 2.4 * scale, 6), trunkMat);
    trunk.position.y = 1.2 * scale;
    t.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.55 * scale, 3.6 * scale, 7), canopyMat);
    crown.position.y = 3.25 * scale;
    crown.castShadow = true;
    t.add(crown);
    t.position.set(x, 0, z);
    group.add(t);
  };

  const addLamp = (x: number, z: number, dir: -1 | 1) => {
    const l = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 5.4, 7), poleMat);
    pole.position.y = 2.7;
    l.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), poleMat);
    arm.position.set(dir * 0.7, 5.35, 0);
    l.add(arm);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.14, 0.45), glowMat);
    bulb.position.set(dir * 1.42, 5.2, 0);
    l.add(bulb);
    l.position.set(x, 0, z);
    group.add(l);
  };

  const addSign = (x: number, z: number, tex: THREE.CanvasTexture, yaw: number, scale = 1) => {
    const s = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.6, 6), poleMat);
    post.position.y = 1.3;
    s.add(post);
    const board = new THREE.Mesh(new THREE.BoxGeometry(6 * scale, 1.65 * scale, 0.16), new THREE.MeshBasicMaterial({ map: tex }));
    board.position.y = 3.15;
    s.add(board);
    s.position.set(x, 0, z);
    s.rotation.y = yaw;
    group.add(s);
  };

  const addTower = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    facadeIdx: number,
    id: string
  ) => {
    const t = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        map: textures.buildingFacades[facadeIdx % textures.buildingFacades.length],
        roughness: 0.62,
        metalness: 0.1,
      })
    );
    body.position.y = h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    t.add(body);

    const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 2.6, 3.4, d + 2.6), wallMat);
    podium.position.y = 1.7;
    podium.receiveShadow = true;
    t.add(podium);

    for (const s of [-1, 1] as const) {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.76, 0.22), glassMat);
      glass.position.set(0, h * 0.54, s * (d * 0.5 + 0.13));
      t.add(glass);
      const floors = Math.max(3, Math.floor(h / 6));
      for (let f = 1; f < floors; f++) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.16, 0.42), trimMat);
        band.position.set(0, f * 6, s * (d * 0.5 + 0.21));
        t.add(band);
      }
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, 0.55, d + 0.7), trimMat);
    roof.position.y = h + 0.28;
    t.add(roof);

    t.position.set(x, 0, z);
    group.add(t);
    solidBuildings.push({
      id,
      minX: x - w * 0.5 - 1,
      maxX: x + w * 0.5 + 1,
      minZ: z - d * 0.5 - 1,
      maxZ: z + d * 0.5 + 1,
    });
  };

  // =========================================================================
  // MONUMENTAL ENTRY GATE at x=360 — spans over the expressway so it cannot be missed.
  // Two tall pylons flank the road; a bright arch beam crosses high above it.
  // =========================================================================
  const GATE_X = 360;
  const GATE_H = 14;
  const GATE_SPAN_Z = 56; // clear of both carriageways

  // South pylon (z = Z0 + 28)
  const southPylon = new THREE.Mesh(new THREE.BoxGeometry(6, GATE_H, 6), gateMat);
  southPylon.position.set(GATE_X, GATE_H * 0.5, Z0 + 28);
  southPylon.castShadow = true;
  group.add(southPylon);
  const southCap = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 8), accentMat);
  southCap.position.set(GATE_X, GATE_H + 0.6, Z0 + 28);
  group.add(southCap);
  const southGlobe = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), glowMat);
  southGlobe.position.set(GATE_X, GATE_H + 1.6, Z0 + 28);
  group.add(southGlobe);

  // North pylon (z = Z0 - 28)
  const northPylon = new THREE.Mesh(new THREE.BoxGeometry(6, GATE_H, 6), gateMat);
  northPylon.position.set(GATE_X, GATE_H * 0.5, Z0 - 28);
  northPylon.castShadow = true;
  group.add(northPylon);
  const northCap = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 8), accentMat);
  northCap.position.set(GATE_X, GATE_H + 0.6, Z0 - 28);
  group.add(northCap);
  const northGlobe = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), glowMat);
  northGlobe.position.set(GATE_X, GATE_H + 1.6, Z0 - 28);
  group.add(northGlobe);

  // Arch beam spanning across the road at high clearance.
  const beam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, GATE_SPAN_Z + 4), accentMat);
  beam.position.set(GATE_X, GATE_H + 2.6, Z0);
  beam.castShadow = true;
  group.add(beam);
  const beamTop = new THREE.Mesh(new THREE.BoxGeometry(3, 1, GATE_SPAN_Z + 4), gateMat);
  beamTop.position.set(GATE_X, GATE_H + 4.0, Z0);
  group.add(beamTop);

  // Two narrow pylon collision boxes at the sides of the road — the beam itself
  // spans overhead (16.6 m high) so riders drive cleanly under it.
  const pylonBox = (pz: number) => {
    solidBuildings.push({
      id: `Bashundhara_pylon_${pz}`,
      minX: GATE_X - 4,
      maxX: GATE_X + 4,
      minZ: pz - 4,
      maxZ: pz + 4,
    });
  };
  pylonBox(Z0 + 28);
  pylonBox(Z0 - 28);

  // =========================================================================
  // HUGE WELCOME BILLBOARDS flanking the gate — visible from hundreds of meters.
  // =========================================================================
  for (const side of [-1, 1] as const) {
    const board = buildExpresswayBillboard(textures.expresswayBillboards[0]);
    board.position.set(GATE_X + side * 22, 0, Z0 + side * 30);
    board.rotation.y = -Math.PI / 2;
    board.scale.setScalar(1.6);
    group.add(board);
    solidBuildings.push({
      id: `Bashundhara_board_${side}`,
      minX: GATE_X + side * 22 - 12,
      maxX: GATE_X + side * 22 + 12,
      minZ: Z0 + side * 30 - 8,
      maxZ: Z0 + side * 30 + 8,
    });
  }

  // =========================================================================
  // TALL DENSE SKYLINE — clustered apartments on both sides of the road so
  // they read as a city, not isolated towers. Heights 40–80 m.
  // =========================================================================
  const cols = [330, 390, 450, 510, 570, 630, 690];
  for (const side of [-1, 1] as const) {
    // Near row (z = Z0 +/- 42): tallest, closest to road — forms the skyline wall.
    for (const x of cols) {
      addTower(x, Z0 + side * 42, 20, rnd() < 0.5 ? 64 : 52, 16, Math.floor(rnd() * textures.buildingFacades.length), `Bashundhara_near_${side}_${x}`);
    }
    // Mid row (z = Z0 +/- 90): medium height.
    for (const x of cols) {
      addTower(x, Z0 + side * 90, 18, rnd() < 0.5 ? 44 : 36, 14, Math.floor(rnd() * textures.buildingFacades.length), `Bashundhara_mid_${side}_${x}`);
    }
    // Back row (z = Z0 +/- 140): shorter, sparser.
    for (const x of cols) {
      if (rnd() < 0.4) continue;
      addTower(x, Z0 + side * 140, 16, rnd() < 0.5 ? 30 : 24, 12, Math.floor(rnd() * textures.buildingFacades.length), `Bashundhara_back_${side}_${x}`);
    }

    // Street lamps along the internal boulevards.
    for (let x = X_MIN + 20; x <= X_MAX - 20; x += 40) {
      addLamp(x, Z0 + side * 63, side === 1 ? -1 : 1);
    }
    // Trees along the sidewalk edge nearest the highway.
    for (let x = X_MIN + 16; x <= X_MAX - 16; x += 34) {
      addTree(x, Z0 + side * 24, jitter(0.9, 1.2));
    }
  }

  const addAmenity = (
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    tex: THREE.CanvasTexture,
    roofColor: number,
    id: string
  ) => {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    b.add(body);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, h * 0.5, 0.24), glassMat);
    windows.position.set(0, h * 0.62, d * 0.5 + 0.14);
    b.add(windows);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 1, 0.7, d + 1),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.65 })
    );
    roof.position.y = h + 0.35;
    b.add(roof);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(w * 0.9, 16), 2.2, 0.24),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    sign.position.set(0, h + 2.0, d * 0.5 + 0.18);
    b.add(sign);
    b.position.set(x, 0, z);
    group.add(b);
    solidBuildings.push({
      id,
      minX: x - w * 0.5 - 1,
      maxX: x + w * 0.5 + 1,
      minZ: z - d * 0.5 - 1,
      maxZ: z + d * 0.5 + 1,
    });
  };

  // =========================================================================
  // Civic landmarks with big signs — mosque (green dome), school, market.
  // =========================================================================
  addAmenity(420, Z0 - 88, 44, 15, 26, textures.bashundharaSigns.school, 0x0f766e, 'Bashundhara_school');
  addAmenity(570, Z0 - 88, 30, 14, 26, textures.bashundharaSigns.mosque, 0x065f46, 'Bashundhara_mosque');
  addAmenity(470, Z0 + 88, 46, 14, 26, textures.bashundharaSigns.market, 0x9a3412, 'Bashundhara_market');

  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.4, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0x0f9b6c, roughness: 0.35, metalness: 0.2 }));
  dome.position.set(570, 13, Z0 - 88);
  dome.castShadow = true;
  group.add(dome);
  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 8), trimMat);
  finial.position.set(570, 19.6, Z0 - 88);
  group.add(finial);
  for (const dx of [-11, 11]) {
    const minaret = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.35, 24, 10), wallMat);
    minaret.position.set(570 + dx, 12, Z0 - 96);
    group.add(minaret);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0x0f9b6c, roughness: 0.35, metalness: 0.2 }));
    cap.position.set(570 + dx, 25.6, Z0 - 96);
    group.add(cap);
  }

  // Sector direction boards along the approach.
  for (const lx of [445, 545, 645]) {
    addSign(lx, Z0 - 24, textures.bashundharaSigns.sector, -Math.PI / 2, 1.1);
  }

  return { group, solidBuildings };
}

export function buildExpandedDhakaCorridors(textures: ProceduralTextureSet): ExpandedCorridorsResult {
  const root = new THREE.Group();
  const chunks: WorldChunk[] = [];
  const fuelStations: CorridorFuelNode[] = [];
  const showrooms: CorridorShowroomNode[] = [];
  const restRooms: RestRoomNode[] = [];
  const solidBuildings: CorridorSolidBox[] = [];
  const intersections: CorridorIntersection[] = [];
  const displayBikes: THREE.Object3D[] = [];
  const staff: ExpandedCorridorsResult['staff'] = [];

  const roadMat = new THREE.MeshStandardMaterial({ map: textures.road, roughness: 0.85, metalness: 0.04 });
  const expressMat = new THREE.MeshStandardMaterial({ map: textures.expresswayRoad, roughness: 0.82, metalness: 0.04 });
  const plainAsphaltMat = new THREE.MeshStandardMaterial({ color: 0x292e36, roughness: 0.86 });
  const uturnLoopMat = new THREE.MeshStandardMaterial({ map: textures.uturnLoopRoad, roughness: 0.82 });
  const turnArrowMat = new THREE.MeshBasicMaterial({ map: textures.turnPavementArrow });
  const bridgeCrossMat = new THREE.MeshStandardMaterial({ map: textures.bridgeCrossRoad, roughness: 0.84 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.75 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.82 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.65, roughness: 0.35 });
  const chevronRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.92 });
  const canalMat = new THREE.MeshStandardMaterial({
    map: textures.canalWater,
    roughness: 0.16,
    metalness: 0.45,
  });
  const medianMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  const makeFlatPlane = (w: number, h: number, mat: THREE.Material, yaw = 0): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.rotation.order = 'YXZ';
    m.rotation.y = yaw;
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    return m;
  };

  const registerChunk = (id: string, centerX: number, centerZ: number, halfExtent: number, group: THREE.Group) => {
    root.add(group);
    chunks.push({ id, centerX, centerZ, halfExtent, group });
  };

  // =========================================================================
  // 0. DOWNTOWN SOUTH / START-END WIDE U-TURN (z = 0 .. 78)
  //    Mirrors the Metro End turnaround so the road behind the spawn no longer
  //    dead-ends: riders can swing around and head back toward Farmgate/Metro.
  // =========================================================================
  {
    const g = new THREE.Group();
    const uTurnZ = CORRIDOR_CONFIG.DOWNTOWN_SOUTH_UTURN_Z; // 20

    const uArch = buildUTurnSignArch(textures.uturnSigns.downtownSouth, 24);
    uArch.rotation.y = Math.PI;
    uArch.position.set(0, 0, uTurnZ - 16); // world z = 4, just inside the entrance
    g.add(uArch);

    // Far-end marker so the turnaround reads clearly instead of a missing wall.
    const farUArch = buildUTurnSignArch(textures.uturnSigns.downtownSouth, 38);
    farUArch.rotation.y = Math.PI;
    farUArch.position.set(0, 0, uTurnZ + 38); // world z = 58
    g.add(farUArch);

    // Paved turnaround loop, rotated 180° so the chevron bumper faces +Z (south).
    const uLoop = makeFlatPlane(52, 78, uturnLoopMat, Math.PI);
    uLoop.position.set(0, 0.022, uTurnZ + 18); // world z = 38 (covers -1 .. 77)
    g.add(uLoop);

    const endWall = new THREE.Mesh(new THREE.BoxGeometry(39, 1.6, 1.4), chevronRedMat);
    endWall.position.set(0, 0.8, uTurnZ + 57); // world z = 77
    g.add(endWall);
    const endStripe = new THREE.Mesh(
      new THREE.BoxGeometry(39, 0.22, 1.5),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    endStripe.position.set(0, 1.62, uTurnZ + 57);
    g.add(endStripe);

    registerChunk('downtown_south_uturn', 0, uTurnZ + 18, 90, g);
  }

  // =========================================================================
  // 1. METRO EXTENSION (-720 to -1265): Agargaon Metro + Tejgaon Billboard + U-Turn
  // =========================================================================
  const metroFuelStops = [
    { z: -760, id: 'metro_agargaon_approach_pump', label: 'আগারগাঁও মেট্রো রোড পাম্প' },
    { z: -1000, id: 'metro_tejgaon_approach_pump', label: 'তেজগাঁও মোড় মেট্রো পাম্প' },
    { z: -1160, id: 'metro_end_pump', label: 'মেট্রো শেষ প্রান্তের পাম্প' },
  ];

  for (let b = 9; b < 16; b++) {
    const blockLen = 80;
    const baseZ = -(b * blockLen + blockLen / 2); // -760 .. -1240
    const g = new THREE.Group();
    g.position.set(0, 0, baseZ);

    const road = makeFlatPlane(GAME_CONFIG.ARTERY_HALF_WIDTH * 2, blockLen, roadMat);
    g.add(road);

    const isTurnoffBlock = b === 13 || b === 14; // z = -1120 lies at boundary of blocks 13 & 14
    const metroPump = metroFuelStops.find((stop) => Math.abs(stop.z - baseZ) < blockLen / 2);
    for (const side of [-1, 1]) {
      // Leave east sidewalk open at Tejgaon turnoff (-1134..-1106) and open around Metro End U-Turn (b=15)
      if (b === 15 || metroPump) continue;
      if (side === 1 && (b === 13 || b === 14)) {
        const segLen = 24;
        const sw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.11, segLen), sidewalkMat);
        sw.position.set(side * (GAME_CONFIG.ARTERY_HALF_WIDTH + 1.6), 0.045, b === 13 ? 28 : -28);
        g.add(sw);
      } else {
        const sw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.11, blockLen), sidewalkMat);
        sw.position.set(side * (GAME_CONFIG.ARTERY_HALF_WIDTH + 1.6), 0.045, 0);
        g.add(sw);

        // Low guardrail along Metro extension verge so drivable edge is unmistakable
        const curbRail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.55, blockLen), railMat);
        curbRail.position.set(side * (GAME_CONFIG.ARTERY_HALF_WIDTH + 3.15), 0.28, 0);
        g.add(curbRail);
      }
    }

    if (metroPump) {
      for (const roadSide of [-1, 1] as const) {
        const isWestSide = roadSide < 0;
        const pumpX = roadSide * 10.2;
        const station = buildFuelStation(textures, isWestSide);
        station.position.set(pumpX, 0, metroPump.z - baseZ);
        g.add(station);
        fuelStations.push({
          id: `${metroPump.id}_${isWestSide ? 'west' : 'east'}`,
          label: `${metroPump.label} • ${isWestSide ? 'পশ্চিম' : 'পূর্ব'} পাশ`,
          padMinX: isWestSide ? -12.6 : 6.0,
          padMaxX: isWestSide ? -6.0 : 12.6,
          padMinZ: metroPump.z - GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
          padMaxZ: metroPump.z + GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
          nozzleX: roadSide * 13.2,
          nozzleY: 1.25,
          nozzleZ: metroPump.z,
        });
      }
    }

    // Metro Rail Viaduct overhead (keep b=15 pier-free so Metro End U-Turn loop is wide open!)
    if (b < 15) {
      const viaduct = buildMetroRailViaductSegment(textures, blockLen, isTurnoffBlock, b);
      g.add(viaduct);
    }

    // Center yellow median along Metro extension (clear of Tejgaon turnoff & Metro End U-Turn)
    if (b < 15) {
      for (let mz = -32; mz <= 32; mz += 16) {
        const worldMz = baseZ + mz;
        if (Math.abs(worldMz - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 16 || worldMz < -1194) continue;
        const med = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 11.5), medianMat);
        med.position.set(0, 0.15, mz);
        g.add(med);
      }
    }

    // Agargaon Metro Station at b === 11 (z = -920)
    if (b === 11) {
      const station = buildMetroStation(textures, 3);
      g.add(station);
    }

    // Tejgaon Turnoff Giant Billboard, Overhead Gantry & Pavement Turn Arrows at b === 13 (z = -1080)
    if (b === 13) {
      const billboard = buildTejgaonTurnBillboard(textures.tejgaonTurnBillboard);
      billboard.position.set(14.8, 0, -12);
      billboard.rotation.y = -0.24;
      g.add(billboard);

      const gantry = buildHighwayDirectionGantry(textures.tejgaonTurnBillboard);
      gantry.position.set(0, 0, 14);
      g.add(gantry);

      // Painted asphalt turn arrow stencils right on the Metro pavement leading to z=-1120!
      for (const arrowZ of [-12, -26]) {
        const arrow = makeFlatPlane(8.6, 8.6, turnArrowMat);
        arrow.position.set(3.2, 0.018, arrowZ);
        g.add(arrow);
      }
    }

    // Buildings flanking Metro extension (skip east side around turnoff z=-1120 & Metro End U-Turn z<-1200)
    for (const slotZ of [-24, 24]) {
      const worldSlotZ = baseZ + slotZ;
      if (worldSlotZ < -1198) continue;
      for (const side of [-1, 1]) {
        if (side === 1 && Math.abs(worldSlotZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 30) continue;
        const cx = side * 21;
        const h = 11 + ((b * 5 + Math.abs(slotZ)) % 10);
        const bld = makeSimpleBuilding(
          12,
          h,
          17,
          textures.buildingFacades[(b + (side > 0 ? 2 : 0)) % textures.buildingFacades.length],
          textures.shopSigns[(b * 3 + side) % textures.shopSigns.length],
          -side
        );
        bld.position.set(cx, 0, slotZ);
        g.add(bld);
        solidBuildings.push({
          id: `Bld_metro_ext_${b}_${side}_${slotZ}`,
          minX: cx - 6,
          maxX: cx + 6,
          minZ: worldSlotZ - 8.5,
          maxZ: worldSlotZ + 8.5,
        });
      }
    }

    // Metro End U-Turn Arch, Painted Arrows, Warning Gantry & Paved Turnaround Loop at b === 15 (z = -1200 .. -1265)
    if (b === 15) {
      const uArch = buildUTurnSignArch(textures.uturnSigns.metroEnd, 24);
      uArch.position.set(0, 0, 36); // world z = -1204
      g.add(uArch);

      // A second large U-turn marker sits at the far end so it is visible
      // instead of looking like an ordinary road with a missing wall.
      const farUArch = buildUTurnSignArch(textures.uturnSigns.metroEnd, 38);
      farUArch.position.set(0, 0, -18); // world z = -1258
      g.add(farUArch);

      const uLoop = makeFlatPlane(52, 78, uturnLoopMat, 0);
      uLoop.position.set(0, 0.022, 2); // world z = -1238 (covers -1199..-1277)
      g.add(uLoop);

      // Painted U-turn arrow stencils on the approach so riders enter the
      // south-end turnaround clearly (mirrors the Tejgaon turnoff arrows).
      for (const arrowLocalZ of [-8, 8, 24, 40, 52]) {
        const arrow = makeFlatPlane(8.6, 8.6, turnArrowMat);
        arrow.position.set(3.2, 0.018, arrowLocalZ);
        g.add(arrow);
      }

      // "U-Turn Ahead" warning gantry on the approach (world z ~ -1185) so the
      // rider knows to slow and turn before the road ends.
      const warnGantry = buildHighwayDirectionGantry(textures.uturnSigns.metroEnd);
      warnGantry.position.set(0, 0, 55); // world z = -1185
      g.add(warnGantry);
    }

    registerChunk(`metro_ext_${b}`, 0, baseZ, 85, g);
  }

  // =========================================================================
  // 2. TEJGAON EAST LINK ROAD (z = -1120, x = 0 .. 140)
  // =========================================================================
  {
    const g = new THREE.Group();
    g.position.set(70, 0, CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z);

    // Wide seamless intersection aprons at Metro (x=0) and Spine (x=140) so turns have zero Z-fighting
    const metroApron = makeFlatPlane(28, 28, plainAsphaltMat);
    metroApron.position.set(-70, 0.015, 0);
    g.add(metroApron);

    const spineApron = makeFlatPlane(28, 28, plainAsphaltMat);
    spineApron.position.set(70, 0.015, 0);
    g.add(spineApron);

    const linkLen = 148;
    const linkRoad = makeFlatPlane(21.5, linkLen, roadMat, -Math.PI / 2);
    linkRoad.position.set(0, 0.012, 0);
    g.add(linkRoad);

    // Painted turn arrow stencil at Keep-Left Eastbound entrance of Tejgaon Link Road (world x = 14, z = -1124.5)
    const entryArrow = makeFlatPlane(7.5, 7.5, turnArrowMat);
    entryArrow.position.set(-56, 0.02, -4.5);
    g.add(entryArrow);

    for (const sz of [-12.2, 12.2]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(124, 0.14, 2.8), sidewalkMat);
      curb.position.set(0, 0.06, sz);
      g.add(curb);
    }

    // Center yellow dashed divider & streetlamps along Tejgaon Link Road
    for (let dx = -50; dx <= 50; dx += 18) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(10, 0.18, 0.45), medianMat);
      dash.position.set(dx, 0.09, 0);
      g.add(dash);
    }
    for (let lx = -45; lx <= 45; lx += 30) {
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 6), lampPoleMat);
        pole.position.set(lx, 2.9, side * 11.4);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.5), bulbMat);
        bulb.position.set(lx, 5.7, side * 10.2);
        g.add(pole, bulb);

        const bld = makeSimpleBuilding(
          16,
          12 + (Math.abs(lx) % 7),
          12,
          textures.buildingFacades[Math.abs(lx + side) % textures.buildingFacades.length],
          textures.shopSigns[Math.abs(lx) % textures.shopSigns.length],
          0
        );
        bld.position.set(lx, 0, side * 21);
        g.add(bld);
        solidBuildings.push({
          id: `Bld_conn_${lx}_${side}`,
          minX: 70 + lx - 8,
          maxX: 70 + lx + 8,
          minZ: CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z + side * 21 - 6,
          maxZ: CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z + side * 21 + 6,
        });
      }
    }

    // Overhead gantry facing riders entering Tejgaon Spine from Link Road
    const tejEntryGantry = buildHighwayDirectionGantry(textures.corridorGantries.tejgaon);
    tejEntryGantry.rotation.y = -Math.PI / 2;
    tejEntryGantry.position.set(44, 0, 0);
    g.add(tejEntryGantry);

    registerChunk('tejgaon_connector', 70, CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z, 110, g);
  }

  // =========================================================================
  // 3. TEJGAON -> MOHAKHALI -> BANANI -> KURIL -> UTTARA SPINE (x = 140, z = -1020..-3740)
  // =========================================================================
  const spineBlockLen = 80;
  for (let zStart = -1020; zStart > CORRIDOR_CONFIG.SPINE_MIN_Z; zStart -= spineBlockLen) {
    const baseZ = zStart - spineBlockLen / 2;
    const g = new THREE.Group();
    g.position.set(CORRIDOR_CONFIG.SPINE_X, 0, baseZ);

    // Ground road stays centered. The flyover deck (centered) carries the INNER lane
    // of each direction (cars ride up and over); the OUTER lanes stay on the ground on
    // their own correct side. This keeps every lane on the road and avoids wrong-way
    // driving that a cross-over merge would cause.
    const road = makeFlatPlane(CORRIDOR_CONFIG.SPINE_HALF_WIDTH * 2, spineBlockLen, roadMat);
    g.add(road);

    // Sidewalks flanking spine (open at Tejgaon connector z=-1120, Kuril slip/300ft z=-2660..-2980, & U-Turn loops)
    const openWest = Math.abs(baseZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 42;
    const openEast = baseZ <= -2660 && baseZ >= -2980;
    const isUTurnBlock = baseZ > -1070 || baseZ < CORRIDOR_CONFIG.UTTARA_UTURN_Z + 30;
    const skipShowroomWest =
      Math.abs(baseZ - CORRIDOR_CONFIG.TEJGAON_SHOWROOM_Z) < 35 ||
      Math.abs(baseZ - CORRIDOR_CONFIG.UTTARA_SHOWROOM_Z) < 35;
    const skipPumpWest =
      Math.abs(baseZ - CORRIDOR_CONFIG.TEJGAON_PUMP_Z) < 35 ||
      Math.abs(baseZ - CORRIDOR_CONFIG.BANANI_PUMP_Z) < 35 ||
      Math.abs(baseZ - CORRIDOR_CONFIG.UTTARA_PUMP_Z) < 35;

    for (const side of [-1, 1]) {
      if (isUTurnBlock || (side === -1 && (openWest || skipShowroomWest || skipPumpWest)) || (side === 1 && openEast)) {
        continue;
      }
      const sw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.11, spineBlockLen), sidewalkMat);
      sw.position.set(side * (CORRIDOR_CONFIG.SPINE_HALF_WIDTH + 1.6), 0.045, 0);
      g.add(sw);
    }

    // Center dashed yellow divider outside flyover ramps & U-turns
    const nearFlyoverOrTurn =
      baseZ > -1070 ||
      (baseZ < -1760 && baseZ > -2040) ||
      (baseZ < -2400 && baseZ > -2700) ||
      (baseZ < -2740 && baseZ > -2960) ||
      baseZ < CORRIDOR_CONFIG.UTTARA_UTURN_Z + 60 ||
      Math.abs(baseZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 45;
    if (!nearFlyoverOrTurn) {
      for (let mz = -30; mz <= 30; mz += 20) {
        const div = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 11), medianMat);
        div.position.set(0, 0.11, mz);
        g.add(div);
      }
    }

    // Roadside buildings & streetlamps (skip around U-turn plazas & Kuril Flyover Interchange!)
    for (const slotZ of [-22, 22]) {
      const worldZ = baseZ + slotZ;
      if (worldZ > -1068 || worldZ < CORRIDOR_CONFIG.UTTARA_UTURN_Z + 40) continue;
      for (const side of [-1, 1]) {
        if (side === -1 && Math.abs(worldZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 32) continue;
        if (side === 1 && worldZ <= -2670 && worldZ >= -2980) continue;
        // Reserve the east side around the Mohakhali Bus Terminal for the terminal scene
        if (side === 1 && Math.abs(worldZ - CORRIDOR_CONFIG.MOHAKHALI_BUS_TERMINAL_Z) < 52) continue;
        // Reserve both sides around the extra Mohakhali->Uttara fuel stations.
        if (SPINE_EXTRA_FUEL.some((f) => Math.abs(worldZ - f.z) < 24)) continue;
        if (
          side === -1 &&
          (Math.abs(worldZ - CORRIDOR_CONFIG.TEJGAON_SHOWROOM_Z) < 24 ||
            Math.abs(worldZ - CORRIDOR_CONFIG.TEJGAON_PUMP_Z) < 22 ||
            Math.abs(worldZ - CORRIDOR_CONFIG.BANANI_PUMP_Z) < 22 ||
            Math.abs(worldZ - CORRIDOR_CONFIG.UTTARA_PUMP_Z) < 22 ||
            Math.abs(worldZ - CORRIDOR_CONFIG.UTTARA_SHOWROOM_Z) < 24)
        ) {
          continue;
        }
        const bld = makeSimpleBuilding(
          11.5,
          11 + (Math.abs(Math.round(worldZ / 13) + side) % 13),
          16,
          textures.buildingFacades[Math.abs(Math.round(worldZ / 17) + side) % textures.buildingFacades.length],
          textures.shopSigns[Math.abs(Math.round(worldZ / 19)) % textures.shopSigns.length],
          -side
        );
        bld.position.set(side * 20.5, 0, slotZ);
        g.add(bld);
        solidBuildings.push({
          id: `Bld_spine_${worldZ}_${side}`,
          minX: CORRIDOR_CONFIG.SPINE_X + side * 20.5 - 5.75,
          maxX: CORRIDOR_CONFIG.SPINE_X + side * 20.5 + 5.75,
          minZ: worldZ - 8,
          maxZ: worldZ + 8,
        });
      }
    }

    // Streetlamps & Tong Stalls
    for (const lz of [-20, 20]) {
      for (const side of [-1, 1]) {
        if (side === 1 && baseZ + lz <= -2670 && baseZ + lz >= -2980) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 6), lampPoleMat);
        pole.position.set(side * 11.4, 2.9, lz);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.24), bulbMat);
        bulb.position.set(side * 10.2, 5.7, lz);
        g.add(pole, bulb);
      }
    }

    registerChunk(`spine_${baseZ}`, CORRIDOR_CONFIG.SPINE_X, baseZ, 85, g);
  }

  // Spine Landmarks Chunk (Showrooms, Pumps, Foot-Overbridges, Gantries, U-Turns, Flyovers)
  {
    // Helper to add a spine landmark at exact Z
    const addSpineShowroom = (id: string, labelBn: string, worldZ: number) => {
      const g = new THREE.Group();
      const srX = CORRIDOR_CONFIG.SPINE_X - 10.8;
      const built = buildNiloyHeroShowroom(textures, true);
      built.group.position.set(srX, 0, worldZ);
      g.add(built.group);
      displayBikes.push(...built.displayBikes);
      for (const st of built.attendants) {
        staff.push({ rig: st.rig, worldX: srX + st.localX, baseZ: worldZ + st.localZ, baseYaw: st.baseYaw, idx: staff.length });
      }
      showrooms.push({
        id,
        labelBn,
        padMinX: srX - 3.6,
        padMaxX: srX + 3.4,
        padMinZ: worldZ - GAME_CONFIG.SHOWROOM_PAD_HALF_LENGTH,
        padMaxZ: worldZ + GAME_CONFIG.SHOWROOM_PAD_HALF_LENGTH,
      });
      solidBuildings.push({
        id: `Bld_${id}`,
        minX: srX - 13.3,
        maxX: srX - 3.4,
        minZ: worldZ - 9.5,
        maxZ: worldZ + 9.5,
      });
      registerChunk(`sr_${id}`, CORRIDOR_CONFIG.SPINE_X, worldZ, 70, g);
    };

    const addSpineFuel = (id: string, label: string, worldZ: number) => {
      const g = new THREE.Group();
      const stX = CORRIDOR_CONFIG.SPINE_X - 10.8;
      const station = buildFuelStation(textures, true);
      station.position.set(stX, 0, worldZ);
      g.add(station);
      fuelStations.push({
        id,
        label,
        padMinX: stX - 3.2,
        padMaxX: stX + 3.2,
        padMinZ: worldZ - GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
        padMaxZ: worldZ + GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
        nozzleX: stX - 3.2,
        nozzleY: 1.45,
        nozzleZ: worldZ,
      });
      registerChunk(`fuel_${id}`, CORRIDOR_CONFIG.SPINE_X, worldZ, 60, g);
    };

    addSpineShowroom('tejgaon_showroom', 'তেজগাঁও নিলয় হিরো শোরুম', CORRIDOR_CONFIG.TEJGAON_SHOWROOM_Z);
    addSpineFuel('tejgaon_pump', 'তেজগাঁও হিরো তেল পাম্প', CORRIDOR_CONFIG.TEJGAON_PUMP_Z);
    addSpineFuel('banani_pump', 'বনানী হিরো তেল পাম্প', CORRIDOR_CONFIG.BANANI_PUMP_Z);
    addSpineFuel('uttara_pump', 'উত্তরা হিরো তেল পাম্প', CORRIDOR_CONFIG.UTTARA_PUMP_Z);
    addSpineShowroom('uttara_showroom', 'উত্তরা নিলয় হিরো শোরুম', CORRIDOR_CONFIG.UTTARA_SHOWROOM_Z);

    // Extra fuel stations along the Mohakhali -> Uttara spine on BOTH sides.
    {
      const g = new THREE.Group();
      const eastX = CORRIDOR_CONFIG.SPINE_X + 10.8;
      const westX = CORRIDOR_CONFIG.SPINE_X - 10.8;
      for (const [idx, fp] of SPINE_EXTRA_FUEL.entries()) {
        const stX = fp.side === 1 ? eastX : westX;
        const station = buildFuelStation(textures, fp.side === 1);
        station.position.set(stX, 0, fp.z);
        g.add(station);
        fuelStations.push({
          id: `spine_extra_fuel_${idx}`,
          label: `মহাখালী-উত্তরা হিরো তেল পাম্প (${fp.side === 1 ? 'পূর্ব' : 'পশ্চিম'} ${idx + 1})`,
          padMinX: stX - 3.2,
          padMaxX: stX + 3.2,
          padMinZ: fp.z - GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
          padMaxZ: fp.z + GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
          nozzleX: stX,
          nozzleY: 1.45,
          nozzleZ: fp.z,
        });
      }
      // One chunk spanning the whole spine fuel stretch so culling stays simple.
      registerChunk('spine_extra_fuel', CORRIDOR_CONFIG.SPINE_X, -4200, 2400, g);
    }

    // Pedestrian Foot-Overbridges (normal Dhaka overbridges at Tejgaon, Mohakhali, Banani, Uttara)
    for (const fob of [
      { id: 'fob_tejgaon', z: -1420, tex: textures.corridorGantries.tejgaon },
      { id: 'fob_mohakhali', z: -2120, tex: textures.corridorGantries.mohakhali },
      { id: 'fob_banani', z: -2340, tex: textures.corridorGantries.banani },
      { id: 'fob_uttara', z: -3260, tex: textures.corridorGantries.uttara },
    ]) {
      const g = new THREE.Group();
      const bridge = buildFootOverbridge(23.6, 5.5, fob.tex);
      bridge.position.set(CORRIDOR_CONFIG.SPINE_X, 0, fob.z);
      g.add(bridge);
      registerChunk(fob.id, CORRIDOR_CONFIG.SPINE_X, fob.z, 60, g);
    }

    // Directional Gantries & Wide U-Turn Loop Plazas along Spine
    {
      const g = new THREE.Group();
      const tejSouthU = buildUTurnSignArch(textures.uturnSigns.tejgaonSouth, 24);
      tejSouthU.rotation.y = Math.PI;
      tejSouthU.position.set(CORRIDOR_CONFIG.SPINE_X, 0, -1048);
      g.add(tejSouthU);

      // Tejgaon South U-Turn Loop Plaza (rotated 180deg so loop tip faces +Z South end!)
      const tejSouthLoop = makeFlatPlane(34, 56, uturnLoopMat, Math.PI);
      tejSouthLoop.position.set(CORRIDOR_CONFIG.SPINE_X, 0.022, -1033);
      g.add(tejSouthLoop);
      const tejSouthEndWall = new THREE.Mesh(new THREE.BoxGeometry(36, 1.1, 1.2), chevronRedMat);
      tejSouthEndWall.position.set(CORRIDOR_CONFIG.SPINE_X, 0.55, -1004);
      g.add(tejSouthEndWall);

      const mohaGantry = buildHighwayDirectionGantry(textures.corridorGantries.mohakhali);
      mohaGantry.position.set(CORRIDOR_CONFIG.SPINE_X, 0, -1720);
      g.add(mohaGantry);

      const kurilGantry = buildHighwayDirectionGantry(textures.kurilSplitGantry);
      kurilGantry.position.set(CORRIDOR_CONFIG.SPINE_X, 0, -2710);
      g.add(kurilGantry);

      const uttaraU = buildUTurnSignArch(textures.uturnSigns.uttara, 26);
      uttaraU.position.set(CORRIDOR_CONFIG.SPINE_X, 0, CORRIDOR_CONFIG.UTTARA_UTURN_Z + 18);
      g.add(uttaraU);

      // Uttara wide turnaround loop plaza (z = -3645 .. -3738)
      const uturnPad = makeFlatPlane(36, 86, uturnLoopMat, 0);
      uturnPad.position.set(CORRIDOR_CONFIG.SPINE_X, 0.022, CORRIDOR_CONFIG.UTTARA_UTURN_Z - 14);
      g.add(uturnPad);
      const uttaraEndWall = new THREE.Mesh(new THREE.BoxGeometry(38, 1.1, 1.2), chevronRedMat);
      uttaraEndWall.position.set(CORRIDOR_CONFIG.SPINE_X, 0.55, CORRIDOR_CONFIG.UTTARA_UTURN_Z - 58);
      g.add(uttaraEndWall);

      const tong = buildTongStall(textures, 2);
      tong.position.set(CORRIDOR_CONFIG.SPINE_X + 13.5, 0.08, -1350);
      g.add(tong);

      // Chunk spans from the Tejgaon gantries down to the far Uttara U-Turn end.
      const spineLandmarkCenterZ = (-1048 + (CORRIDOR_CONFIG.UTTARA_UTURN_Z - 58)) / 2;
      const spineLandmarkHalf = Math.abs(-1048 - (CORRIDOR_CONFIG.UTTARA_UTURN_Z - 58)) / 2 + 60;
      registerChunk('spine_gantries_uturn', CORRIDOR_CONFIG.SPINE_X, spineLandmarkCenterZ, spineLandmarkHalf, g);
    }

    // Mohakhali Bus Terminal scene (east side of spine, z ~ -1670): terminal
    // building, big billboard sign, canopy, and parked player buses (Nitol/BRTC/Hanif).
    {
      const g = new THREE.Group();
      const termZ = CORRIDOR_CONFIG.MOHAKHALI_BUS_TERMINAL_Z; // -1670
      const termX = CORRIDOR_CONFIG.SPINE_X + 30; // east of the spine roadway

      // Terminal main building (wide, low-rise with glass frontage)
      const termBody = new THREE.Mesh(
        new THREE.BoxGeometry(30, 8.5, 40),
        new THREE.MeshStandardMaterial({
          map: textures.buildingFacades[2 % textures.buildingFacades.length],
          roughness: 0.7,
          metalness: 0.05,
        })
      );
      termBody.position.set(termX + 6, 4.25, termZ);
      termBody.castShadow = true;
      termBody.receiveShadow = true;
      g.add(termBody);

      // Flat roof parapet
      const termRoof = new THREE.Mesh(
        new THREE.BoxGeometry(31, 0.6, 41),
        new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.8 })
      );
      termRoof.position.set(termX + 6, 8.8, termZ);
      g.add(termRoof);

      // Big terminal billboard facing the road (west-facing)
      const billboard = buildTejgaonTurnBillboard(textures.mohakhaliBusTerminal);
      billboard.rotation.y = -Math.PI / 2; // face toward the roadway (−X)
      billboard.position.set(CORRIDOR_CONFIG.SPINE_X + 13.2, 0, termZ + 24);
      g.add(billboard);

      // Boarding canopy over the bus bays (between building and road)
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(12, 0.5, 38),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4, metalness: 0.3 })
      );
      canopy.position.set(CORRIDOR_CONFIG.SPINE_X + 15.5, 5.2, termZ);
      canopy.castShadow = true;
      g.add(canopy);
      const canopyPoleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.35 });
      for (const pz of [-16, 0, 16]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 8), canopyPoleMat);
        pole.position.set(CORRIDOR_CONFIG.SPINE_X + 11.2, 2.6, termZ + pz);
        pole.castShadow = true;
        g.add(pole);
      }

      // Parked player buses in the bays (Nitol, BRTC, Hanif), angled nose-in
      const parkedBuses: Array<{ kind: Parameters<typeof buildTrafficVehicle>[0]; dz: number }> = [
        { kind: 'bus_nitol', dz: -13 },
        { kind: 'bus_brtc', dz: 1 },
        { kind: 'bus_hanif', dz: 15 },
      ];
      for (const pb of parkedBuses) {
        const bus = buildTrafficVehicle(pb.kind, textures, 0);
        bus.group.rotation.y = -Math.PI / 2; // nose toward the road (−X)
        bus.group.position.set(CORRIDOR_CONFIG.SPINE_X + 17.5, 0, termZ + pb.dz);
        g.add(bus.group);
      }

      registerChunk('mohakhali_bus_terminal', termX, termZ, 70, g);
    }

    // Mohakhali Small Drivable Flyover (z = -1780 .. -2020, peak 4.8m)
    {
      const g = buildStraightFlyoverMesh(
        CORRIDOR_CONFIG.SPINE_X,
        CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_START_Z,
        75,
        CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_END_Z,
        CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_PEAK_Y,
        4.9,
        plainAsphaltMat,
        concreteMat,
        railMat,
        'sky',
        textures.flyoverFunnyBanners[0]
      );
      // Widened ground apron where the flyover begins: the road opens up and the
      // straight ground route spreads to the sides (no perpendicular road under the
      // elevated deck — that read as "road under the flyover").
      const startApron = makeFlatPlane(36, 30, plainAsphaltMat);
      startApron.position.set(CORRIDOR_CONFIG.SPINE_X, 0.014, CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_START_Z + 6);
      g.add(startApron);
      // End apron: the shifted ground road merges back to the centered road here.
      const endApron = makeFlatPlane(36, 30, plainAsphaltMat);
      endApron.position.set(CORRIDOR_CONFIG.SPINE_X, 0.014, CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_END_Z - 6);
      g.add(endApron);
      registerChunk('mohakhali_flyover', CORRIDOR_CONFIG.SPINE_X, -1900, 180, g);
    }

    // Banani Drivable Flyover (z = -2420 .. -2680, peak 5.2m)
    {
      const g = buildStraightFlyoverMesh(
        CORRIDOR_CONFIG.SPINE_X,
        CORRIDOR_CONFIG.BANANI_FLYOVER_START_Z,
        80,
        CORRIDOR_CONFIG.BANANI_FLYOVER_END_Z,
        CORRIDOR_CONFIG.BANANI_FLYOVER_PEAK_Y,
        4.9,
        plainAsphaltMat,
        concreteMat,
        railMat,
        'gold',
        textures.flyoverFunnyBanners[2]
      );
      const startApron = makeFlatPlane(36, 30, plainAsphaltMat);
      startApron.position.set(CORRIDOR_CONFIG.SPINE_X, 0.014, CORRIDOR_CONFIG.BANANI_FLYOVER_START_Z + 6);
      g.add(startApron);
      // End apron: the shifted ground road merges back to the centered road here.
      const endApron = makeFlatPlane(36, 30, plainAsphaltMat);
      endApron.position.set(CORRIDOR_CONFIG.SPINE_X, 0.014, CORRIDOR_CONFIG.BANANI_FLYOVER_END_Z - 6);
      g.add(endApron);
      registerChunk('banani_flyover', CORRIDOR_CONFIG.SPINE_X, -2550, 190, g);
    }

    // Kuril Interchange Double-Decker Drivable Flyovers (Upper 10.6m Eastbound over Lower 5.2m Westbound)
    {
      const g = new THREE.Group();
      const flyoverSlipArrowMat = new THREE.MeshBasicMaterial({ map: textures.flyoverSlipArrow });

      // Wide ground Slip-Approach & Merge Plaza (x=129.6..175, z=-2685..-2765) so Spine <-> Flyover is seamless
      const slipPlaza = makeFlatPlane(45.4, 80, plainAsphaltMat);
      slipPlaza.position.set(152.3, 0.015, -2725);
      g.add(slipPlaza);

      // Painted pavement entry guidance arrow ("৩০০ ফিট ফ্লাইওভার ↗") leading onto Upper Eastbound ramp (x=155, z=-2735)
      const slipArrow = makeFlatPlane(8.6, 8.6, flyoverSlipArrowMat);
      slipArrow.position.set(151.5, 0.022, -2718);
      g.add(slipArrow);

      // --- Slip-plaza beautification (visual only, outside the drivable rect) ---
      const edgeLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      const guideArrowMat = new THREE.MeshBasicMaterial({ map: textures.flyoverSlipArrow });

      // Crisp white edge lines framing both sides of the slip approach (flat, no collision).
      for (const ex of [131.0, 173.6]) {
        const edge = makeFlatPlane(0.5, 78, edgeLineMat);
        edge.position.set(ex, 0.02, -2725);
        g.add(edge);
      }
      // Dashed center guide line up the slip approach toward the ramp.
      for (let gz = -2688; gz >= -2760; gz -= 12) {
        const dash = makeFlatPlane(0.4, 6, edgeLineMat);
        dash.position.set(152.3, 0.02, gz);
        g.add(dash);
      }
      // Extra painted guidance arrows steering the rider right onto the ramp.
      for (const az of [-2700, -2740, -2778]) {
        const arrow = makeFlatPlane(7.2, 7.2, guideArrowMat);
        arrow.position.set(157.5, 0.022, az);
        g.add(arrow);
      }

      // Landscaped palms + glowing lamps along the outer (non-drivable) corners so the
      // junction feels like a proper Dhaka flyover approach, not a bare asphalt patch.
      for (const [px, pz, s] of [
        [126.5, -2688, 1.0],
        [126.5, -2762, 1.05],
        [178.5, -2688, 1.0],
        [178.5, -2762, 1.05],
      ] as [number, number, number][]) {
        const palm = makePalm(s);
        palm.position.set(px, 0.05, pz);
        g.add(palm);
      }
      for (const [lx, lz] of [
        [128.5, -2706],
        [128.5, -2744],
        [176.0, -2706],
        [176.0, -2744],
      ] as [number, number][]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 7), lampPoleMat);
        pole.position.set(lx, 3.2, lz);
        pole.castShadow = true;
        g.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 3.6), lampPoleMat);
        arm.position.set(lx, 6.3, lz + (lz < -2725 ? 1.6 : -1.6));
        g.add(arm);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.7), bulbMat);
        bulb.position.set(lx, 6.2, lz + (lz < -2725 ? 3.2 : -3.2));
        g.add(bulb);
      }

      // Overhead direction gantry at the slip-plaza entrance (faces the oncoming rider
      // from the spine) announcing the 300ft flyover climb.
      const slipGantry = buildHighwayDirectionGantry(textures.corridorGantries.expressway300ft);
      slipGantry.position.set(152.3, 0, -2690);
      g.add(slipGantry);

      // High-resolution Upper Eastbound Skyway (10.6m peak, x=155.0, z=-2735 -> Arc R=85.5 -> z=-2930.5, x=425.5)
      const ebPoints: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i <= 20; i++) {
        const z = -2735.0 - (i / 20) * 110.0;
        ebPoints.push({ x: 155.0, y: 10.6 * smoothstep01((-2735.0 - z) / 110.0), z });
      }
      for (let i = 1; i <= 30; i++) {
        const a = Math.PI - (i / 30) * (Math.PI / 2);
        ebPoints.push({ x: 240.5 + 85.5 * Math.cos(a), y: 10.6, z: -2845.0 - 85.5 * Math.sin(a) });
      }
      for (let i = 1; i <= 28; i++) {
        const x = 240.5 + (i / 28) * 185.0;
        ebPoints.push({ x, y: 10.6 * smoothstep01((425.5 - x) / 185.0), z: -2930.5 });
      }
      g.add(
        buildCurvedRampStrip(ebPoints, 8.2, plainAsphaltMat, concreteMat, railMat, medianMat, {
          lampTheme: 'gold',
          banners: [
            { segIdx: 15, tex: textures.flyoverFunnyBanners[1], accentColor: 0x38bdf8 },
            { segIdx: 42, tex: textures.flyoverFunnyBanners[3], accentColor: 0xfacc15 },
          ],
        })
      );

      // High-resolution Lower Westbound Return Flyover (5.2m peak, z=-2909.5, x=395 -> Arc R=61.5 -> x=168.5, z=-2725)
      const wbPoints: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i <= 22; i++) {
        const x = 395.0 - (i / 22) * 165.0;
        wbPoints.push({ x, y: 5.2 * smoothstep01((395.0 - x) / 165.0), z: -2909.5 });
      }
      for (let i = 1; i <= 28; i++) {
        const a = -Math.PI / 2 - (i / 28) * (Math.PI / 2);
        wbPoints.push({ x: 230.0 + 61.5 * Math.cos(a), y: 5.2, z: -2848.0 + 61.5 * Math.sin(a) });
      }
      for (let i = 1; i <= 20; i++) {
        const z = -2848.0 + (i / 20) * 123.0;
        wbPoints.push({ x: 168.5, y: 5.2 * smoothstep01((-2725.0 - z) / 123.0), z });
      }
      g.add(
        buildCurvedRampStrip(wbPoints, 8.2, plainAsphaltMat, concreteMat, railMat, medianMat, {
          lampTheme: 'sky',
          banners: [
            { segIdx: 16, tex: textures.flyoverFunnyBanners[5], accentColor: 0x38bdf8 },
            { segIdx: 42, tex: textures.flyoverFunnyBanners[4], accentColor: 0xf59e0b },
          ],
        })
      );

      // Ground junction cap at Kuril (z=-2920)
      const kurilGround = makeFlatPlane(92, 46, plainAsphaltMat);
      kurilGround.position.set(175, 0.014, CORRIDOR_CONFIG.KURIL_SPLIT_Z);
      g.add(kurilGround);

      registerChunk('kuril_flyover', 275, -2835, 300, g);
    }
  }

  // =========================================================================
  // 4. 300 FEET / PURBACHAL 6-LANE EXPRESSWAY (z = -2920, x = 180 .. 2240)
  // =========================================================================
  const canalCutouts: [number, number][] = [
    [776, 820],   // Mid-300ft canal crossing bridge
    [1354, 1406], // Neela Market canal crossing bridge
    [CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 70, CORRIDOR_CONFIG.PURBACHAL_UTURN_X + 130], // Purbachal End U-Turn Loop Plaza
  ];
  const subtractCutouts = (a: number, b: number): [number, number][] => {
    let spans: [number, number][] = [[a, b]];
    for (const [ca, cb] of canalCutouts) {
      const next: [number, number][] = [];
      for (const [sa, sb] of spans) {
        if (cb <= sa || ca >= sb) {
          next.push([sa, sb]);
        } else {
          if (sa < ca) next.push([sa, ca]);
          if (cb < sb) next.push([cb, sb]);
        }
      }
      spans = next;
    }
    return spans;
  };

  const segLenX = 120;
  for (let xStart = 180; xStart < CORRIDOR_CONFIG.EXPRESSWAY_MAX_X - 20; xStart += segLenX) {
    const segEnd = Math.min(xStart + segLenX, CORRIDOR_CONFIG.EXPRESSWAY_MAX_X);
    const actualLen = segEnd - xStart;
    const cx = (xStart + segEnd) * 0.5;
    const g = new THREE.Group();
    g.position.set(cx, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z);

    // Keep-Left: 3 Eastbound Outbound Lanes on North side (z_local = -17.5 .. -4.5 -> center -11)
    const eastRoad = makeFlatPlane(13, actualLen, expressMat, -Math.PI / 2);
    eastRoad.position.set(0, 0.01, -11);
    g.add(eastRoad);

    // Keep-Left: 3 Westbound Return Lanes on South side (z_local = +4.5 .. +17.5 -> center +11)
    const westRoad = makeFlatPlane(13, actualLen, expressMat, Math.PI / 2);
    westRoad.position.set(0, 0.01, 11);
    g.add(westRoad);

    // Outer landscaped service curbs
    for (const sz of [-19.5, 19.5]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(actualLen, 0.14, 4.0), sidewalkMat);
      curb.position.set(0, 0.05, sz);
      g.add(curb);
    }

    // Build Canal, Grass Banks, Guardrails, Lamps & Palms strictly on non-bridge sub-spans
    const canalSpans = subtractCutouts(xStart, segEnd);
    for (const [sa, sb] of canalSpans) {
      const spanLen = sb - sa;
      if (spanLen < 2) continue;
      const localCx = (sa + sb) * 0.5 - cx;

      for (const bz of [-3.5, 3.5]) {
        const bank = new THREE.Mesh(new THREE.BoxGeometry(spanLen, 0.28, 2.0), grassMat);
        bank.position.set(localCx, 0.14, bz);
        bank.receiveShadow = true;
        g.add(bank);

        const rail = new THREE.Mesh(new THREE.BoxGeometry(spanLen, 0.45, 0.22), railMat);
        rail.position.set(localCx, 0.56, bz + Math.sign(bz) * 0.8);
        g.add(rail);
      }

      const canal = makeFlatPlane(5.0, spanLen, canalMat, -Math.PI / 2);
      canal.position.set(localCx, -0.06, 0);
      g.add(canal);

      for (let wx = sa + 18; wx <= sb - 12; wx += 32) {
        const lx = wx - cx;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7.2, 7), lampPoleMat);
        pole.position.set(lx, 3.6, 3.4);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 5.2), lampPoleMat);
        arm.position.set(lx, 7.1, 3.4);
        const bulbA = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.7), bulbMat);
        bulbA.position.set(lx, 7.0, 5.8);
        const bulbB = bulbA.clone();
        bulbB.position.z = 1.0;
        g.add(pole, arm, bulbA, bulbB);

        const palm = makePalm(1.05);
        palm.position.set(lx + 10, 0.25, -3.4);
        g.add(palm);
      }
    }

    // Explicit Canal Crossing Bridges (x=798 & Neela Market x=1380) & Purbachal U-Turn Loop (x=2170)
    if (xStart <= 798 && segEnd >= 798) {
      const bridge = makeFlatPlane(44, 42, bridgeCrossMat);
      bridge.position.set(798 - cx, 0.024, 0);
      g.add(bridge);
    }
    if (xStart <= 1380 && segEnd >= 1380) {
      const bridge = makeFlatPlane(52, 42, bridgeCrossMat);
      bridge.position.set(1380 - cx, 0.024, 0);
      g.add(bridge);
    }
    if (xStart >= CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 70) {
      // Sweeping Purbachal U-Turn Loop Road (eastbound bottom -> loops around the U-Turn -> westbound top)
      const uLoop = makeFlatPlane(44, 134, uturnLoopMat, -Math.PI / 2);
      uLoop.position.set(CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 2 - cx, 0.024, 0);
      g.add(uLoop);

      const endBarrier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 44), chevronRedMat);
      endBarrier.position.set(CORRIDOR_CONFIG.EXPRESSWAY_MAX_X - 2 - cx, 0.6, 0);
      g.add(endBarrier);
    }

    registerChunk(`exp300_${xStart}`, cx, CORRIDOR_CONFIG.EXPRESSWAY_Z, 120, g);
  }

  // 300 Feet Landmarks: Welcome Gantry, Pumps, Neela Market, Showroom, Bikers Rest Room & Purbachal U-Turn
  {
    const g = new THREE.Group();

    const gantry300 = buildHighwayDirectionGantry(textures.corridorGantries.expressway300ft);
    gantry300.rotation.y = -Math.PI / 2;
    gantry300.position.set(520, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z - 11);
    g.add(gantry300);

    // Balu River Bridge Gantry Arch at x = 798
    const baluArch = buildUTurnSignArch(textures.baluBridgeSign, 44);
    baluArch.rotation.y = -Math.PI / 2;
    baluArch.position.set(798, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z);
    g.add(baluArch);

    // 300ft Entry Fuel & CNG Filling Station near Bashundhara Gate (Eastbound South side, x = 480)
    const entryPump = buildFuelStation(textures, true);
    entryPump.rotation.y = Math.PI / 2;
    entryPump.position.set(480, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z + 22.5);
    g.add(entryPump);
    fuelStations.push({
      id: 'exp300_entry_fuel',
      label: '৩০০ ফিট বসুন্ধরা সিএনজি ও ফুয়েল স্টেশন',
      padMinX: 480 - GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
      padMaxX: 480 + GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
      padMinZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 14.5,
      padMaxZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 23.0,
      nozzleX: 480,
      nozzleY: 1.45,
      nozzleZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 22.5,
    });

    // 300ft South Fuel Station (Eastbound, x=920)
    const southPump = buildFuelStation(textures, true);
    southPump.rotation.y = Math.PI / 2;
    southPump.position.set(CORRIDOR_CONFIG.EXPRESSWAY_SOUTH_PUMP_X, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z + 22.5);
    g.add(southPump);
    fuelStations.push({
      id: 'exp300_south_pump',
      label: '৩০০ ফিট পূর্বাচল পাম্প (পূর্ব)',
      padMinX: CORRIDOR_CONFIG.EXPRESSWAY_SOUTH_PUMP_X - GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
      padMaxX: CORRIDOR_CONFIG.EXPRESSWAY_SOUTH_PUMP_X + GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
      padMinZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 14.5,
      padMaxZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 23.0,
      nozzleX: CORRIDOR_CONFIG.EXPRESSWAY_SOUTH_PUMP_X,
      nozzleY: 1.45,
      nozzleZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 22.5,
    });

    // 300ft North Fuel Station (Westbound return, x=1750)
    const northPump = buildFuelStation(textures, false);
    northPump.rotation.y = Math.PI / 2;
    northPump.position.set(CORRIDOR_CONFIG.EXPRESSWAY_NORTH_PUMP_X, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z - 22.5);
    g.add(northPump);
    fuelStations.push({
      id: 'exp300_north_pump',
      label: '৩০০ ফিট পূর্বাচল পাম্প (পশ্চিম)',
      padMinX: CORRIDOR_CONFIG.EXPRESSWAY_NORTH_PUMP_X - GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
      padMaxX: CORRIDOR_CONFIG.EXPRESSWAY_NORTH_PUMP_X + GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
      padMinZ: CORRIDOR_CONFIG.EXPRESSWAY_Z - 23.0,
      padMaxZ: CORRIDOR_CONFIG.EXPRESSWAY_Z - 14.5,
      nozzleX: CORRIDOR_CONFIG.EXPRESSWAY_NORTH_PUMP_X,
      nozzleY: 1.45,
      nozzleZ: CORRIDOR_CONFIG.EXPRESSWAY_Z - 22.5,
    });

    // Authentic Real-World 300 Feet Highway Billboards (alternating North & South sides, clear of road)
    const billboardSpots: { x: number; side: -1 | 1; yaw: number; texIdx: number }[] = [
      { x: 430, side: 1, yaw: -Math.PI * 0.72, texIdx: 0 },   // Bashundhara R/A & Sports City
      { x: 740, side: -1, yaw: -Math.PI * 0.28, texIdx: 1 },  // Balu River Bridge / July 36 Expressway
      { x: 1080, side: 1, yaw: -Math.PI * 0.72, texIdx: 2 },  // Jolshiri Abashon & Lakeview
      { x: 1285, side: -1, yaw: -Math.PI * 0.28, texIdx: 3 }, // Neela Market Duck Meat & Chitoi Pitha
      { x: 1660, side: -1, yaw: -Math.PI * 0.28, texIdx: 4 }, // Blue Lake & Nijhum Polli Resort
      { x: 1980, side: 1, yaw: -Math.PI * 0.72, texIdx: 5 },  // Hero Karizma XMR 210 300ft Zone
    ];
    for (const bb of billboardSpots) {
      const board = buildExpresswayBillboard(textures.expresswayBillboards[bb.texIdx]);
      board.position.set(bb.x, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z + bb.side * 27.5);
      board.rotation.y = bb.yaw;
      g.add(board);
    }

    // Sparse Modern Township Towers & Famous 300ft Restaurants/Resorts ("some buildings, not so much")
    const sparseStructures: {
      id: string;
      x: number;
      side: -1 | 1;
      offsetZ: number;
      w: number;
      h: number;
      d: number;
      facadeIdx: number;
      signTex: THREE.CanvasTexture;
      isResort: boolean;
    }[] = [
      {
        id: 'rickshaw_cafe_spot',
        x: 640,
        side: 1,
        offsetZ: 31,
        w: 14,
        h: 7.5,
        d: 10,
        facadeIdx: 1,
        signTex: textures.restaurantSigns[0],
        isResort: true,
      },
      {
        id: 'jolshiri_tower',
        x: 1040,
        side: -1,
        offsetZ: -44,
        w: 16,
        h: 28,
        d: 14,
        facadeIdx: 2,
        signTex: textures.expresswayBillboards[2],
        isResort: false,
      },
      {
        id: 'expo_pavilion',
        x: 1560,
        side: -1,
        offsetZ: -44,
        w: 20,
        h: 22,
        d: 14,
        facadeIdx: 3 % textures.buildingFacades.length,
        signTex: textures.expresswayBillboards[4],
        isResort: false,
      },
      {
        id: 'nijhum_polli_resort',
        x: 1875,
        side: 1,
        offsetZ: 32,
        w: 16,
        h: 8.5,
        d: 11,
        facadeIdx: 1,
        signTex: textures.restaurantSigns[1],
        isResort: true,
      },
    ];
    for (const s of sparseStructures) {
      const bld = buildExpresswayBuilding(
        s.w,
        s.h,
        s.d,
        textures.buildingFacades[s.facadeIdx % textures.buildingFacades.length],
        s.signTex,
        s.isResort
      );
      const wz = CORRIDOR_CONFIG.EXPRESSWAY_Z + s.offsetZ;
      bld.position.set(s.x, 0, wz);
      bld.rotation.y = s.side === -1 ? 0 : Math.PI;
      g.add(bld);
      solidBuildings.push({
        id: `Bld_300ft_${s.id}`,
        minX: s.x - s.w * 0.5,
        maxX: s.x + s.w * 0.5,
        minZ: wz - s.d * 0.5,
        maxZ: wz + s.d * 0.5,
      });
    }

    // Famous 300ft Duck Meat ("হাঁসের মাংস") Roadside Stalls (Amanullah area & Purbachal Lake)
    for (const [idx, dx] of [1246, 1266, 1825].entries()) {
      const duckStall = buildDuckMeatStall(textures, idx);
      duckStall.position.set(dx, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z - 24.5);
      g.add(duckStall);
    }

    registerChunk('exp300_landmarks_outer', 1350, CORRIDOR_CONFIG.EXPRESSWAY_Z, 1020, g);
  }

  // Far 300ft Fuel Stations on BOTH sides along the long eastern stretch
  // (x ~ 2200 .. 5100) so riders never run low on fuel before the Purbachal U-Turn.
  {
    const g = new THREE.Group();
    // Dense alternating south (+Z, eastbound) & north (-Z, westbound) side pumps —
    // plenty of fuel stations on BOTH sides across the whole Purbachal highway.
    const farPumps: { x: number; side: -1 | 1; labelBn: string }[] = [
      { x: 2240, side: 1, labelBn: '৩০০ ফিট পূর্বাচল পাম্প (পূর্ব ২)' },
      { x: 2420, side: -1, labelBn: '৩০০ ফিট পূর্বাচল পাম্প (পশ্চিম ২)' },
      { x: 2620, side: 1, labelBn: '৩০০ ফিট বাইকায়ার ফুয়েল (পূর্ব ৩)' },
      { x: 2820, side: -1, labelBn: '৩০০ ফিট বাইকায়ার ফুয়েল (পশ্চিম ৩)' },
      { x: 3020, side: 1, labelBn: '৩০০ ফিট পূর্বাচল পাম্প (পূর্ব ৪)' },
      { x: 3220, side: -1, labelBn: '৩০০ ফিট পূর্বাচল পাম্প (পশ্চিম ৪)' },
      { x: 3420, side: 1, labelBn: '৩০০ ফিট বাইকায়ার ফুয়েল (পূর্ব ৫)' },
      { x: 3620, side: -1, labelBn: '৩০০ ফিট বাইকায়ার ফুয়েল (পশ্চিম ৫)' },
      { x: 3820, side: 1, labelBn: '৩০০ ফিট পূর্বাচল পাম্প (পূর্ব ৬)' },
      { x: 4020, side: -1, labelBn: '৩০০ ফিট পূর্বাচল পাম্প (পশ্চিম ৬)' },
      { x: 4220, side: 1, labelBn: '৩০০ ফিট বাইকায়ার ফুয়েল (পূর্ব ৭)' },
      { x: 4420, side: -1, labelBn: '৩০০ ফিট বাইকায়ার ফুয়েল (পশ্চিম ৭)' },
      { x: 4620, side: 1, labelBn: '৩০০ ফিট শেষ প্রান্ত পাম্প (পূর্ব ৮)' },
      { x: 4820, side: -1, labelBn: '৩০০ ফিট শেষ প্রান্ত পাম্প (পশ্চিম ৮)' },
      { x: 5020, side: 1, labelBn: '৩০০ ফিট শেষ প্রান্ত পাম্প (পূর্ব ৯)' },
    ];
    for (const fp of farPumps) {
      const pump = buildFuelStation(textures, fp.side === 1);
      pump.rotation.y = Math.PI / 2;
      const pz = CORRIDOR_CONFIG.EXPRESSWAY_Z + fp.side * 22.5;
      pump.position.set(fp.x, 0, pz);
      g.add(pump);
      fuelStations.push({
        id: `exp300_far_fuel_${fp.x}`,
        label: fp.labelBn,
        padMinX: fp.x - GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
        padMaxX: fp.x + GAME_CONFIG.FUEL_PAD_HALF_LENGTH,
        padMinZ: fp.side === 1 ? CORRIDOR_CONFIG.EXPRESSWAY_Z + 14.5 : CORRIDOR_CONFIG.EXPRESSWAY_Z - 23.0,
        padMaxZ: fp.side === 1 ? CORRIDOR_CONFIG.EXPRESSWAY_Z + 23.0 : CORRIDOR_CONFIG.EXPRESSWAY_Z - 14.5,
        nozzleX: fp.x,
        nozzleY: 1.45,
        nozzleZ: pz,
      });
    }
    registerChunk('exp300_far_fuel', 3630, CORRIDOR_CONFIG.EXPRESSWAY_Z, 1600, g);
  }

  // Funny flyover banner arches + extra billboards along the long eastern 300ft
  // stretch so the empty highway feels lively and fun all the way to Purbachal.
  {
    const g = new THREE.Group();
    // Overhead funny banner arches spanning the full 6-lane expressway.
    const funnyArches: { x: number; texIdx: number; accent: number }[] = [
      { x: 2360, texIdx: 0, accent: 0xfacc15 },
      { x: 2900, texIdx: 2, accent: 0xf472b6 },
      { x: 3480, texIdx: 4, accent: 0x38bdf8 },
      { x: 4020, texIdx: 1, accent: 0x7dd3fc },
      { x: 4560, texIdx: 5, accent: 0xfbbf24 },
      { x: 4960, texIdx: 3, accent: 0x34d399 },
    ];
    for (const fa of funnyArches) {
      const arch = buildFlyoverBannerArch(
        textures.flyoverFunnyBanners[fa.texIdx % textures.flyoverFunnyBanners.length],
        40,
        5.2,
        fa.accent
      );
      arch.rotation.y = -Math.PI / 2;
      arch.position.set(fa.x, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z);
      g.add(arch);
    }

    // Extra roadside billboards (alternating sides) reusing the 6 billboard designs.
    const extraBillboards: { x: number; side: -1 | 1; texIdx: number }[] = [
      { x: 2300, side: 1, texIdx: 4 },
      { x: 2620, side: -1, texIdx: 5 },
      { x: 3180, side: 1, texIdx: 0 },
      { x: 3720, side: -1, texIdx: 2 },
      { x: 4260, side: 1, texIdx: 3 },
      { x: 4780, side: -1, texIdx: 1 },
      { x: 5060, side: 1, texIdx: 5 },
    ];
    for (const bb of extraBillboards) {
      const board = buildExpresswayBillboard(
        textures.expresswayBillboards[bb.texIdx % textures.expresswayBillboards.length]
      );
      board.position.set(bb.x, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z + bb.side * 27.5);
      board.rotation.y = bb.side === 1 ? -Math.PI * 0.72 : -Math.PI * 0.28;
      g.add(board);
    }

    registerChunk('exp300_far_banners_billboards', 3660, CORRIDOR_CONFIG.EXPRESSWAY_Z, 1450, g);
  }

  // Purbachal far-end U-Turn Arch (its own chunk so it stays visible at the long
  // expressway's far end regardless of the outer-landmarks chunk culling).
  {
    const g = new THREE.Group();
    const purbachalU = buildUTurnSignArch(textures.uturnSigns.purbachal, 34);
    purbachalU.rotation.y = -Math.PI / 2;
    purbachalU.position.set(CORRIDOR_CONFIG.PURBACHAL_UTURN_X, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z);
    g.add(purbachalU);
    registerChunk('purbachal_uturn_arch', CORRIDOR_CONFIG.PURBACHAL_UTURN_X, CORRIDOR_CONFIG.EXPRESSWAY_Z, 120, g);
  }

  // Bashundhara Residential Area: a dedicated chunk centred on the township itself,
  // so the whole city culls in together as the rider approaches the 300ft entry gate.
  {
    const township = buildBashundharaTownship(textures);
    solidBuildings.push(...township.solidBuildings);
    registerChunk('bashundhara_residential_area', 505, CORRIDOR_CONFIG.EXPRESSWAY_Z, 260, township.group);
  }

  // Neela Market Hub Chunk: Market Stalls + Signature Duck Meat Stalls + Hero Motors Showroom + Bikers Rest Room
  {
    const g = new THREE.Group();
    const market = buildNeelaMarketStalls(textures);
    market.position.set(CORRIDOR_CONFIG.NEELA_MARKET_X, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z - 21);
    g.add(market);

    for (const [idx, dx] of [CORRIDOR_CONFIG.NEELA_MARKET_X - 38, CORRIDOR_CONFIG.NEELA_MARKET_X + 38].entries()) {
      const duckHub = buildDuckMeatStall(textures, idx + 1);
      duckHub.position.set(dx, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z - 24.5);
      g.add(duckHub);
    }

    // Extra cluster of famous Neela Market duck-meat ("হাঁসের মাংস") stalls on
    // BOTH sides of the 300ft road so the whole market stretch feels alive.
    const neelaDuckStalls: { dx: number; side: -1 | 1; variant: number }[] = [
      { dx: -92, side: -1, variant: 2 },
      { dx: -64, side: -1, variant: 0 },
      { dx: 64, side: -1, variant: 1 },
      { dx: 96, side: -1, variant: 2 },
      { dx: -80, side: 1, variant: 1 },
      { dx: -46, side: 1, variant: 2 },
      { dx: 52, side: 1, variant: 0 },
      { dx: 88, side: 1, variant: 1 },
    ];
    for (const ds of neelaDuckStalls) {
      const stall = buildDuckMeatStall(textures, ds.variant);
      stall.position.set(
        CORRIDOR_CONFIG.NEELA_MARKET_X + ds.dx,
        0,
        CORRIDOR_CONFIG.EXPRESSWAY_Z + ds.side * 24.5
      );
      if (ds.side === 1) stall.rotation.y = Math.PI;
      g.add(stall);
    }

    // Neela Market Hero Motors Showroom (South side at x = 1340)
    const srBuilt = buildNiloyHeroShowroom(textures, false);
    srBuilt.group.rotation.y = -Math.PI / 2;
    srBuilt.group.position.set(CORRIDOR_CONFIG.NEELA_SHOWROOM_X, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z + 22.5);
    g.add(srBuilt.group);
    displayBikes.push(...srBuilt.displayBikes);
    for (const st of srBuilt.attendants) {
      staff.push({
        rig: st.rig,
        worldX: CORRIDOR_CONFIG.NEELA_SHOWROOM_X + st.localZ,
        baseZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 22.5 - st.localX,
        baseYaw: st.baseYaw - Math.PI / 2,
        idx: staff.length,
      });
    }
    showrooms.push({
      id: 'neela_market_showroom',
      labelBn: 'নীলা মার্কেট হিরো শোরুম (৩০০ ফিট)',
      padMinX: CORRIDOR_CONFIG.NEELA_SHOWROOM_X - GAME_CONFIG.SHOWROOM_PAD_HALF_LENGTH,
      padMaxX: CORRIDOR_CONFIG.NEELA_SHOWROOM_X + GAME_CONFIG.SHOWROOM_PAD_HALF_LENGTH,
      padMinZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 14.5,
      padMaxZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 23.0,
    });
    solidBuildings.push({
      id: 'Bld_neela_showroom',
      minX: CORRIDOR_CONFIG.NEELA_SHOWROOM_X - 9.5,
      maxX: CORRIDOR_CONFIG.NEELA_SHOWROOM_X + 9.5,
      minZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 25.5,
      maxZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 35.5,
    });

    // Bikers Rest Room at Neela Market (South side at x = 1420)
    const restRoom = buildBikersRestRoom(textures);
    restRoom.rotation.y = Math.PI; // Faces road (-Z relative to south side)
    restRoom.position.set(CORRIDOR_CONFIG.NEELA_RESTROOM_X, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z + 23.5);
    g.add(restRoom);
    restRooms.push({
      id: 'neela_bikers_restroom',
      labelBn: 'বাইকারস রেস্ট রুম • নীলা মার্কেট',
      minX: CORRIDOR_CONFIG.NEELA_RESTROOM_X - 8.5,
      maxX: CORRIDOR_CONFIG.NEELA_RESTROOM_X + 8.5,
      minZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 14.5,
      maxZ: CORRIDOR_CONFIG.EXPRESSWAY_Z + 22.8,
    });

    registerChunk('neela_market_hub', CORRIDOR_CONFIG.NEELA_MARKET_X, CORRIDOR_CONFIG.EXPRESSWAY_Z, 180, g);
  }

  // Signalized Intersection at Tejgaon Spine Entry (z = -1120) & Banani Cross (z = -2240)
  for (const iz of [-1120, -2240]) {
    const g = new THREE.Group();
    const nsRigSouth = buildTrafficLight();
    nsRigSouth.group.position.set(CORRIDOR_CONFIG.SPINE_X - 10.5, 0, iz + 8);
    g.add(nsRigSouth.group);
    const nsRigNorth = buildTrafficLight();
    nsRigNorth.group.position.set(CORRIDOR_CONFIG.SPINE_X + 10.5, 0, iz - 8);
    nsRigNorth.group.rotation.y = Math.PI;
    g.add(nsRigNorth.group);

    intersections.push({
      baseX: CORRIDOR_CONFIG.SPINE_X,
      baseZ: iz,
      nsLightRigs: [nsRigSouth, nsRigNorth],
      ewLightRigs: [],
      nsPhase: 'GREEN',
      ewPhase: 'RED',
      cycleOffset: intersections.length * 3.5,
      violatedThisPass: false,
      bonusAwardedThisPass: false,
    });
    registerChunk(`spine_sig_${iz}`, CORRIDOR_CONFIG.SPINE_X, iz, 50, g);
  }

  // Signalized intersection BEFORE the 300ft flyover ramp (Kuril slip approach,
  // z = -2700). Northbound spine traffic — including KURIL_RAMP_TO_300FT cars that
  // climb the ramp — must stop at the red light and proceed on green. The existing
  // stop-line + 16s phase cycle handles every intersection automatically, so this
  // one behaves exactly like the Tejgaon/Banani signals. Elevated ramp cars (y>1.2)
    // are already past it and are unaffected.
  {
    const g = new THREE.Group();
    const rampSigSouth = buildTrafficLight();
    rampSigSouth.group.position.set(CORRIDOR_CONFIG.SPINE_X - 10.5, 0, -2700 + 8);
    g.add(rampSigSouth.group);
    const rampSigNorth = buildTrafficLight();
    rampSigNorth.group.position.set(CORRIDOR_CONFIG.SPINE_X + 10.5, 0, -2700 - 8);
    rampSigNorth.group.rotation.y = Math.PI;
    g.add(rampSigNorth.group);

    intersections.push({
      baseX: CORRIDOR_CONFIG.SPINE_X,
      baseZ: -2700,
      nsLightRigs: [rampSigSouth, rampSigNorth],
      ewLightRigs: [],
      nsPhase: 'GREEN',
      ewPhase: 'RED',
      cycleOffset: 1.5,
      violatedThisPass: false,
      bonusAwardedThisPass: false,
    });
    registerChunk('spine_sig_300ft_ramp', CORRIDOR_CONFIG.SPINE_X, -2700, 50, g);
  }

  return {
    root,
    chunks,
    fuelStations,
    showrooms,
    restRooms,
    solidBuildings,
    intersections,
    displayBikes,
    staff,
  };
}
