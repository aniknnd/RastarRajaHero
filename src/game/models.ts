import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';
import { ELEVATED_EXPRESSWAY_DEF, KURIL_300FT_RAMP_DEF, KURIL_RAMP_SAMPLES, sampleBananiDownRamp } from './track';
import { GAME_CONFIG, VEHICLE_SPECS, type BikeTierId, type TrafficLightPhase, type VehicleKind } from './types';

export interface HeroBikeRig {
  group: THREE.Group;
  leanGroup: THREE.Group;
  frontFork: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  exhaustTip: THREE.Object3D;
  fuelPortTip: THREE.Object3D;
  brakeLightMat: THREE.MeshStandardMaterial;
  boostFlame: THREE.Mesh;
}

export interface TrafficModelRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  halfWidth: number;
  halfLength: number;
  isLarge: boolean;
}

export interface PedestrianRig {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  angryBadge: THREE.Mesh;
}

export interface SlapperRig {
  group: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
}

export interface TrafficLightRig {
  group: THREE.Group;
  setPhase: (phase: TrafficLightPhase) => void;
}

export interface ShowroomAttendantRig {
  group: THREE.Group;
  headGroup: THREE.Group;
  rightArmPivot: THREE.Group;
  rightForearmPivot: THREE.Group;
  leftArmPivot: THREE.Group;
  saluteIntensity: number;
}

export interface ShowroomStaffInstance {
  rig: ShowroomAttendantRig;
  localX: number;
  localZ: number;
  baseYaw: number;
}

function addContactShadow(parent: THREE.Group, tex: THREE.CanvasTexture, w: number, l: number): void {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, l), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0.02;
  parent.add(plane);
}

function makeWheel(radius: number, width: number, rimColor = 0xd1d5db): THREE.Group {
  const wheel = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.88,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: rimColor,
    roughness: 0.28,
    metalness: 0.82,
  });

  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 14), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 10), rimMat);
  rim.rotation.z = Math.PI / 2;
  wheel.add(rim);

  const spoke = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, radius * 1.1, radius * 0.16), rimMat);
  wheel.add(spoke);

  return wheel;
}

function makeSportBikeWheel(outerRadius: number, tubeRadius: number, isFront: boolean): THREE.Group {
  const wheel = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.86, metalness: 0.06 });
  const alloyMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.28, metalness: 0.85 });
  const rimStripeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.5 });
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.22, metalness: 0.94 });

  const majorR = outerRadius - tubeRadius;
  const tire = new THREE.Mesh(new THREE.TorusGeometry(majorR, tubeRadius, 12, 24), tireMat);
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);

  const rimBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(majorR - tubeRadius * 0.6, majorR - tubeRadius * 0.6, tubeRadius * 1.45, 18, 1, true),
    alloyMat
  );
  rimBarrel.rotation.z = Math.PI / 2;
  wheel.add(rimBarrel);

  const rimStripe = new THREE.Mesh(new THREE.TorusGeometry(majorR - tubeRadius * 0.68, 0.012, 8, 24), rimStripeMat);
  rimStripe.rotation.y = Math.PI / 2;
  rimStripe.position.x = tubeRadius * 0.68;
  wheel.add(rimStripe);
  const rimStripeL = rimStripe.clone();
  rimStripeL.position.x = -tubeRadius * 0.68;
  wheel.add(rimStripeL);

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, majorR * 0.95, 0.032), alloyMat);
    spoke.position.set(0, Math.cos(angle) * (majorR * 0.45), Math.sin(angle) * (majorR * 0.45));
    spoke.rotation.x = angle;
    wheel.add(spoke);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, tubeRadius * 2.1, 12), alloyMat);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);

  const rotor = new THREE.Mesh(
    new THREE.CylinderGeometry(isFront ? 0.16 : 0.13, isFront ? 0.16 : 0.13, 0.016, 18),
    rotorMat
  );
  rotor.rotation.z = Math.PI / 2;
  rotor.position.x = isFront ? -0.095 : 0.095;
  wheel.add(rotor);

  return wheel;
}

export function buildHeroMotorcycle(
  textures: ProceduralTextureSet,
  bikeId: BikeTierId = 'glamour_125'
): HeroBikeRig {
  const root = new THREE.Group();
  root.scale.setScalar(GAME_CONFIG.BIKE_SCALE);
  addContactShadow(root, textures.contactShadow, 1.65, 3.0);

  const leanGroup = new THREE.Group();
  root.add(leanGroup);

  const isXtreme = bikeId === 'xtreme_160r';
  const isKarizma = bikeId === 'karizma_210';

  const tankTex = isKarizma
    ? textures.heroTankKarizma
    : isXtreme
      ? textures.heroTankXtreme
      : textures.heroTank;

  const primaryTint = isKarizma ? 0x059669 : isXtreme ? 0x1e293b : 0xdc2626;
  const cowlColor = isKarizma ? 0x047857 : isXtreme ? 0xf59e0b : 0xb91c1c;
  const trimAccentColor = isKarizma ? 0xfacc15 : isXtreme ? 0xef4444 : 0xf59e0b;

  const redPaint = new THREE.MeshPhysicalMaterial({
    color: isKarizma || isXtreme ? 0xffffff : primaryTint,
    roughness: 0.18,
    metalness: 0.52,
    clearcoat: 0.96,
    clearcoatRoughness: 0.06,
    map: tankTex,
  });
  const redCowl = new THREE.MeshPhysicalMaterial({
    color: cowlColor,
    roughness: 0.22,
    metalness: 0.45,
    clearcoat: 0.88,
  });
  const matteBlack = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72, metalness: 0.25 });
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.36, metalness: 0.78 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.14, metalness: 0.95 });
  const goldForkMat = new THREE.MeshStandardMaterial({
    color: isKarizma ? 0xfde047 : 0xf59e0b,
    roughness: 0.22,
    metalness: 0.88,
  });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88, metalness: 0.04 });
  const tintedGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x09090b,
    roughness: 0.08,
    metalness: 0.2,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.82,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0x991b1b,
    emissiveIntensity: 1.0,
    roughness: 0.2,
  });

  const rearRadius = 0.33;
  const frontRadius = 0.33;
  const rearWheel = makeSportBikeWheel(rearRadius, 0.095, false);
  rearWheel.position.set(0, rearRadius, 0.82);
  leanGroup.add(rearWheel);

  const frontWheel = makeSportBikeWheel(frontRadius, 0.075, true);
  frontWheel.position.set(0, frontRadius, -0.82);

  for (const sx of [-0.14, 0.14]) {
    const swingarm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.76), gunmetal);
    swingarm.position.set(sx, 0.35, 0.48);
    swingarm.rotation.x = 0.07;
    leanGroup.add(swingarm);

    const shockSpring = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.36, 10), redCowl);
    shockSpring.position.set(sx * 1.1, 0.56, 0.62);
    shockSpring.rotation.x = 0.42;
    leanGroup.add(shockSpring);
  }

  const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.42), gunmetal);
  engineBlock.position.set(0, 0.42, 0.02);
  engineBlock.castShadow = true;
  leanGroup.add(engineBlock);

  for (let fy = 0; fy < 4; fy++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.022, 0.28), chromeMat);
    fin.position.set(0, 0.47 + fy * 0.048, -0.05);
    leanGroup.add(fin);
  }

  const crankcaseL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 12), chromeMat);
  crankcaseL.rotation.z = Math.PI / 2;
  crankcaseL.position.set(-0.17, 0.34, 0.06);
  leanGroup.add(crankcaseL);
  const crankcaseR = crankcaseL.clone();
  crankcaseR.position.x = 0.17;
  leanGroup.add(crankcaseR);

  for (const sx of [-0.16, 0.16]) {
    const spar = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.085, 0.92), matteBlack);
    spar.position.set(sx, 0.68, -0.02);
    spar.rotation.x = 0.22;
    leanGroup.add(spar);
  }

  const tankShape = new THREE.Shape();
  tankShape.moveTo(-0.34, 0.0);
  tankShape.lineTo(0.34, 0.0);
  tankShape.quadraticCurveTo(0.36, 0.18, 0.14, 0.29);
  tankShape.quadraticCurveTo(-0.08, 0.34, -0.3, 0.16);
  tankShape.closePath();

  const tankGeo = new THREE.ExtrudeGeometry(tankShape, {
    depth: 0.36,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 2,
  });
  tankGeo.center();
  tankGeo.rotateY(Math.PI / 2);

  const tank = new THREE.Mesh(tankGeo, redPaint);
  tank.position.set(0, 0.85, -0.18);
  tank.castShadow = true;
  leanGroup.add(tank);

  const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.03, 12), chromeMat);
  fuelCap.position.set(0, 1.02, -0.2);
  leanGroup.add(fuelCap);

  const fuelPortTip = new THREE.Object3D();
  fuelPortTip.position.set(0, 1.05, -0.2);
  leanGroup.add(fuelPortTip);

  for (const sx of [-0.21, 0.21]) {
    const shroud = new THREE.Mesh(
      new THREE.BoxGeometry(isKarizma ? 0.075 : 0.05, isKarizma ? 0.32 : isXtreme ? 0.28 : 0.24, isKarizma ? 0.56 : 0.36),
      redCowl
    );
    shroud.position.set(sx, isKarizma ? 0.74 : 0.78, -0.32);
    shroud.rotation.x = 0.24;
    shroud.rotation.y = sx > 0 ? -0.15 : 0.15;
    leanGroup.add(shroud);
  }

  // Tier 2 / Tier 3 sculpted belly pan & aerodynamic lower fairings
  if (isXtreme || isKarizma) {
    const bellyPan = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.16, 0.56),
      isKarizma ? matteBlack : redCowl
    );
    bellyPan.position.set(0, 0.25, -0.06);
    bellyPan.rotation.x = -0.14;
    leanGroup.add(bellyPan);
  }

  if (isKarizma) {
    // Full-faired side wings + front titanium ram/bull bumper
    for (const sx of [-0.24, 0.24]) {
      const sideFairing = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.64), redCowl);
      sideFairing.position.set(sx, 0.58, -0.38);
      sideFairing.rotation.x = 0.12;
      leanGroup.add(sideFairing);

      const goldAccent = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.07, 0.58),
        new THREE.MeshStandardMaterial({ color: trimAccentColor, roughness: 0.25, metalness: 0.85 })
      );
      goldAccent.position.set(sx, 0.62, -0.38);
      leanGroup.add(goldAccent);
    }

    const ramBar = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.032, 8, 16, Math.PI),
      goldForkMat
    );
    ramBar.rotation.x = Math.PI / 2;
    ramBar.rotation.z = Math.PI;
    ramBar.position.set(0, 0.52, -0.92);
    leanGroup.add(ramBar);
  }

  const seatShape = new THREE.Shape();
  seatShape.moveTo(-0.42, 0.0);
  seatShape.lineTo(0.42, 0.02);
  seatShape.lineTo(0.4, 0.15);
  seatShape.lineTo(0.06, 0.16);
  seatShape.quadraticCurveTo(-0.08, 0.08, -0.4, 0.09);
  seatShape.closePath();

  const seatGeo = new THREE.ExtrudeGeometry(seatShape, {
    depth: 0.26,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  seatGeo.center();
  seatGeo.rotateY(Math.PI / 2);
  const seat = new THREE.Mesh(seatGeo, seatMat);
  seat.position.set(0, 0.8, 0.44);
  seat.castShadow = true;
  leanGroup.add(seat);

  const tailCowl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.44), redCowl);
  tailCowl.position.set(0, 0.84, 0.8);
  tailCowl.rotation.x = -0.18;
  leanGroup.add(tailCowl);

  const grabRail = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 12, Math.PI), gunmetal);
  grabRail.rotation.x = Math.PI / 2 - 0.18;
  grabRail.position.set(0, 0.91, 0.94);
  leanGroup.add(grabRail);

  const rearFender = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.34), matteBlack);
  rearFender.position.set(0, 0.65, 0.98);
  rearFender.rotation.x = -0.78;
  leanGroup.add(rearFender);

  const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.075, 0.07), brakeLightMat);
  tailLight.position.set(0, 0.84, 1.01);
  leanGroup.add(tailLight);

  const exhaustCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.08, 0.44, -0.18),
    new THREE.Vector3(0.21, 0.26, 0.04),
    new THREE.Vector3(0.24, 0.3, 0.38),
    new THREE.Vector3(0.25, 0.48, 0.88),
  ]);
  const exhaustHeader = new THREE.Mesh(new THREE.TubeGeometry(exhaustCurve, 16, 0.032, 8, false), chromeMat);
  exhaustHeader.castShadow = true;
  leanGroup.add(exhaustHeader);

  const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.56, 12), gunmetal);
  muffler.rotation.x = Math.PI / 2 - 0.28;
  muffler.position.set(0.25, 0.46, 0.78);
  muffler.castShadow = true;
  leanGroup.add(muffler);

  const mufflerShield = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.42), chromeMat);
  mufflerShield.rotation.x = -0.28;
  mufflerShield.position.set(0.31, 0.46, 0.78);
  leanGroup.add(mufflerShield);

  if (isXtreme || isKarizma) {
    // Left twin sport exhaust cannon for upgraded Hero bikes
    const mufflerL = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.54, 12), gunmetal);
    mufflerL.rotation.x = Math.PI / 2 - 0.28;
    mufflerL.position.set(-0.25, 0.46, 0.78);
    mufflerL.castShadow = true;
    const shieldL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.4), isKarizma ? goldForkMat : chromeMat);
    shieldL.rotation.x = -0.28;
    shieldL.position.set(-0.31, 0.46, 0.78);
    leanGroup.add(mufflerL, shieldL);
  }

  const exhaustTip = new THREE.Object3D();
  exhaustTip.position.set(0.25, 0.55, 1.06);
  leanGroup.add(exhaustTip);

  const flameMat = new THREE.MeshBasicMaterial({
    color: isKarizma ? 0x34d399 : isXtreme ? 0xfbbf24 : 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });
  const boostFlame = new THREE.Mesh(new THREE.ConeGeometry(isKarizma ? 0.12 : 0.09, isKarizma ? 0.78 : 0.62, 10), flameMat);
  boostFlame.rotation.x = Math.PI / 2;
  boostFlame.position.set(0.25, 0.57, 1.32);
  boostFlame.visible = false;
  leanGroup.add(boostFlame);

  const frontFork = new THREE.Group();
  leanGroup.add(frontFork);
  frontFork.add(frontWheel);

  for (const sx of [-0.115, 0.115]) {
    const lowerLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.48, 8), gunmetal);
    lowerLeg.position.set(sx, 0.52, -0.74);
    lowerLeg.rotation.x = 0.34;
    frontFork.add(lowerLeg);

    const upperTube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.44, 8), goldForkMat);
    upperTube.position.set(sx, 0.83, -0.61);
    upperTube.rotation.x = 0.34;
    frontFork.add(upperTube);
  }

  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.09), redCowl);
  caliper.position.set(-0.11, 0.42, -0.69);
  frontFork.add(caliper);

  const fender = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.48), redCowl);
  fender.position.set(0, 0.68, -0.8);
  fender.rotation.x = 0.2;
  frontFork.add(fender);

  const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.26), redCowl);
  cowl.position.set(0, 0.94, -0.7);
  cowl.rotation.x = 0.28;
  frontFork.add(cowl);

  const windscreen = new THREE.Mesh(
    new THREE.BoxGeometry(isKarizma ? 0.34 : 0.24, isKarizma ? 0.32 : 0.2, 0.04),
    tintedGlassMat
  );
  windscreen.position.set(0, isKarizma ? 1.15 : 1.1, -0.64);
  windscreen.rotation.x = -0.65;
  frontFork.add(windscreen);

  const headlightLens = new THREE.Mesh(
    new THREE.BoxGeometry(isKarizma ? 0.28 : 0.2, 0.13, 0.05),
    new THREE.MeshStandardMaterial({
      color: isKarizma ? 0xd1fae5 : 0xfef9c3,
      emissive: isKarizma ? 0x6ee7b7 : isXtreme ? 0xfef08a : 0xfef08a,
      emissiveIntensity: isKarizma ? 2.6 : 2.1,
      roughness: 0.1,
    })
  );
  headlightLens.position.set(0, 0.93, -0.82);
  headlightLens.rotation.x = 0.2;
  frontFork.add(headlightLens);

  const blinkerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.9 });
  for (const sx of [-0.18, 0.18]) {
    const blinker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.05), blinkerMat);
    blinker.position.set(sx, 0.97, -0.68);
    frontFork.add(blinker);
  }

  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.1), matteBlack);
  dash.position.set(0, 1.05, -0.58);
  dash.rotation.x = -0.55;
  frontFork.add(dash);

  const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 8), gunmetal);
  handlebar.rotation.z = Math.PI / 2;
  handlebar.position.set(0, 1.04, -0.52);
  frontFork.add(handlebar);

  for (const sx of [-0.32, 0.32]) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.14, 8), seatMat);
    grip.rotation.z = Math.PI / 2;
    grip.position.set(sx, 1.04, -0.52);
    frontFork.add(grip);

    const mirrorStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.18, 6), matteBlack);
    mirrorStalk.position.set(sx * 0.92, 1.13, -0.53);
    mirrorStalk.rotation.z = sx > 0 ? -0.35 : 0.35;
    frontFork.add(mirrorStalk);

    const mirrorHead = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.065, 0.03), matteBlack);
    mirrorHead.position.set(sx * 1.1, 1.21, -0.53);
    frontFork.add(mirrorHead);
  }

  // Rider
  const jacketMat = new THREE.MeshStandardMaterial({
    color: isKarizma ? 0x064e3b : isXtreme ? 0x1f2937 : 0x0f172a,
    roughness: 0.7,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: trimAccentColor,
    roughness: 0.4,
  });
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: isKarizma ? 0x10b981 : isXtreme ? 0xf59e0b : 0xef4444,
    roughness: 0.15,
    metalness: 0.45,
    clearcoat: 0.94,
  });
  const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x09090b, roughness: 0.08, metalness: 0.88, clearcoat: 1.0 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.25), jacketMat);
  torso.position.set(0, 1.18, 0.16);
  torso.rotation.x = 0.44;
  torso.castShadow = true;
  leanGroup.add(torso);

  const jacketStripe = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.1, 0.26), accentMat);
  jacketStripe.position.set(0, 1.24, 0.18);
  jacketStripe.rotation.x = 0.44;
  leanGroup.add(jacketStripe);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), helmetMat);
  helmet.position.set(0, 1.52, -0.04);
  helmet.castShadow = true;
  leanGroup.add(helmet);

  const chinBar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.11, 0.18), helmetMat);
  chinBar.position.set(0, 1.44, -0.11);
  leanGroup.add(chinBar);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.14), visorMat);
  visor.position.set(0, 1.52, -0.15);
  leanGroup.add(visor);

  const armGeo = new THREE.BoxGeometry(0.105, 0.42, 0.105);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.82 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.65 });

  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), accentMat);
    shoulder.position.set(sx * 0.21, 1.33, 0.04);
    leanGroup.add(shoulder);

    const arm = new THREE.Mesh(armGeo, jacketMat);
    arm.position.set(sx * 0.26, 1.17, -0.24);
    arm.rotation.x = 1.08;
    arm.rotation.z = sx * 0.18;
    leanGroup.add(arm);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.15), legMat);
    thigh.position.set(sx * 0.21, 0.77, 0.16);
    thigh.rotation.x = -0.68;
    leanGroup.add(thigh);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.13), legMat);
    shin.position.set(sx * 0.22, 0.54, 0.09);
    shin.rotation.x = 0.26;
    leanGroup.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.22), bootMat);
    boot.position.set(sx * 0.22, 0.36, 0.08);
    leanGroup.add(boot);
  }

  return {
    group: root,
    leanGroup,
    frontFork,
    frontWheel,
    rearWheel,
    exhaustTip,
    fuelPortTip,
    brakeLightMat,
    boostFlame,
  };
}

