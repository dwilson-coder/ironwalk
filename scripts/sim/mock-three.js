// Minimal stand-in for three.js so the game logic can run headless in Node.
// Transforms are simplified (no rotation in world positions) — enough to exercise all code paths.
export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { this.x = this.y = this.z = s; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  project() { this.x = this.x / 30; this.y = this.y / 20; return this; }
}
export class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; return this; } }
export class Color {
  constructor(c) { this.hex = typeof c === 'number' ? c : 0; }
  setHex(h) { if (typeof h !== 'number' || Number.isNaN(h)) throw new Error('Color.setHex bad value ' + h); this.hex = h; return this; }
  setHSL() { return this; } set(c) { return this; }
}
const MATS = new Set();
class Material {
  constructor(p = {}) {
    Object.assign(this, p);
    this.color = new Color(p.color ?? 0xffffff);
    this.emissive = new Color(p.emissive ?? 0);
    if (this.opacity == null) this.opacity = 1;
    this.disposed = false; MATS.add(this);
  }
  dispose() { this.disposed = true; MATS.delete(this); }
}
export class MeshStandardMaterial extends Material {}
export class MeshBasicMaterial extends Material {}
export class SpriteMaterial extends Material { constructor(p) { super(p); this.rotation = 0; } }
export class PointsMaterial extends Material {}
export class LineBasicMaterial extends Material {}

let GEOS = 0;
class Geometry {
  constructor() { GEOS++; this.attributes = {}; }
  rotateX() { return this; } rotateY() { return this; } rotateZ() { return this; } translate() { return this; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  dispose() { GEOS--; }
}
export class BufferGeometry extends Geometry {}
export class BoxGeometry extends Geometry {}
export class SphereGeometry extends Geometry {}
export class CylinderGeometry extends Geometry {}
export class ConeGeometry extends Geometry {}
export class TorusGeometry extends Geometry {}
export class RingGeometry extends Geometry {}
export class PlaneGeometry extends Geometry {}
export class BufferAttribute { constructor(array, size) { this.array = array; this.itemSize = size; this.needsUpdate = false; } }

class Rot { constructor() { this.x = 0; this.y = 0; this.z = 0; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } }
export class Object3D {
  constructor() { this.position = new Vector3(); this.rotation = new Rot(); this.scale = new Vector3(1, 1, 1); this.children = []; this.parent = null; this.visible = true; this.userData = {}; this.name = ''; }
  add(...objs) { for (const o of objs) { if (!o) throw new Error('add(undefined)'); if (o.parent) o.parent.remove(o); o.parent = this; this.children.push(o); } return this; }
  remove(...objs) { for (const o of objs) { const i = this.children.indexOf(o); if (i >= 0) { this.children.splice(i, 1); o.parent = null; } } return this; }
  traverse(fn) { fn(this); for (const c of [...this.children]) c.traverse(fn); }
  updateMatrixWorld() {} updateMatrix() {} lookAt() {}
  getWorldPosition(v) {
    let x = this.position.x, y = this.position.y, z = this.position.z, p = this.parent;
    while (p) { x = p.position.x + x * p.scale.x; y = p.position.y + y * p.scale.y; z = p.position.z + z * p.scale.z; p = p.parent; }
    for (const n of [x, y, z]) if (!Number.isFinite(n)) throw new Error('getWorldPosition produced NaN');
    return v.set(x, y, z);
  }
}
export class Group extends Object3D {}
export class Scene extends Object3D { constructor() { super(); this.background = null; this.fog = null; } }
export class Mesh extends Object3D { constructor(g, m) { super(); if (!g) throw new Error('Mesh without geometry'); if (!m) throw new Error('Mesh without material'); this.geometry = g; this.material = m; } }
export class Sprite extends Object3D { constructor(m) { super(); this.material = m; } }
export class Points extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class LineSegments extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
class Light extends Object3D { constructor(color, intensity = 1) { super(); this.color = new Color(color); this.intensity = intensity; } }
export class PointLight extends Light {}
export class HemisphereLight extends Light {}
export class DirectionalLight extends Light { constructor(c, i) { super(c, i); this.target = new Object3D(); this.shadow = { mapSize: { set() {} }, camera: {}, bias: 0, normalBias: 0 }; } }
export class PerspectiveCamera extends Object3D { constructor(fov, aspect) { super(); this.fov = fov; this.aspect = aspect; } updateProjectionMatrix() {} }
export class Fog { constructor(c, n, f) { this.color = c; this.near = n; this.far = f; } }
export class CanvasTexture { constructor() { this.repeat = { set() {} }; } dispose() {} }
export class Plane { constructor(n, c) { this.normal = n; this.constant = c; } }
export class Raycaster { constructor() { this.ray = { intersectPlane: (p, t) => t.set(Raycaster.aimX || 0, Raycaster.aimY || 3, 0) }; } setFromCamera() {} }
export class WebGLRenderer { constructor() { this.shadowMap = {}; } setPixelRatio() {} setSize() {} compile() {} render() {} dispose() {} }
export const sRGBEncoding = 3001, PCFSoftShadowMap = 2, ACESFilmicToneMapping = 4, RepeatWrapping = 1000;
export const AdditiveBlending = 2, NormalBlending = 1, DoubleSide = 2;
export const __stats = { mats: () => MATS.size, geos: () => GEOS };
