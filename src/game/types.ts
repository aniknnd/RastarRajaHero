export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  SHOWROOM = 'SHOWROOM',
  CRASHED = 'CRASHED',
  GAME_OVER = 'GAME_OVER',
}

export type BikeTierId = 'glamour_125' | 'xtreme_160r' | 'karizma_210';

export type SmashClass = 'small_medium' | 'large_commercial' | 'apex_titan';

export interface BikeSpec {
  id: BikeTierId;
  tier: 1 | 2 | 3;
  cost: number;
  nameBn: string;
  nameEn: string;
  taglineBn: string;
  taglineEn: string;
  smashClass: SmashClass;
  smashSummaryBn: string;
  smashSummaryEn: string;
  fuelCapacity: number; // Base 100 -> 150 -> 220
  fuelBurnMult: number; // 1.0 -> 0.75 -> 0.55
  comboHoldSec: number; // 4.5 -> 7.0 -> 9.5
  nitroDurationSec: number; // 2.6 -> 4.2 -> 6.0
  maxNormalMps: number;
  maxBoostMps: number;
  accelMult: number;
  accentHex: string;
}

export const BIKE_ORDER: readonly BikeTierId[] = ['glamour_125', 'xtreme_160r', 'karizma_210'];

export const BIKE_SPECS: Record<BikeTierId, BikeSpec> = {
  glamour_125: {
    id: 'glamour_125',
    tier: 1,
    cost: 0,
    nameBn: 'হিরো গ্ল্যামার ১২৫',
    nameEn: 'Hero Glamour 125',
    taglineBn: 'ঢাকার রাস্তার চিরসবুজ স্টার্টার বাইক',
    taglineEn: 'Nimble Dhaka street commuter',
    smashClass: 'small_medium',
    smashSummaryBn: 'সাইকেল, রিকশা, সিএনজি ও প্রাইভেট কার চুরমার',
    smashSummaryEn: 'Smashes Small & Medium vehicles',
    fuelCapacity: 100,
    fuelBurnMult: 1.0,
    comboHoldSec: 4.5,
    nitroDurationSec: 2.6,
    maxNormalMps: 38,
    maxBoostMps: 50,
    accelMult: 1.0,
    accentHex: '#ef4444',
  },
  xtreme_160r: {
    id: 'xtreme_160r',
    tier: 2,
    cost: 100000,
    nameBn: 'হিরো এক্সট্রিম ১৬০আর থ্রিলার',
    nameEn: 'Hero Xtreme 160R Thriller',
    taglineBn: 'বাস, কাভার্ড ভ্যান, সিমেন্ট মিক্সার ও ট্রাক চুরমার!',
    taglineEn: 'Streetfighter · Smashes Buses, Trucks & Mixers',
    smashClass: 'large_commercial',
    smashSummaryBn: 'সাধারণ বাস, কার্গো ট্রাক, কাভার্ড ভ্যান ও মিক্সার চুরমার',
    smashSummaryEn: 'Smashes City Buses, Cargo Trucks & Mixers',
    fuelCapacity: 150,
    fuelBurnMult: 0.75,
    comboHoldSec: 7.0,
    nitroDurationSec: 4.2,
    maxNormalMps: 44,
    maxBoostMps: 58,
    accelMult: 1.18,
    accentHex: '#f59e0b',
  },
  karizma_210: {
    id: 'karizma_210',
    tier: 3,
    cost: 200000,
    nameBn: 'হিরো কারিজমা এক্সএমআর ২১০',
    nameEn: 'Hero Karizma XMR 210 Titan',
    taglineBn: 'সুপারবাইক কিং — ডাবল-ডেকার, ট্যাংকার ও মনস্টার ট্রাকও চুরমার!',
    taglineEn: 'Apex Superbike · Smashes ALL Titans',
    smashClass: 'apex_titan',
    smashSummaryBn: 'ডাবল-ডেকার, তেলের ট্যাংকার, ফায়ার সার্ভিস ও আর্মি সহ সব চুরমার!',
    smashSummaryEn: 'Smashes Double-Deckers, Tankers, Fire & Monster Trucks',
    fuelCapacity: 220,
    fuelBurnMult: 0.55,
    comboHoldSec: 9.5,
    nitroDurationSec: 6.0,
    maxNormalMps: 50,
    maxBoostMps: 66,
    accelMult: 1.35,
    accentHex: '#10b981',
  },
};

export type VehicleTier = 'small' | 'medium' | 'large';

export type VehicleKind =
  | 'cycle'
  | 'rickshaw'
  | 'cng'
  | 'biker'
  | 'vangari'
  | 'hatchback'
  | 'car'
  | 'taxi'
  | 'sport'
  | 'muscle'
  | 'suv_prado'
  | 'pickup'
  | 'leguna'
  | 'van'
  | 'police'
  | 'ambulance'
  | 'rab'
  | 'covered_van'
  | 'cement_mixer'
  | 'bus_nitol'
  | 'bus_nitol_staff'
  | 'bus_brtc'
  | 'bus_hanif'
  | 'bus_shohag'
  | 'bus_double_decker'
  | 'truck'
  | 'oil_tanker'
  | 'fire_truck'
  | 'army'
  | 'monster';

export type TrafficLightPhase = 'GREEN' | 'YELLOW' | 'RED';