export function buildMetroRailViaductSegment(
  textures: ProceduralTextureSet,
  blockLen: number,
  hasIntersection: boolean,
  blockIdx = 0
): THREE.Group {
  const metro = new THREE.Group();

  // বৈশাখী মেলার রংতুলি — the whole viaduct structure is hand-painted in
  // festive Boishakhi-Mela / rickshaw-art colours. Each city block gets a
  // different mix, and the two piers inside a block never match.
  const BOISHAKHI_PALETTE = [
    0xdc2626, // লাল — Boishakhi crimson
    0xf59e0b, // সরিষা হলুদ — marigold yellow
    0x059669, // ধান-সবুজ — paddy emerald
    0x0ea5e9, // আকাশি — monsoon sky blue
    0xf97316, // কমলা — tangerine
    0xec4899, // রিকশা গোলাপি — rickshaw pink
    0x7c3aed, // জাম — festival purple
    0x0d9488, // টিয়া — teal
  ];
  const pal = (offset: number) =>
    BOISHAKHI_PALETTE[((blockIdx + offset) % BOISHAKHI_PALETTE.length + BOISHAKHI_PALETTE.length) % BOISHAKHI_PALETTE.length];
  const paintMat = (offset: number): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color: pal(offset), roughness: 0.62, metalness: 0.04 });

  // Warm cream deck + deep teal pier bases keep the riot of colour grounded.
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });
  const girderMat = paintMat(0);
  const deckMat = creamMat;
  const parapetMat = paintMat(1);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x115e59, roughness: 0.78 });
  const railSteelMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.85, roughness: 0.3 });
  const bannerMat = new THREE.MeshBasicMaterial({ map: textures.metroBanner });
  const pillarSignMat = new THREE.MeshBasicMaterial({ map: textures.pillarSign });

  const girderBottom = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.95, blockLen), girderMat);
  girderBottom.position.set(0, 6.45, 0);
  girderBottom.castShadow = true;
  girderBottom.receiveShadow = true;
  metro.add(girderBottom);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.45, blockLen), deckMat);
  deck.position.set(0, 7.12, 0);
  deck.castShadow = true;
  metro.add(deck);

  for (const sx of [-3.05, 3.05]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, blockLen), parapetMat);
    parapet.position.set(sx, 7.65, 0);
    metro.add(parapet);
  }

  for (const rx of [-1.45, 1.45]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, blockLen), railSteelMat);
    rail.position.set(rx, 7.42, 0);
    metro.add(rail);
  }

  for (const sx of [-3.22, 3.22]) {
    const sideBanner = new THREE.Mesh(new THREE.PlaneGeometry(18, 2.2), bannerMat);
    sideBanner.position.set(sx, 7.15, 0);
    sideBanner.rotation.y = sx < 0 ? -Math.PI / 2 : Math.PI / 2;
    metro.add(sideBanner);
  }

  if (!hasIntersection) {
    const frontBanner = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.35), bannerMat);
    frontBanner.position.set(0, 5.35, 14);
    metro.add(frontBanner);

    const backBanner = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 1.35), bannerMat);
    backBanner.position.set(0, 5.35, 13.9);
    backBanner.rotation.y = Math.PI;
    metro.add(backBanner);
  }

  const pierOffsets = hasIntersection ? [-28, 28] : [-24, 16];
  for (let pierIdx = 0; pierIdx < pierOffsets.length; pierIdx++) {
    const pz = pierOffsets[pierIdx];
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 2.4), baseMat);
    base.position.set(0, 0.3, pz);
    metro.add(base);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 5.4, 10), paintMat(2 + pierIdx * 2));
    column.position.set(0, 3.0, pz);
    column.castShadow = true;
    metro.add(column);

    const pierCap = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.75, 1.8), creamMat);
    pierCap.position.set(0, 5.85, pz);
    pierCap.castShadow = true;
    metro.add(pierCap);

    // Eye-level Bangla / Nitol-Niloy Pillar Sign on pier faces!
    const pSignL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 1.25), pillarSignMat);
    pSignL.position.set(-0.76, 2.05, pz);
    const pSignR = pSignL.clone();
    pSignR.position.x = 0.76;
    const pSignF = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.15, 0.08), pillarSignMat);
    pSignF.position.set(0, 2.05, pz + 0.76);
    metro.add(pSignL, pSignR, pSignF);
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8), railSteelMat);
  mast.position.set(0, 8.9, -12);
  metro.add(mast);

  const crossArm = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 0.12), railSteelMat);
  crossArm.position.set(0, 10.2, -12);
  metro.add(crossArm);

  return metro;
}

export function buildMetroTrain(textures: ProceduralTextureSet): THREE.Group {
  const train = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: textures.metroTrainSide,
    roughness: 0.25,
    metalness: 0.25,
    clearcoat: 0.8,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
  const frontGlassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.12, metalness: 0.7 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef08a, emissiveIntensity: 1.8 });

  for (let i = 0; i < 4; i++) {
    const carZ = (i - 1.5) * 14.8;
    const car = new THREE.Mesh(new THREE.BoxGeometry(2.65, 2.75, 13.8), bodyMat);
    car.position.set(0, 1.55, carZ);
    car.castShadow = true;
    train.add(car);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.28, 13.6), roofMat);
    roof.position.set(0, 3.02, carZ);
    train.add(roof);
  }

  for (const endSign of [-1, 1]) {
    const endZ = endSign * 29.2;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.15, 0.15), frontGlassMat);
    windshield.position.set(0, 2.05, endZ);
    train.add(windshield);

    for (const hx of [-0.78, 0.78]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.15), headMat);
      hl.position.set(hx, 0.95, endZ);
      train.add(hl);
    }
  }

  return train;
}

const RANDOM_TINTS = [0xf8fafc, 0x94a3b8, 0x0284c7, 0xd97706, 0x334155, 0x0d9488, 0xb91c1c, 0x4338ca];

