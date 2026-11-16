import * as THREE from 'three';
import {
  buildDhakaWelcomeArch,
  buildFuelStation,
  buildHighwayDirectionGantry,
  buildMetroRailViaductSegment,
  buildMetroStation,
  buildMetroTrain,
  buildTongStall,
  buildTrafficLight,
  type TrafficLightRig,
} from './models';
import type { ProceduralTextureSet } from './textures';
import { GAME_CONFIG, type TrafficLightPhase } from './types';

export interface WorldBlock {
  index: number;
  baseZ: number;
  group: THREE.Group;
}

export interface IntersectionNode {
  baseZ: number;
  nsLightRigs: TrafficLightRig[];
  ewLightRigs: TrafficLightRig[];
  nsPhase: TrafficLightPhase;
  ewPhase: TrafficLightPhase;
  cycleOffset: number;
  violatedThisPass: boolean;
  bonusAwardedThisPass: boolean;
}

export interface SolidBuildingBox {
  id: string;
  minX: number;
  maxX: number;
  baseMinZ: number;
  baseMaxZ: number;
}

export interface FuelStationNode {
  id: string;
  label: string;
  padMinX: number;
  padMaxX: number;
  baseZ: number;
  nozzleX: number;
  nozzleY: number;
  nozzleZ: number;
}

export interface CityLane {
  id: string;
  axis: 'NS' | 'EW';
  fixedCoord: number;
  dir: 1 | -1;
  minRange: number;
  maxRange: number;
  isSignalizedEw?: boolean;
}

export interface DhakaWorld {
  root: THREE.Group;
  groundPlane: THREE.Mesh;
  metroTrain: THREE.Group;
  blocks: WorldBlock[];
  intersections: IntersectionNode[];
  solidBuildings: SolidBuildingBox[];
  fuelStations: FuelStationNode[];
  cityLanes: CityLane[];
  updateAroundPlayer: (playerZ: number, elapsedSec: number) => void;
  isOnArterySidewalk: (x: number, z: number) => boolean;
}

export const GOLI_ALLEY_Z_POSITIONS: readonly number[] = [-80, -160, -320, -400, -480];

function wrapLoopDelta(targetZ: number, refZ: number): number {
  let d = targetZ - refZ;
  const half = GAME_CONFIG.LOOP_LENGTH / 2;
  while (d > half) d -= GAME_CONFIG.LOOP_LENGTH;
  while (d < -half) d += GAME_CONFIG.LOOP_LENGTH;
  return d;
}

function createRoadsideBuilding(
  width: number,
  height: number,
  depth: number,
  facadeTex: THREE.CanvasTexture,
  companySignTex: THREE.CanvasTexture,
  addRooftopBillboard: boolean,
  faceDirX: number
): THREE.Group {
  const b = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.72, metalness: 0.05 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.8 });
  const awningMat = new THREE.MeshStandardMaterial({
    color: faceDirX < 0 ? 0xdc2626 : 0x059669,
    roughness: 0.55,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  b.add(body);

  const parapet = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.55, depth + 0.3), roofMat);
  parapet.position.y = height + 0.25;
  b.add(parapet);

  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 })
  );
  tank.position.set(-faceDirX * 1.2, height + 1.15, 0);
  b.add(tank);

  // Colorful awning & Nitol-Niloy / Dhaka storefront sign
  const awning = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.18, depth * 0.8), awningMat);
  awning.position.set(faceDirX * (width / 2 + 0.65), 3.05, 0);
  awning.rotation.z = -faceDirX * 0.18;
  b.add(awning);

  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1.9, Math.min(depth * 0.8, 7.8)),
    new THREE.MeshBasicMaterial({ map: companySignTex })
  );
  signBoard.position.set(faceDirX * (width / 2 + 0.16), 4.3, 0);
  b.add(signBoard);

  if (addRooftopBillboard) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.7, roughness: 0.4 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.1, 0.24), frameMat);
    legL.position.set(faceDirX * (width * 0.28), height + 1.05, -3.4);
    const legR = legL.clone();
    legR.position.z = 3.4;
    b.add(legL, legR);

    const roofBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2.55, 8.9),
      new THREE.MeshBasicMaterial({ map: companySignTex })
    );
    roofBoard.position.set(faceDirX * (width * 0.28), height + 2.65, 0);
    b.add(roofBoard);
  }

  return b;
}

function createKrishnachuraTree(scale = 1, isFlame = true): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 2.6 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 })
  );
  trunk.position.y = 1.3 * scale;
  trunk.castShadow = true;
  tree.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.75 });
  const bloomMat = new THREE.MeshStandardMaterial({
    color: isFlame ? 0xef4444 : 0x22c55e,
    roughness: 0.7,
  });
  const goldBloomMat = new THREE.MeshStandardMaterial({
    color: isFlame ? 0xf97316 : 0x4ade80,
    roughness: 0.7,
  });

  const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45 * scale, 0), leafMat);
  c1.position.set(0, 3.05 * scale, 0);
  c1.castShadow = true;
  const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05 * scale, 0), bloomMat);
  c2.position.set(0.55 * scale, 3.55 * scale, 0.28 * scale);
  const c3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.88 * scale, 0), goldBloomMat);
  c3.position.set(-0.55 * scale, 3.45 * scale, -0.25 * scale);
  tree.add(c1, c2, c3);
  return tree;
}

