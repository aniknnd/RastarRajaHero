export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  CRASHED = 'CRASHED',
  GAME_OVER = 'GAME_OVER',
}

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
  | 'pickup'
  | 'leguna'
  | 'van'
  | 'police'
  | 'ambulance'
  | 'rab'
  | 'bus_nitol'
  | 'bus_nitol_staff'
  | 'bus_brtc'
  | 'bus_hanif'
  | 'bus_shohag'
  | 'truck'
  | 'army'
  | 'monster';

export type TrafficLightPhase = 'GREEN' | 'YELLOW' | 'RED';

export interface VehicleSpec {
  tier: VehicleTier;
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
  bestScore: number;
  isNewBest: boolean;
  speedKmh: number;
  speedNorm: number; // 0..1
  fuelPercent: number;
  isRefueling: boolean;
  isInFuelZone: boolean;
  nearestPumpMeters: number;
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
  lapCount: number;
  zoneLabelBn: string;
  upcomingLight: TrafficLightPhase | null;
  upcomingLightMeters: number;
}

export const GAME_CONFIG = {
  LOOP_LENGTH: 720, // 9 blocks * 80m seamless endless Dhaka loop
  BLOCK_LENGTH: 80,
  BLOCK_COUNT: 9,
  ARTERY_HALF_WIDTH: 9.6, // -9.6 to +9.6
  ARTERY_LANES: [-6.75, -3.25, 3.25, 6.75] as readonly number[], // Keep-left: -6.75/-3.25 go -Z; +3.25/+6.75 oncoming +Z
  AVENUE_LEFT_INNER_X: -34,
  AVENUE_RIGHT_INNER_X: 34,
  AVENUE_LEFT_OUTER_X: -62,
  AVENUE_RIGHT_OUTER_X: 62,
  WORLD_PERIMETER_X: 78,
  MEDIAN_HALF_WIDTH: 0.72,
  INTERSECTION_Z_POSITIONS: [-200, -280, -520, -680] as readonly number[],
  FUEL_PAD_HALF_LENGTH: 11.5,
  FUEL_REFILL_MAX_SPEED_KMH: 20,
  FUEL_REFILL_RATE_PER_SEC: 36,
  EMPTY_STOPPED_GAMEOVER_SEC: 4.0,
  BIKE_SCALE: 0.62,
  MAX_SPEED_NORMAL_MPS: 38,
  MAX_SPEED_BOOST_MPS: 50,
  MAX_SPEED_EMPTY_MPS: 10,
  MAX_REVERSE_MPS: 8.5,
  SPEED_KMH_FACTOR: 3.4,
  TRAFFIC_SPEED_BOOST: 1.25,
  ARTERY_TRAFFIC_COUNT: 28,
  CITY_TRAFFIC_COUNT: 28,
  HIGH_SPEED_MSG_THRESHOLD_KMH: 80,
  BEST_SCORE_STORAGE_KEY: 'hero_rastar_raja_best_score_v2',
} as const;

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  cycle: {
    tier: 'small',
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
  pickup: {
    tier: 'medium',
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
  bus_nitol: {
    tier: 'large',
    nameBn: 'নিটল বাস',
    nameEn: 'Nitol Bus',
    scoreValue: 500,
    minSpeed: 10,
    maxSpeed: 14.5,
    halfWidth: 1.05,
    halfLength: 3.6,
    canTint: false,
    arteryWeight: 2,
    cityWeight: 0,
  },
  bus_nitol_staff: {
    tier: 'large',
    nameBn: 'নিটল-নিলয় স্টাফ বাস',
    nameEn: 'Nitol-Niloy Staff Bus',
    scoreValue: 550,
    minSpeed: 10.5,
    maxSpeed: 15,
    halfWidth: 1.06,
    halfLength: 3.7,
    canTint: false,
    arteryWeight: 4,
    cityWeight: 0,
  },
  bus_brtc: {
    tier: 'large',
    nameBn: 'বিআরটিসি বাস',
    nameEn: 'BRTC Bus',
    scoreValue: 500,
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
    nameBn: 'হানিফ এন্টারপ্রাইজ',
    nameEn: 'Hanif Bus',
    scoreValue: 500,
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
    nameBn: 'সোহাগ পরিবহন',
    nameEn: 'Shohag Bus',
    scoreValue: 500,
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
    nameBn: 'কার্গো ট্রাক',
    nameEn: 'Cargo Truck',
    scoreValue: 480,
    minSpeed: 9,
    maxSpeed: 13,
    halfWidth: 1.04,
    halfLength: 3.35,
    canTint: false,
    arteryWeight: 3,
    cityWeight: 0,
  },
  army: {
    tier: 'large',
    nameBn: 'বাংলাদেশ সেনাবাহিনী',
    nameEn: 'Bangladesh Army Van',
    scoreValue: 550,
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
    nameBn: 'মনস্টার ট্রাক',
    nameEn: 'Monster Truck',
    scoreValue: 600,
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
  'ভাই, মহাখালী-গুলিস্তান রাস্তাটা রেসিং ট্র্যাক না!',
  'ব্রেকটা মনে আছে তো, হিরো?',
  'হেলমেট শক্ত করে ধরো, রকেট হয়ে যাচ্ছ!',
  'এত স্পিড! পেছনে কি ডিএমপি নাকি বউ?',
  'রাস্তার রাজা মানেই উড়ালপঙ্খী না ভাই!',
  'একটি দুর্ঘটনা, সারা জীবনের কান্না—গতি কমাও হিরো!',
  'নিটল-নিলয় স্টাফ বাস দেখলে সালাম দিয়ে সাইড নাও!',
];

export const FUNNY_DEATH_LINES_BN: readonly string[] = [
  'চড় খেয়ে রাস্তার রাজা এখন রাস্তার প্রজা!',
  'একটি দুর্ঘটনা, সারা জীবনের কান্না — ব্রেক ধরলে আজকে বাঁচতা!',
  'ভাই, বাসের সাথে হিরোগিরি করতে গিয়ে ফ্ল্যাট হয়ে গেলা!',
  'পাবলিকের মাইর দুনিয়ার বাইর—পরের বার ব্রেক চাপিও!',
  'হেলমেট ছিল বলে রক্ষা, না হলে আজ বিরিয়ানি মিস হতো!',
];

export const NITOL_NILOY_SIGNS: readonly {
  title: string;
  sub: string;
  bg: string;
  fg: string;
  accent: string;
}[] = [
  {
    title: 'নিটল-নিলয় গ্রুপ',
    sub: 'NITOL NILOY GROUP • হিরো অফিশিয়াল',
    bg: '#0f172a',
    fg: '#fde047',
    accent: '#dc2626',
  },
  {
    title: 'নিলয় মোটরস লিমিটেড',
    sub: 'হিরো মোটরসাইকেল শোরুম ও সার্ভিস',
    bg: '#991b1b',
    fg: '#ffffff',
    accent: '#facc15',
  },
  {
    title: 'নিটল-নিলয় টাওয়ার • মহাখালী',
    sub: 'টাটা বাস-ট্রাক ও স্টাফ সার্ভিস হাব',
    bg: '#1e3a8a',
    fg: '#fef08a',
    accent: '#38bdf8',
  },
  {
    title: 'নিটল সিমেন্ট',
    sub: 'মজবুত নির্মাণের ভরসা • ঢাকা',
    bg: '#065f46',
    fg: '#ffffff',
    accent: '#fde047',
  },
  {
    title: 'নিটল ইন্স্যুরেন্স',
    sub: 'নিরাপদ পথচলার সঙ্গী • গুলিস্তান শাখা',
    bg: '#7c2d12',
    fg: '#fef3c7',
    accent: '#f59e0b',
  },
  {
    title: 'হাজী বিরিয়ানি ও মামা চা',
    sub: 'গরম সিঙ্গারা • ফার্মগেট মোড়',
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
  { title: 'একটি দুর্ঘটনা', sub: 'সারা জীবনের কান্না • সাবধানে চালান!', accent: '#b91c1c' },
  { title: 'ধীরে চলুন ভাই!', sub: 'বউ বাসায় অপেক্ষা করছে', accent: '#dc2626' },
  { title: 'হর্ন দিয়েন না!', sub: 'বাজালেও জ্যাম ছুটবে না', accent: '#d97706' },
  { title: 'আস্তে ওভারটেক!', sub: 'আগে নিটল ইন্স্যুরেন্স দেখুন', accent: '#2563eb' },
  { title: 'রেসিং ট্র্যাক না!', sub: 'পাশের টংয়ে গরম চা ঠান্ডা হচ্ছে', accent: '#059669' },
  { title: 'রং সাইডে ভাইরাল!', sub: 'পাবলিক ভিডিও করতেছে ভাই', accent: '#be123c' },
  { title: 'হেলমেট মাথায় দিন!', sub: 'চুল নষ্ট হলেও মাথা বাঁচবে', accent: '#7c3aed' },
  { title: 'একটি দুর্ঘটনা', sub: 'সারা জীবনের কান্না • গতি কমান!', accent: '#dc2626' },
  { title: 'মহাখালী জ্যাম সামনে!', sub: 'বাইক নিয়ে গলি দিয়ে কাটান', accent: '#0284c7' },
  { title: 'গুলিস্তান চত্বর সাবধান!', sub: 'বাস দেখলে হিরোগিরি কম করুন', accent: '#b91c1c' },
  { title: 'উড়ালপঙ্খী মোড অফ!', sub: 'এটা হিরো বাইক, রকেট না', accent: '#c2410c' },
  { title: 'বাম লেনে থাকুন!', sub: 'ডান দিক থেকে স্টাফ বাস আসছে', accent: '#0f766e' },
];

export const DHAKA_DIRECTION_SIGNS: readonly {
  topLine: string;
  midLine: string;
  bottomLine: string;
  bg: string;
}[] = [
  {
    topLine: '⬆ মহাখালী ২ কি.মি.  •  গুলশান-১',
    midLine: '⬅ মিরপুর-১০  |  তেজগাঁও ➡',
    bottomLine: 'MOHAKHALI  •  GULSHAN  •  TEJGAON',
    bg: '#065f46',
  },
  {
    topLine: '⬆ ফার্মগেট  •  কারওয়ান বাজার',
    midLine: '⬅ ধানমন্ডি-২৭  |  হাতিরঝিল ➡',
    bottomLine: 'FARMGATE  •  DHANMONDI  •  HATIRJHEEL',
    bg: '#1e3a8a',
  },
  {
    topLine: '⬆ শাহবাগ  •  ঢাকা বিশ্ববিদ্যালয়',
    midLine: '⬅ নিউমার্কেট  |  পল্টন ➡',
    bottomLine: 'SHAHBAG  •  NEW MARKET  •  PALTAN',
    bg: '#065f46',
  },
  {
    topLine: '⬆ গুলিস্তান জিরো পয়েন্ট  •  মতিঝিল',
    midLine: '⬅ সদরঘাট  |  কমলাপুর ➡',
    bottomLine: 'GULISTAN  •  MOTIJHEEL  •  SADARGHAT',
    bg: '#1e3a8a',
  },
  {
    topLine: '⬆ উত্তরা উত্তর  •  এয়ারপোর্ট রোড',
    midLine: '⬅ আগারগাঁও  |  বনানী ➡',
    bottomLine: 'UTTARA  •  AIRPORT  •  BANANI',
    bg: '#065f46',
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
  { badge: 'LEFT', title: 'বাম লেনে চলুন', sub: 'KEEP LEFT • রিকশা ও সাইকেল বামে', bg: '#1e3a8a', border: '#fde047' },
  { badge: '40', title: 'সর্বোচ্চ গতি ৪০', sub: 'হিরো বাইকারদের জন্য প্রযোজ্য নয়!', bg: '#ffffff', border: '#dc2626' },
  { badge: 'MRT-6', title: 'সামনে মেট্রো স্টেশন', sub: 'চলন্ত সিঁড়ি ও যাত্রী পারাপার', bg: '#065f46', border: '#4ade80' },
];