export function buildTrafficVehicle(
  kind: VehicleKind,
  textures: ProceduralTextureSet,
  variantIdx = 0
): TrafficModelRig {
  const spec = VEHICLE_SPECS[kind];
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const tintHex = spec.canTint ? RANDOM_TINTS[variantIdx % RANDOM_TINTS.length] : 0xffffff;
  const isLarge = spec.tier === 'large';

  // === SMALL TIER ===
  if (kind === 'cycle') {
    addContactShadow(group, textures.contactShadow, 0.9, 2.0);
    const frameMat = new THREE.MeshStandardMaterial({ color: tintHex, roughness: 0.32, metalness: 0.65 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.9 });
    const shirtColors = [0x0284c7, 0xd97706, 0x059669, 0xe11d48];
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColors[variantIdx % shirtColors.length], roughness: 0.75 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xb47b56, roughness: 0.75 });

    const makeCycleWheel = () => {
      const w = new THREE.Group();
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.038, 8, 20),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 })
      );
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      w.add(tire);
      for (let s = 0; s < 4; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.6, 0.015), chromeMat);
        spoke.rotation.x = (s / 4) * Math.PI;
        w.add(spoke);
      }
      return w;
    };

    const wF = makeCycleWheel();
    wF.position.set(0, 0.35, -0.62);
    const wR = makeCycleWheel();
    wR.position.set(0, 0.35, 0.62);
    group.add(wF, wR);
    wheels.push(wF, wR);

    // Diamond bicycle frame + fork + handlebars + basket + rear rack
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.76, 6), frameMat);
    topBar.rotation.x = Math.PI / 2;
    topBar.position.set(0, 0.78, -0.05);
    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.56, 6), frameMat);
    seatPost.position.set(0, 0.62, 0.25);
    seatPost.rotation.x = -0.22;
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.024, 0.68, 6), frameMat);
    fork.position.set(0, 0.66, -0.5);
    fork.rotation.x = 0.28;
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.54, 6), chromeMat);
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 0.98, -0.44);
    const carrier = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.42), chromeMat);
    carrier.position.set(0, 0.72, 0.58);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.22), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    basket.position.set(0, 0.84, -0.58);
    const tailReflector = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.4 })
    );
    tailReflector.position.set(0, 0.71, 0.8);
    group.add(topBar, seatPost, fork, handlebar, carrier, basket, tailReflector);

    // Cyclist
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.54, 0.22), shirtMat);
    torso.position.set(0, 1.12, 0.04);
    torso.rotation.x = 0.36;
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skinMat);
    head.position.set(0, 1.46, -0.1);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.148, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshStandardMaterial({ color: 0xfacc15 })
    );
    cap.position.set(0, 1.48, -0.1);
    group.add(torso, head, cap);

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  if (kind === 'rickshaw') {
    addContactShadow(group, textures.contactShadow, 1.45, 2.6);
    const hoodColors = [0xdc2626, 0x2563eb, 0x059669, 0xd97706];
    const hoodMat = new THREE.MeshStandardMaterial({ color: hoodColors[variantIdx % hoodColors.length], roughness: 0.55 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.5, metalness: 0.6 });
    const backArtMat = new THREE.MeshBasicMaterial({
      map: textures.rickshawBacks[variantIdx % textures.rickshawBacks.length],
    });

    const wF = makeWheel(0.28, 0.07, 0xd1d5db);
    wF.position.set(0, 0.28, -0.92);
    const wRL = makeWheel(0.28, 0.07, 0xd1d5db);
    wRL.position.set(-0.56, 0.28, 0.56);
    const wRR = makeWheel(0.28, 0.07, 0xd1d5db);
    wRR.position.set(0.56, 0.28, 0.56);
    group.add(wF, wRL, wRR);
    wheels.push(wF, wRL, wRR);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.36, 1.16), metalMat);
    deck.position.set(0, 0.48, 0.5);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.98, 1.0), hoodMat);
    hood.position.set(0, 1.12, 0.56);
    hood.castShadow = true;
    const canopyTrim = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.04), trimMat);
    canopyTrim.position.set(0, 1.62, 0.56);

    // Prominent Dhaka Rickshaw Back Art Sign ("বৌয়ের দোয়া পরিবহন"!) facing +Z rear traffic
    const backArt = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.72, 0.06), backArtMat);
    backArt.position.set(0, 1.14, 1.07);

    const lowerArt = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.32, 0.06), trimMat);
    lowerArt.position.set(0, 0.52, 1.09);

    const puller = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.54, 0.22),
      new THREE.MeshStandardMaterial({ color: variantIdx % 2 === 0 ? 0x0d9488 : 0xe11d48 })
    );
    puller.position.set(0, 1.02, -0.45);
    puller.rotation.x = 0.25;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xb47b56 }));
    head.position.set(0, 1.38, -0.52);
    group.add(deck, hood, canopyTrim, backArt, lowerArt, puller, head);

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  if (kind === 'vangari') {
    addContactShadow(group, textures.contactShadow, 1.5, 2.7);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.55 });
    const cargoMat = new THREE.MeshStandardMaterial({ color: tintHex, roughness: 0.75 });
    const backMat = new THREE.MeshBasicMaterial({ map: textures.vangariBack });

    const wF = makeWheel(0.26, 0.07);
    wF.position.set(0, 0.26, -0.95);
    const wRL = makeWheel(0.28, 0.08);
    wRL.position.set(-0.6, 0.28, 0.6);
    const wRR = makeWheel(0.28, 0.08);
    wRR.position.set(0.6, 0.28, 0.6);
    group.add(wF, wRL, wRR);
    wheels.push(wF, wRL, wRR);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.2, 1.48), woodMat);
    bed.position.set(0, 0.48, 0.55);
    bed.castShadow = true;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.54, 1.05), cargoMat);
    crate.position.set(0, 0.85, 0.55);
    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.48, 0.06), backMat);
    backPlate.position.set(0, 0.74, 1.29);
    const driver = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.54, 0.22), metalMat);
    driver.position.set(0, 0.98, -0.5);
    group.add(bed, crate, backPlate, driver);

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  if (kind === 'cng') {
    addContactShadow(group, textures.contactShadow, 1.6, 2.5);
    const cngGreen = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.36, metalness: 0.24 });
    const hoodYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.68, metalness: 0.08 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.12, metalness: 0.3 });
    const backArtMat = new THREE.MeshBasicMaterial({
      map: textures.cngBacks[variantIdx % textures.cngBacks.length],
    });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.64, 2.04), cngGreen);
    body.position.set(0, 0.54, 0);
    body.castShadow = true;
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.56, 0.54), cngGreen);
    nose.position.set(0, 0.52, -0.98);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.62, 1.72), hoodYellow);
    roof.position.set(0, 1.15, 0.1);
    roof.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.42, 0.08), glassMat);
    windshield.position.set(0, 1.05, -0.76);

    // Prominent CNG Rear Bumper Plate ("ভাই ভাই পরিবহন"!) facing +Z rear traffic
    const backSign = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.56, 0.06), backArtMat);
    backSign.position.set(0, 0.68, 1.04);

    for (const tx of [-0.46, 0.46]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.06), tailMat);
      tl.position.set(tx, 0.42, 1.04);
      group.add(tl);
    }
    group.add(body, nose, roof, windshield, backSign);

    const wF = makeWheel(0.22, 0.13);
    wF.position.set(0, 0.22, -0.96);
    const wRL = makeWheel(0.22, 0.14);
    wRL.position.set(-0.62, 0.22, 0.66);
    const wRR = makeWheel(0.22, 0.14);
    wRR.position.set(0.62, 0.22, 0.66);
    group.add(wF, wRL, wRR);
    wheels.push(wF, wRL, wRR);

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  if (kind === 'biker') {
    addContactShadow(group, textures.contactShadow, 1.0, 2.0);
    const paint = new THREE.MeshStandardMaterial({ color: tintHex, roughness: 0.3, metalness: 0.45 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.75 });

    const wF = makeWheel(0.27, 0.11);
    wF.position.set(0, 0.27, -0.66);
    const wR = makeWheel(0.27, 0.13);
    wR.position.set(0, 0.27, 0.66);
    group.add(wF, wR);
    wheels.push(wF, wR);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 1.24), paint);
    body.position.set(0, 0.62, 0);
    body.castShadow = true;
    const riderBody = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.22), dark);
    riderBody.position.set(0, 1.04, 0.08);
    riderBody.rotation.x = 0.28;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf3f4f6 }));
    helmet.position.set(0, 1.36, -0.02);
    group.add(body, riderBody, helmet);

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  // === MEDIUM CARS, TAXI, SPORT, MUSCLE, PICKUP, LEGUNA, SERVICE VANS ===
  if (
    kind === 'hatchback' ||
    kind === 'car' ||
    kind === 'taxi' ||
    kind === 'sport' ||
    kind === 'muscle'
  ) {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.4, len + 0.5);

    const bodyColor =
      kind === 'taxi' ? 0xfacc15 : kind === 'sport' ? 0xe11d48 : kind === 'muscle' ? 0xf97316 : tintHex;
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: bodyColor,
      roughness: 0.24,
      metalness: 0.5,
      clearcoat: 0.85,
    });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.12, metalness: 0.65 });

    const chassisH = kind === 'sport' ? 0.5 : 0.58;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(wid, chassisH, len), bodyMat);
    chassis.position.set(0, 0.5, 0);
    chassis.castShadow = true;
    group.add(chassis);

    const cabinLen = kind === 'hatchback' ? len * 0.62 : len * 0.5;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.84, 0.48, cabinLen), glassMat);
    cabin.position.set(0, 0.98, kind === 'hatchback' ? 0.25 : 0.1);
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.8, 0.08, cabinLen * 0.86), bodyMat);
    roof.position.set(0, 1.24, kind === 'hatchback' ? 0.25 : 0.1);
    group.add(roof);

    if (kind === 'taxi') {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.18, 0.26), new THREE.MeshStandardMaterial({ color: 0x111827 }));
      sign.position.set(0, 1.36, 0.1);
      group.add(sign);
    } else if (kind === 'sport') {
      const spoiler = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, 0.07, 0.24), glassMat);
      spoiler.position.set(0, 0.92, len * 0.45);
      group.add(spoiler);
    } else if (kind === 'muscle') {
      const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.72), glassMat);
      scoop.position.set(0, 0.84, -len * 0.26);
      group.add(scoop);
    }

    const headMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef08a, emissiveIntensity: 1.0 });
    for (const sx of [-wid * 0.34, wid * 0.34]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), headMat);
      h.position.set(sx, 0.54, -len / 2 - 0.02);
      group.add(h);
    }

    const wz = len * 0.32;
    const wx = wid * 0.46;
    for (const [px, pz] of [
      [-wx, -wz],
      [wx, -wz],
      [-wx, wz],
      [wx, wz],
    ]) {
      const w = makeWheel(0.29, 0.2);
      w.position.set(px, 0.29, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  if (kind === 'suv_prado') {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.5, len + 0.5);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: variantIdx % 2 === 0 ? 0xf8fafc : 0x0f172a,
      roughness: 0.2,
      metalness: 0.48,
      clearcoat: 0.9,
    });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.7 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.92 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.74, len), bodyMat);
    chassis.position.set(0, 0.66, 0);
    chassis.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.62, len * 0.68), glassMat);
    cabin.position.set(0, 1.32, 0.25);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.88, 0.12, len * 0.66), bodyMat);
    roof.position.set(0, 1.66, 0.25);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.68, 0.36, 0.08), chromeMat);
    grille.position.set(0, 0.68, -len / 2 - 0.02);
    const spareWheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 })
    );
    spareWheel.rotation.x = Math.PI / 2;
    spareWheel.position.set(0, 0.92, len / 2 + 0.1);
    group.add(chassis, cabin, roof, grille, spareWheel);

    for (const [px, pz] of [
      [-wid * 0.46, -len * 0.32],
      [wid * 0.46, -len * 0.32],
      [-wid * 0.46, len * 0.32],
      [wid * 0.46, len * 0.32],
    ]) {
      const w = makeWheel(0.37, 0.24, 0xd1d5db);
      w.position.set(px, 0.37, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  if (kind === 'pickup') {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.4, len + 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({ color: tintHex, roughness: 0.34, metalness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.62, len), bodyMat);
    base.position.set(0, 0.56, 0);
    base.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.88, 0.66, 1.5), bodyMat);
    cab.position.set(0, 1.15, -0.65);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.82, 0.45, 0.1), glassMat);
    glass.position.set(0, 1.2, -1.4);
    group.add(base, cab, glass);

    for (const [px, pz] of [
      [-0.78, -1.3],
      [0.78, -1.3],
      [-0.78, 1.3],
      [0.78, 1.3],
    ]) {
      const w = makeWheel(0.34, 0.22);
      w.position.set(px, 0.34, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  if (
    kind === 'leguna' ||
    kind === 'van' ||
    kind === 'police' ||
    kind === 'ambulance' ||
    kind === 'rab'
  ) {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.4, len + 0.5);

    const liveryTex =
      kind === 'police'
        ? textures.policeLivery
        : kind === 'rab'
          ? textures.rabLivery
          : kind === 'ambulance'
            ? textures.ambulanceLivery
            : kind === 'leguna'
              ? textures.legunaLivery
              : null;

    const bodyMat = liveryTex
      ? new THREE.MeshStandardMaterial({ map: liveryTex, roughness: 0.35 })
      : new THREE.MeshStandardMaterial({ color: tintHex, roughness: 0.35, metalness: 0.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 1.28, len), bodyMat);
    body.position.set(0, 0.96, 0);
    body.castShadow = true;
    group.add(body);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.85, 0.52, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15 })
    );
    windshield.position.set(0, 1.24, -len / 2 - 0.02);
    group.add(windshield);

    // Police / RAB / Ambulance Roof Lightbar
    if (kind === 'police' || kind === 'rab' || kind === 'ambulance') {
      const barL = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.18, 0.28),
        new THREE.MeshStandardMaterial({
          color: kind === 'ambulance' ? 0xef4444 : 0x3b82f6,
          emissive: kind === 'ambulance' ? 0xdc2626 : 0x2563eb,
          emissiveIntensity: 2.0,
        })
      );
      barL.position.set(-0.24, 1.68, -0.4);
      const barR = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.18, 0.28),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 2.0 })
      );
      barR.position.set(0.24, 1.68, -0.4);
      group.add(barL, barR);
    }

    for (const [px, pz] of [
      [-wid * 0.45, -len * 0.32],
      [wid * 0.45, -len * 0.32],
      [-wid * 0.45, len * 0.32],
      [wid * 0.45, len * 0.32],
    ]) {
      const w = makeWheel(0.32, 0.22);
      w.position.set(px, 0.32, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge };
  }

  // === LARGE TIER: LIVERIED BUSES (NITOL, NITOL STAFF, BRTC, HANIF, SHOHAG) ===
  if (
    kind === 'bus_nitol' ||
    kind === 'bus_nitol_staff' ||
    kind === 'bus_brtc' ||
    kind === 'bus_hanif' ||
    kind === 'bus_shohag'
  ) {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.5, len + 0.7);

    const busTex =
      kind === 'bus_nitol'
        ? textures.busNitol
        : kind === 'bus_nitol_staff'
          ? textures.busNitolStaff
          : kind === 'bus_brtc'
            ? textures.busBrtc
            : kind === 'bus_hanif'
              ? textures.busHanif
              : textures.busShohag;

    const sideMat = new THREE.MeshStandardMaterial({ map: busTex, roughness: 0.36 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 2.05, len), sideMat);
    body.position.set(0, 1.44, 0);
    body.castShadow = true;
    group.add(body);

    const roofColor = kind === 'bus_nitol_staff' ? 0xfacc15 : 0xf8fafc;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.96, 0.22, len * 0.96),
      new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.45 })
    );
    roof.position.set(0, 2.55, 0);
    group.add(roof);

    if (kind === 'bus_nitol_staff') {
      // Corporate AC pods + glowing Nitol-Niloy Staff front destination bar
      const acMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      for (const acZ of [-1.4, 1.2]) {
        const acPod = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.26, 1.5), acMat);
        acPod.position.set(0, 2.76, acZ);
        group.add(acPod);
      }
      const destBar = new THREE.Mesh(
        new THREE.BoxGeometry(wid * 0.82, 0.24, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 1.4 })
      );
      destBar.position.set(0, 2.42, -len / 2 - 0.04);
      group.add(destBar);
    }

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.88, 0.85, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.12 })
    );
    windshield.position.set(0, 1.85, -len / 2 - 0.02);
    group.add(windshield);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfde047, emissiveIntensity: 1.5 });
    for (const sx of [-0.72, 0.72]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.1), headMat);
      h.position.set(sx, 0.68, -len / 2 - 0.03);
      group.add(h);
    }

    for (const [px, pz] of [
      [-wid * 0.45, -len * 0.32],
      [wid * 0.45, -len * 0.32],
      [-wid * 0.45, len * 0.3],
      [wid * 0.45, len * 0.3],
    ]) {
      const w = makeWheel(0.42, 0.28, 0x9ca3af);
      w.position.set(px, 0.42, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge: true };
  }

  // === LARGE TIER: BRTC DOUBLE-DECKER BUS (TITAN) ===
  if (kind === 'bus_double_decker') {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.6, len + 0.8);

    const sideMat = new THREE.MeshStandardMaterial({ map: textures.doubleDeckerLivery, roughness: 0.35 });
    const upperMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.36 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.14 });

    const lowerDeck = new THREE.Mesh(new THREE.BoxGeometry(wid, 1.75, len), sideMat);
    lowerDeck.position.set(0, 1.28, 0);
    lowerDeck.castShadow = true;
    const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.98, 1.65, len * 0.98), upperMat);
    upperDeck.position.set(0, 2.98, 0);
    upperDeck.castShadow = true;
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.95, 0.16, len * 0.96),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 })
    );
    roof.position.set(0, 3.86, 0);

    const lowerGlass = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.86, 0.72, 0.1), glassMat);
    lowerGlass.position.set(0, 1.52, -len / 2 - 0.02);
    const upperGlass = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.86, 0.72, 0.1), glassMat);
    upperGlass.position.set(0, 3.05, -len / 2 - 0.02);
    group.add(lowerDeck, upperDeck, roof, lowerGlass, upperGlass);

    for (const [px, pz] of [
      [-wid * 0.45, -len * 0.32],
      [wid * 0.45, -len * 0.32],
      [-wid * 0.45, len * 0.3],
      [wid * 0.45, len * 0.3],
    ]) {
      const w = makeWheel(0.44, 0.28, 0x9ca3af);
      w.position.set(px, 0.44, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge: true };
  }

  // === LARGE TIER: COVERED VAN ===
  if (kind === 'covered_van') {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.5, len + 0.6);

    const cabMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const boxMat = new THREE.MeshStandardMaterial({ map: textures.coveredVanLivery, roughness: 0.45 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15 });

    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 1.7, 1.8), cabMat);
    cab.position.set(0, 1.25, -len / 2 + 0.92);
    cab.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.78, 0.62, 0.1), glassMat);
    windshield.position.set(0, 1.58, -len / 2 + 0.01);
    const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(wid, 2.25, len - 1.95), boxMat);
    cargoBox.position.set(0, 1.65, 0.92);
    cargoBox.castShadow = true;
    group.add(cab, windshield, cargoBox);

    for (const [px, pz] of [
      [-wid * 0.44, -len * 0.32],
      [wid * 0.44, -len * 0.32],
      [-wid * 0.44, len * 0.28],
      [wid * 0.44, len * 0.28],
    ]) {
      const w = makeWheel(0.4, 0.26, 0xd1d5db);
      w.position.set(px, 0.4, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge: true };
  }

  // === LARGE TIER: NITOL CEMENT MIXER ===
  if (kind === 'cement_mixer') {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.5, len + 0.6);

    const cabMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.4 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const drumMat = new THREE.MeshStandardMaterial({ map: textures.cementMixerLivery, roughness: 0.42 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.45, len), frameMat);
    chassis.position.set(0, 0.65, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, 1.75, 1.85), cabMat);
    cab.position.set(0, 1.32, -len / 2 + 0.95);
    cab.castShadow = true;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.72, 3.6, 14), drumMat);
    drum.rotation.x = Math.PI / 2 - 0.24;
    drum.position.set(0, 1.92, 0.85);
    drum.castShadow = true;
    const chute = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 1.1), frameMat);
    chute.position.set(0, 1.35, len / 2 - 0.15);
    chute.rotation.x = 0.4;
    group.add(chassis, cab, drum, chute);

    for (const [px, pz] of [
      [-wid * 0.44, -len * 0.34],
      [wid * 0.44, -len * 0.34],
      [-wid * 0.44, len * 0.14],
      [wid * 0.44, len * 0.14],
      [-wid * 0.44, len * 0.36],
      [wid * 0.44, len * 0.36],
    ]) {
      const w = makeWheel(0.42, 0.28, 0xfacc15);
      w.position.set(px, 0.42, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge: true };
  }

  // === LARGE TIER: FUEL OIL TANKER (TITAN) ===
  if (kind === 'oil_tanker') {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.6, len + 0.7);

    const cabMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35 });
    const tankMat = new THREE.MeshPhysicalMaterial({
      map: textures.oilTankerLivery,
      roughness: 0.28,
      metalness: 0.45,
      clearcoat: 0.7,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });

    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(wid * 0.88, 0.4, len),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 })
    );
    chassis.position.set(0, 0.62, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.92, 1.85, 1.9), cabMat);
    cab.position.set(0, 1.38, -len / 2 + 0.96);
    cab.castShadow = true;
    const tankCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, len - 2.2, 16), tankMat);
    tankCyl.rotation.x = Math.PI / 2;
    tankCyl.position.set(0, 1.75, 0.95);
    tankCyl.castShadow = true;
    group.add(chassis, cab, tankCyl);

    for (const hz of [-0.6, 0.8, 2.2]) {
      const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.16, 10), chromeMat);
      hatch.position.set(0, 2.75, hz);
      group.add(hatch);
    }

    for (const [px, pz] of [
      [-wid * 0.44, -len * 0.35],
      [wid * 0.44, -len * 0.35],
      [-wid * 0.44, len * 0.12],
      [wid * 0.44, len * 0.12],
      [-wid * 0.44, len * 0.35],
      [wid * 0.44, len * 0.35],
    ]) {
      const w = makeWheel(0.43, 0.28, 0xd1d5db);
      w.position.set(px, 0.43, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge: true };
  }

  // === LARGE TIER: FIRE SERVICE TRUCK (TITAN) ===
  if (kind === 'fire_truck') {
    const len = spec.halfLength * 2;
    const wid = spec.halfWidth * 2;
    addContactShadow(group, textures.contactShadow, wid + 0.6, len + 0.7);

    const bodyMat = new THREE.MeshStandardMaterial({ map: textures.fireTruckLivery, roughness: 0.3 });
    const ladderMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.12 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 1.95, len), bodyMat);
    body.position.set(0, 1.42, 0);
    body.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.84, 0.68, 0.1), glassMat);
    windshield.position.set(0, 1.78, -len / 2 - 0.02);
    const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, len * 0.78), ladderMat);
    ladder.position.set(0, 2.52, 0.4);
    const sirenL = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.2, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 2.2 })
    );
    sirenL.position.set(-0.42, 2.48, -len / 2 + 0.85);
    const sirenR = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.2, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 2.2 })
    );
    sirenR.position.set(0.42, 2.48, -len / 2 + 0.85);
    group.add(body, windshield, ladder, sirenL, sirenR);

    for (const [px, pz] of [
      [-wid * 0.44, -len * 0.34],
      [wid * 0.44, -len * 0.34],
      [-wid * 0.44, len * 0.14],
      [wid * 0.44, len * 0.14],
      [-wid * 0.44, len * 0.36],
      [wid * 0.44, len * 0.36],
    ]) {
      const w = makeWheel(0.43, 0.28, 0xfacc15);
      w.position.set(px, 0.43, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge: true };
  }

  // === MONSTER TRUCK (LARGE) ===
  if (kind === 'monster') {
    addContactShadow(group, textures.contactShadow, 2.8, 5.4);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x9333ea, roughness: 0.25, clearcoat: 0.8 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 4.4), bodyMat);
    chassis.position.set(0, 1.38, 0);
    chassis.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.7, 1.9), bodyMat);
    cab.position.set(0, 2.15, -0.35);
    group.add(chassis, cab);

    for (const [px, pz] of [
      [-1.02, -1.45],
      [1.02, -1.45],
      [-1.02, 1.45],
      [1.02, 1.45],
    ]) {
      const w = makeWheel(0.68, 0.48, 0xfacc15);
      w.position.set(px, 0.68, pz);
      group.add(w);
      wheels.push(w);
    }

    return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge: true };
  }

  // === CARGO TRUCK & BANGLADESH ARMY VAN (LARGE) ===
  const isArmy = kind === 'army';
  const len = spec.halfLength * 2;
  const wid = spec.halfWidth * 2;
  addContactShadow(group, textures.contactShadow, wid + 0.5, len + 0.6);

  const cabMat = new THREE.MeshStandardMaterial({
    color: isArmy ? 0x3f6212 : 0x0284c7,
    roughness: isArmy ? 0.65 : 0.35,
  });
  const bedMat = new THREE.MeshStandardMaterial({
    map: isArmy ? textures.armyLivery : textures.truckArt,
    roughness: 0.55,
  });

  const cab = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.95, 1.75, 1.95), cabMat);
  cab.position.set(0, 1.28, -len / 2 + 1.0);
  cab.castShadow = true;
  const cargoBed = new THREE.Mesh(new THREE.BoxGeometry(wid, 1.95, len - 2.1), bedMat);
  cargoBed.position.set(0, 1.6, 0.95);
  cargoBed.castShadow = true;
  group.add(cab, cargoBed);

  for (const [px, pz] of [
    [-wid * 0.44, -len * 0.32],
    [wid * 0.44, -len * 0.32],
    [-wid * 0.44, len * 0.14],
    [wid * 0.44, len * 0.14],
    [-wid * 0.44, len * 0.36],
    [wid * 0.44, len * 0.36],
  ]) {
    const w = makeWheel(0.42, 0.28, isArmy ? 0x365314 : 0xd1d5db);
    w.position.set(px, 0.42, pz);
    group.add(w);
    wheels.push(w);
  }

  return { group, wheels, halfWidth: spec.halfWidth, halfLength: spec.halfLength, isLarge: true };
}

export function buildPedestrian(shirtColor: number, pantsColor = 0x1e293b): PedestrianRig {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb47b56, roughness: 0.75 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });

  const legGeo = new THREE.BoxGeometry(0.14, 0.68, 0.16);
  legGeo.translate(0, -0.34, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.11, 0.68, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.11, 0.68, 0);
  rightLeg.castShadow = true;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.24), shirtMat);
  torso.position.set(0, 1.0, 0);
  torso.castShadow = true;

  const armGeo = new THREE.BoxGeometry(0.12, 0.52, 0.13);
  armGeo.translate(0, -0.24, 0);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.28, 1.26, 0);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.set(0.28, 1.26, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skinMat);
  head.position.set(0, 1.48, 0);
  head.castShadow = true;

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.set(0, 1.5, 0);

  // Floating red anger exclamation marker when chasing player
  const angryBadge = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.36, 6),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  angryBadge.rotation.x = Math.PI;
  angryBadge.position.set(0, 2.02, 0);
  angryBadge.visible = false;

  group.add(leftLeg, rightLeg, torso, leftArm, rightArm, head, hair, angryBadge);
  return { group, leftLeg, rightLeg, leftArm, rightArm, angryBadge };
}

export function buildSlapper(): SlapperRig {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb47b56, roughness: 0.72 });
  const panjabiMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.78 });
  const lungiMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.88 });

  const legGeo = new THREE.BoxGeometry(0.16, 0.72, 0.18);
  legGeo.translate(0, -0.36, 0);
  const leftLeg = new THREE.Mesh(legGeo, lungiMat);
  leftLeg.position.set(-0.13, 0.72, 0);
  const rightLeg = new THREE.Mesh(legGeo, lungiMat);
  rightLeg.position.set(0.13, 0.72, 0);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.7, 0.3), panjabiMat);
  torso.position.set(0, 1.08, 0);
  torso.castShadow = true;

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.56, 0.14), skinMat);
  leftArm.position.set(-0.36, 1.12, 0);

  // Articulated slapping arm pivot at right shoulder
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.36, 1.38, 0);
  const slapArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.68, 0.16), skinMat);
  slapArm.position.set(0, -0.32, 0);
  const bigPalm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.1), skinMat);
  bigPalm.position.set(0, -0.68, 0);
  rightArmPivot.add(slapArm, bigPalm);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), skinMat);
  head.position.set(0, 1.62, 0);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.195, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
  hair.position.set(0, 1.64, 0);

  group.scale.setScalar(1.12);
  group.add(leftLeg, rightLeg, torso, leftArm, rightArmPivot, head, hair);
  return { group, rightArmPivot, leftLeg, rightLeg };
}