export interface VehicleSpec {
  tier: VehicleTier;
  smashRank: 1 | 2 | 3; // 1 = Starter bike, 2 = Xtreme 160R+, 3 = Karizma 210 Titan
  nameBn: string;
  nameEn: string;
  scoreValue: number;
  minSpeed: number;
  maxSpeed: number;
  halfWidth: number;
  halfLength: number;
  canTint: boolean;
  isBike?: boolean;
  arteryWeight: number;
  cityWeight: number;
}

export interface InputState {
  accelerate: boolean;
  brake: boolean;
  reverse: boolean;
  left: boolean;
  right: boolean;
  boost: boolean;
  handbrake: boolean;
  horn: boolean;
}

export interface EventPopup {
  id: number;
  title: string;
  subtitle?: string;
  tone: 'bonus' | 'warning' | 'danger' | 'refuel';
}

export interface HudMission {
  titleBn: string;
  progress: number;
  target: number;
  reward: number;
}

export interface HudSnapshot {
  gameState: GameState;
  score: number;
  bankScore: number;
  bestScore: number;
  isNewBest: boolean;
  equippedBikeId: BikeTierId;
  unlockedBikes: BikeTierId[];
  speedKmh: number;
  speedNorm: number; // 0..1
  fuelPercent: number;
  fuelAmount: number;
  fuelCapacity: number;
  isRefueling: boolean;
  isInFuelZone: boolean;
  nearestPumpMeters: number;
  isInShowroomZone: boolean;
  nearestShowroomMeters: number;
  nextUnlockBikeId: BikeTierId | null;
  combo: number;
  comboTimerNorm: number; // 0..1
  feverActive: boolean;
  distanceMeters: number;
  wrecksCount: number;
  pedKnockCount: number;
  nearMissCount: number;
  ruleBreakCount: number;
  collectiblesCount: number;
  angryMobCount: number;
  activeViolation: string | null;
  funnyMessage: string | null;
  latestPopup: EventPopup | null;
  mission: HudMission;
  rankTitleBn: string;
  screenFlashTone: 'none' | 'red' | 'amber' | 'green';
  gameOverReasonBn: string;
  gameOverReasonEn: string;
  gameOverRoastsBn: string[];
  lapCount: number;
  zoneLabelBn: string;
  turnCueBn: string | null;
  isOnElevatedRoad: boolean;
  upcomingLight: TrafficLightPhase | null;
  upcomingLightMeters: number;
}

export interface ElevatedSpanDef {
  id: 'elevated_expressway' | 'uttara_tongi_flyover';
  labelBn: string;
  startZ: number; // Northbound entry foot (-Z travel enters here)
  deckStartZ: number; // Top of entry ramp
  deckEndZ: number; // Start of exit ramp
  endZ: number; // Exit foot back to ground
  deckHeight: number;
  rampLeftMinX: number;
  rampLeftMaxX: number;
  rampRightMinX: number;
  rampRightMaxX: number;
  deckMinX: number;
  deckMaxX: number;
  tollPlazaZ?: number;
}

export const ELEVATED_SPANS: readonly ElevatedSpanDef[] = [
  {
    id: 'elevated_expressway',
    labelBn: 'ঢাকা এলিভেটেড এক্সপ্রেসওয়ে (মহাখালী → বিমানবন্দর)',
    startZ: -220, // Starts right at Mohakhali Bus Terminal
    deckStartZ: -282,
    deckEndZ: -698,
    endZ: -760, // Lands directly at Hazrat Shahjalal Int'l Airport (Kawla)
    deckHeight: 6.2,
    rampLeftMinX: -9.0,
    rampLeftMaxX: -4.4,
    rampRightMinX: 4.4,
    rampRightMaxX: 9.0,
    deckMinX: -8.9,
    deckMaxX: 8.9,
    tollPlazaZ: -580,
  },
  {
    id: 'uttara_tongi_flyover',
    labelBn: 'উত্তরা–টঙ্গী ফ্লাইওভার',
    startZ: -1200,
    deckStartZ: -1255,
    deckEndZ: -1465,
    endZ: -1520,
    deckHeight: 5.8,
    rampLeftMinX: -9.0,
    rampLeftMaxX: -4.4,
    rampRightMinX: 4.4,
    rampRightMaxX: 9.0,
    deckMinX: -8.9,
    deckMaxX: 8.9,
  },
];

export interface RiverChannelDef {
  id: 'turag' | 'balu' | 'shitalakshya';
  nameBn: string;
  startZ: number;
  endZ: number;
}

export const RIVER_CHANNELS: readonly RiverChannelDef[] = [
  { id: 'turag', nameBn: 'তুরাগ নদী • টঙ্গী ব্রিজ', startZ: -1322, endZ: -1396 },
  { id: 'balu', nameBn: 'বালু নদী • পূর্বাচল ৩০০ ফিট', startZ: -2026, endZ: -2054 },
  { id: 'shitalakshya', nameBn: 'শীতলক্ষ্যা নদী • নারায়ণগঞ্জ কাঞ্চন ব্রিজ', startZ: -2282, endZ: -2356 },
];

