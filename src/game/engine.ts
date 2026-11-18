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
  GOLI_ALLEY_Z_POSITIONS,
  type CityLane,
  type DhakaWorld,
  type FuelStationNode,
  type ShowroomNode,
} from './world';

interface TrafficEntity {
  id: number;
  isCityVehicle: boolean;
  kind: VehicleKind;
  rig: TrafficModelRig;
  x: number;
  z: number;
  yaw: number;
  dirX: number;
  dirZ: number;
  laneIdx: number; // artery lane index or cityLane index
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
  baseZ: number;
  homeX: number;
  isCrosswalk: boolean;
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
  z: number;
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
const _upVec = new THREE.Vector3(0, 1, 0);

function wrapLoopDelta(targetZ: number, refZ: number): number {
  let d = targetZ - refZ;
  const half = GAME_CONFIG.LOOP_LENGTH / 2;
  while (d > half) d -= GAME_CONFIG.LOOP_LENGTH;
  while (d < -half) d += GAME_CONFIG.LOOP_LENGTH;
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
    // Slow 2/3-wheelers mostly keep to Dhaka's outer curb lanes (-6.75 / +6.75)
    return Math.random() < 0.84 ? (Math.random() < 0.5 ? 0 : 3) : Math.floor(Math.random() * 4);
  }
  if (spec.tier === 'large') {
    // Heavy buses & trucks predominantly stay in main carriageway lanes (-3.25 / +3.25)
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

  // Player Physics State (Yaw-only upright motorcycle)
  private gameState: GameState = GameState.MENU;
  private playerX = -3.25;
  private playerZ = -18;
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
    // Keep browser gestures (scroll / pull-to-refresh / pinch) off the ride
    // surface. Overlay cards opt back into panning via their own touch-action.
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x7dd3fc);
    this.scene.background = skyColor;
    // Lighter haze: keeps the road crisp well ahead of the bike while still
    // hiding the world-loop seam in the far distance.
    this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0022);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const aspect = (container.clientWidth || window.innerWidth) / Math.max(container.clientHeight || window.innerHeight, 1);
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.2, 320);

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
    window.addEventListener('blur', this.handleWindowBlurAutoPause);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('pointerdown', this.handleFirstGesture, { passive: true });

    this.audio.setMusicMode('menu');
    this.world.updateAroundPlayer(this.playerZ, 0);
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
    this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
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

  private spawnTrafficSlot(entity: TrafficEntity, kind: VehicleKind, zPos: number, xPos: number, yaw: number): void {
    const spec = VEHICLE_SPECS[kind];
    entity.kind = kind;
    entity.x = xPos;
    entity.z = zPos;
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

    // Replace visual rig cleanly if kind changed (or first build)
    if (entity.rig.group.parent) {
      this.scene.remove(entity.rig.group);
    }
    const rig = buildTrafficVehicle(kind, this.textures, entity.id + Math.floor(Math.random() * 7));
    rig.group.scale.setScalar(0.58);
    rig.group.rotation.set(0, yaw, 0);
    rig.group.position.set(xPos, 0, zPos);
    this.scene.add(rig.group);
    entity.rig = rig;
  }

  private initTrafficPools(): void {
    // 1. Arterial Traffic across 4 keep-left lanes (seed iconic cycle, rickshaw, CNG, Nitol buses & new trucks!)
    const tier = this.getActiveBikeSpec().tier;
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
      const laneIdx =
        i === 0 || i === 1
          ? 0
          : i === 2 || i === 3
            ? 1
            : i === 4
              ? 2
              : pickArteryLaneForKind(kind);
      const laneX = GAME_CONFIG.ARTERY_LANES[laneIdx];
      const isOncoming = laneX > 0;
      const z =
        i === 0
          ? -38
          : i === 1
            ? -50
            : i === 2
              ? -66
              : i === 3
                ? -88
                : i === 4
                  ? -152
                  : -((i * (GAME_CONFIG.LOOP_LENGTH / GAME_CONFIG.ARTERY_TRAFFIC_COUNT) + 34) % GAME_CONFIG.LOOP_LENGTH);
      const yaw = isOncoming ? Math.PI : 0;

      const dummyRig = buildTrafficVehicle(kind, this.textures, i);
      const entity: TrafficEntity = {
        id: i,
        isCityVehicle: false,
        kind,
        rig: dummyRig,
        x: laneX,
        z,
        yaw,
        dirX: -Math.sin(yaw),
        dirZ: -Math.cos(yaw),
        laneIdx,
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
      this.spawnTrafficSlot(entity, kind, z, laneX, yaw);
      this.traffic.push(entity);
    }

    // 2. City Side-Street & Cross-Street Traffic on N-S avenues & E-W boulevards/Golis
    for (let i = 0; i < GAME_CONFIG.CITY_TRAFFIC_COUNT; i++) {
      const laneIdx = i % this.world.cityLanes.length;
      const lane = this.world.cityLanes[laneIdx];
      const kind =
        i === 0 ? 'rickshaw' : i === 1 ? 'cycle' : i === 2 ? 'cng' : pickWeightedKind(true);
      const { x, z, yaw } = this.sampleCityLanePoint(lane, (i * 0.37) % 1);
      const dummyRig = buildTrafficVehicle(kind, this.textures, 100 + i);
      const entity: TrafficEntity = {
        id: 100 + i,
        isCityVehicle: true,
        kind,
        rig: dummyRig,
        x,
        z,
        yaw,
        dirX: -Math.sin(yaw),
        dirZ: -Math.cos(yaw),
        laneIdx,
        baseSpeed: 6.5 + Math.random() * 4,
        currentSpeed: 7,
        targetSpeed: 7,
        frozen: false,
        wrecked: false,
        wreckTimer: 0,
        nearMissedThisPass: false,
        hitCooldown: 0,
        lookaheadTimer: (i % 5) * 0.05,
      };
      this.spawnTrafficSlot(entity, kind, z, x, yaw);
      entity.baseSpeed = Math.min(entity.baseSpeed, 10.5);
      entity.currentSpeed = entity.baseSpeed;
      this.traffic.push(entity);
    }
  }

  private sampleCityLanePoint(lane: CityLane, tNorm: number): { x: number; z: number; yaw: number } {
    if (lane.axis === 'NS') {
      const z = lane.minRange + tNorm * (lane.maxRange - lane.minRange);
      const yaw = lane.dir < 0 ? 0 : Math.PI;
      return { x: lane.fixedCoord, z, yaw };
    } else {
      // Spawn E-W cross-street vehicles cleanly outside the [-16, +16] main artery junction box
      let x = lane.minRange + tNorm * (lane.maxRange - lane.minRange);
      if (Math.abs(x) < 17) {
        x = x < 0 ? -24 : 24;
      }
      // +X East = yaw -PI/2; -X West = yaw +PI/2
      const yaw = lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      return { x, z: lane.fixedCoord, yaw };
    }
  }

  private initPedestrians(): void {
    const shirtPalette = [0xe11d48, 0x2563eb, 0x059669, 0xd97706, 0x7c3aed, 0xf59e0b];

    // Crosswalk pedestrians at intersections
    GAME_CONFIG.INTERSECTION_Z_POSITIONS.forEach((iz, idx) => {
      for (let k = 0; k < 3; k++) {
        const rig = buildPedestrian(shirtPalette[(idx * 3 + k) % shirtPalette.length]);
        const dir = k % 2 === 0 ? 1 : -1;
        const startX = dir > 0 ? -10.5 : 10.5;
        const pz = iz + (k === 0 ? -8.2 : k === 1 ? 8.2 : -8.5);
        rig.group.position.set(startX, 0.02, pz);
        this.scene.add(rig.group);
        this.pedestrians.push({
          rig,
          x: startX,
          z: pz,
          baseZ: pz,
          homeX: startX,
          isCrosswalk: true,
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

    // Sidewalk pedestrians along artery & downtown sidewalks
    for (let i = 0; i < 18; i++) {
      const rig = buildPedestrian(shirtPalette[(i + 2) % shirtPalette.length], 0x334155);
      const side = i % 2 === 0 ? -1 : 1;
      const x =
        i >= 14
          ? side * 56.5
          : i >= 10
            ? side * 28.5
            : side * (GAME_CONFIG.ARTERY_HALF_WIDTH + 1.5);
      const pz = -((i * 39 + 24) % GAME_CONFIG.LOOP_LENGTH);
      rig.group.position.set(x, 0.14, pz);
      this.scene.add(rig.group);
      this.pedestrians.push({
        rig,
        x,
        z: pz,
        baseZ: pz,
        homeX: x,
        isCrosswalk: false,
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

  private samplePickupLocation(slotIdx: number): { x: number; z: number } {
    const roadXs = [
      ...GAME_CONFIG.ARTERY_LANES,
      GAME_CONFIG.AVENUE_LEFT_INNER_X - 2.2,
      GAME_CONFIG.AVENUE_RIGHT_INNER_X + 2.2,
      GAME_CONFIG.AVENUE_LEFT_OUTER_X - 2.0,
      GAME_CONFIG.AVENUE_RIGHT_OUTER_X + 2.0,
    ];
    const x = roadXs[(slotIdx * 3 + Math.floor(Math.random() * roadXs.length)) % roadXs.length];
    const z = -((slotIdx * 38 + 46 + Math.random() * 14) % GAME_CONFIG.LOOP_LENGTH);
    return { x, z };
  }

  private initPickups(): void {
    const kinds: PickupKind[] = ['coin', 'coin', 'coin', 'fuel', 'coin', 'nitro'];
    for (let i = 0; i < 18; i++) {
      const kind = kinds[i % kinds.length];
      const mesh = buildCollectiblePickup(kind);
      const { x, z } = this.samplePickupLocation(i);
      mesh.position.set(x, 0.9, z);
      this.scene.add(mesh);
      this.pickups.push({
        id: i,
        kind,
        mesh,
        x,
        z,
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

  public togglePause(): void {
    if (this.gameState !== GameState.PLAYING) return;
    this.gameState = GameState.PAUSE;
    // Drop every held key/touch so resuming never inherits a stuck throttle.
    this.handleWindowBlur();
    this.audio.updateEngine(0, false, false);
    this.emitHud();
  }

  public resumeGame(): void {
    if (this.gameState !== GameState.PAUSE) return;
    this.gameState = GameState.PLAYING;
    this.audio.updateEngine(Math.abs(this.forwardSpeed) * GAME_CONFIG.SPEED_KMH_FACTOR, this.wasBoosting, true, this.getActiveBikeSpec().tier);
    this.emitHud();
  }

  public startGame(keepSelectedBike = false): void {
    this.audio.unlock();
    this.audio.resetRideAudio();
    this.audio.setMusicMode('play');
    if (!keepSelectedBike) {
      this.resetRunProgression();
    }
    this.gameState = GameState.PLAYING;
    this.playerX = -3.25;
    this.playerZ = -18;
    this.playerYaw = 0;
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

    // Reset Traffic cleanly away from spawn
    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      if (!t.isCityVehicle) {
        const laneX = GAME_CONFIG.ARTERY_LANES[t.laneIdx];
        const yaw = laneX > 0 ? Math.PI : 0;
        let z =
          t.id === 0
            ? -38
            : t.id === 1
              ? -50
              : t.id === 2
                ? -66
                : t.id === 3
                  ? -88
                  : t.id === 4
                    ? -152
                    : -((t.id * (GAME_CONFIG.LOOP_LENGTH / GAME_CONFIG.ARTERY_TRAFFIC_COUNT) + 34) % GAME_CONFIG.LOOP_LENGTH);
        if (Math.abs(wrapLoopDelta(z, this.playerZ)) < 18) {
          z -= 44;
        }
        this.spawnTrafficSlot(t, t.kind, z, laneX, yaw);
      } else {
        const lane = this.world.cityLanes[t.laneIdx];
        const pt = this.sampleCityLanePoint(lane, ((t.id - 100) * 0.37) % 1);
        this.spawnTrafficSlot(t, t.kind, pt.z, pt.x, pt.yaw);
        t.baseSpeed = Math.min(t.baseSpeed, 10.5);
        t.currentSpeed = t.baseSpeed;
      }
    }

    // Reset Pickups
    for (const pk of this.pickups) {
      const loc = this.samplePickupLocation(pk.id);
      pk.x = loc.x;
      pk.z = loc.z;
      pk.respawnTimer = 0;
      pk.mesh.visible = true;
      pk.mesh.position.set(pk.x, 0.9, pk.z);
    }

    // Reset Pedestrians
    for (const p of this.pedestrians) {
      p.mode = p.isCrosswalk ? 'crossing' : 'sidewalk';
      p.x = p.homeX;
      p.z = p.baseZ;
      p.angerTimer = 0;
      p.knockTimer = 0;
      p.rig.angryBadge.visible = false;
      p.rig.group.rotation.set(0, 0, 0);
      p.rig.group.position.set(p.x, p.isCrosswalk ? 0.02 : 0.14, p.z);
    }

    this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
    this.heroRig.group.rotation.set(0, 0, 0);
    this.heroRig.leanGroup.rotation.set(0, 0, 0);
    this.camera.position.set(this.playerX, 2.35, this.playerZ + 5.0);
    _lookTarget.set(this.playerX, 1.0, this.playerZ - 10);
    this.camera.lookAt(_lookTarget);
    this.world.updateAroundPlayer(this.playerZ, this.elapsedSec);
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

  public toggleSfxMute(): boolean {
    this.audio.unlock();
    const next = !this.audio.isSfxMuted();
    this.audio.setSfxMuted(next);
    return next;
  }

  public toggleMusicMute(): boolean {
    this.audio.unlock();
    const next = !this.audio.isMusicMuted();
    this.audio.setMusicMuted(next);
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
    return { ok: true, message: `${spec.nameBn} unlocked!` };
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
    if (e.code === 'Escape' && this.gameState === GameState.PLAYING) {
      this.togglePause();
      return;
    }
    if (e.code === 'Escape' && this.gameState === GameState.PAUSE) {
      this.resumeGame();
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

  // Auto-pause when the tab/window loses focus mid-ride so the player never
  // comes back to a wreck they couldn't see coming.
  private handleWindowBlurAutoPause = (): void => {
    this.handleWindowBlur();
    if (this.gameState === GameState.PLAYING) {
      this.togglePause();
    }
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
    this.spawnBurst(this.playerX, 0.8, this.playerZ, 0xf97316, 20);
    this.spawnDebrisBurst(this.playerX, 0.6, this.playerZ, 8);

    // Freeze all traffic on big crash!
    for (const t of this.traffic) {
      t.frozen = true;
    }

    // Place Scripted Slapper ~4m ahead-left of bike to run in and slap!
    const dirX = -Math.sin(this.playerYaw);
    const dirZ = -Math.cos(this.playerYaw);
    this.slapperRig.group.position.set(this.playerX + dirX * 3.8 + dirZ * 1.4, 0, this.playerZ + dirZ * 3.8 - dirX * 1.4);
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
    this.gameOverReasonEn = 'Out of fuel! Stop on Arterial or Downtown Fuel Pads to refill.';
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

    // === PAUSE: freeze the entire simulation (traffic, peds, particles, bike) ===
    if (this.gameState === GameState.PAUSE) {
      this.audio.updateEngine(0, false, false);
      this.hudEmitAccumulator += dt;
      if (this.hudEmitAccumulator >= 0.25) {
        this.hudEmitAccumulator = 0;
        this.emitHud();
      }
      return;
    }

    this.cameraShake = Math.max(0, this.cameraShake - dt * 1.9);
    this.world.updateAroundPlayer(
      this.playerZ,
      this.elapsedSec,
      this.playerX,
      this.gameState === GameState.SHOWROOM
    );
    this.updateTraffic(dt);
    this.updatePedestrians(dt);
    this.updateParticles(dt);
    this.updateDebris(dt);

    if (this.gameState === GameState.MENU) {
      this.audio.updateEngine(0, false, false);
      this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
      this.heroRig.group.rotation.set(0, 0, 0);
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
      this.heroRig.group.position.set(this.playerX, 0.1, this.playerZ);
      this.heroRig.group.rotation.set(0, this.playerYaw, 0);
      this.heroRig.leanGroup.rotation.set(0.12, 0.25, this.bikeRollCrash);
      this.audio.updateEngine(0, false, false);

      // Scripted Slapper runs up to the bike and delivers dramatic slap!
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
          this.spawnBurst(this.playerX, 1.0, this.playerZ, 0xfef08a, 10);
          const deathQuip = FUNNY_DEATH_LINES_BN[Math.floor(Math.random() * FUNNY_DEATH_LINES_BN.length)];
          this.pushPopup('ঠাস! চড় খেলেন হিরো!', deathQuip, 'danger');
        }
        // Wind-up & slap follow-through
        const slapSwing = Math.sin(Math.min(1, (1.4 - this.crashTimer) * 4) * Math.PI) * 2.2;
        this.slapperRig.rightArmPivot.rotation.x = -slapSwing;
      }

      // Snap crash focus camera
      _camTarget.set(this.playerX + 3.6, 2.2, this.playerZ + 4.2);
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-6 * dt));
      _lookTarget.set(this.playerX, 0.85, this.playerZ);
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
      if (this.forwardSpeed > 1.2) {
        accel = -26;
      } else {
        accel = -11;
      }
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

    // 2. Smoothed Speed-Scaled Steering (smooth ramp-in, crisp center on release, flips in reverse)
    const rawSteer = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0); // +1 left (+Yaw CCW), -1 right
    const steerRate = rawSteer !== 0 ? 5.4 : 14.0;
    this.smoothedSteer = THREE.MathUtils.damp(this.smoothedSteer, rawSteer, steerRate, dt);

    const absSpeed = Math.abs(this.forwardSpeed);
    const speedNorm = THREE.MathUtils.clamp(absSpeed / bikeSpec.maxBoostMps, 0, 1);
    const turnAuthority = THREE.MathUtils.lerp(1.48, 0.78, speedNorm) * (absSpeed < 1.0 ? 0.35 : 1.0);
    const reverseFlip = this.forwardSpeed < -0.5 ? -1 : 1;
    this.playerYaw += this.smoothedSteer * turnAuthority * reverseFlip * dt;

    // Forward vector from yaw (0 = -Z)
    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);

    // High lateral grip damping (extra grip after small-vehicle smash!)
    const gripDamp = this.postHitRecoveryTimer > 0 ? 22 : 12;
    this.lateralSlip = THREE.MathUtils.damp(this.lateralSlip, 0, gripDamp, dt);

    this.playerX += (fwdX * this.forwardSpeed + Math.cos(this.playerYaw) * this.lateralSlip) * dt;
    this.playerZ += (fwdZ * this.forwardSpeed - Math.sin(this.playerYaw) * this.lateralSlip) * dt;

    // 3. Solid Building & Perimeter Collisions (Scrape smoothly without sideways bounce!)
    this.resolveSolidCollisions();

    // 4. Seamless 720 m Loop Wrap (shifts artery vehicles & peds, rearranges city grid vehicles!)
    if (this.playerZ <= -GAME_CONFIG.LOOP_LENGTH) {
      this.wrapWorld(+GAME_CONFIG.LOOP_LENGTH);
    } else if (this.playerZ > 0) {
      this.wrapWorld(-GAME_CONFIG.LOOP_LENGTH);
    }

    if (this.forwardSpeed > 0) {
      const distDelta = this.forwardSpeed * dt;
      this.distanceMeters += distDelta;
      this.addPoints(distDelta * (0.4 + speedNorm * 0.9) * (isBoosting ? 1.35 : 1) * (this.combo >= 5 ? 1.25 : 1));
    }

    // Periodically persist Hero Bank to localStorage
    this.bankSaveAccum += dt;
    if (this.bankSaveAccum >= 1.5) {
      this.bankSaveAccum = 0;
      this.saveHeroBank(this.heroBankScore);
    }

    // 5. Fuel ("তেল / জ্বালানি") + Animated Pump Hose (Scaled by Hero Bike Fuel Capacity & Economy)
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

    // Empty tank + stopped off-station for ~4s => "জ্বালানি শেষ!" Game Over
    if (this.fuelAmount <= 0 && !inFuelZone && speedKmh < 4) {
      this.emptyStoppedTimer += dt;
      if (this.emptyStoppedTimer >= GAME_CONFIG.EMPTY_STOPPED_GAMEOVER_SEC) {
        this.triggerOutOfFuel();
        return;
      }
    } else {
      this.emptyStoppedTimer = 0;
    }

    // 5b. Niloy Hero Showroom Pad Entry (ride onto showroom pad & slow <= 25 km/h; once per visit)
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

    // 6. Violations: Wrong-Way (+15/s) & Sidewalk Driving (+10/s)
    this.updateViolations(dt, speedKmh);

    // 7. Hero Bike Kinematics & Exhaust Smoke
    const targetLean = this.smoothedSteer * 0.36 * THREE.MathUtils.clamp(absSpeed / 10, 0.2, 1.0);
    this.bikeLean = THREE.MathUtils.damp(this.bikeLean, targetLean, 10, dt);
    const targetPitch = this.input.handbrake || brakingWithTouchBrake ? -0.09 : isBoosting ? 0.08 : 0;
    this.bikePitch = THREE.MathUtils.damp(this.bikePitch, targetPitch, 8, dt);

    this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
    this.heroRig.group.rotation.set(0, this.playerYaw, 0);
    this.heroRig.leanGroup.rotation.set(this.bikePitch, 0, this.bikeLean);
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

    // 8. Collisions, Near-Misses, Pickups, Pedestrian Knockdowns, Traffic Lights
    this.checkTrafficCollisions(speedKmh, isBoosting);
    if (this.gameState !== GameState.PLAYING) return;

    this.updatePickups(dt);

    this.checkPedestrianInteractions(isBoosting);
    if (this.gameState !== GameState.PLAYING) return;

    this.checkIntersections(speedKmh);

    // 9. Combo, Funny Speed Quips & Ambient Horns
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
    this.sunLight.position.set(this.playerX + 28, 46, this.playerZ + 22);
    this.sunLight.target.position.set(this.playerX, 0, this.playerZ - 16);

    this.hudEmitAccumulator += dt;
    if (this.hudEmitAccumulator >= 0.05 || isRefueling) {
      this.hudEmitAccumulator = 0;
      this.emitHud(isRefueling, inFuelZone, showShowroomBanner);
    }
  }

  private resolveSolidCollisions(): void {
    const bikeR = 0.52;
    let scraped = false;

    // 1. Perimeter walls at x = ±55.2
    const maxX = GAME_CONFIG.WORLD_PERIMETER_X - 0.85;
    if (this.playerX < -maxX) {
      this.playerX = -maxX;
      scraped = true;
    } else if (this.playerX > maxX) {
      this.playerX = maxX;
      scraped = true;
    }

    // 2. Center Metro Rail piers outside intersections & Goli crossings (|x| < 1.05)
    const atIntersectionOrGoli =
      GAME_CONFIG.INTERSECTION_Z_POSITIONS.some((iz) => Math.abs(wrapLoopDelta(this.playerZ, iz)) < 11) ||
      GOLI_ALLEY_Z_POSITIONS.some((gz) => Math.abs(wrapLoopDelta(this.playerZ, gz)) < 5.2);
    if (!atIntersectionOrGoli && Math.abs(this.playerX) < GAME_CONFIG.MEDIAN_HALF_WIDTH + 0.36) {
      this.playerX = (this.playerX <= 0 ? -1 : 1) * (GAME_CONFIG.MEDIAN_HALF_WIDTH + 0.36);
      scraped = true;
    }

    // 3. Solid City Building AABBs (Bld_*)
    for (const b of this.world.solidBuildings) {
      const bMidZ = (b.baseMinZ + b.baseMaxZ) * 0.5;
      const relZ = wrapLoopDelta(bMidZ, this.playerZ);
      if (Math.abs(relZ) > 20) continue;

      const halfD = (b.baseMaxZ - b.baseMinZ) * 0.5;
      const actualMinZ = this.playerZ + relZ - halfD;
      const actualMaxZ = this.playerZ + relZ + halfD;

      const closestX = THREE.MathUtils.clamp(this.playerX, b.minX, b.maxX);
      const closestZ = THREE.MathUtils.clamp(this.playerZ, actualMinZ, actualMaxZ);
      const dx = this.playerX - closestX;
      const dz = this.playerZ - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < bikeR * bikeR) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = bikeR - dist;
          this.playerX += (dx / dist) * push;
          this.playerZ += (dz / dist) * push;
        } else {
          // Inside AABB fallback: push out horizontally
          const toLeft = Math.abs(this.playerX - b.minX);
          const toRight = Math.abs(b.maxX - this.playerX);
          this.playerX = toLeft < toRight ? b.minX - bikeR : b.maxX + bikeR;
        }
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

  private wrapWorld(offsetZ: number): void {
    this.playerZ += offsetZ;
    // Shift camera by the exact loop offset so wrapping 720m is 100% seamless with zero camera whip!
    this.camera.position.z += offsetZ;
    this.world.updateAroundPlayer(this.playerZ, this.elapsedSec);

    if (offsetZ > 0) {
      this.lapCount += 1;
      this.addPoints(250);
      this.pushPopup(`ল্যাপ ${this.lapCount} বোনাস!`, '+250 District Bonus', 'bonus');
      this.audio.playDing(this.combo);
    }

    for (const inter of this.world.intersections) {
      inter.violatedThisPass = false;
      inter.bonusAwardedThisPass = false;
    }

    for (const t of this.traffic) {
      if (!t.isCityVehicle) {
        t.z += offsetZ;
        t.rig.group.position.z = t.z;
      } else {
        t.rig.group.position.z = this.playerZ + wrapLoopDelta(t.z, this.playerZ);
      }
    }

    for (const pk of this.pickups) {
      pk.z += offsetZ;
      pk.mesh.position.z = this.playerZ + wrapLoopDelta(pk.z, this.playerZ);
    }

    for (const p of this.pedestrians) {
      p.z += offsetZ;
      p.rig.group.position.z = this.playerZ + wrapLoopDelta(p.z, this.playerZ);
    }
    for (const pt of this.particles) {
      if (pt.active) pt.mesh.position.z += offsetZ;
    }
    for (const d of this.debris) {
      if (d.active) d.mesh.position.z += offsetZ;
    }
  }

  private updateFuelHose(station: FuelStationNode): void {
    const relZ = wrapLoopDelta(station.baseZ, this.playerZ);
    const nozzleWorldZ = this.playerZ + relZ;
    _hoseStart.set(station.nozzleX, station.nozzleY, nozzleWorldZ);
    this.heroRig.fuelPortTip.getWorldPosition(_fuelPortWorldPos);

    _hoseMid.addVectors(_hoseStart, _fuelPortWorldPos).multiplyScalar(0.5);
    _hoseMid.y -= 0.25; // Realistic slack sag

    const alignSeg = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      mesh.position.copy(a);
      const dir = new THREE.Vector3().subVectors(b, a);
      const len = dir.length();
      mesh.scale.set(1, Math.max(len, 0.01), 1);
      if (len > 0.001) {
        mesh.quaternion.setFromUnitVectors(_upVec, dir.normalize());
      }
    };
    alignSeg(this.hoseSegA, _hoseStart, _hoseMid);
    alignSeg(this.hoseSegB, _hoseMid, _fuelPortWorldPos);
    this.fuelHoseGroup.visible = true;
  }

  private updateViolations(dt: number, speedKmh: number): void {
    const fwdZ = -Math.cos(this.playerYaw);
    const onRightArteryWrongWay =
      this.playerX > 1.2 && this.playerX < GAME_CONFIG.ARTERY_HALF_WIDTH && fwdZ < -0.35 && speedKmh > 12;
    const onSidewalk = this.world.isOnArterySidewalk(this.playerX, this.playerZ) && speedKmh > 8;

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

  // Missions pay out more each time the player clears a full lap of the
  // template list, so late runs stay worth chasing instead of repeating the
  // same four objectives for the same reward forever.
  private getMissionBonus(m: MissionTemplate): number {
    return m.reward + this.missionLoop * 150 + this.missionLoop * this.missionLoop * 40;
  }

  private advanceMission(kind: MissionKind, amount = 1): void {
    const m = this.getCurrentMission();
    if (m.kind !== kind) return;
    this.missionProgress += amount;
    if (this.missionProgress >= m.target) {
      const bonus = this.getMissionBonus(m);
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
          pk.z = loc.z;
          pk.mesh.visible = true;
        }
        continue;
      }

      pk.phase += dt * 3.2;
      const relZ = wrapLoopDelta(pk.z, this.playerZ);
      pk.mesh.position.set(pk.x, 0.92 + Math.sin(pk.phase) * 0.16, this.playerZ + relZ);
      pk.mesh.rotation.y += dt * 2.8;

      if (Math.abs(relZ) < 1.65 && Math.abs(this.playerX - pk.x) < 1.45) {
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
          this.spawnBurst(pk.x, 1.0, this.playerZ + relZ, 0xfacc15, 10);
          this.pushPopup('৳ টাকা কয়েন!', `+${pts} pts${feverMult > 1 ? ' (FEVER 2x!)' : ''}`, 'bonus');
        } else if (pk.kind === 'fuel') {
          const fuelGain = bikeSpec.fuelCapacity * 0.18;
          this.fuelAmount = Math.min(bikeSpec.fuelCapacity, this.fuelAmount + fuelGain);
          this.audio.playTankFull();
          this.flashScreen('green', 0.18);
          this.spawnBurst(pk.x, 1.0, this.playerZ + relZ, 0x22c55e, 10);
          this.pushPopup('পেট্রোল ক্যান!', `+${Math.round(fuelGain)}L তেল (+18%)`, 'refuel');
        } else {
          this.freeNitroTimer = bikeSpec.nitroDurationSec;
          this.audio.playWhoosh();
          this.flashScreen('amber', 0.16);
          this.spawnBurst(pk.x, 1.0, this.playerZ + relZ, 0x38bdf8, 12);
          this.pushPopup('নাইট্রো চার্জ!', `ফ্রি টার্বো বুস্ট (${bikeSpec.nitroDurationSec.toFixed(1)} সে.)`, 'bonus');
        }
      }
    }
  }

  private updateTraffic(dt: number): void {
    const loopLen = GAME_CONFIG.LOOP_LENGTH;

    for (const t of this.traffic) {
      if (t.hitCooldown > 0) t.hitCooldown -= dt;

      if (t.wrecked) {
        t.wreckTimer -= dt;
        t.rig.group.position.y = THREE.MathUtils.damp(t.rig.group.position.y, -2.5, 4, dt);
        if (t.wreckTimer <= 0) {
          this.recycleVehicle(t);
        }
        continue;
      }

      if (t.frozen) {
        t.currentSpeed = 0;
        continue;
      }

      // Periodic forward lookahead for car-following & obstacle braking
      t.lookaheadTimer -= dt;
      if (t.lookaheadTimer <= 0) {
        t.lookaheadTimer = 0.14;
        t.targetSpeed = this.computeTrafficTargetSpeed(t);
      }

      t.currentSpeed = THREE.MathUtils.damp(t.currentSpeed, t.targetSpeed, 6, dt);
      t.x += t.dirX * t.currentSpeed * dt;
      t.z += t.dirZ * t.currentSpeed * dt;

      const wheelSpin = (t.currentSpeed / 0.35) * dt;
      for (const w of t.rig.wheels) w.rotation.x -= wheelSpin;

      if (!t.isCityVehicle) {
        const dz = t.z - this.playerZ;
        if (dz < -250 || dz > 170) {
          this.recycleVehicle(t);
          continue;
        }
        if (Math.abs(dz) > 36) t.nearMissedThisPass = false;
      } else {
        const lane = this.world.cityLanes[t.laneIdx];
        if (lane.axis === 'NS') {
          if (t.z < -loopLen) t.z += loopLen;
          if (t.z > 0) t.z -= loopLen;
          if (Math.abs(wrapLoopDelta(t.z, this.playerZ)) > 230) {
            this.recycleVehicle(t);
            continue;
          }
        } else {
          if (t.x < lane.minRange || t.x > lane.maxRange) {
            const entryX = t.dirX > 0 ? lane.minRange + 1 : lane.maxRange - 1;
            const blocked = this.traffic.some(
              (o) => o.id !== t.id && !o.wrecked && o.isCityVehicle && o.laneIdx === t.laneIdx && Math.abs(o.x - entryX) < 10
            );
            t.x = blocked ? (t.dirX > 0 ? lane.minRange - 8 : lane.maxRange + 8) : entryX;
          }
        }
      }

      t.rig.group.position.set(
        t.x,
        0,
        t.isCityVehicle ? this.playerZ + wrapLoopDelta(t.z, this.playerZ) : t.z
      );
    }
  }

  private computeTrafficTargetSpeed(t: TrafficEntity): number {
    let target = t.baseSpeed;
    const spec = VEHICLE_SPECS[t.kind];
    const stopGap = spec.halfLength * 0.58 + 5.5;

    // 1. Slow/yield if player is directly ahead in travel path
    const pdx = this.playerX - t.x;
    const pdz = wrapLoopDelta(this.playerZ, t.z);
    const pAlong = pdx * t.dirX + pdz * t.dirZ;
    const pLateral = Math.abs(pdx * t.dirZ - pdz * t.dirX);
    if (pAlong > 0.5 && pAlong < stopGap + 3.5 && pLateral < spec.halfWidth * 0.58 + 1.0) {
      target = Math.min(target, 2.5);
    }

    // 2. Car-following in lane + perpendicular junction yield
    for (const other of this.traffic) {
      if (other.id === t.id || other.wrecked) continue;
      const otherSpec = VEHICLE_SPECS[other.kind];
      const combinedHalf = (spec.halfLength + otherSpec.halfLength) * 0.58;
      const odx = other.x - t.x;
      const odz = wrapLoopDelta(other.z, t.z);
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
        // Perpendicular cross-traffic inside junction: never ghost through crossing vehicles!
        const crossWidth = otherSpec.halfLength * 0.58 + spec.halfWidth * 0.58 + 1.2;
        if (along > 0.4 && along < combinedHalf + 7.5 && lat < crossWidth) {
          return 0;
        }
      }
    }

    // 3. Stop for pedestrian directly ahead
    for (const p of this.pedestrians) {
      if (p.mode === 'knocked') continue;
      const dx = p.x - t.x;
      const dz = wrapLoopDelta(p.z, t.z);
      const along = dx * t.dirX + dz * t.dirZ;
      const lat = Math.abs(dx * t.dirZ - dz * t.dirX);
      if (along > 0.4 && along < stopGap + 2.5 && lat < 1.35) {
        return 0;
      }
    }

    // 4a. All N-S Traffic (Main Artery + N-S Side Avenues) obeys nsPhase stop lines behind crosswalks
    if (Math.abs(t.dirZ) > 0.5) {
      for (const inter of this.world.intersections) {
        if (inter.nsPhase !== 'RED' && inter.nsPhase !== 'YELLOW') continue;
        const stopLineZ = inter.baseZ + (t.dirZ < 0 ? 11.8 : -11.8);
        const dz = wrapLoopDelta(stopLineZ, t.z) * t.dirZ;
        if (dz > -0.6 && dz < 16.5) {
          return 0;
        }
      }
    } else if (t.isCityVehicle && Math.abs(t.dirX) > 0.5) {
      // 4b. E-W Cross-Street & Goli Traffic
      const lane = this.world.cityLanes[t.laneIdx];
      if (lane?.isSignalizedEw) {
        for (const inter of this.world.intersections) {
          if (Math.abs(wrapLoopDelta(inter.baseZ, t.z)) > 8) continue;
          if (inter.ewPhase !== 'RED' && inter.ewPhase !== 'YELLOW') continue;
          const stopLineX = t.dirX > 0 ? -13.2 : 13.2;
          const dx = (stopLineX - t.x) * t.dirX;
          if (dx > -0.6 && dx < 16.0) {
            return 0;
          }
        }
      } else {
        // Unsignalized Goli connector: look both ways before crossing the main artery!
        const stopLineX = t.dirX > 0 ? -13.0 : 13.0;
        const dx = (stopLineX - t.x) * t.dirX;
        if (dx > -0.4 && dx < 10.0) {
          if (Math.abs(this.playerX) < 11.5 && Math.abs(wrapLoopDelta(this.playerZ, t.z)) < 26) {
            return 0;
          }
          for (const other of this.traffic) {
            if (other.id === t.id || other.wrecked || other.isCityVehicle) continue;
            if (Math.abs(wrapLoopDelta(other.z, t.z)) < 22 && other.currentSpeed > 1.8) {
              return 0;
            }
          }
        }
      }
    }

    return target;
  }

  private recycleVehicle(t: TrafficEntity): void {
    const tier = this.getActiveBikeSpec().tier;
    if (!t.isCityVehicle) {
      const kind = pickWeightedKind(false, tier);
      const laneIdx = pickArteryLaneForKind(kind);
      const laneX = GAME_CONFIG.ARTERY_LANES[laneIdx];
      const yaw = laneX > 0 ? Math.PI : 0;
      const spawnOffset = laneX > 0 ? -(115 + Math.random() * 75) : -(125 + Math.random() * 90);
      let newZ = this.playerZ + spawnOffset;
      if (newZ <= -GAME_CONFIG.LOOP_LENGTH) newZ += GAME_CONFIG.LOOP_LENGTH;
      if (newZ > 0) newZ -= GAME_CONFIG.LOOP_LENGTH;

      // Density cap: never let the road fill with Titans (smashRank 3).
      // At tier 3 the weighted picker loves them, so enforce a hard ceiling
      // and fall back to a lower-rank kind instead of recycling into another.
      let chosenKind = kind;
      if (tier === 3 && VEHICLE_SPECS[kind].smashRank >= 3) {
        const activeTitans = this.traffic.filter(
          (o) => !o.isCityVehicle && !o.wrecked && VEHICLE_SPECS[o.kind].smashRank >= 3
        ).length;
        if (activeTitans >= GAME_CONFIG.TITAN_TRAFFIC_CAP) {
          chosenKind = pickWeightedKind(false, 2);
        }
      }

      // Spacing check
      for (const other of this.traffic) {
        if (other.id !== t.id && !other.isCityVehicle && other.laneIdx === laneIdx) {
          if (Math.abs(wrapLoopDelta(other.z, newZ)) < 14) {
            newZ -= 18;
          }
        }
      }
      t.laneIdx = laneIdx;
      this.spawnTrafficSlot(t, chosenKind, newZ, laneX, yaw);
    } else {
      const laneIdx = Math.floor(Math.random() * this.world.cityLanes.length);
      const lane = this.world.cityLanes[laneIdx];
      const pt = this.sampleCityLanePoint(lane, Math.random());
      t.laneIdx = laneIdx;
      this.spawnTrafficSlot(t, pickWeightedKind(true, tier), pt.z, pt.x, pt.yaw);
      t.baseSpeed = Math.min(t.baseSpeed, 10.5);
      t.currentSpeed = t.baseSpeed;
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
        p.rig.group.position.set(p.x, p.rig.group.position.y, this.playerZ + wrapLoopDelta(p.z, this.playerZ));
        if (p.knockTimer <= 0) {
          p.mode = p.isCrosswalk ? 'crossing' : 'sidewalk';
          p.x = p.homeX;
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
        const dz = wrapLoopDelta(this.playerZ, p.z);
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
          p.rig.angryBadge.visible = false;
        }
      } else {
        // Check if fleeing from fast player nearby
        const pdx = p.x - this.playerX;
        const pdz = wrapLoopDelta(p.z, this.playerZ);
        const pDist = Math.hypot(pdx, pdz);
        if (pDist < 7.5 && Math.abs(this.forwardSpeed) > 12 && !p.isCrosswalk) {
          p.mode = 'fleeing';
          const awayX = pdx >= 0 ? 1 : -1;
          p.x += awayX * 4.0 * dt;
          p.walkPhase += dt * 12;
        } else if (p.isCrosswalk) {
          p.mode = 'crossing';
          const inter = this.world.intersections.find((node) => Math.abs(wrapLoopDelta(node.baseZ, p.baseZ)) < 12);
          const canWalk = !inter || inter.nsPhase !== 'GREEN' || Math.abs(p.x) < 9.9;
          p.rig.group.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (canWalk) {
            p.x += p.dir * p.walkSpeed * dt;
            if (p.x > 11.2) p.dir = -1;
            if (p.x < -11.2) p.dir = 1;
            p.walkPhase += dt * p.walkSpeed * 3.8;
          } else {
            p.walkPhase = 0;
          }
        } else {
          p.mode = 'sidewalk';
          p.z += p.dir * p.walkSpeed * dt;
          if (Math.abs(wrapLoopDelta(p.z, p.baseZ)) > 16) p.dir *= -1;
          p.rig.group.rotation.y = p.dir > 0 ? 0 : Math.PI;
          p.walkPhase += dt * p.walkSpeed * 3.8;
        }
      }

      const swing = Math.sin(p.walkPhase) * 0.55;
      p.rig.leftLeg.rotation.x = swing;
      p.rig.rightLeg.rotation.x = -swing;
      p.rig.leftArm.rotation.x = -swing * 0.7;
      p.rig.rightArm.rotation.x = swing * 0.7;

      const relZ = wrapLoopDelta(p.z, this.playerZ);
      const groundY = p.isCrosswalk || Math.abs(p.x) < 9.6 ? 0.02 : 0.14;
      p.rig.group.position.set(p.x, groundY, this.playerZ + relZ);
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
      const dist = Math.hypot(p.x - originX, wrapLoopDelta(p.z, originZ));
      if (dist < 22 && angered < 2 && activeChasers + angered < 4) {
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
    const bikeHalfW = 0.32;
    const bikeHalfL = 0.65;
    const bikeSpec = this.getActiveBikeSpec();

    for (const t of this.traffic) {
      if (t.wrecked || t.hitCooldown > 0) continue;

      const spec = VEHICLE_SPECS[t.kind];
      const scale = 0.58;
      const tHalfW = (Math.abs(t.dirZ) > 0.5 ? spec.halfWidth : spec.halfLength) * scale;
      const tHalfL = (Math.abs(t.dirZ) > 0.5 ? spec.halfLength : spec.halfWidth) * scale;

      const dx = Math.abs(this.playerX - t.x);
      const dz = Math.abs(wrapLoopDelta(t.z, this.playerZ));

      if (dx < bikeHalfW + tHalfW && dz < bikeHalfL + tHalfL) {
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
            this.playerX += this.playerX < t.x ? -0.75 : 0.75;
            this.cameraShake = 0.35;
            this.audio.playThud();
          }
        } else {
          // Smashable vehicle (scales with equipped Hero Bike tier!)
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

            // Preserve roaring speed through wreckage!
            this.forwardSpeed = Math.max(8, this.forwardSpeed * 0.9);
            this.lateralSlip = 0;
            this.postHitRecoveryTimer = 0.65;
            this.cameraShake = spec.smashRank >= 2 ? 0.62 : 0.44;

            this.audio.playSmash();
            if (this.wrecksCount % 3 === 2) {
              this.audio.playAccidentAnnouncement();
            }
            this.flashScreen('amber', 0.16);
            this.spawnBurst(t.x, 0.7, t.z, 0xf97316, spec.smashRank >= 2 ? 20 : 14);
            this.spawnDebrisBurst(t.x, 0.5, t.z, spec.smashRank >= 2 ? 10 : 6);

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
            this.playerX += this.playerX < t.x ? -0.65 : 0.65;
            this.audio.playThud();
          }
        }
      } else if (
        !t.nearMissedThisPass &&
        speedKmh >= 45 &&
        dz < bikeHalfL + tHalfL + 0.4 &&
        dx < bikeHalfW + tHalfW + 1.45
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
    const absSpd = Math.abs(this.forwardSpeed);
    const isMovingFastEnoughToRam = absSpd > 3.0 || isBoosting;
    const bikeSpec = this.getActiveBikeSpec();

    for (const p of this.pedestrians) {
      if (p.mode === 'knocked') continue;
      const dx = this.playerX - p.x;
      const dz = wrapLoopDelta(this.playerZ, p.z);
      const dist = Math.hypot(dx, dz);

      const catchRadius = p.mode === 'chasing' && !isMovingFastEnoughToRam ? 0.96 : 0.95;
      if (dist < catchRadius) {
        // ONLY beat/kill the player if they stopped/slowed down outside refuel grace and an angry mob member catches them!
        if (p.mode === 'chasing' && !isMovingFastEnoughToRam && this.refuelSafeGraceTimer <= 0) {
          this.triggerBigCrash(
            'দাঁড়িয়ে যাওয়ায় ক্ষিপ্ত জনতা ধরে পিটিয়েছে!',
            'Caught & beaten by angry crowd after stopping!'
          );
          return;
        }

        // Running over ANY pedestrian at speed knocks them down cleanly — keep riding & hitting!
        if (absSpd > 2.2 || isBoosting) {
          const wasChasing = p.mode === 'chasing';
          p.mode = 'knocked';
          p.rig.angryBadge.visible = false;
          p.knockTimer = 2.6;
          p.knockVx = (dx >= 0 ? -1 : 1) * (4.5 + Math.random() * 3.5);
          p.knockVy = 6.8;
          p.knockVz = -this.forwardSpeed * 0.45;

          this.pedKnockCount += 1;
          const pts = (wasChasing ? 140 : 80) * this.combo;
          this.addPoints(pts);
          this.combo = Math.min(10, this.combo + 1);
          this.comboTimer = bikeSpec.comboHoldSec;
          this.audio.playPedHit();
          this.flashScreen('red', 0.14);
          this.spawnBurst(p.x, 0.9, this.playerZ, 0xef4444, 8);
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
    const bikeSpec = this.getActiveBikeSpec();
    for (const inter of this.world.intersections) {
      const relZ = wrapLoopDelta(inter.baseZ, this.playerZ);
      if (Math.abs(relZ) > 30) {
        inter.violatedThisPass = false;
        inter.bonusAwardedThisPass = false;
        continue;
      }

      if (Math.abs(this.playerX) < GAME_CONFIG.ARTERY_HALF_WIDTH && Math.abs(relZ) < 2.8 && speedKmh > 18) {
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
    for (const fs of this.world.fuelStations) {
      if (this.playerX >= fs.padMinX && this.playerX <= fs.padMaxX) {
        if (Math.abs(wrapLoopDelta(fs.baseZ, this.playerZ)) <= GAME_CONFIG.FUEL_PAD_HALF_LENGTH) {
          return fs;
        }
      }
    }
    return null;
  }

  private getNearestFuelStationMeters(): number {
    let best = 9999;
    for (const fs of this.world.fuelStations) {
      const dx = this.playerX - (fs.padMinX + fs.padMaxX) * 0.5;
      const dz = wrapLoopDelta(fs.baseZ, this.playerZ);
      const d = Math.hypot(dx, dz);
      if (d < best) best = d;
    }
    return Math.round(best);
  }

  private getActiveShowroom(): ShowroomNode | null {
    for (const sr of this.world.showrooms) {
      if (this.playerX >= sr.padMinX && this.playerX <= sr.padMaxX) {
        if (Math.abs(wrapLoopDelta(sr.baseZ, this.playerZ)) <= GAME_CONFIG.SHOWROOM_PAD_HALF_LENGTH) {
          return sr;
        }
      }
    }
    return null;
  }

  private getNearestShowroomMeters(): number {
    let best = 9999;
    for (const sr of this.world.showrooms) {
      const dx = this.playerX - (sr.padMinX + sr.padMaxX) * 0.5;
      const dz = wrapLoopDelta(sr.baseZ, this.playerZ);
      const d = Math.hypot(dx, dz);
      if (d < best) best = d;
    }
    return Math.round(best);
  }

  private getUpcomingLight(): { phase: 'GREEN' | 'YELLOW' | 'RED' | null; meters: number } {
    if (Math.abs(this.playerX) > GAME_CONFIG.ARTERY_HALF_WIDTH + 3) {
      return { phase: null, meters: 0 };
    }
    let bestMeters = 999;
    let bestPhase: 'GREEN' | 'YELLOW' | 'RED' | null = null;
    for (const inter of this.world.intersections) {
      let dist = this.playerZ - inter.baseZ;
      while (dist < 0) dist += GAME_CONFIG.LOOP_LENGTH;
      if (dist < 110 && dist < bestMeters) {
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
    // Keep the bike a little in front of frame on every device. On tall
    // mobile-portrait screens we sit much closer and lower so the bike reads
    // large and centered instead of shrinking into the distance, while the
    // HUD + control cluster still have room at the bottom of the screen.
    const portrait = this.camera.aspect < 1;
    const followDist = (portrait ? 4.1 : 5.4) + speedNorm * 0.8;
    const followHeight = (portrait ? 1.95 : 2.4) + speedNorm * 0.3;

    _camTarget.set(
      this.playerX - fwdX * followDist + shakeX,
      followHeight + shakeY,
      this.playerZ - fwdZ * followDist
    );
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTarget.x, 10, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTarget.y, 10, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTarget.z, 16, dt);

    _lookTarget.set(this.playerX + fwdX * (10 + speedNorm * 6), 1.0, this.playerZ + fwdZ * (10 + speedNorm * 6));
    this.camera.lookAt(_lookTarget);
  }

  private getDhakaZoneLabel(): string {
    if (Math.abs(this.playerX) > GAME_CONFIG.ARTERY_HALF_WIDTH + 3) {
      return this.playerX < 0 ? 'মহাখালী-ধানমন্ডি গলি (Grid)' : 'গুলশান-তেজগাঁও এভিনিউ (Grid)';
    }
    const zAbs = Math.abs(this.playerZ);
    if (zAbs < 160) return 'ফার্মগেট • ফার্মগেট মেট্রো';
    if (zAbs < 320) return 'কারওয়ান বাজার • মহাখালী রোড';
    if (zAbs < 480) return 'শাহবাগ চত্বর • মেট্রো স্টেশন';
    return 'গুলিস্তান • মতিঝিল জিরো পয়েন্ট';
  }

  private getRankTitleBn(scoreInt: number): string {
    if (scoreInt >= 15000) return 'ঢাকার রাস্তার রাজা';
    if (scoreInt >= 8500) return 'মহাখালী তুফান';
    if (scoreInt >= 4000) return 'ফার্মগেট ফ্লায়ার';
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
      reward: this.getMissionBonus(m),
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
      zoneLabelBn: this.getDhakaZoneLabel(),
      upcomingLight: light.phase,
      upcomingLightMeters: light.meters,
      sfxMuted: this.audio.isSfxMuted(),
      musicMuted: this.audio.isMusicMuted(),
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('blur', this.handleWindowBlurAutoPause);
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