export function buildFuelStation(textures: ProceduralTextureSet, faceRight = true): THREE.Group {
  const station = new THREE.Group();
  const dir = faceRight ? 1 : -1;

  const padMat = new THREE.MeshStandardMaterial({
    map: textures.fuelPad,
    roughness: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 22), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(dir * 1.1, 0.035, 0);
  pad.receiveShadow = true;
  station.add(pad);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.4 });
  const redTrimMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });

  for (const pz of [-5.5, 5.5]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.2, 0.55), pillarMat);
    pillar.position.set(-dir * 3.0, 2.6, pz);
    pillar.castShadow = true;
    station.add(pillar);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.65, 15.5), redTrimMat);
  roof.position.set(-dir * 1.6, 5.3, 0);
  roof.castShadow = true;
  station.add(roof);

  const fascia = new THREE.Mesh(new THREE.BoxGeometry(7.3, 0.32, 15.6), pillarMat);
  fascia.position.set(-dir * 1.6, 4.92, 0);
  station.add(fascia);

  const signMat = new THREE.MeshBasicMaterial({ map: textures.fuelCanopySign });
  const signFront = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 1.5), signMat);
  signFront.position.set(-dir * 1.6, 5.75, 7.78);
  station.add(signFront);

  const signSide = new THREE.Mesh(new THREE.PlaneGeometry(13.0, 1.4), signMat);
  signSide.position.set(dir * 2.02, 5.5, 0);
  signSide.rotation.y = (dir * Math.PI) / 2;
  station.add(signSide);

  const island = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 12.5), whiteMat);
  island.position.set(-dir * 3.0, 0.12, 0);
  station.add(island);

  const pumpMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.25 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.9 });
  for (const pz of [-2.8, 2.8]) {
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.85, 0.72), pumpMat);
    pump.position.set(-dir * 3.0, 1.04, pz);
    pump.castShadow = true;
    station.add(pump);

    const display = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.76), screenMat);
    display.position.set(-dir * 3.0, 1.45, pz);
    station.add(display);
  }

  return station;
}

export function buildShowroomAttendant(variant: 0 | 1 | 2 = 0): ShowroomAttendantRig {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb47b56, roughness: 0.72 });
  const shirtColor = variant === 1 ? 0x111827 : 0xdc2626;
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.55 });
  const trimGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.65 });

  // Legs & polished shoes
  const legGeo = new THREE.BoxGeometry(0.15, 0.72, 0.17);
  legGeo.translate(0, -0.36, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(0.11, 0.72, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(-0.11, 0.72, 0);
  rightLeg.castShadow = true;

  for (const sx of [-0.11, 0.11]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24), shoeMat);
    shoe.position.set(sx, 0.04, 0.03);
    group.add(shoe);
  }

  // Uniform Torso + Gold Hero Crest Badge on chest (+Z front)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.64, 0.25), shirtMat);
  torso.position.set(0, 1.04, 0);
  torso.castShadow = true;

  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), trimGoldMat);
  badge.position.set(0.11, 1.18, 0.13);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.27), trimGoldMat);
  collar.position.set(0, 1.35, 0);

  // Left arm (body +X)
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(0.29, 1.29, 0);
  const leftSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.14), shirtMat);
  leftSleeve.position.set(0, -0.1, 0);
  const leftForearm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.12), skinMat);
  leftForearm.position.set(0, -0.35, 0);
  leftArmPivot.add(leftSleeve, leftForearm);

  // Articulated Right Arm (body -X) with elbow pivot for crisp VIP salute
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(-0.29, 1.29, 0);
  const rightUpper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.14), shirtMat);
  rightUpper.position.set(0, -0.13, 0);
  rightArmPivot.add(rightUpper);

  const rightForearmPivot = new THREE.Group();
  rightForearmPivot.position.set(0, -0.26, 0);
  const rightForearm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.28, 0.11), skinMat);
  rightForearm.position.set(0, -0.14, 0);
  const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, 0.06), skinMat);
  rightHand.position.set(0, -0.3, 0.02);
  rightForearmPivot.add(rightForearm, rightHand);
  rightArmPivot.add(rightForearmPivot);

  // Head + Peaked Niloy Hero Cap facing +Z
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.52, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 10), skinMat);
  head.castShadow = true;
  const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat);
  capCrown.position.set(0, 0.03, 0);
  const capVisor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.16), trimGoldMat);
  capVisor.position.set(0, 0.045, 0.15);
  headGroup.add(head, capCrown, capVisor);

  group.scale.setScalar(1.08);
  group.add(leftLeg, rightLeg, torso, badge, collar, leftArmPivot, rightArmPivot, headGroup);

  return {
    group,
    headGroup,
    rightArmPivot,
    rightForearmPivot,
    leftArmPivot,
    saluteIntensity: 0,
  };
}

export function buildNiloyHeroShowroom(
  textures: ProceduralTextureSet,
  faceRight = true
): { group: THREE.Group; displayBikes: THREE.Object3D[]; attendants: ShowroomStaffInstance[] } {
  const showroom = new THREE.Group();
  const displayBikes: THREE.Object3D[] = [];
  const attendants: ShowroomStaffInstance[] = [];
  const dir = faceRight ? 1 : -1;

  // 1. Road-edge Niloy Hero Stopping Pad (5.8 x 18 -> exact 1:3 aspect match for 512x1536)
  const padMat = new THREE.MeshStandardMaterial({
    map: textures.showroomPad,
    roughness: 0.65,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 18.0), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(dir * 1.1, 0.036, 0);
  pad.receiveShadow = true;
  showroom.add(pad);

  const crimsonMat = new THREE.MeshPhysicalMaterial({ color: 0xb91c1c, roughness: 0.26, clearcoat: 0.8 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.72 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.85 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.2 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x93c5fd,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.38,
  });

  // 2. Elevated Showroom Plinth & Glass Pavilion behind pad
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.3, 18.5), floorMat);
  plinth.position.set(-dir * 8.2, 0.15, 0);
  plinth.receiveShadow = true;
  showroom.add(plinth);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.4, 18.2), darkSteelMat);
  backWall.position.set(-dir * 12.8, 2.85, 0);
  backWall.castShadow = true;
  showroom.add(backWall);

  for (const ez of [-8.9, 8.9]) {
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 5.4, 0.35), darkSteelMat);
    sideWall.position.set(-dir * 8.2, 2.85, ez);
    showroom.add(sideWall);
  }

  // Front glass showcase window & steel mullions
  const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.4, 17.4), glassMat);
  frontGlass.position.set(-dir * 3.65, 2.5, 0);
  showroom.add(frontGlass);

  for (const pz of [-8.6, -2.8, 2.8, 8.6]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.42, 5.6, 0.42), crimsonMat);
    col.position.set(-dir * 3.55, 2.8, pz);
    col.castShadow = true;
    showroom.add(col);
  }

  // 3. Cantilevered Niloy Hero Red-Gold Canopy reaching over the pad
  const roof = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.68, 19.6), darkSteelMat);
  roof.position.set(-dir * 7.2, 5.85, 0);
  roof.castShadow = true;
  showroom.add(roof);

  const fasciaRed = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.42, 19.8), crimsonMat);
  fasciaRed.position.set(-dir * 7.2, 5.38, 0);
  showroom.add(fasciaRed);

  const fasciaGold = new THREE.Mesh(new THREE.BoxGeometry(11.9, 0.14, 19.9), goldMat);
  fasciaGold.position.set(-dir * 7.2, 5.12, 0);
  showroom.add(fasciaGold);

  // 4. Illuminated Rooftop & End Gantry Showroom Banners (proper backing boxes, zero roof clipping, crisp ratios)
  const sideHousing = new THREE.Mesh(new THREE.BoxGeometry(0.46, 2.82, 17.0), darkSteelMat);
  sideHousing.position.set(-dir * 1.65, 7.62, 0);
  showroom.add(sideHousing);

  const sideTopTrim = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 17.1), goldMat);
  sideTopTrim.position.set(-dir * 1.65, 9.05, 0);
  showroom.add(sideTopTrim);

  const facadeMat = new THREE.MeshBasicMaterial({ map: textures.showroomFacadeSign });
  const sideSign = new THREE.Mesh(new THREE.PlaneGeometry(16.6, 2.66), facadeMat);
  sideSign.position.set(-dir * 1.4, 7.62, 0);
  sideSign.rotation.y = (dir * Math.PI) / 2;
  showroom.add(sideSign);

  const bannerMat = new THREE.MeshBasicMaterial({ map: textures.showroomBanner });
  for (const endDir of [-1, 1]) {
    const gantryBox = new THREE.Mesh(new THREE.BoxGeometry(10.8, 2.75, 0.36), darkSteelMat);
    gantryBox.position.set(-dir * 7.2, 7.58, endDir * 9.65);
    showroom.add(gantryBox);

    for (const sx of [-dir * 3.0, -dir * 11.4]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 0.28), goldMat);
      strut.position.set(sx, 6.28, endDir * 9.65);
      showroom.add(strut);
    }

    const endSign = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 2.55), bannerMat);
    endSign.position.set(-dir * 7.2, 7.58, endDir * 9.85);
    if (endDir < 0) endSign.rotation.y = Math.PI;
    showroom.add(endSign);
  }

  // Roadside Hero Dealership Pylon Totem at approach edge of showroom bay
  const pylonPedestal = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.52), crimsonMat);
  pylonPedestal.position.set(-dir * 2.55, 0.45, 9.95);
  const pylonBody = new THREE.Mesh(new THREE.BoxGeometry(1.75, 3.45, 0.44), darkSteelMat);
  pylonBody.position.set(-dir * 2.55, 2.62, 9.95);
  const pylonMat = new THREE.MeshBasicMaterial({ map: textures.showroomPylonSign });
  const pylonFront = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 3.24), pylonMat);
  pylonFront.position.set(-dir * 2.55, 2.62, 10.19);
  const pylonBack = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 3.24), pylonMat);
  pylonBack.position.set(-dir * 2.55, 2.62, 9.71);
  pylonBack.rotation.y = Math.PI;
  showroom.add(pylonPedestal, pylonBody, pylonFront, pylonBack);

  // 5. Two Rotating Display Bikes inside the glass showroom (Xtreme 160R & Karizma 210)
  const displayDefs: { id: BikeTierId; z: number }[] = [
    { id: 'xtreme_160r', z: -4.4 },
    { id: 'karizma_210', z: 4.4 },
  ];
  for (const def of displayDefs) {
    const turntable = new THREE.Group();
    turntable.position.set(-dir * 6.8, 0.32, def.z);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.9, 0.24, 24), crimsonMat);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.82, 1.82, 0.08, 24), goldMat);
    ring.position.y = 0.12;
    turntable.add(disc, ring);

    const bikeRig = buildHeroMotorcycle(textures, def.id);
    bikeRig.group.scale.setScalar(1.15);
    bikeRig.group.position.set(0, 0.14, 0);
    bikeRig.group.rotation.y = dir * 0.45;
    turntable.add(bikeRig.group);

    showroom.add(turntable);
    displayBikes.push(turntable);
  }

  // 6. Three Uniformed Niloy Hero Showroom Staff standing along the entrance apron to welcome & salute!
  const staffSpots: { z: number; variant: 0 | 1 | 2 }[] = [
    { z: -5.6, variant: 0 },
    { z: 0.0, variant: 1 },
    { z: 5.6, variant: 2 },
  ];
  const baseYaw = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  for (const spot of staffSpots) {
    const rig = buildShowroomAttendant(spot.variant);
    const localX = -dir * 2.45;
    rig.group.position.set(localX, 0.04, spot.z);
    rig.group.rotation.y = baseYaw;
    showroom.add(rig.group);
    attendants.push({
      rig,
      localX,
      localZ: spot.z,
      baseYaw,
    });
  }

  return { group: showroom, displayBikes, attendants };
}

export function buildTrafficLight(): TrafficLightRig {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.45, metalness: 0.65 });
  const yellowBandMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5, metalness: 0.4 });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.4, 8), poleMat);
  post.position.set(0, 3.2, 0);
  post.castShadow = true;
  group.add(post);

  // Dhaka hazard yellow rings on lower post
  for (const by of [0.8, 1.5, 2.2]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.24, 8), yellowBandMat);
    band.position.set(0, by, 0);
    group.add(band);
  }

  const arm = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.18, 0.18), poleMat);
  arm.position.set(2.2, 6.1, 0);
  group.add(arm);

  // Overhead cantilevered signal head + lower eye-level pedestrian/biker signal head
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.85, 0.46), housingMat);
  box.position.set(4.1, 5.7, 0);
  group.add(box);

  const postBox = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.25, 0.36), housingMat);
  postBox.position.set(0, 3.4, 0.14);
  group.add(postBox);

  const redMat = new THREE.MeshStandardMaterial({ color: 0x450a0a, emissive: 0xef4444, emissiveIntensity: 0 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0x422006, emissive: 0xfacc15, emissiveIntensity: 0 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x052e16, emissive: 0x22c55e, emissiveIntensity: 2.2 });

  const bulbGeo = new THREE.SphereGeometry(0.21, 10, 8);
  const redBulb = new THREE.Mesh(bulbGeo, redMat);
  redBulb.position.set(4.1, 6.28, 0.22);
  const yellowBulb = new THREE.Mesh(bulbGeo, yellowMat);
  yellowBulb.position.set(4.1, 5.7, 0.22);
  const greenBulb = new THREE.Mesh(bulbGeo, greenMat);
  greenBulb.position.set(4.1, 5.12, 0.22);

  // Side post lenses so nearby riders also see light at eye height
  const smallGeo = new THREE.SphereGeometry(0.13, 8, 6);
  const postRed = new THREE.Mesh(smallGeo, redMat);
  postRed.position.set(0, 3.78, 0.31);
  const postYellow = new THREE.Mesh(smallGeo, yellowMat);
  postYellow.position.set(0, 3.4, 0.31);
  const postGreen = new THREE.Mesh(smallGeo, greenMat);
  postGreen.position.set(0, 3.02, 0.31);

  group.add(redBulb, yellowBulb, greenBulb, postRed, postYellow, postGreen);

  const setPhase = (phase: TrafficLightPhase) => {
    redMat.emissiveIntensity = phase === 'RED' ? 3.2 : 0.08;
    yellowMat.emissiveIntensity = phase === 'YELLOW' ? 2.8 : 0.08;
    greenMat.emissiveIntensity = phase === 'GREEN' ? 2.8 : 0.08;
  };
  setPhase('GREEN');

  return { group, setPhase };
}

export function buildMetroStation(
  textures: ProceduralTextureSet,
  stationIndex: number
): THREE.Group {
  const station = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78 });
  const tealSteelMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, metalness: 0.55, roughness: 0.35 });
  const roofBlueMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.28,
    metalness: 0.3,
    clearcoat: 0.65,
  });
  const whiteRoofTrimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });
  const ledStripMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 1.4,
  });
  const boardTex = textures.metroStationBoards[stationIndex % textures.metroStationBoards.length];
  const boardMat = new THREE.MeshBasicMaterial({ map: boardTex });

  // Concourse & Elevated Platform Deck spanning 40m along Z at y = 6.25m (road lanes below are 100% clear)
  const concourseDeck = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.7, 40), concreteMat);
  concourseDeck.position.set(0, 6.25, 0);
  concourseDeck.castShadow = true;
  concourseDeck.receiveShadow = true;
  station.add(concourseDeck);

  // Under-deck bright MRT station ceiling strips
  for (const lx of [-4.2, 4.2]) {
    const underStrip = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 38), ledStripMat);
    underStrip.position.set(lx, 5.88, 0);
    station.add(underStrip);
  }

  // Platform safety glass walls & teal steel ribs
  for (const sx of [-5.85, 5.85]) {
    const glassWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.25, 38), glassMat);
    glassWall.position.set(sx, 7.75, 0);
    station.add(glassWall);

    const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.52, 40), tealSteelMat);
    fascia.position.set(sx, 9.1, 0);
    station.add(fascia);

    // Side station signboard facing street & downtown
    const sideBoard = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.1), boardMat);
    sideBoard.position.set(sx + Math.sign(sx) * 0.18, 8.2, 0);
    sideBoard.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    station.add(sideBoard);
  }

  // Structural arches & Curved Dhaka MRT-6 Canopy Roof
  for (let pz = -16; pz <= 16; pz += 8) {
    for (const sx of [-5.8, 5.8]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.6, 0.35), tealSteelMat);
      rib.position.set(sx, 8.4, pz);
      station.add(rib);
    }
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.32, 0.38), tealSteelMat);
    crossBeam.position.set(0, 10.35, pz);
    station.add(crossBeam);
  }

  const roofCenter = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.42, 42), roofBlueMat);
  roofCenter.position.set(0, 10.75, 0);
  roofCenter.castShadow = true;
  station.add(roofCenter);

  for (const sx of [-6.4, 6.4]) {
    const eave = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.28, 42), whiteRoofTrimMat);
    eave.position.set(sx, 10.45, 0);
    eave.rotation.z = sx > 0 ? -0.22 : 0.22;
    station.add(eave);
  }

  // Prominent Front & Back Station Nameboards over the road so approaching bikers read it clearly!
  for (const endSign of [-1, 1]) {
    const endZ = endSign * 20.15;
    const frontBoard = new THREE.Mesh(new THREE.BoxGeometry(11.4, 2.35, 0.22), boardMat);
    frontBoard.position.set(0, 7.65, endZ);
    station.add(frontBoard);
  }

  // Left & Right Open Diagonal Escalators (চলন্ত সিঁড়ি) under station from sidewalk up to concourse!
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.65 });
  const stepYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
  const handrailMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.6 });
  const escSignMat = new THREE.MeshBasicMaterial({ map: textures.escalatorSign });

  for (const side of [-1, 1]) {
    const escX = side * 11.4;

    // Upper Skybridge Landing Pier & Platform (z = +2.5, y = 6.25)
    const upperPier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.2, 2.6), concreteMat);
    upperPier.position.set(escX, 3.1, 2.5);
    upperPier.castShadow = true;
    station.add(upperPier);

    const upperLanding = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.45, 3.2), concreteMat);
    upperLanding.position.set(escX, 6.25, 2.5);
    station.add(upperLanding);

    // Skybridge linking escalator landing to elevated concourse
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.55, 3.4), concreteMat);
    bridge.position.set(side * 8.4, 6.25, 2.5);
    station.add(bridge);

    const bridgeCanopy = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.28, 3.6), roofBlueMat);
    bridgeCanopy.position.set(side * 8.4, 8.85, 2.5);
    station.add(bridgeCanopy);

    // Sidewalk bottom entry apron at z = +11.6
    const bottomPad = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.24, 2.4), concreteMat);
    bottomPad.position.set(escX, 0.12, 11.6);
    station.add(bottomPad);

    // Diagonal Escalator Truss (spans z = +10.8 -> z = +3.2, y = 0.25 -> 6.15)
    const rise = 5.9;
    const run = 7.6;
    const diagLen = Math.hypot(rise, run);
    const slopeAngle = Math.atan2(rise, run); // ~0.66 rad

    const escTruss = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, diagLen), tealSteelMat);
    escTruss.position.set(escX, 3.15, 7.0);
    escTruss.rotation.x = slopeAngle;
    escTruss.castShadow = true;
    station.add(escTruss);

    // Glass Balustrades & Black Handrails along both sides of escalator
    for (const bx of [-0.96, 0.96]) {
      const balGlass = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, diagLen), glassMat);
      balGlass.position.set(escX + bx, 3.85, 7.0);
      balGlass.rotation.x = slopeAngle;
      station.add(balGlass);

      const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, diagLen + 0.6), handrailMat);
      handrail.position.set(escX + bx, 4.38, 7.0);
      handrail.rotation.x = slopeAngle;
      station.add(handrail);
    }

    // 14 Visible Escalator Steps with yellow safety edges!
    const stepCount = 14;
    for (let s = 0; s < stepCount; s++) {
      const t = (s + 0.5) / stepCount;
      const sy = 0.35 + t * rise;
      const sz = 10.8 - t * run;
      const tread = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.14, 0.52), stepMat);
      tread.position.set(escX, sy, sz);
      station.add(tread);

      const yellowEdge = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.06, 0.1), stepYellowMat);
      yellowEdge.position.set(escX, sy + 0.07, sz - 0.22);
      station.add(yellowEdge);
    }

    // Protective sloped canopy over escalator
    const escRoof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.22, diagLen + 1.4), roofBlueMat);
    escRoof.position.set(escX, 5.45, 7.0);
    escRoof.rotation.x = slopeAngle;
    station.add(escRoof);

    // Ground-level Entrance Portal Arch with "▲ চলন্ত সিঁড়ি • প্রবেশ | METRO ESCALATOR" sign!
    for (const px of [-1.05, 1.05]) {
      const portalPost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.7, 0.18), tealSteelMat);
      portalPost.position.set(escX + px, 1.35, 11.9);
      station.add(portalPost);
    }
    const portalSign = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.82, 0.16), escSignMat);
    portalSign.position.set(escX, 2.72, 11.9);
    station.add(portalSign);
  }

  return station;
}

