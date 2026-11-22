import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameAudio } from './audio';
import {
  buildCollectiblePickup,
  buildHeroMotorcycle,
  buildPedestrian,
  buildSlapper,
  buildTrafficVehicle,
  type HeroBikeRig,
  type PedestrianRig,
  type PickupKind,
  type SlapperRig,
  type TrafficModelRig,
} from './models';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import {
  ELEVATED_EXPRESSWAY_DEF,
  KURIL_300FT_RAMP_DEF,
  TRACK_LANDMARKS_S,
  TRACK_LOOP_LENGTH,
  TRACK_RIVER_SPANS,
  TRACK_SEGMENTS,
  UTTARA_TONGI_FLYOVER_DEF,
  findSegmentIndexAtS,
  forwardTrackDistanceS,
  getRoadProfileAtS,
  getTrafficLaneLat,
  getTurnCueForRider,
  getZoneLabelForTrack,
  isSInAnyRiver,
  projectToKurilRamp,
  projectToTrack,
  sampleBananiDownRamp,
  sampleExpresswayMainHeight,
  sampleTrackPose,
  sampleUttaraFlyoverHeight,
  shortestTrackDeltaS,
  wrapTrackS,
  type TrackLayer,
  type TrackPose,
  type TrackProjection,
} from './track';
import {
  BIKE_ORDER,
  BIKE_SPECS,
  FUNNY_BENGALI_MESSAGES,
  FUNNY_DEATH_LINES_BN,
  GAME_CONFIG,
  GAME_OVER_PUBLIC_ROASTS_BN,
  GameState,
  VEHICLE_SPECS,
  type BikeSpec,
  type BikeTierId,
  type EventPopup,
  type HudMission,
  type HudSnapshot,
  type InputState,
  type VehicleKind,
} from './types';
import {
  buildDhakaWorld,
  CROSS_INTERSECTION_S,
  type CrossStreetLane,
  type DhakaWorld,
  type FuelStationNode,
  type ShowroomNode,
} from './world';

interface TrafficEntity {
  id: number;
  isCityVehicle: boolean;
  isExpresswayVehicle: boolean;
  isPurbachalTraffic?: boolean;
  kind: VehicleKind;
  rig: TrafficModelRig;
  x: number;
  y: number;
  z: number;
  s: number;
  lat: number;
  layer: TrackLayer;
  yaw: number;
  dirX: number;
  dirZ: number;
  laneIdx: number; // artery lane index or crossLanes index
  slotNorm: number; // 0..1 sub-lane spread across multi-lane 300ft / Bypass / standard roads
  baseSpeed: number;
  currentSpeed: number;
  targetSpeed: number;
  frozen: boolean;
  wrecked: boolean;
  wreckTimer: number;
  nearMissedThisPass: boolean;
  hitCooldown: number;
  lookaheadTimer: number;
}

type PedMode = 'sidewalk' | 'crossing' | 'fleeing' | 'chasing' | 'knocked';

interface PedestrianEntity {
  rig: PedestrianRig;
  x: number;
  z: number;
  s: number;
  lat: number;
  homeS: number;
  homeLat: number;
  isCrosswalk: boolean;
  interIdx: number;
  dir: number;
  walkSpeed: number;
  walkPhase: number;
  mode: PedMode;
  angerTimer: number;
  knockTimer: number;
  knockVx: number;
  knockVy: number;
  knockVz: number;
}

interface Particle {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  startScale: number;
  endScale: number;
}

interface DebrisPiece {
  mesh: THREE.Mesh;
  active: boolean;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
}

interface PickupEntity {
  id: number;
  kind: PickupKind;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  s: number;
  lat: number;
  layer: TrackLayer;
  respawnTimer: number;
  phase: number;
}

type MissionKind = 'smash' | 'ruleBreak' | 'pickup' | 'nearMiss' | 'highSpeed';

interface MissionTemplate {
  kind: MissionKind;
  titleBn: string;
  target: number;
  reward: number;
}

const MISSION_TEMPLATES: readonly MissionTemplate[] = [
  { kind: 'smash', titleBn: 'গাড়ি চুরমার করুন', target: 4, reward: 500 },
  { kind: 'ruleBreak', titleBn: 'নিয়ম / লাল বাতি ভাঙুন', target: 2, reward: 600 },
  { kind: 'pickup', titleBn: 'কয়েন / তেল পিকআপ নিন', target: 4, reward: 550 },
  { kind: 'highSpeed', titleBn: '১৩০+ km/h গতিতে ৩ সে.', target: 3, reward: 700 },
  { kind: 'nearMiss', titleBn: 'কাছাকাছি কাট (Near Miss)', target: 4, reward: 650 },
  { kind: 'smash', titleBn: 'মহা-তাণ্ডব: গাড়ি চুরমার', target: 8, reward: 1000 },
];

// Pre-allocated math helpers (Zero GC in render loop)
const _camTarget = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _exhaustWorldPos = new THREE.Vector3();
const _fuelPortWorldPos = new THREE.Vector3();
const _hoseStart = new THREE.Vector3();
const _hoseMid = new THREE.Vector3();
const _hoseDir = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _poseTmp: TrackPose = { x: 0, z: 0, tx: 0, tz: -1, nx: 1, nz: 0, yaw: 0, segIdx: 0 };
const _trackProj: TrackProjection = {
  s: 0,
  lat: 0,
  distSq: 0,
  x: 0,
  z: 0,
  tx: 0,
  tz: -1,
  nx: 1,
  nz: 0,
  yaw: 0,
  segIdx: 0,
};

