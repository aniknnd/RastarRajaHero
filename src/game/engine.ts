import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GameAudio } from './audio';
import { clampToDrivableCorridors, sampleDhakaSurface, type CorridorId } from './corridors';
import { MotionController, type MotionStatus } from './motion';
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
  CORRIDOR_CONFIG,
  ENVIRONMENT_PRESETS,
  FUNNY_BENGALI_MESSAGES,
  FUNNY_DEATH_LINES_BN,
  GAME_CONFIG,
  GAME_OVER_PUBLIC_ROASTS_BN,
  GameState,
  VEHICLE_SPECS,
  type BikeSpec,
  type BikeTierId,
  type EnvironmentPresetId,
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
  type RestRoomNode,
  type ShowroomNode,
} from './world';

type TrafficRouteTag = 'METRO_LOCAL' | 'SPINE_TO_UTTARA' | 'KURIL_RAMP_TO_300FT' | 'EXPRESSWAY_300FT';

type KurilRampPhase =
  | 'none'
  | 'eb_merge'
  | 'eb_ramp_up'
  | 'eb_arc'
  | 'eb_ramp_down'
  | 'wb_ramp_up'
  | 'wb_arc'
  | 'wb_ramp_down'
  | 'wb_merge';

interface TrafficEntity {
  id: number;
  isCityVehicle: boolean;
  routeTag: TrafficRouteTag;
  kurilPhase: KurilRampPhase;
  arcAngle: number;
  kind: VehicleKind;
  rig: TrafficModelRig;
  x: number;
  y: number;
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
  turnCooldown: number;
  deckId: string | null; // flyover deck this vehicle is locked to (null = ground)
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
  y: number;
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
const _smoothLookTarget = new THREE.Vector3();
const _exhaustWorldPos = new THREE.Vector3();
const _fuelPortWorldPos = new THREE.Vector3();
const _hoseStart = new THREE.Vector3();
const _hoseMid = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

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

interface EnvironmentThemeConfig {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  sunDisc: string;
  sunHalo: string;
  cloudTint: string;
  starAlpha: number;
  fogHex: number;
  fogDensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  sunHex: number;
  sunIntensity: number;
  sunOffset: [number, number, number];
  rimHex: number;
  rimIntensity: number;
  groundHex: number;
  exposure: number;
  envIntensity: number;
  headlightIntensity: number;
}

const ENV_THEMES: Record<EnvironmentPresetId, EnvironmentThemeConfig> = {
  morning: {
    skyTop: '#0284c7',
    skyMid: '#7dd3fc',
    skyHorizon: '#fde7c5',
    sunDisc: '#fffbeb',
    sunHalo: 'rgba(254, 240, 138, 0.55)',
    cloudTint: 'rgba(255, 250, 240, 0.72)',
    starAlpha: 0,
    fogHex: 0xdbeafe,
    fogDensity: 0.00105,
    hemiSkyHex: 0xcbeafe,
    hemiGroundHex: 0x4d7c0f,
    hemiIntensity: 1.08,
    sunHex: 0xffe8ba,
    sunIntensity: 2.3,
    sunOffset: [38, 28, -24],
    rimHex: 0xbae6fd,
    rimIntensity: 0.55,
    groundHex: 0x4d7c0f,
    exposure: 1.08,
    envIntensity: 0.95,
    headlightIntensity: 0,
  },
  afternoon: {
    skyTop: '#0369a1',
    skyMid: '#38bdf8',
    skyHorizon: '#e0f2fe',
    sunDisc: '#ffffff',
    sunHalo: 'rgba(254, 249, 195, 0.45)',
    cloudTint: 'rgba(255, 255, 255, 0.82)',
    starAlpha: 0,
    fogHex: 0xc8e8fb,
    fogDensity: 0.00102,
    hemiSkyHex: 0xdbeafe,
    hemiGroundHex: 0x65a30d,
    hemiIntensity: 1.15,
    sunHex: 0xfff6dc,
    sunIntensity: 2.55,
    sunOffset: [26, 52, 18],
    rimHex: 0xfef08a,
    rimIntensity: 0.52,
    groundHex: 0x4d7c0f,
    exposure: 1.12,
    envIntensity: 1.05,
    headlightIntensity: 0,
  },
  sunset: {
    skyTop: '#2e1065',
    skyMid: '#be185d',
    skyHorizon: '#fb923c',
    sunDisc: '#fef08a',
    sunHalo: 'rgba(249, 115, 22, 0.65)',
    cloudTint: 'rgba(251, 146, 60, 0.48)',
    starAlpha: 0.25,
    fogHex: 0xf97316,
    fogDensity: 0.00112,
    hemiSkyHex: 0xf472b6,
    hemiGroundHex: 0x451a03,
    hemiIntensity: 1.12,
    sunHex: 0xff8a3d,
    sunIntensity: 2.75,
    sunOffset: [42, 17, -34],
    rimHex: 0xe879f9,
    rimIntensity: 0.95,
    groundHex: 0x3f6212,
    exposure: 1.18,
    envIntensity: 1.18,
    headlightIntensity: 1.9,
  },
  night: {
    skyTop: '#020617',
    skyMid: '#1e1b4b',
    skyHorizon: '#312e81',
    sunDisc: '#e2e8f0',
    sunHalo: 'rgba(147, 197, 253, 0.35)',
    cloudTint: 'rgba(99, 102, 241, 0.24)',
    starAlpha: 0.9,
    fogHex: 0x0f172a,
    fogDensity: 0.00128,
    hemiSkyHex: 0x4338ca,
    hemiGroundHex: 0x0f172a,
    hemiIntensity: 0.82,
    sunHex: 0x93c5fd,
    sunIntensity: 0.98,
    sunOffset: [22, 42, -22],
    rimHex: 0xf472b6,
    rimIntensity: 0.88,
    groundHex: 0x1e293b,
    exposure: 1.24,
    envIntensity: 1.12,
    headlightIntensity: 4.8,
  },
};

const ENV_STORAGE_KEY = 'hero_rastar_raja_env_v1';

export class HeroRastarEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private skyDome: THREE.Mesh;
  private skyCanvas: HTMLCanvasElement;
  private skyCtx: CanvasRenderingContext2D;
  private skyTex: THREE.CanvasTexture;
  private bikeHeadlightGroup: THREE.Group;
  private bikeHeadlightSpot: THREE.SpotLight;
  private bikeHeadlightCone: THREE.Mesh;
  private environmentPreset: EnvironmentPresetId = 'sunset';
  private motionSensitivity: 'low' | 'medium' | 'high' = 'medium';
  private sunOffset = new THREE.Vector3(42, 17, -34);
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
  private motion = new MotionController();

  // Player Physics State (Yaw-only upright motorcycle with elevation tracking for flyovers)
  private gameState: GameState = GameState.MENU;
  private playerX = 133.25;
  private playerY = 0;
  private playerZ = -1300;
  private playerYaw = 0; // 0 = -Z (North)
  private forwardSpeed = 6; // m/s along bike forward vector
  private lateralSlip = 0;
  private smoothedSteer = 0;
  private bikeLean = 0;
  private bikePitch = 0;
  private bikeSlopePitch = 0;
  private bikeRollCrash = 0;
  private postHitRecoveryTimer = 0;
  private wasBoosting = false;
  private freeNitroTimer = 0;
  private currentCorridor: CorridorId = 'tejgaon';

  // Fuel & Hose
  private fuelAmount = 100;
  private emptyStoppedTimer = 0;
  private refuelBonusGiven = false;
  private refuelSafeGraceTimer = 0;
  private refuelShieldUsedThisStop = false;

  // Showroom, Bikers Rest Room & Bike Progression
  private heroBankScore = 0;
  private unlockedBikes: BikeTierId[] = ['glamour_125'];
  private equippedBikeId: BikeTierId = 'glamour_125';
  private showroomReturnState: GameState = GameState.MENU;
  private showroomExitCooldown = 0;
  private showroomVisitedLock = false;
  private showroomSaluteLock = false;
  private restRoomVisitedLock = false;
  private purbachalTurnBonusGiven = false;
  private uttaraTurnBonusGiven = false;
  private bashundharaAreaBonusGiven = false;
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
  private camLookInitialized = false;

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