export function buildDhakaWelcomeArch(textures: ProceduralTextureSet): THREE.Group {
  const arch = new THREE.Group();
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xbe123c, roughness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.3 });
  const bannerMat = new THREE.MeshBasicMaterial({ map: textures.dhakaArchBanner });

  for (const sx of [-10.6, 10.6]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 5.6, 0.55), pillarMat);
    col.position.set(sx, 2.8, 0);
    col.castShadow = true;
    arch.add(col);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.35, 0.85), goldMat);
    cap.position.set(sx, 5.65, 0);
    arch.add(cap);
  }

  // Overhead rickshaw-art truss & banner spanning roadway at y = 5.15m (leaves 4.5m clearance)
  const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(21.6, 0.26, 0.45), goldMat);
  crossBeam.position.set(0, 5.55, 0);
  arch.add(crossBeam);

  const banner = new THREE.Mesh(new THREE.BoxGeometry(19.2, 1.25, 0.16), bannerMat);
  banner.position.set(0, 4.95, 0);
  arch.add(banner);

  // Festive colorful triangular garlands along top beam
  const pennantColors = [0xef4444, 0xfacc15, 0x22c55e, 0x38bdf8, 0xf472b6];
  for (let i = 0; i < 16; i++) {
    const px = -9.4 + i * 1.25;
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.45, 3),
      new THREE.MeshBasicMaterial({ color: pennantColors[i % pennantColors.length] })
    );
    flag.rotation.x = Math.PI;
    flag.position.set(px, 4.18, 0.12);
    arch.add(flag);
  }

  return arch;
}

export function buildTongStall(textures: ProceduralTextureSet, variant = 0): THREE.Group {
  const stall = new THREE.Group();
  const canopyColors = [0x0284c7, 0x059669, 0xd97706, 0xe11d48];
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.86 });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: canopyColors[variant % canopyColors.length],
    roughness: 0.65,
  });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });

  // Base kiosk frame
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, 2.8), woodMat);
  counter.position.set(0, 0.48, 0);
  counter.castShadow = true;
  stall.add(counter);

  const topDeck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 2.9), counterMat);
  topDeck.position.set(0, 0.98, 0);
  stall.add(topDeck);

  // Corner poles & colorful striped roof canopy
  for (const [px, pz] of [
    [-0.95, -1.25],
    [0.95, -1.25],
    [-0.95, 1.25],
    [0.95, 1.25],
  ]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), woodMat);
    pole.position.set(px, 1.7, pz);
    stall.add(pole);
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 3.4), canopyMat);
  roof.position.set(0, 2.48, 0);
  roof.rotation.z = 0.08;
  roof.castShadow = true;
  stall.add(roof);

  // Bangla Tong signage facing street
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.75, 2.7),
    new THREE.MeshBasicMaterial({ map: textures.tongSign })
  );
  sign.position.set(1.12, 2.15, 0);
  stall.add(sign);

  // Glowing kettle & biscuit jars on counter
  const jarColors = [0xfef08a, 0xfca5a5, 0x86efac];
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: jarColors[i], roughness: 0.3 })
    );
    jar.position.set(0.65, 1.15, -0.7 + i * 0.5);
    stall.add(jar);
  }

  return stall;
}

export function buildHighwayDirectionGantry(tex: THREE.CanvasTexture): THREE.Group {
  const gantry = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.72, roughness: 0.35 });
  const boardMat = new THREE.MeshBasicMaterial({ map: tex });

  for (const sx of [-10.7, 10.7]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.6, 8), steelMat);
    col.position.set(sx, 2.8, 0);
    col.castShadow = true;
    gantry.add(col);
  }

  const crossBar = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.24, 0.28), steelMat);
  crossBar.position.set(0, 5.45, 0);
  gantry.add(crossBar);

  // Directional gantry boards cleanly centered over Left (-5.5) and Right (+5.5) carriageways
  const signLeft = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.05, 0.16), boardMat);
  signLeft.position.set(-5.5, 4.75, 0);
  gantry.add(signLeft);

  const signRight = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.05, 0.16), boardMat);
  signRight.position.set(5.5, 4.75, 0);
  gantry.add(signRight);

  return gantry;
}

export type PickupKind = 'coin' | 'fuel' | 'nitro';

export function buildCollectiblePickup(kind: PickupKind): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'coin') {
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      emissive: 0xb45309,
      emissiveIntensity: 0.55,
      metalness: 0.85,
      roughness: 0.2,
    });
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.35 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.14, 16), goldMat);
    disc.rotation.x = Math.PI / 2;
    const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.18), innerMat);
    group.add(disc, emblem);
    return group;
  }

  if (kind === 'fuel') {
    const canMat = new THREE.MeshPhysicalMaterial({
      color: 0x16a34a,
      emissive: 0x14532d,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      clearcoat: 0.6,
    });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), canMat);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8), capMat);
    spout.position.set(0.18, 0.44, 0);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.36), capMat);
    group.add(body, spout, stripe);
    return group;
  }

  // Nitro orb
  const nitroMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.1,
    roughness: 0.12,
    metalness: 0.3,
  });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), nitroMat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 18), ringMat);
  ring.rotation.x = Math.PI / 3;
  group.add(core, ring);
  return group;
}

interface ViaductSlice {
  cx: number;
  y: number;
  z: number;
  halfW: number;
  dist: number;
  skipLeftBarrier?: boolean;
  skipRightBarrier?: boolean;
  skipPier?: boolean;
}

function addContinuousViaductRibbon(
  group: THREE.Group,
  slices: ViaductSlice[],
  concreteMat: THREE.Material,
  girderMat: THREE.Material,
  barrierMat: THREE.Material,
  steelMat: THREE.Material,
  deckAsphaltMat: THREE.Material,
  options: {
    hasApproachAbutment?: boolean;
    addPiers?: boolean;
    pierSpacing?: number;
    taperEndBarriers?: boolean;
    uvScale?: number;
  } = {}
): void {
  const n = slices.length;
  if (n < 2) return;
  const uvScale = options.uvScale ?? 1 / 20;
  const taperEndBarriers = options.taperEndBarriers ?? false;

  const tangents: { tx: number; tz: number; nx: number; nz: number }[] = [];
  for (let i = 0; i < n; i++) {
    const prev = slices[Math.max(0, i - 1)];
    const next = slices[Math.min(n - 1, i + 1)];
    const dx = next.cx - prev.cx;
    const dz = next.z - prev.z;
    const len = Math.max(0.0001, Math.hypot(dx, dz));
    const tx = dx / len;
    const tz = dz / len;
    tangents.push({ tx, tz, nx: -tz, nz: tx });
  }

  // 1. Seamless Asphalt Top Surface
  {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = slices[i];
      const { nx, nz } = tangents[i];
      const innerHalf = Math.max(0.5, s.halfW - 0.24);
      pos.push(
        s.cx - nx * innerHalf, s.y + 0.025, s.z - nz * innerHalf,
        s.cx + nx * innerHalf, s.y + 0.025, s.z + nz * innerHalf
      );
      const v = s.dist * uvScale;
      uv.push(0, v, 1, v);
      if (i < n - 1) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, deckAsphaltMat);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 2. Trapezoidal Precast Concrete Box-Girder Underbody (with smooth ground-merge soffit)
  {
    const pos: number[] = [];
    const idx: number[] = [];
    // 6-point cross-section per slice:
    // 0: top-left, 1: top-right, 2: wing-right, 3: spine-right, 4: spine-left, 5: wing-left
    for (let i = 0; i < n; i++) {
      const s = slices[i];
      const { nx, nz } = tangents[i];
      const topY = s.y;
      const wingDrop = Math.min(0.32, Math.max(0.06, s.y * 0.45));
      const spineDrop = Math.min(1.05, Math.max(0.08, s.y * 0.72));
      const wingY = Math.max(-0.12, topY - wingDrop);
      const spineY = Math.max(-0.18, topY - spineDrop);
      const wTop = s.halfW;
      const wWing = s.halfW * 0.84;
      const wSpine = Math.min(s.halfW * 0.52, Math.max(1.1, s.halfW * 0.45));

      pos.push(
        s.cx - nx * wTop, topY, s.z - nz * wTop,
        s.cx + nx * wTop, topY, s.z + nz * wTop,
        s.cx + nx * wWing, wingY, s.z + nz * wWing,
        s.cx + nx * wSpine, spineY, s.z + nz * wSpine,
        s.cx - nx * wSpine, spineY, s.z - nz * wSpine,
        s.cx - nx * wWing, wingY, s.z - nz * wWing
      );

      if (i < n - 1) {
        const b0 = i * 6;
        const b1 = (i + 1) * 6;
        for (let k = 0; k < 6; k++) {
          const kn = (k + 1) % 6;
          idx.push(b0 + k, b0 + kn, b1 + k, b0 + kn, b1 + kn, b1 + k);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, concreteMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 3. Solid MSE Concrete Retaining Abutment Walls where y <= 2.65m (eliminates floating ramp planks!)
  if (options.hasApproachAbutment) {
    const pos: number[] = [];
    const idx: number[] = [];
    let hasWall = false;
    for (let i = 0; i < n; i++) {
      const s = slices[i];
      const { nx, nz } = tangents[i];
      const wWall = s.halfW * 0.82;
      const wallTopY = s.y > 2.75 ? -0.2 : Math.max(-0.18, s.y - 0.14);
      const wallBotY = -0.22;
      if (wallTopY > 0.05) hasWall = true;

      // 4 verts: BL(0), BR(1), TR(2), TL(3)
      pos.push(
        s.cx - nx * wWall, wallBotY, s.z - nz * wWall,
        s.cx + nx * wWall, wallBotY, s.z + nz * wWall,
        s.cx + nx * wWall, wallTopY, s.z + nz * wWall,
        s.cx - nx * wWall, wallTopY, s.z - nz * wWall
      );

      if (i < n - 1 && (slices[i].y <= 2.85 || slices[i + 1].y <= 2.85)) {
        const b0 = i * 4;
        const b1 = (i + 1) * 4;
        // Left face
        idx.push(b0 + 0, b0 + 3, b1 + 0, b0 + 3, b1 + 3, b1 + 0);
        // Right face
        idx.push(b0 + 2, b0 + 1, b1 + 2, b0 + 1, b1 + 1, b1 + 2);
      }
    }
    if (hasWall && idx.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, girderMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // 4. Smooth Sloped Concrete Jersey Parapets + Top Steel Safety Rail on Both Edges
  for (const side of [-1, 1]) {
    const pos: number[] = [];
    const idx: number[] = [];
    const railPos: number[] = [];
    const railIdx: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = slices[i];
      const { nx, nz } = tangents[i];
      let hScale = 1.0;
      if (taperEndBarriers) {
        if (s.y < 0.7) {
          hScale = Math.max(0.18, s.y / 0.7);
        }
      }
      const h = 0.84 * hScale;
      const outerLat = side * s.halfW;
      const innerBotLat = side * (s.halfW - 0.32);
      const innerTopLat = side * (s.halfW - 0.14);

      // Cross-section: inner-bot(0), outer-bot(1), outer-top(2), inner-top(3)
      pos.push(
        s.cx + nx * innerBotLat, s.y, s.z + nz * innerBotLat,
        s.cx + nx * outerLat, s.y - 0.12, s.z + nz * outerLat,
        s.cx + nx * outerLat, s.y + h, s.z + nz * outerLat,
        s.cx + nx * innerTopLat, s.y + h, s.z + nz * innerTopLat
      );

      // Sleek top tubular safety rail along jersey parapet crown
      const railLat = side * (s.halfW - 0.08);
      const ry = s.y + h + 0.14 * hScale;
      railPos.push(
        s.cx + nx * (railLat - 0.05), ry - 0.04, s.z + nz * (railLat - 0.05),
        s.cx + nx * (railLat + 0.05), ry - 0.04, s.z + nz * (railLat + 0.05),
        s.cx + nx * (railLat + 0.05), ry + 0.04, s.z + nz * (railLat + 0.05),
        s.cx + nx * (railLat - 0.05), ry + 0.04, s.z + nz * (railLat - 0.05)
      );

      if (i < n - 1) {
        const skipSeg =
          side === -1
            ? Boolean(slices[i].skipLeftBarrier || slices[i + 1].skipLeftBarrier)
            : Boolean(slices[i].skipRightBarrier || slices[i + 1].skipRightBarrier);
        if (!skipSeg) {
          const b0 = i * 4;
          const b1 = (i + 1) * 4;
          for (let k = 0; k < 4; k++) {
            const kn = (k + 1) % 4;
            idx.push(b0 + k, b0 + kn, b1 + k, b0 + kn, b1 + kn, b1 + k);
            railIdx.push(b0 + k, b0 + kn, b1 + k, b0 + kn, b1 + kn, b1 + k);
          }
        }
      }
    }
    const barGeo = new THREE.BufferGeometry();
    barGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    barGeo.setIndex(idx);
    barGeo.computeVertexNormals();
    const barMesh = new THREE.Mesh(barGeo, barrierMat);
    barMesh.castShadow = true;
    barMesh.receiveShadow = true;
    group.add(barMesh);

    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
    railGeo.setIndex(railIdx);
    railGeo.computeVertexNormals();
    const railMesh = new THREE.Mesh(railGeo, steelMat);
    group.add(railMesh);
  }

  // 5. Flared Cylindrical Concrete Piers + Hammerhead Pier Caps for elevated sections (y >= 2.55m)
  if (options.addPiers !== false) {
    const spacing = options.pierSpacing ?? 26;
    let nextPierDist = spacing * 0.5;
    for (let i = 1; i < n - 1; i++) {
      const s = slices[i];
      if (s.dist >= nextPierDist && s.y >= 2.55) {
        nextPierDist = s.dist + spacing;
        if (s.skipPier) continue;
        const { tx, tz } = tangents[i];
        const yaw = Math.atan2(-tx, -tz);
        const colH = Math.max(0.6, s.y - 1.15);
        const radius = s.halfW > 6 ? 0.72 : 0.48;

        const pier = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.15, colH, 12), girderMat);
        pier.position.set(s.cx, colH * 0.5, s.z);
        pier.castShadow = true;
        group.add(pier);

        const capW = Math.min(s.halfW * 1.55, s.halfW * 2 - 1.2);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(capW, 0.72, 1.45), concreteMat);
        cap.position.set(s.cx, s.y - 0.92, s.z);
        cap.rotation.y = yaw;
        group.add(cap);
      }
    }
  }
}

export function buildElevatedFlyoverSpan(
  textures: ProceduralTextureSet,
  span: {
    startZ: number;
    deckStartZ: number;
    deckEndZ: number;
    endZ: number;
    deckHeight: number;
    rampLeftMinX: number;
    rampLeftMaxX: number;
    rampRightMinX: number;
    rampRightMaxX: number;
    deckMinX: number;
    deckMaxX: number;
    tollPlazaZ?: number;
    leftBarrierOpeningZ?: [number, number];
  }
): THREE.Group {
  const group = new THREE.Group();
  const midWorldZ = (span.startZ + span.endZ) * 0.5;
  const toLocalZ = (wz: number) => wz - midWorldZ;

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.76 });
  const girderMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72 });
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.68 });
  const hazardYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.48 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.68, roughness: 0.36 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 1.4,
  });
  const deckAsphaltMat = new THREE.MeshStandardMaterial({
    map: textures.expresswayDeck,
    roughness: 0.84,
    metalness: 0.04,
  });

  const leftRampCenterX = (span.rampLeftMinX + span.rampLeftMaxX) * 0.5;
  const leftRampHalfW = (span.rampLeftMaxX - span.rampLeftMinX) * 0.5;
  const rightRampCenterX = (span.rampRightMinX + span.rampRightMaxX) * 0.5;
  const rightRampHalfW = (span.rampRightMaxX - span.rampRightMinX) * 0.5;
  const rampCenters = [
    { x: leftRampCenterX, halfW: leftRampHalfW },
    { x: rightRampCenterX, halfW: rightRampHalfW },
  ];

  // Smooth continuous ramp builder (28 curved slices, solid MSE approach walls + flared concrete piers)
  const buildSmoothRamp = (zStartWorld: number, zEndWorld: number, climbUp: boolean) => {
    const segCount = 28;
    const totalLen = zStartWorld - zEndWorld;
    for (const rc of rampCenters) {
      const slices: ViaductSlice[] = [];
      for (let i = 0; i <= segCount; i++) {
        const t = i / segCount;
        const sm = t * t * (3 - 2 * t);
        const y = span.deckHeight * (climbUp ? sm : 1 - sm);
        const wz = zStartWorld - t * totalLen;
        slices.push({
          cx: rc.x,
          y,
          z: toLocalZ(wz),
          halfW: rc.halfW,
          dist: t * totalLen,
        });
      }
      addContinuousViaductRibbon(group, slices, concreteMat, girderMat, barrierMat, steelMat, deckAsphaltMat, {
        hasApproachAbutment: true,
        addPiers: true,
        pierSpacing: 26,
        taperEndBarriers: true,
        uvScale: 1 / 18,
      });
    }
  };

  buildSmoothRamp(span.startZ, span.deckStartZ, true);
  buildSmoothRamp(span.deckEndZ, span.endZ, false);

  // Entry/Exit Ramp Portal Gantries just ahead of ramp mouths
  const rampSignMat = new THREE.MeshBasicMaterial({ map: textures.rampEntranceSign });
  for (const portalZ of [span.startZ - 4.0, span.endZ + 4.0]) {
    const lz = toLocalZ(portalZ);
    for (const rc of rampCenters) {
      for (const sx of [-rc.halfW + 0.12, rc.halfW - 0.12]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 4.5, 8), steelMat);
        post.position.set(rc.x + sx, 2.25, lz);
        group.add(post);
      }
      const signBoard = new THREE.Mesh(new THREE.BoxGeometry(rc.halfW * 2 - 0.4, 1.35, 0.16), rampSignMat);
      signBoard.position.set(rc.x, 4.25, lz);
      group.add(signBoard);
    }
  }

  // Smooth Continuous Main Upper Viaduct Deck (with exact parapet opening if leftBarrierOpeningZ is specified)
  const deckLen = span.deckStartZ - span.deckEndZ;
  const deckHalfW = (span.deckMaxX - span.deckMinX) * 0.5;
  const deckCenterX = (span.deckMinX + span.deckMaxX) * 0.5;
  const baseStep = span.leftBarrierOpeningZ ? 10 : 24;
  const deckWzList: number[] = [];
  for (let wz = span.deckStartZ; wz > span.deckEndZ + 0.5; wz -= baseStep) {
    deckWzList.push(wz);
  }
  deckWzList.push(span.deckEndZ);
  if (span.leftBarrierOpeningZ) {
    const [openStartZ, openEndZ] = span.leftBarrierOpeningZ;
    for (const keyZ of [openStartZ, openStartZ - 3, openEndZ + 3, openEndZ]) {
      if (keyZ < span.deckStartZ - 0.2 && keyZ > span.deckEndZ + 0.2) {
        if (!deckWzList.some((z) => Math.abs(z - keyZ) < 0.8)) {
          deckWzList.push(keyZ);
        }
      }
    }
    deckWzList.sort((a, b) => b - a);
  }

  const deckSlices: ViaductSlice[] = deckWzList.map((wz) => {
    const inOpenGap =
      span.leftBarrierOpeningZ !== undefined &&
      wz < span.leftBarrierOpeningZ[0] - 0.05 &&
      wz > span.leftBarrierOpeningZ[1] + 0.05;
    return {
      cx: deckCenterX,
      y: span.deckHeight,
      z: toLocalZ(wz),
      halfW: deckHalfW,
      dist: span.deckStartZ - wz,
      skipLeftBarrier: inOpenGap,
    };
  });
  addContinuousViaductRibbon(group, deckSlices, concreteMat, girderMat, barrierMat, steelMat, deckAsphaltMat, {
    hasApproachAbutment: false,
    addPiers: true,
    pierSpacing: 28,
    taperEndBarriers: false,
    uvScale: 1 / 18,
  });

  // Highway LED Dual-Arm Streetlamps along outer upper deck jersey parapets
  const deckMidLz = toLocalZ((span.deckStartZ + span.deckEndZ) * 0.5);
  for (const side of [-1, 1]) {
    const bx = side < 0 ? span.deckMinX + 0.16 : span.deckMaxX - 0.16;
    for (let lz = deckMidLz - deckLen * 0.45; lz <= deckMidLz + deckLen * 0.45; lz += 28) {
      const wz = lz + midWorldZ;
      if (
        side < 0 &&
        span.leftBarrierOpeningZ &&
        wz <= span.leftBarrierOpeningZ[0] + 4 &&
        wz >= span.leftBarrierOpeningZ[1] - 4
      ) {
        continue;
      }
      // Skip Expressway lamp poles beneath Kuril Flyover crossing (Z in [-852, -804])
      if (span.tollPlazaZ !== undefined && wz >= -852 && wz <= -804) {
        continue;
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 6), steelMat);
      pole.position.set(bx, span.deckHeight + 2.8, lz);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.09), steelMat);
      arm.position.set(bx - side * 0.65, span.deckHeight + 4.95, lz);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.2), bulbMat);
      bulb.position.set(bx - side * 1.2, span.deckHeight + 4.86, lz);
      group.add(pole, arm, bulb);
    }
  }

  // Cushioned yellow-black crash attenuator drums & concrete bullnose at ramp-to-deck junctions
  for (const endWz of [span.deckStartZ, span.deckEndZ]) {
    const dirToDeck = endWz === span.deckStartZ ? -1 : 1;
    const baseLz = toLocalZ(endWz);
    const bullnose = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.84, 1.4), barrierMat);
    bullnose.position.set(0, span.deckHeight + 0.42, baseLz - dirToDeck * 0.6);
    group.add(bullnose);

    for (let b = 0; b < 3; b++) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55 - b * 0.1, 0.58 - b * 0.1, 0.84, 10),
        b % 2 === 0 ? hazardYellowMat : blackMat
      );
      barrel.position.set(0, span.deckHeight + 0.42, baseLz + dirToDeck * (0.7 + b * 1.15));
      group.add(barrel);
    }
  }

  // Optional Dhaka Elevated Expressway Toll Plaza Canopy
  if (span.tollPlazaZ !== undefined) {
    const tollLz = toLocalZ(span.tollPlazaZ);
    const boothMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.45 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.5 });
    const trimRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const deckW = span.deckMaxX - span.deckMinX;

    for (const bx of [-8.6, -4.6, 0, 4.6, 8.6]) {
      const booth = new THREE.Mesh(new THREE.BoxGeometry(0.75, 2.8, 4.4), boothMat);
      booth.position.set(bx, span.deckHeight + 1.4, tollLz);
      booth.castShadow = true;
      const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 4.8), hazardYellowMat);
      bumper.position.set(bx, span.deckHeight + 0.38, tollLz);
      group.add(booth, bumper);
    }

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(deckW + 1.2, 0.85, 6.4), canopyMat);
    canopy.position.set(0, span.deckHeight + 4.8, tollLz);
    canopy.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(deckW + 1.3, 0.25, 6.5), trimRedMat);
    stripe.position.set(0, span.deckHeight + 4.35, tollLz);
    group.add(canopy, stripe);

    const tollSignMat = new THREE.MeshBasicMaterial({ map: textures.expresswayTollSign });
    for (const sideDir of [-1, 1]) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 2.65), tollSignMat);
      sign.position.set(0, span.deckHeight + 5.65, tollLz + sideDir * 3.25);
      if (sideDir < 0) sign.rotation.y = Math.PI;
      group.add(sign);
    }
  }

  return group;
}