export function sampleElevatedSpanHeight(
  span: ElevatedSpanDef,
  z: number
): { y: number; slopeRad: number; zone: 'entry' | 'deck' | 'exit' | 'none' } {
  if (z > span.startZ || z < span.endZ) {
    return { y: 0, slopeRad: 0, zone: 'none' };
  }
  if (z >= span.deckStartZ) {
    const len = span.startZ - span.deckStartZ;
    const t = Math.min(1, Math.max(0, (span.startZ - z) / len));
    const smooth = t * t * (3 - 2 * t);
    const dydNegZ = (span.deckHeight * 6 * t * (1 - t)) / len;
    return { y: span.deckHeight * smooth, slopeRad: Math.atan(dydNegZ), zone: 'entry' };
  }
  if (z >= span.deckEndZ) {
    return { y: span.deckHeight, slopeRad: 0, zone: 'deck' };
  }
  const len = span.deckEndZ - span.endZ;
  const t = Math.min(1, Math.max(0, (span.deckEndZ - z) / len));
  const smooth = t * t * (3 - 2 * t);
  const dydNegZ = -(span.deckHeight * 6 * t * (1 - t)) / len;
  return { y: span.deckHeight * (1 - smooth), slopeRad: Math.atan(dydNegZ), zone: 'exit' };
}

export function getElevatedSpanById(id: ElevatedSpanDef['id']): ElevatedSpanDef | undefined {
  return ELEVATED_SPANS.find((s) => s.id === id);
}

