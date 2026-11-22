import * as THREE from 'three';
import {
  buildAirportTowerLandmark,
  buildArmyCantonmentLandmark,
  buildBaluRiverBridge,
  buildBashundharaResidentialLandmark,
  buildDhakaWelcomeArch,
  buildElevatedExpresswayWithBananiRamp,
  buildElevatedFlyoverSpan,
  buildFuelStation,
  buildGazipurChourastaLandmark,
  buildHighwayDirectionGantry,
  buildHousingBillboard,
  buildKurilFlyoverLandmark,
  buildKurmitolaHospitalLandmark,
  buildMetroStation,
  buildMetroTrain,
  buildMohakhaliBusTerminal,
  buildNavyHQLandmark,
  buildNeelaMarketLandmark,
  buildNiloyHeroShowroom,
  buildPurbachalWelcomeArch,
  buildShitalakshyaKanchanBridge,
  buildTongStall,
  buildTrafficLight,
  buildTuragRiverAndBridge,
  type ShowroomAttendantRig,
  type TrafficLightRig,
} from './models';
import type { ProceduralTextureSet } from './textures';
import {
  TRACK_LANDMARKS_S,
  TRACK_LOOP_LENGTH,
  TRACK_RIVER_SPANS,
  TRACK_SEGMENTS,
  UTTARA_TONGI_FLYOVER_DEF,
  findSegmentIndexAtS,
  getRoadProfileAtS,
  isSInAnyRiver,
  sampleTrackPose,
  shortestTrackDeltaS,
  type TrackPose,
} from './track';
import { GAME_CONFIG, type TrafficLightPhase } from './types';

export interface WorldChunk {
  index: number;
  startS: number;
  endS: number;
  midX: number;
  midZ: number;
  group: THREE.Group;
}

export interface CulledLandmark {
  midX: number;
  midZ: number;
  radiusSq: number;
  group: THREE.Group;
}

export interface IntersectionNode {
  s: number;
  cx: number;
  cz: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  yaw: number;
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
  cx: number;
  cz: number;
  ux: number; // width axis (nx)
  uz: number; // width axis (nz)
  vx: number; // depth axis (tx)
  vz: number; // depth axis (tz)
  halfW: number;
  halfD: number;
}

export interface FuelStationNode {
  id: string;
  label: string;
  s: number;
  padMinLat: number;
  padMaxLat: number;
  cx: number;
  cz: number;
  nozzleX: number;
  nozzleY: number;
  nozzleZ: number;
}

export interface ShowroomNode {
  id: string;
  labelBn: string;
  s: number;
  padMinLat: number;
  padMaxLat: number;
  cx: number;
  cz: number;
}

export interface CrossStreetLane {
  id: string;
  interIdx: number;
  s: number;
  latStart: number;
  latEnd: number;
  dirLat: 1 | -1;
  sOffset: number;
  isSignalized: boolean;
}

export interface DhakaWorld {
  root: THREE.Group;
  metroTrain: THREE.Group;
  chunks: WorldChunk[];
  landmarks: CulledLandmark[];
  intersections: IntersectionNode[];
  solidBuildings: SolidBuildingBox[];
  fuelStations: FuelStationNode[];
  showrooms: ShowroomNode[];
  crossLanes: CrossStreetLane[];
  updateAroundPlayer: (playerX: number, playerZ: number, elapsedSec: number, forceSalute?: boolean) => void;
  isOnArterySidewalk: (s: number, lat: number) => boolean;
}

export const CROSS_INTERSECTION_S: readonly number[] = [
  TRACK_LANDMARKS_S.SATRASTA_INTERSECTION_S,     // 140 (Tejgaon Satrasta)
  TRACK_LANDMARKS_S.BYPASS_INTERSECTION_S,       // 4680 (Dhaka Bypass N105)
  TRACK_LANDMARKS_S.GAZIPUR_EAST_INTERSECTION_S, // 6850 (Gazipur Road)
  TRACK_LANDMARKS_S.UTTARA_INTERSECTION_S,       // 10940 (Uttara Jasimuddin)
  TRACK_LANDMARKS_S.MRT_INTERSECTION_S,          // 12440 (Mirpur-10 / Shewrapara MRT)
];

export const TRACK_PERIMETER_LAT = 32.0;

type LatFn = number | ((s: number) => number);

function evalLat(v: LatFn, s: number): number {
  return typeof v === 'function' ? v(s) : v;
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

function createMedianShrub(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.65 });
  const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 * scale, 0), leafMat);
  bush.position.y = 0.55 * scale;
  const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 * scale, 0), flowerMat);
  flower.position.set(0.25 * scale, 0.85 * scale, 0.1 * scale);
  g.add(bush, flower);
  return g;
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

function createStreetLamp(tex: THREE.Texture, side: 1 | -1 = 1): THREE.Group {
  const lamp = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.65, roughness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfde68a,
    emissiveIntensity: 0.9,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 6), poleMat);
  pole.position.y = 2.9;
  lamp.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), poleMat);
  arm.position.set(-side * 0.85, 5.75, 0);
  lamp.add(arm);

  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.22), bulbMat);
  bulb.position.set(-side * 1.55, 5.66, 0);
  lamp.add(bulb);

  const signGeometry = new THREE.PlaneGeometry(3.0, 1.2);
  const signMaterial = new THREE.MeshBasicMaterial({ map: tex });
  const frontSign = new THREE.Mesh(signGeometry, signMaterial);
  frontSign.position.set(-0.2, 4.55, 0.07);
  lamp.add(frontSign);

  const backSign = new THREE.Mesh(signGeometry, signMaterial);
  backSign.position.set(-0.2, 4.55, -0.07);
  backSign.rotation.y = Math.PI;
  lamp.add(backSign);

  return lamp;
}

function createDualArmMedianLamp(): THREE.Group {
  const lamp = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.72, roughness: 0.35 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 1.2,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 7.6, 8), poleMat);
  pole.position.y = 3.8;
  lamp.add(pole);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), poleMat);
    arm.position.set(side * 1.15, 7.45, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.28), bulbMat);
    head.position.set(side * 2.1, 7.36, 0);
    lamp.add(arm, head);
  }
  return lamp;
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

