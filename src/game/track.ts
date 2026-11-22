export type TrackLayer =
  | 'surface'
  | 'elevated_expressway'
  | 'banani_exit_ramp'
  | 'kuril_300ft_ramp'
  | 'airport_gazipur_direct'
  | 'uttara_tongi_flyover';

export type TrackDistrictId =
  | 'tejgaon'
  | 'mohakhali'
  | 'banani'
  | 'kurmitola'
  | 'purbachal_300ft'
  | 'balu_river'
  | 'neela_market'
  | 'kanchan_bridge'
  | 'dhaka_bypass'
  | 'gazipur'
  | 'board_bazar'
  | 'tongi_turag'
  | 'uttara'
  | 'airport'
  | 'mrt6';

export type RoadProfileKind = 'standard' | 'purbachal_300ft' | 'dhaka_bypass';

export interface RoadProfileSample {
  kind: RoadProfileKind;
  halfWidth: number;
  medianHalfWidth: number;
  hasServiceSeparators: boolean;
  serviceSepInnerLat: number;
  serviceSepOuterLat: number;
  shoulderExtra: number;
  perimeterLat: number;
  buildingDensity: 'urban' | 'sparse' | 'open_green';
}

export interface TrackSegmentBase {
  index: number;
  kind: 'line' | 'arc';
  startS: number;
  length: number;
  endS: number;
  district: TrackDistrictId;
  labelBn: string;
}

export interface LineSegment extends TrackSegmentBase {
  kind: 'line';
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  yaw: number;
}

export interface ArcSegment extends TrackSegmentBase {
  kind: 'arc';
  cx: number;
  cz: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  angleDir: 1 | -1; // +1 = CW in (X,Z) right turn; -1 = CCW in (X,Z) left turn
  turnLabelBn: string;
}

export type TrackSegment = LineSegment | ArcSegment;

export interface TrackPose {
  x: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  yaw: number;
  segIdx: number;
}

export interface TrackProjection extends TrackPose {
  s: number;
  lat: number;
  distSq: number;
}

export interface RiverSpanOnTrack {
  id: 'balu' | 'shitalakshya' | 'turag';
  nameBn: string;
  startS: number;
  endS: number;
  midS: number;
  width: number;
  deckHalfWidth: number;
}

export interface ZoneLabelBand {
  minS: number;
  maxS: number;
  labelBn: string;
}

const R = 95;
const ARC_LEN = (Math.PI / 2) * R; // ~149.22565m

function makeLine(
  index: number,
  startS: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  district: TrackDistrictId,
  labelBn: string
): LineSegment {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const length = Math.hypot(dx, dz);
  const tx = dx / length;
  const tz = dz / length;
  const nx = -tz;
  const nz = tx;
  return {
    index,
    kind: 'line',
    startS,
    length,
    endS: startS + length,
    district,
    labelBn,
    x0,
    z0,
    x1,
    z1,
    tx,
    tz,
    nx,
    nz,
    yaw: Math.atan2(-tx, -tz),
  };
}

function makeArc(
  index: number,
  startS: number,
  cx: number,
  cz: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  angleDir: 1 | -1,
  district: TrackDistrictId,
  labelBn: string,
  turnLabelBn: string
): ArcSegment {
  const length = Math.abs(endAngle - startAngle) * radius;
  return {
    index,
    kind: 'arc',
    startS,
    length,
    endS: startS + length,
    district,
    labelBn,
    cx,
    cz,
    radius,
    startAngle,
    endAngle,
    angleDir,
    turnLabelBn,
  };
}