export const GAME_CONFIG = {
  LOOP_LENGTH: 2880, // 36 blocks * 80m full Dhaka->Mohakhali->Expressway->Airport->Uttara->Tongi->Gazipur->Purbachal 300ft->Neela Market->Kanchan Bridge->MRT-6->Tejgaon loop
  BLOCK_LENGTH: 80,
  BLOCK_COUNT: 36,
  ARTERY_HALF_WIDTH: 9.6, // -9.6 to +9.6
  ARTERY_LANES: [-6.75, -3.25, 3.25, 6.75] as readonly number[], // Keep-left: -6.75/-3.25 go -Z; +3.25/+6.75 oncoming +Z
  AVENUE_LEFT_INNER_X: -34,
  AVENUE_RIGHT_INNER_X: 34,
  AVENUE_LEFT_OUTER_X: -62,
  AVENUE_RIGHT_OUTER_X: 62,
  WORLD_PERIMETER_X: 78,
  MEDIAN_HALF_WIDTH: 0.72,
  INTERSECTION_Z_POSITIONS: [-120, -440, -920, -1560, -1880, -2680] as readonly number[],
  TURAG_RIVER_START_Z: -1322,
  TURAG_RIVER_END_Z: -1396,
  GAZIPUR_CHOURASTA_Z: -1800,
  NEELA_MARKET_Z: -2120,
  KANCHAN_BRIDGE_Z: -2319,
  MRT_CORRIDOR_START_Z: -2480,
  FUEL_PAD_HALF_LENGTH: 11.5,
  FUEL_REFILL_MAX_SPEED_KMH: 24,
  FUEL_REFILL_RATE_PER_SEC: 55,
  SHOWROOM_PAD_HALF_LENGTH: 11.5,
  SHOWROOM_MAX_SPEED_KMH: 25,
  EMPTY_STOPPED_GAMEOVER_SEC: 4.0,
  BIKE_SCALE: 0.62,
  MAX_SPEED_NORMAL_MPS: 38,
  MAX_SPEED_BOOST_MPS: 50,
  MAX_SPEED_APEX_BOOST_MPS: 66,
  MAX_SPEED_EMPTY_MPS: 10,
  MAX_REVERSE_MPS: 8.5,
  SPEED_KMH_FACTOR: 3.4,
  TRAFFIC_SPEED_BOOST: 1.25,
  ARTERY_TRAFFIC_COUNT: 210,
  CITY_TRAFFIC_COUNT: 34,
  HIGH_SPEED_MSG_THRESHOLD_KMH: 80,
  BEST_SCORE_STORAGE_KEY: 'hero_rastar_raja_best_score_v2',
  HERO_BANK_STORAGE_KEY: 'hero_rastar_raja_bank_v1',
  UNLOCKED_BIKES_STORAGE_KEY: 'hero_rastar_raja_unlocked_bikes_v1',
  EQUIPPED_BIKE_STORAGE_KEY: 'hero_rastar_raja_equipped_bike_v1',
} as const;

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  cycle: {
    tier: 'small',
    smashRank: 1,
    nameBn: 'সাইকেল',
    nameEn: 'Bicycle',
    scoreValue: 80,
    minSpeed: 5.5,
    maxSpeed: 8.5,
    halfWidth: 0.36,
    halfLength: 0.9,
    canTint: true,
    isBike: true,
    arteryWeight: 7,
    cityWeight: 10,
  },
  rickshaw: {
    tier: 'small',
    smashRank: 1,
    nameBn: 'রিকশা',
    nameEn: 'Rickshaw',
    scoreValue: 110,
    minSpeed: 6,
    maxSpeed: 9.5,
    halfWidth: 0.64,
    halfLength: 1.3,
    canTint: true,
    arteryWeight: 9,
    cityWeight: 12,
  },
  vangari: {
    tier: 'small',
    smashRank: 1,
    nameBn: 'ভ্যানগাড়ি',
    nameEn: 'Van-Gari',
    scoreValue: 100,
    minSpeed: 5.5,
    maxSpeed: 8.5,
    halfWidth: 0.68,
    halfLength: 1.35,
    canTint: true,
    arteryWeight: 4,
    cityWeight: 6,
  },
  cng: {
    tier: 'small',
    smashRank: 1,
    nameBn: 'সিএনজি',
    nameEn: 'CNG Auto',
    scoreValue: 160,
    minSpeed: 10,
    maxSpeed: 14.5,
    halfWidth: 0.68,
    halfLength: 1.3,
    canTint: false,
    arteryWeight: 10,
    cityWeight: 9,
  },
  biker: {
    tier: 'small',
    smashRank: 1,
    nameBn: 'বাইকার',
    nameEn: 'Commuter Bike',
    scoreValue: 140,
    minSpeed: 12,
    maxSpeed: 18,
    halfWidth: 0.38,
    halfLength: 0.95,
    canTint: true,
    isBike: true,
    arteryWeight: 7,
    cityWeight: 6,
  },
  hatchback: {
    tier: 'small',
    smashRank: 1,
    nameBn: 'হ্যাচব্যাক',
    nameEn: 'Hatchback',
    scoreValue: 180,
    minSpeed: 11,
    maxSpeed: 16,
    halfWidth: 0.78,
    halfLength: 1.65,
    canTint: true,
    arteryWeight: 5,
    cityWeight: 5,
  },
  car: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'প্রাইভেট কার',
    nameEn: 'Sedan',
    scoreValue: 220,
    minSpeed: 12,
    maxSpeed: 18,
    halfWidth: 0.82,
    halfLength: 1.85,
    canTint: true,
    arteryWeight: 8,
    cityWeight: 6,
  },
  taxi: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'ট্যাক্সি ক্যাব',
    nameEn: 'Dhaka Taxi',
    scoreValue: 230,
    minSpeed: 12,
    maxSpeed: 17,
    halfWidth: 0.82,
    halfLength: 1.85,
    canTint: false,
    arteryWeight: 4,
    cityWeight: 4,
  },
  sport: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'স্পোর্টস কার',
    nameEn: 'Sport Car',
    scoreValue: 300,
    minSpeed: 15,
    maxSpeed: 22,
    halfWidth: 0.85,
    halfLength: 1.9,
    canTint: true,
    arteryWeight: 3,
    cityWeight: 2,
  },
  muscle: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'মাসল কার',
    nameEn: 'Muscle Car',
    scoreValue: 290,
    minSpeed: 14,
    maxSpeed: 21,
    halfWidth: 0.86,
    halfLength: 1.95,
    canTint: true,
    arteryWeight: 2,
    cityWeight: 1,
  },
  suv_prado: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'প্রাডো ভিআইপি জিপ',
    nameEn: 'Prado VIP SUV',
    scoreValue: 380,
    minSpeed: 13.5,
    maxSpeed: 20,
    halfWidth: 0.92,
    halfLength: 2.15,
    canTint: true,
    arteryWeight: 4,
    cityWeight: 3,
  },
  pickup: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'পিকআপ',
    nameEn: 'Pickup',
    scoreValue: 240,
    minSpeed: 11,
    maxSpeed: 16,
    halfWidth: 0.86,
    halfLength: 2.0,
    canTint: true,
    arteryWeight: 4,
    cityWeight: 4,
  },
  leguna: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'লেগুনা',
    nameEn: 'Leguna',
    scoreValue: 250,
    minSpeed: 11,
    maxSpeed: 15.5,
    halfWidth: 0.78,
    halfLength: 1.95,
    canTint: false,
    arteryWeight: 5,
    cityWeight: 4,
  },
  van: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'মাইক্রোবাস',
    nameEn: 'Microbus Van',
    scoreValue: 240,
    minSpeed: 11,
    maxSpeed: 16,
    halfWidth: 0.86,
    halfLength: 2.0,
    canTint: true,
    arteryWeight: 4,
    cityWeight: 4,
  },
  police: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'ডিএমপি পুলিশ',
    nameEn: 'DMP Police Van',
    scoreValue: 340,
    minSpeed: 13,
    maxSpeed: 19,
    halfWidth: 0.86,
    halfLength: 2.05,
    canTint: false,
    arteryWeight: 3,
    cityWeight: 3,
  },
  ambulance: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'অ্যাম্বুলেন্স',
    nameEn: 'Ambulance',
    scoreValue: 320,
    minSpeed: 14,
    maxSpeed: 20,
    halfWidth: 0.88,
    halfLength: 2.1,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 2,
  },
  rab: {
    tier: 'medium',
    smashRank: 1,
    nameBn: 'র‍্যাব ভ্যান',
    nameEn: 'RAB Van',
    scoreValue: 360,
    minSpeed: 13,
    maxSpeed: 19,
    halfWidth: 0.88,
    halfLength: 2.1,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 2,
  },
  covered_van: {
    tier: 'large',
    smashRank: 2,
    nameBn: 'কাভার্ড ভ্যান',
    nameEn: 'Covered Freight Van',
    scoreValue: 540,
    minSpeed: 9.5,
    maxSpeed: 14,
    halfWidth: 1.02,
    halfLength: 3.15,
    canTint: false,
    arteryWeight: 3,
    cityWeight: 0,
  },
  cement_mixer: {
    tier: 'large',
    smashRank: 2,
    nameBn: 'নিটল সিমেন্ট মিক্সার',
    nameEn: 'Nitol Cement Mixer',
    scoreValue: 680,
    minSpeed: 8.5,
    maxSpeed: 12.5,
    halfWidth: 1.04,
    halfLength: 3.25,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 0,
  },
  bus_nitol: {
    tier: 'large',
    smashRank: 2,
    nameBn: 'নিটল বাস',
    nameEn: 'Nitol Bus',
    scoreValue: 560,
    minSpeed: 10,
    maxSpeed: 14.5,
    halfWidth: 1.05,
    halfLength: 3.6,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 0,
  },
  bus_brtc: {
    tier: 'large',
    smashRank: 2,
    nameBn: 'বিআরটিসি বাস',
    nameEn: 'BRTC Bus',
    scoreValue: 560,
    minSpeed: 9.5,
    maxSpeed: 13.5,
    halfWidth: 1.08,
    halfLength: 3.85,
    canTint: false,
    arteryWeight: 3,
    cityWeight: 0,
  },
  bus_hanif: {
    tier: 'large',
    smashRank: 2,
    nameBn: 'হানিফ এন্টারপ্রাইজ',
    nameEn: 'Hanif Bus',
    scoreValue: 580,
    minSpeed: 11,
    maxSpeed: 15.5,
    halfWidth: 1.05,
    halfLength: 3.7,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 0,
  },
  bus_shohag: {
    tier: 'large',
    smashRank: 2,
    nameBn: 'সোহাগ পরিবহন',
    nameEn: 'Shohag Bus',
    scoreValue: 580,
    minSpeed: 11,
    maxSpeed: 15.5,
    halfWidth: 1.05,
    halfLength: 3.7,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 0,
  },
  truck: {
    tier: 'large',
    smashRank: 2,
    nameBn: 'কার্গো ট্রাক',
    nameEn: 'Cargo Truck',
    scoreValue: 520,
    minSpeed: 9,
    maxSpeed: 13,
    halfWidth: 1.04,
    halfLength: 3.35,
    canTint: false,
    arteryWeight: 3,
    cityWeight: 0,
  },
  bus_nitol_staff: {
    tier: 'large',
    smashRank: 3,
    nameBn: 'নিটল-নিলয় স্টাফ বাস',
    nameEn: 'Nitol-Niloy Staff Bus',
    scoreValue: 760,
    minSpeed: 10.5,
    maxSpeed: 15,
    halfWidth: 1.06,
    halfLength: 3.7,
    canTint: false,
    arteryWeight: 3,
    cityWeight: 0,
  },
  bus_double_decker: {
    tier: 'large',
    smashRank: 3,
    nameBn: 'বিআরটিসি ডাবল ডেকার',
    nameEn: 'BRTC Double-Decker',
    scoreValue: 860,
    minSpeed: 9.5,
    maxSpeed: 13.5,
    halfWidth: 1.1,
    halfLength: 3.95,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 0,
  },
  oil_tanker: {
    tier: 'large',
    smashRank: 3,
    nameBn: 'তেলের ট্যাংকার',
    nameEn: 'Fuel Oil Tanker',
    scoreValue: 920,
    minSpeed: 9,
    maxSpeed: 13,
    halfWidth: 1.08,
    halfLength: 3.8,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 0,
  },
  fire_truck: {
    tier: 'large',
    smashRank: 3,
    nameBn: 'ফায়ার সার্ভিস ট্রাক',
    nameEn: 'Fire Service Truck',
    scoreValue: 960,
    minSpeed: 12,
    maxSpeed: 17,
    halfWidth: 1.06,
    halfLength: 3.55,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 0,
  },
  army: {
    tier: 'large',
    smashRank: 3,
    nameBn: 'বাংলাদেশ সেনাবাহিনী',
    nameEn: 'Bangladesh Army Van',
    scoreValue: 820,
    minSpeed: 10,
    maxSpeed: 14,
    halfWidth: 1.02,
    halfLength: 3.1,
    canTint: false,
    arteryWeight: 1,
    cityWeight: 0,
  },
  monster: {
    tier: 'large',
    smashRank: 3,
    nameBn: 'মনস্টার ট্রাক',
    nameEn: 'Monster Truck',
    scoreValue: 980,
    minSpeed: 10.5,
    maxSpeed: 15,
    halfWidth: 1.15,
    halfLength: 2.6,
    canTint: false,
    arteryWeight: 1,
    cityWeight: 0,
  },
};

