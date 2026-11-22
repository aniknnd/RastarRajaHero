import * as THREE from 'three';
import {
  CNG_BACK_SIGNS,
  DHAKA_DIRECTION_SIGNS,
  DHAKA_ROAD_SIGNS,
  NITOL_NILOY_SIGNS,
  REAL_TRAFFIC_SIGNS,
  RICKSHAW_BACK_SIGNS,
} from './types';

export interface ProceduralTextureSet {
  road: THREE.CanvasTexture;
  purbachalExpressRoad: THREE.CanvasTexture;
  purbachalServiceRoad: THREE.CanvasTexture;
  cityRoad: THREE.CanvasTexture;
  zebra: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  fuelPad: THREE.CanvasTexture;
  fuelCanopySign: THREE.CanvasTexture;
  showroomPad: THREE.CanvasTexture;
  showroomFacadeSign: THREE.CanvasTexture;
  showroomBanner: THREE.CanvasTexture;
  showroomPylonSign: THREE.CanvasTexture;
  metroBanner: THREE.CanvasTexture;
  metroStationBoards: THREE.CanvasTexture[];
  escalatorSign: THREE.CanvasTexture;
  directionSigns: THREE.CanvasTexture[];
  dhakaArchBanner: THREE.CanvasTexture;
  tongSign: THREE.CanvasTexture;
  pillarSign: THREE.CanvasTexture;
  metroTrainSide: THREE.CanvasTexture;
  busNitol: THREE.CanvasTexture;
  busNitolStaff: THREE.CanvasTexture;
  busBrtc: THREE.CanvasTexture;
  busHanif: THREE.CanvasTexture;
  busShohag: THREE.CanvasTexture;
  doubleDeckerLivery: THREE.CanvasTexture;
  coveredVanLivery: THREE.CanvasTexture;
  cementMixerLivery: THREE.CanvasTexture;
  oilTankerLivery: THREE.CanvasTexture;
  fireTruckLivery: THREE.CanvasTexture;
  policeLivery: THREE.CanvasTexture;
  rabLivery: THREE.CanvasTexture;
  armyLivery: THREE.CanvasTexture;
  ambulanceLivery: THREE.CanvasTexture;
  legunaLivery: THREE.CanvasTexture;
  truckArt: THREE.CanvasTexture;
  rickshawBacks: THREE.CanvasTexture[];
  cngBacks: THREE.CanvasTexture[];
  vangariBack: THREE.CanvasTexture;
  heroTank: THREE.CanvasTexture;
  heroTankXtreme: THREE.CanvasTexture;
  heroTankKarizma: THREE.CanvasTexture;
  buildingFacades: THREE.CanvasTexture[];
  shopSigns: THREE.CanvasTexture[];
  roadSigns: THREE.CanvasTexture[];
  jokeSigns: THREE.Texture[];
  trafficControlSigns: THREE.CanvasTexture[];
  accidentSloganSign: THREE.CanvasTexture;
  expresswayDeck: THREE.CanvasTexture;
  expresswayTollSign: THREE.CanvasTexture;
  rampEntranceSign: THREE.CanvasTexture;
  turagRiverWater: THREE.CanvasTexture;
  ijtemaSign: THREE.CanvasTexture;
  airportSign: THREE.CanvasTexture;
  jagrataPlaqueSign: THREE.CanvasTexture;
  mohakhaliTerminalSign: THREE.CanvasTexture;
  purbachalArchSign: THREE.CanvasTexture;
  neelaMarketSign: THREE.CanvasTexture;
  neelaStallSigns: THREE.CanvasTexture[];
  kanchanBridgeSign: THREE.CanvasTexture;
  baluBridgeSign: THREE.CanvasTexture;
  shitalakshyaWater: THREE.CanvasTexture;
  bananiExitSign: THREE.CanvasTexture;
  bananiRampPortalSign: THREE.CanvasTexture;
  bananiExitDeckArrows: THREE.CanvasTexture;
  kurilTurnSign: THREE.CanvasTexture;
  kurilForkPortalSign: THREE.CanvasTexture;
  kurilRampPortalSign: THREE.CanvasTexture;
  armyCantonmentSign: THREE.CanvasTexture;
  navyHqSign: THREE.CanvasTexture;
  kurmitolaHospitalSign: THREE.CanvasTexture;
  bashundharaSign: THREE.CanvasTexture;
  housingBillboards: THREE.CanvasTexture[];
  dhakaBypassSign: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function makeLiveryTexture(
  aniso: number,
  bg: string,
  stripe: string,
  title: string,
  sub: string,
  fg: string
): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(512, 192);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 192);
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 128, 512, 34);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(24, 18, 464, 54);
  ctx.fillStyle = '#64748b';
  for (let x = 36; x < 460; x += 68) {
    ctx.fillRect(x, 24, 52, 42);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.font = 'bold 40px "Noto Sans Bengali", "Chakra Petch", sans-serif';
  ctx.fillText(title, 256, 102);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 21px "Chakra Petch", "Noto Sans Bengali", sans-serif';
  ctx.fillText(sub, 256, 145);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const aniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const allTextures: THREE.CanvasTexture[] = [];
  const track = <T extends THREE.CanvasTexture>(t: T): T => {
    allTextures.push(t);
    return t;
  };

  // 1. Road asphalt
  const roadTex = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#2d3138';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 4200; i++) {
      const x = (i * 73) % 512;
      const y = (i * 197 + Math.floor(i / 7) * 13) % 512;
      const v = 40 + ((i * 29) % 24);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(x, y, 2, 2);
    }

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(16, 0, 10, 512);
    ctx.fillRect(486, 0, 10, 512);

    ctx.fillStyle = '#facc15';
    ctx.fillRect(236, 0, 6, 512);
    ctx.fillRect(270, 0, 6, 512);

    ctx.fillStyle = '#f1f5f9';
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(126, y, 8, 36);
      ctx.fillRect(378, y, 8, 36);
    }

    ctx.fillStyle = 'rgba(18, 20, 24, 0.22)';
    ctx.fillRect(68, 0, 26, 512);
    ctx.fillRect(182, 0, 26, 512);
    ctx.fillRect(310, 0, 26, 512);
    ctx.fillRect(422, 0, 26, 512);

    return track(finalizeColorTexture(c, aniso, 1, 16));
  })();

  // 1a-2. Purbachal 300ft 4-Lane Unidirectional Express Carriageway Asphalt
  const purbachalExpressRoad = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#272b33';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 4200; i++) {
      const x = (i * 79) % 512;
      const y = (i * 191 + Math.floor(i / 5) * 17) % 512;
      const v = 36 + ((i * 23) % 22);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Continuous outer edge stripes (white + yellow express median border)
    ctx.fillStyle = '#facc15';
    ctx.fillRect(10, 0, 10, 512);
    ctx.fillRect(492, 0, 10, 512);

    // 3 dashed white lane dividers = 4 wide express lanes!
    ctx.fillStyle = '#f8fafc';
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(128, y, 8, 36);
      ctx.fillRect(252, y, 8, 36);
      ctx.fillRect(376, y, 8, 36);
    }

    // Subtle tire tracks
    ctx.fillStyle = 'rgba(15, 18, 22, 0.20)';
    for (const tx of [54, 178, 304, 428]) {
      ctx.fillRect(tx, 0, 24, 512);
    }

    return track(finalizeColorTexture(c, aniso, 1, 16));
  })();

  // 1a-3. Purbachal 300ft 2-Lane Outer Service Road Asphalt
  const purbachalServiceRoad = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#313640';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1200; i++) {
      const x = (i * 59) % 256;
      const y = (i * 109) % 256;
      const v = 45 + ((i * 19) % 18);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(8, 0, 6, 256);
    ctx.fillRect(242, 0, 6, 256);
    ctx.fillStyle = '#f8fafc';
    for (let y = 12; y < 256; y += 64) {
      ctx.fillRect(124, y, 7, 36);
    }
    return track(finalizeColorTexture(c, aniso, 1, 16));
  })();

  // 1b. Side Avenue / Cross Street 2-lane Dhaka Asphalt
  const cityRoadTex = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#333842';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1200; i++) {
      const x = (i * 53) % 256;
      const y = (i * 113) % 256;
      const v = 46 + ((i * 19) % 18);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(6, 0, 6, 256);
    ctx.fillRect(244, 0, 6, 256);
    ctx.fillStyle = '#facc15';
    for (let y = 12; y < 256; y += 64) {
      ctx.fillRect(124, y, 8, 36);
    }
    return track(finalizeColorTexture(c, aniso, 1, 10));
  })();

  // 2. Zebra crossing
  const zebraTex = (() => {
    const [c, ctx] = makeCanvas(512, 128);
    ctx.fillStyle = '#2d3138';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#f8fafc';
    for (let x = 20; x < 490; x += 44) {
      ctx.fillRect(x, 12, 25, 104);
    }
    return track(finalizeColorTexture(c, aniso));
  })();

  // 3. Sidewalk tiles
  const sidewalkTex = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      for (let x = 0; x < 256; x += 32) {
        ctx.fillStyle = ((x + y) / 32) % 2 === 0 ? '#b91c1c' : '#94a3b8';
        ctx.fillRect(x + 2, y + 2, 28, 28);
      }
    }
    for (let y = 0; y < 256; y += 64) {
      ctx.fillStyle = (y / 64) % 2 === 0 ? '#facc15' : '#111827';
      ctx.fillRect(0, y, 22, 64);
    }
    return track(finalizeColorTexture(c, aniso, 1, 16));
  })();

  // 4. Fuel stopping pad
  const fuelPadTex = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 18;
    ctx.strokeRect(14, 14, 484, 484);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(42, 42, 428, 428);
    ctx.fillStyle = '#052e16';
    ctx.fillRect(62, 62, 388, 388);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 64px "Noto Sans Bengali", sans-serif';
    ctx.fillText('তেল পাম্প', 256, 170);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ধীরে থামুন', 256, 265);
    ctx.fillStyle = '#86efac';
    ctx.font = 'bold 40px "Chakra Petch", sans-serif';
    ctx.fillText('STOP TO REFUEL', 256, 355);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 5. Fuel Canopy Sign
  const fuelCanopySign = (() => {
    const [c, ctx] = makeCanvas(512, 128);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 96, 512, 32);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 42px "Noto Sans Bengali", sans-serif';
    ctx.fillText('হিরো তেল স্টেশন • পেট্রোল পাম্প', 256, 48);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px "Chakra Petch", sans-serif';
    ctx.fillText('NITOL-NILOY FUEL STOP  •  24H PETROL & OCTANE', 256, 112);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 5b. Niloy Hero Showroom Pad (512x1536 -> matches 5.8x18 bay cleanly, zero stretch)
  const showroomPad = (() => {
    const [c, ctx] = makeCanvas(512, 1536);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 512, 1536);

    // Outer crimson & gold checkered safety border
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 28;
    ctx.strokeRect(14, 14, 484, 1508);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 10;
    ctx.strokeRect(36, 36, 440, 1464);

    // Inner dark metallic tarmac bay
    ctx.fillStyle = '#090d16';
    ctx.fillRect(54, 54, 404, 1428);

    // Top & Bottom entry chevrons
    ctx.fillStyle = '#22c55e';
    for (const cy of [170, 260, 1276, 1366]) {
      ctx.beginPath();
      ctx.moveTo(140, cy + 32);
      ctx.lineTo(256, cy - 22);
      ctx.lineTo(372, cy + 32);
      ctx.lineTo(372, cy + 56);
      ctx.lineTo(256, cy + 4);
      ctx.lineTo(140, cy + 56);
      ctx.closePath();
      ctx.fill();
    }

    // Center Hero Crest Badge
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(88, 430, 336, 150);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(88, 430, 336, 150);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 58px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিলয় হিরো', 256, 505);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বাইক শোরুম', 256, 675);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 34px "Chakra Petch", sans-serif';
    ctx.fillText('NILOY HERO', 256, 770);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 36px "Noto Sans Bengali", sans-serif';
    ctx.fillText('আপগ্রেড জোন', 256, 895);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    ctx.fillText('SLOW <= 25 KM/H', 256, 980);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 5c. Niloy Hero Showroom Facade Sign (1536x256 -> exact 6:1 match for 16.8x2.8 lightbox)
  const showroomFacadeSign = (() => {
    const [c, ctx] = makeCanvas(1536, 256);
    const bgGrad = ctx.createLinearGradient(0, 0, 1536, 256);
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(0.55, '#111827');
    bgGrad.addColorStop(1, '#450a0a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1536, 256);

    // Sleek racing accent stripes on right edge
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(1370, 0);
    ctx.lineTo(1536, 0);
    ctx.lineTo(1536, 256);
    ctx.lineTo(1310, 256);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 1536, 12);
    ctx.fillRect(0, 244, 1536, 12);

    // Hero Emblem Block on left
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(36, 36, 184, 184);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.strokeRect(36, 36, 184, 184);

    // Hero stylized "H" wing emblem
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(72, 62, 26, 90);
    ctx.fillRect(158, 62, 26, 90);
    ctx.fillRect(98, 96, 60, 22);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 30px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HERO', 128, 186);

    // Main Crisp Title
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 66px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিলয় হিরো ফ্ল্যাগশিপ শোরুম • তেজগাঁও', 790, 92);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 28px "Chakra Petch", sans-serif';
    ctx.fillText('88 SHAHID TAJUDDIN AHMED AVE, TEJGAON, DHAKA 1208  •  NILOY MOTORS LTD.', 790, 180);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 5d. Niloy Hero Showroom Offer Banner (1024x256 -> exact 4:1 match for 10.8x2.7 end gantry)
  const showroomBanner = (() => {
    const [c, ctx] = makeCanvas(1024, 256);
    const grad = ctx.createLinearGradient(0, 0, 1024, 256);
    grad.addColorStop(0, '#7f1d1d');
    grad.addColorStop(0.5, '#b91c1c');
    grad.addColorStop(1, '#111827');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 1004, 236);

    // Left Hero badge
    ctx.fillStyle = '#090d16';
    ctx.fillRect(30, 34, 150, 188);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 5;
    ctx.strokeRect(30, 34, 150, 188);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 46px "Chakra Petch", sans-serif';
    ctx.fillText('HERO', 105, 106);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 26px "Noto Sans Bengali", sans-serif';
    ctx.fillText('স্বাগতম', 105, 166);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 48px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিলয় হিরো • ৮৮ শহীদ তাজউদ্দিন এভিনিউ', 595, 84);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Noto Sans Bengali", sans-serif';
    ctx.fillText('১,০০,০০০-এ এক্সট্রিম ১৬০আর  •  ২,০০,০০০-এ কারিজমা ২১০!', 595, 160);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 21px "Chakra Petch", sans-serif';
    ctx.fillText('TEJGAON FLAGSHIP HUB  •  HIGHWAY TO GAZIPUR & MRT-6', 595, 212);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 5e. Roadside Niloy Hero Showroom Pylon Sign (384x768 -> 1:2 ratio)
  const showroomPylonSign = (() => {
    const [c, ctx] = makeCanvas(384, 768);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 384, 768);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, 364, 748);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(28, 30, 328, 170);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Chakra Petch", sans-serif';
    ctx.fillText('HERO', 192, 95);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 30px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিলয় মোটরস লি.', 192, 162);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিলয় হিরো', 192, 290);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Noto Sans Bengali", sans-serif';
    ctx.fillText('শোরুম', 192, 360);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(36, 430, 312, 190);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 430, 312, 190);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 30px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বাইক আপগ্রেড', 192, 490);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 28px "Chakra Petch", sans-serif';
    ctx.fillText('TIER 2: 100K', 192, 545);
    ctx.fillStyle = '#facc15';
    ctx.fillText('TIER 3: 200K', 192, 588);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText('স্বাগতম বস!', 192, 692);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 6. Dhaka Metro Rail Viaduct Banner
  const metroBanner = (() => {
    const [c, ctx] = makeCanvas(1024, 192);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 1024, 192);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 148, 1024, 44);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 1024, 12);
    for (const cx of [86, 938]) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, 76, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MRT-6', cx, 76);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ঢাকা মেট্রো রেল • DHAKA METRO RAIL', 512, 74);
    ctx.fillStyle = '#fef9c3';
    ctx.font = 'bold 26px "Noto Sans Bengali", sans-serif';
    ctx.fillText('উত্তরা উত্তর ⇄ মতিঝিল • দ্রুত, নিরাপদ ও আধুনিক ঢাকা', 512, 170);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 7. Official DMTCL MRT Line-6 Real Station Boards
  const stationDefs = [
    { bn: 'উত্তরা উত্তর (দিয়াবাড়ি)', en: 'UTTARA NORTH (DIABARI) • ঢাকা মেট্রো রেল (MRT-6)' },
    { bn: 'মিরপুর-১০ স্টেশন', en: 'MIRPUR-10 • ঢাকা মেট্রো রেল (MRT-6)' },
    { bn: 'ফার্মগেট স্টেশন', en: 'FARMGATE • তেজগাঁও সংযোগ • ঢাকা মেট্রো রেল (MRT-6)' },
  ];
  const metroStationBoards = stationDefs.map((st) => {
    const [c, ctx] = makeCanvas(1024, 224);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 224);
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, 0, 1024, 34);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 186, 1024, 38);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 1008, 208);

    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(100, 112, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(100, 112, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillText('MRT-6', 100, 112);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 66px "Noto Sans Bengali", sans-serif';
    ctx.fillText(st.bn, 560, 94);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Chakra Petch", "Noto Sans Bengali", sans-serif';
    ctx.fillText(st.en, 560, 158);
    return track(finalizeColorTexture(c, aniso));
  });

  // 8. Escalator Entry Portal Sign ("চলন্ত সিঁড়ি • ESCALATOR")
  const escalatorSign = (() => {
    const [c, ctx] = makeCanvas(512, 160);
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 148);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 40px "Noto Sans Bengali", sans-serif';
    ctx.fillText('▲ চলন্ত সিঁড়ি • প্রবেশ', 256, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    ctx.fillText('METRO ESCALATOR  |  PLATFORM', 256, 114);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 9. Dhaka Highway Directional Gantry Signs (Mohakhali, Gulistan, Farmgate, Shahbag, Uttara)
  const directionSigns = DHAKA_DIRECTION_SIGNS.map((d) => {
    const [c, ctx] = makeCanvas(768, 224);
    ctx.fillStyle = d.bg;
    ctx.fillRect(0, 0, 768, 224);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 748, 204);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(10, 82, 748, 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 38px "Noto Sans Bengali", sans-serif';
    ctx.fillText(d.topLine, 384, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Noto Sans Bengali", sans-serif';
    ctx.fillText(d.midLine, 384, 126);
    ctx.fillStyle = '#bbf7d0';
    ctx.font = 'bold 22px "Chakra Petch", sans-serif';
    ctx.fillText(d.bottomLine, 384, 182);
    return track(finalizeColorTexture(c, aniso));
  });

  // 10. Colorful Dhaka Welcome Toran / Rickshaw-Art Arch Banner
  const dhakaArchBanner = (() => {
    const [c, ctx] = makeCanvas(1024, 192);
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#be123c');
    grad.addColorStop(0.5, '#065f46');
    grad.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 192);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 1008, 176);

    const flowerColors = ['#facc15', '#38bdf8', '#f472b6', '#4ade80'];
    for (let i = 0; i < 4; i++) {
      const fx = i < 2 ? 78 + i * 74 : 872 + (i - 2) * 74;
      ctx.fillStyle = flowerColors[i];
      ctx.beginPath();
      ctx.arc(fx, 96, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(fx, 96, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('তেজগাঁও ⇄ গাজীপুর ⇄ পূর্বাচল ⇄ কাঞ্চন ব্রিজ', 512, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 23px "Noto Sans Bengali", sans-serif';
    ctx.fillText('মহাখালী এক্সপ্রেসওয়ে • বিমানবন্দর • ৩০০ ফিট • নীলা মার্কেট • মেট্রোরেল', 512, 138);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 11. Colorful Tong (Tea Stall) Sign
  const tongSign = (() => {
    const [c, ctx] = makeCanvas(512, 160);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 118, 512, 42);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Noto Sans Bengali", sans-serif';
    ctx.fillText('মামা চা ও সিঙ্গারা টং', 256, 62);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 24px "Noto Sans Bengali", sans-serif';
    ctx.fillText('গরম দুধ চা • বনরুটি • ঝালমুড়ি', 256, 139);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 12. Eye-level Metro Pillar Sign (Nitol-Niloy / Bangla)
  const pillarSign = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 240, 240);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(16, 16, 224, 62);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিটল-নিলয়', 128, 48);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 28px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ডিটিএ • ঢাকাতে আছি', 128, 126);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 21px "Chakra Petch", "Noto Sans Bengali", sans-serif';
    ctx.fillText('DTA - DHAKA TE ACHI', 128, 188);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 13. Metro Train Side
  const metroTrainSide = (() => {
    const [c, ctx] = makeCanvas(512, 128);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, 90, 512, 24);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 114, 512, 14);
    ctx.fillStyle = '#0f172a';
    for (let x = 22; x < 480; x += 62) {
      ctx.fillRect(x, 26, 44, 48);
    }
    return track(finalizeColorTexture(c, aniso));
  })();

  // 14. Liveried Buses & Nitol-Niloy Group Staff Bus
  const busNitol = track(
    makeLiveryTexture(aniso, '#1e3a8a', '#facc15', 'নিটল-নিলয় এক্সপ্রেস', 'NITOL-NILOY • HERO SPECIAL', '#ffffff')
  );
  const busNitolStaff = track(
    makeLiveryTexture(
      aniso,
      '#0f172a',
      '#dc2626',
      'নিটল-নিলয় স্টাফ বাস',
      'NITOL-NILOY GROUP • STAFF SERVICE',
      '#fde047'
    )
  );
  const busBrtc = track(
    makeLiveryTexture(aniso, '#dc2626', '#f8fafc', 'বিআরটিসি • BRTC', 'ঢাকা মহানগর সার্ভিস', '#fef08a')
  );
  const busHanif = track(
    makeLiveryTexture(aniso, '#0284c7', '#f97316', 'হানিফ এন্টারপ্রাইজ', 'HANIF • ঢাকা ⇄ চট্টগ্রাম', '#ffffff')
  );
  const busShohag = track(
    makeLiveryTexture(aniso, '#047857', '#fde047', 'সোহাগ পরিবহন', 'SHOHAG ELITE • ঢাকা', '#ffffff')
  );
  const doubleDeckerLivery = track(
    makeLiveryTexture(aniso, '#b91c1c', '#facc15', 'বিআরটিসি ডাবল ডেকার', 'BRTC DOUBLE-DECKER • ঢাকা', '#fef08a')
  );
  const coveredVanLivery = track(
    makeLiveryTexture(aniso, '#1e293b', '#38bdf8', 'নিলয় কার্গো কাভার্ড ভ্যান', 'NITOL-NILOY LOGISTICS • EXPRESS', '#f8fafc')
  );
  const cementMixerLivery = track(
    makeLiveryTexture(aniso, '#065f46', '#fde047', 'নিটল রেডিমিক্স সিমেন্ট', 'NITOL CEMENT MIXER • ঢাকা', '#ffffff')
  );
  const oilTankerLivery = track(
    makeLiveryTexture(aniso, '#c2410c', '#facc15', 'দাহ্য তেলের ট্যাংকার', 'DANGER • PETROL & OCTANE TANKER', '#ffffff')
  );
  const fireTruckLivery = track(
    makeLiveryTexture(aniso, '#dc2626', '#f8fafc', 'ফায়ার সার্ভিস • ৯৯৯', 'BANGLADESH FIRE SERVICE & CD', '#fef08a')
  );
  const policeLivery = track(
    makeLiveryTexture(aniso, '#1d4ed8', '#f8fafc', 'ডিএমপি পুলিশ • DMP', 'DHAKA METROPOLITAN POLICE', '#fef08a')
  );
  const rabLivery = track(
    makeLiveryTexture(aniso, '#111827', '#dc2626', 'র‍্যাব • RAB FORCE', 'RAPID ACTION BATTALION', '#ffffff')
  );
  const armyLivery = track(
    makeLiveryTexture(aniso, '#3f6212', '#1a2e05', 'বাংলাদেশ সেনাবাহিনী', 'BANGLADESH ARMY', '#fef9c3')
  );
  const ambulanceLivery = track(
    makeLiveryTexture(aniso, '#f8fafc', '#dc2626', 'জরুরি অ্যাম্বুলেন্স +', 'EMERGENCY AMBULANCE 999', '#dc2626')
  );
  const legunaLivery = track(
    makeLiveryTexture(aniso, '#0369a1', '#facc15', 'মহাখালী ⇄ গুলিস্তান', 'ঢাকা লেগুনা সার্ভিস', '#ffffff')
  );

  // 15. Bangladeshi Truck Art
  const truckArt = (() => {
    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(10, 10, 492, 236);
    ctx.fillStyle = '#be123c';
    ctx.fillRect(24, 24, 464, 208);
    const colors = ['#facc15', '#22c55e', '#38bdf8', '#ffffff'];
    for (let x = 64; x < 460; x += 96) {
      ctx.fillStyle = colors[(x / 96) % colors.length];
      ctx.beginPath();
      ctx.arc(x, 70, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x, 70, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px "Noto Sans Bengali", sans-serif';
    ctx.fillText('হিরো দেখলে সাইড দিন', 256, 165);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 15b. Rickshaw Back Art Plates ("বৌয়ের দোয়া পরিবহন" etc.)
  const rickshawBacks = RICKSHAW_BACK_SIGNS.map((r) => {
    const [c, ctx] = makeCanvas(384, 224);
    ctx.fillStyle = r.bg;
    ctx.fillRect(0, 0, 384, 224);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 368, 208);

    // Classic rickshaw flower garlands in corners
    const fCols = ['#22c55e', '#38bdf8', '#f472b6', '#facc15'];
    for (let i = 0; i < 4; i++) {
      const fx = i < 2 ? 36 : 348;
      const fy = i % 2 === 0 ? 36 : 188;
      ctx.fillStyle = fCols[i];
      ctx.beginPath();
      ctx.arc(fx, fy, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = r.fg;
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText(r.title, 192, 86);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px "Noto Sans Bengali", sans-serif';
    ctx.fillText(r.sub, 192, 152);
    return track(finalizeColorTexture(c, aniso));
  });

  // 15c. CNG Back Plates ("ভাই ভাই পরিবহন" etc.)
  const cngBacks = CNG_BACK_SIGNS.map((cg) => {
    const [c, ctx] = makeCanvas(384, 192);
    ctx.fillStyle = cg.bg;
    ctx.fillRect(0, 0, 384, 192);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 372, 180);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(14, 14, 356, 34);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ঢাকা মেট্রো-থ • সিএনজি অটো', 192, 31);
    ctx.fillStyle = cg.fg;
    ctx.font = 'bold 36px "Noto Sans Bengali", sans-serif';
    ctx.fillText(cg.title, 192, 96);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px "Noto Sans Bengali", sans-serif';
    ctx.fillText(cg.sub, 192, 148);
    return track(finalizeColorTexture(c, aniso));
  });

  // 15d. Van-Gari Back Sign
  const vangariBack = (() => {
    const [c, ctx] = makeCanvas(320, 160);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, 0, 320, 160);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 308, 148);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 32px "Noto Sans Bengali", sans-serif';
    ctx.fillText('গরীবের রকেট', 160, 60);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ধাক্কা দিলেই ডিম ভাজি!', 160, 114);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 16. Hero Tank Liveries (Tier 1 Glamour, Tier 2 Xtreme 160R, Tier 3 Karizma XMR 210)
  const heroTank = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 92, 256, 72);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 84, 256, 10);
    ctx.fillRect(0, 162, 256, 10);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px "Chakra Petch", sans-serif';
    ctx.fillText('HERO', 128, 120);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 16px "Chakra Petch", sans-serif';
    ctx.fillText('NILOY MOTORS', 128, 148);
    return track(finalizeColorTexture(c, aniso));
  })();

  const heroTankXtreme = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 74, 256, 108);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 92, 256, 72);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px "Chakra Petch", sans-serif';
    ctx.fillText('XTREME 160R', 128, 118);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 15px "Chakra Petch", sans-serif';
    ctx.fillText('NILOY HERO · TIER 2', 128, 148);
    return track(finalizeColorTexture(c, aniso));
  })();

  const heroTankKarizma = (() => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 72, 256, 112);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 88, 256, 80);
    ctx.fillStyle = '#34d399';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px "Chakra Petch", sans-serif';
    ctx.fillText('KARIZMA 210', 128, 118);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 15px "Chakra Petch", sans-serif';
    ctx.fillText('RAJA TITAN · TIER 3', 128, 148);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 17. Vibrant Colorful Dhaka Building Facades
  const facadeColors = [
    { wall: '#f87171', trim: '#991b1b', win: '#1e293b', balcony: '#fef08a' },
    { wall: '#38bdf8', trim: '#0369a1', win: '#0f172a', balcony: '#ffffff' },
    { wall: '#fbbf24', trim: '#b45309', win: '#1f2937', balcony: '#fef3c7' },
    { wall: '#34d399', trim: '#065f46', win: '#0f172a', balcony: '#ecfdf5' },
    { wall: '#fb7185', trim: '#be123c', win: '#1e293b', balcony: '#ffe4e6' },
    { wall: '#60a5fa', trim: '#1d4ed8', win: '#0f172a', balcony: '#fde047' },
    { wall: '#fb923c', trim: '#c2410c', win: '#1f2937', balcony: '#ffedd5' },
    { wall: '#f1f5f9', trim: '#0d9488', win: '#1e293b', balcony: '#f59e0b' },
  ];
  const buildingFacades = facadeColors.map((pal) => {
    const [c, ctx] = makeCanvas(256, 512);
    ctx.fillStyle = pal.wall;
    ctx.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 512; y += 85) {
      ctx.fillStyle = pal.trim;
      ctx.fillRect(0, y, 256, 12);
      for (let x = 18; x < 230; x += 58) {
        ctx.fillStyle = pal.win;
        ctx.fillRect(x, y + 20, 40, 44);
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(x + 4, y + 24, 14, 34);
        ctx.fillRect(x + 22, y + 24, 14, 34);
        ctx.fillStyle = pal.balcony;
        ctx.fillRect(x - 4, y + 64, 48, 8);
      }
    }
    return track(finalizeColorTexture(c, aniso));
  });

  // 18. Nitol-Niloy / Shop Signs
  const shopSigns = NITOL_NILOY_SIGNS.map((s) => {
    const [c, ctx] = makeCanvas(640, 192);
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, 640, 192);
    ctx.fillStyle = s.accent;
    ctx.fillRect(0, 0, 640, 14);
    ctx.fillRect(0, 178, 640, 14);
    ctx.strokeStyle = s.fg;
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 20, 620, 152);
    ctx.fillStyle = s.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 50px "Noto Sans Bengali", sans-serif';
    ctx.fillText(s.title, 320, 76);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Noto Sans Bengali", "Chakra Petch", sans-serif';
    ctx.fillText(s.sub, 320, 138);
    return track(finalizeColorTexture(c, aniso));
  });

  // 19. Funny Bangla Roadside Signs
  const roadSigns = DHAKA_ROAD_SIGNS.map((s) => {
    const [c, ctx] = makeCanvas(384, 300);
    ctx.fillStyle = '#fefce8';
    ctx.fillRect(0, 0, 384, 300);
    ctx.strokeStyle = s.accent;
    ctx.lineWidth = 20;
    ctx.strokeRect(14, 14, 356, 272);
    ctx.fillStyle = s.accent;
    ctx.fillRect(24, 24, 336, 52);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 25px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ঢাকা রাস্তার সতর্ক বার্তা', 192, 50);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 38px "Noto Sans Bengali", sans-serif';
    ctx.fillText(s.title, 192, 138, 336);
    ctx.fillStyle = s.accent;
    ctx.font = 'bold 24px "Noto Sans Bengali", sans-serif';
    ctx.fillText(s.sub, 192, 212, 336);
    return track(finalizeColorTexture(c, aniso));
  });

  const jokeSigns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16].map((number) => {
    const url = `${import.meta.env.BASE_URL}assets/jokes/Joke_${String(number).padStart(2, '0')}.png`;
    const tex = new THREE.TextureLoader().load(url, undefined, undefined, (error) => {
      console.error(`Failed to load roadside joke sign: ${url}`, error);
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    return tex;
  });

  // 19b. Official Dhaka Road Control Signs (STOP, KEEP LEFT, SPEED 40, MRT-6)
  const trafficControlSigns = REAL_TRAFFIC_SIGNS.map((ts) => {
    const [c, ctx] = makeCanvas(320, 320);
    ctx.fillStyle = ts.bg;
    ctx.fillRect(0, 0, 320, 320);
    ctx.strokeStyle = ts.border;
    ctx.lineWidth = 18;
    ctx.strokeRect(12, 12, 296, 296);

    ctx.fillStyle = ts.bg === '#ffffff' ? '#dc2626' : '#facc15';
    ctx.beginPath();
    ctx.arc(160, 102, 54, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ts.bg === '#ffffff' ? '#ffffff' : '#0f172a';
    ctx.font = 'bold 30px "Chakra Petch", sans-serif';
    ctx.fillText(ts.badge, 160, 102);

    ctx.fillStyle = ts.bg === '#ffffff' ? '#111827' : '#ffffff';
    ctx.font = 'bold 32px "Noto Sans Bengali", sans-serif';
    ctx.fillText(ts.title, 160, 200, 276);

    ctx.fillStyle = ts.bg === '#ffffff' ? '#b91c1c' : '#fde047';
    ctx.font = 'bold 20px "Noto Sans Bengali", sans-serif';
    ctx.fillText(ts.sub, 160, 255, 276);
    return track(finalizeColorTexture(c, aniso));
  });

  // 19c. Classic Bangladesh Highway Slogan Hoarding ("একটি দুর্ঘটনা সারা জীবনের কান্না")
  const accidentSloganSign = (() => {
    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, 496, 240);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(20, 20, 472, 42);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 23px "Noto Sans Bengali", sans-serif';
    ctx.fillText('সড়ক নিরাপত্তা সতর্কতা • ঢাকা', 256, 41);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('একটি দুর্ঘটনা', 256, 108, 460);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('সারা জীবনের কান্না', 256, 166, 460);
    ctx.fillStyle = '#fecaca';
    ctx.font = 'bold 20px "Noto Sans Bengali", sans-serif';
    ctx.fillText('সাবধানে বাইক চালান • নিরাপদ থাকুন', 256, 218, 460);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19d. Elevated Expressway & Flyover Asphalt Deck Texture
  const expresswayDeck = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3600; i++) {
      const x = (i * 67) % 512;
      const y = (i * 193) % 512;
      const v = 30 + ((i * 23) % 20);
      ctx.fillStyle = `rgb(${v},${v + 4},${v + 10})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(14, 0, 10, 512);
    ctx.fillRect(488, 0, 10, 512);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(242, 0, 7, 512);
    ctx.fillRect(263, 0, 7, 512);
    ctx.fillStyle = '#e2e8f0';
    for (let y = 16; y < 512; y += 64) {
      ctx.fillRect(128, y, 8, 36);
      ctx.fillRect(376, y, 8, 36);
    }
    return track(finalizeColorTexture(c, aniso, 1, 10));
  })();

  // 19e. Dhaka Elevated Expressway Toll Plaza Canopy Sign
  const expresswayTollSign = (() => {
    const [c, ctx] = makeCanvas(1024, 224);
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e3a8a');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 224);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 1024, 12);
    ctx.fillRect(0, 212, 1024, 12);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(24, 34, 180, 156);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 34, 180, 156);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Chakra Petch", sans-serif';
    ctx.fillText('DEE', 114, 96);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ফাস্ট-ট্র্যাক', 114, 150);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 54px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ঢাকা এলিভেটেড এক্সপ্রেসওয়ে', 610, 82);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 30px "Noto Sans Bengali", sans-serif';
    ctx.fillText('মহাখালী ➔ কাওলা বিমানবন্দর • ফ্রি ফাস্ট-ট্র্যাক!', 610, 156);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19f. Elevated Ramp Entrance Portal Sign
  const rampEntranceSign = (() => {
    const [c, ctx] = makeCanvas(512, 160);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 148);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 36px "Noto Sans Bengali", sans-serif';
    ctx.fillText('▲ এলিভেটেড র‍্যাম্প ↑', 256, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বাম/ডান র‍্যাম্প দিয়ে উপরে উঠুন • FLYOVER', 256, 114);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19g. Turag River Water Surface
  const turagRiverWater = (() => {
    const [c, ctx] = makeCanvas(512, 256);
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#0369a1');
    grad.addColorStop(0.5, '#0284c7');
    grad.addColorStop(1, '#0d9488');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(186, 230, 253, 0.25)';
    for (let y = 14; y < 256; y += 22) {
      for (let x = (y % 44 === 14 ? 10 : 35); x < 500; x += 68) {
        ctx.fillRect(x, y, 34, 4);
      }
    }
    return track(finalizeColorTexture(c, aniso, 10, 2));
  })();

  // 19h. Bishwa Ijtema Ground Banner Sign (Tongi Turag Bank)
  const ijtemaSign = (() => {
    const [c, ctx] = makeCanvas(640, 192);
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, 640, 192);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 624, 176);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বিশ্ব ইজতেমা ময়দান • টঙ্গী', 320, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Noto Sans Bengali", sans-serif';
    ctx.fillText('তুরাগ নদীর তীর • BISHWA IJTEMA GROUND', 320, 138);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19i. Hazrat Shahjalal International Airport (Kawla) Sign
  const airportSign = (() => {
    const [c, ctx] = makeCanvas(640, 192);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 640, 192);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 640, 14);
    ctx.fillRect(0, 178, 640, 14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 36px "Noto Sans Bengali", sans-serif';
    ctx.fillText('✈ হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর', 320, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Chakra Petch", sans-serif';
    ctx.fillText('HAZRAT SHAHJALAL INTL AIRPORT • KAWLA, DHAKA', 320, 136);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19j. Jagrata Chourangi (Gazipur Chourasta) Monument Plaque
  const jagrataPlaqueSign = (() => {
    const [c, ctx] = makeCanvas(512, 192);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 176);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 44px "Noto Sans Bengali", sans-serif';
    ctx.fillText('জাগ্রত চৌরঙ্গী • ১৯৭১', 256, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Noto Sans Bengali", sans-serif';
    ctx.fillText('গাজীপুর চৌরাস্তা • চন্দনা মোড়', 256, 132);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19k. Mohakhali Bus Terminal Sign
  const mohakhaliTerminalSign = (() => {
    const [c, ctx] = makeCanvas(768, 224);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 768, 224);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 768, 24);
    ctx.fillRect(0, 200, 768, 24);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 30, 744, 164);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 52px "Noto Sans Bengali", sans-serif';
    ctx.fillText('মহাখালী বাস টার্মিনাল • ঢাকা', 384, 88);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Noto Sans Bengali", sans-serif';
    ctx.fillText('MOHAKHALI BUS TERMINAL • এলিভেটেড এক্সপ্রেসওয়ে মুখ ↑', 384, 152);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19l. Purbachal 300 Feet Road Welcome Arch Sign
  const purbachalArchSign = (() => {
    const [c, ctx] = makeCanvas(1024, 224);
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#065f46');
    grad.addColorStop(0.5, '#047857');
    grad.addColorStop(1, '#0f766e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 224);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 1004, 204);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 54px "Noto Sans Bengali", sans-serif';
    ctx.fillText('পূর্বাচল ৩০০ ফিট রোড • ৩৬ জুলাই এক্সপ্রেসওয়ে', 512, 78);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বালু সেতু ➔ নীলা মার্কেট ➔ নারায়ণগঞ্জ কাঞ্চন ব্রিজ', 512, 152);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19m. Neela Market Main Overhead & Facade Banner
  const neelaMarketSign = (() => {
    const [c, ctx] = makeCanvas(896, 224);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, 0, 896, 224);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, 896, 20);
    ctx.fillRect(0, 204, 896, 20);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 28, 868, 168);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 54px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নীলা মার্কেট • পূর্বাচল ৩০০ ফিট', 448, 86);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Noto Sans Bengali", sans-serif';
    ctx.fillText('গরম হাঁসের মাংস • ভাপা-চিতই পিঠা • চায়ের আড্ডা (NEELA MARKET)', 448, 152);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19n. Neela Market Individual Food Stall Banners
  const neelaStallDefs = [
    { title: 'মামা হাঁসের মাংস ও ভুনা', sub: 'গরম চালের রুটি ও কালো ভুনা • পূর্বাচল', bg: '#991b1b' },
    { title: 'নীলা পিঠা ও বিরিয়ানি ঘর', sub: 'ভাপা • চিতই • পাটিসাপটা • দুধ চা', bg: '#065f46' },
    { title: '৩০০ ফিট কাবাব ও ফুচকা কর্নার', sub: 'নিরিবিলি খোলা আকাশ • নীলা মার্কেট', bg: '#1e3a8a' },
  ];
  const neelaStallSigns = neelaStallDefs.map((st) => {
    const [c, ctx] = makeCanvas(512, 160);
    ctx.fillStyle = st.bg;
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 148);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText(st.title, 256, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText(st.sub, 256, 114);
    return track(finalizeColorTexture(c, aniso));
  });

  // 19o. Narayanganj Kanchan Bridge Portal Sign
  const kanchanBridgeSign = (() => {
    const [c, ctx] = makeCanvas(896, 224);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 896, 224);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 896, 22);
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, 202, 896, 22);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 30, 868, 164);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 50px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নারায়ণগঞ্জ কাঞ্চন ব্রিজ • শীতলক্ষ্যা নদী', 448, 86);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Chakra Petch", "Noto Sans Bengali", sans-serif';
    ctx.fillText('NARAYANGANJ KANCHAN BRIDGE • রূপগঞ্জ ➔ তেজগাঁও রিটার্ন', 448, 150);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19p. Balu River Bridge Sign
  const baluBridgeSign = (() => {
    const [c, ctx] = makeCanvas(512, 160);
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 500, 148);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 38px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বালু নদী সেতু • পূর্বাচল', 256, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText('BALU RIVER BRIDGE • সামনে নীলা মার্কেট', 256, 114);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19q. Shitalakshya River Deep Emerald-Blue Water Texture
  const shitalakshyaWater = (() => {
    const [c, ctx] = makeCanvas(512, 256);
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#0f766e');
    grad.addColorStop(0.5, '#0284c7');
    grad.addColorStop(1, '#065f46');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(207, 250, 254, 0.24)';
    for (let y = 16; y < 256; y += 24) {
      for (let x = (y % 48 === 16 ? 12 : 40); x < 500; x += 72) {
        ctx.fillRect(x, y, 36, 4);
      }
    }
    return track(finalizeColorTexture(c, aniso, 10, 2));
  })();

  // 19r. Banani Optional Exit Down-Ramp Overhead Gantry
  const bananiExitSign = (() => {
    const [c, ctx] = makeCanvas(896, 200);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 896, 200);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 896, 14);
    ctx.fillRect(0, 186, 896, 14);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(18, 24, 396, 152);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 24, 396, 152);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText('↙ বামে নামুন: বনানী এক্সিট ↓', 216, 76);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText('কুর্মিটোলা • ৩০০ ফিট রোড (বাম পথ খোলা)', 216, 134);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 36px "Noto Sans Bengali", sans-serif';
    ctx.fillText('সোজা ↑: কাওলা • বিমানবন্দর', 656, 76);
    ctx.fillStyle = '#bbf7d0';
    ctx.font = 'bold 22px "Chakra Petch", sans-serif';
    ctx.fillText('STRAIGHT TO AIRPORT (DEE)', 656, 134);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19r-2. Banani Ramp Mouth Direct Portal Arch Sign
  const bananiRampPortalSign = (() => {
    const [c, ctx] = makeCanvas(640, 192);
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, 640, 192);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 640, 12);
    ctx.fillRect(0, 180, 640, 12);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 20, 612, 152);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 42px "Noto Sans Bengali", sans-serif';
    ctx.fillText('↙ বনানী এক্সিট র‍্যাম্প ↓', 320, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিচে নামুন • কুর্মিটোলা → ৩০০ ফিট', 320, 134);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19r-3. Transparent Pavement Left-Exit Arrows + Diagonal Warning Stripes
  const bananiExitDeckArrows = (() => {
    const [c, ctx] = makeCanvas(256, 512);
    ctx.clearRect(0, 0, 256, 512);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Repeating bright amber curved exit chevrons pointing forward-left (top of canvas = -Z ahead)
    const drawArrow = (cy: number) => {
      ctx.save();
      ctx.translate(128, cy);
      ctx.rotate(-0.34);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.lineTo(42, -2);
      ctx.lineTo(18, -2);
      ctx.lineTo(18, 48);
      ctx.lineTo(-18, 48);
      ctx.lineTo(-18, -2);
      ctx.lineTo(-42, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    drawArrow(96);
    drawArrow(296);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Chakra Petch", sans-serif';
    ctx.fillText('EXIT ↓', 128, 198);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বনানী ↓', 128, 408);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = aniso;
    tex.needsUpdate = true;
    return track(tex);
  })();

  // 19s. Kuril Flyover / Kurmitola 90-degree Turn Portal Sign
  const kurilTurnSign = (() => {
    const [c, ctx] = makeCanvas(896, 200);
    ctx.fillStyle = '#047857';
    ctx.fillRect(0, 0, 896, 200);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 876, 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ডানে ৯০° মোড় ↱ পূর্বাচল ৩০০ ফিট', 448, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Noto Sans Bengali", sans-serif';
    ctx.fillText('কুড়িল ফ্লাইওভার ➔ বালু নদী • নীলা মার্কেট • কাঞ্চন ব্রিজ', 448, 142);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19s-2. Kuril Fork Split Overhead Sign (Ramp to 300ft vs Straight to Gazipur)
  const kurilForkPortalSign = (() => {
    const [c, ctx] = makeCanvas(960, 210);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 960, 210);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 960, 14);
    ctx.fillRect(0, 196, 960, 14);

    // Left panel: Kuril Flyover Ramp -> 300ft
    ctx.fillStyle = '#047857';
    ctx.fillRect(20, 24, 445, 162);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 24, 445, 162);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText('↙ বাম র‍্যাম্পে উঠুন ↑ ৩০০ ফিট', 242, 78);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বসুন্ধরা • নীলা মার্কেট • কাঞ্চন ব্রিজ', 242, 138);

    // Right panel: Straight North -> Airport -> Gazipur
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(492, 24, 448, 162);
    ctx.strokeStyle = '#93c5fd';
    ctx.strokeRect(492, 24, 448, 162);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 36px "Noto Sans Bengali", sans-serif';
    ctx.fillText('সোজা ↑ গাজীপুর (সরাসরি)', 716, 78);
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বিমানবন্দর • উত্তরা • টঙ্গী • চৌরাস্তা', 716, 138);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19s-3. Direct Portal Arch over Kuril Up-Ramp Mouth
  const kurilRampPortalSign = (() => {
    const [c, ctx] = makeCanvas(640, 192);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 640, 192);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 640, 12);
    ctx.fillRect(0, 180, 640, 12);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 20, 612, 152);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 40px "Noto Sans Bengali", sans-serif';
    ctx.fillText('↱ কুড়িল ফ্লাইওভার র‍্যাম্প ↑', 320, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Noto Sans Bengali", sans-serif';
    ctx.fillText('উপরে উঠে পূর্বাচল ৩০০ ফিট রাস্তায় নামুন', 320, 134);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19t. Dhaka Bypass (N105) Directional Sign
  const dhakaBypassSign = (() => {
    const [c, ctx] = makeCanvas(768, 192);
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 752, 176);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 44px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ঢাকা বাইপাস (N105) ↰ গাজীপুর চৌরাস্তা', 384, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Noto Sans Bengali", sans-serif';
    ctx.fillText('রূপগঞ্জ ➔ ভোগড়া বাইপাস ➔ জাগ্রত চৌরঙ্গী', 384, 136);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19u. Army Cantonment, Navy HQ, Kurmitola General Hospital, Bashundhara R/A
  const armyCantonmentSign = (() => {
    const [c, ctx] = makeCanvas(640, 192);
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, 640, 192);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 640, 16);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 176, 640, 16);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 24, 612, 144);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 40px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ঢাকা সেনানিবাস • আর্মি ক্যান্টনমেন্ট', 320, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillText('BANGLADESH ARMY • DHAKA CANTONMENT', 320, 134);
    return track(finalizeColorTexture(c, aniso));
  })();

  const navyHqSign = (() => {
    const [c, ctx] = makeCanvas(640, 192);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 640, 192);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 640, 18);
    ctx.fillRect(0, 174, 640, 18);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 24, 612, 144);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 38px "Noto Sans Bengali", sans-serif';
    ctx.fillText('⚓ বাংলাদেশ নৌবাহিনী সদর দপ্তর', 320, 74);
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillText('BANGLADESH NAVY HEADQUARTERS • BANANI', 320, 134);
    return track(finalizeColorTexture(c, aniso));
  })();

  const kurmitolaHospitalSign = (() => {
    const [c, ctx] = makeCanvas(640, 192);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 640, 192);
    ctx.fillStyle = '#0d9488';
    ctx.fillRect(0, 0, 640, 26);
    ctx.fillRect(0, 166, 640, 26);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(34, 66, 22, 60);
    ctx.fillRect(15, 85, 60, 22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText('কুর্মিটোলা জেনারেল হাসপাতাল', 360, 74);
    ctx.fillStyle = '#0f766e';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText('৫০০ শয্যাবিশিষ্ট • KURMITOLA GENERAL HOSPITAL', 360, 130);
    return track(finalizeColorTexture(c, aniso));
  })();

  const bashundharaSign = (() => {
    const [c, ctx] = makeCanvas(768, 200);
    const grad = ctx.createLinearGradient(0, 0, 768, 0);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e3a8a');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 768, 200);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 768, 12);
    ctx.fillRect(0, 188, 768, 12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বসুন্ধরা আবাসিক এলাকা (R/A)', 384, 78);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Chakra Petch", "Noto Sans Bengali", sans-serif';
    ctx.fillText('BASHUNDHARA RESIDENTIAL AREA • ৩০০ ফিট সংলগ্ন', 384, 142);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 19v. Authentic Bangladeshi Real-Estate & Housing Company Billboards for 300ft Road
  const housingBillboardDefs = [
    { bg: '#064e3b', accent: '#facc15', badge: 'PLOT BOOKING', title: 'পূর্বাচল মেরিন সিটি', sub: '৩০০ ফিট হাইওয়ের পাশে • ৩ ও ৫ কাঠা প্লট' },
    { bg: '#1e3a8a', accent: '#fbbf24', badge: 'BLOCK I • J • N', title: 'বসুন্ধরা আবাসিক এলাকা', sub: 'আধুনিক নাগরিক সুবিধা • ৩০০ ফিট সংলগ্ন' },
    { bg: '#7f1d1d', accent: '#fde047', badge: 'READY PLOT', title: 'পূর্বাচল আমেরিকান সিটি', sub: 'এখনই বাড়ি করার উপযোগী • সহজ কিস্তি' },
    { bg: '#14532d', accent: '#facc15', badge: 'ARMY HOUSING', title: 'জলসিঁড়ি আবাসন প্রকল্প', sub: 'সবুজে ঘেরা স্মার্ট সিটি • ৩০০ ফিট রোড' },
    { bg: '#312e81', accent: '#38bdf8', badge: 'SWADESH PROPERTIES', title: 'সানভ্যালি আবাসন', sub: 'লেক ভিউ রেসিডেন্সিয়াল প্লট • বুকিং চলছে' },
    { bg: '#7c2d12', accent: '#fde047', badge: 'PROBASHI PALLI', title: 'পূর্বাচল প্রবাসী পল্লী', sub: 'রেডি বিদ্যুৎ ও পাকা রাস্তা • এখনই সাব-কবলা' },
    { bg: '#0f172a', accent: '#34d399', badge: 'SMART CITY', title: 'নীলাচল হাউজিং এস্টেট', sub: 'বালু ব্রিজ – কাঞ্চন সংলগ্ন প্রিমিয়াম প্লট' },
    { bg: '#831843', accent: '#fde047', badge: 'CONCORD', title: 'পূর্বাচল কনকর্ড সিটি', sub: 'রাজউক পূর্বাচল সংলগ্ন • নির্ভেজাল জমি' },
  ];
  const housingBillboards = housingBillboardDefs.map((hb) => {
    const [c, ctx] = makeCanvas(768, 360);
    ctx.fillStyle = hb.bg;
    ctx.fillRect(0, 0, 768, 360);
    ctx.fillStyle = hb.accent;
    ctx.fillRect(0, 0, 768, 16);
    ctx.fillRect(0, 344, 768, 16);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 24, 732, 312);

    // Top pill badge + hotline bar
    ctx.fillStyle = hb.accent;
    ctx.fillRect(38, 42, 260, 46);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillText(hb.badge, 168, 65);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 22px "Chakra Petch", sans-serif';
    ctx.fillText('HOTLINE: 16244', 724, 65);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px "Noto Sans Bengali", sans-serif';
    ctx.fillText(hb.title, 384, 174, 700);

    ctx.fillStyle = hb.accent;
    ctx.font = 'bold 30px "Noto Sans Bengali", sans-serif';
    ctx.fillText(hb.sub, 384, 274, 700);
    return track(finalizeColorTexture(c, aniso));
  });

  // 20. Contact shadow
  const contactShadow = (() => {
    const [c, ctx] = makeCanvas(128, 128);
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(0,0,0,0.62)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.26)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return track(tex);
  })();

  return {
    road: roadTex,
    purbachalExpressRoad,
    purbachalServiceRoad,
    cityRoad: cityRoadTex,
    zebra: zebraTex,
    sidewalk: sidewalkTex,
    fuelPad: fuelPadTex,
    fuelCanopySign,
    showroomPad,
    showroomFacadeSign,
    showroomBanner,
    showroomPylonSign,
    metroBanner,
    metroStationBoards,
    escalatorSign,
    directionSigns,
    dhakaArchBanner,
    tongSign,
    pillarSign,
    metroTrainSide,
    busNitol,
    busNitolStaff,
    busBrtc,
    busHanif,
    busShohag,
    doubleDeckerLivery,
    coveredVanLivery,
    cementMixerLivery,
    oilTankerLivery,
    fireTruckLivery,
    policeLivery,
    rabLivery,
    armyLivery,
    ambulanceLivery,
    legunaLivery,
    truckArt,
    rickshawBacks,
    cngBacks,
    vangariBack,
    heroTank,
    heroTankXtreme,
    heroTankKarizma,
    buildingFacades,
    shopSigns,
    roadSigns,
    jokeSigns,
    trafficControlSigns,
    accidentSloganSign,
    expresswayDeck,
    expresswayTollSign,
    rampEntranceSign,
    turagRiverWater,
    ijtemaSign,
    airportSign,
    jagrataPlaqueSign,
    mohakhaliTerminalSign,
    purbachalArchSign,
    neelaMarketSign,
    neelaStallSigns,
    kanchanBridgeSign,
    baluBridgeSign,
    shitalakshyaWater,
    bananiExitSign,
    bananiRampPortalSign,
    bananiExitDeckArrows,
    kurilTurnSign,
    kurilForkPortalSign,
    kurilRampPortalSign,
    armyCantonmentSign,
    navyHqSign,
    kurmitolaHospitalSign,
    bashundharaSign,
    housingBillboards,
    dhakaBypassSign,
    contactShadow,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
      jokeSigns.forEach((t) => t.dispose());
    },
  };
}