function buildSegments(): TrackSegment[] {
  const segs: TrackSegment[] = [];
  let s = 0;

  // 0: Leg 1 (North -Z): Tejgaon (0,0) -> Satrasta -> Mohakhali -> Banani -> Kurmitola (0,-760)
  const seg0 = makeLine(0, s, 0, 0, 0, -760, 'tejgaon', 'তেজগাঁও – মহাখালী – বনানী – কুর্মিটোলা');
  segs.push(seg0);
  s = seg0.endS; // 760

  // 1: Curve 1 (90° Right North->East) at Kurmitola / Kuril Flyover -> (95, -855)
  const seg1 = makeArc(
    1,
    s,
    95,
    -760,
    R,
    Math.PI,
    1.5 * Math.PI,
    1,
    'kurmitola',
    'কুর্মিটোলা – কুড়িল ফ্লাইওভার ৯০° মোড়',
    'ডানে ৯০° মোড়: পূর্বাচল ৩০০ ফিট'
  );
  segs.push(seg1);
  s = seg1.endS; // 909.23

  // 2: Leg 2 (East +X): Massive 12-Lane Purbachal 300 Feet Expressway (2.6 km) -> Balu -> Neela Market -> Kanchan Bridge (2695, -855)
  const seg2 = makeLine(
    2,
    s,
    95,
    -855,
    2695,
    -855,
    'purbachal_300ft',
    'পূর্বাচল ৩০০ ফিট (৩৬ জুলাই এক্সপ্রেসওয়ে) • নীলা মার্কেট • কাঞ্চন ব্রিজ'
  );
  segs.push(seg2);
  s = seg2.endS; // 3509.23

  // 3: Curve 2 (90° Left East->North) after Kanchan Bridge onto Dhaka Bypass N105 -> (2790, -950)
  const seg3 = makeArc(
    3,
    s,
    2695,
    -950,
    R,
    0.5 * Math.PI,
    0,
    -1,
    'kanchan_bridge',
    'কাঞ্চন ব্রিজ → ঢাকা বাইপাস মোড়',
    'বামে ৯০° মোড়: ঢাকা বাইপাস (N105)'
  );
  segs.push(seg3);
  s = seg3.endS; // 3658.45

  // 4: Leg 3 (North -Z): Long Dhaka Bypass Expressway N105 (2.4 km) -> Rupganj -> Bhogra (2790, -3350)
  const seg4 = makeLine(
    4,
    s,
    2790,
    -950,
    2790,
    -3350,
    'dhaka_bypass',
    'ঢাকা বাইপাস (N105) • রূপগঞ্জ – ভোগড়া'
  );
  segs.push(seg4);
  s = seg4.endS; // 6058.45

  // 5: Curve 3 (90° Left North->West) Bhogra Bypass -> Gazipur Road (2695, -3445)
  const seg5 = makeArc(
    5,
    s,
    2695,
    -3350,
    R,
    0,
    -0.5 * Math.PI,
    -1,
    'gazipur',
    'ভোগড়া বাইপাস → গাজীপুর চৌরাস্তা মোড়',
    'বামে ৯০° মোড়: গাজীপুর চৌরাস্তা'
  );
  segs.push(seg5);
  s = seg5.endS; // 6207.68

  // 6: Leg 4 (West -X): Bhogra -> Gazipur Chourasta (Jagroto Chowrongi) (2.6 km) -> (95, -3445)
  const seg6 = makeLine(6, s, 2695, -3445, 95, -3445, 'gazipur', 'গাজীপুর চৌরাস্তা • জাগ্রত চৌরঙ্গী');
  segs.push(seg6);
  s = seg6.endS; // 8807.68

  // 7: Curve 4 (90° Left West->South) Gazipur Chourasta -> Board Bazar / Tongi (0, -3350)
  const seg7 = makeArc(
    7,
    s,
    95,
    -3350,
    R,
    -0.5 * Math.PI,
    -Math.PI,
    -1,
    'board_bazar',
    'গাজীপুর চৌরাস্তা → বোর্ড বাজার মোড়',
    'বামে ৯০° মোড়: বোর্ড বাজার – টঙ্গী'
  );
  segs.push(seg7);
  s = seg7.endS; // 8956.90

  // 8: Leg 5 (South +Z): Board Bazar -> Tongi -> Uttara-Tongi Flyover (Turag) -> Uttara -> Airport (2.175 km) (0, -1175)
  const seg8 = makeLine(8, s, 0, -3350, 0, -1175, 'uttara', 'বোর্ড বাজার – টঙ্গী ফ্লাইওভার – উত্তরা');
  segs.push(seg8);
  s = seg8.endS; // 11131.90

  // 9: Curve 5 (90° Right South->West) at Hazrat Shahjalal Airport -> (-95, -1080)
  const seg9 = makeArc(
    9,
    s,
    -95,
    -1175,
    R,
    0,
    0.5 * Math.PI,
    1,
    'airport',
    'হযরত শাহজালাল বিমানবন্দর মোড়',
    'ডানে ৯০° মোড়: উত্তরা উত্তর মেট্রো'
  );
  segs.push(seg9);
  s = seg9.endS; // 11281.13

  // 10: Leg 6 (West -X): Airport -> Diabari / Uttara North MRT-6 (-545, -1080)
  const seg10 = makeLine(10, s, -95, -1080, -545, -1080, 'airport', 'বিমানবন্দর – দিয়াবাড়ি লিংক');
  segs.push(seg10);
  s = seg10.endS; // 11731.13

  // 11: Curve 6 (90° Left West->South) into MRT-6 Corridor -> (-640, -985)
  const seg11 = makeArc(
    11,
    s,
    -545,
    -985,
    R,
    -0.5 * Math.PI,
    -Math.PI,
    -1,
    'mrt6',
    'উত্তরা উত্তর (দিয়াবাড়ি) মেট্রো প্রবেশ',
    'বামে ৯০° মোড়: মেট্রোরেল (MRT-6)'
  );
  segs.push(seg11);
  s = seg11.endS; // 11880.36

  // 12: Leg 7 (South +Z): Dhaka Metro Rail MRT-6 Corridor (Uttara North -> Mirpur-10 -> Farmgate) (-640, 0)
  const seg12 = makeLine(12, s, -640, -985, -640, 0, 'mrt6', 'ঢাকা মেট্রো রেল (MRT-6) • মিরপুর-১০ – ফার্মগেট');
  segs.push(seg12);
  s = seg12.endS; // 12865.36

  // 13: Curve 7 (90° Left South->East) Farmgate Metro -> Bijoy Sarani (-545, 95)
  const seg13 = makeArc(
    13,
    s,
    -545,
    0,
    R,
    Math.PI,
    0.5 * Math.PI,
    -1,
    'mrt6',
    'ফার্মগেট মেট্রো – বিজয় সরণি মোড়',
    'বামে ৯০° মোড়: বিজয় সরণি – তেজগাঁও'
  );
  segs.push(seg13);
  s = seg13.endS; // 13014.58

  // 14: Leg 8 (East +X): Bijoy Sarani -> Tejgaon Link (-95, 95)
  const seg14 = makeLine(14, s, -545, 95, -95, 95, 'tejgaon', 'বিজয় সরণি – তেজগাঁও লিংক রোড');
  segs.push(seg14);
  s = seg14.endS; // 13464.58

  // 15: Curve 8 (90° Left East->North) back into Tejgaon Hero Showroom (0, 0)
  const seg15 = makeArc(
    15,
    s,
    -95,
    0,
    R,
    0.5 * Math.PI,
    0,
    -1,
    'tejgaon',
    'তেজগাঁও ফেরা • নিলয় হিরো ফ্ল্যাগশিপ',
    'বামে ৯০° মোড়: তেজগাঁও হিরো শোরুম'
  );
  segs.push(seg15);

  return segs;
}

export const TRACK_SEGMENTS: readonly TrackSegment[] = buildSegments();
export const TRACK_LOOP_LENGTH: number = TRACK_SEGMENTS[TRACK_SEGMENTS.length - 1].endS; // ~13,613.81m (13.6 km)
export const TRACK_CURVE_RADIUS = R;
export const TRACK_ARC_LEN = ARC_LEN;

// 3 Real River Channels along the loop
export const TRACK_RIVER_SPANS: readonly RiverSpanOnTrack[] = [
  {
    id: 'balu',
    nameBn: 'বালু নদী ব্রিজ • পূর্বাচল ৩০০ ফিট',
    startS: 1785,
    endS: 1815,
    midS: 1800,
    width: 30,
    deckHalfWidth: 27.5,
  },
  {
    id: 'shitalakshya',
    nameBn: 'শীতলক্ষ্যা নদী • নারায়ণগঞ্জ কাঞ্চন ব্রিজ',
    startS: 3365,
    endS: 3441,
    midS: 3403,
    width: 76,
    deckHalfWidth: 13.5,
  },
  {
    id: 'turag',
    nameBn: 'তুরাগ নদী • টঙ্গী ব্রিজ',
    startS: 10050,
    endS: 10126,
    midS: 10088,
    width: 76,
    deckHalfWidth: 9.6,
  },
];