export const FUNNY_BENGALI_MESSAGES: readonly string[] = [
  'আস্তে চালাও ভাই, তুমি স্পাইডার-ম্যান না!',
  'হিরো বাইক চালাও, গতি তো বাড়বেই—বউ-পোলাপানের কথাও ভাবো!',
  'ভাই, বনানী র‍্যাম্পে বামে না নামলে এলিভেটেড এক্সপ্রেসওয়ে সোজা বিমানবন্দর চলে যাবে!',
  'কুর্মিটোলা থেকে ডানে ৯০° বাঁক নিলেই পূর্বাচল ৩০০ ফিট ও নীলা মার্কেট!',
  'হেলমেট শক্ত করে ধরো, উত্তরা–টঙ্গী ফ্লাইওভার দিয়ে উড়াল দিচ্ছ!',
  'এত স্পিড! পেছনে কি ডিএমপি নাকি নীলা মার্কেটের হাঁসের মাংসের লোভ?',
  'ডিটিএ - ঢাকাতে আছি! উড়ালপঙ্খী না ভাই—কাঞ্চন ব্রিজে ব্রেক ধরিও!',
  'একটি দুর্ঘটনা, সারা জীবনের কান্না—গতি কমাও হিরো!',
  'নিটল-নিলয় স্টাফ বাস দেখলে সালাম দিয়ে সাইড নাও!',
  'কাঞ্চন ব্রিজ ➔ ঢাকা বাইপাস ➔ গাজীপুর ➔ মেট্রোরেল পথে তেজগাঁও শোরুমে ফেরো!',
];