function shortestAngleDiff(target: number, current: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function pickWeightedKind(isCity: boolean, bikeTier: 1 | 2 | 3 = 1): VehicleKind {
  const entries = Object.entries(VEHICLE_SPECS) as [VehicleKind, (typeof VEHICLE_SPECS)[VehicleKind]][];
  let total = 0;
  for (const [, spec] of entries) {
    let w = isCity ? spec.cityWeight : spec.arteryWeight;
    if (!isCity && bikeTier >= 2 && spec.smashRank >= 2) {
      w *= bikeTier === 3 ? 1.55 : 1.3;
    }
    total += w;
  }
  let r = Math.random() * total;
  for (const [kind, spec] of entries) {
    let w = isCity ? spec.cityWeight : spec.arteryWeight;
    if (w <= 0) continue;
    if (!isCity && bikeTier >= 2 && spec.smashRank >= 2) {
      w *= bikeTier === 3 ? 1.55 : 1.3;
    }
    r -= w;
    if (r <= 0) return kind;
  }
  return 'cng';
}

function pickArteryLaneForKind(kind: VehicleKind): number {
  const spec = VEHICLE_SPECS[kind];
  if (kind === 'cycle' || kind === 'rickshaw' || kind === 'vangari') {
    return Math.random() < 0.84 ? (Math.random() < 0.5 ? 0 : 3) : Math.floor(Math.random() * 4);
  }
  if (spec.tier === 'large') {
    return Math.random() < 0.78 ? (Math.random() < 0.5 ? 1 : 2) : Math.floor(Math.random() * 4);
  }
  return Math.floor(Math.random() * 4);
}

export class HeroRastarEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private isSoftwareGl: boolean;
  private textures: ProceduralTextureSet;
  private world: DhakaWorld;
  private heroRig: HeroBikeRig;
  private slapperRig: SlapperRig;
  private fuelHoseGroup: THREE.Group;
  private hoseSegA: THREE.Mesh;
  private hoseSegB: THREE.Mesh;
  private audio = new GameAudio();

  private traffic: TrafficEntity[] = [];
  private pedestrians: PedestrianEntity[] = [];
  private pickups: PickupEntity[] = [];
  private particles: Particle[] = [];
  private debris: DebrisPiece[] = [];
  private debrisCursor = 0;

  private input: InputState = {
    accelerate: false,
    brake: false,
    reverse: false,
    left: false,
    right: false,
    boost: false,
    handbrake: false,
    horn: false,
  };
  private keyboardInput: InputState = { ...this.input };
  private touchInput: InputState = { ...this.input };
  private commaSteer = false;
  private periodSteer = false;

  // Player Physics State along closed Dhaka track loop
  private gameState: GameState = GameState.MENU;
  private playerX = -3.25;
  private playerY = 0;
  private playerZ = -18;
  private playerS = 18;
  private playerLat = -3.25;
  private playerSegHint = 0;
  private playerLayer: TrackLayer = 'surface';
  private playerSlopeRad = 0;
  private playerYaw = 0; // 0 = -Z (North)
  private forwardSpeed = 0; // m/s along bike forward vector
  private lateralSlip = 0;
  private smoothedSteer = 0;
  private bikeLean = 0;
  private bikePitch = 0;
  private bikeRollCrash = 0;
  private postHitRecoveryTimer = 0;
  private wasBoosting = false;
  private freeNitroTimer = 0;

  // Fuel & Hose
  private fuelAmount = 100;
  private emptyStoppedTimer = 0;
  private refuelBonusGiven = false;
  private refuelSafeGraceTimer = 0;
  private refuelShieldUsedThisStop = false;

  // Showroom & Bike Progression
  private heroBankScore = 0;
  private unlockedBikes: BikeTierId[] = ['glamour_125'];
  private equippedBikeId: BikeTierId = 'glamour_125';
  private showroomReturnState: GameState = GameState.MENU;
  private showroomExitCooldown = 0;
  private showroomVisitedLock = false;
  private showroomSaluteLock = false;
  private milestone100kShown = false;
  private milestone200kShown = false;
  private bankSaveAccum = 0;

  // Score, Combo, Pickups & Live Micro-Missions
  private score = 0;
  private bestScore = 0;
  private isNewBest = false;
  private combo = 1;
  private comboTimer = 0;
  private distanceMeters = 0;
  private lapCount = 1;
  private wrecksCount = 0;
  private pedKnockCount = 0;
  private nearMissCount = 0;
  private ruleBreakCount = 0;
  private collectiblesCount = 0;
  private violationPenaltyAccum = 0;
  private ruleBreakSecondAccum = 0;

  private missionIdx = 0;
  private missionLoop = 0;
  private missionProgress = 0;
  private highSpeedSecAccum = 0;

  private activeViolation: string | null = null;
  private violationTimer = 0;
  private funnyMessage: string | null = null;
  private funnyDisplayTimer = 0;
  private funnyCooldownTimer = 3.5;
  private lastFunnyIdx = -1;

  private latestPopup: EventPopup | null = null;
  private popupSeq = 0;
  private popupTimer = 0;
  private screenFlashTone: 'none' | 'red' | 'amber' | 'green' = 'none';
  private screenFlashTimer = 0;

  // Crash & Scripted Slapper Sequence
  private gameOverReasonBn = '';
  private gameOverReasonEn = '';
  private gameOverRoastsBn: string[] = [];
  private crashTimer = 0;
  private slapTriggered = false;
  private hitstopTimer = 0;
  private cameraShake = 0;

  private elapsedSec = 0;
  private exhaustAccumulator = 0;
  private ambientHornTimer = 3.5;
  private hudEmitAccumulator = 0;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private frameId = 0;
  private lastTimeMs = 0;
  private disposed = false;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.bestScore = this.loadBestScore();
    this.heroBankScore = this.loadHeroBank();
    this.unlockedBikes = this.loadUnlockedBikes();
    this.equippedBikeId = this.loadEquippedBike(this.unlockedBikes);
    this.fuelAmount = BIKE_SPECS[this.equippedBikeId].fuelCapacity;
    this.milestone100kShown = this.heroBankScore >= 100000 || this.unlockedBikes.includes('xtreme_160r');
    this.milestone200kShown = this.heroBankScore >= 200000 || this.unlockedBikes.includes('karizma_210');

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc);
    this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0017);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const aspect = (container.clientWidth || window.innerWidth) / Math.max(container.clientHeight || window.innerHeight, 1);
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.2, 420);

    // Bright tropical Dhaka daylight rig (1 shadow caster)
    const hemi = new THREE.HemisphereLight(0xbfe8ff, 0x4d7c0f, 1.05);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4d6, 2.25);
    sun.position.set(28, 46, 22);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 140;
    sun.shadow.camera.left = -36;
    sun.shadow.camera.right = 36;
    sun.shadow.camera.top = 36;
    sun.shadow.camera.bottom = -36;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sunLight = sun;

    const rim = new THREE.DirectionalLight(0xfde68a, 0.55);
    rim.position.set(-20, 18, -30);
    this.scene.add(rim);

    this.textures = createProceduralTextures(this.renderer);
    this.world = buildDhakaWorld(this.textures);
    this.scene.add(this.world.root);

    this.heroRig = buildHeroMotorcycle(this.textures, this.equippedBikeId);
    this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
    this.scene.add(this.heroRig.group);

    this.slapperRig = buildSlapper();
    this.slapperRig.group.visible = false;
    this.scene.add(this.slapperRig.group);

    // Animated Fuel Hose (2 curved cylinder segments from pump nozzle to bike tank)
    this.fuelHoseGroup = new THREE.Group();
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
    const hoseGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
    hoseGeo.translate(0, 0.5, 0);
    this.hoseSegA = new THREE.Mesh(hoseGeo, hoseMat);
    this.hoseSegB = new THREE.Mesh(hoseGeo, hoseMat);
    this.fuelHoseGroup.add(this.hoseSegA, this.hoseSegB);
    this.fuelHoseGroup.visible = false;
    this.scene.add(this.fuelHoseGroup);

    this.initTrafficPools();
    this.initPedestrians();
    this.initPickups();
    this.initParticleAndDebrisPools();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('pointerdown', this.handleFirstGesture, { passive: true });

    this.audio.setMusicMode('menu');
    this.world.updateAroundPlayer(this.playerX, this.playerZ, 0);
    this.emitHud();

    this.lastTimeMs = performance.now();
    this.startLoop();
  }

  private handleFirstGesture = (): void => {
    this.audio.unlock();
  };

  private loadBestScore(): number {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.BEST_SCORE_STORAGE_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveBestScore(value: number): void {
    try {
      localStorage.setItem(GAME_CONFIG.BEST_SCORE_STORAGE_KEY, String(Math.floor(value)));
    } catch {
      // Ignore
    }
  }

  private loadHeroBank(): number {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.HERO_BANK_STORAGE_KEY);
      const parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  }

  private saveHeroBank(value: number): void {
    try {
      localStorage.setItem(GAME_CONFIG.HERO_BANK_STORAGE_KEY, String(Math.max(0, Math.floor(value))));
    } catch {
      // Ignore
    }
  }

  private loadUnlockedBikes(): BikeTierId[] {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.UNLOCKED_BIKES_STORAGE_KEY);
      if (!raw) return ['glamour_125'];
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return ['glamour_125'];
      const valid = arr.filter((id): id is BikeTierId => BIKE_ORDER.includes(id as BikeTierId));
      if (!valid.includes('glamour_125')) valid.unshift('glamour_125');
      return valid;
    } catch {
      return ['glamour_125'];
    }
  }

  private saveUnlockedBikes(list: BikeTierId[]): void {
    try {
      localStorage.setItem(GAME_CONFIG.UNLOCKED_BIKES_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Ignore
    }
  }

  private loadEquippedBike(unlocked: BikeTierId[]): BikeTierId {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.EQUIPPED_BIKE_STORAGE_KEY) as BikeTierId | null;
      if (raw && unlocked.includes(raw)) return raw;
    } catch {
      // Ignore
    }
    return 'glamour_125';
  }

  private saveEquippedBike(bikeId: BikeTierId): void {
    try {
      localStorage.setItem(GAME_CONFIG.EQUIPPED_BIKE_STORAGE_KEY, bikeId);
    } catch {
      // Ignore
    }
  }

  private getActiveBikeSpec(): BikeSpec {
    return BIKE_SPECS[this.equippedBikeId];
  }

  private getFuelPercent(): number {
    const cap = this.getActiveBikeSpec().fuelCapacity;
    return THREE.MathUtils.clamp((this.fuelAmount / cap) * 100, 0, 100);
  }

  private equipBikeModel(bikeId: BikeTierId): void {
    if (this.heroRig.group.parent) {
      this.scene.remove(this.heroRig.group);
    }
    this.heroRig.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.dispose();
      }
    });

    this.equippedBikeId = bikeId;
    this.saveEquippedBike(bikeId);
    this.heroRig = buildHeroMotorcycle(this.textures, bikeId);
    this.heroRig.group.position.set(this.playerX, this.playerY, this.playerZ);
    this.heroRig.group.rotation.set(0, this.playerYaw, 0);
    this.scene.add(this.heroRig.group);
  }

  private resetProgressionStorage(): void {
    this.saveHeroBank(0);
    this.saveUnlockedBikes(['glamour_125']);
    this.saveEquippedBike('glamour_125');
  }

  private resetRunProgression(): void {
    this.heroBankScore = 0;
    this.unlockedBikes = ['glamour_125'];
    this.milestone100kShown = false;
    this.milestone200kShown = false;
    this.resetProgressionStorage();
    if (this.equippedBikeId !== 'glamour_125') {
      this.equipBikeModel('glamour_125');
    }
  }

  private addPoints(pts: number): void {
    if (pts <= 0) return;
    this.score += pts;
    this.heroBankScore += pts;

    if (!this.milestone100kShown && this.heroBankScore >= 100000 && !this.unlockedBikes.includes('xtreme_160r')) {
      this.milestone100kShown = true;
      this.audio.playTankFull();
      this.flashScreen('amber', 0.3);
      this.pushPopup('১০০,০০০ পয়েন্ট পূর্ণ!', 'নিলয় হিরো শোরুমে গিয়ে এক্সট্রিম ১৬০আর নিন!', 'bonus');
    } else if (!this.milestone200kShown && this.heroBankScore >= 200000 && !this.unlockedBikes.includes('karizma_210')) {
      this.milestone200kShown = true;
      this.audio.playTankFull();
      this.flashScreen('amber', 0.3);
      this.pushPopup('২০০,০০০ পয়েন্ট পূর্ণ!', 'নিলয় হিরো শোরুমে গিয়ে কারিজমা ২১০ আনলক করুন!', 'bonus');
    }
  }

  private spawnArteryVehicle(entity: TrafficEntity, kind: VehicleKind, s: number, laneIdx: number): void {
    const spec = VEHICLE_SPECS[kind];
    const ws = wrapTrackS(s);
    const dirSign: 1 | -1 = laneIdx <= 1 ? -1 : 1; // -1 = keep-left forward (+s), +1 = oncoming (-s)
    const isOuterLane = laneIdx === 0 || laneIdx === 3;
    const rawRand = ((entity.id * 0.37 + Math.random() * 0.45) % 1);
    const slotNorm = isOuterLane ? 0.55 + rawRand * 0.4 : 0.05 + rawRand * 0.4;
    const lat = getTrafficLaneLat(ws, dirSign, slotNorm);
    const isOncoming = lat > 0;
    sampleTrackPose(ws, lat, _poseTmp);

    entity.kind = kind;
    entity.isCityVehicle = false;
    entity.isExpresswayVehicle = false;
    entity.laneIdx = laneIdx;
    // Allow full 6-lane spread across Purbachal 300ft (including 4 Express + 2 Service lanes per side)
    const wideSpread = ws >= 920 && ws <= 3330 ? rawRand : (isOuterLane ? 0.55 + rawRand * 0.4 : 0.05 + rawRand * 0.4);
    entity.slotNorm = wideSpread;
    const adjustedLat = ws >= 920 && ws <= 3330 ? getTrafficLaneLat(ws, dirSign, wideSpread) : lat;
    entity.s = ws;
    entity.lat = adjustedLat;
    entity.x = _poseTmp.x;
    entity.z = _poseTmp.z;
    entity.yaw = isOncoming ? _poseTmp.yaw + Math.PI : _poseTmp.yaw;
    entity.dirX = -Math.sin(entity.yaw);
    entity.dirZ = -Math.cos(entity.yaw);

    // Check Uttara-Tongi Flyover elevation for outer lanes (0 & 3) along Leg 5
    let y = 0;
    let slopePitch = 0;
    entity.layer = 'surface';
    if (
      (laneIdx === 0 || laneIdx === 3) &&
      ws >= UTTARA_TONGI_FLYOVER_DEF.startS &&
      ws <= UTTARA_TONGI_FLYOVER_DEF.endS
    ) {
      const uf = sampleUttaraFlyoverHeight(ws);
      entity.layer = 'uttara_tongi_flyover';
      y = uf.y;
      slopePitch = uf.slopeRad * (isOncoming ? -1 : 1);
    }
    entity.y = y;

    entity.baseSpeed =
      (spec.minSpeed + Math.random() * (spec.maxSpeed - spec.minSpeed)) * GAME_CONFIG.TRAFFIC_SPEED_BOOST;
    entity.currentSpeed = entity.baseSpeed;
    entity.targetSpeed = entity.baseSpeed;
    entity.wrecked = false;
    entity.frozen = false;
    entity.nearMissedThisPass = false;
    entity.hitCooldown = 0;

    if (entity.rig.group.parent) {
      this.scene.remove(entity.rig.group);
    }
    const rig = buildTrafficVehicle(kind, this.textures, entity.id + Math.floor(Math.random() * 7));
    rig.group.scale.setScalar(0.58);
    rig.group.rotation.order = 'YXZ';
    rig.group.rotation.set(slopePitch, entity.yaw, 0);
    rig.group.position.set(entity.x, y, entity.z);
    this.scene.add(rig.group);
    entity.rig = rig;
  }

  private spawnExpresswayVehicle(entity: TrafficEntity, kind: VehicleKind, zPos: number, laneIdx: number): void {
    const spec = VEHICLE_SPECS[kind];
    const laneX = GAME_CONFIG.ARTERY_LANES[laneIdx];
    const isOncoming = laneX > 0;
    const yaw = isOncoming ? Math.PI : 0;
    const sampled = sampleExpresswayMainHeight(zPos);

    entity.kind = kind;
    entity.isCityVehicle = false;
    entity.isExpresswayVehicle = true;
    entity.laneIdx = laneIdx;
    entity.s = Math.abs(zPos);
    entity.lat = laneX;
    entity.layer = 'elevated_expressway';
    entity.x = laneX;
    entity.z = zPos;
    entity.y = sampled.y;
    entity.yaw = yaw;
    entity.dirX = -Math.sin(yaw);
    entity.dirZ = -Math.cos(yaw);

    entity.baseSpeed =
      (spec.minSpeed + Math.random() * (spec.maxSpeed - spec.minSpeed)) * GAME_CONFIG.TRAFFIC_SPEED_BOOST;
    entity.currentSpeed = entity.baseSpeed;
    entity.targetSpeed = entity.baseSpeed;
    entity.wrecked = false;
    entity.frozen = false;
    entity.nearMissedThisPass = false;
    entity.hitCooldown = 0;

    if (entity.rig.group.parent) {
      this.scene.remove(entity.rig.group);
    }
    const rig = buildTrafficVehicle(kind, this.textures, entity.id + Math.floor(Math.random() * 7));
    rig.group.scale.setScalar(0.58);
    rig.group.rotation.order = 'YXZ';
    rig.group.rotation.set(sampled.slopeRad * (isOncoming ? -1 : 1), yaw, 0);
    rig.group.position.set(entity.x, entity.y, entity.z);
    this.scene.add(rig.group);
    entity.rig = rig;
  }

  private spawnCrossStreetVehicle(entity: TrafficEntity, kind: VehicleKind, laneIdx: number, tNorm: number): void {
    const spec = VEHICLE_SPECS[kind];
    const lane: CrossStreetLane = this.world.crossLanes[laneIdx];
    let lat = lane.latStart + tNorm * (lane.latEnd - lane.latStart);
    if (Math.abs(lat) < 15) {
      lat = lat < 0 ? -22 : 22;
    }
    const s = wrapTrackS(lane.s + lane.sOffset);
    sampleTrackPose(s, lat, _poseTmp);

    // Travel across track laterally: dirLat > 0 means (+nx, +nz), dirLat < 0 means (-nx, -nz)
    const dirX = _poseTmp.nx * lane.dirLat;
    const dirZ = _poseTmp.nz * lane.dirLat;
    const yaw = Math.atan2(-dirX, -dirZ);

    entity.kind = kind;
    entity.isCityVehicle = true;
    entity.isExpresswayVehicle = false;
    entity.laneIdx = laneIdx;
    entity.s = s;
    entity.lat = lat;
    entity.layer = 'surface';
    entity.x = _poseTmp.x;
    entity.z = _poseTmp.z;
    entity.y = 0;
    entity.yaw = yaw;
    entity.dirX = dirX;
    entity.dirZ = dirZ;

    entity.baseSpeed = Math.min(10.5, spec.minSpeed + Math.random() * (spec.maxSpeed - spec.minSpeed));
    entity.currentSpeed = entity.baseSpeed;
    entity.targetSpeed = entity.baseSpeed;
    entity.wrecked = false;
    entity.frozen = false;
    entity.nearMissedThisPass = false;
    entity.hitCooldown = 0;

    if (entity.rig.group.parent) {
      this.scene.remove(entity.rig.group);
    }
    const rig = buildTrafficVehicle(kind, this.textures, entity.id + Math.floor(Math.random() * 7));
    rig.group.scale.setScalar(0.58);
    rig.group.rotation.order = 'YXZ';
    rig.group.rotation.set(0, yaw, 0);
    rig.group.position.set(entity.x, 0, entity.z);
    this.scene.add(rig.group);
    entity.rig = rig;
  }

  private initTrafficPools(): void {
    const tier = this.getActiveBikeSpec().tier;

    // 1. Main Artery Traffic across the 4,877m Dhaka loop (including 10 Elevated Expressway vehicles)
    for (let i = 0; i < GAME_CONFIG.ARTERY_TRAFFIC_COUNT; i++) {
      const kind: VehicleKind =
        i === 0
          ? 'cycle'
          : i === 1
            ? 'rickshaw'
            : i === 2
              ? 'cng'
              : i === 3
                ? 'bus_nitol_staff'
                : i === 4
                  ? 'bus_nitol'
                  : i === 5
                    ? 'covered_van'
                    : i === 6
                      ? 'bus_double_decker'
                      : i === 7
                        ? 'suv_prado'
                        : i === 8
                          ? 'cement_mixer'
                          : i === 9
                            ? 'oil_tanker'
                            : i === 10
                              ? 'fire_truck'
                              : pickWeightedKind(false, tier);

      const dummyRig = buildTrafficVehicle(kind, this.textures, i);
      const entity: TrafficEntity = {
        id: i,
        isCityVehicle: false,
        isExpresswayVehicle: false,
        kind,
        rig: dummyRig,
        x: 0,
        y: 0,
        z: 0,
        s: 0,
        lat: -3.25,
        layer: 'surface',
        yaw: 0,
        dirX: 0,
        dirZ: -1,
        laneIdx: 0,
        slotNorm: (i * 0.37) % 1,
        baseSpeed: 12,
        currentSpeed: 12,
        targetSpeed: 12,
        frozen: false,
        wrecked: false,
        wreckTimer: 0,
        nearMissedThisPass: false,
        hitCooldown: 0,
        lookaheadTimer: (i % 5) * 0.04,
      };

      // Reserve 14 vehicles on Elevated Expressway deck & 56 dedicated vehicles cruising Purbachal 300ft 12-lane!
      const expresswayCount = 14;
      const purbachalCount = 56;
      const surfaceTrafficPool = GAME_CONFIG.ARTERY_TRAFFIC_COUNT - expresswayCount;
      const generalSurfacePool = surfaceTrafficPool - purbachalCount;
      if (i >= surfaceTrafficPool) {
        const expKind: VehicleKind = i % 3 === 0 ? 'car' : i % 3 === 1 ? 'suv_prado' : 'taxi';
        const expIdx = i - surfaceTrafficPool;
        const zPos = ELEVATED_EXPRESSWAY_DEF.deckStartZ - 18 - expIdx * 42;
        const laneIdx = expIdx % 2 === 0 ? 1 : 2;
        this.spawnExpresswayVehicle(entity, expKind, zPos, laneIdx);
      } else if (i >= generalSurfacePool) {
        const pIdx = i - generalSurfacePool;
        entity.isPurbachalTraffic = true;
        const s = 940 + ((pIdx * (2380 / purbachalCount)) % 2380);
        const laneIdx = pIdx % 4;
        this.spawnArteryVehicle(entity, kind, s, laneIdx);
      } else {
        const laneIdx =
          i === 0 || i === 1
            ? 0
            : i === 2 || i === 3
              ? 1
              : i === 4
                ? 2
                : pickArteryLaneForKind(kind);
        const s =
          i === 0
            ? 38
            : i === 1
              ? 52
              : i === 2
                ? 68
                : i === 3
                  ? 90
                  : i === 4
                    ? 152
                    : ((i * (TRACK_LOOP_LENGTH / generalSurfacePool) + 34) % TRACK_LOOP_LENGTH);
        this.spawnArteryVehicle(entity, kind, s, laneIdx);
      }
      this.traffic.push(entity);
    }

    // 2. Cross-Street Traffic across the 5 signalized intersections (ID base 1000+ to avoid collision with 210 artery vehicles)
    for (let i = 0; i < GAME_CONFIG.CITY_TRAFFIC_COUNT; i++) {
      const laneIdx = i % this.world.crossLanes.length;
      const kind = i === 0 ? 'rickshaw' : i === 1 ? 'cycle' : i === 2 ? 'cng' : pickWeightedKind(true, tier);
      const dummyRig = buildTrafficVehicle(kind, this.textures, 100 + i);
      const entity: TrafficEntity = {
        id: 1000 + i,
        isCityVehicle: true,
        isExpresswayVehicle: false,
        kind,
        rig: dummyRig,
        x: 0,
        y: 0,
        z: 0,
        s: 0,
        lat: 0,
        layer: 'surface',
        yaw: 0,
        dirX: 1,
        dirZ: 0,
        laneIdx,
        slotNorm: 0.5,
        baseSpeed: 7.5,
        currentSpeed: 7.5,
        targetSpeed: 7.5,
        frozen: false,
        wrecked: false,
        wreckTimer: 0,
        nearMissedThisPass: false,
        hitCooldown: 0,
        lookaheadTimer: (i % 5) * 0.05,
      };
      this.spawnCrossStreetVehicle(entity, kind, laneIdx, (i * 0.37) % 1);
      this.traffic.push(entity);
    }
  }

  private initPedestrians(): void {
    const shirtPalette = [0xe11d48, 0x2563eb, 0x059669, 0xd97706, 0x7c3aed, 0xf59e0b];

    // Crosswalk pedestrians at intersections
    CROSS_INTERSECTION_S.forEach((is, idx) => {
      const hw = getRoadProfileAtS(is).halfWidth;
      for (let k = 0; k < 3; k++) {
        const rig = buildPedestrian(shirtPalette[(idx * 3 + k) % shirtPalette.length]);
        const dir = k % 2 === 0 ? 1 : -1;
        const startLat = dir > 0 ? -(hw + 0.9) : hw + 0.9;
        const ps = wrapTrackS(is + (k === 0 ? -8.2 : k === 1 ? 8.2 : -8.5));
        sampleTrackPose(ps, startLat, _poseTmp);
        rig.group.position.set(_poseTmp.x, 0.02, _poseTmp.z);
        this.scene.add(rig.group);
        this.pedestrians.push({
          rig,
          x: _poseTmp.x,
          z: _poseTmp.z,
          s: ps,
          lat: startLat,
          homeS: ps,
          homeLat: startLat,
          isCrosswalk: true,
          interIdx: idx,
          dir,
          walkSpeed: 2.0 + k * 0.35,
          walkPhase: idx + k * 1.4,
          mode: 'crossing',
          angerTimer: 0,
          knockTimer: 0,
          knockVx: 0,
          knockVy: 0,
          knockVz: 0,
        });
      }
    });

    // Sidewalk pedestrians distributed across urban corridors + Neela Market around the 13.6 km loop
    for (let i = 0; i < 68; i++) {
      const rig = buildPedestrian(shirtPalette[(i + 2) % shirtPalette.length], 0x334155);
      const side = i % 2 === 0 ? -1 : 1;
      let ps = (i * 195 + 26) % TRACK_LOOP_LENGTH;
      if (i === 65) ps = TRACK_LANDMARKS_S.MOHAKHALI_TERMINAL_S;
      if (i === 66) ps = TRACK_LANDMARKS_S.NEELA_MARKET_S + 6;
      if (i === 67) ps = TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S + 34;
      const riverHit = isSInAnyRiver(ps, 16);
      if (riverHit) {
        ps = wrapTrackS(riverHit.endS + 22);
      }
      if (Math.abs(shortestTrackDeltaS(ps, TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S)) < 20) {
        ps = wrapTrackS(TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S + 26);
      }
      const hw = getRoadProfileAtS(ps).halfWidth;
      const lat = side * (hw + 1.5);
      sampleTrackPose(ps, lat, _poseTmp);
      rig.group.position.set(_poseTmp.x, 0.14, _poseTmp.z);
      this.scene.add(rig.group);
      this.pedestrians.push({
        rig,
        x: _poseTmp.x,
        z: _poseTmp.z,
        s: ps,
        lat,
        homeS: ps,
        homeLat: lat,
        isCrosswalk: false,
        interIdx: -1,
        dir: i % 2 === 0 ? 1 : -1,
        walkSpeed: 1.55,
        walkPhase: i * 0.8,
        mode: 'sidewalk',
        angerTimer: 0,
        knockTimer: 0,
        knockVx: 0,
        knockVy: 0,
        knockVz: 0,
      });
    }
  }

  private samplePickupLocation(slotIdx: number): {
    x: number;
    y: number;
    z: number;
    s: number;
    lat: number;
    layer: TrackLayer;
  } {
    // 1. Place ~16% of pickups on Elevated Expressway deck (Mohakhali -> Kawla -> Airport)
    if (slotIdx % 6 === 1) {
      const z = ELEVATED_EXPRESSWAY_DEF.deckStartZ - 14 - Math.random() * 600;
      const lanes = [-6.5, -2.5, 2.5, 6.5];
      const x = lanes[slotIdx % lanes.length];
      const adjZ = Math.abs(z - ELEVATED_EXPRESSWAY_DEF.tollPlazaZ) < 12 ? z - 18 : z;
      return {
        x,
        y: ELEVATED_EXPRESSWAY_DEF.deckHeight,
        z: adjZ,
        s: Math.abs(adjZ),
        lat: x,
        layer: 'elevated_expressway',
      };
    }

    // 2. Place ~12% on Uttara-Tongi Flyover deck
    if (slotIdx % 8 === 3) {
      const s =
        UTTARA_TONGI_FLYOVER_DEF.deckStartS +
        14 +
        Math.random() * (UTTARA_TONGI_FLYOVER_DEF.deckEndS - UTTARA_TONGI_FLYOVER_DEF.deckStartS - 28);
      const lanes = [-6.5, -2.5, 2.5, 6.5];
      const lat = lanes[slotIdx % lanes.length];
      sampleTrackPose(s, lat, _poseTmp);
      return {
        x: _poseTmp.x,
        y: UTTARA_TONGI_FLYOVER_DEF.deckHeight,
        z: _poseTmp.z,
        s,
        lat,
        layer: 'uttara_tongi_flyover',
      };
    }

    // 3. Surface 13.6 km Dhaka loop lanes (adapt across 4-lane, 6-lane, and 12-lane 300ft!)
    let s = ((slotIdx * 178 + 38 + Math.random() * 26) % TRACK_LOOP_LENGTH);
    const dirSign: 1 | -1 = slotIdx % 3 === 0 ? 1 : -1;
    const lat = getTrafficLaneLat(s, dirSign, Math.random());
    if (Math.abs(shortestTrackDeltaS(s, TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S)) < 10 && Math.abs(lat) < 5) {
      s = wrapTrackS(s + 16);
    }
    sampleTrackPose(s, lat, _poseTmp);
    return { x: _poseTmp.x, y: 0, z: _poseTmp.z, s, lat, layer: 'surface' };
  }

  private initPickups(): void {
    const kinds: PickupKind[] = ['coin', 'coin', 'coin', 'fuel', 'coin', 'nitro'];
    for (let i = 0; i < 76; i++) {
      const kind = kinds[i % kinds.length];
      const mesh = buildCollectiblePickup(kind);
      const loc = this.samplePickupLocation(i);
      mesh.position.set(loc.x, loc.y + 0.9, loc.z);
      this.scene.add(mesh);
      this.pickups.push({
        id: i,
        kind,
        mesh,
        x: loc.x,
        y: loc.y,
        z: loc.z,
        s: loc.s,
        lat: loc.lat,
        layer: loc.layer,
        respawnTimer: 0,
        phase: i * 0.65,
      });
    }
  }

  private initParticleAndDebrisPools(): void {
    const smokeGeo = new THREE.DodecahedronGeometry(0.2, 0);
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xd1d5db, transparent: true, opacity: 0.7, depthWrite: false });
      const mesh = new THREE.Mesh(smokeGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({ mesh, active: false, life: 0, maxLife: 0.5, vx: 0, vy: 0, vz: 0, startScale: 0.4, endScale: 1.5 });
    }

    const debrisGeo = new THREE.BoxGeometry(0.32, 0.22, 0.42);
    const debrisColors = [0xdc2626, 0xfacc15, 0x15803d, 0x1f2937, 0x94a3b8];
    for (let i = 0; i < 36; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: debrisColors[i % debrisColors.length],
        roughness: 0.5,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(debrisGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.debris.push({ mesh, active: false, life: 0, maxLife: 2.2, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0 });
    }
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    maxLife: number,
    startScale: number,
    endScale: number
  ): void {
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = maxLife;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.startScale = startScale;
        p.endScale = endScale;
        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(startScale);
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(colorHex);
        mat.opacity = 0.75;
        p.mesh.visible = true;
        return;
      }
    }
  }

  private spawnBurst(x: number, y: number, z: number, colorHex: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnParticle(
        x + (Math.random() - 0.5) * 0.6,
        y + Math.random() * 0.5,
        z + (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 8,
        2 + Math.random() * 6,
        (Math.random() - 0.5) * 8,
        colorHex,
        0.45 + Math.random() * 0.35,
        0.65,
        0.1
      );
    }
  }

  private spawnDebrisBurst(x: number, y: number, z: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const d = this.debris[this.debrisCursor];
      this.debrisCursor = (this.debrisCursor + 1) % this.debris.length;
      d.active = true;
      d.life = 0;
      d.maxLife = 1.8 + Math.random() * 0.8;
      d.vx = (Math.random() - 0.5) * 14;
      d.vy = 5 + Math.random() * 6;
      d.vz = (Math.random() - 0.5) * 14;
      d.rx = (Math.random() - 0.5) * 10;
      d.rz = (Math.random() - 0.5) * 10;
      d.mesh.position.set(x + (Math.random() - 0.5) * 0.8, y + 0.4, z + (Math.random() - 0.5) * 0.8);
      d.mesh.rotation.set(0, Math.random() * Math.PI, 0);
      (d.mesh.material as THREE.MeshStandardMaterial).opacity = 1;
      d.mesh.visible = true;
    }
  }

  private pushPopup(title: string, subtitle: string | undefined, tone: EventPopup['tone']): void {
    this.popupSeq += 1;
    this.latestPopup = { id: this.popupSeq, title, subtitle, tone };
    this.popupTimer = 1.45;
  }

  private flashScreen(tone: 'red' | 'amber' | 'green', duration = 0.25): void {
    this.screenFlashTone = tone;
    this.screenFlashTimer = duration;
  }

  public startGame(keepSelectedBike = false): void {
    this.audio.unlock();
    this.audio.resetRideAudio();
    this.audio.setMusicMode('play');
    if (!keepSelectedBike) {
      this.resetRunProgression();
    }
    this.gameState = GameState.PLAYING;
    this.playerS = 18;
    this.playerLat = -3.25;
    this.playerSegHint = 0;
    sampleTrackPose(18, -3.25, _poseTmp);
    this.playerX = _poseTmp.x;
    this.playerY = 0;
    this.playerZ = _poseTmp.z;
    this.playerLayer = 'surface';
    this.playerSlopeRad = 0;
    this.playerYaw = _poseTmp.yaw;
    this.forwardSpeed = 6;
    this.lateralSlip = 0;
    this.smoothedSteer = 0;
    this.bikeLean = 0;
    this.bikePitch = 0;
    this.bikeRollCrash = 0;
    this.postHitRecoveryTimer = 0;
    this.wasBoosting = false;
    this.freeNitroTimer = 0;

    this.fuelAmount = this.getActiveBikeSpec().fuelCapacity;
    this.emptyStoppedTimer = 0;
    this.refuelBonusGiven = false;
    this.refuelSafeGraceTimer = 0;
    this.refuelShieldUsedThisStop = false;
    this.showroomExitCooldown = 0;
    this.showroomVisitedLock = false;
    this.showroomSaluteLock = false;
    this.bankSaveAccum = 0;
    this.score = 0;
    this.isNewBest = false;
    this.combo = 1;
    this.comboTimer = 0;
    this.distanceMeters = 0;
    this.lapCount = 1;
    this.wrecksCount = 0;
    this.pedKnockCount = 0;
    this.nearMissCount = 0;
    this.ruleBreakCount = 0;
    this.collectiblesCount = 0;
    this.violationPenaltyAccum = 0;
    this.ruleBreakSecondAccum = 0;

    this.missionIdx = 0;
    this.missionLoop = 0;
    this.missionProgress = 0;
    this.highSpeedSecAccum = 0;

    this.activeViolation = null;
    this.violationTimer = 0;
    this.funnyMessage = null;
    this.funnyDisplayTimer = 0;
    this.funnyCooldownTimer = 3.0;
    this.latestPopup = null;
    this.popupTimer = 0;
    this.screenFlashTone = 'none';
    this.screenFlashTimer = 0;
    this.crashTimer = 0;
    this.slapTriggered = false;
    this.hitstopTimer = 0;
    this.cameraShake = 0;
    this.gameOverReasonBn = '';
    this.gameOverReasonEn = '';
    this.gameOverRoastsBn = [];

    this.slapperRig.group.visible = false;
    this.fuelHoseGroup.visible = false;

    for (const inter of this.world.intersections) {
      inter.violatedThisPass = false;
      inter.bonusAwardedThisPass = false;
    }

    for (const d of this.debris) {
      d.active = false;
      d.mesh.visible = false;
    }

    // Reset Traffic cleanly away from Tejgaon spawn across 13.6 km loop + dedicated Purbachal 300ft fleet
    const expresswayCount = 14;
    const purbachalCount = 56;
    const surfaceTrafficPool = GAME_CONFIG.ARTERY_TRAFFIC_COUNT - expresswayCount;
    const generalSurfacePool = surfaceTrafficPool - purbachalCount;
    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      if (t.isExpresswayVehicle) {
        const expIdx = t.id - surfaceTrafficPool;
        const zPos = ELEVATED_EXPRESSWAY_DEF.deckStartZ - 18 - expIdx * 42;
        this.spawnExpresswayVehicle(t, t.kind, zPos, t.laneIdx);
      } else if (t.isPurbachalTraffic) {
        const pIdx = t.id - generalSurfacePool;
        const s = 940 + ((pIdx * (2380 / purbachalCount)) % 2380);
        this.spawnArteryVehicle(t, t.kind, s, t.laneIdx);
      } else if (!t.isCityVehicle) {
        let s =
          t.id === 0
            ? 38
            : t.id === 1
              ? 52
              : t.id === 2
                ? 68
                : t.id === 3
                  ? 90
                  : t.id === 4
                    ? 152
                    : ((t.id * (TRACK_LOOP_LENGTH / generalSurfacePool) + 34) % TRACK_LOOP_LENGTH);
        if (Math.abs(shortestTrackDeltaS(s, this.playerS)) < 16) {
          s = wrapTrackS(s + 34);
        }
        this.spawnArteryVehicle(t, t.kind, s, t.laneIdx);
      } else {
        this.spawnCrossStreetVehicle(t, t.kind, t.laneIdx, ((t.id - 1000) * 0.37) % 1);
      }
    }

    // Reset Pickups
    for (const pk of this.pickups) {
      const loc = this.samplePickupLocation(pk.id);
      pk.x = loc.x;
      pk.y = loc.y;
      pk.z = loc.z;
      pk.s = loc.s;
      pk.lat = loc.lat;
      pk.layer = loc.layer;
      pk.respawnTimer = 0;
      pk.mesh.visible = true;
      pk.mesh.position.set(pk.x, pk.y + 0.9, pk.z);
    }

    // Reset Pedestrians
    for (const p of this.pedestrians) {
      p.mode = p.isCrosswalk ? 'crossing' : 'sidewalk';
      p.s = p.homeS;
      p.lat = p.homeLat;
      sampleTrackPose(p.s, p.lat, _poseTmp);
      p.x = _poseTmp.x;
      p.z = _poseTmp.z;
      p.angerTimer = 0;
      p.knockTimer = 0;
      p.rig.angryBadge.visible = false;
      p.rig.group.rotation.set(0, 0, 0);
      p.rig.group.position.set(p.x, p.isCrosswalk ? 0.02 : 0.14, p.z);
    }

    this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
    this.heroRig.group.rotation.set(0, this.playerYaw, 0);
    this.heroRig.leanGroup.rotation.set(0, 0, 0);
    this.camera.position.set(this.playerX, 2.35, this.playerZ + 5.0);
    _lookTarget.set(this.playerX, 1.0, this.playerZ - 10);
    this.camera.lookAt(_lookTarget);
    this.world.updateAroundPlayer(this.playerX, this.playerZ, this.elapsedSec);
    this.emitHud();
  }

  public setTouchControl(control: keyof InputState, pressed: boolean): void {
    this.audio.unlock();
    if (control === 'horn' && pressed && !this.touchInput.horn) {
      this.audio.playHorn(1.0);
    }
    this.touchInput[control] = pressed;
    this.syncCombinedInput();
  }

  public releaseAllTouchControls(): void {
    this.touchInput = {
      accelerate: false,
      brake: false,
      reverse: false,
      left: false,
      right: false,
      boost: false,
      handbrake: false,
      horn: false,
    };
    this.syncCombinedInput();
  }

  public toggleMute(): boolean {
    this.audio.unlock();
    const next = !this.audio.isMuted();
    this.audio.setMuted(next);
    return next;
  }

  public openShowroomFromMenu(): void {
    this.audio.unlock();
    this.audio.playShowroomOpen();
    this.showroomReturnState = GameState.MENU;
    this.gameState = GameState.SHOWROOM;
    this.emitHud();
  }

  public closeShowroom(): void {
    if (this.gameState !== GameState.SHOWROOM) return;
    this.handleWindowBlur();
    if (this.showroomReturnState === GameState.PLAYING) {
      this.showroomVisitedLock = true;
      this.showroomExitCooldown = 3.0;
      this.forwardSpeed = Math.max(this.forwardSpeed, 8.5);
      this.audio.setMusicMode('play');
    }
    this.gameState = this.showroomReturnState;
    this.emitHud(false, false, false);
  }

  public purchaseOrEquipBike(bikeId: BikeTierId): { ok: boolean; message: string } {
    this.audio.unlock();
    const spec = BIKE_SPECS[bikeId];
    const isOwned = this.unlockedBikes.includes(bikeId);

    if (isOwned) {
      this.equipBikeModel(bikeId);
      this.fuelAmount = spec.fuelCapacity;
      this.audio.playTankFull();
      this.flashScreen('green', 0.2);

      if (this.showroomReturnState === GameState.PLAYING) {
        this.handleWindowBlur();
        this.showroomVisitedLock = true;
        this.showroomExitCooldown = 3.0;
        this.forwardSpeed = Math.max(this.forwardSpeed, 9.5);
        this.audio.setMusicMode('play');
        this.gameState = GameState.PLAYING;
        this.pushPopup('বাইক পরিবর্তন!', `${spec.nameBn} প্রস্তুত!`, 'bonus');
        this.emitHud(false, false, false);
      } else {
        this.startGame(true);
        this.pushPopup('বাইক পরিবর্তন!', `${spec.nameBn} নিয়ে যাত্রা শুরু!`, 'bonus');
        this.emitHud(false, false, false);
      }
      return { ok: true, message: `${spec.nameBn} equipped` };
    }

    if (this.heroBankScore < spec.cost) {
      this.audio.playViolation();
      return {
        ok: false,
        message: `আরও ${(spec.cost - Math.floor(this.heroBankScore)).toLocaleString()} পয়েন্ট প্রয়োজন!`,
      };
    }

    this.heroBankScore = Math.max(0, this.heroBankScore - spec.cost);
    this.saveHeroBank(this.heroBankScore);
    this.unlockedBikes = [...this.unlockedBikes, bikeId];
    this.saveUnlockedBikes(this.unlockedBikes);
    this.equipBikeModel(bikeId);
    this.fuelAmount = spec.fuelCapacity;

    this.audio.playUpgradeFanfare();
    this.flashScreen('green', 0.35);
    this.spawnBurst(this.playerX, 1.0, this.playerZ, 0xfacc15, 16);

    if (this.showroomReturnState === GameState.PLAYING) {
      this.handleWindowBlur();
      this.showroomVisitedLock = true;
      this.showroomExitCooldown = 3.0;
      this.forwardSpeed = Math.max(this.forwardSpeed, 9.5);
      this.audio.setMusicMode('play');
      this.gameState = GameState.PLAYING;
      this.pushPopup('নতুন বাইক আপগ্রেড!', `${spec.nameBn} আনলক হয়েছে (-${spec.cost.toLocaleString()} pts)!`, 'bonus');
      this.emitHud(false, false, false);
    } else {
      this.startGame(true);
      this.pushPopup('নতুন বাইক আপগ্রেড!', `${spec.nameBn} আনলক হয়েছে (-${spec.cost.toLocaleString()} pts)!`, 'bonus');
      this.emitHud(false, false, false);
    }
    return { ok: true, message: `Unlocked ${spec.nameBn}` };
  }

  private syncCombinedInput(): void {
    this.input.accelerate = this.keyboardInput.accelerate || this.touchInput.accelerate;
    this.input.brake = this.keyboardInput.brake || this.touchInput.brake;
    this.input.reverse = this.keyboardInput.reverse || this.touchInput.reverse;
    this.input.left = this.keyboardInput.left || this.touchInput.left || this.commaSteer;
    this.input.right = this.keyboardInput.right || this.touchInput.right || this.periodSteer;
    this.input.boost = this.keyboardInput.boost || this.touchInput.boost;
    this.input.handbrake = this.keyboardInput.handbrake || this.touchInput.handbrake;
    this.input.horn = this.keyboardInput.horn || this.touchInput.horn;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (e.repeat) return;
    this.audio.unlock();

    if (e.code === 'Escape' && this.gameState === GameState.SHOWROOM) {
      this.closeShowroom();
      return;
    }
    if (e.code === 'Enter' && this.gameState === GameState.MENU) {
      this.startGame();
      return;
    }
    if ((e.code === 'KeyR' || e.code === 'Enter') && this.gameState === GameState.GAME_OVER) {
      this.startGame();
      return;
    }

    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keyboardInput.accelerate = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keyboardInput.reverse = true;
    if (e.code === 'Space') this.keyboardInput.handbrake = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keyboardInput.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keyboardInput.right = true;
    if (e.code === 'Comma') this.commaSteer = true;
    if (e.code === 'Period') this.periodSteer = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keyboardInput.boost = true;
    if (e.code === 'KeyH') {
      if (!this.keyboardInput.horn) this.audio.playHorn(1.0);
      this.keyboardInput.horn = true;
    }

    this.syncCombinedInput();
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keyboardInput.accelerate = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keyboardInput.reverse = false;
    if (e.code === 'Space') this.keyboardInput.handbrake = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keyboardInput.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keyboardInput.right = false;
    if (e.code === 'Comma') this.commaSteer = false;
    if (e.code === 'Period') this.periodSteer = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keyboardInput.boost = false;
    if (e.code === 'KeyH') this.keyboardInput.horn = false;

    this.syncCombinedInput();
  };

  private handleWindowBlur = (): void => {
    this.keyboardInput = {
      accelerate: false,
      brake: false,
      reverse: false,
      left: false,
      right: false,
      boost: false,
      handbrake: false,
      horn: false,
    };
    this.commaSteer = false;
    this.periodSteer = false;
    this.releaseAllTouchControls();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(this.container.clientHeight || window.innerHeight, 1);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private startLoop(): void {
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTimeMs) / 1000;
      this.lastTimeMs = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      this.update(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } catch {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private triggerBigCrash(reasonBn: string, reasonEn: string): void {
    if (this.gameState !== GameState.PLAYING) return;
    this.gameState = GameState.CRASHED;
    this.crashTimer = 2.1;
    this.slapTriggered = false;
    this.hitstopTimer = 0.065;
    this.cameraShake = 0.95;
    this.fuelHoseGroup.visible = false;
    this.gameOverReasonBn = reasonBn;
    this.gameOverReasonEn = reasonEn;
    this.gameOverRoastsBn = this.pickGameOverRoasts();
    this.audio.playBigCrash();
    this.flashScreen('red', 0.35);
    this.spawnBurst(this.playerX, this.playerY + 0.8, this.playerZ, 0xf97316, 20);
    this.spawnDebrisBurst(this.playerX, this.playerY + 0.6, this.playerZ, 8);

    for (const t of this.traffic) {
      t.frozen = true;
    }

    const dirX = -Math.sin(this.playerYaw);
    const dirZ = -Math.cos(this.playerYaw);
    this.slapperRig.group.position.set(
      this.playerX + dirX * 3.8 + dirZ * 1.4,
      this.playerY,
      this.playerZ + dirZ * 3.8 - dirX * 1.4
    );
    this.slapperRig.rightArmPivot.rotation.set(0, 0, 0);
    this.slapperRig.group.visible = true;

    this.finalizeBestScore();
    this.emitHud();
  }

  private pickGameOverRoasts(): string[] {
    const deathHeadline = FUNNY_DEATH_LINES_BN[Math.floor(Math.random() * FUNNY_DEATH_LINES_BN.length)];
    const pool = [...GAME_OVER_PUBLIC_ROASTS_BN];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return [deathHeadline, ...pool.slice(0, 3)];
  }

  private triggerOutOfFuel(): void {
    if (this.gameState !== GameState.PLAYING) return;
    this.gameState = GameState.GAME_OVER;
    this.fuelHoseGroup.visible = false;
    this.gameOverReasonBn = 'জ্বালানি শেষ! পাম্পের বাইরে তেল ফুরিয়ে আটকে গেছেন।';
    this.gameOverReasonEn = 'Out of fuel! Stop at Dhaka Highway Fuel Stations to refill.';
    this.gameOverRoastsBn = this.pickGameOverRoasts();
    this.audio.updateEngine(0, false, false);
    this.audio.playGameOver();
    this.finalizeBestScore();
    this.resetProgressionStorage();
    this.emitHud();
  }

  private finalizeBestScore(): void {
    const finalInt = Math.floor(this.score);
    if (finalInt > this.bestScore) {
      this.bestScore = finalInt;
      this.isNewBest = true;
      this.saveBestScore(finalInt);
    }
  }

  private update(dt: number): void {
    this.elapsedSec += dt;

    if (this.screenFlashTimer > 0) {
      this.screenFlashTimer -= dt;
      if (this.screenFlashTimer <= 0) this.screenFlashTone = 'none';
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.updateParticles(dt * 0.25);
      return;
    }

    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.9);
    this.world.updateAroundPlayer(
      this.playerX,
      this.playerZ,
      this.elapsedSec,
      this.gameState === GameState.SHOWROOM
    );
    this.updateTraffic(dt);
    this.updatePedestrians(dt);
    this.updateParticles(dt);
    this.updateDebris(dt);

    if (this.gameState === GameState.MENU) {
      this.audio.updateEngine(0, false, false);
      this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
      this.heroRig.group.rotation.set(0, this.playerYaw, 0);
      this.heroRig.leanGroup.rotation.set(0, 0, 0);

      const panX = this.playerX + Math.sin(this.elapsedSec * 0.45) * 4.0;
      const panZ = this.playerZ + 4.8 + Math.cos(this.elapsedSec * 0.35) * 1.4;
      _camTarget.set(panX, 2.25, panZ);
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-4 * dt));
      _lookTarget.set(this.playerX, 0.9, this.playerZ - 6);
      this.camera.lookAt(_lookTarget);
      this.sunLight.position.set(this.playerX + 28, 46, this.playerZ + 22);
      this.sunLight.target.position.set(this.playerX, 0, this.playerZ - 15);
      return;
    }

    if (this.gameState === GameState.CRASHED) {
      this.crashTimer -= dt;
      this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, 0, 4.5, dt);
      const fwdX = -Math.sin(this.playerYaw);
      const fwdZ = -Math.cos(this.playerYaw);
      this.playerX += fwdX * this.forwardSpeed * dt;
      this.playerZ += fwdZ * this.forwardSpeed * dt;

      this.bikeRollCrash = THREE.MathUtils.damp(this.bikeRollCrash, Math.PI * 0.45, 7, dt);
      this.heroRig.group.position.set(this.playerX, this.playerY + 0.1, this.playerZ);
      this.heroRig.group.rotation.set(0, this.playerYaw, 0);
      this.heroRig.leanGroup.rotation.set(0.12, 0.25, this.bikeRollCrash);
      this.audio.updateEngine(0, false, false);

      const sx = this.slapperRig.group.position.x;
      const sz = this.slapperRig.group.position.z;
      const dx = this.playerX - sx;
      const dz = this.playerZ - sz;
      const dist = Math.hypot(dx, dz);
      this.slapperRig.group.rotation.y = Math.atan2(dx, dz);

      if (dist > 1.15) {
        const runStep = Math.min(dist - 1.1, 6.2 * dt);
        this.slapperRig.group.position.x += (dx / dist) * runStep;
        this.slapperRig.group.position.z += (dz / dist) * runStep;
        const swing = Math.sin(this.elapsedSec * 16) * 0.65;
        this.slapperRig.leftLeg.rotation.x = swing;
        this.slapperRig.rightLeg.rotation.x = -swing;
        this.slapperRig.rightArmPivot.rotation.x = -0.6;
      } else {
        this.slapperRig.leftLeg.rotation.x = 0;
        this.slapperRig.rightLeg.rotation.x = 0;
        if (!this.slapTriggered) {
          this.slapTriggered = true;
          this.audio.playSlap();
          this.cameraShake = 0.75;
          this.flashScreen('amber', 0.22);
          this.spawnBurst(this.playerX, this.playerY + 1.0, this.playerZ, 0xfef08a, 10);
          const deathQuip = FUNNY_DEATH_LINES_BN[Math.floor(Math.random() * FUNNY_DEATH_LINES_BN.length)];
          this.pushPopup('ঠাস! চড় খেলেন হিরো!', deathQuip, 'danger');
        }
        const slapSwing = Math.sin(Math.min(1, (1.4 - this.crashTimer) * 4) * Math.PI) * 2.2;
        this.slapperRig.rightArmPivot.rotation.x = -slapSwing;
      }

      _camTarget.set(this.playerX + 3.6, this.playerY + 2.2, this.playerZ + 4.2);
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-6 * dt));
      _lookTarget.set(this.playerX, this.playerY + 0.85, this.playerZ);
      this.camera.lookAt(_lookTarget);

      if (this.crashTimer <= 0) {
        this.gameState = GameState.GAME_OVER;
        this.resetProgressionStorage();
        this.audio.playGameOver();
        this.emitHud();
      } else {
        this.hudEmitAccumulator += dt;
        if (this.hudEmitAccumulator >= 0.08) {
          this.hudEmitAccumulator = 0;
          this.emitHud();
        }
      }
      return;
    }

    if (this.gameState === GameState.SHOWROOM) {
      this.audio.updateEngine(0, false, false, this.getActiveBikeSpec().tier);
      this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
      this.heroRig.group.rotation.set(0, this.playerYaw, 0);
      this.heroRig.leanGroup.rotation.set(0, 0, 0);

      const angle = this.elapsedSec * 0.55;
      _camTarget.set(
        this.playerX + Math.sin(angle) * 4.2,
        1.95,
        this.playerZ + Math.cos(angle) * 4.2
      );
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-5 * dt));
      _lookTarget.set(this.playerX, 0.85, this.playerZ);
      this.camera.lookAt(_lookTarget);
      this.sunLight.position.set(this.playerX + 28, 46, this.playerZ + 22);
      this.sunLight.target.position.set(this.playerX, 0, this.playerZ - 12);
      return;
    }

    if (this.gameState === GameState.GAME_OVER) {
      this.audio.updateEngine(0, false, false, this.getActiveBikeSpec().tier);
      return;
    }

    // === PLAYING STATE ===
    const bikeSpec = this.getActiveBikeSpec();
    if (this.postHitRecoveryTimer > 0) this.postHitRecoveryTimer -= dt;
    if (this.freeNitroTimer > 0) this.freeNitroTimer = Math.max(0, this.freeNitroTimer - dt);
    if (this.showroomExitCooldown > 0) this.showroomExitCooldown = Math.max(0, this.showroomExitCooldown - dt);

    const hasFuel = this.fuelAmount > 0.05;
    const hasFreeNitro = this.freeNitroTimer > 0;
    const isBoosting = (this.input.boost && hasFuel && this.forwardSpeed > 4) || (hasFreeNitro && this.forwardSpeed > 2);
    if (isBoosting && !this.wasBoosting) {
      this.audio.playWhoosh();
    }
    this.wasBoosting = isBoosting;

    // 1. Longitudinal Speed Drive Model (Scaled by Hero Bike Tier)
    const maxFwdMps =
      !hasFuel && !hasFreeNitro
        ? GAME_CONFIG.MAX_SPEED_EMPTY_MPS
        : isBoosting
          ? bikeSpec.maxBoostMps
          : bikeSpec.maxNormalMps;
    const maxRevMps = -GAME_CONFIG.MAX_REVERSE_MPS;

    const brakingWithTouchBrake = this.input.brake && this.forwardSpeed > 2.5;
    const reversingWithTouchBrake = this.input.brake && this.forwardSpeed <= 2.5;

    let accel = 0;
    if (this.input.handbrake || brakingWithTouchBrake) {
      accel = this.forwardSpeed > 0.5 ? -32 : this.forwardSpeed < -0.5 ? 24 : 0;
      if (Math.abs(this.forwardSpeed) <= 0.5) this.forwardSpeed = 0;
    } else if (this.input.reverse || reversingWithTouchBrake) {
      accel = this.forwardSpeed > 1.2 ? -26 : -11;
    } else if (this.input.accelerate || hasFreeNitro) {
      accel = (isBoosting ? 24 : hasFuel ? 14.5 : 6.0) * bikeSpec.accelMult;
    } else {
      accel = -Math.sign(this.forwardSpeed) * 4.5;
      if (Math.abs(this.forwardSpeed) < 0.35) this.forwardSpeed = 0;
    }

    this.forwardSpeed = THREE.MathUtils.clamp(this.forwardSpeed + accel * dt, maxRevMps, maxFwdMps);
    if (!isBoosting && this.forwardSpeed > (hasFuel ? bikeSpec.maxNormalMps : GAME_CONFIG.MAX_SPEED_EMPTY_MPS)) {
      this.forwardSpeed = THREE.MathUtils.damp(
        this.forwardSpeed,
        hasFuel ? bikeSpec.maxNormalMps : GAME_CONFIG.MAX_SPEED_EMPTY_MPS,
        2.6,
        dt
      );
    }

    // 2. Smoothed Speed-Scaled Steering + Natural Curve-Follow Assist around 90° bends
    const rawSteer = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
    const steerRate = rawSteer !== 0 ? 5.4 : 14.0;
    this.smoothedSteer = THREE.MathUtils.damp(this.smoothedSteer, rawSteer, steerRate, dt);

    const absSpeed = Math.abs(this.forwardSpeed);
    const speedNorm = THREE.MathUtils.clamp(absSpeed / bikeSpec.maxBoostMps, 0, 1);
    const turnAuthority = THREE.MathUtils.lerp(1.48, 0.54, speedNorm) * (absSpeed < 1.0 ? 0.35 : 1.0);
    const reverseFlip = this.forwardSpeed < -0.5 ? -1 : 1;
    this.playerYaw += this.smoothedSteer * turnAuthority * reverseFlip * dt;

    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);

    const gripDamp = this.postHitRecoveryTimer > 0 ? 22 : 12;
    this.lateralSlip = THREE.MathUtils.damp(this.lateralSlip, 0, gripDamp, dt);

    this.playerX += (fwdX * this.forwardSpeed + Math.cos(this.playerYaw) * this.lateralSlip) * dt;
    this.playerZ += (fwdZ * this.forwardSpeed - Math.sin(this.playerYaw) * this.lateralSlip) * dt;

    // 3. Project onto Closed Track & Update Elevation Physics
    const prevSegIdx = this.playerSegHint;
    if (this.playerLayer === 'surface' || this.playerLayer === 'uttara_tongi_flyover') {
      projectToTrack(this.playerX, this.playerZ, this.playerSegHint, _trackProj);
      this.playerS = _trackProj.s;
      this.playerLat = _trackProj.lat;
      this.playerSegHint = _trackProj.segIdx;

      // Lap completion when crossing s=0 forward from Curve 8 (seg 15) -> Leg 1 (seg 0)
      if (prevSegIdx >= 14 && this.playerSegHint <= 1 && this.distanceMeters > 1000) {
        this.lapCount += 1;
        this.addPoints(250);
        this.pushPopup(`ল্যাপ ${this.lapCount} বোনাস!`, '+250 Dhaka Circuit Bonus', 'bonus');
        this.audio.playDing(this.combo);
        for (const inter of this.world.intersections) {
          inter.violatedThisPass = false;
          inter.bonusAwardedThisPass = false;
        }
      }

      // Smooth curve-follow assist along 90-degree highway bends (only when moving forward in track direction)
      const activeSeg = TRACK_SEGMENTS[this.playerSegHint];
      if (activeSeg.kind === 'arc' && this.playerLayer === 'surface' && this.forwardSpeed > 1.5) {
        const dotFwd = fwdX * _trackProj.tx + fwdZ * _trackProj.tz;
        if (dotFwd > 0.35) {
          const arcStepYaw = -activeSeg.angleDir * ((this.forwardSpeed * dt) / (activeSeg.radius + THREE.MathUtils.clamp(this.playerLat, -25, 25)));
          this.playerYaw += arcStepYaw * 0.9;
          if (rawSteer === 0) {
            const diff = shortestAngleDiff(_trackProj.yaw, this.playerYaw);
            if (Math.abs(diff) < 0.65) {
              this.playerYaw += diff * Math.min(1, 2.2 * dt);
            }
          }
        }
      }
    } else if (this.playerLayer !== 'kuril_300ft_ramp') {
      // On Elevated Expressway / Banani Down-Ramp / Direct Airport-Gazipur Corridor (Northbound X=0 corridor)
      this.playerS = Math.abs(this.playerZ);
      this.playerLat = this.playerX;
    }

    this.updateElevationPhysics();
    this.resolveSolidCollisions();

    if (this.forwardSpeed > 0) {
      const distDelta = this.forwardSpeed * dt;
      this.distanceMeters += distDelta;
      this.addPoints(distDelta * (0.4 + speedNorm * 0.9) * (isBoosting ? 1.35 : 1) * (this.combo >= 5 ? 1.25 : 1));
    }

    this.bankSaveAccum += dt;
    if (this.bankSaveAccum >= 1.5) {
      this.bankSaveAccum = 0;
      this.saveHeroBank(this.heroBankScore);
    }

    // 4. Fuel ("তেল / জ্বালানি") + Animated Pump Hose
    const speedKmh = Math.round(absSpeed * GAME_CONFIG.SPEED_KMH_FACTOR);
    if (absSpeed > 1.2 && hasFuel && !hasFreeNitro) {
      const burnRate = (0.4 + (speedKmh / 100) * 2.1) * (this.input.boost ? 2.15 : 1.0) * bikeSpec.fuelBurnMult;
      this.fuelAmount = Math.max(0, this.fuelAmount - burnRate * dt);
    }

    if (speedKmh >= 130 && this.getCurrentMission().kind === 'highSpeed') {
      this.highSpeedSecAccum += dt;
      if (this.highSpeedSecAccum >= 1) {
        this.highSpeedSecAccum -= 1;
        this.advanceMission('highSpeed', 1);
      }
    } else {
      this.highSpeedSecAccum = 0;
    }

    const activeStation = this.getActiveFuelStation();
    const inFuelZone = activeStation !== null;
    let isRefueling = false;
    const fuelPct = this.getFuelPercent();

    if (!inFuelZone) {
      this.refuelBonusGiven = false;
      this.refuelShieldUsedThisStop = false;
    }

    if (activeStation && speedKmh <= GAME_CONFIG.FUEL_REFILL_MAX_SPEED_KMH && fuelPct < 99.9) {
      isRefueling = true;
      if (!this.refuelShieldUsedThisStop) {
        this.refuelShieldUsedThisStop = true;
        this.refuelSafeGraceTimer = 2.0;
      }
      const capScale = bikeSpec.fuelCapacity / 100;
      this.fuelAmount = Math.min(
        bikeSpec.fuelCapacity,
        this.fuelAmount + GAME_CONFIG.FUEL_REFILL_RATE_PER_SEC * capScale * dt
      );
      this.audio.playRefuelTick(this.getFuelPercent());
      this.updateFuelHose(activeStation);
      if (this.getFuelPercent() >= 99.5 && !this.refuelBonusGiven) {
        this.refuelBonusGiven = true;
        this.addPoints(100);
        this.audio.playTankFull();
        this.flashScreen('green', 0.25);
        this.pushPopup('ট্যাংক ফুল!', `তেল ${bikeSpec.fuelCapacity}L ১০০% • +100 pts`, 'refuel');
      }
    } else {
      this.fuelHoseGroup.visible = false;
    }

    if (this.refuelSafeGraceTimer > 0) {
      this.refuelSafeGraceTimer = Math.max(0, this.refuelSafeGraceTimer - dt);
    }

    if (this.fuelAmount <= 0 && !inFuelZone && speedKmh < 4) {
      this.emptyStoppedTimer += dt;
      if (this.emptyStoppedTimer >= GAME_CONFIG.EMPTY_STOPPED_GAMEOVER_SEC) {
        this.triggerOutOfFuel();
        return;
      }
    } else {
      this.emptyStoppedTimer = 0;
    }

    // 5. Niloy Hero Showroom Entry
    const activeShowroom = this.getActiveShowroom();
    if (!activeShowroom) {
      this.showroomVisitedLock = false;
      this.showroomSaluteLock = false;
    } else if (!this.showroomSaluteLock) {
      this.showroomSaluteLock = true;
      this.pushPopup('স্যালুট বস! শোরুমে স্বাগতম!', 'নিলয় হিরো টিম আপনাকে স্বাগত জানাচ্ছে!', 'bonus');
    }
    const showShowroomBanner =
      activeShowroom !== null && !this.showroomVisitedLock && this.showroomExitCooldown <= 0;
    if (showShowroomBanner && speedKmh <= GAME_CONFIG.SHOWROOM_MAX_SPEED_KMH) {
      this.saveHeroBank(this.heroBankScore);
      this.forwardSpeed = 0;
      this.lateralSlip = 0;
      this.handleWindowBlur();
      this.showroomVisitedLock = true;
      this.showroomReturnState = GameState.PLAYING;
      this.gameState = GameState.SHOWROOM;
      this.audio.updateEngine(0, false, false, bikeSpec.tier);
      this.audio.playShowroomOpen();
      this.emitHud(false, inFuelZone, false);
      return;
    }

    // 6. Violations: Wrong-Way & Sidewalk
    this.updateViolations(dt, speedKmh);

    // 7. Hero Bike Kinematics & Exhaust Smoke
    const targetLean = this.smoothedSteer * 0.36 * THREE.MathUtils.clamp(absSpeed / 10, 0.2, 1.0);
    this.bikeLean = THREE.MathUtils.damp(this.bikeLean, targetLean, 10, dt);
    const targetPitch = this.input.handbrake || brakingWithTouchBrake ? -0.09 : isBoosting ? 0.08 : 0;
    this.bikePitch = THREE.MathUtils.damp(this.bikePitch, targetPitch, 8, dt);

    this.heroRig.group.position.set(this.playerX, this.playerY, this.playerZ);
    this.heroRig.group.rotation.set(0, this.playerYaw, 0);
    this.heroRig.leanGroup.rotation.set(this.bikePitch + this.playerSlopeRad, 0, this.bikeLean);
    this.heroRig.frontFork.rotation.y = THREE.MathUtils.damp(
      this.heroRig.frontFork.rotation.y,
      this.smoothedSteer * 0.24,
      12,
      dt
    );

    const wheelAng = (this.forwardSpeed / 0.33) * dt;
    this.heroRig.frontWheel.rotation.x -= wheelAng;
    this.heroRig.rearWheel.rotation.x -= wheelAng;

    this.heroRig.brakeLightMat.emissiveIntensity =
      this.input.handbrake || this.input.brake || this.input.reverse ? 3.2 : 0.7;
    this.heroRig.boostFlame.visible = isBoosting;
    if (isBoosting) {
      this.heroRig.boostFlame.scale.set(
        0.9 + Math.random() * 0.35,
        0.8 + Math.random() * 0.6,
        0.9 + Math.random() * 0.35
      );
    }

    this.exhaustAccumulator += dt * (isBoosting ? 28 : 8 + absSpeed * 0.35);
    if (this.exhaustAccumulator >= 1) {
      this.exhaustAccumulator = 0;
      this.heroRig.exhaustTip.getWorldPosition(_exhaustWorldPos);
      this.spawnParticle(
        _exhaustWorldPos.x,
        _exhaustWorldPos.y,
        _exhaustWorldPos.z,
        -fwdX * 1.4 + (Math.random() - 0.5) * 0.4,
        0.65 + Math.random() * 0.5,
        -fwdZ * 1.4 + (Math.random() - 0.5) * 0.4,
        isBoosting ? 0x93c5fd : 0xd1d5db,
        0.46,
        0.25,
        1.15
      );
    }

    // 8. Collisions, Pickups, Pedestrians, Signals
    this.checkTrafficCollisions(speedKmh, isBoosting);
    if (this.gameState !== GameState.PLAYING) return;

    this.updatePickups(dt);

    this.checkPedestrianInteractions(isBoosting);
    if (this.gameState !== GameState.PLAYING) return;

    this.checkIntersections(speedKmh);

    // 9. Combo, Funny Messages & Ambient Horns
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 1;
    }
    if (this.violationTimer > 0) {
      this.violationTimer -= dt;
      if (this.violationTimer <= 0) this.activeViolation = null;
    }
    if (this.popupTimer > 0) {
      this.popupTimer -= dt;
      if (this.popupTimer <= 0) this.latestPopup = null;
    }

    this.updateFunnyMessages(dt, speedKmh);

    this.ambientHornTimer -= dt;
    if (this.ambientHornTimer <= 0) {
      this.ambientHornTimer = 9 + Math.random() * 8;
      if (absSpeed > 4) this.audio.playHorn(0.65 + Math.random() * 0.55, true);
    }

    this.audio.updateEngine(speedKmh, isBoosting, true, bikeSpec.tier);

    if (Math.floor(this.score) > this.bestScore) {
      this.bestScore = Math.floor(this.score);
      this.isNewBest = true;
    }

    this.updateChaseCamera(dt, isBoosting);
    this.sunLight.position.set(this.playerX + 28, this.playerY + 46, this.playerZ + 22);
    this.sunLight.target.position.set(this.playerX, this.playerY, this.playerZ - 16);

    this.hudEmitAccumulator += dt;
    if (this.hudEmitAccumulator >= 0.05 || isRefueling) {
      this.hudEmitAccumulator = 0;
      this.emitHud(isRefueling, inFuelZone, showShowroomBanner);
    }
  }

  private updateElevationPhysics(): void {
    const sp = ELEVATED_EXPRESSWAY_DEF;
    const uf = UTTARA_TONGI_FLYOVER_DEF;
    const fwdZ = -Math.cos(this.playerYaw);

    // A. Optional Banani Exit Down-Ramp (Z: -325 -> -405, curving out left to x=-12 then back to x=-6.8 at y=0)
    if (this.playerLayer === 'banani_exit_ramp') {
      if (this.playerZ > sp.bananiExitStartZ + 0.5) {
        this.playerLayer = 'elevated_expressway';
        const sampled = sampleExpresswayMainHeight(this.playerZ);
        this.playerY = sampled.y;
        this.playerSlopeRad = sampled.slopeRad * (fwdZ <= 0 ? 1 : -1);
        return;
      }
      if (this.playerZ < sp.bananiExitEndZ) {
        this.playerLayer = 'surface';
        this.playerY = 0;
        this.playerSlopeRad = 0;
        projectToTrack(this.playerX, this.playerZ, 0, _trackProj);
        this.playerS = _trackProj.s;
        this.playerLat = _trackProj.lat;
        this.playerSegHint = _trackProj.segIdx;
        this.pushPopup('বনানী নামলেন!', 'সামনে কুর্মিটোলা থেকে ডানে ৯০° বাঁক ↱ ৩০০ ফিট!', 'bonus');
        return;
      }
      const b = sampleBananiDownRamp(this.playerZ);
      this.playerY = b.y;
      this.playerSlopeRad = b.slopeRad * (fwdZ <= 0 ? 1 : -1);
      this.playerX = THREE.MathUtils.clamp(this.playerX, b.centerX - (b.halfWidth - 0.52), b.centerX + (b.halfWidth - 0.52));
      return;
    }

    // A2. Drivable Kuril Flyover Ramp (climbs at Z=-714 -> 9.4m above Expressway -> lands on 300ft at X=242, Z=-864.5)
    if (this.playerLayer === 'kuril_300ft_ramp') {
      const proj = projectToKurilRamp(this.playerX, this.playerZ);
      const rs = proj.sample;
      if (rs.u <= 0.005 && this.playerZ > KURIL_300FT_RAMP_DEF.startZ + 0.5) {
        this.playerLayer = 'surface';
        this.playerY = 0;
        this.playerSlopeRad = 0;
        projectToTrack(this.playerX, this.playerZ, 0, _trackProj);
        this.playerS = _trackProj.s;
        this.playerLat = _trackProj.lat;
        this.playerSegHint = _trackProj.segIdx;
        return;
      }
      if (
        rs.u >= 0.992 ||
        (this.playerX >= KURIL_300FT_RAMP_DEF.endX - 0.5 && this.playerZ > -896 && this.playerZ < -832)
      ) {
        this.playerLayer = 'surface';
        this.playerY = 0;
        this.playerSlopeRad = 0;
        projectToTrack(this.playerX, this.playerZ, 2, _trackProj);
        this.playerS = _trackProj.s;
        this.playerLat = _trackProj.lat;
        this.playerSegHint = _trackProj.segIdx;
        this.pushPopup('পূর্বাচল ৩০০ ফিট এক্সপ্রেসওয়ে!', 'বসুন্ধরা R/A → হাউজিং বিলবোর্ড → নীলা মার্কেট!', 'bonus');
        return;
      }
      const fwdX = -Math.sin(this.playerYaw);
      const alongDot = fwdX * rs.tx + fwdZ * rs.tz;
      this.playerY = rs.y;
      this.playerSlopeRad = rs.slopeRad * (alongDot >= 0 ? 1 : -1);
      this.playerS = 720 + rs.u * 336;
      this.playerLat = proj.lat;

      const maxHalf = rs.halfWidth - 0.52;
      if (Math.abs(proj.lat) > maxHalf) {
        const clLat = THREE.MathUtils.clamp(proj.lat, -maxHalf, maxHalf);
        this.playerX = rs.x + rs.nx * clLat;
        this.playerZ = rs.z + rs.nz * clLat;
        this.playerLat = clLat;
      }
      return;
    }

    // A3. Ground-Level Direct Airport Rd -> Kuril -> Kawla -> Gazipur Connector (X=0, Z in [-755 .. -1175])
    if (this.playerLayer === 'airport_gazipur_direct') {
      this.playerY = 0;
      this.playerSlopeRad = 0;
      this.playerS = Math.abs(this.playerZ);
      this.playerLat = this.playerX;
      if (this.playerZ > -755) {
        this.playerLayer = 'surface';
        projectToTrack(this.playerX, this.playerZ, 0, _trackProj);
        this.playerS = _trackProj.s;
        this.playerLat = _trackProj.lat;
        this.playerSegHint = _trackProj.segIdx;
        return;
      }
      if (this.playerZ < -1175) {
        this.playerLayer = 'surface';
        projectToTrack(this.playerX, this.playerZ, 8, _trackProj);
        this.playerS = _trackProj.s;
        this.playerLat = _trackProj.lat;
        this.playerSegHint = _trackProj.segIdx;
        this.pushPopup('সোজা উত্তরা → টঙ্গী → গাজীপুর!', 'এয়ারপোর্ট পেরিয়ে গাজীপুর চৌরাস্তার পথে!', 'bonus');
        return;
      }
      return;
    }

    // B. Mainline Dhaka Elevated Expressway (X=0, Z: -260 Mohakhali -> -895 Kawla Toll -> -1080 Airport)
    if (this.playerLayer === 'elevated_expressway') {
      if (this.playerZ > sp.startZ + 0.4 || this.playerZ < sp.endZ - 0.4) {
        this.playerLayer = 'surface';
        this.playerY = 0;
        this.playerSlopeRad = 0;
        // If exiting at Airport (-1080), project seamlessly into Curve 5 / Leg 6 Airport-Diabari!
        const hint = this.playerZ < -950 ? 9 : 0;
        projectToTrack(this.playerX, this.playerZ, hint, _trackProj);
        this.playerS = _trackProj.s;
        this.playerLat = _trackProj.lat;
        this.playerSegHint = _trackProj.segIdx;
        if (this.playerZ < -950) {
          this.pushPopup('বিমানবন্দর ল্যান্ডিং!', 'ডানে দিয়াবাড়ি হয়ে মেট্রো রেল (MRT-6) ধরুন!', 'bonus');
        }
        return;
      }

      // Check Optional Banani Exit Down-Ramp peel-off across the open Y-fork (Z in [-440 .. -482])
      const inBananiOpening = this.playerZ <= sp.bananiExitStartZ && this.playerZ >= sp.bananiExitForkClearZ;
      if (inBananiOpening) {
        const b = sampleBananiDownRamp(this.playerZ);
        const onBranchMouth =
          this.playerX < -9.0 ||
          (this.playerZ <= sp.bananiExitStartZ - 14 && this.playerX < b.centerX + b.halfWidth - 0.5 && this.playerX < -6.6);
        if (onBranchMouth) {
          this.playerLayer = 'banani_exit_ramp';
          this.playerY = b.y;
          this.playerSlopeRad = b.slopeRad * (fwdZ <= 0 ? 1 : -1);
          this.playerX = THREE.MathUtils.clamp(
            this.playerX,
            b.centerX - (b.halfWidth - 0.52),
            b.centerX + (b.halfWidth - 0.52)
          );
          this.pushPopup('বনানী এক্সিট র‍্যাম্পে ↓', 'ক্যান্টনমেন্ট • নৌবাহিনী • কুর্মিটোলা হাসপাতাল!', 'bonus');
          return;
        }
      }

      const sampled = sampleExpresswayMainHeight(this.playerZ);
      this.playerY = sampled.y;
      this.playerSlopeRad = sampled.slopeRad * (fwdZ <= 0 ? 1 : -1);

      if (sampled.zone === 'deck') {
        const nearEntry = this.playerZ > sp.deckStartZ - 9;
        const nearExit = this.playerZ < sp.deckEndZ + 9;
        if ((nearEntry || nearExit) && Math.abs(this.playerX) < 4.55) {
          const pushSide = this.playerX <= 0 ? -1 : 1;
          this.playerX += pushSide * Math.min(0.45, 4.65 - Math.abs(this.playerX));
        }

        // Open left parapet cleanly across Banani Y-fork [-440 .. -482]
        let minDeckX = sp.deckMinX + 0.55;
        if (inBananiOpening) {
          const b = sampleBananiDownRamp(this.playerZ);
          minDeckX = Math.min(minDeckX, b.centerX - (b.halfWidth - 0.52));
        }
        this.playerX = THREE.MathUtils.clamp(this.playerX, minDeckX, sp.deckMaxX - 0.55);

        if (Math.abs(this.playerZ - sp.tollPlazaZ) < 2.65) {
          for (const bx of [-8.6, -4.6, 0, 4.6, 8.6]) {
            const dx = this.playerX - bx;
            if (Math.abs(dx) < 0.85) {
              this.playerX = bx + (dx >= 0 ? 0.85 : -0.85);
            }
          }
        }
      } else {
        if (this.playerX <= 0) {
          this.playerX = THREE.MathUtils.clamp(this.playerX, sp.rampLeftMinX + 0.52, sp.rampLeftMaxX - 0.52);
        } else {
          this.playerX = THREE.MathUtils.clamp(this.playerX, sp.rampRightMinX + 0.52, sp.rampRightMaxX - 0.52);
        }
      }
      return;
    }

    // C. Uttara-Tongi Flyover (along Leg 5 s = 9780..10400)
    if (this.playerLayer === 'uttara_tongi_flyover') {
      if (this.playerS < uf.startS - 0.4 || this.playerS > uf.endS + 0.4 || this.playerSegHint !== 8) {
        this.playerLayer = 'surface';
        this.playerY = 0;
        this.playerSlopeRad = 0;
        return;
      }

      const sampled = sampleUttaraFlyoverHeight(this.playerS);
      const fwdS = -Math.sin(this.playerYaw) * _trackProj.tx - Math.cos(this.playerYaw) * _trackProj.tz;
      this.playerY = sampled.y;
      this.playerSlopeRad = sampled.slopeRad * (fwdS >= 0 ? 1 : -1);

      let clampedLat = this.playerLat;
      if (sampled.zone === 'deck') {
        const nearStart = this.playerS < uf.deckStartS + 9;
        const nearEnd = this.playerS > uf.deckEndS - 9;
        if ((nearStart || nearEnd) && Math.abs(clampedLat) < 4.55) {
          const pushSide = clampedLat <= 0 ? -1 : 1;
          clampedLat += pushSide * Math.min(0.45, 4.65 - Math.abs(clampedLat));
        }
        clampedLat = THREE.MathUtils.clamp(clampedLat, uf.deckMinLat + 0.55, uf.deckMaxLat - 0.55);
      } else {
        if (clampedLat <= 0) {
          clampedLat = THREE.MathUtils.clamp(clampedLat, uf.rampLeftMinLat + 0.52, uf.rampLeftMaxLat - 0.52);
        } else {
          clampedLat = THREE.MathUtils.clamp(clampedLat, uf.rampRightMinLat + 0.52, uf.rampRightMaxLat - 0.52);
        }
      }

      if (clampedLat !== this.playerLat) {
        sampleTrackPose(this.playerS, clampedLat, _poseTmp);
        this.playerX = _poseTmp.x;
        this.playerZ = _poseTmp.z;
        this.playerLat = clampedLat;
      }
      return;
    }

    // D. Ground Level ('surface'): check entry latch onto Mohakhali Expressway, Kuril 300ft Flyover, Straight Gazipur Route, or Uttara-Tongi Flyover
    this.playerY = 0;
    this.playerSlopeRad = 0;

    // 1. Check Elevated Expressway Mohakhali Entry (Leg 1 near X=0, Z in [-210..-625])
    if (this.playerSegHint === 0 && Math.abs(this.playerX) < 11.5 && this.playerZ <= sp.startZ && this.playerZ >= sp.endZ) {
      const sampled = sampleExpresswayMainHeight(this.playerZ);
      if (sampled.zone === 'entry' || sampled.zone === 'exit') {
        const inLeft = this.playerX >= sp.rampLeftMinX - 0.35 && this.playerX <= sp.rampLeftMaxX + 0.35;
        const inRight = this.playerX >= sp.rampRightMinX - 0.35 && this.playerX <= sp.rampRightMaxX + 0.35;
        if (inLeft || inRight) {
          if (sampled.y <= 0.85 && sampled.zone === 'entry') {
            this.playerLayer = 'elevated_expressway';
            this.playerY = sampled.y;
            this.playerSlopeRad = sampled.slopeRad * (fwdZ <= 0 ? 1 : -1);
            this.pushPopup('ঢাকা এলিভেটেড এক্সপ্রেসওয়ে', 'বামে নামলে বনানী (৩০০ ফিট) | সোজা বিমানবন্দর!', 'bonus');
            return;
          } else {
            if (inLeft) {
              const mid = (sp.rampLeftMinX + sp.rampLeftMaxX) * 0.5;
              this.playerX = this.playerX < mid ? sp.rampLeftMinX - 0.42 : sp.rampLeftMaxX + 0.42;
            } else {
              const mid = (sp.rampRightMinX + sp.rampRightMaxX) * 0.5;
              this.playerX = this.playerX < mid ? sp.rampRightMinX - 0.42 : sp.rampRightMaxX + 0.42;
            }
          }
        }
      }
    }

    // 1b. Check Kuril Flyover Up-Ramp Entry after Kurmitola Hospital (Z in [-714 .. -750], left side X in [-11.5 .. -4.5])
    if (
      this.playerSegHint === 0 &&
      this.playerZ <= KURIL_300FT_RAMP_DEF.startZ &&
      this.playerZ >= -752 &&
      this.playerX <= -4.55 &&
      this.playerX >= -11.5
    ) {
      const proj = projectToKurilRamp(this.playerX, this.playerZ);
      if (proj.sample.y <= 0.95) {
        this.playerLayer = 'kuril_300ft_ramp';
        this.playerY = proj.sample.y;
        const fwdX = -Math.sin(this.playerYaw);
        const alongDot = fwdX * proj.sample.tx + fwdZ * proj.sample.tz;
        this.playerSlopeRad = proj.sample.slopeRad * (alongDot >= 0 ? 1 : -1);
        this.pushPopup('কুড়িল ফ্লাইওভার র‍্যাম্পে ↑', 'উপরে উঠে পূর্বাচল ৩০০ ফিট রাস্তায় নামুন!', 'bonus');
        return;
      }
    }

    // 1c. Check Straight Airport -> Uttara -> Tongi -> Gazipur Route (continuing straight North past Kuril Z < -766)
    if (
      this.playerSegHint <= 1 &&
      this.playerZ < -766 &&
      Math.abs(this.playerX) < 11.2 &&
      fwdZ < -0.78
    ) {
      this.playerLayer = 'airport_gazipur_direct';
      this.playerY = 0;
      this.playerSlopeRad = 0;
      this.playerS = Math.abs(this.playerZ);
      this.playerLat = this.playerX;
      this.pushPopup('সোজা গাজীপুর এক্সপ্রেস রুট!', 'বিমানবন্দর → উত্তরা → টঙ্গী → গাজীপুর চৌরাস্তা!', 'bonus');
      return;
    }

    // 2. Check Uttara-Tongi Flyover Entry (Leg 5, s in [9780..10400])
    if (this.playerSegHint === 8 && this.playerS >= uf.startS && this.playerS <= uf.endS) {
      const sampled = sampleUttaraFlyoverHeight(this.playerS);
      if (sampled.zone === 'entry' || sampled.zone === 'exit') {
        const inLeft = this.playerLat >= uf.rampLeftMinLat - 0.35 && this.playerLat <= uf.rampLeftMaxLat + 0.35;
        const inRight = this.playerLat >= uf.rampRightMinLat - 0.35 && this.playerLat <= uf.rampRightMaxLat + 0.35;
        if (inLeft || inRight) {
          if (sampled.y <= 0.85) {
            this.playerLayer = 'uttara_tongi_flyover';
            this.playerY = sampled.y;
            const fwdS = -Math.sin(this.playerYaw) * _trackProj.tx - Math.cos(this.playerYaw) * _trackProj.tz;
            this.playerSlopeRad = sampled.slopeRad * (fwdS >= 0 ? 1 : -1);
            this.pushPopup('উত্তরা–টঙ্গী ফ্লাইওভার', 'তুরাগ নদীর উপর দিয়ে উড়াল দিন!', 'bonus');
            return;
          } else {
            const clampedLat = inLeft
              ? (this.playerLat < (uf.rampLeftMinLat + uf.rampLeftMaxLat) * 0.5 ? uf.rampLeftMinLat - 0.42 : uf.rampLeftMaxLat + 0.42)
              : (this.playerLat < (uf.rampRightMinLat + uf.rampRightMaxLat) * 0.5 ? uf.rampRightMinLat - 0.42 : uf.rampRightMaxLat + 0.42);
            sampleTrackPose(this.playerS, clampedLat, _poseTmp);
            this.playerX = _poseTmp.x;
            this.playerZ = _poseTmp.z;
            this.playerLat = clampedLat;
          }
        }
      }
    }
  }

  private resolveSolidCollisions(): void {
    const bikeR = 0.52;
    let scraped = false;

    if (this.playerLayer === 'airport_gazipur_direct') {
      if (Math.abs(this.playerX) > 12.2) {
        this.playerX = Math.sign(this.playerX) * 12.2;
        scraped = true;
      }
      if (Math.abs(this.playerX) < GAME_CONFIG.MEDIAN_HALF_WIDTH + 0.36) {
        this.playerX = (this.playerX <= 0 ? -1 : 1) * (GAME_CONFIG.MEDIAN_HALF_WIDTH + 0.36);
        scraped = true;
      }
      if (scraped && Math.abs(this.forwardSpeed) > 3) {
        this.lateralSlip = 0;
        this.forwardSpeed *= 0.96;
        this.cameraShake = Math.max(this.cameraShake, 0.16);
        this.audio.playThud();
      }
      return;
    }

    if (this.playerLayer !== 'surface') {
      return;
    }

    const prof = getRoadProfileAtS(this.playerS);

    // 1. Dynamic Track Perimeter Walls (300ft ±56m, Dhaka Bypass ±42m, Urban ±32m)
    const maxLat = prof.perimeterLat - 0.85;
    if (Math.abs(this.playerLat) > maxLat) {
      const clamped = Math.sign(this.playerLat) * maxLat;
      sampleTrackPose(this.playerS, clamped, _poseTmp);
      this.playerX = _poseTmp.x;
      this.playerZ = _poseTmp.z;
      this.playerLat = clamped;
      scraped = true;
    }

    // 2. Dynamic Center Median Dividers (wide 10.4m tree island on 300ft, 4m on Bypass, 1.44m urban)
    const atClearJunction =
      CROSS_INTERSECTION_S.some((is) => Math.abs(shortestTrackDeltaS(this.playerS, is)) < 11) ||
      Math.abs(shortestTrackDeltaS(this.playerS, TRACK_LANDMARKS_S.GAZIPUR_CHOURASTA_S)) < 17 ||
      isSInAnyRiver(this.playerS, 6) !== null;
    if (!atClearJunction && Math.abs(this.playerLat) < prof.medianHalfWidth + 0.36) {
      const targetLat = (this.playerLat <= 0 ? -1 : 1) * (prof.medianHalfWidth + 0.36);
      sampleTrackPose(this.playerS, targetLat, _poseTmp);
      this.playerX = _poseTmp.x;
      this.playerZ = _poseTmp.z;
      this.playerLat = targetLat;
      scraped = true;
    }

    // 2b. Purbachal 300ft Left/Right Service Road Tree Separator Islands (lat ±[17.5, 20.5])
    if (prof.hasServiceSeparators && isSInAnyRiver(this.playerS, 6) === null) {
      const absLat = Math.abs(this.playerLat);
      if (absLat >= prof.serviceSepInnerLat - 0.32 && absLat <= prof.serviceSepOuterLat + 0.32) {
        const midSep = (prof.serviceSepInnerLat + prof.serviceSepOuterLat) * 0.5;
        const targetAbs = absLat < midSep ? prof.serviceSepInnerLat - 0.36 : prof.serviceSepOuterLat + 0.36;
        const targetLat = Math.sign(this.playerLat) * targetAbs;
        sampleTrackPose(this.playerS, targetLat, _poseTmp);
        this.playerX = _poseTmp.x;
        this.playerZ = _poseTmp.z;
        this.playerLat = targetLat;
        scraped = true;
      }
    }

    // 3. River Bridge Guardrails over Balu, Shitalakshya (Kanchan), & Turag Rivers
    const riverSpan = isSInAnyRiver(this.playerS, 1);
    if (riverSpan !== null) {
      const bridgeLim = riverSpan.deckHalfWidth + 0.55;
      if (Math.abs(this.playerLat) > bridgeLim) {
        const targetLat = Math.sign(this.playerLat) * bridgeLim;
        sampleTrackPose(this.playerS, targetLat, _poseTmp);
        this.playerX = _poseTmp.x;
        this.playerZ = _poseTmp.z;
        this.playerLat = targetLat;
        scraped = true;
      }
    }

    // 4. Solid Oriented City Building & Monument Island OBB Colliders
    for (const b of this.world.solidBuildings) {
      const dx = this.playerX - b.cx;
      const dz = this.playerZ - b.cz;
      if (dx * dx + dz * dz > 26 * 26) continue;

      const localU = dx * b.ux + dz * b.uz;
      const localV = dx * b.vx + dz * b.vz;
      const clU = THREE.MathUtils.clamp(localU, -b.halfW, b.halfW);
      const clV = THREE.MathUtils.clamp(localV, -b.halfD, b.halfD);
      const du = localU - clU;
      const dv = localV - clV;
      const distSq = du * du + dv * dv;

      if (distSq < bikeR * bikeR) {
        const dist = Math.sqrt(distSq);
        let pushU = 0;
        let pushV = 0;
        if (dist > 0.0001) {
          const push = bikeR - dist;
          pushU = (du / dist) * push;
          pushV = (dv / dist) * push;
        } else {
          const toEdgeU = b.halfW - Math.abs(localU);
          const toEdgeV = b.halfD - Math.abs(localV);
          if (toEdgeU < toEdgeV) {
            pushU = (localU >= 0 ? 1 : -1) * (toEdgeU + bikeR);
          } else {
            pushV = (localV >= 0 ? 1 : -1) * (toEdgeV + bikeR);
          }
        }
        this.playerX += pushU * b.ux + pushV * b.vx;
        this.playerZ += pushU * b.uz + pushV * b.vz;
        scraped = true;
      }
    }

    if (scraped && Math.abs(this.forwardSpeed) > 3) {
      this.lateralSlip = 0;
      this.forwardSpeed *= 0.96;
      this.cameraShake = Math.max(this.cameraShake, 0.16);
      this.audio.playThud();
      this.spawnParticle(this.playerX, 0.45, this.playerZ, (Math.random() - 0.5) * 4, 2, (Math.random() - 0.5) * 4, 0xfacc15, 0.25, 0.35, 0.05);
    }
  }

  private updateFuelHose(station: FuelStationNode): void {
    _hoseStart.set(station.nozzleX, station.nozzleY, station.nozzleZ);
    this.heroRig.fuelPortTip.getWorldPosition(_fuelPortWorldPos);

    _hoseMid.addVectors(_hoseStart, _fuelPortWorldPos).multiplyScalar(0.5);
    _hoseMid.y -= 0.25;

    const alignSeg = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      mesh.position.copy(a);
      _hoseDir.subVectors(b, a);
      const len = _hoseDir.length();
      mesh.scale.set(1, Math.max(len, 0.01), 1);
      if (len > 0.001) {
        mesh.quaternion.setFromUnitVectors(_upVec, _hoseDir.normalize());
      }
    };
    alignSeg(this.hoseSegA, _hoseStart, _hoseMid);
    alignSeg(this.hoseSegB, _hoseMid, _fuelPortWorldPos);
    this.fuelHoseGroup.visible = true;
  }

  private updateViolations(dt: number, speedKmh: number): void {
    if (this.playerLayer === 'kuril_300ft_ramp') {
      return;
    }
    if (
      this.playerLayer === 'elevated_expressway' ||
      this.playerLayer === 'banani_exit_ramp' ||
      this.playerLayer === 'airport_gazipur_direct'
    ) {
      const fwdZ = -Math.cos(this.playerYaw);
      const wrongWay = this.playerX > 1.2 && fwdZ < -0.35 && speedKmh > 12;
      const onSidewalk = this.playerLayer === 'airport_gazipur_direct' && Math.abs(this.playerX) > 9.75 && speedKmh > 8;
      if (wrongWay) {
        this.activeViolation = 'ভুল দিক! (+15/s নিয়ম ভঙ্গ বোনাস)';
        this.violationTimer = 0.6;
        this.violationPenaltyAccum += 15 * dt;
        this.ruleBreakSecondAccum += dt;
      } else if (onSidewalk) {
        this.activeViolation = 'ফুটপাতে বাইক! (+10/s নিয়ম ভঙ্গ বোনাস)';
        this.violationTimer = 0.6;
        this.violationPenaltyAccum += 10 * dt;
        this.ruleBreakSecondAccum += dt;
      }
    } else {
      sampleTrackPose(this.playerS, 0, _poseTmp);
      const fwdX = -Math.sin(this.playerYaw);
      const fwdZ = -Math.cos(this.playerYaw);
      const alongDot = fwdX * _poseTmp.tx + fwdZ * _poseTmp.tz;

      const prof = getRoadProfileAtS(this.playerS);
      const onRightArteryWrongWay =
        this.playerLat > prof.medianHalfWidth + 0.4 &&
        this.playerLat < prof.halfWidth &&
        alongDot > 0.35 &&
        speedKmh > 12;
      const onSidewalk =
        this.playerLayer === 'surface' &&
        this.world.isOnArterySidewalk(this.playerS, this.playerLat) &&
        speedKmh > 8;

      if (onRightArteryWrongWay) {
        this.activeViolation = 'ভুল দিক! (+15/s নিয়ম ভঙ্গ বোনাস)';
        this.violationTimer = 0.6;
        this.violationPenaltyAccum += 15 * dt;
        this.ruleBreakSecondAccum += dt;
      } else if (onSidewalk) {
        this.activeViolation = 'ফুটপাতে বাইক! (+10/s নিয়ম ভঙ্গ বোনাস)';
        this.violationTimer = 0.6;
        this.violationPenaltyAccum += 10 * dt;
        this.ruleBreakSecondAccum += dt;
      }
    }

    if (this.violationPenaltyAccum >= 1) {
      const reward = Math.floor(this.violationPenaltyAccum);
      this.violationPenaltyAccum -= reward;
      this.addPoints(reward);
    }

    if (this.ruleBreakSecondAccum >= 2.5) {
      this.ruleBreakSecondAccum = 0;
      this.ruleBreakCount += 1;
      this.advanceMission('ruleBreak', 1);
      this.audio.playAccidentAnnouncement();
    }
  }

  private getCurrentMission(): MissionTemplate {
    return MISSION_TEMPLATES[this.missionIdx % MISSION_TEMPLATES.length];
  }

  private advanceMission(kind: MissionKind, amount = 1): void {
    const m = this.getCurrentMission();
    if (m.kind !== kind) return;
    this.missionProgress += amount;
    if (this.missionProgress >= m.target) {
      const bonus = m.reward + this.missionLoop * 150;
      const bikeSpec = this.getActiveBikeSpec();
      this.addPoints(bonus);
      this.combo = Math.min(10, this.combo + 1);
      this.comboTimer = Math.max(this.comboTimer, bikeSpec.comboHoldSec);
      this.audio.playTankFull();
      this.flashScreen('green', 0.22);
      this.pushPopup('মিশন সম্পন্ন!', `${m.titleBn} • +${bonus} pts!`, 'bonus');

      this.missionIdx += 1;
      if (this.missionIdx >= MISSION_TEMPLATES.length) {
        this.missionIdx = 0;
        this.missionLoop += 1;
      }
      this.missionProgress = 0;
    }
  }

  private updatePickups(dt: number): void {
    const bikeSpec = this.getActiveBikeSpec();
    for (const pk of this.pickups) {
      if (pk.respawnTimer > 0) {
        pk.respawnTimer -= dt;
        if (pk.respawnTimer <= 0) {
          const loc = this.samplePickupLocation(pk.id + Math.floor(Math.random() * 5));
          pk.x = loc.x;
          pk.y = loc.y;
          pk.z = loc.z;
          pk.s = loc.s;
          pk.lat = loc.lat;
          pk.layer = loc.layer;
          pk.mesh.visible = true;
        }
        continue;
      }

      const distSq = (pk.x - this.playerX) ** 2 + (pk.z - this.playerZ) ** 2;
      pk.mesh.visible = distSq < 320 * 320;
      if (!pk.mesh.visible) continue;

      pk.phase += dt * 3.2;
      pk.mesh.position.set(pk.x, pk.y + 0.92 + Math.sin(pk.phase) * 0.16, pk.z);
      pk.mesh.rotation.y += dt * 2.8;

      if (
        Math.abs(this.playerY - pk.y) < 2.2 &&
        Math.abs(this.playerX - pk.x) < 1.55 &&
        Math.abs(this.playerZ - pk.z) < 1.55
      ) {
        pk.respawnTimer = 8.0;
        pk.mesh.visible = false;
        this.collectiblesCount += 1;
        this.advanceMission('pickup', 1);

        if (pk.kind === 'coin') {
          const feverMult = this.combo >= 5 ? 2 : 1;
          const pts = 150 * this.combo * feverMult;
          this.addPoints(pts);
          this.comboTimer = Math.max(this.comboTimer, bikeSpec.comboHoldSec);
          this.audio.playDing(this.combo);
          this.spawnBurst(pk.x, pk.y + 1.0, pk.z, 0xfacc15, 10);
          this.pushPopup('৳ টাকা কয়েন!', `+${pts} pts${feverMult > 1 ? ' (FEVER 2x!)' : ''}`, 'bonus');
        } else if (pk.kind === 'fuel') {
          const fuelGain = bikeSpec.fuelCapacity * 0.18;
          this.fuelAmount = Math.min(bikeSpec.fuelCapacity, this.fuelAmount + fuelGain);
          this.audio.playTankFull();
          this.flashScreen('green', 0.18);
          this.spawnBurst(pk.x, pk.y + 1.0, pk.z, 0x22c55e, 10);
          this.pushPopup('পেট্রোল ক্যান!', `+${Math.round(fuelGain)}L তেল (+18%)`, 'refuel');
        } else {
          this.freeNitroTimer = bikeSpec.nitroDurationSec;
          this.audio.playWhoosh();
          this.flashScreen('amber', 0.16);
          this.spawnBurst(pk.x, pk.y + 1.0, pk.z, 0x38bdf8, 12);
          this.pushPopup('নাইট্রো চার্জ!', `ফ্রি টার্বো বুস্ট (${bikeSpec.nitroDurationSec.toFixed(1)} সে.)`, 'bonus');
        }
      }
    }
  }

  private updateTraffic(dt: number): void {
    for (const t of this.traffic) {
      if (t.hitCooldown > 0) t.hitCooldown -= dt;

      if (t.wrecked) {
        t.wreckTimer -= dt;
        t.rig.group.position.y = THREE.MathUtils.damp(t.rig.group.position.y, t.y - 2.5, 4, dt);
        if (t.wreckTimer <= 0) {
          this.recycleVehicle(t);
        }
        continue;
      }

      if (t.frozen) {
        t.currentSpeed = 0;
        continue;
      }

      t.lookaheadTimer -= dt;
      if (t.lookaheadTimer <= 0) {
        t.lookaheadTimer = 0.14;
        t.targetSpeed = this.computeTrafficTargetSpeed(t);
      }

      t.currentSpeed = THREE.MathUtils.damp(t.currentSpeed, t.targetSpeed, 6, dt);
      const wheelSpin = (t.currentSpeed / 0.35) * dt;
      for (const w of t.rig.wheels) w.rotation.x -= wheelSpin;

      if (t.isExpresswayVehicle) {
        // Moves straight North/South on Dhaka Elevated Expressway along X = laneX
        t.z += t.dirZ * t.currentSpeed * dt;
        if (t.z < ELEVATED_EXPRESSWAY_DEF.endZ + 6 || t.z > ELEVATED_EXPRESSWAY_DEF.startZ - 6) {
          t.z = t.dirZ < 0 ? ELEVATED_EXPRESSWAY_DEF.startZ - 14 : ELEVATED_EXPRESSWAY_DEF.endZ + 14;
        }
        const sampled = sampleExpresswayMainHeight(t.z);
        t.y = sampled.y;
        t.rig.group.rotation.x = sampled.slopeRad * (t.dirZ <= 0 ? 1 : -1);
      } else if (!t.isCityVehicle) {
        // Artery Traffic glides smoothly around all 16 segments & flares seamlessly across 300ft 12-lane highway!
        const forwardSign = t.laneIdx <= 1 ? 1 : -1;
        const laneSideSign: 1 | -1 = t.laneIdx <= 1 ? -1 : 1;
        t.s = wrapTrackS(t.s + forwardSign * t.currentSpeed * dt);
        if (t.isPurbachalTraffic && (t.s < 932 || t.s > 3338)) {
          t.s = forwardSign > 0 ? 935 + Math.random() * 60 : 3330 - Math.random() * 60;
        }
        const targetLat = getTrafficLaneLat(t.s, laneSideSign, t.slotNorm);
        t.lat = THREE.MathUtils.damp(t.lat, targetLat, 2.2, dt);

        sampleTrackPose(t.s, t.lat, _poseTmp);
        t.x = _poseTmp.x;
        t.z = _poseTmp.z;
        t.yaw = forwardSign > 0 ? _poseTmp.yaw : _poseTmp.yaw + Math.PI;
        t.dirX = -Math.sin(t.yaw);
        t.dirZ = -Math.cos(t.yaw);
        t.rig.group.rotation.y = t.yaw;

        // Outer lanes (0 & 3) climb & descend Uttara-Tongi Flyover naturally along Leg 5
        if (
          (t.laneIdx === 0 || t.laneIdx === 3) &&
          t.s >= UTTARA_TONGI_FLYOVER_DEF.startS &&
          t.s <= UTTARA_TONGI_FLYOVER_DEF.endS
        ) {
          const uf = sampleUttaraFlyoverHeight(t.s);
          t.layer = 'uttara_tongi_flyover';
          t.y = uf.y;
          t.rig.group.rotation.x = uf.slopeRad * forwardSign;
        } else {
          t.layer = 'surface';
          t.y = 0;
          t.rig.group.rotation.x = 0;
        }

        const distSq = (t.x - this.playerX) ** 2 + (t.z - this.playerZ) ** 2;
        if (distSq > 36 * 36) t.nearMissedThisPass = false;
      } else {
        // Cross-street vehicle moves laterally across track intersection
        const lane = this.world.crossLanes[t.laneIdx];
        t.lat += lane.dirLat * t.currentSpeed * dt;
        if (t.lat < lane.latStart || t.lat > lane.latEnd) {
          t.lat = lane.dirLat > 0 ? lane.latStart + 1 : lane.latEnd - 1;
        }
        sampleTrackPose(t.s, t.lat, _poseTmp);
        t.x = _poseTmp.x;
        t.z = _poseTmp.z;
      }

      const vDistSq = (t.x - this.playerX) ** 2 + (t.z - this.playerZ) ** 2;
      t.rig.group.visible = vDistSq < 360 * 360;
      t.rig.group.position.set(t.x, t.y, t.z);
    }
  }

  private computeTrafficTargetSpeed(t: TrafficEntity): number {
    let target = t.baseSpeed;
    const spec = VEHICLE_SPECS[t.kind];
    const stopGap = spec.halfLength * 0.58 + 5.5;

    // 1. Slow/yield if player is on the SAME elevation layer directly ahead
    if (Math.abs(this.playerY - t.y) < 2.2) {
      const pdx = this.playerX - t.x;
      const pdz = this.playerZ - t.z;
      if (pdx * pdx + pdz * pdz < 40 * 40) {
        const pAlong = pdx * t.dirX + pdz * t.dirZ;
        const pLateral = Math.abs(pdx * t.dirZ - pdz * t.dirX);
        if (pAlong > 0.5 && pAlong < stopGap + 3.5 && pLateral < spec.halfWidth * 0.58 + 1.0) {
          target = Math.min(target, 2.5);
        }
      }
    }

    // 2. Car-following & perpendicular junction yield
    for (const other of this.traffic) {
      if (other.id === t.id || other.wrecked) continue;
      if (Math.abs(other.y - t.y) > 2.2) continue;
      const odx = other.x - t.x;
      const odz = other.z - t.z;
      if (odx * odx + odz * odz > 40 * 40) continue;

      const otherSpec = VEHICLE_SPECS[other.kind];
      const combinedHalf = (spec.halfLength + otherSpec.halfLength) * 0.58;
      const along = odx * t.dirX + odz * t.dirZ;
      const lat = Math.abs(odx * t.dirZ - odz * t.dirX);
      const dirDot = t.dirX * other.dirX + t.dirZ * other.dirZ;

      if (dirDot > 0.7) {
        if (along > 0.35 && along < combinedHalf + 6.5 && lat < 1.45) {
          if (other.currentSpeed < 1.2 && along < combinedHalf + 3.2) {
            return 0;
          }
          target = Math.min(target, other.currentSpeed * 0.88);
        }
      } else if (Math.abs(dirDot) < 0.45) {
        const crossWidth = otherSpec.halfLength * 0.58 + spec.halfWidth * 0.58 + 1.2;
        if (along > 0.4 && along < combinedHalf + 7.5 && lat < crossWidth) {
          return 0;
        }
      }
    }

    // 3. Stop for nearby pedestrian directly ahead
    if (t.y < 1.5) {
      for (const p of this.pedestrians) {
        if (p.mode === 'knocked') continue;
        const dx = p.x - t.x;
        const dz = p.z - t.z;
        if (dx * dx + dz * dz > 28 * 28) continue;
        const along = dx * t.dirX + dz * t.dirZ;
        const lat = Math.abs(dx * t.dirZ - dz * t.dirX);
        if (along > 0.4 && along < stopGap + 2.5 && lat < 1.35) {
          return 0;
        }
      }
    }

    // 4. Signalized Traffic Lights
    if (!t.isCityVehicle && !t.isExpresswayVehicle) {
      const dirSign = t.laneIdx <= 1 ? 1 : -1;
      for (const inter of this.world.intersections) {
        if (inter.nsPhase !== 'RED' && inter.nsPhase !== 'YELLOW') continue;
        const ds = shortestTrackDeltaS(inter.s, t.s) * dirSign - 11.8;
        if (ds > -0.6 && ds < 16.5) {
          return 0;
        }
      }
    } else if (t.isCityVehicle) {
      const lane = this.world.crossLanes[t.laneIdx];
      const inter = this.world.intersections[lane.interIdx];
      if (inter && (inter.ewPhase === 'RED' || inter.ewPhase === 'YELLOW')) {
        const hw = getRoadProfileAtS(inter.s).halfWidth;
        const stopLat = lane.dirLat > 0 ? -(hw + 3.4) : hw + 3.4;
        const dLat = (stopLat - t.lat) * lane.dirLat;
        if (dLat > -0.6 && dLat < 16.0) {
          return 0;
        }
      }
    }

    return target;
  }

  private recycleVehicle(t: TrafficEntity): void {
    const tier = this.getActiveBikeSpec().tier;
    if (t.isExpresswayVehicle) {
      const kind: VehicleKind = Math.random() < 0.5 ? 'car' : 'suv_prado';
      const zPos =
        t.laneIdx <= 1
          ? ELEVATED_EXPRESSWAY_DEF.deckStartZ - 14 - Math.random() * 120
          : ELEVATED_EXPRESSWAY_DEF.deckEndZ + 14 + Math.random() * 120;
      this.spawnExpresswayVehicle(t, kind, zPos, t.laneIdx);
    } else if (t.isPurbachalTraffic) {
      const kind = pickWeightedKind(false, tier);
      const laneIdx = pickArteryLaneForKind(kind);
      const newS = 945 + Math.random() * 2375;
      this.spawnArteryVehicle(t, kind, newS, laneIdx);
    } else if (!t.isCityVehicle) {
      const kind = pickWeightedKind(false, tier);
      const laneIdx = pickArteryLaneForKind(kind);
      const dirSign = laneIdx <= 1 ? 1 : -1;
      const offsetS = dirSign > 0 ? 110 + Math.random() * 110 : 120 + Math.random() * 100;
      const newS = wrapTrackS(this.playerS + offsetS);
      this.spawnArteryVehicle(t, kind, newS, laneIdx);
    } else {
      const laneIdx = Math.floor(Math.random() * this.world.crossLanes.length);
      this.spawnCrossStreetVehicle(t, pickWeightedKind(true, tier), laneIdx, Math.random());
    }
  }

  private updatePedestrians(dt: number): void {
    for (const p of this.pedestrians) {
      if (p.knockTimer > 0) {
        p.knockTimer -= dt;
        p.x += p.knockVx * dt;
        p.z += p.knockVz * dt;
        p.rig.group.position.y = Math.max(0.05, p.rig.group.position.y + p.knockVy * dt);
        p.knockVy -= 20 * dt;
        p.rig.group.rotation.x = Math.PI * 0.45;
        p.rig.group.position.set(p.x, p.rig.group.position.y, p.z);
        if (p.knockTimer <= 0) {
          p.mode = p.isCrosswalk ? 'crossing' : 'sidewalk';
          p.s = p.homeS;
          p.lat = p.homeLat;
          sampleTrackPose(p.s, p.lat, _poseTmp);
          p.x = _poseTmp.x;
          p.z = _poseTmp.z;
          p.rig.group.rotation.set(0, 0, 0);
          p.rig.angryBadge.visible = false;
        }
        continue;
      }

      if (
        p.mode === 'chasing' &&
        (this.gameState === GameState.PLAYING || this.gameState === GameState.CRASHED)
      ) {
        p.angerTimer -= dt;
        const dx = this.playerX - p.x;
        const dz = this.playerZ - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.9) {
          const chaseSpd = this.gameState === GameState.CRASHED ? 7.8 : 5.2;
          p.x += (dx / dist) * chaseSpd * dt;
          p.z += (dz / dist) * chaseSpd * dt;
          p.rig.group.rotation.y = Math.atan2(dx, dz);
          p.walkPhase += dt * 13;
        } else {
          p.walkPhase += dt * 16;
        }
        if (this.gameState === GameState.PLAYING && (p.angerTimer <= 0 || dist > 48)) {
          p.mode = p.isCrosswalk ? 'crossing' : 'sidewalk';
          p.s = p.homeS;
          p.lat = p.homeLat;
          sampleTrackPose(p.s, p.lat, _poseTmp);
          p.x = _poseTmp.x;
          p.z = _poseTmp.z;
          p.rig.angryBadge.visible = false;
        }
      } else {
        const pdx = p.x - this.playerX;
        const pdz = p.z - this.playerZ;
        const pDistSq = pdx * pdx + pdz * pdz;
        if (pDistSq < 7.5 * 7.5 && Math.abs(this.forwardSpeed) > 12 && !p.isCrosswalk) {
          p.mode = 'fleeing';
          sampleTrackPose(p.s, p.lat, _poseTmp);
          const awayLat = (pdx * _poseTmp.nx + pdz * _poseTmp.nz) >= 0 ? 1 : -1;
          p.lat += awayLat * 4.0 * dt;
          sampleTrackPose(p.s, p.lat, _poseTmp);
          p.x = _poseTmp.x;
          p.z = _poseTmp.z;
          p.walkPhase += dt * 12;
        } else if (p.isCrosswalk) {
          p.mode = 'crossing';
          const inter = this.world.intersections[p.interIdx];
          const cwHw = getRoadProfileAtS(p.s).halfWidth;
          const canWalk = !inter || inter.nsPhase !== 'GREEN' || Math.abs(p.lat) < cwHw + 0.3;
          sampleTrackPose(p.s, p.lat, _poseTmp);
          p.rig.group.rotation.y = p.dir > 0 ? _poseTmp.yaw - Math.PI / 2 : _poseTmp.yaw + Math.PI / 2;
          if (canWalk) {
            p.lat += p.dir * p.walkSpeed * dt;
            if (p.lat > cwHw + 1.6) p.dir = -1;
            if (p.lat < -(cwHw + 1.6)) p.dir = 1;
            sampleTrackPose(p.s, p.lat, _poseTmp);
            p.x = _poseTmp.x;
            p.z = _poseTmp.z;
            p.walkPhase += dt * p.walkSpeed * 3.8;
          } else {
            p.walkPhase = 0;
          }
        } else {
          p.mode = 'sidewalk';
          p.s = wrapTrackS(p.s + p.dir * p.walkSpeed * dt);
          if (Math.abs(shortestTrackDeltaS(p.s, p.homeS)) > 16) p.dir *= -1;
          sampleTrackPose(p.s, p.lat, _poseTmp);
          p.x = _poseTmp.x;
          p.z = _poseTmp.z;
          p.rig.group.rotation.y = p.dir > 0 ? _poseTmp.yaw : _poseTmp.yaw + Math.PI;
          p.walkPhase += dt * p.walkSpeed * 3.8;
        }
      }

      const swing = Math.sin(p.walkPhase) * 0.55;
      p.rig.leftLeg.rotation.x = swing;
      p.rig.rightLeg.rotation.x = -swing;
      p.rig.leftArm.rotation.x = -swing * 0.7;
      p.rig.rightArm.rotation.x = swing * 0.7;

      const hw = getRoadProfileAtS(p.s).halfWidth;
      const groundY = p.isCrosswalk || Math.abs(p.lat) < hw ? 0.02 : 0.14;
      const pCullSq = (p.x - this.playerX) ** 2 + (p.z - this.playerZ) ** 2;
      p.rig.group.visible = p.mode === 'chasing' || pCullSq < 280 * 280;
      p.rig.group.position.set(p.x, groundY, p.z);
    }
  }

  private angerNearbyWitnesses(originX: number, originZ: number): void {
    let activeChasers = 0;
    for (const p of this.pedestrians) {
      if (p.mode === 'chasing') activeChasers += 1;
    }
    if (activeChasers >= 4) return;

    let angered = 0;
    for (const p of this.pedestrians) {
      if (p.mode === 'knocked' || p.mode === 'chasing') continue;
      const dist = Math.hypot(p.x - originX, p.z - originZ);
      if (dist < 24 && angered < 2 && activeChasers + angered < 4) {
        p.mode = 'chasing';
        p.angerTimer = 8.5;
        p.rig.angryBadge.visible = true;
        angered += 1;
      }
    }
    if (angered > 0) {
      this.pushPopup('জনতা ক্ষেপে গেছে!', 'থামলেই ধরে পিটাবে — জোরে চালিয়ে যান!', 'warning');
    }
  }

  private checkTrafficCollisions(speedKmh: number, isBoosting: boolean): void {
    const bikeHalfW = 0.34;
    const bikeHalfL = 0.65;
    const bikeSpec = this.getActiveBikeSpec();

    for (const t of this.traffic) {
      if (t.wrecked || t.hitCooldown > 0) continue;
      if (Math.abs(this.playerY - t.y) > 2.2) continue;

      const dx = this.playerX - t.x;
      const dz = this.playerZ - t.z;
      if (dx * dx + dz * dz > 25) continue;

      // Project relative vector into vehicle's own local (right, forward) frame so 90° rotated traffic collides cleanly!
      const localLong = Math.abs(dx * t.dirX + dz * t.dirZ);
      const localLat = Math.abs(dx * t.dirZ - dz * t.dirX);

      const spec = VEHICLE_SPECS[t.kind];
      const scale = 0.58;
      const tHalfW = spec.halfWidth * scale;
      const tHalfL = spec.halfLength * scale;

      if (localLat < bikeHalfW + tHalfW && localLong < bikeHalfL + tHalfL) {
        t.hitCooldown = 0.45;
        const canSmash = bikeSpec.tier >= spec.smashRank;

        if (!canSmash) {
          if (Math.abs(this.forwardSpeed) > 11) {
            const upgradeHintBn =
              spec.smashRank === 2
                ? 'এটি ভাঙতে ১০০,০০০ পয়েন্টে এক্সট্রিম ১৬০আর নিন!'
                : 'এটি ভাঙতে ২০০,০০০ পয়েন্টে কারিজমা ২১০ নিন!';
            const upgradeHintEn =
              spec.smashRank === 2
                ? 'Upgrade to Hero Xtreme 160R (100,000 pts) to smash it!'
                : 'Upgrade to Hero Karizma 210 (200,000 pts) to smash Titans!';
            this.triggerBigCrash(
              `${spec.nameBn}-এর সাথে ধাক্কা! ${upgradeHintBn}`,
              `Crashed with ${spec.nameEn}! ${upgradeHintEn}`
            );
            return;
          } else {
            this.forwardSpeed = -Math.sign(this.forwardSpeed || 1) * 3.5;
            this.lateralSlip = 0;
            const sideSign = (dx * t.dirZ - dz * t.dirX) >= 0 ? 1 : -1;
            this.playerX += t.dirZ * sideSign * 0.75;
            this.playerZ -= t.dirX * sideSign * 0.75;
            this.cameraShake = 0.35;
            this.audio.playThud();
          }
        } else {
          if (Math.abs(this.forwardSpeed) > 4.5 || isBoosting) {
            t.wrecked = true;
            t.wreckTimer = 0.35;
            t.rig.group.position.y = -2.5;

            this.wrecksCount += 1;
            this.advanceMission('smash', spec.smashRank >= 2 ? 2 : 1);
            const feverMult = this.combo >= 5 ? 1.5 : 1;
            const pts = Math.round(spec.scoreValue * this.combo * feverMult);
            this.addPoints(pts);
            this.combo = Math.min(10, this.combo + 1);
            this.comboTimer = bikeSpec.comboHoldSec;

            this.forwardSpeed = Math.max(8, this.forwardSpeed * 0.9);
            this.lateralSlip = 0;
            this.postHitRecoveryTimer = 0.65;
            this.cameraShake = spec.smashRank >= 2 ? 0.62 : 0.44;

            this.audio.playSmash();
            if (this.wrecksCount % 3 === 2) {
              this.audio.playAccidentAnnouncement();
            }
            this.flashScreen('amber', 0.16);
            this.spawnBurst(t.x, t.y + 0.7, t.z, 0xf97316, spec.smashRank >= 2 ? 20 : 14);
            this.spawnDebrisBurst(t.x, t.y + 0.5, t.z, spec.smashRank >= 2 ? 10 : 6);

            if (t.kind === 'oil_tanker') {
              const tankBoost = bikeSpec.fuelCapacity * 0.2;
              this.fuelAmount = Math.min(bikeSpec.fuelCapacity, this.fuelAmount + tankBoost);
              this.pushPopup(`${spec.nameBn} চুরমার!`, `+${pts} pts • +20% তেল রিফিল!`, 'refuel');
            } else {
              this.pushPopup(`${spec.nameBn} চুরমার!`, `+${pts} pts • x${this.combo}`, 'bonus');
            }
            this.angerNearbyWitnesses(t.x, t.z);
          } else {
            this.forwardSpeed *= 0.45;
            this.lateralSlip = 0;
            this.audio.playThud();
          }
        }
      } else if (
        !t.nearMissedThisPass &&
        speedKmh >= 45 &&
        localLong < bikeHalfL + tHalfL + 0.4 &&
        localLat < bikeHalfW + tHalfW + 1.45
      ) {
        t.nearMissedThisPass = true;
        this.nearMissCount += 1;
        this.advanceMission('nearMiss', 1);
        this.combo = Math.min(10, this.combo + 1);
        this.comboTimer = bikeSpec.comboHoldSec;
        const pts = 60 * this.combo;
        this.addPoints(pts);
        this.audio.playDing(this.combo);
        this.pushPopup('কাছাকাছি কাট!', `NEAR MISS +${pts} • x${this.combo}`, 'bonus');
      }
    }
  }

  private checkPedestrianInteractions(isBoosting: boolean): void {
    if (this.playerY > 1.5) return;
    const absSpd = Math.abs(this.forwardSpeed);
    const isMovingFastEnoughToRam = absSpd > 3.0 || isBoosting;
    const bikeSpec = this.getActiveBikeSpec();

    for (const p of this.pedestrians) {
      if (p.mode === 'knocked') continue;
      const dx = this.playerX - p.x;
      const dz = this.playerZ - p.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > 4) continue;

      const dist = Math.sqrt(distSq);
      const catchRadius = p.mode === 'chasing' && !isMovingFastEnoughToRam ? 0.96 : 0.95;
      if (dist < catchRadius) {
        if (p.mode === 'chasing' && !isMovingFastEnoughToRam && this.refuelSafeGraceTimer <= 0) {
          this.triggerBigCrash(
            'দাঁড়িয়ে যাওয়ায় ক্ষিপ্ত জনতা ধরে পিটিয়েছে!',
            'Caught & beaten by angry crowd after stopping!'
          );
          return;
        }

        if (absSpd > 2.2 || isBoosting) {
          const wasChasing = p.mode === 'chasing';
          p.mode = 'knocked';
          p.rig.angryBadge.visible = false;
          p.knockTimer = 2.6;
          p.knockVx = (dx >= 0 ? -1 : 1) * (4.5 + Math.random() * 3.5);
          p.knockVy = 6.8;
          p.knockVz = (dz >= 0 ? -1 : 1) * (4.0 + Math.random() * 3.0);

          this.pedKnockCount += 1;
          const pts = (wasChasing ? 140 : 80) * this.combo;
          this.addPoints(pts);
          this.combo = Math.min(10, this.combo + 1);
          this.comboTimer = bikeSpec.comboHoldSec;
          this.audio.playPedHit();
          this.flashScreen('red', 0.14);
          this.spawnBurst(p.x, 0.9, p.z, 0xef4444, 8);
          this.pushPopup(
            wasChasing ? 'ক্ষিপ্ত পাবলিক উড়ে গেল!' : 'পথচারী নকআউট!',
            `+${pts} pts • জোরে চালাও, থামলেই মাইর!`,
            'warning'
          );
          this.angerNearbyWitnesses(p.x, p.z);
        }
      }
    }
  }

  private checkIntersections(speedKmh: number): void {
    if (this.playerY > 1.5 || this.playerLayer !== 'surface') return;
    const bikeSpec = this.getActiveBikeSpec();
    for (const inter of this.world.intersections) {
      const ds = Math.abs(shortestTrackDeltaS(inter.s, this.playerS));
      if (ds > 30) {
        inter.violatedThisPass = false;
        inter.bonusAwardedThisPass = false;
        continue;
      }

      const hw = getRoadProfileAtS(inter.s).halfWidth;
      if (Math.abs(this.playerLat) < hw && ds < 2.8 && speedKmh > 18) {
        if (inter.nsPhase === 'RED' && !inter.violatedThisPass) {
          inter.violatedThisPass = true;
          this.ruleBreakCount += 1;
          this.advanceMission('ruleBreak', 1);
          this.combo = Math.min(10, this.combo + 1);
          this.comboTimer = bikeSpec.comboHoldSec;
          const pts = 200 * this.combo;
          this.addPoints(pts);
          this.activeViolation = `লাল বাতি ভঙ্গ! (+${pts} নিয়ম ভঙ্গ বোনাস!)`;
          this.violationTimer = 2.6;
          this.audio.playViolation();
          this.audio.playAccidentAnnouncement();
          this.flashScreen('amber', 0.24);
          this.pushPopup('সিগন্যাল অমান্য! দারুণ!', `+${pts} Rule-Breaker Bonus • x${this.combo}`, 'warning');
          this.angerNearbyWitnesses(this.playerX, this.playerZ);
        } else if (inter.nsPhase === 'GREEN' && !inter.bonusAwardedThisPass && speedKmh > 35) {
          inter.bonusAwardedThisPass = true;
          this.addPoints(100);
          this.audio.playDing(this.combo);
          this.pushPopup('সবুজ সংকেত বোনাস!', '+100 pts', 'bonus');
        }
      }
    }
  }

  private getActiveFuelStation(): FuelStationNode | null {
    if (this.playerLayer !== 'surface') return null;
    for (const fs of this.world.fuelStations) {
      if (this.playerLat >= fs.padMinLat && this.playerLat <= fs.padMaxLat) {
        if (Math.abs(shortestTrackDeltaS(fs.s, this.playerS)) <= GAME_CONFIG.FUEL_PAD_HALF_LENGTH) {
          return fs;
        }
      }
    }
    return null;
  }

  private getNearestFuelStationMeters(): number {
    let best = 9999;
    for (const fs of this.world.fuelStations) {
      const d = Math.hypot(this.playerX - fs.cx, this.playerZ - fs.cz);
      if (d < best) best = d;
    }
    return Math.round(best);
  }

  private getActiveShowroom(): ShowroomNode | null {
    if (this.playerLayer !== 'surface') return null;
    for (const sr of this.world.showrooms) {
      if (this.playerLat >= sr.padMinLat && this.playerLat <= sr.padMaxLat) {
        if (Math.abs(shortestTrackDeltaS(sr.s, this.playerS)) <= GAME_CONFIG.SHOWROOM_PAD_HALF_LENGTH) {
          return sr;
        }
      }
    }
    return null;
  }

  private getNearestShowroomMeters(): number {
    let best = 9999;
    for (const sr of this.world.showrooms) {
      const d = Math.hypot(this.playerX - sr.cx, this.playerZ - sr.cz);
      if (d < best) best = d;
    }
    return Math.round(best);
  }

  private getUpcomingLight(): { phase: 'GREEN' | 'YELLOW' | 'RED' | null; meters: number } {
    const hw = getRoadProfileAtS(this.playerS).halfWidth;
    if (this.playerLayer !== 'surface' || Math.abs(this.playerLat) > hw + 3) {
      return { phase: null, meters: 0 };
    }
    let bestMeters = 999;
    let bestPhase: 'GREEN' | 'YELLOW' | 'RED' | null = null;
    for (const inter of this.world.intersections) {
      const dist = forwardTrackDistanceS(this.playerS, inter.s);
      if (dist < 115 && dist < bestMeters) {
        bestMeters = dist;
        bestPhase = inter.nsPhase;
      }
    }
    return { phase: bestPhase, meters: Math.round(bestMeters) };
  }

  private updateFunnyMessages(dt: number, speedKmh: number): void {
    if (this.funnyDisplayTimer > 0) {
      this.funnyDisplayTimer -= dt;
      if (this.funnyDisplayTimer <= 0) this.funnyMessage = null;
    }
    if (speedKmh > GAME_CONFIG.HIGH_SPEED_MSG_THRESHOLD_KMH) {
      this.funnyCooldownTimer -= dt;
      if (this.funnyCooldownTimer <= 0 && !this.funnyMessage) {
        let idx = Math.floor(Math.random() * FUNNY_BENGALI_MESSAGES.length);
        if (idx === this.lastFunnyIdx) idx = (idx + 1) % FUNNY_BENGALI_MESSAGES.length;
        this.lastFunnyIdx = idx;
        this.funnyMessage = FUNNY_BENGALI_MESSAGES[idx];
        this.funnyDisplayTimer = 3.6;
        this.funnyCooldownTimer = 7.5 + Math.random() * 3.5;
      }
    } else {
      this.funnyCooldownTimer = Math.max(this.funnyCooldownTimer, 2.0);
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const norm = p.life / p.maxLife;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(THREE.MathUtils.lerp(p.startScale, p.endScale, norm));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - norm) * 0.72;
    }
  }

  private updateDebris(dt: number): void {
    for (const d of this.debris) {
      if (!d.active) continue;
      d.life += dt;
      if (d.life >= d.maxLife) {
        d.active = false;
        d.mesh.visible = false;
        continue;
      }
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y = Math.max(0.12, d.mesh.position.y + d.vy * dt);
      d.mesh.position.z += d.vz * dt;
      if (d.mesh.position.y <= 0.13) {
        d.vy = Math.abs(d.vy) * 0.35;
        d.vx *= 0.8;
        d.vz *= 0.8;
      } else {
        d.vy -= 18 * dt;
      }
      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.z += d.rz * dt;
      if (d.life > d.maxLife * 0.6) {
        const fade = 1 - (d.life - d.maxLife * 0.6) / (d.maxLife * 0.4);
        (d.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, fade);
      }
    }
  }

  private updateChaseCamera(dt: number, isBoosting = false): void {
    const bikeSpec = this.getActiveBikeSpec();
    const absSpeed = Math.abs(this.forwardSpeed);
    const speedNorm = THREE.MathUtils.clamp(absSpeed / bikeSpec.maxBoostMps, 0, 1);

    const desiredFov = 58 + speedNorm * 13 + (isBoosting ? 5 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, 6, dt);
    this.camera.updateProjectionMatrix();

    const shakeX = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.5 : 0;
    const shakeY = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake * 0.4 : 0;

    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);
    const portrait = this.camera.aspect < 1;
    const followDist = (portrait ? 4.1 : 5.4) + speedNorm * 0.8;
    const followHeight = (portrait ? 1.95 : 2.4) + speedNorm * 0.3;

    _camTarget.set(
      this.playerX - fwdX * followDist + shakeX,
      this.playerY + followHeight + shakeY,
      this.playerZ - fwdZ * followDist
    );
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTarget.x, 12, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTarget.y, 10, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTarget.z, 12, dt);

    _lookTarget.set(
      this.playerX + fwdX * (10 + speedNorm * 6),
      this.playerY + 1.0 + Math.sin(this.playerSlopeRad) * 4.5,
      this.playerZ + fwdZ * (10 + speedNorm * 6)
    );
    this.camera.lookAt(_lookTarget);
  }

  private getRankTitleBn(scoreInt: number): string {
    if (scoreInt >= 15000) return 'ঢাকাতে আছি • লিজেন্ড';
    if (scoreInt >= 8500) return 'পূর্বাচল ৩০০ ফিট তুফান';
    if (scoreInt >= 4000) return 'এক্সপ্রেসওয়ে ফ্লায়ার';
    if (scoreInt >= 1500) return 'গলির চ্যাম্পিয়ন';
    return 'পাড়ার নতুন বাইকার';
  }

  private getNextUnlockBikeId(): BikeTierId | null {
    for (const id of BIKE_ORDER) {
      if (!this.unlockedBikes.includes(id)) return id;
    }
    return null;
  }

  private emitHud(isRefueling = false, isInFuelZone = false, isInShowroomZone = false): void {
    const bikeSpec = this.getActiveBikeSpec();
    const light = this.getUpcomingLight();
    const speedKmh = Math.round(Math.abs(this.forwardSpeed) * GAME_CONFIG.SPEED_KMH_FACTOR);
    const maxDisplayKmh = Math.round(bikeSpec.maxBoostMps * GAME_CONFIG.SPEED_KMH_FACTOR);
    let angryMobCount = 0;
    for (const p of this.pedestrians) {
      if (p.mode === 'chasing') angryMobCount += 1;
    }

    const scoreInt = Math.floor(this.score);
    const m = this.getCurrentMission();
    const mission: HudMission = {
      titleBn: m.titleBn,
      progress: this.missionProgress,
      target: m.target,
      reward: m.reward + this.missionLoop * 150,
    };

    this.onHudUpdate({
      gameState: this.gameState,
      score: scoreInt,
      bankScore: Math.floor(this.heroBankScore),
      bestScore: Math.max(this.bestScore, scoreInt),
      isNewBest: this.isNewBest,
      equippedBikeId: this.equippedBikeId,
      unlockedBikes: [...this.unlockedBikes],
      speedKmh,
      speedNorm: THREE.MathUtils.clamp(speedKmh / maxDisplayKmh, 0, 1),
      fuelPercent: Math.round(this.getFuelPercent()),
      fuelAmount: Math.round(this.fuelAmount),
      fuelCapacity: bikeSpec.fuelCapacity,
      isRefueling,
      isInFuelZone,
      nearestPumpMeters: this.getNearestFuelStationMeters(),
      isInShowroomZone,
      nearestShowroomMeters: this.getNearestShowroomMeters(),
      nextUnlockBikeId: this.getNextUnlockBikeId(),
      combo: this.combo,
      comboTimerNorm: THREE.MathUtils.clamp(this.comboTimer / bikeSpec.comboHoldSec, 0, 1),
      feverActive: this.combo >= 5,
      distanceMeters: Math.round(this.distanceMeters),
      wrecksCount: this.wrecksCount,
      pedKnockCount: this.pedKnockCount,
      nearMissCount: this.nearMissCount,
      ruleBreakCount: this.ruleBreakCount,
      collectiblesCount: this.collectiblesCount,
      angryMobCount,
      activeViolation: this.activeViolation,
      funnyMessage: this.funnyMessage,
      latestPopup: this.latestPopup,
      mission,
      rankTitleBn: this.getRankTitleBn(scoreInt),
      screenFlashTone: this.screenFlashTone,
      gameOverReasonBn: this.gameOverReasonBn,
      gameOverReasonEn: this.gameOverReasonEn,
      gameOverRoastsBn: this.gameOverRoastsBn,
      lapCount: this.lapCount,
      zoneLabelBn: getZoneLabelForTrack(this.playerS, this.playerZ, this.playerLayer),
      turnCueBn: getTurnCueForRider(this.playerS, this.playerZ, this.playerLayer, this.playerX),
      isOnElevatedRoad: this.playerLayer !== 'surface',
      upcomingLight: light.phase,
      upcomingLightMeters: light.meters,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointerdown', this.handleFirstGesture);

    this.audio.dispose();
    this.textures.dispose();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
