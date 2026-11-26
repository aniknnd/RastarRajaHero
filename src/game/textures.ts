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
  tejgaonTurnBillboard: THREE.CanvasTexture;
  mohakhaliBusTerminal: THREE.CanvasTexture;
  kurilSplitGantry: THREE.CanvasTexture;
  expresswayRoad: THREE.CanvasTexture;
  canalWater: THREE.CanvasTexture;
  neelaMarketSign: THREE.CanvasTexture;
  restRoomSign: THREE.CanvasTexture;
  restRoomPad: THREE.CanvasTexture;
  uturnLoopRoad: THREE.CanvasTexture;
  turnPavementArrow: THREE.CanvasTexture;
  bridgeCrossRoad: THREE.CanvasTexture;
  flyoverSlipArrow: THREE.CanvasTexture;
  routeBadgeUttara: THREE.CanvasTexture;
  routeBadge300ft: THREE.CanvasTexture;
  expresswayBillboards: THREE.CanvasTexture[];
  bashundharaSigns: {
    gate: THREE.CanvasTexture;
    school: THREE.CanvasTexture;
    mosque: THREE.CanvasTexture;
    market: THREE.CanvasTexture;
    sports: THREE.CanvasTexture;
    lake: THREE.CanvasTexture;
    sector: THREE.CanvasTexture;
  };
  duckStallSign: THREE.CanvasTexture;
  baluBridgeSign: THREE.CanvasTexture;
  restaurantSigns: THREE.CanvasTexture[];
  flyoverFunnyBanners: THREE.CanvasTexture[];
  uturnSigns: {
    metroEnd: THREE.CanvasTexture;
    downtownSouth: THREE.CanvasTexture;
    tejgaonSouth: THREE.CanvasTexture;
    uttara: THREE.CanvasTexture;
    purbachal: THREE.CanvasTexture;
  };
  corridorGantries: {
    tejgaon: THREE.CanvasTexture;
    mohakhali: THREE.CanvasTexture;
    banani: THREE.CanvasTexture;
    expressway300ft: THREE.CanvasTexture;
    uttara: THREE.CanvasTexture;
  };
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
    ctx.font = 'bold 72px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিলয় হিরো শোরুম • নিলয় মোটরস লি.', 790, 96);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 32px "Chakra Petch", sans-serif';
    ctx.fillText('NILOY HERO FLAGSHIP SHOWROOM  •  UPGRADE & SUPERBIKE HUB', 790, 182);
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
    ctx.font = 'bold 54px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিলয় হিরো শোরুম ও আপগ্রেড', 595, 86);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText('১,০০,০০০-এ এক্সট্রিম ১৬০আর  •  ২,০০,০০০-এ কারিজমা ২১০!', 595, 162);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 22px "Chakra Petch", sans-serif';
    ctx.fillText('BIGGER SMASH  •  MORE FUEL  •  LONGER COMBO & NITRO', 595, 212);
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
    { bn: 'ফার্মগেট স্টেশন', en: 'FARMGATE • ঢাকা মেট্রো রেল (MRT-6)' },
    { bn: 'শাহবাগ স্টেশন', en: 'SHAHBAG • ঢাকা মেট্রো রেল (MRT-6)' },
    { bn: 'মতিঝিল স্টেশন', en: 'MOTIJHEEL • ঢাকা মেট্রো রেল (MRT-6)' },
    { bn: 'আগারগাঁও স্টেশন', en: 'AGARGAON • সামনেই তেজগাঁও টার্ন ➡' },
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
    ctx.font = 'bold 52px "Noto Sans Bengali", sans-serif';
    ctx.fillText('স্বাগতম ঢাকা • হিরো রাস্তার রাজা', 512, 74);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিটল-নিলয় সিটি • সব নিয়ম ভেঙ্গে ঝড়ের বেগে এগিয়ে চলুন!', 512, 138);
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
    ctx.fillText('হিরো রাস্তার রাজা', 128, 126);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নিয়ম ভেঙে এগিয়ে চলো!', 128, 188);
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

  // 21. Tejgaon Turnoff Billboard ("তেজগাঁও এই দিকে ➡")
  const tejgaonTurnBillboard = (() => {
    const [c, ctx] = makeCanvas(1024, 384);
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 0, 1024, 384);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 1004, 364);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(28, 28, 968, 78);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 40px "Noto Sans Bengali", sans-serif';
    ctx.fillText('হিরো মোটরস করিডোর  •  আগারগাঁও লিংক রোড', 512, 67);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 88px "Noto Sans Bengali", sans-serif';
    ctx.fillText('তেজগাঁও এই দিকে ➡', 512, 185);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 34px "Noto Sans Bengali", "Chakra Petch", sans-serif';
    ctx.fillText('তেজগাঁও হিরো শোরুম · মহাখালী · বনানী · কুড়িল · ৩০০ ফিট', 512, 275);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    ctx.fillText('TURN RIGHT INTO TEJGAON LINK ROAD  ➡', 512, 330);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 21b. Mohakhali Bus Terminal Billboard ("মহাখালী বাস টার্মিনাল")
  const mohakhaliBusTerminal = (() => {
    const [c, ctx] = makeCanvas(1024, 384);
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, 0, 1024, 384);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 1004, 364);

    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(28, 28, 968, 78);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0c4a6e';
    ctx.font = 'bold 40px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ঢাকা পরিবহন  •  বাস কাউন্টার ১-৮', 512, 67);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 82px "Noto Sans Bengali", sans-serif';
    ctx.fillText('মহাখালী বাস টার্মিনাল', 512, 185);

    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 34px "Noto Sans Bengali", "Chakra Petch", sans-serif';
    ctx.fillText('গুলশান · বনানী · উত্তরা · বিমানবন্দর', 512, 275);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    ctx.fillText('MOHAKHALI BUS TERMINAL  •  COUNTERS 1-8', 512, 330);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 22. Kuril Interchange Split Gantry ("⬆ উত্তরা  |  ৩০০ ফিট ➡")
  const kurilSplitGantry = (() => {
    const [c, ctx] = makeCanvas(1024, 320);
    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, 1024, 320);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, 1004, 300);

    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(22, 22, 470, 276);
    ctx.fillStyle = '#047857';
    ctx.fillRect(512, 22, 490, 276);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(496, 22, 12, 276);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 48px "Noto Sans Bengali", sans-serif';
    ctx.fillText('⬆ উত্তরা / এয়ারপোর্ট', 257, 92);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Noto Sans Bengali", sans-serif';
    ctx.fillText('সোজা যান • উত্তরা শোরুম ও ইউ-টার্ন', 257, 175);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillText('STRAIGHT AHEAD TO UTTARA', 257, 240);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 48px "Noto Sans Bengali", sans-serif';
    ctx.fillText('৩০০ ফিট (পূর্বাচল) ➡', 757, 92);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ফ্লাইওভারে উঠুন • নীলা মার্কেট', 757, 175);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillText('TAKE FLYOVER RAMP TO 300 FT', 757, 240);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 23. 300 Feet 3-Lane One-Way Expressway Asphalt (repeats cleanly along X)
  const expresswayRoad = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#292e36';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      const x = (i * 71) % 512;
      const y = (i * 193 + Math.floor(i / 5) * 11) % 512;
      const v = 38 + ((i * 23) % 20);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // Crisp solid outer highway edges (yellow inner canal edge, white outer shoulder)
    ctx.fillStyle = '#facc15';
    ctx.fillRect(10, 0, 10, 512);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(492, 0, 10, 512);
    // Two dashed lane dividers for 3 expressway lanes!
    ctx.fillStyle = '#f1f5f9';
    for (let y = 12; y < 512; y += 64) {
      ctx.fillRect(170, y, 8, 36);
      ctx.fillRect(334, y, 8, 36);
    }
    return track(finalizeColorTexture(c, aniso, 1, 24));
  })();

  // 24. 300 Feet Central Water Canal
  const canalWater = (() => {
    const [c, ctx] = makeCanvas(256, 512);
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, '#0f766e');
    grad.addColorStop(0.5, '#0284c7');
    grad.addColorStop(1, '#0f766e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 320; i++) {
      const x = (i * 59) % 230 + 10;
      const y = (i * 137) % 500;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(186,230,253,0.28)' : 'rgba(13,148,136,0.35)';
      ctx.fillRect(x, y, 18 + (i % 24), 4);
    }
    return track(finalizeColorTexture(c, aniso, 1, 30));
  })();

  // 25. Neela Market Sign
  const neelaMarketSign = (() => {
    const [c, ctx] = makeCanvas(768, 224);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, 0, 768, 224);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, 0, 768, 24);
    ctx.fillRect(0, 200, 768, 24);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 32, 744, 160);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 58px "Noto Sans Bengali", sans-serif';
    ctx.fillText('নীলা মার্কেট • পূর্বাচল ৩০০ ফিট', 384, 96);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Noto Sans Bengali", sans-serif';
    ctx.fillText('হিরো শোরুম  •  বাইকারস রেস্ট রুম  •  দেশি খাবার ও চা', 384, 158);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 26. Bikers Rest Room Sign & Pad
  const restRoomSign = (() => {
    const [c, ctx] = makeCanvas(768, 224);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 768, 224);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 768, 22);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, 202, 768, 22);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 30, 744, 164);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 52px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বাইকারস রেস্ট রুম • হিরো পয়েন্ট', 384, 92);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 28px "Noto Sans Bengali", "Chakra Petch", sans-serif';
    ctx.fillText('BIKERS REST ROOM  •  চা-নাস্তা, বিশ্রাম ও ফুল ট্যাংক ফ্রি!', 384, 156);
    return track(finalizeColorTexture(c, aniso));
  })();

  const restRoomPad = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#0c4a6e';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 18;
    ctx.strokeRect(14, 14, 484, 484);
    ctx.fillStyle = '#075985';
    ctx.fillRect(42, 42, 428, 428);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 54px "Noto Sans Bengali", sans-serif';
    ctx.fillText('বাইকারস রেস্ট রুম', 256, 165);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px "Noto Sans Bengali", sans-serif';
    ctx.fillText('থামুন • বিশ্রাম ও চা', 256, 265);
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 34px "Chakra Petch", sans-serif';
    ctx.fillText('REST + FULL FUEL + NITRO', 256, 360);
    return track(finalizeColorTexture(c, aniso));
  })();

  const makeUTurnTex = (titleBn: string, subBn: string, bg: string): THREE.CanvasTexture => {
    const [c, ctx] = makeCanvas(768, 200);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, 200);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 752, 184);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 48px "Noto Sans Bengali", sans-serif';
    ctx.fillText(titleBn, 384, 76);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Noto Sans Bengali", "Chakra Petch", sans-serif';
    ctx.fillText(subBn, 384, 144);
    return track(finalizeColorTexture(c, aniso));
  };

  const makeGantryTex = (topLine: string, midLine: string, bottomLine: string, bg: string): THREE.CanvasTexture => {
    const [c, ctx] = makeCanvas(768, 224);
    ctx.fillStyle = bg;
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
    ctx.fillText(topLine, 384, 48);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText(midLine, 384, 126);
    ctx.fillStyle = '#bbf7d0';
    ctx.font = 'bold 22px "Chakra Petch", sans-serif';
    ctx.fillText(bottomLine, 384, 182);
    return track(finalizeColorTexture(c, aniso));
  };

  // 27. U-Turn Loop Road Texture (curved dashed turnaround arcs + ↺ U-TURN arrows + chevron tip)
  const uturnLoopRoad = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#292e36';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3000; i++) {
      const x = (i * 79) % 512;
      const y = (i * 191 + Math.floor(i / 6) * 13) % 512;
      const v = 38 + ((i * 19) % 20);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      ctx.fillRect(x, y, 2, 2);
    }
    // Red-white chevron top turnaround bumper strip (at -Z / top of canvas)
    for (let x = 0; x < 512; x += 64) {
      ctx.fillStyle = (x / 64) % 2 === 0 ? '#dc2626' : '#f8fafc';
      ctx.fillRect(x, 0, 64, 26);
    }
    // Outer white turnaround edge
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(256, 256, 210, Math.PI, 0, false);
    ctx.stroke();

    // Inner bright yellow dashed U-turn guide arc
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 10;
    ctx.setLineDash([28, 18]);
    ctx.beginPath();
    ctx.arc(256, 256, 138, Math.PI, 0, false);
    ctx.stroke();
    ctx.setLineDash([]);

    // Big crisp U-turn arrows painted on asphalt
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 64px "Noto Sans Bengali", "Chakra Petch", sans-serif';
    ctx.fillText('↺ U-TURN', 256, 230);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText('ইউ-টার্ন লুপ', 256, 300);

    // Entry & exit lane arrows on bottom half
    ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = '#4ade80';
    ctx.fillText('⬆', 118, 415);
    ctx.fillStyle = '#fde047';
    ctx.fillText('⬇', 394, 415);

    return track(finalizeColorTexture(c, aniso));
  })();

  // 28. Right-Turn Pavement Arrow Stencil ("তেজগাঁও ➡")
  const turnPavementArrow = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#2d3138';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, 488, 488);

    // Big white painted turn arrow curving right
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(180, 430);
    ctx.lineTo(180, 220);
    ctx.quadraticCurveTo(180, 140, 270, 140);
    ctx.lineTo(395, 140);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(455, 140);
    ctx.lineTo(375, 85);
    ctx.lineTo(375, 195);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 54px "Noto Sans Bengali", sans-serif';
    ctx.fillText('তেজগাঁও ➡', 290, 325);
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 28px "Chakra Petch", sans-serif';
    ctx.fillText('TURN RIGHT', 290, 385);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 29. 300 Feet Canal Crossing Bridge Deck Texture
  const bridgeCrossRoad = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(18, 0, 14, 512);
    ctx.fillRect(480, 0, 14, 512);
    ctx.fillStyle = '#f8fafc';
    for (let y = 24; y < 490; y += 72) {
      ctx.fillRect(250, y, 12, 42);
    }
    return track(finalizeColorTexture(c, aniso));
  })();

  // 30. Kuril Flyover Entry Pavement Arrow ("৩০০ ফিট ফ্লাইওভার ↗")
  const flyoverSlipArrow = (() => {
    const [c, ctx] = makeCanvas(512, 512);
    ctx.fillStyle = '#2d3138';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, 488, 488);

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(150, 435);
    ctx.quadraticCurveTo(185, 245, 345, 115);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(395, 78);
    ctx.lineTo(300, 92);
    ctx.lineTo(366, 174);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 46px "Noto Sans Bengali", sans-serif';
    ctx.fillText('৩০০ ফিট ফ্লাইওভার', 270, 355);
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 26px "Chakra Petch", sans-serif';
    ctx.fillText('KURIL FLYOVER RAMP', 270, 412);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 31. Vehicle Route Destination Badges ("উত্তরা ⬆" vs "৩০০ ফিট ✈")
  const makeRouteBadge = (bnLabel: string, enLabel: string, bg: string, border: string, accent: string) => {
    const [c, ctx] = makeCanvas(256, 96);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = border;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 88);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText(bnLabel, 128, 36);
    ctx.fillStyle = accent;
    ctx.font = 'bold 18px "Chakra Petch", sans-serif';
    ctx.fillText(enLabel, 128, 70);
    return track(finalizeColorTexture(c, aniso));
  };

  const routeBadgeUttara = makeRouteBadge('উত্তরা ⬆', 'STRAIGHT UTTARA', '#14532d', '#4ade80', '#fde047');
  const routeBadge300ft = makeRouteBadge('৩০০ ফিট ✈', 'KURIL FLYOVER', '#0c4a6e', '#38bdf8', '#fde047');

  // 32. Real-time 300 Feet / Purbachal Expressway Billboards (Bashundhara, Balu Bridge, Jolshiri, Duck House, Resorts, Hero)
  const makeExpresswayBillboard = (
    topBadge: string,
    headlineBn: string,
    subLine: string,
    enFooter: string,
    bgTop: string,
    bgBot: string,
    accent: string
  ): THREE.CanvasTexture => {
    const [c, ctx] = makeCanvas(1024, 384);
    const grad = ctx.createLinearGradient(0, 0, 1024, 384);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 384);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 1004, 364);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(28, 26, 968, 66);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = 'bold 34px "Noto Sans Bengali", "Chakra Petch", sans-serif';
    ctx.fillText(topBadge, 512, 59, 930);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 68px "Noto Sans Bengali", sans-serif';
    ctx.fillText(headlineBn, 512, 168, 940);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 34px "Noto Sans Bengali", sans-serif';
    ctx.fillText(subLine, 512, 255, 930);

    ctx.fillStyle = accent;
    ctx.font = 'bold 24px "Chakra Petch", sans-serif';
    ctx.fillText(enFooter, 512, 326, 920);
    return track(finalizeColorTexture(c, aniso));
  };

  const expresswayBillboards: THREE.CanvasTexture[] = [
    makeExpresswayBillboard(
      'বসুন্ধরা আবাসিক ও স্পোর্টস সিটি • খিলক্ষেত - ৩০০ ফিট গেট',
      'বসুন্ধরা R/A ও স্পোর্টস কমপ্লেক্স',
      'আধুনিক আবাসন, স্টেডিয়াম ও শপিং জোন ডানে',
      'BASHUNDHARA RESIDENTIAL & SPORTS CITY • 300 FT CORRIDOR',
      '#1e3a8a',
      '#0f172a',
      '#fde047'
    ),
    makeExpresswayBillboard(
      'জুলাই ৩৬ এক্সপ্রেসওয়ে • পূর্বাচল হাইওয়ে অথরিটি',
      'বালু নদী ব্রিজ · সেক্টর ১ সামনে',
      'গতিসীমা মেনে চলুন • লেন পরিবর্তন সাবধানে',
      'JULY 36 EXPRESSWAY • BALU RIVER BRIDGE AHEAD',
      '#065f46',
      '#022c22',
      '#6ee7b7'
    ),
    makeExpresswayBillboard(
      'জলসিঁড়ি আবাসন • ন্যাচারাল গ্রিন সিটি',
      'জলসিঁড়ি আবাসন ও লেকভিউ',
      '৩০০ ফিট পূর্বাচল সেক্টর ১ সংযোগ সড়ক',
      'JOLSHIRI ABASHON • MODERN TOWNSHIP PURBACHAL',
      '#155e75',
      '#083344',
      '#fbbf24'
    ),
    makeExpresswayBillboard(
      'পূর্বাচলের বিখ্যাত খাবার • আমানউল্লাহ ও দেশি হাঁস ঘর',
      'নীলা মার্কেট হাঁসের মাংস ও চিতই পিঠা',
      'কড়াইয়ে ভুনা দেশি হাঁস, ভর্তা ও গরম চা',
      'NEELA MARKET SIGNATURE DUCK BHUNA • SECTOR 1 PURBACHAL',
      '#991b1b',
      '#450a0a',
      '#fde047'
    ),
    makeExpresswayBillboard(
      'বাণিজ্য মেলা ও ইকো ট্যুরিজম • সেক্টর ৪ ও ২১',
      'ব্লু লেক ও নিঝুম পল্লী রিসোর্ট',
      'বাংলাদেশ-চায়না ফ্রেন্ডশিপ এক্সপো সেন্টার সামনে',
      'PURBACHAL BLUE LAKE • NIJHUM POLLI • EXHIBITION CENTRE',
      '#581c87',
      '#1e1b4b',
      '#f472b6'
    ),
    makeExpresswayBillboard(
      'নিলয় মোটরস লিমিটেড • অফিসিয়াল হাইওয়ে পার্টনার',
      'হিরো কারিশমা XMR ২১০ • রাস্তার রাজা',
      'নীলা মার্কেট শোরুম ও বাইকারস রেস্ট রুম সামনে',
      'HERO MOTOCORP BANGLADESH • 300 FT RIDER ZONE',
      '#b91c1c',
      '#18181b',
      '#facc15'
    ),
  ];

  // 32b. Bashundhara Residential Area township signage (gate, amenities, sector boards)
  const bashundharaSigns = {
    gate: makeUTurnTex(
      'বসুন্ধরা আবাসিক এলাকা • ৩০০ ফিট গেট',
      'আধুনিক আবাসন, স্কুল, মসজিদ, লেক পার্ক ও স্পোর্টস সিটি',
      '#1e3a8a'
    ),
    school: makeUTurnTex(
      'বসুন্ধরা স্কুল এন্ড কলেজ',
      'শিক্ষা • ক্রীড়া • সংস্কৃতি — সেক্টর ১ আবাসিক zone',
      '#0f766e'
    ),
    mosque: makeUTurnTex(
      'বসুন্ধরা কমিউনিটি মসজিদ',
      'জামা-আদায় • ইসলামিক সেন্টার • সবুজ মসজিদ চত্বর',
      '#065f46'
    ),
    market: makeUTurnTex(
      'বসুন্ধরা শপিং কমপ্লেক্স',
      'দৈনিক বাজার • বুটিক • ক্যাফে • সুবিধাজনক পার্কিং',
      '#9a3412'
    ),
    sports: makeUTurnTex(
      'বসুন্ধরা স্পোর্টস সিটি',
      'ফুটবল মাঠ • রানিং ট্র্যাক • ক্রিকেট একাডেমি',
      '#1d4ed8'
    ),
    lake: makeUTurnTex(
      'বসুন্ধরা লেক পার্ক',
      'হাঁটা পথ • বেঞ্চ • নৌকা • পরিবারের জন্য শান্ত জায়গা',
      '#0e7490'
    ),
    sector: makeUTurnTex(
      'বসুন্ধরা আবাসিক এলাকা',
      'সেক্টর ১ • ২ • ৩ — বামে আবাসন, ডানে সুবিধা',
      '#4338ca'
    ),
  };

  // 33. 300 Feet Duck Meat Stall Sign ("হাঁসের মাংস ও চিতই পিঠা")
  const duckStallSign = (() => {
    const [c, ctx] = makeCanvas(768, 224);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, 0, 768, 224);
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(0, 0, 768, 24);
    ctx.fillRect(0, 200, 768, 24);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 8;
    ctx.strokeRect(12, 32, 744, 160);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 54px "Noto Sans Bengali", sans-serif';
    ctx.fillText('হাঁসের মাংস ও চিতই পিঠা', 384, 92);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Noto Sans Bengali", "Chakra Petch", sans-serif';
    ctx.fillText('গরম কড়াই ভুনা হাঁস • চালাই রুটি • নীলা মার্কেট ৩০০ ফিট', 384, 156);
    return track(finalizeColorTexture(c, aniso));
  })();

  // 34. Balu River Bridge & 300ft Restaurant/Resort Signs
  const baluBridgeSign = makeGantryTex(
    'বালু নদী ব্রিজ • BALU RIVER BRIDGE',
    'নীলা মার্কেট ও পূর্বাচল সেক্টর ১ সামনে',
    '300 FT EXPRESSWAY • BALU CANAL CROSSING',
    '#0f766e'
  );

  const restaurantSigns: THREE.CanvasTexture[] = [
    makeUTurnTex('রিকশা ক্যাফে ও দ্য স্পট • ৩০০ ফিট', 'লাইভ বি.বি.কিউ · ওপেন এয়ার আড্ডা • বসুন্ধরা সংলগ্ন', '#1e293b'),
    makeUTurnTex('নকশী পল্লী ও নিঝুম পল্লী রিসোর্ট', 'ব্লু লেক, কটেজ ও দেশি খাবার • পূর্বাচল ৩০০ ফিট', '#3f1d38'),
  ];

  // 35. Hilarious Dhaka Flyover Overhead Banners ("ফানি ব্যানার")
  const makeFunnyFlyoverBanner = (
    headlineBn: string,
    punchlineBn: string,
    tagEn: string,
    bgTop: string,
    bgBot: string,
    border: string,
    badgeBg: string
  ): THREE.CanvasTexture => {
    const [c, ctx] = makeCanvas(1024, 256);
    const grad = ctx.createLinearGradient(0, 0, 1024, 256);
    grad.addColorStop(0, bgTop);
    grad.addColorStop(1, bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    ctx.strokeStyle = border;
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, 1008, 240);

    // Corner rickshaw-art style hazard stripes
    ctx.fillStyle = badgeBg;
    ctx.fillRect(20, 20, 984, 52);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px "Chakra Petch", "Noto Sans Bengali", sans-serif';
    ctx.fillText(tagEn, 512, 46, 940);

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 52px "Noto Sans Bengali", sans-serif';
    ctx.fillText(headlineBn, 512, 122, 950);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px "Noto Sans Bengali", sans-serif';
    ctx.fillText(punchlineBn, 512, 198, 950);
    return track(finalizeColorTexture(c, aniso));
  };

  const flyoverFunnyBanners: THREE.CanvasTexture[] = [
    makeFunnyFlyoverBanner(
      'ফ্লাইওভারে উড়াল দিচ্ছেন?',
      'ভাই ব্রেকটাও সাথে নিছেন তো! 😜',
      'DHAKA FLYOVER AIRLINES • CHECK BRAKES BEFORE TAKEOFF',
      '#7f1d1d',
      '#18181b',
      '#facc15',
      '#fde047'
    ),
    makeFunnyFlyoverBanner(
      'উপরের ফ্লাইওভার ১০ তলা সমান!',
      'সেলফি তুলতে গিয়া লেন ছাড়বেন না ভাই 🤳',
      'KURIL UPPER SKYWAY (10.6M) • EYES ON THE ASPHALT',
      '#0c4a6e',
      '#0f172a',
      '#38bdf8',
      '#7dd3fc'
    ),
    makeFunnyFlyoverBanner(
      'জ্যাম নাই বলে স্পিড ১৬০?!',
      'আম্মু বাসায় জুতা হাতে ওয়েট করছে! 🩴',
      'ZERO TRAFFIC ≠ ZERO GRAVITY • SLOW DOWN RIDER',
      '#581c87',
      '#1e1b4b',
      '#f472b6',
      '#fbcfe8'
    ),
    makeFunnyFlyoverBanner(
      'গুগল ম্যাপ বলছে ডানে নামুন...',
      'ভাই এটা ফ্লাইওভার, ডানে নামলে সোজা খাল! 🌊',
      'TRUST THE FLYOVER RAMP • NOT YOUR COUSIN',
      '#065f46',
      '#022c22',
      '#34d399',
      '#6ee7b7'
    ),
    makeFunnyFlyoverBanner(
      'হিরো বাইক নিয়ে উড়ছেন ভালো...',
      'তেল ফুরালে ফ্লাইওভারে ঠেলতে খবর আছে! ⛽',
      'LOW FUEL ALERT ON FLYOVER = EXTRA LEG DAY',
      '#9a3412',
      '#27272a',
      '#fb923c',
      '#fed7aa'
    ),
    makeFunnyFlyoverBanner(
      'বামে তাকাবেন না, নিচে আরেক ফ্লাইওভার!',
      'দুই তলা কুড়িল হাইওয়েতে স্বাগতম 🏍💨',
      'DOUBLE-DECKER INTERCHANGE • STAY IN YOUR LEFT LANE',
      '#1e3a8a',
      '#09090b',
      '#facc15',
      '#93c5fd'
    ),
  ];

  return {
    road: roadTex,
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
    tejgaonTurnBillboard,
    mohakhaliBusTerminal,
    kurilSplitGantry,
    expresswayRoad,
    canalWater,
    neelaMarketSign,
    restRoomSign,
    restRoomPad,
    uturnLoopRoad,
    turnPavementArrow,
    bridgeCrossRoad,
    flyoverSlipArrow,
    routeBadgeUttara,
    routeBadge300ft,
    expresswayBillboards,
    bashundharaSigns,
    duckStallSign,
    baluBridgeSign,
    restaurantSigns,
    flyoverFunnyBanners,
    uturnSigns: {
      metroEnd: makeUTurnTex('↺ ইউ-টার্ন • তেজগাঁও মোড়', 'ঘুরে তেজগাঁও লিংক রোডে ঢুকুন', '#1e3a8a'),
      downtownSouth: makeUTurnTex('↺ ইউ-টার্ন • ফার্মগেট-তেজগাঁও', 'শুরুতে ঘুরে মেট্রো রোডে ফিরুন', '#1e3a8a'),
      tejgaonSouth: makeUTurnTex('↺ ইউ-টার্ন • মহাখালী-উত্তরা', 'উত্তরের দিকে মহাখালী ও ৩০০ ফিট যান', '#065f46'),
      uttara: makeUTurnTex('↺ উত্তরা ইউ-টার্ন • মহাখালী ফিরুন', 'পাশেই উত্তরা হিরো শোরুম • ঘুরে ফিরুন', '#991b1b'),
      purbachal: makeUTurnTex('↺ পূর্বাচল শেষ প্রান্ত • ইউ-টার্ন', 'ঘুরে নীলা মার্কেট হয়ে কুড়িল-মহাখালী ফিরুন', '#065f46'),
    },
    corridorGantries: {
      tejgaon: makeGantryTex('⬆ মহাখালী  •  বনানী  •  উত্তরা', 'তেজগাঁও শিল্পাঞ্চল • হিরো শোরুম জোন', 'TEJGAON HERO CORRIDOR', '#065f46'),
      mohakhali: makeGantryTex('⬆ মহাখালী ফ্লাইওভার সামনে', 'সার্ভিস লেন বামে  |  ফ্লাইওভার মাঝখানে', 'MOHAKHALI FLYOVER • KEEP SPEED', '#1e3a8a'),
      banani: makeGantryTex('⬆ বনানী  •  দ্বিতীয় ফ্লাইওভার', 'সামনে কুড়িল ৩০০ ফিট ও উত্তরা সংযোগ', 'BANANI OVERPASS • AIRPORT ROAD', '#065f46'),
      expressway300ft: makeGantryTex('পূর্বাচল ৩০০ ফিট এক্সপ্রেসওয়ে', 'সামনে নীলা মার্কেট  •  বাইকারস রেস্ট রুম', '6-LANE CANAL EXPRESSWAY • PURBACHAL', '#065f46'),
      uttara: makeGantryTex('উত্তরা • বিমানবন্দর সড়ক', 'সামনে উত্তরা হিরো শোরুম ও ইউ-টার্ন', 'UTTARA NORTH • HERO SHOWROOM', '#1e3a8a'),
    },
    contactShadow,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
      jokeSigns.forEach((t) => t.dispose());
    },
  };
}