    this.environmentPreset = this.loadEnvironmentPreset();
    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xf97316);
    this.scene.background = skyColor;
    // Lighter haze + long view range: keeps upcoming roads, flyovers & U-turns crisp well ahead.
    this.scene.fog = new THREE.FogExp2(0xf97316, 0.00112);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const aspect = (container.clientWidth || window.innerWidth) / Math.max(container.clientHeight || window.innerHeight, 1);
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.2, 540);

    // Dynamic GTA-6 Gradient SkyDome
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 512;
    this.skyCanvas.height = 512;
    this.skyCtx = this.skyCanvas.getContext('2d')!;
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(480, 28, 18),
      new THREE.MeshBasicMaterial({
        map: this.skyTex,
        side: THREE.BackSide,
        fog: false,
        depthWrite: false,
      })
    );
    this.scene.add(this.skyDome);

    // 3-point tropical Dhaka atmosphere rig (1 shadow caster)
    const hemi = new THREE.HemisphereLight(0xf472b6, 0x451a03, 1.12);
    this.scene.add(hemi);
    this.hemiLight = hemi;

    const sun = new THREE.DirectionalLight(0xff8a3d, 2.75);
    sun.position.set(42, 17, -34);
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

    const rim = new THREE.DirectionalLight(0xe879f9, 0.95);
    rim.position.set(-20, 18, -30);
    this.scene.add(rim);
    this.rimLight = rim;

    this.textures = createProceduralTextures(this.renderer);
    this.world = buildDhakaWorld(this.textures);
    this.scene.add(this.world.root);

    this.heroRig = buildHeroMotorcycle(this.textures, this.equippedBikeId);
    this.heroRig.group.position.set(this.playerX, 0, this.playerZ);
    this.scene.add(this.heroRig.group);

    // Active Hero Bike Headlight (illuminates Dhaka roads & 300ft in Sunset & Night)
    this.bikeHeadlightGroup = new THREE.Group();
    this.bikeHeadlightSpot = new THREE.SpotLight(0xfef9c3, 2.0, 58, Math.PI / 5, 0.55, 1.4);
    this.bikeHeadlightSpot.position.set(0, 0.72, -0.58);
    this.bikeHeadlightSpot.target.position.set(0, 0.05, -18);
    const coneGeo = new THREE.ConeGeometry(2.6, 13, 14, 1, true);
    coneGeo.translate(0, -6.5, 0);
    coneGeo.rotateX(Math.PI / 2);
    this.bikeHeadlightCone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
    );
    this.bikeHeadlightCone.position.set(0, 0.72, -0.62);
    this.bikeHeadlightGroup.add(this.bikeHeadlightSpot, this.bikeHeadlightSpot.target, this.bikeHeadlightCone);
    this.heroRig.group.add(this.bikeHeadlightGroup);

    this.applyEnvironmentTheme(this.environmentPreset);

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
    // iOS Safari requires touchstart or click (not pointerdown) for audio unlock.
    window.addEventListener('touchstart', this.handleFirstGesture, { passive: true });

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
    if (this.bikeHeadlightGroup.parent === this.heroRig.group) {
      this.heroRig.group.remove(this.bikeHeadlightGroup);
    }
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
    this.heroRig.group.add(this.bikeHeadlightGroup);
    this.scene.add(this.heroRig.group);
  }

  private loadEnvironmentPreset(): EnvironmentPresetId {
    try {
      const saved = localStorage.getItem(ENV_STORAGE_KEY);
      if (saved === 'morning' || saved === 'afternoon' || saved === 'sunset' || saved === 'night') {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return 'sunset';
  }

  public getEnvironmentPreset(): EnvironmentPresetId {
    return this.environmentPreset;
  }

  public setEnvironmentPreset(preset: EnvironmentPresetId): void {
    this.environmentPreset = preset;
    try {
      localStorage.setItem(ENV_STORAGE_KEY, preset);
    } catch {
      // Ignore
    }
    this.applyEnvironmentTheme(preset);
    const meta = ENVIRONMENT_PRESETS.find((p) => p.id === preset);
    if (meta) {
      this.pushPopup(`পরিবেশ: ${meta.labelBn}`, meta.labelEn, 'bonus');
    }
    this.emitHud();
  }

  public cycleEnvironmentPreset(): EnvironmentPresetId {
    const idx = ENVIRONMENT_PRESETS.findIndex((p) => p.id === this.environmentPreset);
    const next = ENVIRONMENT_PRESETS[(idx + 1) % ENVIRONMENT_PRESETS.length].id;
    this.setEnvironmentPreset(next);
    return next;
  }

  private applyEnvironmentTheme(preset: EnvironmentPresetId): void {
    const cfg = ENV_THEMES[preset];
    this.renderer.toneMappingExposure = cfg.exposure;
    this.scene.environmentIntensity = cfg.envIntensity;
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(cfg.fogHex);
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(cfg.fogHex);
      this.scene.fog.density = cfg.fogDensity;
    }

    this.hemiLight.color.setHex(cfg.hemiSkyHex);
    this.hemiLight.groundColor.setHex(cfg.hemiGroundHex);
    this.hemiLight.intensity = cfg.hemiIntensity;

    this.sunLight.color.setHex(cfg.sunHex);
    this.sunLight.intensity = cfg.sunIntensity;
    this.sunOffset.set(cfg.sunOffset[0], cfg.sunOffset[1], cfg.sunOffset[2]);

    this.rimLight.color.setHex(cfg.rimHex);
    this.rimLight.intensity = cfg.rimIntensity;

    const gMat = this.world.groundPlane.material as THREE.MeshStandardMaterial;
    if (gMat && gMat.color) {
      gMat.color.setHex(cfg.groundHex);
    }

    const headOn = cfg.headlightIntensity > 0;
    this.bikeHeadlightSpot.intensity = cfg.headlightIntensity;
    this.bikeHeadlightCone.visible = headOn;
    (this.bikeHeadlightCone.material as THREE.MeshBasicMaterial).opacity = preset === 'night' ? 0.19 : 0.1;

    this.redrawSkyDome(cfg, preset);
  }

  private redrawSkyDome(cfg: EnvironmentThemeConfig, preset: EnvironmentPresetId): void {
    const ctx = this.skyCtx;
    const w = this.skyCanvas.width;
    const h = this.skyCanvas.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, cfg.skyTop);
    grad.addColorStop(0.32, cfg.skyMid);
    grad.addColorStop(0.54, cfg.skyHorizon);
    grad.addColorStop(1.0, cfg.skyHorizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (cfg.starAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${cfg.starAlpha})`;
      for (let i = 0; i < 120; i++) {
        const sx = (i * 173 + 29) % w;
        const sy = (i * 97 + 17) % Math.floor(h * 0.36);
        const r = i % 5 === 0 ? 1.8 : 1.0;
        ctx.fillRect(sx, sy, r, r);
      }
    }

    // Glowing Sun / Moon Disc + Atmospheric Halo in Northern Horizon
    const discX = w * 0.56;
    const discY = preset === 'afternoon' ? h * 0.22 : preset === 'morning' ? h * 0.34 : preset === 'sunset' ? h * 0.44 : h * 0.26;
    const haloR = preset === 'sunset' ? 115 : 85;
    const halo = ctx.createRadialGradient(discX, discY, 8, discX, discY, haloR);
    halo.addColorStop(0, cfg.sunDisc);
    halo.addColorStop(0.28, cfg.sunHalo);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(discX - haloR, discY - haloR, haloR * 2, haloR * 2);

    ctx.fillStyle = cfg.sunDisc;
    ctx.beginPath();
    ctx.arc(discX, discY, preset === 'sunset' ? 24 : 16, 0, Math.PI * 2);
    ctx.fill();

    // Soft Leonida-style Tropical Cloud Streaks
    ctx.fillStyle = cfg.cloudTint;
    for (let i = 0; i < 14; i++) {
      const cx = ((i * 118 + 40) % (w - 80)) + 40;
      const cy = h * (0.22 + (i % 5) * 0.055);
      const cw = 72 + (i % 4) * 34;
      const ch = 12 + (i % 3) * 6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    this.skyTex.needsUpdate = true;
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
    const dirX = -Math.sin(yaw);
    const dirZ = -Math.cos(yaw);
    const prevYHint = entity.kurilPhase.startsWith('eb_')
      ? 10.6
      : entity.kurilPhase.startsWith('wb_')
        ? 5.2
        : 0;
    const surf = sampleDhakaSurface(xPos, zPos, prevYHint, dirX, dirZ);

    entity.kind = kind;
    entity.x = xPos;
    entity.y = surf.groundY;
    entity.z = zPos;
    entity.yaw = yaw;
    entity.dirX = dirX;
    entity.dirZ = dirZ;
    entity.deckId = surf.deckId;
    entity.baseSpeed =
      (spec.minSpeed + Math.random() * (spec.maxSpeed - spec.minSpeed)) * GAME_CONFIG.TRAFFIC_SPEED_BOOST;
    entity.currentSpeed = entity.baseSpeed;
    entity.targetSpeed = entity.baseSpeed;
    entity.wrecked = false;
    entity.frozen = false;
    entity.nearMissedThisPass = false;
    entity.hitCooldown = 0;
    entity.turnCooldown = 0;

    if (entity.rig.group.parent) {
      this.scene.remove(entity.rig.group);
    }
    const rig = buildTrafficVehicle(kind, this.textures, entity.id + Math.floor(Math.random() * 7));
    if (entity.routeTag === 'SPINE_TO_UTTARA' || entity.routeTag === 'KURIL_RAMP_TO_300FT') {
      const badgeTex =
        entity.routeTag === 'KURIL_RAMP_TO_300FT'
          ? this.textures.routeBadge300ft
          : this.textures.routeBadgeUttara;
      const badgeY = spec.tier === 'large' ? 3.55 : spec.tier === 'medium' ? 2.02 : 1.75;
      const badge = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.56, 0.1),
        new THREE.MeshBasicMaterial({ map: badgeTex })
      );
      badge.position.set(0, badgeY, -spec.halfLength * 0.2);
      rig.group.add(badge);
    }
    rig.group.scale.setScalar(0.58);
    rig.group.rotation.order = 'YXZ';
    rig.group.rotation.set(surf.pitchRad, yaw, 0);
    rig.group.position.set(xPos, surf.groundY, zPos);
    this.scene.add(rig.group);
    entity.rig = rig;
  }

  private setupInitialArterySlot(
    i: number,
    kind: VehicleKind
  ): {
    laneIdx: number;
    laneX: number;
    z: number;
    yaw: number;
    routeTag: TrafficRouteTag;
    kurilPhase: KurilRampPhase;
    arcAngle: number;
  } {
    let laneIdx =
      i === 0 || i === 1
        ? 0
        : i === 2 || i === 3
          ? 1
          : i === 4
            ? 2
            : pickArteryLaneForKind(kind);
    let laneX = GAME_CONFIG.ARTERY_LANES[laneIdx];
    let z =
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
                : i >= 22 && i <= 25
                  ? -910 - (i - 22) * 44
                  : -((i * 42 + 44) % 1090);
    let yaw = laneX > 0 ? Math.PI : 0;
    let routeTag: TrafficRouteTag = 'METRO_LOCAL';
    let kurilPhase: KurilRampPhase = 'none';
    let arcAngle = 0;

    if (i >= 22 && i <= 25) {
      laneIdx = i % 2 === 0 ? 1 : 0;
      laneX = GAME_CONFIG.ARTERY_LANES[laneIdx];
      yaw = 0;
    } else if (i >= 26 && i <= 30) {
      // Pre-seed Tejgaon Link Road (z = -1120, x = 22..120) — Keep-Left: Eastbound North (-1124.5), Westbound South (-1115.5)
      const slot = i - 26;
      const goEast = slot % 3 !== 0;
      laneX = 22 + slot * 22;
      z = goEast ? -1124.5 : -1115.5;
      yaw = goEast ? -Math.PI / 2 : Math.PI / 2;
    } else if (i >= 31 && i <= 35) {
      // Dedicated straight-through Uttara vehicles (clear of Kuril Flyover ramp!)
      const slot = i - 31;
      routeTag = 'SPINE_TO_UTTARA';
      const goNorth = slot < 4;
      laneIdx = goNorth ? slot % 2 : 2 + (slot % 2);
      laneX = CORRIDOR_CONFIG.SPINE_LANES[laneIdx];
      z = goNorth ? -2580 - slot * 210 : -3180;
      yaw = goNorth ? 0 : Math.PI;
    } else if (i >= 36) {
      // Dedicated Kuril Flyover -> 300ft vehicles (Upper 10.6m Eastbound & Lower 5.2m Westbound!)
      const slot = i - 36;
      routeTag = 'KURIL_RAMP_TO_300FT';
      laneIdx = 1;
      if (slot === 0) {
        laneX = 136.75;
        z = -2630;
        yaw = 0;
      } else if (slot === 1) {
        laneX = 155.0;
        z = -2785;
        yaw = 0;
        kurilPhase = 'eb_ramp_up';
      } else if (slot === 2) {
        arcAngle = Math.PI * 0.78;
        laneX = 240.5 + 85.5 * Math.cos(arcAngle);
        z = -2845.0 - 85.5 * Math.sin(arcAngle);
        yaw = Math.atan2(-Math.sin(arcAngle), -Math.cos(arcAngle));
        kurilPhase = 'eb_arc';
      } else if (slot === 3) {
        laneX = 330.0;
        z = -2930.5;
        yaw = -Math.PI / 2;
        kurilPhase = 'eb_ramp_down';
      } else if (slot === 4) {
        laneX = 480.0;
        z = -2930.5;
        yaw = -Math.PI / 2;
      } else {
        arcAngle = -Math.PI * 0.72;
        laneX = 230.0 + 61.5 * Math.cos(arcAngle);
        z = -2848.0 + 61.5 * Math.sin(arcAngle);
        yaw = Math.atan2(-Math.sin(arcAngle), Math.cos(arcAngle));
        kurilPhase = 'wb_arc';
      }
    }

    return { laneIdx, laneX, z, yaw, routeTag, kurilPhase, arcAngle };
  }

  private initTrafficPools(): void {
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

      const slot = this.setupInitialArterySlot(i, kind);
      const dummyRig = buildTrafficVehicle(kind, this.textures, i);
      const entity: TrafficEntity = {
        id: i,
        isCityVehicle: false,
        routeTag: slot.routeTag,
        kurilPhase: slot.kurilPhase,
        arcAngle: slot.arcAngle,
        kind,
        rig: dummyRig,
        x: slot.laneX,
        y: 0,
        z: slot.z,
        yaw: slot.yaw,
        dirX: -Math.sin(slot.yaw),
        dirZ: -Math.cos(slot.yaw),
        laneIdx: slot.laneIdx,
        baseSpeed: 12,
        currentSpeed: 12,
        targetSpeed: 12,
        frozen: false,
        wrecked: false,
        wreckTimer: 0,
        nearMissedThisPass: false,
        hitCooldown: 0,
        lookaheadTimer: (i % 5) * 0.04,
        turnCooldown: 0,
        deckId: null,
      };
      this.spawnTrafficSlot(entity, kind, slot.z, slot.laneX, slot.yaw);
      this.traffic.push(entity);
    }

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
        routeTag: 'METRO_LOCAL',
        kurilPhase: 'none',
        arcAngle: 0,
        kind,
        rig: dummyRig,
        x,
        y: 0,
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
        turnCooldown: 0,
        deckId: null,
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

    // Sidewalk pedestrians along Metro & Spine + Neela Market
    for (let i = 0; i < 24; i++) {
      const rig = buildPedestrian(shirtPalette[(i + 2) % shirtPalette.length], 0x334155);
      const side = i % 2 === 0 ? -1 : 1;
      let x = 0;
      let pz = 0;
      if (i >= 18) {
        // Neela Market & Bikers Rest Room (300ft South/North edges)
        x = CORRIDOR_CONFIG.NEELA_MARKET_X + (i - 20.5) * 14;
        pz = CORRIDOR_CONFIG.EXPRESSWAY_Z + (side > 0 ? 19.2 : -19.2);
      } else if (i >= 12) {
        // Tejgaon / Mohakhali / Banani / Uttara Spine sidewalks
        x = CORRIDOR_CONFIG.SPINE_X + side * (CORRIDOR_CONFIG.SPINE_HALF_WIDTH + 1.5);
        pz = -1260 - (i - 12) * 380;
      } else {
        // Metro artery & downtown avenues
        x =
          i >= 9
            ? side * 56.5
            : i >= 6
              ? side * 28.5
              : side * (GAME_CONFIG.ARTERY_HALF_WIDTH + 1.5);
        pz = -((i * 75 + 24) % 1020);
      }
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

  private samplePickupLocation(slotIdx: number): { x: number; y: number; z: number } {
    // Place pickups ahead of the player's current corridor so every district stays rich
    if (this.playerX > 165) {
      const lanesZ = [...CORRIDOR_CONFIG.EXPRESSWAY_OUTBOUND_LANES_Z, ...CORRIDOR_CONFIG.EXPRESSWAY_INBOUND_LANES_Z];
      const z = lanesZ[slotIdx % lanesZ.length];
      const x = THREE.MathUtils.clamp(
        this.playerX + (slotIdx % 2 === 0 ? 1 : -1) * (35 + (slotIdx * 23) % 190),
        220,
        2190
      );
      return { x, y: 0, z };
    }
    if (this.playerX >= 12 && this.playerX < 100 && Math.abs(this.playerZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 60) {
      const x = THREE.MathUtils.clamp(20 + ((slotIdx * 19) % 110), 16, 130);
      const z = slotIdx % 2 === 0 ? -1115.5 : -1124.5;
      return { x, y: 0, z };
    }
    if (this.playerX >= 100 && this.playerX <= 165) {
      const x = CORRIDOR_CONFIG.SPINE_LANES[slotIdx % CORRIDOR_CONFIG.SPINE_LANES.length];
      const z = THREE.MathUtils.clamp(
        this.playerZ - 25 - ((slotIdx * 34) % 240),
        CORRIDOR_CONFIG.SPINE_MIN_Z + 30,
        CORRIDOR_CONFIG.SPINE_MAX_Z - 20
      );
      const surf = sampleDhakaSurface(x, z, 0);
      return { x, y: surf.groundY, z };
    }
    const roadXs = [
      ...GAME_CONFIG.ARTERY_LANES,
      GAME_CONFIG.AVENUE_LEFT_INNER_X - 2.2,
      GAME_CONFIG.AVENUE_RIGHT_INNER_X + 2.2,
      GAME_CONFIG.AVENUE_LEFT_OUTER_X - 2.0,
      GAME_CONFIG.AVENUE_RIGHT_OUTER_X + 2.0,
    ];
    const x = roadXs[(slotIdx * 3 + Math.floor(Math.random() * roadXs.length)) % roadXs.length];
    const z = -((slotIdx * 52 + 46 + Math.random() * 14) % 1140);
    return { x, y: 0, z };
  }

  private initPickups(): void {
    const kinds: PickupKind[] = ['coin', 'coin', 'coin', 'fuel', 'coin', 'nitro'];
    for (let i = 0; i < 18; i++) {
      const kind = kinds[i % kinds.length];
      const mesh = buildCollectiblePickup(kind);
      const { x, y, z } = this.samplePickupLocation(i);
      mesh.position.set(x, y + 0.9, z);
      this.scene.add(mesh);
      this.pickups.push({
        id: i,
        kind,
        mesh,
        x,
        y,
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
    this.motion.recalibrate();
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
    this.playerX = 133.25;
    this.playerY = 0;
    this.playerZ = -1300;
    this.playerYaw = 0;
    this.forwardSpeed = 6;
    this.lateralSlip = 0;
    this.smoothedSteer = 0;
    this.camLookInitialized = false;
    this.bikeLean = 0;
    this.bikePitch = 0;
    this.bikeSlopePitch = 0;
    this.bikeRollCrash = 0;
    this.postHitRecoveryTimer = 0;
    this.wasBoosting = false;
    this.freeNitroTimer = 0;
    this.currentCorridor = 'tejgaon';
    this.motion.recalibrate();

    this.fuelAmount = this.getActiveBikeSpec().fuelCapacity;
    this.emptyStoppedTimer = 0;
    this.refuelBonusGiven = false;
    this.refuelSafeGraceTimer = 0;
    this.refuelShieldUsedThisStop = false;
    this.showroomExitCooldown = 0;
    this.showroomVisitedLock = false;
    this.showroomSaluteLock = false;
    this.restRoomVisitedLock = false;
    this.purbachalTurnBonusGiven = false;
    this.uttaraTurnBonusGiven = false;
    this.bashundharaAreaBonusGiven = false;
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

    // Reset Traffic cleanly away from spawn across Metro, Tejgaon Link, Uttara & Kuril Flyover corridors
    for (let i = 0; i < this.traffic.length; i++) {
      const t = this.traffic[i];
      if (!t.isCityVehicle) {
        const slot = this.setupInitialArterySlot(t.id, t.kind);
        t.routeTag = slot.routeTag;
        t.kurilPhase = slot.kurilPhase;
        t.arcAngle = slot.arcAngle;
        t.laneIdx = slot.laneIdx;
        let z = slot.z;
        if (slot.routeTag === 'METRO_LOCAL' && Math.abs(slot.laneX) < 12 && Math.abs(z - this.playerZ) < 18) {
          z -= 44;
        }
        this.spawnTrafficSlot(t, t.kind, z, slot.laneX, slot.yaw);
      } else {
        const lane = this.world.cityLanes[t.laneIdx];
        const pt = this.sampleCityLanePoint(lane, ((t.id - 100) * 0.37) % 1);
        t.routeTag = 'METRO_LOCAL';
        t.kurilPhase = 'none';
        t.arcAngle = 0;
        this.spawnTrafficSlot(t, t.kind, pt.z, pt.x, pt.yaw);
        t.baseSpeed = Math.min(t.baseSpeed, 10.5);
        t.currentSpeed = t.baseSpeed;
      }
    }

    // Reset Pickups
    for (const pk of this.pickups) {
      const loc = this.samplePickupLocation(pk.id);
      pk.x = loc.x;
      pk.y = loc.y;
      pk.z = loc.z;
      pk.respawnTimer = 0;
      pk.mesh.visible = true;
      pk.mesh.position.set(pk.x, pk.y + 0.9, pk.z);
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
    this.world.updateAroundPlayer(this.playerZ, this.elapsedSec, this.playerX);
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

  /** Turns on gyroscope / device-tilt steering. Resolves false when unsupported or denied. */
  public async enableMotionControl(): Promise<boolean> {
    this.audio.unlock();
    return this.motion.enable();
  }

  public disableMotionControl(): void {
    this.motion.disable();
    this.smoothedSteer = 0;
  }

  /** Re-captures the neutral tilt so the rider's current hold angle becomes "straight". */
  public recalibrateMotionControl(): void {
    this.motion.recalibrate();
  }

  /** Sets motion steering sensitivity (low = more tilt needed, high = less). */
  public setMotionSensitivity(preset: 'low' | 'medium' | 'high'): void {
    this.motionSensitivity = preset;
    this.motion.setSensitivity(preset);
    this.emitHud();
  }

  public getMotionStatus(): MotionStatus {
    return this.motion.getStatus();
  }

  public isMotionControlEnabled(): boolean {
    return this.motion.isEnabled;
  }

  /** Surfaces a short HUD toast outside the normal gameplay flow. */
  public showNotice(title: string, subtitle?: string, tone: EventPopup['tone'] = 'warning'): void {
    this.pushPopup(title, subtitle, tone);
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
      this.skyDome.position.copy(this.camera.position);
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
      this.sunLight.position.set(
        this.playerX + this.sunOffset.x,
        this.sunOffset.y,
        this.playerZ + this.sunOffset.z
      );
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

      // Scripted Slapper runs up to the bike and delivers dramatic slap!
      const sx = this.slapperRig.group.position.x;
      const sz = this.slapperRig.group.position.z;
      const dx = this.playerX - sx;
      const dz = this.playerZ - sz;
      const dist = Math.hypot(dx, dz);
      this.slapperRig.group.rotation.y = Math.atan2(dx, dz);
      this.slapperRig.group.position.y = this.playerY;

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
        // Wind-up & slap follow-through
        const slapSwing = Math.sin(Math.min(1, (1.4 - this.crashTimer) * 4) * Math.PI) * 2.2;
        this.slapperRig.rightArmPivot.rotation.x = -slapSwing;
      }

      // Snap crash focus camera
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
      this.heroRig.group.position.set(this.playerX, this.playerY, this.playerZ);
      this.heroRig.group.rotation.set(0, this.playerYaw, 0);
      this.heroRig.leanGroup.rotation.set(0, 0, 0);

      const angle = this.elapsedSec * 0.55;
      _camTarget.set(
        this.playerX + Math.sin(angle) * 4.2,
        this.playerY + 1.95,
        this.playerZ + Math.cos(angle) * 4.2
      );
      this.camera.position.lerp(_camTarget, 1 - Math.exp(-5 * dt));
      _lookTarget.set(this.playerX, this.playerY + 0.85, this.playerZ);
      this.camera.lookAt(_lookTarget);
      this.sunLight.position.set(
        this.playerX + this.sunOffset.x,
        this.playerY + this.sunOffset.y,
        this.playerZ + this.sunOffset.z
      );
      this.sunLight.target.position.set(this.playerX, this.playerY, this.playerZ - 12);
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

    // Motion steering implies auto-throttle: while tilt mode is live the bike
    // keeps rolling forward so the rider only has to lean the phone to steer.
    // The rider can modulate speed by leaning forward (accelerate) or back (brake).
    // Braking / reverse / handbrake always take priority below.
    const motionThrottleAxis = this.motion.getThrottle(dt);
    const motionThrottle =
      this.motion.isActive() && !this.input.brake && !this.input.reverse && !this.input.handbrake;

    // In motion mode, cap auto-throttle to a controllable cruising pace (~72% of
    // the bike's normal max) so the bike doesn't pin to top speed where tilt
    // steering becomes twitchy. Boost still overrides (to exceed the cap), and the
    // brake can slow further. This is what makes motion mode feel "planted" at speed.
    // The throttle axis modulates: forward lean raises the cap, back lean lowers it.
    const motionCruiseMps = bikeSpec.maxNormalMps * 0.72;
    const throttleModulation = 1.0 + motionThrottleAxis * 0.28; // ±28% from center
    const effectiveMaxFwdMps = motionThrottle
      ? bikeSpec.maxNormalMps * THREE.MathUtils.clamp(throttleModulation, 0.5, 1.0)
      : maxFwdMps;

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
    } else if (this.input.accelerate || hasFreeNitro || motionThrottle) {
      accel = (isBoosting ? 24 : hasFuel ? 14.5 : 6.0) * bikeSpec.accelMult;
    } else {
      accel = -Math.sign(this.forwardSpeed) * 4.5;
      if (Math.abs(this.forwardSpeed) < 0.35) this.forwardSpeed = 0;
    }

    this.forwardSpeed = THREE.MathUtils.clamp(this.forwardSpeed + accel * dt, maxRevMps, effectiveMaxFwdMps);
    // In motion mode, gently settle to the cruise cap (unless boosting).
    const overspeedTarget = motionThrottle
      ? Math.min(hasFuel ? bikeSpec.maxNormalMps : GAME_CONFIG.MAX_SPEED_EMPTY_MPS, effectiveMaxFwdMps)
      : hasFuel
        ? bikeSpec.maxNormalMps
        : GAME_CONFIG.MAX_SPEED_EMPTY_MPS;
    if (!isBoosting && this.forwardSpeed > overspeedTarget) {
      this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, overspeedTarget, 2.6, dt);
    }
    // Motion throttle-axis braking: leaning the phone back applies gentle engine
    // braking (in addition to the dedicated brake button).
    if (motionThrottle && motionThrottleAxis < -0.3 && this.forwardSpeed > 3) {
      this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, 6, 3.5, dt);
    }

    // 2. Smoothed Speed-Scaled Steering (smooth ramp-in, crisp center on release, flips in reverse)
    const keySteer = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0); // +1 left (+Yaw CCW), -1 right
    // Motion / tilt steering only takes over when no key or touch steer is held,
    // so the on-screen buttons always win when both are available.
    const speedNormPre = THREE.MathUtils.clamp(Math.abs(this.forwardSpeed) / bikeSpec.maxBoostMps, 0, 1);
    const motionSteer = this.motion.getSteer(dt, speedNormPre);
    const rawSteer = keySteer !== 0 ? keySteer : motionSteer;
    // Smooth ramp-in so button taps build up gently (no snappy jolt), while releasing
    // the button still re-centers reasonably fast so you never fight a lingering lean.
    const steerRate = rawSteer !== 0 ? 4.6 : 12.0;
    this.smoothedSteer = THREE.MathUtils.damp(this.smoothedSteer, rawSteer, steerRate, dt);
    // Gentle expo (v^1.1): keeps the mid-range usable while softening the initial
    // bite of a button press so steering feels smooth rather than twitchy.
    const sAbs = Math.abs(this.smoothedSteer);
    const effectiveSteer = Math.sign(this.smoothedSteer) * Math.pow(sAbs, 1.1);

    // 2b. Automatic U-Turn Speed Reduction & Cornering Assist
    const inUTurnPlaza = this.isInUTurnZone(this.playerX, this.playerZ);
    const isSharpUTurnSteer = Math.abs(this.smoothedSteer) > 0.72;
    if (inUTurnPlaza && this.forwardSpeed > 4.0) {
      const uTurnCapMps = Math.abs(this.smoothedSteer) > 0.35 ? 11.2 : 13.5; // ~38-46 km/h smooth U-turn pace
      if (this.forwardSpeed > uTurnCapMps) {
        this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, uTurnCapMps, 4.4, dt);
      }
    } else if (isSharpUTurnSteer && this.forwardSpeed > 15.2 && !isBoosting) {
      // Gentle auto-slowdown when making a tight hairpin U-turn anywhere on the road
      this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, 14.8, 2.2, dt);
    }
    // Cornering speed-scrub (motion mode only): when leaning hard at speed, gently
    // scrub a little speed to maintain grip — mimics real racing-game cornering feel
    // and makes high-speed tilt steering feel planted rather than twitchy.
    if (motionThrottle && !isBoosting && Math.abs(this.smoothedSteer) > 0.55 && this.forwardSpeed > 16) {
      const scrub = 3.5 * Math.abs(this.smoothedSteer) * dt;
      this.forwardSpeed = Math.max(10, this.forwardSpeed - scrub);
    }

    const absSpeed = Math.abs(this.forwardSpeed);
    const speedNorm = THREE.MathUtils.clamp(absSpeed / bikeSpec.maxBoostMps, 0, 1);
    // Progressive, speed-scaled turn authority. Previously a flat 1.48 (low) → 0.78
    // (high) made the bike twitchy and prone to over-steering ("chakes") at low and
    // mid speed. The curve below is gentler at crawl speed (precise maneuvering),
    // peaks around cruising speed, then settles down at high speed for stability.
    //   speedNorm 0.0 → 0.92   (easy, controllable maneuvering)
    //   speedNorm 0.5 → 1.12   (confident mid-speed cornering)
    //   speedNorm 1.0 → 0.66   (calm, planted high-speed lane changes)
    const lowAuth = 0.92;
    const midAuth = 1.12;
    const highAuth = 0.66;
    let turnAuthority: number;
    if (speedNorm < 0.5) {
      turnAuthority = THREE.MathUtils.lerp(lowAuth, midAuth, speedNorm / 0.5);
    } else {
      turnAuthority = THREE.MathUtils.lerp(midAuth, highAuth, (speedNorm - 0.5) / 0.5);
    }
    turnAuthority *=
      (absSpeed < 1.0 ? 0.35 : 1.0) * // near-standstill: don't pivot on the spot
      (inUTurnPlaza ? 1.2 : 1.0); // U-turn plazas still allow tight hairpins
    const reverseFlip = this.forwardSpeed < -0.5 ? -1 : 1;
    this.playerYaw += effectiveSteer * turnAuthority * reverseFlip * dt;

    // Forward vector from yaw (0 = -Z)
    const fwdX = -Math.sin(this.playerYaw);
    const fwdZ = -Math.cos(this.playerYaw);

    // High lateral grip damping (extra grip after small-vehicle smash!)
    const gripDamp = this.postHitRecoveryTimer > 0 ? 22 : 12;
    this.lateralSlip = THREE.MathUtils.damp(this.lateralSlip, 0, gripDamp, dt);

    this.playerX += (fwdX * this.forwardSpeed + Math.cos(this.playerYaw) * this.lateralSlip) * dt;
    this.playerZ += (fwdZ * this.forwardSpeed - Math.sin(this.playerYaw) * this.lateralSlip) * dt;

    // Metro Rail south-end turnaround: at the far end, place the bike onto
    // the opposite lane and reverse heading toward the Tejgaon turnoff.
    if (
      this.forwardSpeed > 2 &&
      fwdZ < -0.5 &&
      Math.abs(this.playerX) < 18 &&
      this.playerZ <= CORRIDOR_CONFIG.METRO_END_UTURN_Z - 28
    ) {
      this.playerX = this.playerX <= 0 ? 3.25 : -3.25;
      this.playerZ = -1238;
      this.playerYaw = Math.PI;
      this.forwardSpeed = Math.min(this.forwardSpeed, 10);
      this.lateralSlip = 0;
      this.pushPopup('মেট্রো রেল ইউ-টার্ন!', 'তেজগাঁওয়ের দিকে ফিরুন • +400 pts!', 'bonus');
      this.addPoints(400);
    }

    // Downtown south/start-end turnaround: the mirror of the Metro End loop.
    // Swing the bike around onto the opposite lane and head back north so the
    // road behind the spawn never feels like it simply runs out.
    if (
      this.forwardSpeed > 2 &&
      fwdZ > 0.5 &&
      Math.abs(this.playerX) < 25 &&
      this.playerZ >= CORRIDOR_CONFIG.DOWNTOWN_SOUTH_UTURN_Z + 20
    ) {
      this.playerX = this.playerX <= 0 ? 3.25 : -3.25;
      this.playerZ = CORRIDOR_CONFIG.DOWNTOWN_SOUTH_UTURN_Z - 4;
      this.playerYaw = 0;
      this.forwardSpeed = Math.min(this.forwardSpeed, 10);
      this.lateralSlip = 0;
      this.pushPopup('ইউ-টার্ন!', 'মেট্রো ও ফার্মগেটের দিকে ফিরুন', 'bonus');
    }

    // 3. Solid Building, Corridor Bounds & Flyover Guardrails
    this.resolveSolidCollisions();

    // 4. Sample Continuous 3D Road & Flyover Surface Elevation + Slope Pitch
    const playerDeckLock = this.currentCorridor.startsWith('flyover_') ? this.currentCorridor : null;
    const surface = sampleDhakaSurface(this.playerX, this.playerZ, this.playerY, fwdX, fwdZ, playerDeckLock);
    this.playerY = THREE.MathUtils.damp(this.playerY, surface.groundY, 18, dt);
    this.bikeSlopePitch = THREE.MathUtils.damp(this.bikeSlopePitch, surface.pitchRad, 14, dt);
    this.currentCorridor = surface.corridor;

    // U-Turn Destination Bonuses (Purbachal 300ft End & Uttara End)
    if (
      !this.bashundharaAreaBonusGiven &&
      this.currentCorridor === 'expressway300ft' &&
      this.playerX >= 330 &&
      this.playerX <= 410 &&
      Math.abs(this.playerZ - CORRIDOR_CONFIG.EXPRESSWAY_Z) < 34
    ) {
      this.bashundharaAreaBonusGiven = true;
      this.addPoints(100);
      this.audio.playDing(this.combo);
      this.flashScreen('green', 0.18);
      this.pushPopup('বসুন্ধরা আবাসিক এলাকা!', 'আবাসিক সিটির প্রবেশগেট পার হয়েছেন • +100 pts', 'bonus');
    }
    if (!this.purbachalTurnBonusGiven && this.playerX > CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 35) {
      this.purbachalTurnBonusGiven = true;
      this.addPoints(400);
      this.audio.playDing(this.combo);
      this.flashScreen('green', 0.22);
      this.pushPopup('পূর্বাচল শেষ প্রান্ত!', 'ইউ-টার্ন নিয়ে মহাখালী ফিরুন • +400 pts!', 'bonus');
    }
    if (!this.uttaraTurnBonusGiven && this.playerZ < CORRIDOR_CONFIG.UTTARA_UTURN_Z + 40) {
      this.uttaraTurnBonusGiven = true;
      this.addPoints(400);
      this.audio.playDing(this.combo);
      this.flashScreen('green', 0.22);
      this.pushPopup('উত্তরা হিরো ও ইউ-টার্ন!', 'শোরুম ঘুরে মহাখালী ফিরুন • +400 pts!', 'bonus');
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
        this.audio.playFuelVoice();
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

    // 5b. Niloy Hero Showroom Pad Entry
    const activeShowroom = this.getActiveShowroom();
    if (!activeShowroom) {
      this.showroomVisitedLock = false;
      this.showroomSaluteLock = false;
    } else if (!this.showroomSaluteLock) {
      this.showroomSaluteLock = true;
      this.pushPopup('স্যালুট বস! শোরুমে স্বাগতম!', `${activeShowroom.labelBn}-এ স্বাগতম!`, 'bonus');
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
      this.emitHud(false, inFuelZone, false, false);
      return;
    }

    // 5c. 300 Feet Neela Market Bikers Rest Room (tea & snack stop: full tank + calm mob + free nitro)
    const activeRestRoom = this.getActiveRestRoom();
    const isInRestRoomZone = activeRestRoom !== null;
    if (!activeRestRoom) {
      this.restRoomVisitedLock = false;
    } else if (!this.restRoomVisitedLock && speedKmh <= GAME_CONFIG.RESTROOM_MAX_SPEED_KMH) {
      this.restRoomVisitedLock = true;
      this.fuelAmount = bikeSpec.fuelCapacity;
      for (const p of this.pedestrians) {
        if (p.mode === 'chasing') {
          p.mode = p.isCrosswalk ? 'crossing' : 'sidewalk';
          p.rig.angryBadge.visible = false;
        }
      }
      this.freeNitroTimer = Math.max(this.freeNitroTimer, 4.0);
      this.addPoints(350);
      this.audio.playTankFull();
      this.flashScreen('green', 0.3);
      this.pushPopup('বাইকারস রেস্ট রুম!', 'চা-নাস্তা ব্রেক: ফুল ট্যাংক, পাবলিক শান্ত ও +350 pts!', 'refuel');
    }

    // 6. Violations: Wrong-Way (+15/s) & Sidewalk Driving (+10/s)
    this.updateViolations(dt, speedKmh, fwdX, fwdZ);

    // 7. Hero Bike Kinematics & Exhaust Smoke
    const targetLean = effectiveSteer * 0.26 * THREE.MathUtils.clamp(absSpeed / 10, 0.2, 1.0);
    this.bikeLean = THREE.MathUtils.damp(this.bikeLean, targetLean, 6, dt);
    const targetPitch = this.input.handbrake || brakingWithTouchBrake ? -0.09 : isBoosting ? 0.08 : 0;
    this.bikePitch = THREE.MathUtils.damp(this.bikePitch, targetPitch, 8, dt);

    this.heroRig.group.position.set(this.playerX, this.playerY, this.playerZ);
    this.heroRig.group.rotation.set(0, this.playerYaw, 0);
    this.heroRig.leanGroup.rotation.set(this.bikePitch + this.bikeSlopePitch, 0, this.bikeLean);
    this.heroRig.frontFork.rotation.y = THREE.MathUtils.damp(
      this.heroRig.frontFork.rotation.y,
      effectiveSteer * 0.2,
      10,
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
    this.sunLight.position.set(
      this.playerX + this.sunOffset.x,
      this.playerY + this.sunOffset.y,
      this.playerZ + this.sunOffset.z
    );
    this.sunLight.target.position.set(this.playerX, this.playerY, this.playerZ - 16);

    this.hudEmitAccumulator += dt;
    if (this.hudEmitAccumulator >= 0.05 || isRefueling) {
      this.hudEmitAccumulator = 0;
      this.emitHud(isRefueling, inFuelZone, showShowroomBanner, isInRestRoomZone);
    }
  }

  private isInUTurnZone(x: number, z: number): boolean {
    // 0. Downtown South/Start-End U-Turn Loop (z >= 0, behind the spawn)
    if (Math.abs(x) <= 25 && z >= 0 && z <= 78) return true;
    // 1. Metro End U-Turn Loop (z <= -1198)
    if (Math.abs(x) <= 20 && z <= -1198) return true;
    // 2. Tejgaon South U-Turn Loop (z >= -1064, x ~ 140)
    if (x >= 122 && x <= 158 && z >= -1066 && z <= -1000) return true;
    // 3. Uttara End U-Turn Loop (z <= UTTARA_UTURN_Z + 40, x ~ 140)
    if (x >= 122 && x <= 158 && z <= CORRIDOR_CONFIG.UTTARA_UTURN_Z + 40) return true;
    // 4. Purbachal 300ft End U-Turn Loop (x >= PURBACHAL_UTURN_X - 65, z ~ -2920)
    if (x >= CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 65 && z <= -2894 && z >= -2946) return true;
    // 5. 300ft Canal Crossing Bridges when crossing between Eastbound & Westbound
    if ((x >= 778 && x <= 818) || (x >= 1356 && x <= 1404)) {
      if (z >= -2926 && z <= -2914) return true;
    }
    return false;
  }

  private resolveSolidCollisions(): void {
    const bikeR = 0.52;
    let scraped = false;

    // 1. Multi-corridor road bounds, 300ft canal banks & elevated flyover guardrails
    const clamped = clampToDrivableCorridors(this.playerX, this.playerZ, this.playerY);
    if (clamped.scraped) {
      this.playerX = clamped.x;
      this.playerZ = clamped.z;
      scraped = true;
    }

    // 2. Metro Rail center piers along Metro Corridor (x ~ 0, z = -1194..0), open at intersections, Golis, Tejgaon turnoff & Metro End U-Turn
    if (Math.abs(this.playerX) < 12 && this.playerZ > -1194 && this.playerZ < 0) {
      const atIntersectionOrTurnoff =
        GAME_CONFIG.INTERSECTION_Z_POSITIONS.some((iz) => Math.abs(this.playerZ - iz) < 11) ||
        GOLI_ALLEY_Z_POSITIONS.some((gz) => Math.abs(this.playerZ - gz) < 5.2) ||
        Math.abs(this.playerZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 18;
      if (!atIntersectionOrTurnoff && Math.abs(this.playerX) < GAME_CONFIG.MEDIAN_HALF_WIDTH + 0.36) {
        this.playerX = (this.playerX <= 0 ? -1 : 1) * (GAME_CONFIG.MEDIAN_HALF_WIDTH + 0.36);
        scraped = true;
      }
    }

    // 3. Solid City Building AABBs (only at ground level; flyovers pass cleanly overhead!)
    if (this.playerY < 2.0) {
      for (const b of this.world.solidBuildings) {
        if (Math.abs(this.playerX - (b.minX + b.maxX) * 0.5) > 25) continue;
        if (Math.abs(this.playerZ - (b.minZ + b.maxZ) * 0.5) > 25) continue;

        const closestX = THREE.MathUtils.clamp(this.playerX, b.minX, b.maxX);
        const closestZ = THREE.MathUtils.clamp(this.playerZ, b.minZ, b.maxZ);
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
            const toLeft = Math.abs(this.playerX - b.minX);
            const toRight = Math.abs(b.maxX - this.playerX);
            this.playerX = toLeft < toRight ? b.minX - bikeR : b.maxX + bikeR;
          }
          scraped = true;
        }
      }
    }

    if (scraped && Math.abs(this.forwardSpeed) > 3) {
      this.lateralSlip = 0;
      this.forwardSpeed *= 0.96;
      this.cameraShake = Math.max(this.cameraShake, 0.16);
      this.audio.playThud();
      this.spawnParticle(
        this.playerX,
        this.playerY + 0.45,
        this.playerZ,
        (Math.random() - 0.5) * 4,
        2,
        (Math.random() - 0.5) * 4,
        0xfacc15,
        0.25,
        0.35,
        0.05
      );
    }
  }

  private updateFuelHose(station: FuelStationNode): void {
    _hoseStart.set(station.nozzleX, station.nozzleY, station.nozzleZ);
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

  private updateViolations(dt: number, speedKmh: number, fwdX: number, fwdZ: number): void {
    const onMetroWrongWay =
      this.playerZ >= -1198 &&
      Math.abs(this.playerZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) > 18 &&
      ((this.playerX > 1.2 && this.playerX < GAME_CONFIG.ARTERY_HALF_WIDTH && fwdZ < -0.35) ||
        (this.playerX < -1.2 && this.playerX > -GAME_CONFIG.ARTERY_HALF_WIDTH && fwdZ > 0.35)) &&
      speedKmh > 12;

    const onSpineWrongWay =
      this.playerZ <= -1070 &&
      this.playerZ >= -3645 &&
      Math.abs(this.playerZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) > 18 &&
      Math.abs(this.playerZ - CORRIDOR_CONFIG.KURIL_SPLIT_Z) > 22 &&
      this.playerX >= CORRIDOR_CONFIG.SPINE_X - CORRIDOR_CONFIG.SPINE_HALF_WIDTH &&
      this.playerX <= CORRIDOR_CONFIG.SPINE_X + CORRIDOR_CONFIG.SPINE_HALF_WIDTH &&
      ((this.playerX > CORRIDOR_CONFIG.SPINE_X + 1.0 && fwdZ < -0.35) ||
        (this.playerX < CORRIDOR_CONFIG.SPINE_X - 1.0 && fwdZ > 0.35)) &&
      speedKmh > 14;

    const on300ftWrongWay =
      this.playerY < 1.5 &&
      this.playerX > 220 &&
      this.playerX < CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 70 &&
      Math.abs(this.playerZ - CORRIDOR_CONFIG.EXPRESSWAY_Z) < 18 &&
      ((this.playerZ < CORRIDOR_CONFIG.EXPRESSWAY_Z - 4 && fwdX < -0.35) ||
        (this.playerZ > CORRIDOR_CONFIG.EXPRESSWAY_Z + 4 && fwdX > 0.35)) &&
      speedKmh > 14;

    const onSidewalk = this.playerY < 0.8 && this.world.isOnArterySidewalk(this.playerX, this.playerZ) && speedKmh > 8;

    if (onMetroWrongWay || onSpineWrongWay || on300ftWrongWay) {
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
          pk.y = loc.y;
          pk.z = loc.z;
          pk.mesh.visible = true;
        }
        continue;
      }

      // If rider moved into a different corridor far away, pull pickup ahead onto active route
      if (Math.hypot(pk.x - this.playerX, pk.z - this.playerZ) > 360) {
        const loc = this.samplePickupLocation(pk.id + Math.floor(Math.random() * 7));
        pk.x = loc.x;
        pk.y = loc.y;
        pk.z = loc.z;
      }

      pk.phase += dt * 3.2;
      pk.mesh.position.set(pk.x, pk.y + 0.92 + Math.sin(pk.phase) * 0.16, pk.z);
      pk.mesh.rotation.y += dt * 2.8;

      if (Math.abs(pk.z - this.playerZ) < 1.75 && Math.abs(this.playerX - pk.x) < 1.55 && Math.abs(this.playerY - pk.y) < 1.8) {
        pk.respawnTimer = 7.5;
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

  private advanceKurilRampMotion(t: TrafficEntity, step: number): void {
    switch (t.kurilPhase) {
      case 'eb_merge': {
        const dx = 155.0 - t.x;
        const dz = -2735.0 - t.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= Math.max(0.85, step)) {
          t.x = 155.0;
          t.z = -2735.0;
          t.dirX = 0;
          t.dirZ = -1;
          t.yaw = 0;
          t.kurilPhase = 'eb_ramp_up';
        } else {
          t.dirX = dx / dist;
          t.dirZ = dz / dist;
          t.yaw = Math.atan2(-t.dirX, -t.dirZ);
          t.x += t.dirX * step;
          t.z += t.dirZ * step;
        }
        return;
      }
      case 'eb_ramp_up': {
        t.dirX = 0;
        t.dirZ = -1;
        t.yaw = 0;
        t.x = 155.0;
        t.z -= step;
        if (t.z <= -2845.0) {
          t.z = -2845.0;
          t.arcAngle = Math.PI;
          t.kurilPhase = 'eb_arc';
        }
        return;
      }
      case 'eb_arc': {
        t.arcAngle -= step / 85.5;
        if (t.arcAngle <= Math.PI / 2) {
          t.x = 240.5;
          t.z = -2930.5;
          t.dirX = 1;
          t.dirZ = 0;
          t.yaw = -Math.PI / 2;
          t.kurilPhase = 'eb_ramp_down';
        } else {
          t.x = 240.5 + 85.5 * Math.cos(t.arcAngle);
          t.z = -2845.0 - 85.5 * Math.sin(t.arcAngle);
          t.dirX = Math.sin(t.arcAngle);
          t.dirZ = Math.cos(t.arcAngle);
          t.yaw = Math.atan2(-t.dirX, -t.dirZ);
        }
        return;
      }
      case 'eb_ramp_down': {
        t.dirX = 1;
        t.dirZ = 0;
        t.yaw = -Math.PI / 2;
        t.z = -2930.5;
        t.x += step;
        if (t.x >= 425.5) {
          t.kurilPhase = 'none';
          t.turnCooldown = 3.5;
        }
        return;
      }
      case 'wb_ramp_up': {
        t.dirX = -1;
        t.dirZ = 0;
        t.yaw = Math.PI / 2;
        t.z = -2909.5;
        t.x -= step;
        if (t.x <= 230.0) {
          t.x = 230.0;
          t.arcAngle = -Math.PI / 2;
          t.kurilPhase = 'wb_arc';
        }
        return;
      }
      case 'wb_arc': {
        t.arcAngle -= step / 61.5;
        if (t.arcAngle <= -Math.PI) {
          t.x = 168.5;
          t.z = -2848.0;
          t.dirX = 0;
          t.dirZ = 1;
          t.yaw = Math.PI;
          t.kurilPhase = 'wb_ramp_down';
        } else {
          t.x = 230.0 + 61.5 * Math.cos(t.arcAngle);
          t.z = -2848.0 + 61.5 * Math.sin(t.arcAngle);
          t.dirX = Math.sin(t.arcAngle);
          t.dirZ = -Math.cos(t.arcAngle);
          t.yaw = Math.atan2(-t.dirX, -t.dirZ);
        }
        return;
      }
      case 'wb_ramp_down': {
        t.dirX = 0;
        t.dirZ = 1;
        t.yaw = Math.PI;
        t.x = 168.5;
        t.z += step;
        if (t.z >= -2725.0) {
          t.z = -2725.0;
          t.kurilPhase = 'wb_merge';
        }
        return;
      }
      case 'wb_merge': {
        const targetX = t.id % 2 === 0 ? 143.25 : 146.75;
        const dx = targetX - t.x;
        const dz = -2685.0 - t.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= Math.max(0.85, step)) {
          t.x = targetX;
          t.z = -2685.0;
          t.dirX = 0;
          t.dirZ = 1;
          t.yaw = Math.PI;
          t.kurilPhase = 'none';
          t.turnCooldown = 3.5;
        } else {
          t.dirX = dx / dist;
          t.dirZ = dz / dist;
          t.yaw = Math.atan2(-t.dirX, -t.dirZ);
          t.x += t.dirX * step;
          t.z += t.dirZ * step;
        }
        return;
      }
    }
  }

  private steerTrafficThroughJunctions(t: TrafficEntity): void {
    if (t.kurilPhase !== 'none' || t.turnCooldown > 0) return;

    // 1. Metro Northbound -> Turn East onto Tejgaon Link Road Keep-Left Eastbound lane (z = -1124.5)
    if (Math.abs(t.x) < 10 && t.dirZ < -0.5 && t.z <= -1118 && t.z >= -1127) {
      if (t.id % 4 !== 0) {
        t.x = Math.max(t.x, 1.5);
        t.z = -1124.5;
        t.yaw = -Math.PI / 2;
        t.dirX = 1;
        t.dirZ = 0;
        t.turnCooldown = 3.5;
        return;
      }
      t.turnCooldown = 1.6;
      return;
    }

    // 2. Metro End U-Turn (z <= -1224 -> swing around onto Metro Southbound)
    if (Math.abs(t.x) < 18 && t.dirZ < -0.5 && t.z <= -1224) {
      t.x = t.id % 2 === 0 ? 3.25 : 6.75;
      t.z = -1222;
      t.yaw = Math.PI;
      t.dirX = 0;
      t.dirZ = 1;
      t.turnCooldown = 3.5;
      return;
    }

    // 3. Metro Southbound reaching Farmgate start -> loop back North onto Metro
    if (Math.abs(t.x) < 12 && t.dirZ > 0.5 && t.z >= -14) {
      t.x = t.id % 2 === 0 ? -3.25 : -6.75;
      t.z = -18;
      t.yaw = 0;
      t.dirX = 0;
      t.dirZ = -1;
      t.turnCooldown = 3.5;
      return;
    }

    // 4. Tejgaon Link Road Eastbound -> Merge onto Tejgaon Spine (80% North to Showroom/Mohakhali, 20% South to U-Turn)
    if (t.dirX > 0.5 && Math.abs(t.z - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 10 && t.x >= 133) {
      if (t.id % 5 !== 0) {
        t.x = t.id % 2 === 0 ? 133.25 : 136.75;
        t.z = -1126;
        t.yaw = 0;
        t.dirX = 0;
        t.dirZ = -1;
      } else {
        t.x = 143.25;
        t.z = -1114;
        t.yaw = Math.PI;
        t.dirX = 0;
        t.dirZ = 1;
      }
      t.turnCooldown = 3.5;
      return;
    }

    // 5. Tejgaon Link Road Westbound -> Merge South onto Metro Rail road
    if (t.dirX < -0.5 && Math.abs(t.z - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 10 && t.x <= 6) {
      t.x = t.id % 2 === 0 ? 3.25 : 6.75;
      t.z = -1114;
      t.yaw = Math.PI;
      t.dirX = 0;
      t.dirZ = 1;
      t.turnCooldown = 3.5;
      return;
    }

    // 6. Tejgaon South U-Turn Plaza -> Swing back North toward Tejgaon Showroom / Mohakhali
    if (Math.abs(t.x - CORRIDOR_CONFIG.SPINE_X) < 18 && t.dirZ > 0.5 && t.z >= -1034) {
      t.x = t.id % 2 === 0 ? 133.25 : 136.75;
      t.z = -1036;
      t.yaw = 0;
      t.dirX = 0;
      t.dirZ = -1;
      t.turnCooldown = 3.5;
      return;
    }

    // 7. Spine Southbound at Tejgaon Link -> 45% turn West into Tejgaon Link Road Keep-Left Westbound lane (z = -1115.5)
    if (Math.abs(t.x - CORRIDOR_CONFIG.SPINE_X) < 18 && t.dirZ > 0.5 && t.z >= -1121 && t.z <= -1113) {
      if (t.id % 2 === 0) {
        t.x = 138;
        t.z = -1115.5;
        t.yaw = Math.PI / 2;
        t.dirX = -1;
        t.dirZ = 0;
        t.turnCooldown = 3.5;
        return;
      }
      t.turnCooldown = 1.6;
      return;
    }

    // 8. Spine Northbound at Kuril Slip Entry (z = -2692..-2718):
    //    - KURIL_RAMP_TO_300FT vehicles smoothly merge onto Upper East-side Flyover Ramp (x=155, z=-2735) -> 300ft!
    //    - SPINE_TO_UTTARA vehicles stay strictly on straight North ground lanes (133.25/136.75) to Uttara!
    if (Math.abs(t.x - CORRIDOR_CONFIG.SPINE_X) < 18 && t.dirZ < -0.5 && t.z <= -2692 && t.z >= -2718) {
      if (t.routeTag === 'KURIL_RAMP_TO_300FT') {
        t.kurilPhase = 'eb_merge';
        return;
      }
      t.turnCooldown = 2.5;
      return;
    }

    // 9. Uttara End U-Turn -> Swing South back toward Mohakhali
    if (Math.abs(t.x - CORRIDOR_CONFIG.SPINE_X) < 18 && t.dirZ < -0.5 && t.z <= CORRIDOR_CONFIG.UTTARA_UTURN_Z - 12) {
      t.x = t.id % 2 === 0 ? 143.25 : 146.75;
      t.z = CORRIDOR_CONFIG.UTTARA_UTURN_Z - 8;
      t.yaw = Math.PI;
      t.dirX = 0;
      t.dirZ = 1;
      t.turnCooldown = 3.5;
      return;
    }

    // 10. 300ft Eastbound at Purbachal U-Turn -> Loop onto 300ft Keep-Left Westbound South carriageway
    if (t.dirX > 0.5 && t.x >= CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 2) {
      t.x = CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 6;
      t.z =
        t.routeTag === 'KURIL_RAMP_TO_300FT'
          ? -2909.5
          : CORRIDOR_CONFIG.EXPRESSWAY_INBOUND_LANES_Z[t.id % 3];
      t.yaw = Math.PI / 2;
      t.dirX = -1;
      t.dirZ = 0;
      t.turnCooldown = 3.5;
      return;
    }

    // 11. 300ft Westbound approaching Kuril Lower Return Flyover (x <= 395): climb Lower Flyover back to Mohakhali!
    if (t.dirX < -0.5 && t.x <= 395 && t.x >= 375 && Math.abs(t.z - -2909.5) < 6.5) {
      t.z = -2909.5;
      t.kurilPhase = 'wb_ramp_up';
      return;
    }

    // Ground-level Kuril 300ft Westbound (outer lanes) -> Merge South onto Banani/Mohakhali Spine
    if (t.dirX < -0.5 && t.x <= 150) {
      t.x = t.id % 2 === 0 ? 143.25 : 146.75;
      t.z = -2904;
      t.yaw = Math.PI;
      t.dirX = 0;
      t.dirZ = 1;
      t.turnCooldown = 3.5;
    }
  }

  private updateTraffic(dt: number): void {
    const nearMetro = Math.abs(this.playerX) < 160 && this.playerZ > CORRIDOR_CONFIG.METRO_EXT_MIN_Z - 260;

    for (const t of this.traffic) {
      if (t.hitCooldown > 0) t.hitCooldown -= dt;
      if (t.turnCooldown > 0) t.turnCooldown = Math.max(0, t.turnCooldown - dt);

      if (t.wrecked) {
        t.wreckTimer -= dt;
        t.rig.group.position.y = THREE.MathUtils.damp(t.rig.group.position.y, t.y - 2.5, 4, dt);
        if (t.wreckTimer <= 0) {
          this.recycleVehicle(t);
        }
        continue;
      }

      if (t.isCityVehicle) {
        t.rig.group.visible = nearMetro;
        if (!nearMetro) continue;
      } else {
        t.rig.group.visible = true;
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
      const step = t.currentSpeed * dt;

      if (!t.isCityVehicle && t.kurilPhase !== 'none') {
        this.advanceKurilRampMotion(t, step);
      } else {
        t.x += t.dirX * step;
        t.z += t.dirZ * step;
      }

      const wheelSpin = (t.currentSpeed / 0.35) * dt;
      for (const w of t.rig.wheels) w.rotation.x -= wheelSpin;

      if (!t.isCityVehicle) {
        this.steerTrafficThroughJunctions(t);
        const distToPlayer = Math.hypot(t.x - this.playerX, t.z - this.playerZ);
        if (distToPlayer > 320) {
          this.recycleVehicle(t);
          continue;
        }
        if (distToPlayer > 40) t.nearMissedThisPass = false;
      } else {
        const lane = this.world.cityLanes[t.laneIdx];
        if (lane.axis === 'NS') {
          if (t.z < -GAME_CONFIG.LOOP_LENGTH) t.z += GAME_CONFIG.LOOP_LENGTH;
          if (t.z > 0) t.z -= GAME_CONFIG.LOOP_LENGTH;
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

      // Flyover behaviour (correct lanes, no wrong-way): the divided flyover deck
      // carries the INNER lane of each direction (northbound x=136.75 on the west
      // half, southbound x=143.25 on the east half) — they ride up and over. The
      // OUTER lanes (northbound x=133.25, southbound x=146.75) stay on the ground
      // on their own correct side. No forced cross-over merge, so nobody drives the
      // wrong way. The height-lock mounts inner cars at the ramp foot automatically.
      const surf = sampleDhakaSurface(t.x, t.z, t.y, t.dirX, t.dirZ, t.deckId);
      t.y = surf.groundY;
      t.deckId = surf.deckId;
      t.rig.group.position.set(t.x, t.y, t.z);
      t.rig.group.rotation.x = surf.pitchRad;
      t.rig.group.rotation.z = 0;
      let yawDiff = t.yaw - t.rig.group.rotation.y;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      t.rig.group.rotation.y += yawDiff * Math.min(1, dt * 12);
    }
  }

  private computeTrafficTargetSpeed(t: TrafficEntity): number {
    let target = t.baseSpeed;
    const spec = VEHICLE_SPECS[t.kind];
    const stopGap = spec.halfLength * 0.58 + 5.5;

    // 1. Slow/yield if player is directly ahead on same level
    if (Math.abs(this.playerY - t.y) < 1.8) {
      const pdx = this.playerX - t.x;
      const pdz = this.playerZ - t.z;
      const pAlong = pdx * t.dirX + pdz * t.dirZ;
      const pLateral = Math.abs(pdx * t.dirZ - pdz * t.dirX);
      if (pAlong > 0.5 && pAlong < stopGap + 3.5 && pLateral < spec.halfWidth * 0.58 + 1.0) {
        target = Math.min(target, 2.5);
      }
    }

    // 2. Car-following in lane + perpendicular junction yield
    for (const other of this.traffic) {
      if (other.id === t.id || other.wrecked || Math.abs(other.y - t.y) > 1.8) continue;
      const otherSpec = VEHICLE_SPECS[other.kind];
      const combinedHalf = (spec.halfLength + otherSpec.halfLength) * 0.58;
      const odx = other.x - t.x;
      const odz = other.z - t.z;
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

    // 3. Stop for pedestrian directly ahead
    if (t.y < 1.2) {
      for (const p of this.pedestrians) {
        if (p.mode === 'knocked') continue;
        const dx = p.x - t.x;
        const dz = p.z - t.z;
        const along = dx * t.dirX + dz * t.dirZ;
        const lat = Math.abs(dx * t.dirZ - dz * t.dirX);
        if (along > 0.4 && along < stopGap + 2.5 && lat < 1.35) {
          return 0;
        }
      }
    }

    // 4a. All N-S Traffic obeys nsPhase stop lines behind crosswalks
    if (Math.abs(t.dirZ) > 0.5 && t.y < 1.2) {
      for (const inter of this.world.intersections) {
        if (Math.abs(t.x - inter.baseX) > 70) continue;
        if (inter.nsPhase !== 'RED' && inter.nsPhase !== 'YELLOW') continue;
        const stopLineZ = inter.baseZ + (t.dirZ < 0 ? 11.8 : -11.8);
        const dz = (stopLineZ - t.z) * t.dirZ;
        if (dz > -0.6 && dz < 16.5) {
          return 0;
        }
      }
    } else if (t.isCityVehicle && Math.abs(t.dirX) > 0.5) {
      const lane = this.world.cityLanes[t.laneIdx];
      if (lane?.isSignalizedEw) {
        for (const inter of this.world.intersections) {
          if (inter.baseX !== 0 || Math.abs(inter.baseZ - t.z) > 8) continue;
          if (inter.ewPhase !== 'RED' && inter.ewPhase !== 'YELLOW') continue;
          const stopLineX = t.dirX > 0 ? -13.2 : 13.2;
          const dx = (stopLineX - t.x) * t.dirX;
          if (dx > -0.6 && dx < 16.0) {
            return 0;
          }
        }
      } else {
        const stopLineX = t.dirX > 0 ? -13.0 : 13.0;
        const dx = (stopLineX - t.x) * t.dirX;
        if (dx > -0.4 && dx < 10.0) {
          if (Math.abs(this.playerX) < 11.5 && Math.abs(this.playerZ - t.z) < 26) {
            return 0;
          }
          for (const other of this.traffic) {
            if (other.id === t.id || other.wrecked || other.isCityVehicle) continue;
            if (Math.abs(other.x) < 12 && Math.abs(other.z - t.z) < 22 && other.currentSpeed > 1.8) {
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
      let chosenKind = pickWeightedKind(false, tier);
      if (tier === 3 && VEHICLE_SPECS[chosenKind].smashRank >= 3) {
        const activeTitans = this.traffic.filter(
          (o) => !o.isCityVehicle && !o.wrecked && VEHICLE_SPECS[o.kind].smashRank >= 3
        ).length;
        if (activeTitans >= GAME_CONFIG.TITAN_TRAFFIC_CAP) {
          chosenKind = pickWeightedKind(false, 2);
        }
      }

      const fwdX = -Math.sin(this.playerYaw);
      const fwdZ = -Math.cos(this.playerYaw);

      // Recycle onto player's active highway corridor (300ft / Tejgaon Link / Spine / Metro)
      t.kurilPhase = 'none';
      t.arcAngle = 0;

      if (this.playerX > 165) {
        // 300 Feet 6-Lane Purbachal Expressway (Keep-Left + Westbound Kuril Lower Flyover climbers)
        t.routeTag = t.id % 3 === 0 ? 'KURIL_RAMP_TO_300FT' : 'EXPRESSWAY_300FT';
        const goEast = Math.random() < (fwdX >= 0 ? 0.58 : 0.42);
        const lanesZ = goEast
          ? CORRIDOR_CONFIG.EXPRESSWAY_OUTBOUND_LANES_Z
          : CORRIDOR_CONFIG.EXPRESSWAY_INBOUND_LANES_Z;
        const laneZ =
          t.routeTag === 'KURIL_RAMP_TO_300FT'
            ? goEast
              ? -2930.5
              : -2909.5
            : lanesZ[Math.floor(Math.random() * lanesZ.length)];
        const yaw = goEast ? -Math.PI / 2 : Math.PI / 2;
        const aheadSign = fwdX >= 0 ? 1 : -1;
        // Keep ground spawns east of flyover ramp touchdowns (x >= 435) on middle lanes (-2930.5/-2909.5)
        const minGroundX = laneZ === -2930.5 || laneZ === -2909.5 ? 435 : 225;
        let newX = THREE.MathUtils.clamp(
          this.playerX + aheadSign * (100 + Math.random() * 115),
          minGroundX,
          CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 20
        );
        for (const other of this.traffic) {
          if (other.id !== t.id && !other.isCityVehicle && Math.abs(other.z - laneZ) < 1.5 && Math.abs(other.x - newX) < 14) {
            newX += aheadSign * 18;
          }
        }
        newX = THREE.MathUtils.clamp(newX, minGroundX, CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 20);
        this.spawnTrafficSlot(t, chosenKind, laneZ, newX, yaw);
        return;
      }

      if (
        this.playerX >= 12 &&
        this.playerX < 126 &&
        Math.abs(this.playerZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) < 65
      ) {
        // Tejgaon Link Road (x = 0..140, z = -1120) — Keep-Left: Eastbound North (-1124.5), Westbound South (-1115.5)
        t.routeTag = 'METRO_LOCAL';
        if (Math.random() < 0.58) {
          const goEast = Math.random() < (fwdX >= 0 ? 0.65 : 0.35);
          const laneZ = goEast ? -1124.5 : -1115.5;
          const yaw = goEast ? -Math.PI / 2 : Math.PI / 2;
          const newX = goEast ? 10 + Math.random() * 60 : 80 + Math.random() * 52;
          this.spawnTrafficSlot(t, chosenKind, laneZ, newX, yaw);
        } else {
          const laneIdx = pickArteryLaneForKind(chosenKind);
          const laneX = CORRIDOR_CONFIG.SPINE_LANES[laneIdx];
          const yaw = laneX > CORRIDOR_CONFIG.SPINE_X ? Math.PI : 0;
          const newZ = -1045 - Math.random() * 240;
          t.laneIdx = laneIdx;
          this.spawnTrafficSlot(t, chosenKind, newZ, laneX, yaw);
        }
        return;
      }

      if (this.playerX >= 100 && this.playerX <= 165) {
        // Tejgaon -> Mohakhali -> Banani -> Kuril -> Uttara Spine
        if (this.playerZ > -1260 && Math.random() < 0.25) {
          t.routeTag = 'METRO_LOCAL';
          const newX = 28 + Math.random() * 90;
          this.spawnTrafficSlot(t, chosenKind, -1124.5, newX, -Math.PI / 2);
          return;
        }

        // Strict conflict-free split around Banani/Kuril: half SPINE_TO_UTTARA (straight), half KURIL_RAMP_TO_300FT (Upper flyover ramp)
        t.routeTag =
          this.playerZ < -2960
            ? 'SPINE_TO_UTTARA'
            : t.id % 2 === 0
              ? 'SPINE_TO_UTTARA'
              : 'KURIL_RAMP_TO_300FT';

        if (t.routeTag === 'KURIL_RAMP_TO_300FT' && this.playerZ < -2480 && this.playerZ > -2960) {
          // Spawn along Banani approach -> Kuril Ramp -> Upper 300ft Skyway
          if (Math.random() < 0.55) {
            const newZ = -2560 - Math.random() * 130;
            t.laneIdx = 1;
            this.spawnTrafficSlot(t, chosenKind, newZ, 136.75, 0);
          } else {
            const angle = Math.PI * (0.62 + Math.random() * 0.34);
            const newX = 240.5 + 85.5 * Math.cos(angle);
            const newZ = -2845.0 - 85.5 * Math.sin(angle);
            const yaw = Math.atan2(-Math.sin(angle), -Math.cos(angle));
            t.kurilPhase = 'eb_arc';
            t.arcAngle = angle;
            this.spawnTrafficSlot(t, chosenKind, newZ, newX, yaw);
            t.y = 10.6;
          }
          return;
        }

        let laneIdx = pickArteryLaneForKind(chosenKind);
        let laneX = CORRIDOR_CONFIG.SPINE_LANES[laneIdx];
        let yaw = laneX > CORRIDOR_CONFIG.SPINE_X ? Math.PI : 0;
        const aheadSign = fwdZ <= 0 ? -1 : 1;
        let newZ = THREE.MathUtils.clamp(
          this.playerZ + aheadSign * (100 + Math.random() * 110),
          CORRIDOR_CONFIG.SPINE_MIN_Z + 55,
          CORRIDOR_CONFIG.SPINE_MAX_Z - 25
        );
        // Never spawn non-ramp vehicles inside the Kuril slip merge zone on East lanes
        if (t.routeTag === 'KURIL_RAMP_TO_300FT' && newZ < -2740 && yaw === 0) {
          newZ = -2660;
        }
        // Keep ground traffic OUT from under the Mohakhali & Banani flyover decks.
        // The flyover deck spans the inner lanes (x≈135..145); a ground car spawned
        // there would drive under/through the low ramp. Route those spawns to the
        // OUTER lanes (x=133.25 / 146.75) which run BESIDE the flyover, not under it.
        const inMohaFlyover = newZ <= CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_START_Z + 20 &&
          newZ >= CORRIDOR_CONFIG.MOHAKHALI_FLYOVER_END_Z - 20;
        const inBananiFlyover = newZ <= CORRIDOR_CONFIG.BANANI_FLYOVER_START_Z + 20 &&
          newZ >= CORRIDOR_CONFIG.BANANI_FLYOVER_END_Z - 20;
        if (inMohaFlyover || inBananiFlyover) {
          // Preserve travel direction but move to the outer lane on that side.
          laneIdx = laneX > CORRIDOR_CONFIG.SPINE_X ? 3 : 0;
          laneX = CORRIDOR_CONFIG.SPINE_LANES[laneIdx];
          yaw = laneX > CORRIDOR_CONFIG.SPINE_X ? Math.PI : 0;
        }
        for (const other of this.traffic) {
          if (other.id !== t.id && !other.isCityVehicle && Math.abs(other.x - laneX) < 1.5 && Math.abs(other.z - newZ) < 14) {
            newZ += aheadSign * 18;
          }
        }
        newZ = THREE.MathUtils.clamp(newZ, CORRIDOR_CONFIG.SPINE_MIN_Z + 55, CORRIDOR_CONFIG.SPINE_MAX_Z - 25);
        t.laneIdx = laneIdx;
        this.spawnTrafficSlot(t, chosenKind, newZ, laneX, yaw);
        return;
      }

      // Metro Corridor (0 .. -1220) + Tejgaon turnoff stream when player is past -880
      t.routeTag = 'METRO_LOCAL';
      if (this.playerZ < -880 && Math.random() < 0.45) {
        if (Math.random() < 0.5) {
          const newX = 12 + Math.random() * 100;
          this.spawnTrafficSlot(t, chosenKind, -1124.5, newX, -Math.PI / 2);
        } else {
          const laneIdx = Math.random() < 0.5 ? 0 : 1;
          const laneX = GAME_CONFIG.ARTERY_LANES[laneIdx];
          const newZ = -940 - Math.random() * 168;
          t.laneIdx = laneIdx;
          this.spawnTrafficSlot(t, chosenKind, newZ, laneX, 0);
        }
        return;
      }

      const laneIdx = pickArteryLaneForKind(chosenKind);
      const laneX = GAME_CONFIG.ARTERY_LANES[laneIdx];
      const yaw = laneX > 0 ? Math.PI : 0;
      const aheadSign = fwdZ <= 0 ? -1 : 1;
      let newZ = THREE.MathUtils.clamp(
        this.playerZ + aheadSign * (100 + Math.random() * 110),
        -1215,
        -20
      );
      for (const other of this.traffic) {
        if (other.id !== t.id && !other.isCityVehicle && Math.abs(other.x - laneX) < 1.5 && Math.abs(other.z - newZ) < 14) {
          newZ += aheadSign * 18;
        }
      }
      newZ = THREE.MathUtils.clamp(newZ, -1215, -20);
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
        p.rig.group.position.set(p.x, p.rig.group.position.y, p.z);
        if (p.knockTimer <= 0) {
          p.mode = p.isCrosswalk ? 'crossing' : 'sidewalk';
          p.x = p.homeX;
          p.z = p.baseZ;
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
          p.rig.angryBadge.visible = false;
        }
      } else {
        // Cull animation updates for far-away pedestrians
        if (Math.hypot(p.x - this.playerX, p.z - this.playerZ) > 180) {
          p.rig.group.visible = false;
          continue;
        }
        p.rig.group.visible = true;

        const pdx = p.x - this.playerX;
        const pdz = p.z - this.playerZ;
        const pDist = Math.hypot(pdx, pdz);
        if (pDist < 7.5 && Math.abs(this.forwardSpeed) > 12 && !p.isCrosswalk && this.playerY < 1.2) {
          p.mode = 'fleeing';
          const awayX = pdx >= 0 ? 1 : -1;
          p.x += awayX * 4.0 * dt;
          p.walkPhase += dt * 12;
        } else if (p.isCrosswalk) {
          p.mode = 'crossing';
          const inter = this.world.intersections.find(
            (node) => node.baseX === 0 && Math.abs(node.baseZ - p.baseZ) < 12
          );
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
          if (p.homeX > 200) {
            // 300ft Neela Market sidewalk walkers patrol along X
            p.x += p.dir * p.walkSpeed * dt;
            if (Math.abs(p.x - p.homeX) > 16) p.dir *= -1;
            p.rig.group.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            p.z += p.dir * p.walkSpeed * dt;
            if (Math.abs(p.z - p.baseZ) > 16) p.dir *= -1;
            p.rig.group.rotation.y = p.dir > 0 ? 0 : Math.PI;
          }
          p.walkPhase += dt * p.walkSpeed * 3.8;
        }
      }

      const swing = Math.sin(p.walkPhase) * 0.55;
      p.rig.leftLeg.rotation.x = swing;
      p.rig.rightLeg.rotation.x = -swing;
      p.rig.leftArm.rotation.x = -swing * 0.7;
      p.rig.rightArm.rotation.x = swing * 0.7;

      const groundY = p.isCrosswalk || Math.abs(p.x) < 9.6 ? 0.02 : 0.14;
      p.rig.group.position.set(p.x, groundY, p.z);
    }
  }

  private angerNearbyWitnesses(originX: number, originZ: number): void {
    if (this.playerY > 1.2) return;
    let activeChasers = 0;
    for (const p of this.pedestrians) {
      if (p.mode === 'chasing') activeChasers += 1;
    }
    if (activeChasers >= 4) return;

    let angered = 0;
    for (const p of this.pedestrians) {
      if (p.mode === 'knocked' || p.mode === 'chasing') continue;
      const dist = Math.hypot(p.x - originX, p.z - originZ);
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
    // Player's current flyover deck (null when on the ground). A flyover id in
    // currentCorridor means the player is riding that elevated deck.
    const playerDeck = this.currentCorridor.startsWith('flyover_') ? this.currentCorridor : null;

    for (const t of this.traffic) {
      if (t.wrecked || t.hitCooldown > 0 || !t.rig.group.visible) continue;
      if (Math.abs(this.playerY - t.y) > 1.85) continue;
      // Same-deck guard (defense in depth): never collide with traffic that is on
      // a different flyover deck than the player, even if their heights briefly
      // align near a ramp. Ground vs ground (both null) and same-deck still collide.
      if (playerDeck !== t.deckId) continue;

      const spec = VEHICLE_SPECS[t.kind];
      const scale = 0.58;
      const absDirX = Math.abs(t.dirX);
      const absDirZ = Math.abs(t.dirZ);
      const tHalfW = (spec.halfWidth * absDirZ + spec.halfLength * absDirX) * scale;
      const tHalfL = (spec.halfLength * absDirZ + spec.halfWidth * absDirX) * scale;

      const dx = Math.abs(this.playerX - t.x);
      const dz = Math.abs(this.playerZ - t.z);

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
          if (Math.abs(this.forwardSpeed) > 4.5 || isBoosting) {
            t.wrecked = true;
            t.wreckTimer = 0.35;
            t.rig.group.position.y = t.y - 2.5;

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
            this.playerX += this.playerX < t.x ? -0.65 : 0.65;
            this.audio.playThud();
          }
        }
      } else if (
        !t.nearMissedThisPass &&
        speedKmh >= 45 &&
        dz < bikeHalfL + tHalfL + 0.45 &&
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
    if (this.playerY > 1.2) return;
    const absSpd = Math.abs(this.forwardSpeed);
    const isMovingFastEnoughToRam = absSpd > 3.0 || isBoosting;
    const bikeSpec = this.getActiveBikeSpec();

    for (const p of this.pedestrians) {
      if (p.mode === 'knocked') continue;
      const dx = this.playerX - p.x;
      const dz = this.playerZ - p.z;
      const dist = Math.hypot(dx, dz);

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
          p.knockVz = -this.forwardSpeed * 0.45;

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
    if (this.playerY > 1.2) return;
    const bikeSpec = this.getActiveBikeSpec();
    for (const inter of this.world.intersections) {
      const relX = Math.abs(this.playerX - inter.baseX);
      const relZ = Math.abs(inter.baseZ - this.playerZ);
      if (relX > 25 || relZ > 30) {
        inter.violatedThisPass = false;
        inter.bonusAwardedThisPass = false;
        continue;
      }

      if (relX < GAME_CONFIG.ARTERY_HALF_WIDTH + 1.2 && relZ < 2.8 && speedKmh > 18) {
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
    if (this.playerY > 1.2) return null;
    for (const fs of this.world.fuelStations) {
      if (
        this.playerX >= fs.padMinX &&
        this.playerX <= fs.padMaxX &&
        this.playerZ >= fs.padMinZ &&
        this.playerZ <= fs.padMaxZ
      ) {
        return fs;
      }
    }
    return null;
  }

  private getNearestFuelStationMeters(): number {
    let best = 9999;
    for (const fs of this.world.fuelStations) {
      const dx = this.playerX - (fs.padMinX + fs.padMaxX) * 0.5;
      const dz = this.playerZ - (fs.padMinZ + fs.padMaxZ) * 0.5;
      const d = Math.hypot(dx, dz);
      if (d < best) best = d;
    }
    return Math.round(best);
  }

  private getActiveShowroom(): ShowroomNode | null {
    if (this.playerY > 1.2) return null;
    for (const sr of this.world.showrooms) {
      if (
        this.playerX >= sr.padMinX &&
        this.playerX <= sr.padMaxX &&
        this.playerZ >= sr.padMinZ &&
        this.playerZ <= sr.padMaxZ
      ) {
        return sr;
      }
    }
    return null;
  }

  private getNearestShowroomMeters(): number {
    let best = 9999;
    for (const sr of this.world.showrooms) {
      const dx = this.playerX - (sr.padMinX + sr.padMaxX) * 0.5;
      const dz = this.playerZ - (sr.padMinZ + sr.padMaxZ) * 0.5;
      const d = Math.hypot(dx, dz);
      if (d < best) best = d;
    }
    return Math.round(best);
  }

  private getActiveRestRoom(): RestRoomNode | null {
    if (this.playerY > 1.2) return null;
    for (const rr of this.world.restRooms) {
      if (
        this.playerX >= rr.minX &&
        this.playerX <= rr.maxX &&
        this.playerZ >= rr.minZ &&
        this.playerZ <= rr.maxZ
      ) {
        return rr;
      }
    }
    return null;
  }

  private getUpcomingLight(): { phase: 'GREEN' | 'YELLOW' | 'RED' | null; meters: number } {
    if (this.playerY > 1.2) return { phase: null, meters: 0 };
    let bestMeters = 999;
    let bestPhase: 'GREEN' | 'YELLOW' | 'RED' | null = null;
    for (const inter of this.world.intersections) {
      if (Math.abs(this.playerX - inter.baseX) > 14) continue;
      const dist = this.playerZ - inter.baseZ;
      if (dist > 0 && dist < 120 && dist < bestMeters) {
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
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTarget.y, 12, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTarget.z, 16, dt);

    _lookTarget.set(
      this.playerX + fwdX * (10 + speedNorm * 6),
      this.playerY + 1.0,
      this.playerZ + fwdZ * (10 + speedNorm * 6)
    );
    // Smooth the camera aim so quick left/right button taps don't whip the view
    // side-to-side ("shake"). The position already damps; damping the look target
    // too keeps the horizon steady while still following the bike's heading.
    if (!this.camLookInitialized) {
      _smoothLookTarget.copy(_lookTarget);
      this.camLookInitialized = true;
    } else {
      _smoothLookTarget.x = THREE.MathUtils.damp(_smoothLookTarget.x, _lookTarget.x, 9, dt);
      _smoothLookTarget.y = THREE.MathUtils.damp(_smoothLookTarget.y, _lookTarget.y, 9, dt);
      _smoothLookTarget.z = THREE.MathUtils.damp(_smoothLookTarget.z, _lookTarget.z, 9, dt);
    }
    this.camera.lookAt(_smoothLookTarget);
  }

  private getDhakaZoneLabel(): string {
    switch (this.currentCorridor) {
      case 'flyover_mohakhali':
        return 'মহাখালী ফ্লাইওভার';
      case 'flyover_banani':
        return 'বনানী ফ্লাইওভার';
      case 'flyover_kuril':
        return 'কুড়িল ফ্লাইওভার ইন্টারচেঞ্জ';
      case 'connector':
        return 'তেজগাঁও লিংক রোড';
      case 'expressway300ft':
        if (this.playerX >= 330 && this.playerX <= 650) return '৩০০ ফিট • বসুন্ধরা আবাসিক এলাকা';
        if (this.playerX > CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 120) return '৩০০ ফিট • পূর্বাচল ইউ-টার্ন';
        if (Math.abs(this.playerX - CORRIDOR_CONFIG.NEELA_MARKET_X) < 130) return '৩০০ ফিট • নীলা মার্কেট';
        return '৩০০ ফিট • পূর্বাচল এক্সপ্রেসওয়ে';
      case 'tejgaon':
        return 'তেজগাঁও • হিরো শোরুম রোড';
      case 'mohakhali':
        return 'মহাখালী বাস টার্মিনাল রোড';
      case 'banani':
        return 'বনানী এয়ারপোর্ট রোড';
      case 'kuril':
        return 'কুড়িল বিশ্বরোড মোড়';
      case 'uttara':
        return 'উত্তরা • হিরো শোরুম ও ইউ-টার্ন';
      default: {
        if (Math.abs(this.playerX) > GAME_CONFIG.ARTERY_HALF_WIDTH + 3) {
          return this.playerX < 0 ? 'ফার্মগেট-ধানমন্ডি গলি (Grid)' : 'কারওয়ান-তেজগাঁও এভিনিউ (Grid)';
        }
        const zAbs = Math.abs(this.playerZ);
        if (zAbs < 240) return 'ফার্মগেট • ফার্মগেট মেট্রো';
        if (zAbs < 520) return 'বিজয় সরণি • মেট্রো রোড';
        if (zAbs < 820) return 'তালতলা • মেট্রো রোড';
        if (zAbs < 1040) return 'আগারগাঁও • মেট্রো স্টেশন';
        return 'আগারগাঁও • তেজগাঁও বিলবোর্ড মোড়';
      }
    }
  }

  private getRouteHintBn(): string {
    if (this.currentCorridor === 'expressway300ft') {
      if (this.playerZ > CORRIDOR_CONFIG.EXPRESSWAY_Z) {
        return 'পশ্চিমে কুড়িল লোয়ার ফ্লাইওভার দিয়ে মহাখালী ফিরুন ⬅';
      }
      if (this.playerX >= 330 && this.playerX <= 650) {
        return 'বসুন্ধরা আবাসিক এলাকা • সামনে নীলা মার্কেট ও রেস্ট রুম';
      }
      if (this.playerX < CORRIDOR_CONFIG.NEELA_SHOWROOM_X - 90) {
        return 'সামনে নীলা মার্কেট: হিরো শোরুম ও রেস্ট রুম';
      }
      if (this.playerX < CORRIDOR_CONFIG.PURBACHAL_UTURN_X - 70) {
        return 'পূর্বাচল শেষ প্রান্তে ইউ-টার্ন ↩';
      }
      return 'ইউ-টার্ন নিয়ে দক্ষিণ লেনে মহাখালী ফিরুন ⬅';
    }
    if (this.currentCorridor === 'flyover_kuril') {
      return 'কুড়িল ফ্লাইওভার: ৩০০ ফিট পূর্বাচল ➡ মহাখালী';
    }
    if (this.currentCorridor === 'connector') {
      return 'সোজা তেজগাঁও হিরো শোরুম ও মহাখালী রোড';
    }
    if (this.playerX >= 100 && this.playerX <= 165) {
      if (this.playerZ > -1760) return 'সামনে তেজগাঁও হিরো শোরুম -> মহাখালী ফ্লাইওভার';
      if (this.playerZ > -2400) return 'মহাখালী -> বনানী ফ্লাইওভার';
      if (this.playerZ > -2740) return 'সামনে কুড়িল: ডানে ৩০০ ফিট ➡ | সোজা উত্তরা';
      if (this.playerZ > -3020) return 'ডানে ৩০০ ফিট এক্সপ্রেসওয়ে ➡ | সোজা উত্তরা';
      if (this.playerZ > -3600) return 'সামনে উত্তরা হিরো শোরুম ও ইউ-টার্ন';
      return 'ইউ-টার্ন নিয়ে মহাখালী ফিরুন ⬇';
    }
    if (this.playerZ < -1140) return 'সামনে মেট্রো শেষ প্রান্তে ইউ-টার্ন ↩ (তেজগাঁও ফেরত)';
    if (Math.abs(this.playerZ - CORRIDOR_CONFIG.TEJGAON_TURNOFF_Z) <= 28) {
      return 'ডানে মোড় নিন ➡ তেজগাঁও লিংক রোড!';
    }
    if (this.playerZ > -900) return 'আগারগাঁও মেট্রো পেরিয়ে তেজগাঁও টার্ন ➡';
    return 'সামনে ডানে "তেজগাঁও এই দিকে ➡" বিলবোর্ড';
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

  private emitHud(
    isRefueling = false,
    isInFuelZone = false,
    isInShowroomZone = false,
    isInRestRoomZone = false
  ): void {
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
      isInRestRoomZone,
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
      routeHintBn: this.getRouteHintBn(),
      upcomingLight: light.phase,
      upcomingLightMeters: light.meters,
      sfxMuted: this.audio.isSfxMuted(),
      musicMuted: this.audio.isMusicMuted(),
      motionStatus: this.motion.getStatus(),
      motionSensitivity: this.motionSensitivity,
      motionSteer: this.smoothedSteer,
      motionThrottle: this.motion.getThrottle(0),
      environmentPreset: this.environmentPreset,
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
    window.removeEventListener('touchstart', this.handleFirstGesture);

    this.motion.disable();
    this.audio.dispose();
    this.skyTex.dispose();
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