export const FUNNY_DEATH_LINES_BN: readonly string[] = [
  'চড় খেয়ে ঢাকাতে আছির হিরো এখন রাস্তার প্রজা!',
  'একটি দুর্ঘটনা, সারা জীবনের কান্না — ব্রেক ধরলে আজকে বাঁচতা!',
  'ভাই, বাসের সাথে হিরোগিরি করতে গিয়ে ফ্ল্যাট হয়ে গেলা!',
  'পাবলিকের মাইর দুনিয়ার বাইর—পরের বার ব্রেক চাপিও!',
  'হেলমেট ছিল বলে রক্ষা, না হলে আজ বিরিয়ানি মিস হতো!',
  'রাস্তার মাঝে কলাগাছ হয়ে গেলা তো ভাই — একটু আস্তে চালাও!',
  'ট্রাক ভাই বললো: "আমি তো লাইনেই ছিলাম, তুই আইসা সালাম দিলি কেন?"',
  'বউ ফোন দিয়ে বলছে: "কই তুমি?" — এখন বলো "আকাশে উড়তেসি!"',
  'রিকশার ঘণ্টি শুনেও সরলা না, এখন রাস্তার ময়লা গুনো!',
  'স্পিড ছিল রকেটের মতো, আর ব্রেকটা ছিল চায়ের ছুটিতে!',
  'এমন ল্যান্ডিং করলা যে গুগল ম্যাপও বলছে: "রাস্তা হারিয়েছে!"',
  'ভ্যানগাড়ির আলু আর তোমার স্বপ্ন — দুটোই ছড়িয়ে গেল রাস্তায়!',
  'ডাবল-ডেকার বাস বললো: "ছোট ভাই, আগে বড় বাইক আনো!"',
  'ফেসবুক লাইভে পাবলিক ক্যাপশন দিছে: "DTA জরুরি বৈঠক!"',
  'দোকানের কাকা জিজ্ঞেস করে: "ভাই, ডানায় চোট লাগে নাই তো?"',
  'হিরো বাইক তো মজবুত, কিন্তু রাস্তার খাম্বা আরও মজবুত!',
  'ভাই, এই স্টান্টের জন্য অস্কার না—এক কাপ আদা চা প্রাপ্য!',
  'টঙ্গী ফ্লাইওভারের কাকগুলোও তালি দিচ্ছে তোমার উড়াল দেখে!',
  'হর্ন বাজালেই রাস্তা খালি হয় না — মাঝে মাঝে ডানে-বামেও তাকাইও!',
  'আয়হায়! এক ধাক্কায় সব কম্বো শেষ, পকেটও খালি!',
  'বন্ধুরা বললো: "ভাই, তুই কি রাস্তা মাপতে বের হইছিস?"',
  'সিগন্যাল লাল ছিল, কিন্তু তোমার মন ছিল সবুজ — ফল হাতে নাতে!',
  'রাস্তার কুকুরও মাথা নেড়ে বললো: "এভাবে কেউ চালায় রে পাগলা!"',
  'আজকের রাইড স্পন্সরড বাই: মামা-চাচা ও পাবলিকের থাপ্পড়!',
  'এত জোরে চালানোর পর এখন পাদুকাও খুঁজে পাওয়া যাচ্ছে না!',
  'উড়ালপঙ্খী হতে গিয়ে সিএনজির বাম্পারে চুমু খেয়ে গেলা!',
  'এক সেকেন্ড আগেও হিরো ছিলা, এক ধাক্কায় পুরো জিরো!',
  'ভাই, ব্রেক প্যাডেলটা কি তেজগাঁও শোরুমে রেখে আসছিলা?!',
  'সার্ফিং করতে গেলা গাজীপুর চৌরাস্তায়—তাও আবার বাসের সামনে!',
  'পাশের টংয়ের চা ঠান্ডা হয়ে গেল তোমার ওভারটেক দেখতে দেখতে!',
];

export const GAME_OVER_PUBLIC_ROASTS_BN: readonly string[] = [
  'চায়ের মামা: "হাসতে হাসতে আমার দুধ-চা পড়ে গেল রে ভাই!"',
  'রিকশাওয়ালা চাচা: "বাবা, আমার তিন চাকার বেল শুনেও ব্রেক দিলা না!"',
  'বাসের হেল্পার: "ওস্তাদ, বামে তো পুরো এক্সপ্রেসওয়ে রানওয়ে খালি ছিল!"',
  'সিএনজি ড্রাইভার: "মামা, আজ মিটার ছাড়াই আকাশ ভ্রমণ হয়ে গেল!"',
  'পাশের আন্টি: "ও মাগো! ছেলেটা তো বাইক ছেড়ে সুপারম্যান হয়ে গেল!"',
  'ট্রাফিক সার্জেন্ট: "কেস লিখব কি ভাই, হাসিই তো থামতেসে না!"',
  'ফুচকা মামা: "ভাইয়ের এমন ফ্লাইট দেখে আমার টকও টক হয়ে গেছে!"',
  'ফেসবুক পাবলিক: "ভিডিও ভাইরাল! ক্যাপশন: ব্রেক কী জিনিস?"',
  'তেজগাঁও শোরুম গার্ড: "বস, আগে হেলমেট ঠিক করেন, তারপর হিরোগিরি!"',
  'মুরব্বি পথচারী: "একটি দুর্ঘটনা, সারা জীবনের কান্না — মনে রাইখো বাবা!"',
  'হকার ভাই: "ঝালমুড়ি লাগবে ভাই? পড়ার পর তো খিদা লাগার কথা!"',
  'স্কুলছাত্র: "ওয়াও আংকেল! সার্কাসের চেয়েও দারুণ জাম্প দিলেন!"',
  'টংয়ের কাস্টমার: "এই বাইকারকে কেউ একটু আদা-চা আর ব্যথার মলম দাও!"',
  'প্রাইভেট কার চালক: "ভাই, আমার বনেটটা কি বিছানা মনে হইছে?"',
  'মেট্রোরেলের যাত্রী: "উপর থেকে দেখলাম — আজকের সেরা কমেডি শো!"',
  'বন্ধুমহল: "দোস্ত, তোর লাইসেন্স না—রকেট চালানোর পারমিট লাগবে!"',
  'পানের দোকানদার: "পান খাবা ভাই? ধাক্কা খেয়ে তো মুখ শুকায় গেছে!"',
  'তুরাগ পাড়ের কাক: "কা কা! ফ্লাইওভারে আমরাই এর চেয়ে ভালো ল্যান্ড করি!"',
];

