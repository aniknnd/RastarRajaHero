import * as THREE from 'three';
import { buildTrafficVehicle, buildHeroMotorcycle } from '@/src/game/models';
import { createProceduralTextures } from '@/src/game/textures';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const TRAFFIC = [
  'cycle', 'rickshaw', 'vangari', 'cng', 'biker', 'hatchback', 'car', 'taxi', 'sport',
  'muscle', 'suv_prado', 'pickup', 'leguna', 'van', 'police', 'ambulance', 'rab',
  'covered_van', 'cement_mixer', 'bus_nitol', 'bus_nitol_staff', 'bus_brtc', 'bus_hanif',
  'bus_shohag', 'bus_double_decker', 'truck', 'oil_tanker', 'fire_truck', 'army', 'monster',
] as const;
const BIKES = ['glamour_125', 'xtreme_160r', 'karizma_210'] as const;

const params = new URLSearchParams(location.search);
const only = params.get('v');
const page = Number(params.get('page') ?? '0');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const textures = createProceduralTextures(renderer);

const all: Array<{ label: string; make: () => THREE.Group }> = [
  ...TRAFFIC.map((kind, i) => ({
    label: kind,
    make: () => buildTrafficVehicle(kind as never, textures, i).group,
  })),
  ...BIKES.map((id) => ({
    label: id,
    make: () => buildHeroMotorcycle(textures, id as never).group,
  })),
];

function buildScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb4d8);
  scene.environment = envMap;
  scene.fog = new THREE.Fog(0x8fb4d8, 40, 95);

  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x4a4a44, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
  sun.position.set(8, 14, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  const d = 16;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 1.1);
  rim.position.set(-9, 5, -10);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x5d6470, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(200, 100, 0x77808f, 0x6b7280);
  (grid.material as THREE.Material).opacity = 0.25;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = 0.01;
  scene.add(grid);

  return scene;
}

const scene = buildScene();

// ---- single vehicle view -------------------------------------------------
if (only) {
  const entry = all.find((e) => e.label === only) ?? all[0];
  const group = entry.make();
  scene.add(group);
  const box = new THREE.Box3().expandByObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z);

  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 500);
  const yaw = Number(params.get('yaw') ?? '-0.72');
  const pitch = Number(params.get('pitch') ?? '0.24');
  const dist = radius * (Number(params.get('dist') ?? '1.75'));
  camera.position.set(
    center.x + Math.sin(yaw) * Math.cos(pitch) * dist,
    center.y + Math.sin(pitch) * dist,
    center.z + Math.cos(yaw) * Math.cos(pitch) * dist
  );
  camera.lookAt(center.x, center.y + size.y * 0.05, center.z);
  renderer.render(scene, camera);
  document.getElementById('label')!.textContent = entry.label;
} else {
  // ---- grid view ---------------------------------------------------------
  const cols = 4;
  const rows = 2;
  const perPage = cols * rows;
  const selected = all.slice(page * perPage, page * perPage + perPage);

  const cw = innerWidth / cols;
  const ch = innerHeight / rows;

  renderer.setScissorTest(true);
  selected.forEach((entry, index) => {
    const cellScene = buildScene();
    const group = entry.make();
    cellScene.add(group);
    const box = new THREE.Box3().expandByObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z);

    const camera = new THREE.PerspectiveCamera(34, cw / ch, 0.1, 500);
    const yaw = -0.72;
    const pitch = 0.25;
    const dist = radius * (entry.label.includes('bus') || entry.label === 'truck' ? 2.0 : 1.85);
    camera.position.set(
      center.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      center.y + Math.sin(pitch) * dist,
      center.z + Math.cos(yaw) * Math.cos(pitch) * dist
    );
    camera.lookAt(center.x, center.y + size.y * 0.02, center.z);

    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * cw;
    const y = innerHeight - (row + 1) * ch;
    renderer.setViewport(x, y, cw, ch);
    renderer.setScissor(x, y, cw, ch);
    renderer.setClearColor(0x8fb4d8, 1);
    renderer.render(cellScene, camera);
  });
  document.getElementById('label')!.textContent = `grid page ${page}`;
}

(globalThis as unknown as { __ready: boolean }).__ready = true;