function createPalmTree(scale = 1): THREE.Group {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * scale, 0.24 * scale, 4.6 * scale, 7),
    new THREE.MeshStandardMaterial({ color: 0x78553a, roughness: 0.9 })
  );
  trunk.position.y = 2.3 * scale;
  trunk.castShadow = true;
  tree.add(trunk);

  const frondMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const frond = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.08 * scale, 2.0 * scale), frondMat);
    frond.position.set(Math.sin(angle) * 0.95 * scale, 4.55 * scale, Math.cos(angle) * 0.95 * scale);
    frond.rotation.y = angle;
    frond.rotation.x = 0.28;
    tree.add(frond);
  }
  return tree;
}

function createFunnyRoadSign(tex: THREE.CanvasTexture, yaw = 0.28): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.08, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.35 })
  );
  pole.position.y = 1.6;
  g.add(pole);

  const board = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.65, 0.1), new THREE.MeshBasicMaterial({ map: tex }));
  board.position.y = 3.25;
  board.rotation.y = yaw;
  g.add(board);
  return g;
}

function createAccidentSloganHoarding(tex: THREE.CanvasTexture, yaw = 0.25): THREE.Group {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.7, roughness: 0.35 });
  for (const px of [-1.05, 1.05]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.4, 6), poleMat);
    pole.position.set(Math.cos(yaw) * px, 1.7, -Math.sin(yaw) * px);
    g.add(pole);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.85, 1.45, 0.12), new THREE.MeshBasicMaterial({ map: tex }));
  board.position.y = 3.25;
  board.rotation.y = yaw;
  g.add(board);
  return g;
}