// Key track landmarks in s across the 13.6 km corridor
export const TRACK_LANDMARKS_S = {
  TEJGAON_ARCH_S: 18,
  TEJGAON_SHOWROOM_S: 48,
  SATRASTA_INTERSECTION_S: 140,
  MOHAKHALI_TERMINAL_S: 235,
  EXPRESSWAY_CLIMB_S: 260,
  BANANI_DOWN_RAMP_START_S: 440,
  BANANI_DOWN_RAMP_END_S: 592,
  TEJGAON_PUMP_S: 604, // Banani–Kakoli pump right after Banani down-ramp
  ARMY_CANTONMENT_S: 640, // Dhaka Cantonment (Army) Gate
  NAVY_HQ_S: 676, // Bangladesh Navy Headquarters
  KURMITOLA_HOSPITAL_S: 710, // Kurmitola General Hospital
  KURIL_RAMP_START_S: 718, // Kuril Flyover Up-Ramp onto 300ft
  KURMITOLA_TURN_S: 760,
  PURBACHAL_ARCH_S: 1065,
  BASHUNDHARA_RA_S: 1320, // Bashundhara Residential Area alongside 300ft
  PURBACHAL_PUMP_S: 1460,
  BALU_BRIDGE_S: 1800,
  NEELA_MARKET_S: 2580,
  NEELA_PUMP_S: 2780,
  KANCHAN_BRIDGE_S: 3403,
  BYPASS_RUPGANJ_PUMP_S: 4150,
  BYPASS_INTERSECTION_S: 4680,
  BYPASS_PUMP_S: 5480,
  GAZIPUR_EAST_INTERSECTION_S: 6850,
  GAZIPUR_PUMP_S: 7250,
  GAZIPUR_CHOURASTA_S: 7720,
  BOARD_BAZAR_SHOWROOM_S: 8360,
  BOARD_BAZAR_PUMP_S: 9280,
  UTTARA_FLYOVER_START_S: 9780,
  UTTARA_FLYOVER_END_S: 10400,
  UTTARA_PUMP_S: 10680,
  UTTARA_INTERSECTION_S: 10940,
  AIRPORT_TERMINAL_S: 11206,
  MRT_UTTARA_NORTH_S: 12020,
  MRT_MIRPUR_10_S: 12280,
  MRT_INTERSECTION_S: 12440,
  MRT_PUMP_S: 12560,
  MRT_FARMGATE_S: 12720,
} as const;

// Elevated Expressway Spur (North along X = 0: Mohakhali Z=-260 -> Optional Banani Down-Ramp Z=-440..-592 -> Kawla Toll Z=-895 -> Airport Curve Z=-1080)
export const ELEVATED_EXPRESSWAY_DEF = {
  id: 'elevated_expressway' as const,
  startZ: -260, // Gentle 90m climb starting after Mohakhali Terminal
  deckStartZ: -350,
  deckEndZ: -990,
  endZ: -1080, // Gentle 90m descent landing straight at Airport Interchange (-95..0, Z=-1080)
  deckHeight: 6.5,
  tollPlazaZ: -895, // Kawla Toll Plaza north of Kuril
  rampLeftMinX: -9.2,
  rampLeftMaxX: -4.2,
  rampRightMinX: 4.2,
  rampRightMaxX: 9.2,
  deckMinX: -9.2,
  deckMaxX: 9.2,
  // Optional Banani Exit Down-Ramp: 152m 3-phase Y-fork branching LEFT clear of main deck before descending to Airport Rd
  bananiExitStartZ: -440,
  bananiExitForkClearZ: -482,
  bananiExitEndZ: -592,
  bananiEntryZoneMinX: -17.5,
  bananiEntryZoneMaxX: -3.4,
} as const;

// Uttara-Tongi Flyover along Leg 5 (s = 9780..10400 -> 620m long over Tongi & Turag River)
export const UTTARA_TONGI_FLYOVER_DEF = {
  id: 'uttara_tongi_flyover' as const,
  startS: 9780,
  deckStartS: 9865, // 85m gentle climb
  deckEndS: 10315,
  endS: 10400, // 85m gentle descent
  deckHeight: 5.9,
  rampLeftMinLat: -9.0,
  rampLeftMaxLat: -4.2,
  rampRightMinLat: 4.2,
  rampRightMaxLat: 9.0,
  deckMinLat: -9.0,
  deckMaxLat: 9.0,
} as const;

