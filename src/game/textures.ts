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
  buildingFacades: THREE.CanvasTexture[];
  shopSigns: THREE.CanvasTexture[];
  roadSigns: THREE.CanvasTexture[];
  jokeSigns: THREE.Texture[];
  trafficControlSigns: THREE.CanvasTexture[];
  accidentSloganSign: THREE.CanvasTexture;
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

  // 16. Hero Tank Livery
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

  return {
    road: roadTex,
    cityRoad: cityRoadTex,
    zebra: zebraTex,
    sidewalk: sidewalkTex,
    fuelPad: fuelPadTex,
    fuelCanopySign,
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
    buildingFacades,
    shopSigns,
    roadSigns,
    jokeSigns,
    trafficControlSigns,
    accidentSloganSign,
    contactShadow,
    dispose: () => {
      allTextures.forEach((t) => t.dispose());
      jokeSigns.forEach((t) => t.dispose());
    },
  };
}
