import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';
import { GAME_CONFIG, VEHICLE_SPECS, type TrafficLightPhase, type VehicleKind } from './types';

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

export function buildHeroMotorcycle(textures: ProceduralTextureSet): HeroBikeRig {
  const root = new THREE.Group();
  root.scale.setScalar(GAME_CONFIG.BIKE_SCALE);
  addContactShadow(root, textures.contactShadow, 1.65, 3.0);

  const leanGroup = new THREE.Group();
  root.add(leanGroup);

  const redPaint = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    roughness: 0.2,
    metalness: 0.48,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
    map: textures.heroTank,
  });
  const redCowl = new THREE.MeshPhysicalMaterial({
    color: 0xb91c1c,
    roughness: 0.24,
    metalness: 0.4,
    clearcoat: 0.85,
  });
  const matteBlack = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72, metalness: 0.25 });
  const gunmetal = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.36, metalness: 0.78 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.14, metalness: 0.95 });
  const goldForkMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.24, metalness: 0.85 });
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
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.36), redCowl);
    shroud.position.set(sx, 0.78, -0.32);
    shroud.rotation.x = 0.24;
    shroud.rotation.y = sx > 0 ? -0.15 : 0.15;
    leanGroup.add(shroud);
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

  const exhaustTip = new THREE.Object3D();
  exhaustTip.position.set(0.25, 0.55, 1.06);
  leanGroup.add(exhaustTip);

  const flameMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 });
  const boostFlame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.62, 10), flameMat);
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

  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.04), tintedGlassMat);
  windscreen.position.set(0, 1.1, -0.64);
  windscreen.rotation.x = -0.65;
  frontFork.add(windscreen);

  const headlightLens = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.13, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: 0xfef08a, emissiveIntensity: 2.1, roughness: 0.1 })
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
  const jacketMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45 });
  const helmetMat = new THREE.MeshPhysicalMaterial({ color: 0xef4444, roughness: 0.16, metalness: 0.4, clearcoat: 0.92 });
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
  hasIntersection: boolean
): THREE.Group {
  const metro = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85, metalness: 0.05 });
  const darkConcreteMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.88 });
  const railSteelMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.85, roughness: 0.3 });
  const bannerMat = new THREE.MeshBasicMaterial({ map: textures.metroBanner });
  const pillarSignMat = new THREE.MeshBasicMaterial({ map: textures.pillarSign });

  const girderBottom = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.95, blockLen), concreteMat);
  girderBottom.position.set(0, 6.45, 0);
  girderBottom.castShadow = true;
  girderBottom.receiveShadow = true;
  metro.add(girderBottom);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.45, blockLen), concreteMat);
  deck.position.set(0, 7.12, 0);
  deck.castShadow = true;
  metro.add(deck);

  for (const sx of [-3.05, 3.05]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.85, blockLen), concreteMat);
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
  for (const pz of pierOffsets) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 2.4), darkConcreteMat);
    base.position.set(0, 0.3, pz);
    metro.add(base);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 5.4, 10), concreteMat);
    column.position.set(0, 3.0, pz);
    column.castShadow = true;
    metro.add(column);

    const pierCap = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.75, 1.8), concreteMat);
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