export function buildDhakaWorld(textures: ProceduralTextureSet): DhakaWorld {
  const root = new THREE.Group();

  // Lush green Dhaka urban verge ground spanning well past 78m side city & 720m loop
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.94, metalness: 0.0 });
  const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(540, 1320), groundMat);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.05;
  groundPlane.receiveShadow = true;
  root.add(groundPlane);

  const roadMat = new THREE.MeshStandardMaterial({ map: textures.road, roughness: 0.86, metalness: 0.04 });
  const cityRoadMat = new THREE.MeshStandardMaterial({ map: textures.cityRoad, roughness: 0.87, metalness: 0.03 });
  const cityAsphaltMat = new THREE.MeshStandardMaterial({ color: 0x333842, roughness: 0.88 });
  const goliAsphaltMat = new THREE.MeshStandardMaterial({ color: 0x3f4451, roughness: 0.9 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.82 });
  const medianMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 });
  const medianDarkMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 });
  const perimeterWallMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.75 });
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.65, roughness: 0.4 });
  const lampBulbMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfde68a, emissiveIntensity: 0.9 });

  const metroTrain = buildMetroTrain(textures);
  metroTrain.position.set(-1.35, 7.55, -80);
  root.add(metroTrain);

  const blocks: WorldBlock[] = [];
  const intersections: IntersectionNode[] = [];
  const solidBuildings: SolidBuildingBox[] = [];

  const fuelStations: FuelStationNode[] = [
    {
      id: 'arterial_pump',
      label: 'আর্টারিয়াল তেল পাম্প',
      padMinX: -12.6,
      padMaxX: -6.0,
      baseZ: -360,
      nozzleX: -13.2,
      nozzleY: 1.25,
      nozzleZ: -360,
    },
    {
      id: 'downtown_west_pump',
      label: 'পশ্চিম ডাউনটাউন পাম্প',
      padMinX: -46.2,
      padMaxX: -39.0,
      baseZ: -40,
      nozzleX: -47.2,
      nozzleY: 1.25,
      nozzleZ: -40,
    },
    {
      id: 'downtown_east_pump',
      label: 'পূর্ব ডাউনটাউন পাম্প',
      padMinX: 39.0,
      padMaxX: 46.2,
      baseZ: -360,
      nozzleX: 47.2,
      nozzleY: 1.25,
      nozzleZ: -360,
    },
  ];

  // 4 parallel N-S side avenues (inner ±34 & outer ±62) + 4 major E-W boulevards + 5 connector Golis
  const cityLanes: CityLane[] = [
    { id: 'ave_li_north', axis: 'NS', fixedCoord: GAME_CONFIG.AVENUE_LEFT_INNER_X - 2.3, dir: -1, minRange: -GAME_CONFIG.LOOP_LENGTH, maxRange: 0 },
    { id: 'ave_li_south', axis: 'NS', fixedCoord: GAME_CONFIG.AVENUE_LEFT_INNER_X + 2.3, dir: 1, minRange: -GAME_CONFIG.LOOP_LENGTH, maxRange: 0 },
    { id: 'ave_ri_north', axis: 'NS', fixedCoord: GAME_CONFIG.AVENUE_RIGHT_INNER_X - 2.3, dir: -1, minRange: -GAME_CONFIG.LOOP_LENGTH, maxRange: 0 },
    { id: 'ave_ri_south', axis: 'NS', fixedCoord: GAME_CONFIG.AVENUE_RIGHT_INNER_X + 2.3, dir: 1, minRange: -GAME_CONFIG.LOOP_LENGTH, maxRange: 0 },
    { id: 'ave_lo_north', axis: 'NS', fixedCoord: GAME_CONFIG.AVENUE_LEFT_OUTER_X - 2.1, dir: -1, minRange: -GAME_CONFIG.LOOP_LENGTH, maxRange: 0 },
    { id: 'ave_lo_south', axis: 'NS', fixedCoord: GAME_CONFIG.AVENUE_LEFT_OUTER_X + 2.1, dir: 1, minRange: -GAME_CONFIG.LOOP_LENGTH, maxRange: 0 },
    { id: 'ave_ro_north', axis: 'NS', fixedCoord: GAME_CONFIG.AVENUE_RIGHT_OUTER_X - 2.1, dir: -1, minRange: -GAME_CONFIG.LOOP_LENGTH, maxRange: 0 },
    { id: 'ave_ro_south', axis: 'NS', fixedCoord: GAME_CONFIG.AVENUE_RIGHT_OUTER_X + 2.1, dir: 1, minRange: -GAME_CONFIG.LOOP_LENGTH, maxRange: 0 },
  ];

  for (const iz of GAME_CONFIG.INTERSECTION_Z_POSITIONS) {
    cityLanes.push(
      { id: `ew_east_${iz}`, axis: 'EW', fixedCoord: iz - 3.0, dir: 1, minRange: -75, maxRange: 75, isSignalizedEw: true },
      { id: `ew_west_${iz}`, axis: 'EW', fixedCoord: iz + 3.0, dir: -1, minRange: -75, maxRange: 75, isSignalizedEw: true }
    );
  }

  for (const gz of GOLI_ALLEY_Z_POSITIONS) {
    cityLanes.push(
      { id: `goli_east_${gz}`, axis: 'EW', fixedCoord: gz - 2.0, dir: 1, minRange: -75, maxRange: 75, isSignalizedEw: false },
      { id: `goli_west_${gz}`, axis: 'EW', fixedCoord: gz + 2.0, dir: -1, minRange: -75, maxRange: 75, isSignalizedEw: false }
    );
  }

  // Official DMTCL MRT Line-6 Real Stations:
  // Block 1 (-120): Farmgate | Block 5 (-440): Shahbag | Block 7 (-600): Motijheel
  const stationBlockMap = new Map<number, number>([
    [1, 0],
    [5, 1],
    [7, 2],
  ]);

  // Overhead Highway Direction Gantry Sign blocks (Mohakhali, Farmgate, Shahbag, Gulistan, Uttara)
  const gantryBlockMap = new Map<number, number>([
    [0, 0], // Mohakhali / Gulshan gantry right ahead of start!
    [2, 1], // Farmgate / Dhanmondi
    [3, 2], // Shahbag / Paltan
    [6, 3], // Gulistan / Motijheel
    [8, 4], // Uttara / Airport
  ]);

  const avenues = [
    { x: GAME_CONFIG.AVENUE_LEFT_INNER_X, width: 10 },
    { x: GAME_CONFIG.AVENUE_RIGHT_INNER_X, width: 10 },
    { x: GAME_CONFIG.AVENUE_LEFT_OUTER_X, width: 9 },
    { x: GAME_CONFIG.AVENUE_RIGHT_OUTER_X, width: 9 },
  ];

  for (let i = 0; i < GAME_CONFIG.BLOCK_COUNT; i++) {
    const blockLen = GAME_CONFIG.BLOCK_LENGTH; // 80m -> 9 * 80 = 720m
    const baseZ = -(i * blockLen + blockLen / 2);
    const g = new THREE.Group();
    g.position.z = baseZ;

    // 1. Main 4-Lane Arterial Road
    const roadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(GAME_CONFIG.ARTERY_HALF_WIDTH * 2, blockLen),
      roadMat
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.receiveShadow = true;
    g.add(roadMesh);

    // 2. 4 Parallel Downtown N-S Avenues (x = ±34 and x = ±62) with 2-lane road markings
    for (const ave of avenues) {
      const dtRoad = new THREE.Mesh(new THREE.PlaneGeometry(ave.width, blockLen), cityRoadMat);
      dtRoad.rotation.x = -Math.PI / 2;
      dtRoad.position.set(ave.x, 0.005, 0);
      dtRoad.receiveShadow = true;
      g.add(dtRoad);
    }

    const blockStartZ = -i * blockLen;
    const blockEndZ = -(i + 1) * blockLen;
    const intersectionZ = GAME_CONFIG.INTERSECTION_Z_POSITIONS.find(
      (iz) => iz <= blockStartZ && iz > blockEndZ
    );
    const hasStartGoli = GOLI_ALLEY_Z_POSITIONS.some((gz) => Math.abs(wrapLoopDelta(gz, blockStartZ)) < 1);
    const hasEndGoli = GOLI_ALLEY_Z_POSITIONS.some((gz) => Math.abs(wrapLoopDelta(gz, blockEndZ)) < 1);

    // Sidewalks flanking artery: NEVER cross intersections, fuel pad (block 4 west), or any start/end Goli!
    const zMinSafe = hasEndGoli ? -35.2 : -40;
    const zMaxSafe = hasStartGoli ? 35.2 : 40;

    for (const side of [-1, 1]) {
      const hasMidGap = intersectionZ !== undefined || (i === 4 && side === -1);
      const midGapHalf = intersectionZ !== undefined ? 9.5 : 11.6;
      const swCenterX = side * (GAME_CONFIG.ARTERY_HALF_WIDTH + 1.6);

      if (!hasMidGap) {
        const len = zMaxSafe - zMinSafe;
        const sw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.11, len), sidewalkMat);
        sw.position.set(swCenterX, 0.045, (zMinSafe + zMaxSafe) * 0.5);
        sw.receiveShadow = true;
        g.add(sw);
      } else {
        const segALen = -midGapHalf - zMinSafe;
        if (segALen > 1.0) {
          const swA = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.11, segALen), sidewalkMat);
          swA.position.set(swCenterX, 0.045, (zMinSafe - midGapHalf) * 0.5);
          swA.receiveShadow = true;
          g.add(swA);
        }
        const segBLen = zMaxSafe - midGapHalf;
        if (segBLen > 1.0) {
          const swB = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.11, segBLen), sidewalkMat);
          swB.position.set(swCenterX, 0.045, (midGapHalf + zMaxSafe) * 0.5);
          swB.receiveShadow = true;
          g.add(swB);
        }
      }
    }

    if (intersectionZ !== undefined) {
      const localZ = intersectionZ - baseZ;

      const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(154, 13.5), cityAsphaltMat);
      crossRoad.rotation.x = -Math.PI / 2;
      crossRoad.position.set(0, 0.012, localZ);
      crossRoad.receiveShadow = true;
      g.add(crossRoad);

      // E-W yellow center dashes & crisp white edges on left/right of main intersection & avenue caps
      const ewDashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
      const ewEdgeMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
      for (const side of [-1, 1]) {
        for (const zEdge of [-6.35, 6.35]) {
          const edge = new THREE.Mesh(new THREE.PlaneGeometry(66, 0.24), ewEdgeMat);
          edge.rotation.x = -Math.PI / 2;
          edge.position.set(side * 44, 0.016, localZ + zEdge);
          g.add(edge);
        }
        for (let dx = 16; dx <= 74; dx += 10) {
          if (Math.abs(dx - 34) < 5.5 || Math.abs(dx - 62) < 5.0) continue;
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.24), ewDashMat);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(side * dx, 0.017, localZ);
          g.add(dash);
        }
      }

      // Clean junction pavement caps where E-W meets N-S avenues (removes visual line clashes)
      for (const ave of avenues) {
        const cap = new THREE.Mesh(new THREE.PlaneGeometry(ave.width + 0.4, 13.6), cityAsphaltMat);
        cap.rotation.x = -Math.PI / 2;
        cap.position.set(ave.x, 0.015, localZ);
        g.add(cap);
      }

      for (const zOff of [-8.2, 8.2]) {
        const zebra = new THREE.Mesh(
          new THREE.PlaneGeometry(GAME_CONFIG.ARTERY_HALF_WIDTH * 1.9, 4.2),
          new THREE.MeshStandardMaterial({
            map: textures.zebra,
            roughness: 0.8,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          })
        );
        zebra.rotation.x = -Math.PI / 2;
        zebra.position.set(0, 0.02, localZ + zOff);
        zebra.receiveShadow = true;
        g.add(zebra);
      }

      // 4-Way Traffic Light Rigs (2 for N-S + 2 for E-W cross traffic)
      const nsRigSouth = buildTrafficLight();
      nsRigSouth.group.position.set(-GAME_CONFIG.ARTERY_HALF_WIDTH - 0.55, 0, localZ + 7.2);
      g.add(nsRigSouth.group);

      const nsRigNorth = buildTrafficLight();
      nsRigNorth.group.position.set(GAME_CONFIG.ARTERY_HALF_WIDTH + 0.55, 0, localZ - 7.2);
      nsRigNorth.group.rotation.y = Math.PI;
      g.add(nsRigNorth.group);

      const ewRigWest = buildTrafficLight();
      ewRigWest.group.position.set(-GAME_CONFIG.ARTERY_HALF_WIDTH - 1.6, 0, localZ - 7.3);
      ewRigWest.group.rotation.y = -Math.PI / 2;
      g.add(ewRigWest.group);

      const ewRigEast = buildTrafficLight();
      ewRigEast.group.position.set(GAME_CONFIG.ARTERY_HALF_WIDTH + 1.6, 0, localZ + 7.3);
      ewRigEast.group.rotation.y = Math.PI / 2;
      g.add(ewRigEast.group);

      intersections.push({
        baseZ: intersectionZ,
        nsLightRigs: [nsRigSouth, nsRigNorth],
        ewLightRigs: [ewRigWest, ewRigEast],
        nsPhase: 'GREEN',
        ewPhase: 'RED',
        cycleOffset: intersections.length * 4.5,
        violatedThisPass: false,
        bonusAwardedThisPass: false,
      });
    }

    // Drivable Connecting Dhaka Side Alleys (গলি) on block edge z = blockEndZ (localZ = -40):
    // Sidewalks & medians already leave [-40..-35.2] here and [+35.2..+40] on the next block completely open!
    if (hasEndGoli) {
      const goliFullRoad = new THREE.Mesh(new THREE.PlaneGeometry(156, 9.6), goliAsphaltMat);
      goliFullRoad.rotation.x = -Math.PI / 2;
      goliFullRoad.position.set(0, 0.013, -blockLen / 2);
      goliFullRoad.receiveShadow = true;
      g.add(goliFullRoad);

      const goliDashMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
      for (const side of [-1, 1]) {
        for (let dx = 15; dx <= 73; dx += 9) {
          if (Math.abs(dx - 34) < 5.0 || Math.abs(dx - 62) < 4.5) continue;
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.18), goliDashMat);
          dash.rotation.x = -Math.PI / 2;
          dash.position.set(side * dx, 0.017, -blockLen / 2);
          g.add(dash);
        }
      }
      for (const ave of avenues) {
        const cap = new THREE.Mesh(new THREE.PlaneGeometry(ave.width + 0.3, 9.8), goliAsphaltMat);
        cap.rotation.x = -Math.PI / 2;
        cap.position.set(ave.x, 0.016, -blockLen / 2);
        g.add(cap);
      }
    }

    // Center Metro Rail Viaduct & Banners + Eye-level Pillar Signs
    const metroViaduct = buildMetroRailViaductSegment(textures, blockLen, intersectionZ !== undefined);
    g.add(metroViaduct);

    // Elevated Dhaka Metro Rail Stations (Farmgate, Shahbag, Motijheel) with visible Diagonal Escalators
    const stationIdx = stationBlockMap.get(i);
    if (stationIdx !== undefined) {
      const station = buildMetroStation(textures, stationIdx);
      g.add(station);

      // Register solid colliders along sidewalk escalator trusses/piers (x = ±11.4, local z = +1 .. +12.2)
      for (const side of [-1, 1]) {
        const tx = side * 11.4;
        solidBuildings.push({
          id: `Bld_metro_esc_${i}_${side}`,
          minX: tx - 1.25,
          maxX: tx + 1.25,
          baseMinZ: baseZ + 1.0,
          baseMaxZ: baseZ + 12.2,
        });
      }
    }

    // Colorful Dhaka Welcome Rickshaw-Art Arch in Block 0 & Block 4
    if (i === 0 || i === 4) {
      const arch = buildDhakaWelcomeArch(textures);
      arch.position.set(0, 0, i === 0 ? -10 : 12);
      g.add(arch);
    }

    // Overhead Highway Directional Gantries (মহাখালী, গুলিস্তান, ফার্মগেট, শাহবাগ, উত্তরা)
    const gantryIdx = gantryBlockMap.get(i);
    if (gantryIdx !== undefined) {
      const gantry = buildHighwayDirectionGantry(textures.directionSigns[gantryIdx]);
      gantry.position.set(0, 0, i === 0 ? -24 : 26);
      g.add(gantry);
    }

    // Colorful alternating yellow-green Dhaka median dividers (strictly clear of Golis & Intersections!)
    if (intersectionZ === undefined) {
      for (let mz = -32; mz <= 32; mz += 16) {
        if (mz - 6.2 < zMinSafe || mz + 6.2 > zMaxSafe) continue;
        const seg = new THREE.Mesh(
          new THREE.BoxGeometry(GAME_CONFIG.MEDIAN_HALF_WIDTH * 2, 0.36, 12.5),
          (Math.abs(mz / 16) + i) % 2 === 0 ? medianMat : medianDarkMat
        );
        seg.position.set(0, 0.18, mz);
        seg.castShadow = true;
        seg.receiveShadow = true;
        g.add(seg);
      }
    }

    // Fuel Stations inside this block (Arterial + West Downtown + East Downtown)
    for (const fs of fuelStations) {
      if (fs.baseZ <= blockStartZ && fs.baseZ > blockEndZ) {
        const localZ = fs.baseZ - baseZ;
        const isEast = fs.id === 'downtown_east_pump';
        const station = buildFuelStation(textures, !isEast);
        const stX = fs.id === 'arterial_pump' ? -10.2 : isEast ? 44.2 : -44.2;
        station.position.set(stX, 0, localZ);
        g.add(station);
      }
    }

    // Solid City Buildings across 3 columns per side: Inner (±21), Mid (±48), Outer Rim (±72.5)
    const innerSlots = [-24, 0, 24];
    for (const slotZ of innerSlots) {
      const worldSlotZ = baseZ + slotZ;
      if (intersectionZ !== undefined && Math.abs(worldSlotZ - intersectionZ) < 16) {
        continue;
      }

      // Column 1: Inner Road-facing blocks (x = ±21, width 12 -> ±15..±27)
      for (const side of [-1, 1]) {
        const nearArterialPump = side === -1 && Math.abs(worldSlotZ - fuelStations[0].baseZ) < 18;
        if (nearArterialPump) continue;

        const w = 12;
        const h = 10 + ((i * 7 + Math.abs(slotZ) + (side > 0 ? 3 : 0)) % 13);
        const d = 17;
        const cx = side * 21;
        const facadeTex =
          textures.buildingFacades[(i * 3 + (side > 0 ? 1 : 0) + Math.abs(slotZ)) % textures.buildingFacades.length];
        const signTex =
          textures.shopSigns[(i * 2 + (side > 0 ? 3 : 0) + Math.abs(slotZ)) % textures.shopSigns.length];

        const bld = createRoadsideBuilding(w, h, d, facadeTex, signTex, Math.abs(slotZ) === 0, -side);
        bld.position.set(cx, 0, slotZ);
        g.add(bld);

        solidBuildings.push({
          id: `Bld_in_${i}_${side}_${slotZ}`,
          minX: cx - w / 2,
          maxX: cx + w / 2,
          baseMinZ: worldSlotZ - d / 2,
          baseMaxZ: worldSlotZ + d / 2,
        });
      }

      // Column 2: Mid City blocks between avenues ±34 and ±62 (x = ±48, width 12 -> ±42..±54)
      for (const side of [-1, 1]) {
        const nearWestPump = side === -1 && Math.abs(worldSlotZ - fuelStations[1].baseZ) < 18;
        const nearEastPump = side === 1 && Math.abs(worldSlotZ - fuelStations[2].baseZ) < 18;
        if (nearWestPump || nearEastPump) continue;

        const w = 12;
        const h = 11 + ((i * 5 + Math.abs(slotZ) + (side > 0 ? 2 : 0)) % 11);
        const d = 17;
        const cx = side * 48;
        const facadeTex =
          textures.buildingFacades[(i * 2 + 4 + Math.abs(slotZ)) % textures.buildingFacades.length];
        const signTex =
          textures.shopSigns[(i + (side > 0 ? 1 : 4)) % textures.shopSigns.length];

        const bld = createRoadsideBuilding(w, h, d, facadeTex, signTex, Math.abs(slotZ) === 24, -side);
        bld.position.set(cx, 0, slotZ);
        g.add(bld);

        solidBuildings.push({
          id: `Bld_mid_${i}_${side}_${slotZ}`,
          minX: cx - w / 2,
          maxX: cx + w / 2,
          baseMinZ: worldSlotZ - d / 2,
          baseMaxZ: worldSlotZ + d / 2,
        });
      }

      // Column 3: Outer Rim blocks beside avenues ±62 (x = ±72.5, width 8.5 -> ±68.25..±76.75)
      for (const side of [-1, 1]) {
        const w = 8.5;
        const h = 9 + ((i * 3 + Math.abs(slotZ) + (side > 0 ? 4 : 1)) % 10);
        const d = 17;
        const cx = side * 72.5;
        const facadeTex =
          textures.buildingFacades[(i * 5 + (side > 0 ? 2 : 0) + Math.abs(slotZ)) % textures.buildingFacades.length];
        const signTex =
          textures.shopSigns[(i * 3 + (side > 0 ? 2 : 5)) % textures.shopSigns.length];

        const bld = createRoadsideBuilding(w, h, d, facadeTex, signTex, false, -side);
        bld.position.set(cx, 0, slotZ);
        g.add(bld);

        solidBuildings.push({
          id: `Bld_rim_${i}_${side}_${slotZ}`,
          minX: cx - w / 2,
          maxX: cx + w / 2,
          baseMinZ: worldSlotZ - d / 2,
          baseMaxZ: worldSlotZ + d / 2,
        });
      }
    }

    // Roadside Tong Tea Stalls on sidewalks
    if (intersectionZ === undefined && stationIdx === undefined && i !== 4) {
      const tong = buildTongStall(textures, i);
      const side = i % 2 === 0 ? 1 : -1;
      tong.position.set(side * (GAME_CONFIG.ARTERY_HALF_WIDTH + 3.4), 0.08, -14);
      if (side > 0) tong.rotation.y = Math.PI;
      g.add(tong);
    }

    // Perimeter Boundary Walls at x = ±78
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, blockLen), perimeterWallMat);
      wall.position.set(side * GAME_CONFIG.WORLD_PERIMETER_X, 1.1, 0);
      g.add(wall);
    }

    // Streetlights, Krishnachura Flame Trees, Palm Trees & Funny Bangla Roadside Signs
    for (let pz = -28; pz <= 28; pz += 28) {
      const worldZ = baseZ + pz;
      const nearCross = intersectionZ !== undefined && Math.abs(worldZ - intersectionZ) < 14;
      const nearPump = Math.abs(worldZ - fuelStations[0].baseZ) < 16;

      if (!nearCross) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 6), lampPoleMat);
        pole.position.set(GAME_CONFIG.ARTERY_HALF_WIDTH + 1.1, 2.9, pz);
        g.add(pole);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), lampPoleMat);
        arm.position.set(GAME_CONFIG.ARTERY_HALF_WIDTH + 0.25, 5.75, pz);
        g.add(arm);

        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.22), lampBulbMat);
        bulb.position.set(GAME_CONFIG.ARTERY_HALF_WIDTH - 0.45, 5.66, pz);
        g.add(bulb);
      }

      if (!nearCross && !nearPump && stationIdx === undefined) {
        if (pz === -28) {
          const flameTree = createKrishnachuraTree(1.05, true);
          flameTree.position.set(-GAME_CONFIG.ARTERY_HALF_WIDTH - 2.6, 0.12, -26);
          g.add(flameTree);
        } else if (pz === 28) {
          const palm = createPalmTree(1.0);
          palm.position.set(GAME_CONFIG.ARTERY_HALF_WIDTH + 2.7, 0.12, 24);
          g.add(palm);
        }
      }
    }

    // Funny Bangla signs + Official Dhaka Traffic Control Signs placed clearly along roadsides!
    if (Math.abs(baseZ - fuelStations[0].baseZ) > 30 && stationIdx === undefined) {
      const signTexLeft = textures.roadSigns[i % textures.roadSigns.length];
      const signLeft = createFunnyRoadSign(signTexLeft, 0.32);
      signLeft.position.set(-GAME_CONFIG.ARTERY_HALF_WIDTH - 1.35, 0.12, 18);
      g.add(signLeft);
    }
    if (intersectionZ === undefined && stationIdx === undefined) {
      const signTexRight = textures.roadSigns[(i + 5) % textures.roadSigns.length];
      const signRight = createFunnyRoadSign(signTexRight, -0.35);
      signRight.position.set(GAME_CONFIG.ARTERY_HALF_WIDTH + 1.35, 0.12, -18);
      g.add(signRight);
    }

    // Official Traffic Control Signs (STOP, KEEP LEFT, 40 SPEED LIMIT, MRT-6 STATION)
    if (intersectionZ !== undefined) {
      const stopSign = createFunnyRoadSign(textures.trafficControlSigns[0], 0.2);
      stopSign.position.set(-GAME_CONFIG.ARTERY_HALF_WIDTH - 1.4, 0.12, 23);
      g.add(stopSign);
    } else if (i === 0 || i === 4 || i === 6) {
      const mrtSign = createFunnyRoadSign(textures.trafficControlSigns[3], 0.25);
      mrtSign.position.set(-GAME_CONFIG.ARTERY_HALF_WIDTH - 1.4, 0.12, -26);
      g.add(mrtSign);
    } else {
      const speedOrLeftIdx = i % 2 === 0 ? 1 : 2;
      const ctrlSign = createFunnyRoadSign(textures.trafficControlSigns[speedOrLeftIdx], -0.2);
      ctrlSign.position.set(GAME_CONFIG.ARTERY_HALF_WIDTH + 1.4, 0.12, 16);
      g.add(ctrlSign);
    }

    // Funny Bangla signs & Keep-Left signs along downtown side avenues (±28.2 & ±56.6)
    const aveSign = createFunnyRoadSign(textures.roadSigns[(i * 3 + 2) % textures.roadSigns.length], 0.18);
    aveSign.position.set(i % 2 === 0 ? -28.2 : 28.2, 0.04, -14);
    g.add(aveSign);

    const outerSign = createFunnyRoadSign(textures.roadSigns[(i * 2 + 7) % textures.roadSigns.length], -0.22);
    outerSign.position.set(i % 2 === 0 ? 56.6 : -56.6, 0.04, 16);
    g.add(outerSign);

    // Classic Road-Safety Hoarding ("একটি দুর্ঘটনা সারা জীবনের কান্না") scattered across artery & side streets
    if (i === 0 || i === 3 || i === 5 || i === 7) {
      const side = i % 2 === 0 ? 1 : -1;
      const sloganZ = i === 0 ? 14 : i === 3 ? -22 : 24;
      const sloganBoard = createAccidentSloganHoarding(textures.accidentSloganSign, -side * 0.28);
      sloganBoard.position.set(side * (GAME_CONFIG.ARTERY_HALF_WIDTH + 1.45), 0.12, sloganZ);
      g.add(sloganBoard);
    }
    if (i === 2 || i === 4 || i === 6 || i === 8) {
      const sideX = i === 2 ? -28.2 : i === 4 ? 56.4 : i === 6 ? 28.2 : -56.4;
      const sideSlogan = createAccidentSloganHoarding(textures.accidentSloganSign, sideX < 0 ? 0.2 : -0.2);
      sideSlogan.position.set(sideX, 0.04, 12);
      g.add(sideSlogan);
    }

    root.add(g);
    blocks.push({ index: i, baseZ, group: g });
  }

  const updateAroundPlayer = (playerZ: number, elapsedSec: number) => {
    groundPlane.position.z = playerZ - 80;

    const loopLen = GAME_CONFIG.LOOP_LENGTH; // 720m
    for (const block of blocks) {
      let dz = block.baseZ - playerZ;
      while (dz > 240) dz -= loopLen;
      while (dz <= -(loopLen - 240)) dz += loopLen;
      block.group.position.z = playerZ + dz;
    }

    // Animated Metro Rail train glides overhead along viaduct & stations
    const trainWorldZ = -((elapsedSec * 24) % loopLen);
    let tdz = trainWorldZ - playerZ;
    while (tdz > 240) tdz -= loopLen;
    while (tdz <= -(loopLen - 240)) tdz += loopLen;
    metroTrain.position.set(-1.35, 7.55, playerZ + tdz);

    // Realistic 16s 4-Way Signal Cycle with All-Red Clearance Gaps:
    // 0.0..6.2s: NS GREEN, EW RED
    // 6.2..8.0s: NS YELLOW, EW RED
    // 8.0..8.8s: ALL RED clearance
    // 8.8..14.0s: NS RED, EW GREEN
    // 14.0..15.5s: NS RED, EW YELLOW
    // 15.5..16.0s: ALL RED clearance
    for (const inter of intersections) {
      const t = (elapsedSec + inter.cycleOffset) % 16.0;
      let nsPhase: TrafficLightPhase = 'RED';
      let ewPhase: TrafficLightPhase = 'RED';
      if (t < 6.2) {
        nsPhase = 'GREEN';
        ewPhase = 'RED';
      } else if (t < 8.0) {
        nsPhase = 'YELLOW';
        ewPhase = 'RED';
      } else if (t < 8.8) {
        nsPhase = 'RED';
        ewPhase = 'RED';
      } else if (t < 14.0) {
        nsPhase = 'RED';
        ewPhase = 'GREEN';
      } else if (t < 15.5) {
        nsPhase = 'RED';
        ewPhase = 'YELLOW';
      }

      if (nsPhase !== inter.nsPhase) {
        inter.nsPhase = nsPhase;
        for (const r of inter.nsLightRigs) r.setPhase(nsPhase);
      }
      if (ewPhase !== inter.ewPhase) {
        inter.ewPhase = ewPhase;
        for (const r of inter.ewLightRigs) r.setPhase(ewPhase);
      }
    }
  };

  const isOnArterySidewalk = (x: number, z: number): boolean => {
    const absX = Math.abs(x);
    if (absX < GAME_CONFIG.ARTERY_HALF_WIDTH + 0.15 || absX > GAME_CONFIG.ARTERY_HALF_WIDTH + 2.9) {
      return false;
    }
    for (const iz of GAME_CONFIG.INTERSECTION_Z_POSITIONS) {
      if (Math.abs(wrapLoopDelta(z, iz)) < 9.5) return false;
    }
    for (const gz of GOLI_ALLEY_Z_POSITIONS) {
      if (Math.abs(wrapLoopDelta(z, gz)) < 5.0) return false;
    }
    if (x < 0 && Math.abs(wrapLoopDelta(z, fuelStations[0].baseZ)) <= GAME_CONFIG.FUEL_PAD_HALF_LENGTH) {
      return false;
    }
    return true;
  };

  return {
    root,
    groundPlane,
    metroTrain,
    blocks,
    intersections,
    solidBuildings,
    fuelStations,
    cityLanes,
    updateAroundPlayer,
    isOnArterySidewalk,
  };
}