export function buildTuragRiverAndBridge(
  textures: ProceduralTextureSet,
  arteryOnly = false
): { group: THREE.Group; boats: THREE.Group[] } {
  const group = new THREE.Group();
  const boats: THREE.Group[] = [];

  // Turag River water channel (localZ -37..+37)
  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.turagRiverWater,
    roughness: 0.22,
    metalness: 0.25,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(460, 76), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.35, 0);
  water.receiveShadow = true;
  group.add(water);

  // Sloped Concrete / Grass Embankments kept strictly OUTSIDE bridge decks & below asphalt level
  const bankMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const turagDeckClearHalf = arteryOnly ? GAME_CONFIG.ARTERY_HALF_WIDTH + 1.5 : 32;
  const turagBankW = 220;
  for (const bankSide of [-1, 1]) {
    for (const xSide of [-1, 1]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(turagBankW, 1.8, 4.2), bankMat);
      bank.position.set(xSide * (turagDeckClearHalf + turagBankW * 0.5), -1.72, bankSide * 38.5);
      bank.rotation.x = bankSide * 0.24;
      group.add(bank);
    }
  }

  // Ground-level Tongi Bridge decks & railings across Main Artery
  const bridgeConcreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78 });
  const railBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45, metalness: 0.4 });
  const roadSpans = arteryOnly
    ? [{ x: 0, w: GAME_CONFIG.ARTERY_HALF_WIDTH * 2 + 2.4 }]
    : [
        { x: 0, w: GAME_CONFIG.ARTERY_HALF_WIDTH * 2 + 2.4 },
        { x: GAME_CONFIG.AVENUE_LEFT_INNER_X, w: 10.6 },
        { x: GAME_CONFIG.AVENUE_RIGHT_INNER_X, w: 10.6 },
        { x: GAME_CONFIG.AVENUE_LEFT_OUTER_X, w: 9.6 },
        { x: GAME_CONFIG.AVENUE_RIGHT_OUTER_X, w: 9.6 },
      ];

  for (const span of roadSpans) {
    const underDeck = new THREE.Mesh(new THREE.BoxGeometry(span.w, 0.75, 76), bridgeConcreteMat);
    underDeck.position.set(span.x, -0.39, 0);
    group.add(underDeck);

    for (const side of [-1, 1]) {
      const rx = span.x + side * (span.w * 0.5 - 0.16);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.92, 76), railBlueMat);
      rail.position.set(rx, 0.46, 0);
      group.add(rail);
    }

    // Bridge river piers in water
    for (const pz of [-18, 18]) {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, 1.8, 8), bankMat);
      pier.position.set(span.x, -0.95, pz);
      group.add(pier);
    }
  }

  // 3 Wooden Bangladeshi Country Boats (নৌকা) floating on Turag River
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.82 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.6 });
  const boatConfigs = [
    { x: -18, z: -12, yaw: 0.15 },
    { x: 18, z: 10, yaw: -0.2 },
    { x: -48, z: 4, yaw: 0.08 },
  ];
  for (const bc of boatConfigs) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 7.6), hullMat);
    const prowF = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 4), trimMat);
    prowF.rotation.x = Math.PI / 2;
    prowF.rotation.z = Math.PI / 4;
    prowF.position.set(0, 0.1, 4.6);
    const prowB = prowF.clone();
    prowB.rotation.x = -Math.PI / 2;
    prowB.position.set(0, 0.1, -4.6);
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 3.2, 8, 1, false, 0, Math.PI), roofMat);
    canopy.rotation.z = Math.PI / 2;
    canopy.rotation.y = Math.PI / 2;
    canopy.position.set(0, 0.45, 0);
    boat.add(hull, prowF, prowB, canopy);
    boat.position.set(bc.x, -1.12, bc.z);
    boat.rotation.y = bc.yaw;
    group.add(boat);
    boats.push(boat);
  }

  // Bishwa Ijtema Ground (বিশ্ব ইজতেমা ময়দান) marquee tents & sign on northern bank (localZ ~ -52, x ~ -21)
  const tentMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.7 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
  for (const tx of [-20, -47]) {
    const tent = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, 14), tentMat);
    tent.position.set(tx, 3.2, -52);
    tent.castShadow = true;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.25, 1.8), stripeMat);
    ridge.position.set(tx, 3.45, -52);
    group.add(tent, ridge);
    for (const px of [-4.2, 4.2]) {
      for (const pz of [-58, -46]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), poleMat);
        post.position.set(tx + px, 1.6, pz);
        group.add(post);
      }
    }
  }
  const ijtemaBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 2.4, 8.2),
    new THREE.MeshBasicMaterial({ map: textures.ijtemaSign })
  );
  ijtemaBoard.position.set(-14.6, 4.4, -52);
  ijtemaBoard.rotation.y = Math.PI / 2;
  group.add(ijtemaBoard);

  return { group, boats };
}

export function buildAirportTowerLandmark(textures: ProceduralTextureSet): THREE.Group {
  const airport = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.72 });
  const tealMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.55 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.25,
    transparent: true,
    opacity: 0.72,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 2.0,
  });

  // Hazrat Shahjalal ATC Tower at x = -22 relative to group origin
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 16.5, 8), concreteMat);
  shaft.position.set(0, 8.25, 0);
  shaft.castShadow = true;
  airport.add(shaft);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 1.5, 1.8, 8), tealMat);
  neck.position.set(0, 17.2, 0);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 2.6, 2.2, 8), glassMat);
  cab.position.set(0, 19.2, 0);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.3, 8), concreteMat);
  roof.position.set(0, 20.9, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.0, 6), tealMat);
  mast.position.set(0, 22.8, 0);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), beaconMat);
  beacon.position.set(0, 24.4, 0);
  airport.add(neck, cab, roof, mast, beacon);

  // Airport Terminal Wing + Signboard facing artery (narrowed to clear x=-29 avenue)
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(7.6, 5.5, 22), concreteMat);
  terminal.position.set(-0.2, 2.75, -14);
  terminal.castShadow = true;
  const termRoof = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.7, 23), tealMat);
  termRoof.position.set(-0.2, 5.8, -14);
  airport.add(terminal, termRoof);

  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 2.4, 10.5),
    new THREE.MeshBasicMaterial({ map: textures.airportSign })
  );
  sign.position.set(3.75, 5.4, -14);
  sign.rotation.y = Math.PI / 2;
  airport.add(sign);

  return airport;
}

export function buildGazipurChourastaLandmark(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();
  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x2d3138, roughness: 0.86 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.65 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.32, metalness: 0.6 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.38, metalness: 0.55 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 });

  // 1. Flared Gazipur Chourasta Roundabout Plaza surface (30m diameter)
  const plaza = new THREE.Mesh(new THREE.CylinderGeometry(14.8, 14.8, 0.04, 24), asphaltMat);
  plaza.position.set(0, 0.012, 0);
  plaza.receiveShadow = true;
  group.add(plaza);

  const ring = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.4, 24), new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.036, 0);
  group.add(ring);

  // 2. Central Jagrata Chourangi (জাগ্রত চৌরঙ্গী) Monument Plinth & Sculpture
  const step1 = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.1, 0.45, 8), greenMat);
  step1.position.set(0, 0.22, 0);
  const step2 = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.35, 0.75, 8), plinthMat);
  step2.position.set(0, 0.82, 0);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 2.4, 8), concreteMat);
  pedestal.position.set(0, 2.4, 0);
  pedestal.castShadow = true;
  group.add(step1, step2, pedestal);

  // Liberation War Freedom Fighter Figure + Raised Rifle & Grenade Pose
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.25, 0.48), bronzeMat);
  torso.position.set(0, 4.25, 0);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.95, 0.42), bronzeMat);
  legs.position.set(0, 3.45, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), bronzeMat);
  head.position.set(0, 5.1, 0);
  const raisedArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.3, 0.22), bronzeMat);
  raisedArm.position.set(0.45, 5.3, 0);
  raisedArm.rotation.z = -0.25;
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.85, 0.14), goldMat);
  rifle.position.set(0.62, 6.2, 0);
  rifle.rotation.z = -0.18;
  group.add(legs, torso, head, raisedArm, rifle);

  // Jagrata Chourangi Plaques facing North & South approach
  const plaqueMat = new THREE.MeshBasicMaterial({ map: textures.jagrataPlaqueSign });
  for (const side of [-1, 1]) {
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.12), plaqueMat);
    plaque.position.set(0, 2.2, side * 1.45);
    if (side < 0) plaque.rotation.y = Math.PI;
    group.add(plaque);
  }

  // 3. Gazipur Chourasta Multi-Level East-West Overpass Flyover overhead (y = 8.4m)
  const overDeck = new THREE.Mesh(new THREE.BoxGeometry(104, 0.95, 9.6), concreteMat);
  overDeck.position.set(0, 8.4, 0);
  overDeck.castShadow = true;
  group.add(overDeck);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(104, 0.78, 0.28), concreteMat);
    wall.position.set(0, 9.25, side * 4.65);
    group.add(wall);
  }
  for (const px of [-46, -19, 19, 46]) {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 8.2, 8), concreteMat);
    pier.position.set(px, 4.1, 0);
    pier.castShadow = true;
    group.add(pier);
  }

  const chourastaBanner = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 2.4),
    new THREE.MeshBasicMaterial({ map: textures.jagrataPlaqueSign })
  );
  chourastaBanner.position.set(0, 9.4, 4.85);
  group.add(chourastaBanner);

  return group;
}

export function buildMohakhaliBusTerminal(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.55, metalness: 0.25 });
  const trimRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.65 });
  const asphaltBayMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });

  // Terminal tarmac apron & raised passenger concourse platform (bounded strictly inside x in [-5, +5] relative to x=-22)
  const bayFloor = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.14, 34), asphaltBayMat);
  bayFloor.position.set(0, 0.07, 0);
  bayFloor.receiveShadow = true;
  group.add(bayFloor);

  const concourse = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.4, 24), concreteMat);
  concourse.position.set(-2.4, 2.2, 0);
  concourse.castShadow = true;
  group.add(concourse);

  // Sweeping red & teal terminal canopy spanning over the bus loading bays
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.45, 28), roofMat);
  canopy.position.set(0, 5.2, 0);
  canopy.rotation.z = -0.05;
  canopy.castShadow = true;
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.65, 28), trimRedMat);
  fascia.position.set(4.55, 4.95, 0);
  group.add(canopy, fascia);

  for (const pz of [-11, -3.5, 3.5, 11]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.0, 8), steelMat);
    col.position.set(4.2, 2.5, pz);
    col.castShadow = true;
    group.add(col);
  }

  // Prominent Mohakhali Bus Terminal Facade Sign facing main artery
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 2.2, 11.5),
    new THREE.MeshBasicMaterial({ map: textures.mohakhaliTerminalSign })
  );
  sign.position.set(4.7, 6.2, 0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);

  // 2 Parked Inter-district Coaches in terminal bays (Hanif & Shohag liveries)
  const coachLiveryMats = [
    new THREE.MeshStandardMaterial({ map: textures.busHanif, roughness: 0.4 }),
    new THREE.MeshStandardMaterial({ map: textures.busShohag, roughness: 0.4 }),
  ];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.4 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });

  [-6.5, 6.5].forEach((bz, idx) => {
    const coach = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.05, 5.6), coachLiveryMats[idx]);
    body.position.set(0, 1.35, 0);
    body.castShadow = true;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.72, 0.12), glassMat);
    windshield.position.set(0, 1.8, 2.82);
    coach.add(body, windshield);
    for (const wx of [-0.78, 0.78]) {
      for (const wz of [-1.7, 1.7]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 10), wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.36, wz);
        coach.add(w);
      }
    }
    coach.position.set(1.75, 0.14, bz);
    coach.rotation.y = 0.28;
    group.add(coach);
  });

  return group;
}