export const NITOL_NILOY_SIGNS: readonly {
  title: string;
  sub: string;
  bg: string;
  fg: string;
  accent: string;
}[] = [
  {
    title: 'নিলয় মোটরস লিমিটেড',
    sub: '৮৮ শহীদ তাজউদ্দিন আহমেদ এভিনিউ • তেজগাঁও',
    bg: '#991b1b',
    fg: '#ffffff',
    accent: '#facc15',
  },
  {
    title: 'নিটল-নিলয় গ্রুপ',
    sub: 'NITOL NILOY GROUP • হিরো অফিশিয়াল',
    bg: '#0f172a',
    fg: '#fde047',
    accent: '#dc2626',
  },
  {
    title: 'নিটল-নিলয় টাওয়ার • মহাখালী',
    sub: 'টাটা বাস-ট্রাক ও স্টাফ সার্ভিস হাব',
    bg: '#1e3a8a',
    fg: '#fef08a',
    accent: '#38bdf8',
  },
  {
    title: 'উত্তরা – টঙ্গী – গাজীপুর হাব',
    sub: 'নিটল সিমেন্ট • মজবুত নির্মাণের ভরসা',
    bg: '#065f46',
    fg: '#ffffff',
    accent: '#fde047',
  },
  {
    title: 'নিটল ইন্স্যুরেন্স • গাজীপুর',
    sub: 'নিরাপদ পথচলার সঙ্গী • চন্দনা চৌরাস্তা',
    bg: '#7c2d12',
    fg: '#fef3c7',
    accent: '#f59e0b',
  },
  {
    title: 'হাজী বিরিয়ানি ও মামা চা',
    sub: 'গরম সিঙ্গারা • তেজগাঁও – উত্তরা – গাজীপুর',
    bg: '#111827',
    fg: '#f8fafc',
    accent: '#ef4444',
  },
];

export const DHAKA_ROAD_SIGNS: readonly {
  title: string;
  sub: string;
  accent: string;
}[] = [
  { title: 'বনানী এক্সিট ↙', sub: 'বামে নামলে কুর্মিটোলা → ৩০০ ফিট!', accent: '#059669' },
  { title: 'ধীরে চলুন ভাই!', sub: 'এক্সপ্রেসওয়ে সোজা বিমানবন্দর (কাওলা) যাবে', accent: '#dc2626' },
  { title: 'কুর্মিটোলা ৯০° বাঁক ↱', sub: 'ডানে ঘুরলেই পূর্বাচল ৩০০ ফিট রোড!', accent: '#059669' },
  { title: 'হর্ন দিয়েন না!', sub: 'বাজালেও মহাখালী বাস টার্মিনাল জ্যাম ছুটবে না', accent: '#d97706' },
  { title: 'আস্তে ওভারটেক!', sub: 'সামনে নীলা মার্কেট • হাঁসের মাংস রেডি', accent: '#2563eb' },
  { title: 'কাঞ্চন ব্রিজ ➔ N105', sub: 'শীতলক্ষ্যা পেরিয়ে বামে ঢাকা বাইপাস!', accent: '#7c3aed' },
  { title: 'রং সাইডে ভাইরাল!', sub: 'নীলা মার্কেটের কাস্টমার ভিডিও করতেছে!', accent: '#be123c' },
  { title: 'গাজীপুর চৌরাস্তা!', sub: 'জাগ্রত চৌরঙ্গী পেরিয়ে বামে বোর্ড বাজার', accent: '#b91c1c' },
  { title: 'একটি দুর্ঘটনা', sub: 'সারা জীবনের কান্না • গতি কমান!', accent: '#dc2626' },
  { title: 'উত্তরা–টঙ্গী ফ্লাইওভার!', sub: 'উপরে উড়াল দিন • নিচে তুরাগ নদী', accent: '#0284c7' },
  { title: 'বিমানবন্দর ➔ দিয়াবাড়ি', sub: 'ডানে ঘুরলেই উত্তরা উত্তর মেট্রো (MRT-6)', accent: '#0f766e' },
  { title: 'বাম লেনে থাকুন!', sub: 'ডান দিক থেকে স্টাফ বাস আসছে', accent: '#0f766e' },
];