function smoothstep01(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(0.0001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Per-track-position Road Geometry & Environment Profile:
// - Purbachal 300 Feet Road (s ∈ [910, 3330]): Massive 55m wide (±27.5m) 12-lane highway with
//   wide green center tree island (10.4m) + left/right service tree medians (3m each) + sparse open green environment!
// - Dhaka Bypass N105 (s ∈ [3330, 6100]): Wide 27m (±13.5m) 6-lane rural expressway with 4m tree median & sparse buildings!
// - Urban Dhaka Arterial Segments: Standard ±9.6m 4-lane highway with 1.44m divider & dense urban buildings.
export function getRoadProfileAtS(s: number): RoadProfileSample {
  const ws = wrapTrackS(s);

  // Purbachal 300 Feet Expressway zone (Leg 2: s = 909.23 .. 3509.23, tapering before Kanchan Bridge at 3365)
  if (ws >= 909 && ws <= 3340) {
    const flareIn = smoothstep01(910, 1040, ws);
    const taperOut = 1 - smoothstep01(3190, 3330, ws);
    const blend = Math.min(flareIn, taperOut);

    const endBaseHW = ws > 2200 ? 13.5 : 9.6;
    const endBaseMed = ws > 2200 ? 2.0 : 0.72;
    const halfWidth = endBaseHW + (27.5 - endBaseHW) * blend;
    const medianHalfWidth = endBaseMed + (5.2 - endBaseMed) * blend;

    const hasServiceSeparators = blend > 0.78;
    return {
      kind: 'purbachal_300ft',
      halfWidth,
      medianHalfWidth,
      hasServiceSeparators,
      serviceSepInnerLat: 17.5,
      serviceSepOuterLat: 20.5,
      shoulderExtra: 18,
      perimeterLat: 56,
      buildingDensity: 'open_green',
    };
  }

  // Kanchan Bridge + Dhaka Bypass N105 + Bhogra approach (s = 3340 .. 6200)
  if (ws > 3340 && ws <= 6210) {
    const taperGazipur = 1 - smoothstep01(6040, 6200, ws);
    const halfWidth = 9.6 + (13.5 - 9.6) * taperGazipur;
    const medianHalfWidth = 0.72 + (2.0 - 0.72) * taperGazipur;
    return {
      kind: 'dhaka_bypass',
      halfWidth,
      medianHalfWidth,
      hasServiceSeparators: false,
      serviceSepInnerLat: 0,
      serviceSepOuterLat: 0,
      shoulderExtra: 14,
      perimeterLat: 42,
      buildingDensity: 'sparse',
    };
  }

  return {
    kind: 'standard',
    halfWidth: 9.6,
    medianHalfWidth: 0.72,
    hasServiceSeparators: false,
    serviceSepInnerLat: 0,
    serviceSepOuterLat: 0,
    shoulderExtra: 10,
    perimeterLat: 32,
    buildingDensity: 'urban',
  };
}

// Helper for multi-lane traffic placement & obstacle bounds across standard, Bypass, and 300ft highways
export function getTrafficLaneLat(s: number, dirSign: 1 | -1, slotNorm: number): number {
  // dirSign: -1 = keep-left forward (+s), +1 = oncoming (-s)
  const prof = getRoadProfileAtS(s);
  if (prof.kind === 'purbachal_300ft' && prof.hasServiceSeparators) {
    // 4 Express lanes [5.2..17.5] + 2 Service lanes [20.5..27.5] = 6 lanes per side!
    const offsets = [6.8, 9.8, 12.8, 15.8, 22.3, 25.4];
    const idx = Math.min(offsets.length - 1, Math.floor(slotNorm * offsets.length));
    return dirSign * offsets[idx];
  }
  if (prof.halfWidth >= 12.2) {
    // Wide 3-lane per side (transition or Dhaka Bypass)
    const offsets = [3.8, 7.2, 10.6];
    const idx = Math.min(offsets.length - 1, Math.floor(slotNorm * offsets.length));
    return dirSign * offsets[idx];
  }
  // Standard 2-lane per side
  const offsets = [3.25, 6.75];
  const idx = Math.min(offsets.length - 1, Math.floor(slotNorm * offsets.length));
  return dirSign * offsets[idx];
}

export function wrapTrackS(s: number): number {
  let w = s % TRACK_LOOP_LENGTH;
  if (w < 0) w += TRACK_LOOP_LENGTH;
  return w;
}

export function shortestTrackDeltaS(targetS: number, refS: number): number {
  let d = wrapTrackS(targetS) - wrapTrackS(refS);
  const half = TRACK_LOOP_LENGTH * 0.5;
  if (d > half) d -= TRACK_LOOP_LENGTH;
  if (d < -half) d += TRACK_LOOP_LENGTH;
  return d;
}

export function forwardTrackDistanceS(fromS: number, toS: number): number {
  let d = wrapTrackS(toS) - wrapTrackS(fromS);
  if (d < 0) d += TRACK_LOOP_LENGTH;
  return d;
}

export function findSegmentIndexAtS(s: number): number {
  const ws = wrapTrackS(s);
  for (let i = 0; i < TRACK_SEGMENTS.length; i++) {
    if (ws <= TRACK_SEGMENTS[i].endS) return i;
  }
  return TRACK_SEGMENTS.length - 1;
}

export function sampleSegmentPose(seg: TrackSegment, localS: number, lat: number, out: TrackPose): TrackPose {
  const clampedS = Math.max(0, Math.min(seg.length, localS));
  if (seg.kind === 'line') {
    out.x = seg.x0 + seg.tx * clampedS + seg.nx * lat;
    out.z = seg.z0 + seg.tz * clampedS + seg.nz * lat;
    out.tx = seg.tx;
    out.tz = seg.tz;
    out.nx = seg.nx;
    out.nz = seg.nz;
    out.yaw = seg.yaw;
    out.segIdx = seg.index;
    return out;
  }

  const angle = seg.startAngle + seg.angleDir * (clampedS / seg.radius);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const tx = seg.angleDir * -sinA;
  const tz = seg.angleDir * cosA;
  const nx = -tz;
  const nz = tx;

  out.x = seg.cx + seg.radius * cosA + nx * lat;
  out.z = seg.cz + seg.radius * sinA + nz * lat;
  out.tx = tx;
  out.tz = tz;
  out.nx = nx;
  out.nz = nz;
  out.yaw = Math.atan2(-tx, -tz);
  out.segIdx = seg.index;
  return out;
}

export function sampleTrackPose(
  s: number,
  lat: number,
  out: TrackPose = {
    x: 0,
    z: 0,
    tx: 0,
    tz: -1,
    nx: 1,
    nz: 0,
    yaw: 0,
    segIdx: 0,
  }
): TrackPose {
  const ws = wrapTrackS(s);
  const idx = findSegmentIndexAtS(ws);
  const seg = TRACK_SEGMENTS[idx];
  return sampleSegmentPose(seg, ws - seg.startS, lat, out);
}

function projectToSegment(seg: TrackSegment, px: number, pz: number, out: TrackProjection): void {
  if (seg.kind === 'line') {
    const vx = px - seg.x0;
    const vz = pz - seg.z0;
    const localS = Math.max(0, Math.min(seg.length, vx * seg.tx + vz * seg.tz));
    const cx = seg.x0 + seg.tx * localS;
    const cz = seg.z0 + seg.tz * localS;
    const dx = px - cx;
    const dz = pz - cz;
    out.s = seg.startS + localS;
    out.lat = dx * seg.nx + dz * seg.nz;
    out.distSq = dx * dx + dz * dz;
    out.x = cx;
    out.z = cz;
    out.tx = seg.tx;
    out.tz = seg.tz;
    out.nx = seg.nx;
    out.nz = seg.nz;
    out.yaw = seg.yaw;
    out.segIdx = seg.index;
    return;
  }

  const vx = px - seg.cx;
  const vz = pz - seg.cz;
  let angle = Math.atan2(vz, vx);
  const midAngle = (seg.startAngle + seg.endAngle) * 0.5;
  while (angle - midAngle > Math.PI) angle -= Math.PI * 2;
  while (angle - midAngle < -Math.PI) angle += Math.PI * 2;
  const minA = Math.min(seg.startAngle, seg.endAngle);
  const maxA = Math.max(seg.startAngle, seg.endAngle);
  const clampedA = Math.max(minA, Math.min(maxA, angle));
  const localS = Math.abs(clampedA - seg.startAngle) * seg.radius;

  const cosA = Math.cos(clampedA);
  const sinA = Math.sin(clampedA);
  const cx = seg.cx + seg.radius * cosA;
  const cz = seg.cz + seg.radius * sinA;
  const tx = seg.angleDir * -sinA;
  const tz = seg.angleDir * cosA;
  const nx = -tz;
  const nz = tx;
  const dx = px - cx;
  const dz = pz - cz;

  out.s = seg.startS + localS;
  out.lat = dx * nx + dz * nz;
  out.distSq = dx * dx + dz * dz;
  out.x = cx;
  out.z = cz;
  out.tx = tx;
  out.tz = tz;
  out.nx = nx;
  out.nz = nz;
  out.yaw = Math.atan2(-tx, -tz);
  out.segIdx = seg.index;
}

const _projTmp: TrackProjection = {
  s: 0,
  lat: 0,
  distSq: Infinity,
  x: 0,
  z: 0,
  tx: 0,
  tz: -1,
  nx: 1,
  nz: 0,
  yaw: 0,
  segIdx: 0,
};

export function projectToTrack(
  px: number,
  pz: number,
  hintSegIdx = -1,
  out: TrackProjection = {
    s: 0,
    lat: 0,
    distSq: Infinity,
    x: 0,
    z: 0,
    tx: 0,
    tz: -1,
    nx: 1,
    nz: 0,
    yaw: 0,
    segIdx: 0,
  }
): TrackProjection {
  const n = TRACK_SEGMENTS.length;
  out.distSq = Infinity;

  if (hintSegIdx >= 0 && hintSegIdx < n) {
    for (let offset = -1; offset <= 1; offset++) {
      const idx = (hintSegIdx + offset + n) % n;
      projectToSegment(TRACK_SEGMENTS[idx], px, pz, _projTmp);
      if (_projTmp.distSq < out.distSq) {
        Object.assign(out, _projTmp);
      }
    }
    if (out.distSq < 34 * 34) {
      return out;
    }
  }

  for (let i = 0; i < n; i++) {
    projectToSegment(TRACK_SEGMENTS[i], px, pz, _projTmp);
    if (_projTmp.distSq < out.distSq) {
      Object.assign(out, _projTmp);
    }
  }
  return out;
}

// Elevated Expressway height & slope sampling along North axis (X=0, Z in [-260, -1080])
export function sampleExpresswayMainHeight(z: number): {
  y: number;
  slopeRad: number;
  zone: 'entry' | 'deck' | 'exit' | 'none';
} {
  const sp = ELEVATED_EXPRESSWAY_DEF;
  if (z > sp.startZ || z < sp.endZ) {
    return { y: 0, slopeRad: 0, zone: 'none' };
  }
  if (z >= sp.deckStartZ) {
    const len = sp.startZ - sp.deckStartZ;
    const t = Math.min(1, Math.max(0, (sp.startZ - z) / len));
    const smooth = t * t * (3 - 2 * t);
    const dydNegZ = (sp.deckHeight * 6 * t * (1 - t)) / len;
    return { y: sp.deckHeight * smooth, slopeRad: Math.atan(dydNegZ), zone: 'entry' };
  }
  if (z >= sp.deckEndZ) {
    return { y: sp.deckHeight, slopeRad: 0, zone: 'deck' };
  }
  const len = sp.deckEndZ - sp.endZ;
  const t = Math.min(1, Math.max(0, (sp.deckEndZ - z) / len));
  const smooth = t * t * (3 - 2 * t);
  const dydNegZ = -(sp.deckHeight * 6 * t * (1 - t)) / len;
  return { y: sp.deckHeight * (1 - smooth), slopeRad: Math.atan(dydNegZ), zone: 'exit' };
}

// Smooth 152m 3-phase Banani Exit Down-Ramp:
// Phase 1 (Z = -440 .. -482): branches LEFT from deck (-6.2 -> -14.6) at deck height (6.5m) until 100% clear of main deck (-9.2)
// Phase 2 (Z = -473 .. -568): descends gently parallel outside main expressway (centerX = -14.6, y = 6.5 -> 0)
// Phase 3 (Z = -565 .. -592): merges smoothly back onto Airport Rd left carriageway (-14.6 -> -6.7, y = 0)
function sampleBananiYAtT(t: number, deckHeight: number): number {
  const tDescStart = 0.22;
  const tDescEnd = 0.84;
  if (t <= tDescStart) return deckHeight;
  if (t >= tDescEnd) return 0;
  const u = (t - tDescStart) / (tDescEnd - tDescStart);
  const smooth = u * u * (3 - 2 * u);
  return deckHeight * (1 - smooth);
}

export function sampleBananiDownRamp(z: number): {
  y: number;
  slopeRad: number;
  centerX: number;
  halfWidth: number;
  active: boolean;
} {
  const sp = ELEVATED_EXPRESSWAY_DEF;
  if (z > sp.bananiExitStartZ || z < sp.bananiExitEndZ) {
    return { y: 0, slopeRad: 0, centerX: -6.7, halfWidth: 2.6, active: false };
  }
  const len = sp.bananiExitStartZ - sp.bananiExitEndZ; // 152m
  const t = Math.min(1, Math.max(0, (sp.bananiExitStartZ - z) / len));
  const y = sampleBananiYAtT(t, sp.deckHeight);

  // Accurate central difference derivative along travel direction (-Z)
  const dtStep = 0.25 / len;
  const tAhead = Math.min(1, t + dtStep);
  const tBehind = Math.max(0, t - dtStep);
  const spanM = Math.max(0.01, (tAhead - tBehind) * len);
  const dydNegZ = (sampleBananiYAtT(tAhead, sp.deckHeight) - sampleBananiYAtT(tBehind, sp.deckHeight)) / spanM;

  let centerX = -14.6;
  let halfWidth = 2.6;
  if (t <= 0.28) {
    const u1 = t / 0.28;
    const s1 = u1 * u1 * (3 - 2 * u1);
    centerX = -6.2 - 8.4 * s1;
    halfWidth = 3.0 - 0.4 * s1;
  } else if (t >= 0.82) {
    const u3 = (t - 0.82) / 0.18;
    const s3 = u3 * u3 * (3 - 2 * u3);
    centerX = -14.6 + 7.9 * s3;
  }

  return {
    y,
    slopeRad: Math.atan(dydNegZ),
    centerX,
    halfWidth,
    active: true,
  };
}

// Uttara-Tongi Flyover height & slope along Leg 5 (s = 9780 .. 10400)
export function sampleUttaraFlyoverHeight(s: number): {
  y: number;
  slopeRad: number;
  zone: 'entry' | 'deck' | 'exit' | 'none';
} {
  const sp = UTTARA_TONGI_FLYOVER_DEF;
  if (s < sp.startS || s > sp.endS) {
    return { y: 0, slopeRad: 0, zone: 'none' };
  }
  if (s <= sp.deckStartS) {
    const len = sp.deckStartS - sp.startS;
    const t = Math.min(1, Math.max(0, (s - sp.startS) / len));
    const smooth = t * t * (3 - 2 * t);
    const dydS = (sp.deckHeight * 6 * t * (1 - t)) / len;
    return { y: sp.deckHeight * smooth, slopeRad: Math.atan(dydS), zone: 'entry' };
  }
  if (s <= sp.deckEndS) {
    return { y: sp.deckHeight, slopeRad: 0, zone: 'deck' };
  }
  const len = sp.endS - sp.deckEndS;
  const t = Math.min(1, Math.max(0, (s - sp.deckEndS) / len));
  const smooth = t * t * (3 - 2 * t);
  const dydS = -(sp.deckHeight * 6 * t * (1 - t)) / len;
  return { y: sp.deckHeight * (1 - smooth), slopeRad: Math.atan(dydS), zone: 'exit' };
}

// Drivable Kuril Flyover Ramp: climbs left off Airport Rd after Kurmitola Hospital (Z=-714),
// clears OVER the 6.5m Elevated Expressway at y=9.4m, curves 90deg East, and descends onto Purbachal 300ft (X=242, Z=-864.5)
export const KURIL_300FT_RAMP_DEF = {
  id: 'kuril_300ft_ramp' as const,
  startZ: -714,
  endX: 242,
  endZ: -864.5,
  deckHeight: 9.4,
  halfWidth: 2.8,
  endTrackS: 1056.2, // S coordinate on Leg 2 (95 + (242 - 95) = 242 -> 909.23 + 147 = 1056.2)
  endTrackLat: -9.5, // Lands cleanly in keep-left Purbachal 300ft Express lane!
} as const;

export interface KurilRampSample {
  u: number;
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  yaw: number;
  slopeRad: number;
  halfWidth: number;
  dist: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function buildKurilRampSamples(): KurilRampSample[] {
  const ctrl: [number, number][] = [
    [-7.2, -654],  // phantom prior tangent straight North
    [-7.2, -714],  // P0: ground mouth on Airport Rd left carriageway
    [-14.8, -776], // P1: flares clear left of Elevated Expressway (-9.2)
    [-6.0, -838],  // P2: elevated y=9.4 turning East above Elevated Expressway
    [86.0, -864.5],// P3: sweeping onto 300ft axis
    [242.0, -864.5],// P4: smooth landing on Purbachal 300ft
    [350.0, -864.5],// phantom end tangent straight East
  ];
  const rawCount = 72;
  const pts: { x: number; z: number; dist: number }[] = [];
  let totalDist = 0;
  const segCount = 4; // P0..P4
  for (let i = 0; i <= rawCount; i++) {
    const g = (i / rawCount) * segCount;
    const si = Math.min(segCount - 1, Math.floor(g));
    const lt = g - si;
    const p0 = ctrl[si];
    const p1 = ctrl[si + 1];
    const p2 = ctrl[si + 2];
    const p3 = ctrl[si + 3];
    const x = catmullRom(p0[0], p1[0], p2[0], p3[0], lt);
    const z = catmullRom(p0[1], p1[1], p2[1], p3[1], lt);
    if (i > 0) {
      totalDist += Math.hypot(x - pts[i - 1].x, z - pts[i - 1].z);
    }
    pts.push({ x, z, dist: totalDist });
  }

  const evalY = (u: number): number => {
    const climbEnd = 0.28;
    const descStart = 0.64;
    const descEnd = 0.96;
    if (u <= climbEnd) {
      const k = u / climbEnd;
      return KURIL_300FT_RAMP_DEF.deckHeight * (k * k * (3 - 2 * k));
    }
    if (u <= descStart) return KURIL_300FT_RAMP_DEF.deckHeight;
    if (u >= descEnd) return 0;
    const k = (u - descStart) / (descEnd - descStart);
    return KURIL_300FT_RAMP_DEF.deckHeight * (1 - k * k * (3 - 2 * k));
  };

  const samples: KurilRampSample[] = [];
  for (let i = 0; i <= rawCount; i++) {
    const u = totalDist > 0 ? pts[i].dist / totalDist : i / rawCount;
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(rawCount, i + 1)];
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.max(0.001, Math.hypot(dx, dz));
    const tx = dx / len;
    const tz = dz / len;
    const nx = -tz;
    const nz = tx;

    const uPrev = totalDist > 0 ? prev.dist / totalDist : Math.max(0, i - 1) / rawCount;
    const uNext = totalDist > 0 ? next.dist / totalDist : Math.min(1, i + 1) / rawCount;
    const spanD = Math.max(0.01, next.dist - prev.dist);
    const dydD = (evalY(uNext) - evalY(uPrev)) / spanD;

    samples.push({
      u,
      x: pts[i].x,
      y: evalY(u),
      z: pts[i].z,
      tx,
      tz,
      nx,
      nz,
      yaw: Math.atan2(-tx, -tz),
      slopeRad: Math.atan(dydD),
      halfWidth: KURIL_300FT_RAMP_DEF.halfWidth,
      dist: pts[i].dist,
    });
  }
  return samples;
}

export const KURIL_RAMP_SAMPLES: readonly KurilRampSample[] = buildKurilRampSamples();
export const KURIL_RAMP_TOTAL_LENGTH = KURIL_RAMP_SAMPLES[KURIL_RAMP_SAMPLES.length - 1].dist;

export function sampleKuril300ftRampByU(u: number): KurilRampSample {
  const cu = Math.max(0, Math.min(1, u));
  const arr = KURIL_RAMP_SAMPLES;
  for (let i = 0; i < arr.length - 1; i++) {
    if (cu <= arr[i + 1].u || i === arr.length - 2) {
      const span = Math.max(0.0001, arr[i + 1].u - arr[i].u);
      const t = Math.max(0, Math.min(1, (cu - arr[i].u) / span));
      const a = arr[i];
      const b = arr[i + 1];
      const tx = a.tx + (b.tx - a.tx) * t;
      const tz = a.tz + (b.tz - a.tz) * t;
      const tLen = Math.max(0.001, Math.hypot(tx, tz));
      const ntx = tx / tLen;
      const ntz = tz / tLen;
      return {
        u: cu,
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        tx: ntx,
        tz: ntz,
        nx: -ntz,
        nz: ntx,
        yaw: Math.atan2(-ntx, -ntz),
        slopeRad: a.slopeRad + (b.slopeRad - a.slopeRad) * t,
        halfWidth: a.halfWidth,
        dist: a.dist + (b.dist - a.dist) * t,
      };
    }
  }
  return arr[arr.length - 1];
}

export function projectToKurilRamp(px: number, pz: number): {
  sample: KurilRampSample;
  lat: number;
  distSq: number;
} {
  const arr = KURIL_RAMP_SAMPLES;
  let bestDistSq = Infinity;
  let bestU = 0;
  let bestLat = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i];
    const b = arr[i + 1];
    const segDx = b.x - a.x;
    const segDz = b.z - a.z;
    const segLenSq = Math.max(0.0001, segDx * segDx + segDz * segDz);
    const t = Math.max(0, Math.min(1, ((px - a.x) * segDx + (pz - a.z) * segDz) / segLenSq));
    const cx = a.x + segDx * t;
    const cz = a.z + segDz * t;
    const dx = px - cx;
    const dz = pz - cz;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestU = a.u + (b.u - a.u) * t;
      const len = Math.sqrt(segLenSq);
      const nx = -segDz / len;
      const nz = segDx / len;
      bestLat = dx * nx + dz * nz;
    }
  }
  return {
    sample: sampleKuril300ftRampByU(bestU),
    lat: bestLat,
    distSq: bestDistSq,
  };
}