export function buildPurbachalWelcomeArch(
  textures: ProceduralTextureSet,
  roadHalfWidth = 27.5
): THREE.Group {
  const arch = new THREE.Group();
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.45, metalness: 0.35 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.6 });

  const pylonPositions = [-roadHalfWidth - 1.6, 0, roadHalfWidth + 1.6];
  for (const px of pylonPositions) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.3, 10.2, 1.5), pylonMat);
    tower.position.set(px, 5.1, 0);
    tower.castShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.7), goldMat);
    trim.position.set(px, 9.8, 0);
    arch.add(tower, trim);
  }

  const spanW = (roadHalfWidth + 1.6) * 2 + 1.5;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(spanW, 2.8, 1.2), pylonMat);
  beam.position.set(0, 8.6, 0);
  beam.castShadow = true;
  const crown = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.6, 0.46, 1.45), goldMat);
  crown.position.set(0, 10.1, 0);
  arch.add(beam, crown);

  const bannerMat = new THREE.MeshBasicMaterial({ map: textures.purbachalArchSign });
  const boardW = Math.min(34, spanW - 4.0);
  for (const sideDir of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(boardW, 2.5), bannerMat);
    board.position.set(0, 8.6, sideDir * 0.64);
    if (sideDir < 0) board.rotation.y = Math.PI;
    arch.add(board);
  }

  return arch;
}

export function buildNeelaMarketLandmark(
  textures: ProceduralTextureSet,
  roadHalfWidth = 27.5
): THREE.Group {
  const group = new THREE.Group();
  const roofColors = [0x0284c7, 0xdc2626, 0x059669];
  const bambooMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
  const tableMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 });
  const stallWallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.8,
  });

  // Open-air Purbachal market sheds & duck-curry/pitha stalls set outside the 300ft service lanes
  const stallCenterX = roadHalfWidth + 6.8;
  for (const side of [-1, 1] as const) {
    const cx = side * stallCenterX;
    const stallOffsets = [-11, 0, 11];

    stallOffsets.forEach((sz, idx) => {
      const shed = new THREE.Group();
      const roofMat = new THREE.MeshStandardMaterial({
        color: roofColors[(idx + (side > 0 ? 1 : 0)) % roofColors.length],
        roughness: 0.55,
        metalness: 0.25,
      });

      const floor = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.18, 9.2), stallWallMat);
      floor.position.set(0, 0.09, 0);
      floor.receiveShadow = true;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.22, 9.6), roofMat);
      roof.position.set(0, 3.6, 0);
      roof.rotation.z = -side * 0.12;
      roof.castShadow = true;

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.35, 3.3, 9.0), stallWallMat);
      backWall.position.set(side * 3.8, 1.7, 0);
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 7.2), bambooMat);
      counter.position.set(-side * 1.6, 0.65, 0);
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.16, 7.25), tableMat);
      cloth.position.set(-side * 1.6, 1.18, 0);

      shed.add(floor, roof, backWall, counter, cloth);

      for (const px of [-3.6, 3.6]) {
        for (const pz of [-4.0, 4.0]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 3.5, 6), bambooMat);
          post.position.set(px, 1.8, pz);
          shed.add(post);
        }
      }
      for (let bz = -3.0; bz <= 3.0; bz += 2.0) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), bulbMat);
        bulb.position.set(-side * 3.8, 3.2, bz);
        shed.add(bulb);
      }

      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1.35, 7.6),
        new THREE.MeshBasicMaterial({ map: textures.neelaStallSigns[(idx + (side > 0 ? 1 : 0)) % textures.neelaStallSigns.length] })
      );
      signBoard.position.set(-side * 4.25, 4.25, 0);
      if (side > 0) signBoard.rotation.y = Math.PI;
      shed.add(signBoard);

      shed.position.set(cx, 0, sz);
      group.add(shed);
    });
  }

  // Overhead Neela Market Portal Gantry spanning the full 300ft expressway cleanly
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.65 });
  const spanW = (roadHalfWidth + 1.8) * 2;
  for (const px of [-roadHalfWidth - 1.5, 0, roadHalfWidth + 1.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 9.0, 8), steelMat);
    pole.position.set(px, 4.5, 0);
    pole.castShadow = true;
    group.add(pole);
  }
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(spanW, 2.5, 0.45), steelMat);
  topFrame.position.set(0, 7.85, 0);
  group.add(topFrame);

  const mainSignMat = new THREE.MeshBasicMaterial({ map: textures.neelaMarketSign });
  const signW = Math.min(28, spanW - 4.0);
  for (const sideDir of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(signW, 2.3), mainSignMat);
    board.position.set(0, 7.85, sideDir * 0.28);
    if (sideDir < 0) board.rotation.y = Math.PI;
    group.add(board);
  }

  return group;
}

export function buildBaluRiverBridge(
  textures: ProceduralTextureSet,
  arteryOnly = false,
  roadHalfWidth = 27.5
): { group: THREE.Group; boats: THREE.Group[] } {
  const group = new THREE.Group();
  const boats: THREE.Group[] = [];

  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.shitalakshyaWater,
    roughness: 0.24,
    metalness: 0.22,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(520, 30), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.35, 0);
  water.receiveShadow = true;
  group.add(water);

  const bankMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const baluDeckClearHalf = roadHalfWidth + 1.6;
  const baluBankW = 220;
  for (const bankSide of [-1, 1]) {
    for (const xSide of [-1, 1]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(baluBankW, 1.7, 3.8), bankMat);
      bank.position.set(xSide * (baluDeckClearHalf + baluBankW * 0.5), -1.72, bankSide * 15.5);
      bank.rotation.x = bankSide * 0.24;
      group.add(bank);
    }
  }

  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.45, metalness: 0.4 });
  const roadSpans = arteryOnly
    ? [{ x: 0, w: roadHalfWidth * 2 + 2.4 }]
    : [
        { x: 0, w: roadHalfWidth * 2 + 2.4 },
        { x: GAME_CONFIG.AVENUE_LEFT_INNER_X, w: 10.6 },
        { x: GAME_CONFIG.AVENUE_RIGHT_INNER_X, w: 10.6 },
        { x: GAME_CONFIG.AVENUE_LEFT_OUTER_X, w: 9.6 },
        { x: GAME_CONFIG.AVENUE_RIGHT_OUTER_X, w: 9.6 },
      ];

  for (const span of roadSpans) {
    const underDeck = new THREE.Mesh(new THREE.BoxGeometry(span.w, 0.75, 30), bridgeMat);
    underDeck.position.set(span.x, -0.39, 0);
    group.add(underDeck);
    for (const side of [-1, 1]) {
      const rx = span.x + side * (span.w * 0.5 - 0.16);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.92, 30), railMat);
      rail.position.set(rx, 0.46, 0);
      group.add(rail);
    }
  }

  // Balu Bridge Signboard facing approaching riders safely outside wide 300ft edge
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.4, 6), railMat);
  pole.position.set(-roadHalfWidth - 1.5, 2.7, 13.5);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 1.55, 0.14),
    new THREE.MeshBasicMaterial({ map: textures.baluBridgeSign })
  );
  sign.position.set(-roadHalfWidth - 1.5, 4.7, 13.5);
  group.add(pole, sign);

  // 2 boats on Balu River outside the 300ft bridge deck
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.82 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.7 });
  for (const bx of [-roadHalfWidth - 14, roadHalfWidth + 14]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 6.4), hullMat);
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.6, 8, 1, false, 0, Math.PI), roofMat);
    canopy.rotation.z = Math.PI / 2;
    canopy.rotation.y = Math.PI / 2;
    canopy.position.set(0, 0.4, 0);
    boat.add(hull, canopy);
    boat.position.set(bx, -1.12, 0);
    group.add(boat);
    boats.push(boat);
  }

  return { group, boats };
}

export function buildShitalakshyaKanchanBridge(
  textures: ProceduralTextureSet,
  arteryOnly = false,
  roadHalfWidth = 13.5
): { group: THREE.Group; boats: THREE.Group[] } {
  const group = new THREE.Group();
  const boats: THREE.Group[] = [];

  const waterMat = new THREE.MeshStandardMaterial({
    map: textures.shitalakshyaWater,
    roughness: 0.2,
    metalness: 0.28,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(500, 76), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -1.35, 0);
  water.receiveShadow = true;
  group.add(water);

  const bankMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 });
  const kanchanDeckClearHalf = roadHalfWidth + 1.6;
  const kanchanBankW = 220;
  for (const bankSide of [-1, 1]) {
    for (const xSide of [-1, 1]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(kanchanBankW, 1.8, 4.2), bankMat);
      bank.position.set(xSide * (kanchanDeckClearHalf + kanchanBankW * 0.5), -1.75, bankSide * 38.5);
      bank.rotation.x = bankSide * 0.24;
      group.add(bank);
    }
  }

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.72 });
  const crimsonMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42, metalness: 0.35 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.65 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfde047,
    emissiveIntensity: 1.5,
  });

  const roadSpans = arteryOnly
    ? [{ x: 0, w: roadHalfWidth * 2 + 2.4 }]
    : [
        { x: 0, w: roadHalfWidth * 2 + 2.4 },
        { x: GAME_CONFIG.AVENUE_LEFT_INNER_X, w: 10.6 },
        { x: GAME_CONFIG.AVENUE_RIGHT_INNER_X, w: 10.6 },
        { x: GAME_CONFIG.AVENUE_LEFT_OUTER_X, w: 9.6 },
        { x: GAME_CONFIG.AVENUE_RIGHT_OUTER_X, w: 9.6 },
      ];

  for (const span of roadSpans) {
    const underDeck = new THREE.Mesh(new THREE.BoxGeometry(span.w, 0.82, 76), concreteMat);
    underDeck.position.set(span.x, -0.42, 0);
    group.add(underDeck);

    for (const side of [-1, 1]) {
      const rx = span.x + side * (span.w * 0.5 - 0.16);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.98, 76), crimsonMat);
      rail.position.set(rx, 0.49, 0);
      group.add(rail);
    }

    for (const pz of [-20, 0, 20]) {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.9, 8), bankMat);
      pier.position.set(span.x, -0.95, pz);
      group.add(pier);
    }
  }

  // Signature Narayanganj Kanchan Bridge Twin Tied-Arch Ribs outside roadHalfWidth
  const archX = roadHalfWidth + 1.1;
  const archHalfLen = 30;
  const segCount = 14;
  for (const side of [-1, 1]) {
    const ax = side * archX;
    for (let s = 0; s < segCount; s++) {
      const t0 = s / segCount;
      const t1 = (s + 1) / segCount;
      const z0 = (t0 * 2 - 1) * archHalfLen;
      const z1 = (t1 * 2 - 1) * archHalfLen;
      const y0 = Math.sin(t0 * Math.PI) * 10.2 + 0.8;
      const y1 = Math.sin(t1 * Math.PI) * 10.2 + 0.8;

      const midZ = (z0 + z1) * 0.5;
      const midY = (y0 + y1) * 0.5;
      const dz = z1 - z0;
      const dy = y1 - y0;
      const segLen = Math.hypot(dz, dy);

      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.76, segLen + 0.12), s % 2 === 0 ? steelMat : crimsonMat);
      rib.position.set(ax, midY, midZ);
      rib.rotation.x = -Math.atan2(dy, dz);
      rib.castShadow = true;
      group.add(rib);

      if (s > 0) {
        const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, y0, 6), steelMat);
        hanger.position.set(ax, y0 * 0.5, z0);
        group.add(hanger);
      }
    }

    for (const lz of [-24, 0, 24]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), bulbMat);
      lamp.position.set(ax, 1.35, lz);
      group.add(lamp);
    }
  }

  for (const bz of [-12, 0, 12]) {
    const archY = Math.cos((bz / archHalfLen) * (Math.PI * 0.5)) * 10.2 + 0.8;
    const crossBrace = new THREE.Mesh(new THREE.BoxGeometry(archX * 2 + 0.5, 0.45, 0.55), crimsonMat);
    crossBrace.position.set(0, archY, bz);
    group.add(crossBrace);
  }

  const portalMat = new THREE.MeshBasicMaterial({ map: textures.kanchanBridgeSign });
  for (const endZ of [-33, 33]) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.8, 0.55), crimsonMat);
      post.position.set(side * (roadHalfWidth + 1.0), 3.9, endZ);
      group.add(post);
    }
    const gantry = new THREE.Mesh(new THREE.BoxGeometry((roadHalfWidth + 1.2) * 2, 2.2, 0.45), concreteMat);
    gantry.position.set(0, 7.2, endZ);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(22, roadHalfWidth * 1.7), 2.0), portalMat);
    board.position.set(0, 7.2, endZ + (endZ > 0 ? 0.25 : -0.25));
    if (endZ < 0) board.rotation.y = Math.PI;
    group.add(gantry, board);
  }

  const bargeHullMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 });
  const cargoSandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });
  const barge = new THREE.Group();
  const bHull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 13.5), bargeHullMat);
  const bCargo = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 8.2), cargoSandMat);
  bCargo.position.set(0, 0.75, 0.8);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), concreteMat);
  cabin.position.set(0, 1.1, -4.6);
  barge.add(bHull, bCargo, cabin);
  barge.position.set(-roadHalfWidth - 14, -1.05, 4);
  barge.rotation.y = 0.06;
  group.add(barge);
  boats.push(barge);

  const woodHullMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.82 });
  const woodRoofMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.7 });
  for (const bx of [roadHalfWidth + 14, -roadHalfWidth - 36]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 7.0), woodHullMat);
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.8, 8, 1, false, 0, Math.PI), woodRoofMat);
    canopy.rotation.z = Math.PI / 2;
    canopy.rotation.y = Math.PI / 2;
    canopy.position.set(0, 0.42, 0);
    boat.add(hull, canopy);
    boat.position.set(bx, -1.12, -8);
    group.add(boat);
    boats.push(boat);
  }

  return { group, boats };
}

