// Structural verification for vehicle models: instantiates every vehicle with
// the real game builders via vite SSR and measures design metrics per vehicle.
// Usage: node dev/verify_models.mjs
import { createServer } from 'vite';

// --- Stubs so textures.ts can run in Node (no DOM / WebGL in this script) ---
const noopCtx = new Proxy(
  {},
  {
    get: (_t, key) => {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return () => ({ addColorStop: () => {} });
      }
      return () => {};
    },
    set: () => true,
  }
);
const fakeCanvas = {
  width: 0,
  height: 0,
  getContext: () => noopCtx,
  addEventListener: () => {},
  removeEventListener: () => {},
};
global.document = { createElement: () => fakeCanvas, createElementNS: () => fakeCanvas };
const stubRenderer = { capabilities: { getMaxAnisotropy: () => 8 } };

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});
const THREE = await server.ssrLoadModule('three');
const models = await server.ssrLoadModule('/src/game/models.ts');
const textures = await server.ssrLoadModule('/src/game/textures.ts');
const types = await server.ssrLoadModule('/src/game/types.ts');

const tex = textures.createProceduralTextures(stubRenderer);

function measureGroup(group, label, spec) {
  const meshes = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  const materials = new Set();
  let shadowMeshes = 0;
  let emissiveMeshes = 0;
  const metallic = [];
  for (const m of meshes) {
    if (m.castShadow) shadowMeshes++;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat) continue;
      materials.add(mat);
      if ((mat.emissiveIntensity ?? 0) > 0.01) emissiveMeshes++;
      if (mat.metalness !== undefined && mat.metalness > 0.5) metallic.push(m);
    }
  }
  const roughnessSum = [...materials].reduce((s, m) => s + (m.roughness ?? 0.5), 0);
  const box = new THREE.Box3().expandByObject(group).getSize(new THREE.Vector3());
  return {
    kind: label,
    meshes: meshes.length,
    materials: materials.size,
    shadowMeshes,
    emissiveMeshes,
    metallic: metallic.length,
    avgRoughness: +(roughnessSum / materials.size).toFixed(3),
    bboxX: +box.x.toFixed(2),
    bboxY: +box.y.toFixed(2),
    bboxZ: +box.z.toFixed(2),
    specW: spec ? +(spec.halfWidth * 2).toFixed(2) : null,
    specL: spec ? +(spec.halfLength * 2).toFixed(2) : null,
  };
}

const trafficKinds = [
  'cycle', 'rickshaw', 'vangari', 'cng', 'biker', 'hatchback', 'car', 'taxi', 'sport',
  'muscle', 'suv_prado', 'pickup', 'leguna', 'van', 'police', 'ambulance', 'rab',
  'covered_van', 'cement_mixer', 'bus_nitol', 'bus_nitol_staff', 'bus_brtc', 'bus_hanif',
  'bus_shohag', 'bus_double_decker', 'truck', 'oil_tanker', 'fire_truck', 'army', 'monster',
];

const out = [];
trafficKinds.forEach((kind, i) => {
  const rig = models.buildTrafficVehicle(kind, tex, i);
  out.push(measureGroup(rig.group, kind, types.VEHICLE_SPECS[kind]));
});
const bikeIds = ['glamour_125', 'xtreme_160r', 'karizma_210'];
bikeIds.forEach((id) => {
  const rig = models.buildHeroMotorcycle(tex, id);
  out.push(measureGroup(rig.group, id, null));
});

console.log(JSON.stringify(out, null, 1));
await server.close();