export function isSInAnyRiver(s: number, pad = 2): RiverSpanOnTrack | null {
  const ws = wrapTrackS(s);
  for (const r of TRACK_RIVER_SPANS) {
    if (ws >= r.startS - pad && ws <= r.endS + pad) {
      return r;
    }
  }
  return null;
}

export const TRACK_ZONE_BANDS: readonly ZoneLabelBand[] = [
  { minS: 0, maxS: 110, labelBn: 'তেজগাঁও • নিলয় হিরো ফ্ল্যাগশিপ (৮৮ তাজউদ্দিন এভ.)' },
  { minS: 110, maxS: 220, labelBn: 'তেজগাঁও সাতরাস্তা – নাবিস্কো' },
  { minS: 220, maxS: 380, labelBn: 'মহাখালী বাস টার্মিনাল • এক্সপ্রেসওয়ে র‍্যাম্প' },
  { minS: 380, maxS: 592, labelBn: 'বনানী – কাকলী (এক্সপ্রেসওয়ে ডাউন-র‍্যাম্প)' },
  { minS: 592, maxS: 760, labelBn: 'ঢাকা ক্যান্টনমেন্ট • নৌবাহিনী সদর • কুর্মিটোলা হাসপাতাল' },
  { minS: 760, maxS: 920, labelBn: 'কুড়িল ফ্লাইওভার → পূর্বাচল ৩০০ ফিট সংযোগ' },
  { minS: 920, maxS: 1785, labelBn: 'পূর্বাচল ৩০০ ফিট • বসুন্ধরা R/A (১২-লেন এক্সপ্রেসওয়ে)' },
  { minS: 1785, maxS: 1815, labelBn: 'বালু নদী ব্রিজ • পূর্বাচল ৩০০ ফিট' },
  { minS: 1815, maxS: 2520, labelBn: 'পূর্বাচল ৩০০ ফিট • হাউজিং এস্টেট ও গ্রোভ' },
  { minS: 2520, maxS: 2740, labelBn: 'নীলা মার্কেট • পূর্বাচল ৩০০ ফিট' },
  { minS: 2740, maxS: 3365, labelBn: 'পূর্বাচল ৩০০ ফিট ➔ কাঞ্চন ব্রিজ অ্যাপ্রোচ' },
  { minS: 3365, maxS: 3441, labelBn: 'নারায়ণগঞ্জ কাঞ্চন ব্রিজ • শীতলক্ষ্যা নদী' },
  { minS: 3441, maxS: 3660, labelBn: 'কাঞ্চন মোড় → ঢাকা বাইপাস (N105)' },
  { minS: 3660, maxS: 6060, labelBn: 'ঢাকা বাইপাস এক্সপ্রেসওয়ে (N105) • রূপগঞ্জ – ভোগড়া' },
  { minS: 6060, maxS: 8810, labelBn: 'গাজীপুর চৌরাস্তা • জাগ্রত চৌরঙ্গী' },
  { minS: 8810, maxS: 9780, labelBn: 'বোর্ড বাজার • নিলয় হিরো গাজীপুর হাব' },
  { minS: 9780, maxS: 10050, labelBn: 'টঙ্গী – বিশ্ব ইজতেমা ময়দান' },
  { minS: 10050, maxS: 10126, labelBn: 'তুরাগ নদী • টঙ্গী ব্রিজ' },
  { minS: 10126, maxS: 11132, labelBn: 'উত্তরা • আব্দুল্লাহপুর – আজমপুর – জসীমউদ্দিন' },
  { minS: 11132, maxS: 11732, labelBn: 'হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর' },
  { minS: 11732, maxS: 12180, labelBn: 'উত্তরা উত্তর (দিয়াবাড়ি) মেট্রো স্টেশন (MRT-6)' },
  { minS: 12180, maxS: 12640, labelBn: 'মিরপুর-১০ • ঢাকা মেট্রো রেল (MRT-6)' },
  { minS: 12640, maxS: 13015, labelBn: 'ফার্মগেট মেট্রো স্টেশন (MRT-6)' },
  { minS: 13015, maxS: 13700, labelBn: 'বিজয় সরণি • তেজগাঁও হিরো শোরুম ফেরা' },
];

