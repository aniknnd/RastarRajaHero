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

function evalRawHeightAt(x: number, z: number, prevY: number): { y: number; onFlyover: boolean; flyoverId?: FlyoverEval['id'] } {
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

  if (candidates.length > 0) {
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
      if (Math.abs(candidates[i].y - prevY) < Math.abs(best.y - prevY)) {
        best = candidates[i];
      }
    }
    // Unified height-proximity lock: attaches smoothly at ramp entry and stays locked to the matching deck
    // without snapping across Lower (5.2m), Upper (10.6m), or ground (0m).
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
  fwdZ = -1
): CorridorSurfaceSample {
  const cur = evalRawHeightAt(x, z, prevY);
  const ahead = evalRawHeightAt(x + fwdX * 0.85, z + fwdZ * 0.85, cur.y);
  const behind = evalRawHeightAt(x - fwdX * 0.85, z - fwdZ * 0.85, cur.y);
  const pitchRad = Math.atan2(ahead.y - behind.y, 1.7);

  return {
    groundY: cur.y,
    pitchRad: THREE.MathUtils.clamp(pitchRad, -0.32, 0.32),
    onFlyover: cur.onFlyover,
    corridor: cur.onFlyover && cur.flyoverId ? cur.flyoverId : getCorridorIdAt(x, z),
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
  // Metro Rail Extension Corridor (z: -1262 .. -718, Agargaon -> Tejgaon Turnoff)
  { minX: -12.6, maxX: 12.6, minZ: -1262, maxZ: -718 },
  // Metro End Wide U-Turn Turnaround Loop (z: -1262 .. -1198)
  { minX: -19.0, maxX: 19.0, minZ: -1262, maxZ: -1198 },
  // Tejgaon East Connector Link Road (z: -1131 .. -1109, x: 0 .. 150)
  { minX: 0, maxX: 150, minZ: -1131, maxZ: -1109 },
  // Tejgaon -> Mohakhali -> Banani -> Kuril -> Uttara North Highway Spine (includes west showroom/pump bays)
  { minX: 126.4, maxX: 152.0, minZ: -3736, maxZ: -1006 },
  // Tejgaon South U-Turn Turnaround Plaza
  { minX: 124, maxX: 156, minZ: -1062, maxZ: -1006 },
  // Uttara Wide U-Turn Turnaround Plaza
  { minX: 124, maxX: 156, minZ: -3736, maxZ: -3635 },
  // 300 Feet South Outbound Carriageway (Eastbound) + Service Edge
  { minX: 140, maxX: 2236, minZ: -2916.4, maxZ: -2896.5 },
  // 300 Feet North Inbound Carriageway (Westbound) + Service Edge
  { minX: 140, maxX: 2236, minZ: -2943.5, maxZ: -2923.6 },
  // Kuril Flyover Approach & Return Slip Plaza (z: -2765 .. -2685, x: 129.2 .. 175.0)
  { minX: 129.2, maxX: 175.0, minZ: -2765, maxZ: -2685 },
  // Kuril Ground Junction Plaza (connects Spine & 300ft)
  { minX: 129.2, maxX: 220, minZ: -2942, maxZ: -2898 },
  // Mid-Expressway Canal Crossing Bridge (x ~ 796)
  { minX: 778, maxX: 818, minZ: -2941, maxZ: -2899 },
  // Neela Market Canal Crossing Bridge (x ~ 1380)
  { minX: 1356, maxX: 1404, minZ: -2941, maxZ: -2899 },
  // Purbachal End U-Turn Loop Bridge (x: 2105 .. 2236)
  { minX: 2105, maxX: 2236, minZ: -2942, maxZ: -2898 },
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
  // 1. METRO EXTENSION (-720 to -1265): Agargaon Metro + Tejgaon Billboard + U-Turn
  // =========================================================================
  for (let b = 9; b < 16; b++) {
    const blockLen = 80;
    const baseZ = -(b * blockLen + blockLen / 2); // -760 .. -1240
    const g = new THREE.Group();
    g.position.set(0, 0, baseZ);

    const road = makeFlatPlane(GAME_CONFIG.ARTERY_HALF_WIDTH * 2, blockLen, roadMat);
    g.add(road);

    const isTurnoffBlock = b === 13 || b === 14; // z = -1120 lies at boundary of blocks 13 & 14
    for (const side of [-1, 1]) {
      // Leave east sidewalk open at Tejgaon turnoff (-1134..-1106) and open around Metro End U-Turn (b=15)
      if (b === 15) continue;
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

    // Metro End U-Turn Arch & Paved Turnaround Loop at b === 15 (z = -1200 .. -1265)
    if (b === 15) {
      const uArch = buildUTurnSignArch(textures.uturnSigns.metroEnd, 24);
      uArch.position.set(0, 0, 36); // world z = -1204
      g.add(uArch);

      const uLoop = makeFlatPlane(38, 62, uturnLoopMat, 0);
      uLoop.position.set(0, 0.022, 8); // world z = -1232 (covers -1201..-1263)
      g.add(uLoop);

      const endWall = new THREE.Mesh(new THREE.BoxGeometry(39, 1.1, 1.2), chevronRedMat);
      endWall.position.set(0, 0.55, -24); // world z = -1264
      g.add(endWall);
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
  for (let zStart = -1020; zStart > -3740; zStart -= spineBlockLen) {
    const baseZ = zStart - spineBlockLen / 2;
    const g = new THREE.Group();
    g.position.set(CORRIDOR_CONFIG.SPINE_X, 0, baseZ);

    const road = makeFlatPlane(CORRIDOR_CONFIG.SPINE_HALF_WIDTH * 2, spineBlockLen, roadMat);
    g.add(road);

    // Sidewalks flanking spine (open at Tejgaon connector z=-1120, Kuril slip/300ft z=-2660..-2980, & U-Turn loops)
    const openWest = Math.abs(baseZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 42;
    const openEast = baseZ <= -2660 && baseZ >= -2980;
    const isUTurnBlock = baseZ > -1070 || baseZ < -3650;
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
      baseZ < -3620 ||
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
      if (worldZ > -1068 || worldZ < -3640) continue;
      for (const side of [-1, 1]) {
        if (side === -1 && Math.abs(worldZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 32) continue;
        if (side === 1 && worldZ <= -2670 && worldZ >= -2980) continue;
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
      uttaraEndWall.position.set(CORRIDOR_CONFIG.SPINE_X, 0.55, -3738);
      g.add(uttaraEndWall);

      const tong = buildTongStall(textures, 2);
      tong.position.set(CORRIDOR_CONFIG.SPINE_X + 13.5, 0.08, -1350);
      g.add(tong);

      registerChunk('spine_gantries_uturn', CORRIDOR_CONFIG.SPINE_X, -2380, 1550, g);
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
      const underCross = makeFlatPlane(54, 14, plainAsphaltMat);
      underCross.position.set(CORRIDOR_CONFIG.SPINE_X, 0.014, -1900);
      g.add(underCross);
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
      const underCross = makeFlatPlane(54, 14, plainAsphaltMat);
      underCross.position.set(CORRIDOR_CONFIG.SPINE_X, 0.014, -2550);
      g.add(underCross);
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
    [2100, 2300], // Purbachal End U-Turn Loop Plaza
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
  for (let xStart = 180; xStart < 2220; xStart += segLenX) {
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
    if (xStart >= 2100) {
      // Sweeping Purbachal U-Turn Loop Road (eastbound bottom -> loops around x=2225 -> westbound top)
      const uLoop = makeFlatPlane(44, 134, uturnLoopMat, -Math.PI / 2);
      uLoop.position.set(2168 - cx, 0.024, 0);
      g.add(uLoop);

      const endBarrier = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 44), chevronRedMat);
      endBarrier.position.set(2238 - cx, 0.6, 0);
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
        id: 'bashundhara_tower',
        x: 390,
        side: -1,
        offsetZ: -44,
        w: 18,
        h: 34,
        d: 14,
        facadeIdx: 0,
        signTex: textures.expresswayBillboards[0],
        isResort: false,
      },
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

    // Purbachal U-Turn Arch at x=2170
    const purbachalU = buildUTurnSignArch(textures.uturnSigns.purbachal, 34);
    purbachalU.rotation.y = -Math.PI / 2;
    purbachalU.position.set(CORRIDOR_CONFIG.PURBACHAL_UTURN_X, 0, CORRIDOR_CONFIG.EXPRESSWAY_Z);
    g.add(purbachalU);

    registerChunk('exp300_landmarks_outer', 1350, CORRIDOR_CONFIG.EXPRESSWAY_Z, 1020, g);
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