export const DHAKA_DIRECTION_SIGNS: readonly {
  topLine: string;
  midLine: string;
  bottomLine: string;
  bg: string;
}[] = [
  {
    topLine: '⬆ মহাখালী বাস টার্মিনাল • সাতরাস্তা',
    midLine: '⬅ তেজগাঁও (৮৮ শহীদ তাজউদ্দিন এভি.)  |  নাবিস্কো ➡',
    bottomLine: 'TEJGAON HERO SHOWROOM  •  MOHAKHALI TERMINAL',
    bg: '#065f46',
  },
  {
    topLine: '⬆ ঢাকা এলিভেটেড এক্সপ্রেসওয়ে ↑ (মহাখালী এন্ট্রি)',
    midLine: '↙ বনানী এক্সিট (৩০০ ফিট)  |  সোজা: কাওলা বিমানবন্দর ⬆',
    bottomLine: 'BANANI DOWN-RAMP TO KURMITOLA  •  MAINLINE TO AIRPORT',
    bg: '#1e3a8a',
  },
  {
    topLine: '↱ কুর্মিটোলা ৯০° বাঁক: পূর্বাচল ৩০০ ফিট রোড',
    midLine: '⬆ কুড়িল ফ্লাইওভার  |  বালু সেতু • নীলা মার্কেট • কাঞ্চন ব্রিজ ↱',
    bottomLine: 'KURMITOLA / KURIL 90-DEG TURN  •  PURBACHAL 300FT',
    bg: '#047857',
  },
  {
    topLine: '⬆ নারায়ণগঞ্জ কাঞ্চন ব্রিজ • শীতলক্ষ্যা নদী',
    midLine: '⬅ পূর্বাচল নীলা মার্কেট  |  বামে ৯০°: ঢাকা বাইপাস (N105) ↰',
    bottomLine: 'KANCHAN BRIDGE  •  LEFT TO DHAKA BYPASS (N105)',
    bg: '#1e3a8a',
  },
  {
    topLine: '⬆ ঢাকা বাইপাস (N105) • ভোগড়া ↰ গাজীপুর চৌরাস্তা',
    midLine: '⬅ রূপগঞ্জ • কাঞ্চন  |  জাগ্রত চৌরঙ্গী • বোর্ড বাজার ↰',
    bottomLine: 'DHAKA BYPASS N105  •  BHOGRA TO GAZIPUR CHOURASTA',
    bg: '#065f46',
  },
  {
    topLine: '⬆ বোর্ড বাজার ➔ টঙ্গী ➔ উত্তরা–টঙ্গী ফ্লাইওভার',
    midLine: '⬅ গাজীপুর হিরো হাব  |  তুরাগ নদী • বিশ্ব ইজতেমা ⬆',
    bottomLine: 'BOARD BAZAR  •  UTTARA-TONGI FLYOVER  •  AIRPORT',
    bg: '#1e3a8a',
  },
  {
    topLine: '↱ হযরত শাহজালাল বিমানবন্দর • উত্তরা উত্তর (দিয়াবাড়ি)',
    midLine: '⬆ উত্তরা  |  ডানে ৯০° মোড়: ঢাকা মেট্রোরেল (MRT-6) ↱',
    bottomLine: 'DHAKA AIRPORT  •  TURN RIGHT TO DIABARI MRT-6',
    bg: '#065f46',
  },
  {
    topLine: '⬆ ঢাকা মেট্রো রেল (MRT-6) 🚇 • তেজগাঁও ফিরুন',
    midLine: '⬅ মিরপুর-১০ • ফার্মগেট  |  বিজয় সরণি • তেজগাঁও শোরুম ↰',
    bottomLine: 'DHAKA METRO RAIL (MRT-6)  •  VIJAY SARANI TO TEJGAON',
    bg: '#0f766e',
  },
];

export const RICKSHAW_BACK_SIGNS: readonly {
  title: string;
  sub: string;
  bg: string;
  fg: string;
}[] = [
  { title: 'বৌয়ের দোয়া পরিবহন', sub: 'আস্তে চাপুন • সংসার আছে!', bg: '#be123c', fg: '#fde047' },
  { title: 'মায়ের দোয়া পরিবহন', sub: 'ভাড়া নিয়ে তর্ক করিবেন না', bg: '#1d4ed8', fg: '#ffffff' },
  { title: 'রাস্তার বাঘ রিকশা', sub: 'ঘন্টি বাজাইলে সাইড দিমু', bg: '#065f46', fg: '#fef08a' },
];

export const CNG_BACK_SIGNS: readonly {
  title: string;
  sub: string;
  bg: string;
  fg: string;
}[] = [
  { title: 'ভাই ভাই পরিবহন', sub: 'মিটারে চলি না • দূরত্ব রাখুন', bg: '#14532d', fg: '#fde047' },
  { title: 'আল্লাহ ভরসা সিএনজি', sub: 'চাকা ঘুরলে টাকা বাড়ে!', bg: '#0f172a', fg: '#4ade80' },
  { title: 'দুই বন্ধুর স্বপ্ন', sub: 'হিরো বাইক দেখলে সালাম!', bg: '#166534', fg: '#ffffff' },
];

export const REAL_TRAFFIC_SIGNS: readonly {
  badge: string;
  title: string;
  sub: string;
  bg: string;
  border: string;
}[] = [
  { badge: 'STOP', title: 'থামুন • লাল বাতি', sub: 'সামনে ক্রসিং • CROSSWALK', bg: '#991b1b', border: '#ffffff' },
  { badge: 'LEFT', title: 'বাম লেনে চলুন', sub: 'KEEP LEFT • র‍্যাম্প ও সাইকেল বামে', bg: '#1e3a8a', border: '#fde047' },
  { badge: '40', title: 'সর্বোচ্চ গতি ৪০', sub: 'হিরো বাইকারদের জন্য প্রযোজ্য নয়!', bg: '#ffffff', border: '#dc2626' },
  { badge: 'MRT-6', title: 'সামনে মেট্রো স্টেশন', sub: 'চলন্ত সিঁড়ি ও যাত্রী পারাপার', bg: '#065f46', border: '#4ade80' },
];