export function getZoneLabelForTrack(s: number, zWorld: number, layer: TrackLayer): string {
  if (layer === 'elevated_expressway') {
    if (zWorld > -484) return 'ঢাকা এলিভেটেড এক্সপ্রেসওয়ে (মহাখালী → বনানী এক্সিট)';
    if (zWorld > -810) return 'ঢাকা এলিভেটেড এক্সপ্রেসওয়ে (কুর্মিটোলা ওপর)';
    return 'ঢাকা এলিভেটেড এক্সপ্রেসওয়ে (কাওলা টোল → বিমানবন্দর)';
  }
  if (layer === 'banani_exit_ramp') {
    return 'বনানী এক্সিট ডাউন-র‍্যাম্প ↓ (ক্যান্টনমেন্ট • নৌবাহিনী • হাসপাতাল)';
  }
  if (layer === 'kuril_300ft_ramp') {
    return 'কুড়িল ফ্লাইওভার র‍্যাম্প ↑↓ (পূর্বাচল ৩০০ ফিট সংযোগ)';
  }
  if (layer === 'airport_gazipur_direct') {
    return 'সোজা গাজীপুর রুট • কুড়িল → কাওলা → বিমানবন্দর';
  }
  if (layer === 'uttara_tongi_flyover') {
    return 'উত্তরা–টঙ্গী ফ্লাইওভার (তুরাগ নদী ওপর)';
  }

  const ws = wrapTrackS(s);
  for (const b of TRACK_ZONE_BANDS) {
    if (ws >= b.minS && ws < b.maxS) return b.labelBn;
  }
  return 'ডিটিএ • ঢাকা হাইওয়ে';
}