export function buildElevatedExpresswayWithBananiRamp(textures: ProceduralTextureSet): THREE.Group {
  const sp = ELEVATED_EXPRESSWAY_DEF;
  // Base deck + Mohakhali twin entry + Kawla Toll + Airport descent, with left parapet cleanly OPEN across Banani Y-fork
  const group = buildElevatedFlyoverSpan(textures, {
    startZ: sp.startZ,
    deckStartZ: sp.deckStartZ,
    deckEndZ: sp.deckEndZ,
    endZ: sp.endZ,
    deckHeight: sp.deckHeight,
    rampLeftMinX: sp.rampLeftMinX,
    rampLeftMaxX: sp.rampLeftMaxX,
    rampRightMinX: sp.rampRightMinX,
    rampRightMaxX: sp.rampRightMaxX,
    deckMinX: sp.deckMinX,
    deckMaxX: sp.deckMaxX,
    tollPlazaZ: sp.tollPlazaZ,
    leftBarrierOpeningZ: [sp.bananiExitStartZ, sp.bananiExitForkClearZ],
  });

  const midWorldZ = (sp.startZ + sp.endZ) * 0.5;
  const toLocalZ = (wz: number) => wz - midWorldZ;

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.76 });
  const girderMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72 });
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.68 });
  const hazardYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.48 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.68, roughness: 0.36 });
  const deckAsphaltMat = new THREE.MeshStandardMaterial({
    map: textures.expresswayDeck,
    roughness: 0.84,
    metalness: 0.04,
  });

  // 1. Seamless Continuous 152m 3-Phase Banani Exit Down-Ramp (branches left past -9.2 at 6.5m BEFORE descending!)
  const segCount = 48;
  const totalLen = sp.bananiExitStartZ - sp.bananiExitEndZ;
  const bananiSlices: ViaductSlice[] = [];
  let accumDist = 0;
  let prevX = 0;
  let prevZ = 0;
  for (let i = 0; i <= segCount; i++) {
    const wz = sp.bananiExitStartZ - (i / segCount) * totalLen;
    const sample = sampleBananiDownRamp(wz);
    if (i > 0) {
      accumDist += Math.hypot(sample.centerX - prevX, wz - prevZ);
    }
    prevX = sample.centerX;
    prevZ = wz;
    bananiSlices.push({
      cx: sample.centerX,
      y: sample.y,
      z: toLocalZ(wz),
      halfW: sample.halfWidth,
      dist: accumDist,
      // Omit right barrier inside the Y-fork split so no concrete wall blocks mainline left lanes;
      // omit overlapping left edge right at the first 6m flare off the main deck parapet.
      skipRightBarrier: wz > sp.bananiExitForkClearZ + 1.5,
      skipLeftBarrier: wz > sp.bananiExitStartZ - 6.0,
    });
  }
  addContinuousViaductRibbon(group, bananiSlices, concreteMat, girderMat, barrierMat, steelMat, deckAsphaltMat, {
    hasApproachAbutment: true,
    addPiers: true,
    pierSpacing: 26,
    taperEndBarriers: true,
    uvScale: 1 / 18,
  });

  // 2. Cushioned Y-Fork Gore Nose & Yellow-Black Crash Barrels separating Mainline (-9.2) and Banani Ramp (-12.0)
  const goreZ = sp.bananiExitForkClearZ;
  const goreBullnose = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.84, 1.8), barrierMat);
  goreBullnose.position.set(-10.6, sp.deckHeight + 0.42, toLocalZ(goreZ - 0.5));
  group.add(goreBullnose);
  for (let b = 0; b < 3; b++) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46 - b * 0.08, 0.5 - b * 0.08, 0.84, 10),
      b % 2 === 0 ? hazardYellowMat : blackMat
    );
    barrel.position.set(-10.1 + b * 0.28, sp.deckHeight + 0.42, toLocalZ(goreZ + 1.2 + b * 1.15));
    group.add(barrel);
  }

  // 3. Painted Amber-White Exit Arrows & "বনানী ↓ / EXIT ↓" Asphalt Decals leading onto the Ramp
  const arrowDecalMat = new THREE.MeshBasicMaterial({
    map: textures.bananiExitDeckArrows,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const decalZ of [-406, -428, -450, -472, -496]) {
    const sample = decalZ > sp.bananiExitStartZ ? null : sampleBananiDownRamp(decalZ);
    const decalX = sample ? sample.centerX : -6.6;
    const decalY = (sample ? sample.y : sp.deckHeight) + 0.055;
    const aheadSample = sampleBananiDownRamp(Math.max(sp.bananiExitEndZ, decalZ - 6));
    const dx = aheadSample.centerX - decalX;
    const dy = aheadSample.y - (sample ? sample.y : sp.deckHeight);
    const yaw = sample ? Math.atan2(-dx, 6) : 0;
    const pitch = sample ? Math.atan2(dy, 6) : 0;

    const arrowPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 11.5), arrowDecalMat);
    arrowPlane.position.set(decalX, decalY, toLocalZ(decalZ));
    arrowPlane.rotation.order = 'YXZ';
    arrowPlane.rotation.y = yaw;
    arrowPlane.rotation.x = -Math.PI * 0.5 + pitch;
    group.add(arrowPlane);
  }

  // 4. Reflective Yellow Guardrail Chevron Markers along outer left curve of Banani Ramp
  const postPoleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.45 });
  for (let wz = sp.bananiExitStartZ - 10; wz >= sp.bananiExitEndZ + 52; wz -= 11) {
    const s = sampleBananiDownRamp(wz);
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.42), postPoleMat);
    chevron.position.set(s.centerX - s.halfWidth + 0.14, s.y + 1.15, toLocalZ(wz));
    group.add(chevron);
  }

  // 5. Upstream Banani Exit Split Gantry (Z = -414, well before -440 Y-fork opens)
  const gantryLz = toLocalZ(sp.bananiExitStartZ + 26);
  const deckW = sp.deckMaxX - sp.deckMinX;
  for (const sx of [sp.deckMinX + 0.25, sp.deckMaxX - 0.25]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.2, 8), steelMat);
    col.position.set(sx, sp.deckHeight + 2.6, gantryLz);
    group.add(col);
  }
  const cross = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.24, 0.26), steelMat);
  cross.position.set(0, sp.deckHeight + 5.1, gantryLz);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(deckW - 1.4, 2.35, 0.18),
    new THREE.MeshBasicMaterial({ map: textures.bananiExitSign })
  );
  signBoard.position.set(0, sp.deckHeight + 4.35, gantryLz);
  group.add(cross, signBoard);

  // 6. Direct Illuminated Portal Arch right over the Banani Down-Ramp Mouth (Z = -474, cx ≈ -13.8)
  const mouthZ = sp.bananiExitForkClearZ + 8;
  const mouthSample = sampleBananiDownRamp(mouthZ);
  const mouthLz = toLocalZ(mouthZ);
  for (const sx of [-mouthSample.halfWidth + 0.18, mouthSample.halfWidth - 0.18]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 4.6, 8), steelMat);
    leg.position.set(mouthSample.centerX + sx, mouthSample.y + 2.3, mouthLz);
    group.add(leg);
  }
  const mouthBar = new THREE.Mesh(new THREE.BoxGeometry(mouthSample.halfWidth * 2, 0.22, 0.22), steelMat);
  mouthBar.position.set(mouthSample.centerX, mouthSample.y + 4.55, mouthLz);
  const mouthBoard = new THREE.Mesh(
    new THREE.BoxGeometry(mouthSample.halfWidth * 2 + 0.6, 1.55, 0.18),
    new THREE.MeshBasicMaterial({ map: textures.bananiRampPortalSign })
  );
  mouthBoard.position.set(mouthSample.centerX, mouthSample.y + 3.9, mouthLz);
  group.add(mouthBar, mouthBoard);

  // Airport Interchange Apron at foot of Expressway (Z = -1080) blending cleanly into Leg 6 (-95, -1080)
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x2d3138, roughness: 0.88 });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(108, 0.06, 22), apronMat);
  apron.position.set(-48, 0.01, toLocalZ(sp.endZ));
  apron.receiveShadow = true;
  group.add(apron);

  return group;
}

export function buildKurilFlyoverLandmark(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.76 });
  const girderMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72 });
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
  const deckMat = new THREE.MeshStandardMaterial({ map: textures.expresswayDeck, roughness: 0.84 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.68, roughness: 0.36 });
  const hazardYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.48 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const postPoleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xca8a04, emissiveIntensity: 0.45 });

  // Group is positioned at (0, 0, -760) in world.ts -> localZ = worldZ + 760
  const toLocalZ = (wz: number) => wz + 760;

  // 1. Drivable Kuril Flyover Viaduct from Kuril Up-Ramp (X=-7.2, Z=-714) -> High 9.4m Overpass -> Purbachal 300ft (X=242, Z=-864.5)
  const kurilSlices: ViaductSlice[] = KURIL_RAMP_SAMPLES.map((s) => ({
    cx: s.x,
    y: s.y,
    z: toLocalZ(s.z),
    halfW: s.halfWidth,
    dist: s.dist,
    skipRightBarrier: s.u < 0.08,
    // Never drop piers through Airport Rd / Elevated Expressway at X=0 OR onto 300ft asphalt carriageways
    skipPier: Math.abs(s.x) < 12.2 || (s.x > 85 && s.z > -884 && s.z < -832),
  }));
  addContinuousViaductRibbon(group, kurilSlices, concreteMat, girderMat, barrierMat, steelMat, deckMat, {
    hasApproachAbutment: true,
    addPiers: true,
    pierSpacing: 26,
    taperEndBarriers: true,
    uvScale: 1 / 18,
  });

  // 2. Cushioned gore barrels separating straight Airport-Gazipur Rd (X > -4.4) from left Kuril Up-Ramp mouth
  const goreZ = -732;
  const goreLz = toLocalZ(goreZ);
  for (let b = 0; b < 3; b++) {
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45 - b * 0.08, 0.48 - b * 0.08, 0.82, 10),
      b % 2 === 0 ? hazardYellowMat : blackMat
    );
    barrel.position.set(-4.35, 0.41, goreLz + b * 1.1);
    group.add(barrel);
  }

  // 3. Upstream Kuril Route Split Overhead Gantry (Z = -690, localZ = +70):
  //    Left: Kuril Flyover -> Purbachal 300ft | Straight: Airport -> Uttara -> Gazipur
  const forkLz = toLocalZ(-690);
  for (const sx of [-10.8, 10.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 5.6, 8), steelMat);
    post.position.set(sx, 2.8, forkLz);
    post.castShadow = true;
    group.add(post);
  }
  const forkBar = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.25, 0.28), steelMat);
  forkBar.position.set(0, 5.5, forkLz);
  const forkBoard = new THREE.Mesh(
    new THREE.BoxGeometry(19.6, 2.55, 0.2),
    new THREE.MeshBasicMaterial({ map: textures.kurilForkPortalSign })
  );
  forkBoard.position.set(0, 4.5, forkLz);
  group.add(forkBar, forkBoard);

  // 4. Direct Illuminated Portal Arch right over Kuril Up-Ramp Entrance (Z = -715, x = -7.2)
  const rampPortalLz = toLocalZ(KURIL_300FT_RAMP_DEF.startZ - 1);
  for (const sx of [-3.1, 3.1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 4.6, 8), steelMat);
    leg.position.set(-7.2 + sx, 2.3, rampPortalLz);
    group.add(leg);
  }
  const rampBar = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.22, 0.22), steelMat);
  rampBar.position.set(-7.2, 4.55, rampPortalLz);
  const rampBoard = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 1.5, 0.18),
    new THREE.MeshBasicMaterial({ map: textures.kurilRampPortalSign })
  );
  rampBoard.position.set(-7.2, 3.9, rampPortalLz);
  group.add(rampBar, rampBoard);

  // 5. Reflective Yellow Guide Chevrons along climbing & curving deck edges
  for (let i = 4; i < KURIL_RAMP_SAMPLES.length - 4; i += 4) {
    const s = KURIL_RAMP_SAMPLES[i];
    const chevron = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.72, 0.42), postPoleMat);
    chevron.position.set(s.x - s.nx * (s.halfWidth - 0.14), s.y + 1.12, toLocalZ(s.z - s.nz * (s.halfWidth - 0.14)));
    chevron.rotation.y = s.yaw;
    group.add(chevron);
  }

  // 6. Painted Asphalt Guide Arrows leading into Kuril Up-Ramp (Z = -696, -708, -720)
  const arrowDecalMat = new THREE.MeshBasicMaterial({
    map: textures.bananiExitDeckArrows,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const wz of [-698, -711]) {
    const arrow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 9.6), arrowDecalMat);
    arrow.rotation.x = -Math.PI * 0.5;
    arrow.position.set(-7.2, 0.045, toLocalZ(wz));
    group.add(arrow);
  }

  return group;
}

export function buildArmyCantonmentLandmark(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();
  const oliveMat = new THREE.MeshStandardMaterial({ color: 0x3f4f2f, roughness: 0.78 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.72 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.45, roughness: 0.35 });
  const barrierRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
  const towerRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });

  // Monumental Garrison Perimeter Wall & Entrance Gatehouse facing road (+X)
  const backHall = new THREE.Mesh(new THREE.BoxGeometry(7.2, 7.2, 24), creamMat);
  backHall.position.set(-4.2, 3.6, 0);
  backHall.castShadow = true;
  backHall.receiveShadow = true;
  group.add(backHall);

  const oliveTrim = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.35, 24.4), oliveMat);
  oliveTrim.position.set(-4.2, 6.9, 0);
  group.add(oliveTrim);

  // Twin Military Watchtowers / Columns flanking Cantonment Garrison Gate
  for (const tz of [-7.5, 7.5]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 8.6, 3.2), oliveMat);
    tower.position.set(1.2, 4.3, tz);
    tower.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 3.6), goldMat);
    cap.position.set(1.2, 8.85, tz);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 2.8), towerRoofMat);
    cabin.position.set(1.2, 9.95, tz);
    group.add(tower, cap, cabin);
  }

  // Arch Canopy + Crest + Dhaka Cantonment Signboard
  const archBeam = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 15.6), oliveMat);
  archBeam.position.set(1.2, 6.8, 0);
  archBeam.castShadow = true;
  const signMat = new THREE.MeshBasicMaterial({ map: textures.armyCantonmentSign });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 2.2), signMat);
  sign.position.set(2.55, 6.8, 0);
  sign.rotation.y = Math.PI / 2;
  const signBack = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 2.2), signMat);
  signBack.position.set(-0.15, 6.8, 0);
  signBack.rotation.y = -Math.PI / 2;
  group.add(archBeam, sign, signBack);

  // Striped Garrison Checkpost Boom Barrier
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 1.6),
      i % 2 === 0 ? barrierRedMat : creamMat
    );
    seg.position.set(2.8, 1.35, -4.0 + i * 1.6);
    group.add(seg);
  }

  return group;
}

export function buildNavyHQLandmark(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();
  const navyMat = new THREE.MeshStandardMaterial({ color: 0x0f2d5c, roughness: 0.45, metalness: 0.25 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.18, metalness: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5, roughness: 0.3 });

  // Main Nautical White & Navy-Blue Naval Headquarters Complex
  const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(8.6, 9.2, 24), whiteMat);
  baseBlock.position.set(-2.5, 4.6, 0);
  baseBlock.castShadow = true;
  baseBlock.receiveShadow = true;

  const upperDeck = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.8, 16), navyMat);
  upperDeck.position.set(-2.5, 11.1, 0);
  upperDeck.castShadow = true;

  const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.0, 14.2), glassMat);
  bridgeGlass.position.set(0.75, 11.1, 0);

  // Naval Communications Radar Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 5.2, 8), whiteMat);
  mast.position.set(-2.5, 15.6, 0);
  const dish = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.85, 2.8), goldMat);
  dish.position.set(-2.5, 17.6, 0);
  group.add(baseBlock, upperDeck, bridgeGlass, mast, dish);

  // Roadside Navy Gate Signboard facing Airport Road (+X)
  const gatePlinth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.2, 14.5), navyMat);
  gatePlinth.position.set(3.2, 2.1, 0);
  const signMat = new THREE.MeshBasicMaterial({ map: textures.navyHqSign });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 2.65), signMat);
  board.position.set(3.95, 2.4, 0);
  board.rotation.y = Math.PI / 2;
  group.add(gatePlinth, board);

  return group;
}

export function buildKurmitolaHospitalLandmark(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const tealMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.2, metalness: 0.5 });
  const redCrossMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 0.4,
    roughness: 0.35,
  });

  // 6-Story General Hospital Tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(9.4, 14.5, 25), whiteMat);
  tower.position.set(3.0, 7.25, 0);
  tower.castShadow = true;
  tower.receiveShadow = true;

  const tealBand = new THREE.Mesh(new THREE.BoxGeometry(9.7, 1.5, 25.3), tealMat);
  tealBand.position.set(3.0, 14.0, 0);

  // Glass window strips facing Airport Rd (-X)
  for (const fy of [5.2, 8.2, 11.2]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.55, 21), glassMat);
    strip.position.set(-1.75, fy, 0);
    group.add(strip);
  }

  // Emergency Ambulance Canopy Porch facing road (-X)
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.55, 11.5), tealMat);
  canopy.position.set(-3.2, 4.1, 0);
  canopy.castShadow = true;
  for (const cz of [-4.6, 4.6]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 4.1, 8), whiteMat);
    col.position.set(-4.8, 2.05, cz);
    group.add(col);
  }

  // Signature Illuminated 3D Red Cross Emblem on Facade
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.32, 3.2, 0.95), redCrossMat);
  crossV.position.set(-1.82, 10.6, 0);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.95, 3.2), redCrossMat);
  crossH.position.set(-1.82, 10.6, 0);

  const signMat = new THREE.MeshBasicMaterial({ map: textures.kurmitolaHospitalSign });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10.8, 2.1), signMat);
  sign.position.set(-5.45, 4.4, 0);
  sign.rotation.y = -Math.PI / 2;

  group.add(tower, tealBand, canopy, crossV, crossH, sign);
  return group;
}

export function buildBashundharaResidentialLandmark(textures: ProceduralTextureSet): THREE.Group {
  const group = new THREE.Group();
  const navyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.48, metalness: 0.35 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.55, roughness: 0.3 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.7 });
  const towerGlassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.55 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.35, roughness: 0.45 });

  // Grand Bashundhara Residential Area (বসুন্ধরা আবাসিক এলাকা) Main Gate Arch facing 300ft Road (-X)
  for (const pz of [-8.2, 8.2]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 8.4, 2.6), stoneMat);
    pillar.position.set(-6.0, 4.2, pz);
    pillar.castShadow = true;
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 2.8), goldMat);
    band.position.set(-6.0, 8.2, pz);
    group.add(pillar, band);
  }
  const archTop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 19.0), navyMat);
  archTop.position.set(-6.0, 7.2, 0);
  archTop.castShadow = true;
  const signMat = new THREE.MeshBasicMaterial({ map: textures.bashundharaSign });
  const gateBoard = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 2.15), signMat);
  gateBoard.position.set(-7.35, 7.2, 0);
  gateBoard.rotation.y = -Math.PI / 2;
  group.add(archTop, gateBoard);

  // Two Sleek Residential High-Rises + ICCB Convention Dome set well inside Bashundhara Township (+X)
  const towerDefs = [
    { x: 9.0, z: -15.5, w: 10.5, h: 24, d: 12.5 },
    { x: 11.5, z: 14.5, w: 11.0, h: 29, d: 13.0 },
  ];
  for (let i = 0; i < towerDefs.length; i++) {
    const td = towerDefs[i];
    const bld = new THREE.Mesh(
      new THREE.BoxGeometry(td.w, td.h, td.d),
      new THREE.MeshStandardMaterial({
        map: textures.buildingFacades[(i + 1) % textures.buildingFacades.length],
        roughness: 0.65,
      })
    );
    bld.position.set(td.x, td.h * 0.5, td.z);
    bld.castShadow = true;
    bld.receiveShadow = true;
    const crown = new THREE.Mesh(new THREE.BoxGeometry(td.w + 0.5, 1.4, td.d + 0.5), navyMat);
    crown.position.set(td.x, td.h + 0.7, td.z);
    group.add(bld, crown);
  }

  // ICCB Glass-Roof Convention Hall Dome between the towers
  const hall = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 9.2, 5.2, 16), towerGlassMat);
  hall.position.set(13.5, 2.6, 0);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), domeMat);
  dome.position.set(13.5, 5.1, 0);
  group.add(hall, dome);

  return group;
}

export function buildHousingBillboard(tex: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.72, roughness: 0.38 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.5, roughness: 0.45 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 1.25,
  });

  // Heavy cylindrical unipole steel column (9.8m tall)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 9.8, 10), steelMat);
  pole.position.set(0, 4.9, 0);
  pole.castShadow = true;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 1.6), steelMat);
  plinth.position.set(0, 0.42, 0);

  // Horizontal steel truss & wide 11.4m x 5.4m housing estate hoarding
  const backing = new THREE.Mesh(new THREE.BoxGeometry(11.6, 5.6, 0.34), frameMat);
  backing.position.set(0, 10.6, 0);
  backing.castShadow = true;

  const faceMat = new THREE.MeshBasicMaterial({ map: tex });
  const frontFace = new THREE.Mesh(new THREE.PlaneGeometry(11.1, 5.1), faceMat);
  frontFace.position.set(0, 10.6, 0.19);
  const backFace = new THREE.Mesh(new THREE.PlaneGeometry(11.1, 5.1), faceMat);
  backFace.position.set(0, 10.6, -0.19);
  backFace.rotation.y = Math.PI;

  // Overhead billboard floodlight arms
  for (const lx of [-3.6, 0, 3.6]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.15), steelMat);
    arm.position.set(lx, 13.55, 0.52);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.22), lampMat);
    bulb.position.set(lx, 13.5, 1.05);
    group.add(arm, bulb);
  }

  group.add(pole, plinth, backing, frontFace, backFace);
  return group;
}