// Build a quad-strip ribbon geometry along track s ∈ [startS, endS] supporting fixed OR dynamic lateral offsets
function buildTrackRibbonGeometry(
  startS: number,
  endS: number,
  latLeft: LatFn,
  latRight: LatFn,
  yOffset: number,
  stepMeters: number,
  vScale: number
): THREE.BufferGeometry {
  const len = Math.max(0.5, endS - startS);
  const segs = Math.max(1, Math.ceil(len / stepMeters));
  const vertCount = (segs + 1) * 2;
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices: number[] = [];

  const poseL: TrackPose = { x: 0, z: 0, tx: 0, tz: -1, nx: 1, nz: 0, yaw: 0, segIdx: 0 };
  const poseR: TrackPose = { x: 0, z: 0, tx: 0, tz: -1, nx: 1, nz: 0, yaw: 0, segIdx: 0 };

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const s = startS + t * len;
    sampleTrackPose(s, evalLat(latLeft, s), poseL);
    sampleTrackPose(s, evalLat(latRight, s), poseR);

    const vIdx = i * 2;
    positions[vIdx * 3] = poseL.x;
    positions[vIdx * 3 + 1] = yOffset;
    positions[vIdx * 3 + 2] = poseL.z;
    normals[vIdx * 3 + 1] = 1;
    uvs[vIdx * 2] = 0;
    uvs[vIdx * 2 + 1] = s * vScale;

    const rIdx = vIdx + 1;
    positions[rIdx * 3] = poseR.x;
    positions[rIdx * 3 + 1] = yOffset;
    positions[rIdx * 3 + 2] = poseR.z;
    normals[rIdx * 3 + 1] = 1;
    uvs[rIdx * 2] = 1;
    uvs[rIdx * 2 + 1] = s * vScale;

    if (i < segs) {
      const a = vIdx;
      const b = rIdx;
      const c = vIdx + 2;
      const d = rIdx + 2;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Build a raised box-strip ribbon supporting fixed OR dynamic center & width
function buildRaisedTrackStrip(
  startS: number,
  endS: number,
  latCenter: LatFn,
  width: LatFn,
  yBottom: number,
  yTop: number,
  mat: THREE.Material,
  stepMeters = 6
): THREE.Mesh {
  const len = Math.max(0.5, endS - startS);
  const segs = Math.max(1, Math.ceil(len / stepMeters));

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const poseL: TrackPose = { x: 0, z: 0, tx: 0, tz: -1, nx: 1, nz: 0, yaw: 0, segIdx: 0 };
  const poseR: TrackPose = { x: 0, z: 0, tx: 0, tz: -1, nx: 1, nz: 0, yaw: 0, segIdx: 0 };

  for (let i = 0; i <= segs; i++) {
    const s = startS + (i / segs) * len;
    const lc = evalLat(latCenter, s);
    const hw = evalLat(width, s) * 0.5;
    sampleTrackPose(s, lc - hw, poseL);
    sampleTrackPose(s, lc + hw, poseR);
    const v = s / 4;
    positions.push(
      poseL.x, yBottom, poseL.z,
      poseR.x, yBottom, poseR.z,
      poseR.x, yTop, poseR.z,
      poseL.x, yTop, poseL.z
    );
    uvs.push(0, v, 1, v, 1, v, 0, v);

    if (i < segs) {
      const b0 = i * 4;
      const b1 = (i + 1) * 4;
      indices.push(b0 + 3, b0 + 2, b1 + 3, b0 + 2, b1 + 2, b1 + 3);
      indices.push(b0 + 0, b0 + 3, b1 + 0, b0 + 3, b1 + 3, b1 + 0);
      indices.push(b0 + 2, b0 + 1, b1 + 2, b0 + 1, b1 + 1, b1 + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function isNearAirportOrKurilInterchange(x: number, z: number): boolean {
  return x >= -125 && x <= 115 && z >= -1145 && z <= -735;
}

function addSplitRaisedTrackStrips(
  target: THREE.Group,
  startS: number,
  endS: number,
  latCenter: LatFn,
  width: LatFn,
  yBottom: number,
  yTop: number,
  mat: THREE.Material,
  stepMeters = 6
): void {
  let cursor = startS;
  for (const rv of TRACK_RIVER_SPANS) {
    if (rv.endS <= cursor || rv.startS >= endS) continue;
    if (rv.startS > cursor + 0.4) {
      target.add(
        buildRaisedTrackStrip(cursor, Math.min(rv.startS, endS), latCenter, width, yBottom, yTop, mat, stepMeters)
      );
    }
    cursor = Math.max(cursor, Math.min(rv.endS, endS));
  }
  if (cursor < endS - 0.4) {
    target.add(buildRaisedTrackStrip(cursor, endS, latCenter, width, yBottom, yTop, mat, stepMeters));
  }
}

export function buildDhakaWorld(textures: ProceduralTextureSet): DhakaWorld {
  const root = new THREE.Group();

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.94, metalness: 0.0 });
  const horizonGroundMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.96, metalness: 0.0 });
  const roadMat = new THREE.MeshStandardMaterial({ map: textures.road, roughness: 0.86, metalness: 0.04 });
  const express300Mat = new THREE.MeshStandardMaterial({
    map: textures.purbachalExpressRoad,
    roughness: 0.85,
    metalness: 0.04,
  });
  const service300Mat = new THREE.MeshStandardMaterial({
    map: textures.purbachalServiceRoad,
    roughness: 0.86,
    metalness: 0.04,
  });
  const cityAsphaltMat = new THREE.MeshStandardMaterial({ color: 0x333842, roughness: 0.88 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.82 });
  const medianMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 });
  const medianDarkMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.72 });
  const islandTurfMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.88 });
  const islandCurbMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 });
  const perimeterWallMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.75 });
  const mrtConcreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.76 });
  const mrtBeamMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.72 });
  const mrtRailMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.65, roughness: 0.4 });
  const mrtStripMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.45 });

  // Vast sub-river horizon terrain plane spanning the 13.6 km Dhaka–Purbachal–Gazipur circuit
  const horizonPlane = new THREE.Mesh(new THREE.PlaneGeometry(5400, 5400), horizonGroundMat);
  horizonPlane.rotation.x = -Math.PI / 2;
  horizonPlane.position.set(1100, -2.2, -1650);
  root.add(horizonPlane);

  // Animated Dhaka Metro Rail (MRT-6) train cruising smoothly along Leg 7 (X = -640, Z = -985..0)
  const metroTrain = buildMetroTrain(textures);
  metroTrain.position.set(-641.35, 7.55, -492);
  root.add(metroTrain);

  const chunks: WorldChunk[] = [];
  const landmarks: CulledLandmark[] = [];
  const intersections: IntersectionNode[] = [];
  const solidBuildings: SolidBuildingBox[] = [];
  const crossLanes: CrossStreetLane[] = [];
  const poseTmp: TrackPose = { x: 0, z: 0, tx: 0, tz: -1, nx: 1, nz: 0, yaw: 0, segIdx: 0 };

  const addOrientedBuildingCollider = (
    id: string,
    s: number,
    lat: number,
    halfW: number,
    halfD: number
  ) => {
    const p = sampleTrackPose(s, lat);
    solidBuildings.push({
      id,
      cx: p.x,
      cz: p.z,
      ux: p.nx,
      uz: p.nz,
      vx: p.tx,
      vz: p.tz,
      halfW,
      halfD,
    });
  };

  // 8 Strategic Fuel Stations spaced cleanly around the 13.6 km Dhaka loop
  const fuelStationDefs = [
    { id: 'banani_pump', label: 'বনানী–কুর্মিটোলা পাম্প', s: TRACK_LANDMARKS_S.TEJGAON_PUMP_S },
    { id: 'purbachal_pump', label: 'পূর্বাচল ৩০০ ফিট পাম্প', s: TRACK_LANDMARKS_S.PURBACHAL_PUMP_S },
    { id: 'neela_pump', label: 'নীলা মার্কেট ৩০০ ফিট পাম্প', s: TRACK_LANDMARKS_S.NEELA_PUMP_S },
    { id: 'rupganj_pump', label: 'ঢাকা বাইপাস রূপগঞ্জ পাম্প', s: TRACK_LANDMARKS_S.BYPASS_RUPGANJ_PUMP_S },
    { id: 'bhogra_pump', label: 'ঢাকা বাইপাস ভোগড়া পাম্প', s: TRACK_LANDMARKS_S.BYPASS_PUMP_S },
    { id: 'gazipur_pump', label: 'গাজীপুর চৌরাস্তা পাম্প', s: TRACK_LANDMARKS_S.GAZIPUR_PUMP_S },
    { id: 'board_bazar_pump', label: 'বোর্ড বাজার – টঙ্গী পাম্প', s: TRACK_LANDMARKS_S.BOARD_BAZAR_PUMP_S },
    { id: 'mrt_pump', label: 'মিরপুর–ফার্মগেট মেট্রো পাম্প', s: TRACK_LANDMARKS_S.MRT_PUMP_S },
  ];
  const fuelStations: FuelStationNode[] = fuelStationDefs.map((def) => {
    const prof = getRoadProfileAtS(def.s);
    const anchorLat = -(prof.halfWidth + 0.6);
    const padCenter = sampleTrackPose(def.s, anchorLat + 0.9);
    const nozzle = sampleTrackPose(def.s, anchorLat - 3.0);
    return {
      id: def.id,
      label: def.label,
      s: def.s,
      padMinLat: anchorLat - 2.4,
      padMaxLat: anchorLat + 4.2,
      cx: padCenter.x,
      cz: padCenter.z,
      nozzleX: nozzle.x,
      nozzleY: 1.25,
      nozzleZ: nozzle.z,
    };
  });

  // 2 Niloy Hero Showrooms along standard arterial shoulders: Tejgaon Flagship & Board Bazar Gazipur Hub
  const showroomDefs = [
    {
      id: 'tejgaon_showroom',
      labelBn: 'নিলয় হিরো ফ্ল্যাগশিপ • তেজগাঁও',
      s: TRACK_LANDMARKS_S.TEJGAON_SHOWROOM_S,
    },
    {
      id: 'board_bazar_showroom',
      labelBn: 'নিলয় হিরো গাজীপুর হাব (বোর্ড বাজার)',
      s: TRACK_LANDMARKS_S.BOARD_BAZAR_SHOWROOM_S,
    },
  ];
  const showrooms: ShowroomNode[] = showroomDefs.map((def) => {
    const padCenter = sampleTrackPose(def.s, -10.0);
    return {
      id: def.id,
      labelBn: def.labelBn,
      s: def.s,
      padMinLat: -12.8,
      padMaxLat: -7.0,
      cx: padCenter.x,
      cz: padCenter.z,
    };
  });

  const showroomDisplayBikes: THREE.Object3D[] = [];
  const showroomStaff: {
    rig: ShowroomAttendantRig;
    worldX: number;
    worldZ: number;
    baseYaw: number;
    idx: number;
  }[] = [];

  // 1. Dhaka Elevated Expressway (Mohakhali Z=-260 -> Optional Banani Down-Ramp Z=-440..-592 -> Kawla Toll Z=-895 -> Airport Z=-1080)
  const expresswayGroup = buildElevatedExpresswayWithBananiRamp(textures);
  expresswayGroup.position.set(0, 0, -670);
  root.add(expresswayGroup);
  landmarks.push({ midX: 0, midZ: -670, radiusSq: 560 * 560, group: expresswayGroup });

  // 2. Drivable Kuril Flyover Overpass & Fork Portal at (0, 0, -760)
  const kurilGroup = buildKurilFlyoverLandmark(textures);
  kurilGroup.position.set(0, 0, -760);
  root.add(kurilGroup);
  landmarks.push({ midX: 90, midZ: -810, radiusSq: 480 * 480, group: kurilGroup });

  // 2b. Ground-Level Airport Rd -> Kuril -> Kawla -> Gazipur Direct Connector (X = 0, Z = -755 .. -1180)
  {
    const connGroup = new THREE.Group();
    const zStart = -755;
    const zEnd = -1180;
    const len = zStart - zEnd; // 425m
    const midZ = (zStart + zEnd) * 0.5;

    const roadGeo = new THREE.PlaneGeometry(19.2, len, 1, 24);
    const uvAttr = roadGeo.getAttribute('uv');
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setY(i, uvAttr.getY(i) * (len / 80));
    }
    const connRoad = new THREE.Mesh(roadGeo, roadMat);
    connRoad.rotation.x = -Math.PI / 2;
    connRoad.position.set(0, 0.0, midZ);
    connRoad.receiveShadow = true;
    connGroup.add(connRoad);

    const connGround = new THREE.Mesh(new THREE.PlaneGeometry(110, len), groundMat);
    connGround.rotation.x = -Math.PI / 2;
    connGround.position.set(0, -0.05, midZ);
    connGround.receiveShadow = true;
    connGroup.add(connGround);

    for (const side of [-1, 1] as const) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.11, len), sidewalkMat);
      sw.position.set(side * 11.2, 0.045, midZ);
      sw.receiveShadow = true;
      connGroup.add(sw);
    }

    for (let wz = zStart - 16; wz >= zEnd + 16; wz -= 18) {
      const mSeg = new THREE.Mesh(
        new THREE.BoxGeometry(GAME_CONFIG.MEDIAN_HALF_WIDTH * 2, 0.36, 11.5),
        Math.abs(Math.floor(wz / 18)) % 2 === 0 ? medianMat : medianDarkMat
      );
      mSeg.position.set(0, 0.18, wz);
      mSeg.castShadow = true;
      connGroup.add(mSeg);
    }

    for (let wz = zStart - 22; wz >= zEnd + 20; wz -= 42) {
      for (const side of [-1, 1] as const) {
        const lamp = createStreetLamp(
          textures.jokeSigns[Math.abs(Math.floor(wz) + side) % textures.jokeSigns.length],
          side
        );
        lamp.position.set(side * 10.75, 0, wz);
        connGroup.add(lamp);
      }
    }

    root.add(connGroup);
    landmarks.push({ midX: 0, midZ, radiusSq: 520 * 520, group: connGroup });
  }

  // 3. Uttara-Tongi Flyover along Southbound Leg 5 (s = 9780..10400 -> 620m continuous viaduct)
  const uttaraMidPose = sampleTrackPose((UTTARA_TONGI_FLYOVER_DEF.startS + UTTARA_TONGI_FLYOVER_DEF.endS) * 0.5, 0);
  const uttaraFlyover = buildElevatedFlyoverSpan(textures, {
    startZ: 310,
    deckStartZ: 225,
    deckEndZ: -225,
    endZ: -310,
    deckHeight: UTTARA_TONGI_FLYOVER_DEF.deckHeight,
    rampLeftMinX: UTTARA_TONGI_FLYOVER_DEF.rampLeftMinLat,
    rampLeftMaxX: UTTARA_TONGI_FLYOVER_DEF.rampLeftMaxLat,
    rampRightMinX: UTTARA_TONGI_FLYOVER_DEF.rampRightMinLat,
    rampRightMaxX: UTTARA_TONGI_FLYOVER_DEF.rampRightMaxLat,
    deckMinX: UTTARA_TONGI_FLYOVER_DEF.deckMinLat,
    deckMaxX: UTTARA_TONGI_FLYOVER_DEF.deckMaxLat,
  });
  uttaraFlyover.position.set(uttaraMidPose.x, 0, uttaraMidPose.z);
  uttaraFlyover.rotation.y = uttaraMidPose.yaw; // Math.PI heading South (+Z)
  root.add(uttaraFlyover);
  landmarks.push({ midX: uttaraMidPose.x, midZ: uttaraMidPose.z, radiusSq: 480 * 480, group: uttaraFlyover });

  // 4. River Bridges (Balu on 55m wide 300ft Road, Shitalakshya Kanchan Bridge, Turag Tongi Bridge)
  const baluPose = sampleTrackPose(TRACK_RIVER_SPANS[0].midS, 0);
  const baluBuilt = buildBaluRiverBridge(textures, true, TRACK_RIVER_SPANS[0].deckHalfWidth);
  baluBuilt.group.position.set(baluPose.x, 0, baluPose.z);
  baluBuilt.group.rotation.y = baluPose.yaw;
  root.add(baluBuilt.group);
  landmarks.push({ midX: baluPose.x, midZ: baluPose.z, radiusSq: 380 * 380, group: baluBuilt.group });

  const kanchanPose = sampleTrackPose(TRACK_RIVER_SPANS[1].midS, 0);
  const kanchanBuilt = buildShitalakshyaKanchanBridge(textures, true, TRACK_RIVER_SPANS[1].deckHalfWidth);
  kanchanBuilt.group.position.set(kanchanPose.x, 0, kanchanPose.z);
  kanchanBuilt.group.rotation.y = kanchanPose.yaw;
  root.add(kanchanBuilt.group);
  landmarks.push({ midX: kanchanPose.x, midZ: kanchanPose.z, radiusSq: 400 * 400, group: kanchanBuilt.group });

  const turagPose = sampleTrackPose(TRACK_RIVER_SPANS[2].midS, 0);
  const turagBuilt = buildTuragRiverAndBridge(textures, true);
  turagBuilt.group.position.set(turagPose.x, 0, turagPose.z);
  turagBuilt.group.rotation.y = turagPose.yaw;
  root.add(turagBuilt.group);
  landmarks.push({ midX: turagPose.x, midZ: turagPose.z, radiusSq: 400 * 400, group: turagBuilt.group });

  const allRiverBoats = [...baluBuilt.boats, ...kanchanBuilt.boats, ...turagBuilt.boats];

  // 5. Major Signature Landmarks
  // 5a. Tejgaon Welcome Arch (s = 18)
  const tejgaonArchPose = sampleTrackPose(TRACK_LANDMARKS_S.TEJGAON_ARCH_S, 0);
  const tejgaonArch = buildDhakaWelcomeArch(textures);
  tejgaonArch.position.set(tejgaonArchPose.x, 0, tejgaonArchPose.z);
  tejgaonArch.rotation.y = tejgaonArchPose.yaw;
  root.add(tejgaonArch);
  landmarks.push({ midX: tejgaonArchPose.x, midZ: tejgaonArchPose.z, radiusSq: 340 * 340, group: tejgaonArch });

  // 5b. Mohakhali Bus Terminal (s = 235, left side lat = -22)
  const mohakhaliPose = sampleTrackPose(TRACK_LANDMARKS_S.MOHAKHALI_TERMINAL_S, -22);
  const mohakhaliGroup = buildMohakhaliBusTerminal(textures);
  mohakhaliGroup.position.set(mohakhaliPose.x, 0, mohakhaliPose.z);
  mohakhaliGroup.rotation.y = mohakhaliPose.yaw;
  root.add(mohakhaliGroup);
  landmarks.push({ midX: mohakhaliPose.x, midZ: mohakhaliPose.z, radiusSq: 340 * 340, group: mohakhaliGroup });
  addOrientedBuildingCollider('Bld_mohakhali_terminal', TRACK_LANDMARKS_S.MOHAKHALI_TERMINAL_S, -22, 4.8, 17);

  // 5b2. Dhaka Cantonment (Army), Bangladesh Navy HQ, & Kurmitola General Hospital (Banani -> Kuril Airport Rd)
  const armyPose = sampleTrackPose(TRACK_LANDMARKS_S.ARMY_CANTONMENT_S, -21.5);
  const armyGroup = buildArmyCantonmentLandmark(textures);
  armyGroup.position.set(armyPose.x, 0, armyPose.z);
  armyGroup.rotation.y = armyPose.yaw;
  root.add(armyGroup);
  landmarks.push({ midX: armyPose.x, midZ: armyPose.z, radiusSq: 350 * 350, group: armyGroup });
  addOrientedBuildingCollider('Bld_army_cantonment', TRACK_LANDMARKS_S.ARMY_CANTONMENT_S, -24.5, 4.5, 11.5);

  const navyPose = sampleTrackPose(TRACK_LANDMARKS_S.NAVY_HQ_S, -22.5);
  const navyGroup = buildNavyHQLandmark(textures);
  navyGroup.position.set(navyPose.x, 0, navyPose.z);
  navyGroup.rotation.y = navyPose.yaw;
  root.add(navyGroup);
  landmarks.push({ midX: navyPose.x, midZ: navyPose.z, radiusSq: 350 * 350, group: navyGroup });
  addOrientedBuildingCollider('Bld_navy_hq', TRACK_LANDMARKS_S.NAVY_HQ_S, -24.5, 4.6, 11.5);

  const hospPose = sampleTrackPose(TRACK_LANDMARKS_S.KURMITOLA_HOSPITAL_S, 22.5);
  const hospGroup = buildKurmitolaHospitalLandmark(textures);
  hospGroup.position.set(hospPose.x, 0, hospPose.z);
  hospGroup.rotation.y = hospPose.yaw;
  root.add(hospGroup);
  landmarks.push({ midX: hospPose.x, midZ: hospPose.z, radiusSq: 360 * 360, group: hospGroup });
  addOrientedBuildingCollider('Bld_kurmitola_hospital', TRACK_LANDMARKS_S.KURMITOLA_HOSPITAL_S, 25.0, 4.8, 12.2);

  // 5c. Purbachal 300ft Welcome Arch spanning full 55m width (s = 1065)
  const purbachalArchPose = sampleTrackPose(TRACK_LANDMARKS_S.PURBACHAL_ARCH_S, 0);
  const purbachalArch = buildPurbachalWelcomeArch(textures, 27.5);
  purbachalArch.position.set(purbachalArchPose.x, 0, purbachalArchPose.z);
  purbachalArch.rotation.y = purbachalArchPose.yaw;
  root.add(purbachalArch);
  landmarks.push({ midX: purbachalArchPose.x, midZ: purbachalArchPose.z, radiusSq: 360 * 360, group: purbachalArch });

  // 5c2. Bashundhara Residential Area Gate, Residential Towers & ICCB Dome along 300ft Road (s = 1320)
  const bashuPose = sampleTrackPose(TRACK_LANDMARKS_S.BASHUNDHARA_RA_S, 39.0);
  const bashuGroup = buildBashundharaResidentialLandmark(textures);
  bashuGroup.position.set(bashuPose.x, 0, bashuPose.z);
  bashuGroup.rotation.y = bashuPose.yaw;
  root.add(bashuGroup);
  landmarks.push({ midX: bashuPose.x, midZ: bashuPose.z, radiusSq: 420 * 420, group: bashuGroup });
  addOrientedBuildingCollider('Bld_bashundhara_gate_L', TRACK_LANDMARKS_S.BASHUNDHARA_RA_S - 8.2, 33.0, 1.5, 1.5);
  addOrientedBuildingCollider('Bld_bashundhara_gate_R', TRACK_LANDMARKS_S.BASHUNDHARA_RA_S + 8.2, 33.0, 1.5, 1.5);
  addOrientedBuildingCollider('Bld_bashundhara_twr1', TRACK_LANDMARKS_S.BASHUNDHARA_RA_S - 15.5, 48.0, 5.5, 6.2);
  addOrientedBuildingCollider('Bld_bashundhara_twr2', TRACK_LANDMARKS_S.BASHUNDHARA_RA_S + 14.5, 50.5, 5.6, 6.5);

  // 5c3. Bangladeshi Housing Company Unipole Billboards flanking Purbachal 300ft Road (s = 1015 .. 3260)
  let billboardIdx = 0;
  for (let bs = 1015; bs <= 3255; bs += 78) {
    if (isSInAnyRiver(bs, 24)) continue;
    if (Math.abs(shortestTrackDeltaS(bs, TRACK_LANDMARKS_S.NEELA_MARKET_S)) < 44) continue;
    if (Math.abs(shortestTrackDeltaS(bs, TRACK_LANDMARKS_S.BASHUNDHARA_RA_S)) < 38) continue;
    if (Math.abs(shortestTrackDeltaS(bs, TRACK_LANDMARKS_S.PURBACHAL_ARCH_S)) < 28) continue;
    if (Math.abs(shortestTrackDeltaS(bs, TRACK_LANDMARKS_S.PURBACHAL_PUMP_S)) < 28) continue;
    if (Math.abs(shortestTrackDeltaS(bs, TRACK_LANDMARKS_S.NEELA_PUMP_S)) < 28) continue;

    const bProf = getRoadProfileAtS(bs);
    const side: 1 | -1 = billboardIdx % 2 === 0 ? -1 : 1;
    const bp = sampleTrackPose(bs, side * (bProf.halfWidth + 5.8));
    const tex = textures.housingBillboards[billboardIdx % textures.housingBillboards.length];
    const bb = buildHousingBillboard(tex);
    bb.position.set(bp.x, 0, bp.z);
    bb.rotation.y = bp.yaw - side * 0.34;
    root.add(bb);
    landmarks.push({ midX: bp.x, midZ: bp.z, radiusSq: 400 * 400, group: bb });
    billboardIdx += 1;
  }

  // 5d. Neela Market Food & Pitha Hub outside the 300ft road shoulders (s = 2580)
  const neelaPose = sampleTrackPose(TRACK_LANDMARKS_S.NEELA_MARKET_S, 0);
  const neelaGroup = buildNeelaMarketLandmark(textures, 27.5);
  neelaGroup.position.set(neelaPose.x, 0, neelaPose.z);
  neelaGroup.rotation.y = neelaPose.yaw;
  root.add(neelaGroup);
  landmarks.push({ midX: neelaPose.x, midZ: neelaPose.z, radiusSq: 380 * 380, group: neelaGroup });
  addOrientedBuildingCollider('Bld_neela_left', TRACK_LANDMARKS_S.NEELA_MARKET_S, -34.3, 4.2, 16);
  addOrientedBuildingCollider('Bld_neela_right', TRACK_LANDMARKS_S.NEELA_MARKET_S, 34.3, 4.2, 16);

  // 5e. Gazipur Chourasta Jagrata Chourangi Roundabout + Overpass (s = 7720)
  const gazipurPose = sampleTrackPose(TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S, 0);
  const gazipurGroup = buildGazipurChourastaLandmark(textures);
  gazipurGroup.position.set(gazipurPose.x, 0, gazipurPose.z);
  gazipurGroup.rotation.y = gazipurPose.yaw;
  root.add(gazipurGroup);
  landmarks.push({ midX: gazipurPose.x, midZ: gazipurPose.z, radiusSq: 380 * 380, group: gazipurGroup });
  addOrientedBuildingCollider('Bld_jagrata_chourangi', TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S, 0, 3.05, 3.05);

  // 5f. Hazrat Shahjalal International Airport ATC Tower & Terminal at Curve 5 (0,-1175 -> -95,-1080)
  const airportGroup = buildAirportTowerLandmark(textures);
  airportGroup.position.set(-28, 0, -1165);
  airportGroup.rotation.y = Math.PI * 0.25;
  root.add(airportGroup);
  landmarks.push({ midX: -28, midZ: -1165, radiusSq: 380 * 380, group: airportGroup });

  // 5g. Dhaka Metro Rail (MRT-6) Stations: Uttara North (Diabari), Mirpur-10, Farmgate
  const mrtStations = [
    { s: TRACK_LANDMARKS_S.MRT_UTTARA_NORTH_S, idx: 0 },
    { s: TRACK_LANDMARKS_S.MRT_MIRPUR_10_S, idx: 1 },
    { s: TRACK_LANDMARKS_S.MRT_FARMGATE_S, idx: 2 },
  ];
  for (const ms of mrtStations) {
    const p = sampleTrackPose(ms.s, 0);
    const st = buildMetroStation(textures, ms.idx);
    st.position.set(p.x, 0, p.z);
    st.rotation.y = p.yaw;
    root.add(st);
    landmarks.push({ midX: p.x, midZ: p.z, radiusSq: 360 * 360, group: st });
    addOrientedBuildingCollider(`Bld_mrt_esc_${ms.idx}_L`, ms.s - 6.6, -11.4, 1.25, 5.6);
    addOrientedBuildingCollider(`Bld_mrt_esc_${ms.idx}_R`, ms.s - 6.6, 11.4, 1.25, 5.6);
  }

  // 5h. Fuel Stations & Niloy Hero Showrooms
  for (const fs of fuelStations) {
    const prof = getRoadProfileAtS(fs.s);
    const p = sampleTrackPose(fs.s, -(prof.halfWidth + 0.6));
    const st = buildFuelStation(textures, true);
    st.position.set(p.x, 0, p.z);
    st.rotation.y = p.yaw;
    root.add(st);
    landmarks.push({ midX: p.x, midZ: p.z, radiusSq: 340 * 340, group: st });
  }

  for (const sr of showrooms) {
    const p = sampleTrackPose(sr.s, -10.2);
    const built = buildNiloyHeroShowroom(textures, true);
    built.group.position.set(p.x, 0, p.z);
    built.group.rotation.y = p.yaw;
    root.add(built.group);
    landmarks.push({ midX: p.x, midZ: p.z, radiusSq: 340 * 340, group: built.group });
    showroomDisplayBikes.push(...built.displayBikes);

    const cosY = Math.cos(p.yaw);
    const sinY = Math.sin(p.yaw);
    for (const st of built.attendants) {
      const wx = p.x + st.localX * cosY + st.localZ * sinY;
      const wz = p.z - st.localX * sinY + st.localZ * cosY;
      showroomStaff.push({
        rig: st.rig,
        worldX: wx,
        worldZ: wz,
        baseYaw: p.yaw + st.baseYaw,
        idx: showroomStaff.length,
      });
    }
    addOrientedBuildingCollider(`Bld_showroom_${sr.id}`, sr.s, -18.5, 4.9, 9.5);
  }

  // 5i. Directional Gantries across every iconic highway section in the 13.6 km loop
  const gantrySpecs = [
    { s: 96, texIdx: 0 },    // Tejgaon -> Mohakhali
    { s: 215, texIdx: 1 },   // Mohakhali Expressway Entry (Banani Exit / Airport)
    { s: 3470, texIdx: 3 },  // Kanchan Bridge -> Left 90° Dhaka Bypass N105
    { s: 6010, texIdx: 4 },  // Bhogra Dhaka Bypass -> Left 90° Gazipur Chourasta
    { s: 9700, texIdx: 5 },  // Board Bazar -> Uttara-Tongi Flyover
    { s: 11100, texIdx: 6 }, // Uttara -> Airport -> Diabari MRT-6
    { s: 12150, texIdx: 7 }, // MRT-6 Mirpur -> Farmgate -> Tejgaon
  ];
  for (const gs of gantrySpecs) {
    const p = sampleTrackPose(gs.s, 0);
    const gantry = buildHighwayDirectionGantry(textures.directionSigns[gs.texIdx]);
    gantry.position.set(p.x, 0, p.z);
    gantry.rotation.y = p.yaw;
    root.add(gantry);
    landmarks.push({ midX: p.x, midZ: p.z, radiusSq: 350 * 350, group: gantry });
  }

  // Extra Dhaka Bypass (N105) Portal Sign
  const bypassSignPose = sampleTrackPose(4300, 0);
  const bypassGantry = buildHighwayDirectionGantry(textures.dhakaBypassSign);
  bypassGantry.position.set(bypassSignPose.x, 0, bypassSignPose.z);
  bypassGantry.rotation.y = bypassSignPose.yaw;
  root.add(bypassGantry);
  landmarks.push({ midX: bypassSignPose.x, midZ: bypassSignPose.z, radiusSq: 350 * 350, group: bypassGantry });

  // 6. Signalized Intersections (5 well-spaced straight crossings)
  CROSS_INTERSECTION_S.forEach((is, idx) => {
    const prof = getRoadProfileAtS(is);
    const hw = prof.halfWidth;
    const p = sampleTrackPose(is, 0);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.yaw;

    const crossRoad = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 64, 13.5), cityAsphaltMat);
    crossRoad.rotation.x = -Math.PI / 2;
    crossRoad.position.set(0, 0.012, 0);
    crossRoad.receiveShadow = true;
    g.add(crossRoad);

    const ewDashMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const ewEdgeMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    for (const side of [-1, 1]) {
      for (const zEdge of [-6.35, 6.35]) {
        const edge = new THREE.Mesh(new THREE.PlaneGeometry(26, 0.24), ewEdgeMat);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(side * (hw + 14.5), 0.016, zEdge);
        g.add(edge);
      }
      for (let dx = hw + 4.5; dx <= hw + 24.5; dx += 8) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.24), ewDashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(side * dx, 0.017, 0);
        g.add(dash);
      }
    }

    for (const zOff of [-8.2, 8.2]) {
      const zebra = new THREE.Mesh(
        new THREE.PlaneGeometry(hw * 1.9, 4.2),
        new THREE.MeshStandardMaterial({
          map: textures.zebra,
          roughness: 0.8,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        })
      );
      zebra.rotation.x = -Math.PI / 2;
      zebra.position.set(0, 0.02, zOff);
      zebra.receiveShadow = true;
      g.add(zebra);
    }

    const nsRigSouth = buildTrafficLight();
    nsRigSouth.group.position.set(-hw - 0.55, 0, 7.2);
    g.add(nsRigSouth.group);

    const nsRigNorth = buildTrafficLight();
    nsRigNorth.group.position.set(hw + 0.55, 0, -7.2);
    nsRigNorth.group.rotation.y = Math.PI;
    g.add(nsRigNorth.group);

    const ewRigWest = buildTrafficLight();
    ewRigWest.group.position.set(-hw - 1.6, 0, -7.3);
    ewRigWest.group.rotation.y = -Math.PI / 2;
    g.add(ewRigWest.group);

    const ewRigEast = buildTrafficLight();
    ewRigEast.group.position.set(hw + 1.6, 0, 7.3);
    ewRigEast.group.rotation.y = Math.PI / 2;
    g.add(ewRigEast.group);

    root.add(g);
    landmarks.push({ midX: p.x, midZ: p.z, radiusSq: 350 * 350, group: g });

    intersections.push({
      s: is,
      cx: p.x,
      cz: p.z,
      tx: p.tx,
      tz: p.tz,
      nx: p.nx,
      nz: p.nz,
      yaw: p.yaw,
      nsLightRigs: [nsRigSouth, nsRigNorth],
      ewLightRigs: [ewRigWest, ewRigEast],
      nsPhase: 'GREEN',
      ewPhase: 'RED',
      cycleOffset: idx * 4.5,
      violatedThisPass: false,
      bonusAwardedThisPass: false,
    });

    const crossLimit = hw + 26;
    crossLanes.push(
      { id: `ew_east_${idx}`, interIdx: idx, s: is, latStart: -crossLimit, latEnd: crossLimit, dirLat: 1, sOffset: 3.0, isSignalized: true },
      { id: `ew_west_${idx}`, interIdx: idx, s: is, latStart: -crossLimit, latEnd: crossLimit, dirLat: -1, sOffset: -3.0, isSignalized: true }
    );
  });

  // 7. Continuous Curved/Straight Track Chunks (160 chunks across 13.6 km loop)
  const chunkCount = 160;
  const chunkLen = TRACK_LOOP_LENGTH / chunkCount; // ~85.08m per chunk

  for (let c = 0; c < chunkCount; c++) {
    const startS = c * chunkLen;
    const endS = Math.min(TRACK_LOOP_LENGTH, (c + 1) * chunkLen);
    const midS = (startS + endS) * 0.5;
    const midPose = sampleTrackPose(midS, 0);
    const midProf = getRoadProfileAtS(midS);
    const seg = TRACK_SEGMENTS[findSegmentIndexAtS(midS)];
    const step = seg.kind === 'arc' ? 4 : 14;

    const cg = new THREE.Group();

    // 7a. Road Surface Ribbons:
    // - Purbachal 300ft: Dual 4-lane Expressways + Landscaped Central Tree Island + Service Separator Tree Islands + 2-lane Service Roads!
    // - Standard & Dhaka Bypass: Flared dynamic width road ribbon
    if (midProf.kind === 'purbachal_300ft') {
      // Split at transitions smoothly using dynamic lateral callbacks
      const expInnerFn = (s: number) => getRoadProfileAtS(s).medianHalfWidth;
      const expOuterFn = (s: number) => {
        const p = getRoadProfileAtS(s);
        return Math.min(p.halfWidth, p.hasServiceSeparators ? 17.5 : p.halfWidth);
      };

      // Left (keep-left forward) & Right (oncoming) 4-lane express carriageways
      const leftExp = new THREE.Mesh(
        buildTrackRibbonGeometry(startS, endS, (s) => -expOuterFn(s), (s) => -expInnerFn(s), 0.0, step, 1 / 72),
        express300Mat
      );
      leftExp.receiveShadow = true;
      const rightExp = new THREE.Mesh(
        buildTrackRibbonGeometry(startS, endS, expInnerFn, expOuterFn, 0.0, step, 1 / 72),
        express300Mat
      );
      rightExp.receiveShadow = true;
      cg.add(leftExp, rightExp);

      // Raised Green Central Median Island INSIDE the road (10.4m wide at full flare, split cleanly off bridges!)
      addSplitRaisedTrackStrips(
        cg,
        startS,
        endS,
        0,
        (s) => Math.max(1.2, getRoadProfileAtS(s).medianHalfWidth * 2),
        -0.01,
        0.15,
        islandTurfMat,
        step
      );

      // Crisp concrete edge curbs on both sides of the central green island (split cleanly off bridges!)
      for (const side of [-1, 1] as const) {
        addSplitRaisedTrackStrips(
          cg,
          startS,
          endS,
          (s) => side * Math.max(0.55, getRoadProfileAtS(s).medianHalfWidth - 0.16),
          0.34,
          0.0,
          0.22,
          islandCurbMat,
          step
        );
      }

      // Outer Service Roads (2-lane per side) + Green Tree Separator Strips (3m wide) where flared
      const full300Start = Math.max(startS, 1020);
      const full300End = Math.min(endS, 3210);
      if (full300End > full300Start + 0.5) {
        for (const side of [-1, 1] as const) {
          const svcLatInner = side === -1 ? -27.5 : 20.5;
          const svcLatOuter = side === -1 ? -20.5 : 27.5;
          const svcMesh = new THREE.Mesh(
            buildTrackRibbonGeometry(full300Start, full300End, svcLatInner, svcLatOuter, 0.0, step, 1 / 68),
            service300Mat
          );
          svcMesh.receiveShadow = true;
          cg.add(svcMesh);

          // 3m wide Green Tree Separator Strip INSIDE the 300ft highway (lat = ±19.0, clipped off Balu Bridge!)
          addSplitRaisedTrackStrips(
            cg,
            full300Start,
            full300End,
            side * 19.0,
            3.0,
            -0.01,
            0.15,
            islandTurfMat,
            step
          );
          addSplitRaisedTrackStrips(cg, full300Start, full300End, side * 17.65, 0.28, 0.0, 0.22, islandCurbMat, step);
          addSplitRaisedTrackStrips(cg, full300Start, full300End, side * 20.35, 0.28, 0.0, 0.22, islandCurbMat, step);
        }
      }
    } else {
      const roadMesh = new THREE.Mesh(
        buildTrackRibbonGeometry(
          startS,
          endS,
          (s) => -getRoadProfileAtS(s).halfWidth,
          (s) => getRoadProfileAtS(s).halfWidth,
          0.0,
          step,
          1 / 80
        ),
        roadMat
      );
      roadMesh.receiveShadow = true;
      cg.add(roadMesh);

      // Dhaka Bypass N105 gets a continuous green tree median strip inside the highway too (clipped off Kanchan Bridge!)
      if (midProf.kind === 'dhaka_bypass') {
        addSplitRaisedTrackStrips(
          cg,
          startS,
          endS,
          0,
          (s) => Math.max(1.2, getRoadProfileAtS(s).medianHalfWidth * 2),
          -0.01,
          0.14,
          islandTurfMat,
          step
        );
      }
    }

    // 7b. Local Ground Verge Ribbon (±78m around track, split cleanly around river channels)
    let cursorS = startS;
    for (const rv of TRACK_RIVER_SPANS) {
      if (rv.endS <= cursorS || rv.startS >= endS) continue;
      if (rv.startS > cursorS) {
        const gm = new THREE.Mesh(
          buildTrackRibbonGeometry(cursorS, Math.min(rv.startS, endS), -78, 78, -0.05, step, 1 / 80),
          groundMat
        );
        gm.receiveShadow = true;
        cg.add(gm);
      }
      cursorS = Math.max(cursorS, Math.min(rv.endS, endS));
    }
    if (cursorS < endS) {
      const gm = new THREE.Mesh(
        buildTrackRibbonGeometry(cursorS, endS, -78, 78, -0.05, step, 1 / 80),
        groundMat
      );
      gm.receiveShadow = true;
      cg.add(gm);
    }

    // 7c. Raised Sidewalks flanking highway outer edge (avoiding rivers, intersections, showrooms, pumps, Gazipur)
    for (const side of [-1, 1] as const) {
      const stepSw = 8;
      for (let ss = startS; ss < endS; ss += stepSw) {
        const subEnd = Math.min(endS, ss + stepSw);
        const subMid = (ss + subEnd) * 0.5;
        if (isSInAnyRiver(subMid, 1)) continue;
        if (CROSS_INTERSECTION_S.some((is) => Math.abs(shortestTrackDeltaS(subMid, is)) < 9.5)) continue;
        if (Math.abs(shortestTrackDeltaS(subMid, TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S)) < 16) continue;
        if (
          side === -1 &&
          (fuelStations.some((fs) => Math.abs(shortestTrackDeltaS(subMid, fs.s)) < 11.6) ||
            showrooms.some((sr) => Math.abs(shortestTrackDeltaS(subMid, sr.s)) < 11.6))
        ) {
          continue;
        }
        cg.add(
          buildRaisedTrackStrip(
            ss,
            subEnd,
            (s) => side * (getRoadProfileAtS(s).halfWidth + 1.6),
            3.2,
            -0.01,
            0.1,
            sidewalkMat,
            step
          )
        );
      }
    }

    // 7d. Center Median Elements:
    // - On Purbachal 300ft & Dhaka Bypass: DENSE Krishnachura, Palms & flowering shrubs INSIDE the center & separator islands!
    // - On Standard Dhaka urban roads: yellow/green concrete median dividers
    if (midProf.kind === 'purbachal_300ft') {
      // Dense trees & shrubs every 10m INSIDE the 300ft Central Green Island
      for (let ts = startS + 5; ts < endS - 2; ts += 10) {
        if (isSInAnyRiver(ts, 8)) continue;
        if (Math.abs(shortestTrackDeltaS(ts, TRACK_LANDMARKS_S.PURBACHAL_ARCH_S)) < 12) continue;
        if (Math.abs(shortestTrackDeltaS(ts, TRACK_LANDMARKS_S.NEELA_MARKET_S)) < 14) continue;

        const p = getRoadProfileAtS(ts);
        // Central spine Palm or Flame Krishnachura
        sampleTrackPose(ts, 0, poseTmp);
        const centerTree =
          Math.floor(ts / 10) % 2 === 0 ? createKrishnachuraTree(1.05, true) : createPalmTree(1.12);
        centerTree.position.set(poseTmp.x, 0.14, poseTmp.z);
        cg.add(centerTree);

        // Extra staggered inner-island trees & bushes when center median is wide (full 10.4m flare)
        if (p.medianHalfWidth >= 4.2) {
          for (const subSide of [-1, 1] as const) {
            sampleTrackPose(ts + 4.5, subSide * 2.6, poseTmp);
            const subItem =
              (Math.floor(ts) + subSide) % 3 === 0
                ? createPalmTree(0.95)
                : createMedianShrub(1.05);
            subItem.position.set(poseTmp.x, 0.14, poseTmp.z);
            cg.add(subItem);
          }
        }
      }

      // Trees & shrubs every 13m INSIDE Left & Right Service Separator Medians (lat = ±19.0)
      for (let ts = startS + 7; ts < endS - 2; ts += 13) {
        if (isSInAnyRiver(ts, 8)) continue;
        const p = getRoadProfileAtS(ts);
        if (!p.hasServiceSeparators) continue;
        for (const side of [-1, 1] as const) {
          sampleTrackPose(ts, side * 19.0, poseTmp);
          const sepTree =
            (Math.floor(ts) + (side > 0 ? 1 : 0)) % 2 === 0
              ? createPalmTree(1.02)
              : createKrishnachuraTree(0.92, (Math.floor(ts) % 3) !== 0);
          sepTree.position.set(poseTmp.x, 0.14, poseTmp.z);
          cg.add(sepTree);
        }
      }

      // Dual-arm center highway streetlamps every 36m
      for (let ls = startS + 16; ls < endS - 4; ls += 36) {
        if (isSInAnyRiver(ls, 8)) continue;
        sampleTrackPose(ls, 0, poseTmp);
        const dLamp = createDualArmMedianLamp();
        dLamp.position.set(poseTmp.x, 0.14, poseTmp.z);
        dLamp.rotation.y = poseTmp.yaw;
        cg.add(dLamp);
      }
    } else if (midProf.kind === 'dhaka_bypass') {
      // Dhaka Bypass N105: lush tree-planted median every 14m
      for (let ts = startS + 7; ts < endS - 2; ts += 14) {
        if (isSInAnyRiver(ts, 8)) continue;
        if (CROSS_INTERSECTION_S.some((is) => Math.abs(shortestTrackDeltaS(ts, is)) < 14)) continue;
        sampleTrackPose(ts, 0, poseTmp);
        const tree =
          Math.floor(ts / 14) % 2 === 0 ? createPalmTree(1.0) : createKrishnachuraTree(0.88, false);
        tree.position.set(poseTmp.x, 0.14, poseTmp.z);
        cg.add(tree);
      }
    } else {
      // Standard Dhaka arterial concrete median blocks
      for (let ms = startS + 6; ms < endS - 4; ms += 16) {
        if (isSInAnyRiver(ms, 6)) continue;
        if (CROSS_INTERSECTION_S.some((is) => Math.abs(shortestTrackDeltaS(ms, is)) < 14)) continue;
        if (Math.abs(shortestTrackDeltaS(ms, TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S)) < 18) continue;
        sampleTrackPose(ms, 0, poseTmp);
        const mSeg = new THREE.Mesh(
          new THREE.BoxGeometry(GAME_CONFIG.MEDIAN_HALF_WIDTH * 2, 0.36, 11.5),
          Math.floor(ms / 16) % 2 === 0 ? medianMat : medianDarkMat
        );
        mSeg.position.set(poseTmp.x, 0.18, poseTmp.z);
        mSeg.rotation.y = poseTmp.yaw;
        mSeg.castShadow = true;
        mSeg.receiveShadow = true;
        cg.add(mSeg);
      }
    }

    // 7e. Elevated MRT Line-6 Viaduct along Diabari -> Uttara North -> Mirpur-10 -> Farmgate -> Bijoy Sarani (s ∈ [11750, 12990])
    const mrtStart = Math.max(startS, 11750);
    const mrtEnd = Math.min(endS, 12990);
    if (mrtEnd > mrtStart + 0.5) {
      cg.add(buildRaisedTrackStrip(mrtStart, mrtEnd, 0, 8.8, 6.2, 7.1, mrtConcreteMat, 5));
      for (const side of [-1, 1]) {
        cg.add(buildRaisedTrackStrip(mrtStart, mrtEnd, side * 4.25, 0.35, 7.1, 7.9, mrtConcreteMat, 5));
        cg.add(buildRaisedTrackStrip(mrtStart, mrtEnd, side * 4.25, 0.38, 7.35, 7.55, mrtStripMat, 5));
        for (const rOff of [-0.7, 0.7]) {
          cg.add(buildRaisedTrackStrip(mrtStart, mrtEnd, side * 1.65 + rOff, 0.12, 7.1, 7.22, mrtRailMat, 6));
        }
      }
      for (let ps = mrtStart + 10; ps < mrtEnd - 2; ps += 24) {
        if (CROSS_INTERSECTION_S.some((is) => Math.abs(shortestTrackDeltaS(ps, is)) < 14)) continue;
        sampleTrackPose(ps, 0, poseTmp);
        const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 6.2, 10), mrtBeamMat);
        pier.position.set(poseTmp.x, 3.1, poseTmp.z);
        pier.castShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.9, 2.2), mrtConcreteMat);
        cap.position.set(poseTmp.x, 6.1, poseTmp.z);
        cap.rotation.y = poseTmp.yaw;
        cg.add(pier, cap);
      }
    }

    // 7f. Streetlights, Outer Trees, Tong Stalls & Density-Aware Buildings
    for (let ps = startS + 14; ps < endS - 4; ps += 27) {
      if (isSInAnyRiver(ps, 8)) continue;
      const pProf = getRoadProfileAtS(ps);
      const nearCross = CROSS_INTERSECTION_S.some((is) => Math.abs(shortestTrackDeltaS(ps, is)) < 16);
      const nearPlaza = Math.abs(shortestTrackDeltaS(ps, TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S)) < 18;
      const nearStation = mrtStations.some((ms) => Math.abs(shortestTrackDeltaS(ps, ms.s)) < 18);
      const nearPump = fuelStations.some((fs) => Math.abs(shortestTrackDeltaS(ps, fs.s)) < 16);
      const nearShowroom = showrooms.some((sr) => Math.abs(shortestTrackDeltaS(ps, sr.s)) < 18);
      const nearNeela = Math.abs(shortestTrackDeltaS(ps, TRACK_LANDMARKS_S.NEELA_MARKET_S)) < 24;
      const nearMohakhali = Math.abs(shortestTrackDeltaS(ps, TRACK_LANDMARKS_S.MOHAKHALI_TERMINAL_S)) < 22;
      const nearBananiRamp = ps >= 445 && ps <= 602;
      const nearCantonmentOrNavyOrKurilRamp = ps >= 624 && ps <= 758;
      const nearHospitalRight = ps >= 690 && ps <= 732;
      const nearBashundharaRight = ps >= TRACK_LANDMARKS_S.BASHUNDHARA_RA_S - 38 && ps <= TRACK_LANDMARKS_S.BASHUNDHARA_RA_S + 38;

      if (!nearCross && !nearPlaza && !nearShowroom) {
        for (const side of [-1, 1] as const) {
          if (side === -1 && (nearPump || nearBananiRamp || nearCantonmentOrNavyOrKurilRamp)) continue;
          if (side === 1 && nearHospitalRight) continue;
          sampleTrackPose(ps, side * (pProf.halfWidth + 1.15), poseTmp);
          if (isNearAirportOrKurilInterchange(poseTmp.x, poseTmp.z) && ps > 730) continue;
          const lamp = createStreetLamp(
            textures.jokeSigns[(c * 3 + Math.floor(ps) + (side < 0 ? 5 : 0)) % textures.jokeSigns.length],
            side
          );
          lamp.position.set(poseTmp.x, 0, poseTmp.z);
          lamp.rotation.y = poseTmp.yaw;
          cg.add(lamp);
        }
      }

      // Outer roadside trees (+ dense Purbachal outer green groves when buildingDensity === 'open_green')
      if (!nearCross && !nearPlaza && !nearStation && !nearPump && !nearShowroom && !nearNeela) {
        for (const side of [-1, 1] as const) {
          if (side === -1 && (nearMohakhali || nearBananiRamp || nearCantonmentOrNavyOrKurilRamp)) continue;
          if (side === 1 && (nearHospitalRight || nearBashundharaRight)) continue;
          sampleTrackPose(ps + 8, side * (pProf.halfWidth + 3.2), poseTmp);
          if (isNearAirportOrKurilInterchange(poseTmp.x, poseTmp.z) && ps > 730) continue;
          const tree =
            pProf.kind === 'purbachal_300ft'
              ? (Math.floor(ps) + side) % 2 === 0
                ? createPalmTree(1.12)
                : createKrishnachuraTree(1.05, true)
              : (Math.floor(ps) + (side > 0 ? 1 : 0)) % 2 === 0
                ? createKrishnachuraTree(1.0, true)
                : createPalmTree(0.95);
          tree.position.set(poseTmp.x, 0.1, poseTmp.z);
          cg.add(tree);

          if (pProf.buildingDensity === 'open_green') {
            // Wide Purbachal lush green countryside groves instead of city concrete towers!
            sampleTrackPose(ps + 2, side * (pProf.halfWidth + 11.5), poseTmp);
            if (!isNearAirportOrKurilInterchange(poseTmp.x, poseTmp.z)) {
              const groveTree =
                (Math.floor(ps) + c) % 2 === 0
                  ? createKrishnachuraTree(1.22, (c + Math.floor(ps)) % 3 === 0)
                  : createPalmTree(1.2);
              groveTree.position.set(poseTmp.x, 0.0, poseTmp.z);
              cg.add(groveTree);
            }
          }
        }
      }

      // Buildings gated strictly by buildingDensity:
      // - 'open_green' (Purbachal 300ft): Only occasional sparse setback buildings far back at ±43m (plus Bashundhara R/A)
      // - 'sparse' (Dhaka Bypass N105): occasional (~14%) rural sheds/warehouses far back at ±28.5m
      // - 'urban': standard Dhaka cityscape along lat = ±21.5m
      if (!nearCross && !nearPlaza && !nearNeela && !nearStation) {
        const allowOpenGreenTower =
          pProf.buildingDensity === 'open_green' &&
          c % 5 === 2 &&
          ps - startS < 28 &&
          !nearBashundharaRight &&
          Math.abs(shortestTrackDeltaS(ps, TRACK_LANDMARKS_S.PURBACHAL_ARCH_S)) > 40 &&
          !isSInAnyRiver(ps, 26);

        if (pProf.buildingDensity !== 'open_green' || allowOpenGreenTower) {
          for (const side of [-1, 1] as const) {
            if (side === -1 && (nearPump || nearShowroom || nearMohakhali || nearBananiRamp || nearCantonmentOrNavyOrKurilRamp)) continue;
            if (side === 1 && (nearHospitalRight || nearBashundharaRight)) continue;
            if (pProf.buildingDensity === 'open_green' && side !== (c % 2 === 0 ? 1 : -1)) continue;
            if (pProf.buildingDensity === 'sparse' && (c * 5 + Math.floor(ps) + (side > 0 ? 2 : 0)) % 7 !== 0) {
              continue;
            }

            const bldLat =
              side *
              (pProf.buildingDensity === 'open_green'
                ? 43.0
                : pProf.buildingDensity === 'sparse'
                  ? 28.5
                  : 21.5);
            sampleTrackPose(ps, bldLat, poseTmp);
            if (isNearAirportOrKurilInterchange(poseTmp.x, poseTmp.z)) continue;

            const subSeg = TRACK_SEGMENTS[findSegmentIndexAtS(ps)];
            if (subSeg.kind === 'arc' && ((subSeg.angleDir > 0 && side > 0) || (subSeg.angleDir < 0 && side < 0))) {
              continue;
            }

            const w = pProf.buildingDensity === 'sparse' ? 9.5 : 11.5;
            const h =
              pProf.buildingDensity === 'open_green'
                ? 15 + ((c * 3 + Math.floor(ps)) % 10)
                : pProf.buildingDensity === 'sparse'
                  ? 6 + ((c + Math.floor(ps)) % 4)
                  : 10 + ((c * 7 + Math.floor(ps) + (side > 0 ? 3 : 0)) % 12);
            const d = 16.0;
            const facadeTex =
              textures.buildingFacades[(c * 3 + (side > 0 ? 1 : 0) + Math.floor(ps)) % textures.buildingFacades.length];
            const signTex =
              textures.shopSigns[(c * 2 + (side > 0 ? 3 : 0) + Math.floor(ps)) % textures.shopSigns.length];
            const bld = createRoadsideBuilding(w, h, d, facadeTex, signTex, (c + Math.floor(ps)) % 2 === 0, -side);
            bld.position.set(poseTmp.x, 0, poseTmp.z);
            bld.rotation.y = poseTmp.yaw;
            cg.add(bld);
            addOrientedBuildingCollider(`Bld_c${c}_${Math.floor(ps)}_${side}`, ps, bldLat, w * 0.5, d * 0.5);
          }
        }
      }
    }

    // Perimeter Boundary Hedge / Guard Wall at dynamic ±perimeterLat
    if (!isSInAnyRiver(midS, 14) && midPose.segIdx % 2 === 0) {
      for (const side of [-1, 1] as const) {
        const wallMesh = buildRaisedTrackStrip(
          startS,
          endS,
          (s) => side * getRoadProfileAtS(s).perimeterLat,
          0.95,
          0,
          1.9,
          perimeterWallMat,
          step
        );
        cg.add(wallMesh);
      }
    }

    // Occasional roadside Tong Tea Stalls (skip 300ft), Funny Signs & Safety Hoardings
    if (!isSInAnyRiver(midS, 16) && !CROSS_INTERSECTION_S.some((is) => Math.abs(shortestTrackDeltaS(midS, is)) < 26)) {
      const nearBananiChunk = midS >= 440 && midS <= 605;
      if (
        midProf.buildingDensity !== 'open_green' &&
        c % 2 === 0 &&
        !nearBananiChunk &&
        Math.abs(shortestTrackDeltaS(midS, TRACK_LANDMARKS_S.NEELA_MARKET_S)) > 35
      ) {
        const side = c % 4 === 0 ? 1 : -1;
        sampleTrackPose(midS + 10, side * (midProf.halfWidth + 3.4), poseTmp);
        if (!isNearAirportOrKurilInterchange(poseTmp.x, poseTmp.z)) {
          const tong = buildTongStall(textures, c);
          tong.position.set(poseTmp.x, 0.08, poseTmp.z);
          tong.rotation.y = poseTmp.yaw + (side > 0 ? Math.PI : 0);
          cg.add(tong);
        }
      }

      const signProf = getRoadProfileAtS(startS + 20);
      const signPose = sampleTrackPose(startS + 20, -signProf.halfWidth - 1.35);
      if (!nearBananiChunk && !isNearAirportOrKurilInterchange(signPose.x, signPose.z)) {
        const sign = createFunnyRoadSign(textures.roadSigns[c % textures.roadSigns.length], 0.32);
        sign.position.set(signPose.x, 0.1, signPose.z);
        sign.rotation.y = signPose.yaw;
        cg.add(sign);
      }

      if (c % 3 === 1) {
        const sloganProf = getRoadProfileAtS(endS - 18);
        const sloganPose = sampleTrackPose(endS - 18, sloganProf.halfWidth + 1.4);
        if (!isNearAirportOrKurilInterchange(sloganPose.x, sloganPose.z)) {
          const slogan = createAccidentSloganHoarding(textures.accidentSloganSign, -0.35);
          slogan.position.set(sloganPose.x, 0.1, sloganPose.z);
          slogan.rotation.y = sloganPose.yaw;
          cg.add(slogan);
        }
      }
    }

    root.add(cg);
    chunks.push({
      index: c,
      startS,
      endS,
      midX: midPose.x,
      midZ: midPose.z,
      group: cg,
    });
  }

  const phaseCycle = 17.0;

  return {
    root,
    metroTrain,
    chunks,
    landmarks,
    intersections,
    solidBuildings,
    fuelStations,
    showrooms,
    crossLanes,
    isOnArterySidewalk: (s: number, lat: number) => {
      if (isSInAnyRiver(s, 1)) return false;
      if (CROSS_INTERSECTION_S.some((is) => Math.abs(shortestTrackDeltaS(s, is)) < 9.5)) return false;
      const hw = getRoadProfileAtS(s).halfWidth;
      const absLat = Math.abs(lat);
      return absLat >= hw + 0.15 && absLat <= hw + 3.1;
    },
    updateAroundPlayer: (playerX: number, playerZ: number, elapsedSec: number, forceSalute = false) => {
      const cullSq = 400 * 400;
      for (const ch of chunks) {
        const dx = playerX - ch.midX;
        const dz = playerZ - ch.midZ;
        ch.group.visible = dx * dx + dz * dz < cullSq;
      }

      for (const lm of landmarks) {
        const dx = playerX - lm.midX;
        const dz = playerZ - lm.midZ;
        lm.group.visible = dx * dx + dz * dz < lm.radiusSq;
      }

      // Animate MRT-6 Metro Train cruising smoothly North-South along Leg 7 (X=-641.35, Z=-920..-60)
      metroTrain.position.set(-641.35, 7.55, -492 + Math.sin(elapsedSec * 0.16) * 410);
      metroTrain.rotation.y = Math.cos(elapsedSec * 0.16) >= 0 ? Math.PI : 0;

      for (const inter of intersections) {
        const t = (elapsedSec + inter.cycleOffset) % phaseCycle;
        let nsPhase: TrafficLightPhase = 'GREEN';
        let ewPhase: TrafficLightPhase = 'RED';

        if (t < 7.5) {
          nsPhase = 'GREEN';
          ewPhase = 'RED';
        } else if (t < 9.5) {
          nsPhase = 'YELLOW';
          ewPhase = 'RED';
        } else if (t < 15.0) {
          nsPhase = 'RED';
          ewPhase = 'GREEN';
        } else {
          nsPhase = 'RED';
          ewPhase = 'YELLOW';
        }

        inter.nsPhase = nsPhase;
        inter.ewPhase = ewPhase;

        for (const rig of inter.nsLightRigs) {
          rig.setPhase(nsPhase);
        }
        for (const rig of inter.ewLightRigs) {
          rig.setPhase(ewPhase);
        }
      }

      // Gently bob Bangladeshi boats on Balu, Shitalakshya, and Turag rivers
      for (let i = 0; i < allRiverBoats.length; i++) {
        const boat = allRiverBoats[i];
        boat.position.y = -1.12 + Math.sin(elapsedSec * 1.9 + i * 1.4) * 0.08;
        boat.rotation.z = Math.sin(elapsedSec * 1.3 + i * 2.1) * 0.035;
      }

      // Spin showcase hero bikes inside Niloy Hero Showrooms
      for (let i = 0; i < showroomDisplayBikes.length; i++) {
        showroomDisplayBikes[i].rotation.y = elapsedSec * 0.85 + i * 1.2;
      }

      // Showroom attendants: turn toward the player and salute smartly when rider approaches!
      for (const st of showroomStaff) {
        const dx = playerX - st.worldX;
        const dz = playerZ - st.worldZ;
        const dist = Math.hypot(dx, dz);
        const nearShowroom = forceSalute || dist < 34;

        if (nearShowroom) {
          const targetWorldYaw = Math.atan2(dx, dz);
          st.rig.group.rotation.y = targetWorldYaw - st.baseYaw;
          st.rig.saluteIntensity = Math.min(1, st.rig.saluteIntensity + 0.14);
        } else {
          st.rig.group.rotation.y = 0;
          st.rig.saluteIntensity = Math.max(0, st.rig.saluteIntensity - 0.1);
        }

        const k = st.rig.saluteIntensity;
        if (k > 0.01) {
          st.rig.headGroup.rotation.x = Math.sin(elapsedSec * 4.5 + st.idx) * 0.06 * k;
          st.rig.rightArmPivot.rotation.x = -1.18 * k;
          st.rig.rightArmPivot.rotation.z = (-0.52 + Math.sin(elapsedSec * 6.5 + st.idx) * 0.04) * k;
          st.rig.rightForearmPivot.rotation.x = -1.35 * k;
          st.rig.rightForearmPivot.rotation.z = 0.65 * k;
          st.rig.leftArmPivot.rotation.x = 0.08 * k;
        } else {
          st.rig.headGroup.rotation.x = 0;
          st.rig.rightArmPivot.rotation.x = Math.sin(elapsedSec * 1.4 + st.idx) * 0.05;
          st.rig.rightArmPivot.rotation.z = 0;
          st.rig.rightForearmPivot.rotation.x = 0;
          st.rig.rightForearmPivot.rotation.z = 0;
          st.rig.leftArmPivot.rotation.x = -Math.sin(elapsedSec * 1.4 + st.idx) * 0.05;
        }
      }
    },
  };
}