export function getTurnCueForRider(
  s: number,
  zWorld: number,
  layer: TrackLayer,
  playerX: number
): string | null {
  if (layer === 'elevated_expressway') {
    if (zWorld <= -350 && zWorld >= -484) {
      return playerX < -4.2
        ? '↙ বামের খোলা পথে নামুন: বনানী এক্সিট র‍্যাম্প ↓'
        : '↙ বামে যান: বনানী এক্সিট (ক্যান্টনমেন্ট/৩০০ ফিট) | সোজা ↑ এয়ারপোর্ট';
    }
    if (zWorld < -790 && zWorld >= -995) {
      return 'কাওলা টোল প্লাজা সামনে • বিমানবন্দর নামার র‍্যাম্প';
    }
    return null;
  }
  if (layer === 'banani_exit_ramp') {
    return 'বনানী র‍্যাম্পে নামছেন ↓ সামনে ক্যান্টনমেন্ট, নৌবাহিনী সদর ও হাসপাতাল';
  }
  if (layer === 'kuril_300ft_ramp') {
    return 'কুড়িল ফ্লাইওভার দিয়ে নামছেন ↱ সামনে পূর্বাচল ৩০০ ফিট ও বসুন্ধরা R/A!';
  }
  if (layer === 'airport_gazipur_direct') {
    return 'সোজা গাজীপুর এক্সপ্রেস রুট ↑ বিমানবন্দর → উত্তরা → টঙ্গী → গাজীপুর';
  }

  const ws = wrapTrackS(s);
  if (ws >= 220 && ws <= 275) {
    return 'বাম/ডান র‍্যাম্প: ঢাকা এলিভেটেড এক্সপ্রেসওয়ে ↑';
  }
  if (ws >= 615 && ws < 745) {
    return '↙ বামের র‍্যাম্পে উঠলে ৩০০ ফিট | ↑ সোজা গেলে বিমানবন্দর–গাজীপুর!';
  }
  if (ws >= 3410 && ws < 3525) {
    return 'সামনে বামে ৯০° মোড় ↰ ঢাকা বাইপাস (N105)';
  }
  if (ws >= 5960 && ws < 6075) {
    return 'সামনে বামে ৯০° মোড় ↰ গাজীপুর চৌরাস্তা';
  }
  if (ws >= 8700 && ws < 8820) {
    return 'সামনে বামে ৯০° মোড় ↰ বোর্ড বাজার – টঙ্গী';
  }
  if (ws >= 9740 && ws <= 9800) {
    return 'বাম/ডান র‍্যাম্প: উত্তরা–টঙ্গী ফ্লাইওভার ↑';
  }
  if (ws >= 11030 && ws < 11145) {
    return 'সামনে বিমানবন্দর: ডানে ৯০° মোড় ↱ মেট্রোরেল (MRT-6)';
  }
  if (ws >= 11640 && ws < 11745) {
    return 'সামনে বামে ৯০° মোড় ↰ উত্তরা উত্তর মেট্রো (MRT-6)';
  }
  if (ws >= 12770 && ws < 12880) {
    return 'সামনে বামে ৯০° মোড় ↰ বিজয় সরণি – তেজগাঁও';
  }
  if (ws >= 13370 && ws < 13480) {
    return 'সামনে বামে ৯০° মোড় ↰ তেজগাঁও নিলয় হিরো শোরুম';
  }
  return null;
}
