import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GameState } from "./game-engine";
import { GAME_CONSTANTS as C, getPlayerAabbWorld, getObstacleAabbAtLane } from "./game-engine";

/* ── constants ── */
const LANE_W = 2;
const PATH_W = 7;
const TILE_LEN = 20;
const TILE_COUNT = 16;
const IS_MOBILE = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
const NUM_TREES = 40;
const NUM_BUSHES = 30;
const NUM_TORCHES = 18;
const DECOR_RANGE = 500;
const COIN_MAX = 30;

const FOG_COLOR = 0x223828;

/* reusable math objects */
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _coinFlipQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const _yAxis = new THREE.Vector3(0, 1, 0);

/* ── procedural textures ── */

function makeStoneTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 512;
  const cx = cv.getContext("2d")!;
  // dark grout base
  cx.fillStyle = "#3a2e22";
  cx.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 4; c++) {
      const off = r % 2 ? 64 : 0;
      const bx = c * 128 + off + 4, by = r * 64 + 4, bw = 120, bh = 54;
      const v = Math.random() * 32 - 16;
      // tile fill with variation
      cx.fillStyle = `rgb(${115 + v},${98 + v},${76 + v})`;
      cx.fillRect(bx, by, bw, bh);
      // inner bevel highlight (top-left lighter)
      cx.fillStyle = `rgba(${140 + v},${120 + v},${95 + v},0.3)`;
      cx.fillRect(bx, by, bw, 3);
      cx.fillRect(bx, by, 3, bh);
      // inner bevel shadow (bottom-right darker)
      cx.fillStyle = `rgba(${60 + v},${48 + v},${35 + v},0.4)`;
      cx.fillRect(bx, by + bh - 3, bw, 3);
      cx.fillRect(bx + bw - 3, by, 3, bh);
      // worn center with subtle color shift
      if (Math.random() > 0.3) {
        cx.fillStyle = `rgba(${100 + v},${85 + v},${65 + v},0.35)`;
        cx.fillRect(bx + 8, by + 6, bw - 16, bh - 12);
      }
      // dark wear patches near edges
      if (Math.random() > 0.5) {
        cx.fillStyle = `rgba(50,40,28,${0.15 + Math.random() * 0.2})`;
        const px = bx + (Math.random() < 0.5 ? 0 : bw - 30);
        cx.fillRect(px, by + Math.random() * bh * 0.5, 15 + Math.random() * 20, 8 + Math.random() * 15);
      }
      // moss at edges
      if (Math.random() > 0.55) {
        cx.fillStyle = `rgba(35,58,25,${0.2 + Math.random() * 0.25})`;
        cx.fillRect(bx + Math.random() * 60, by + bh - 18 + Math.random() * 10, 18 + Math.random() * 24, 6 + Math.random() * 12);
      }
      // cracks
      if (Math.random() > 0.7) {
        cx.strokeStyle = `rgba(30,22,15,${0.3 + Math.random() * 0.3})`;
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(bx + Math.random() * bw, by);
        cx.lineTo(bx + Math.random() * bw, by + bh);
        cx.stroke();
      }
    }
  }
  // worn center path (lighter strip down the middle)
  cx.fillStyle = "rgba(130,112,88,0.12)";
  cx.fillRect(180, 0, 150, 512);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function makeGrassTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 256;
  const cx = cv.getContext("2d")!;
  const g = cx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, "#1e3a22"); g.addColorStop(1, "#122a14");
  cx.fillStyle = g; cx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) {
    cx.fillStyle = `rgba(${20 + Math.random() * 35},${50 + Math.random() * 45},${22 + Math.random() * 28},0.4)`;
    cx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 5, 2 + Math.random() * 5);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 12);
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

function makeSkyTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 4; cv.height = 256;
  const cx = cv.getContext("2d")!;
  const g = cx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#22183a"); g.addColorStop(0.25, "#2a2848");
  g.addColorStop(0.5, "#1e3535"); g.addColorStop(0.75, "#223828");
  g.addColorStop(1, "#223828");
  cx.fillStyle = g; cx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearFilter;
  return t;
}

function makeMountainTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 512; cv.height = 128;
  const cx = cv.getContext("2d")!;
  cx.clearRect(0, 0, 512, 128);
  for (let layer = 0; layer < 3; layer++) {
    const shade = 20 + layer * 10;
    cx.fillStyle = `rgb(${shade},${shade + 5},${shade + 2})`;
    cx.beginPath(); cx.moveTo(0, 128);
    for (let x = 0; x <= 512; x += 16) {
      cx.lineTo(x, 50 - layer * 14 + Math.sin(x * 0.035 + layer * 2) * 22 + Math.sin(x * 0.09 + layer) * 10);
    }
    cx.lineTo(512, 128); cx.closePath(); cx.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  t.minFilter = THREE.LinearFilter;
  return t;
}

/* ── renderer class ── */

export class GameRenderer3D {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private container: HTMLElement;

  /* ground tiles */
  private pathTiles: THREE.Mesh[] = [];
  private grassTiles: THREE.Mesh[] = [];
  private curbTiles: THREE.Mesh[] = [];
  private infGround!: THREE.Mesh;

  /* character */
  private runner!: THREE.Group;
  private characterRig!: THREE.Group;
  private head!: THREE.Mesh;
  private torso!: THREE.Mesh;
  private armL!: THREE.Group;
  private armR!: THREE.Group;
  private legL!: THREE.Group;
  private legR!: THREE.Group;
  private shadow!: THREE.Mesh;
  private shieldVis!: THREE.Mesh;
  private magnetVis!: THREE.Mesh;
  private runAnimTime = 0;

  /* obstacles */
  private obstaclePool: THREE.Object3D[] = [];

  /* coins */
  private coinMesh!: THREE.InstancedMesh;
  private coinRingMesh!: THREE.InstancedMesh;

  /* power-ups */
  private powerUpPool: THREE.Mesh[] = [];

  /* decorations */
  private treeTrunks!: THREE.InstancedMesh;
  private treeCrowns!: THREE.InstancedMesh;
  private bushMesh!: THREE.InstancedMesh;
  private treeData: { x: number; z: number; h: number; cr: number }[] = [];
  private bushData: { x: number; z: number; r: number }[] = [];
  private torchBodyInst!: THREE.InstancedMesh;
  private torchFlameInst!: THREE.InstancedMesh;
  private torchData: { z: number; side: number }[] = [];

  /* parallax */
  private parallaxGroup!: THREE.Group;
  private skyMesh!: THREE.Mesh;

  /* warnings */
  private warningPlanes: THREE.Mesh[] = [];

  /* debug */
  private hitboxDebugGroup!: THREE.Group;
  private playerHitboxHelper!: THREE.LineSegments;
  private obstacleHitboxHelpers: THREE.LineSegments[] = [];

  /* misc state */
  private sunLight!: THREE.DirectionalLight;
  private cameraSmoothedX = 0;
  private laneLean = 0;
  private prevPhase = "idle";
  private perfFrame = 0;
  private lastDt = 1 / 60;
  showPerf = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initScene();
    this.buildGround();
    this.buildRunner();
    this.buildObstacles();
    this.buildCoins();
    this.buildPowerUps();
    this.buildDecorations();
    this.buildTorches();
    this.buildParallax();
    this.buildWarnings();
    this.buildHitboxDebug();
  }

  /* ═══════════════ LAYER 0: Scene setup ═══════════════ */

  private initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(FOG_COLOR);
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, 0.014);

    const w = this.container.clientWidth || 400;
    const h = this.container.clientHeight || 700;
    this.camera = new THREE.PerspectiveCamera(58, w / h, 0.4, 300);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !IS_MOBILE,
      precision: IS_MOBILE ? "mediump" : "highp",
      powerPreference: "high-performance",
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.sortObjects = false;
    this.renderer.shadowMap.enabled = false;
    this.container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0x808878, 0.7));
    this.scene.add(new THREE.HemisphereLight(0x8aaccc, 0x3a5a28, 0.5));

    this.sunLight = new THREE.DirectionalLight(0xfff0d0, 1.2);
    this.sunLight.position.set(14, 28, -6);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  /* ═══════════════ LAYER 1: Ground (tiled) ═══════════════ */

  private buildGround() {
    const stoneTex = makeStoneTexture();
    stoneTex.repeat.set(2, 1);
    const pathMat = new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xa08868 });
    const pathGeo = new THREE.PlaneGeometry(PATH_W, TILE_LEN);
    pathGeo.rotateX(-Math.PI / 2);

    const grassTex = makeGrassTexture();
    grassTex.repeat.set(4, 1);
    const grassMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0x4a7a48 });
    const gL = new THREE.PlaneGeometry(50, TILE_LEN); gL.rotateX(-Math.PI / 2); gL.translate(-(PATH_W / 2 + 25), -0.05, 0);
    const gR = new THREE.PlaneGeometry(50, TILE_LEN); gR.rotateX(-Math.PI / 2); gR.translate(PATH_W / 2 + 25, -0.05, 0);
    const grassGeo = mergeGeometries([gL, gR], false);

    const curbMat = new THREE.MeshLambertMaterial({ color: 0x7a7060, emissive: 0x080604, emissiveIntensity: 0.08 });
    const curbTopMat = new THREE.MeshLambertMaterial({ color: 0x8a8272 });
    const cH = 0.25, cT = 0.3;
    // main curb body
    const cLg = new THREE.BoxGeometry(cT, cH, TILE_LEN); cLg.translate(-PATH_W / 2 - cT / 2, cH / 2, 0);
    const cRg = new THREE.BoxGeometry(cT, cH, TILE_LEN); cRg.translate(PATH_W / 2 + cT / 2, cH / 2, 0);
    // top bevel strip (lighter stone)
    const cLt = new THREE.BoxGeometry(cT + 0.06, 0.04, TILE_LEN); cLt.translate(-PATH_W / 2 - cT / 2, cH + 0.02, 0);
    const cRt = new THREE.BoxGeometry(cT + 0.06, 0.04, TILE_LEN); cRt.translate(PATH_W / 2 + cT / 2, cH + 0.02, 0);
    const curbGeo = mergeGeometries([cLg, cRg, cLt, cRt], false);

    for (let i = 0; i < TILE_COUNT; i++) {
      const z = -TILE_LEN * 2 + i * TILE_LEN;
      const p = new THREE.Mesh(pathGeo, pathMat);
      p.position.set(0, 0, z); this.scene.add(p); this.pathTiles.push(p);
      const g = new THREE.Mesh(grassGeo, grassMat);
      g.position.set(0, 0, z); this.scene.add(g); this.grassTiles.push(g);
      const c = new THREE.Mesh(curbGeo, curbMat);
      c.position.set(0, 0, z); this.scene.add(c); this.curbTiles.push(c);
    }

    this.infGround = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshLambertMaterial({ color: 0x1a3018 })
    );
    this.infGround.rotation.x = -Math.PI / 2;
    this.infGround.position.y = -0.15;
    this.scene.add(this.infGround);
  }

  private recycleTiles(playerZ: number) {
    this.infGround.position.z = playerZ;
    for (let i = 0; i < TILE_COUNT; i++) {
      const tile = this.pathTiles[i];
      if (tile.position.z + TILE_LEN / 2 < playerZ - TILE_LEN * 2) {
        let maxZ = -Infinity;
        for (let j = 0; j < TILE_COUNT; j++) {
          if (this.pathTiles[j].position.z > maxZ) maxZ = this.pathTiles[j].position.z;
        }
        const newZ = maxZ + TILE_LEN;
        tile.position.z = newZ;
        this.grassTiles[i].position.z = newZ;
        this.curbTiles[i].position.z = newZ;
      }
    }
  }

  /* ═══════════════ LAYER 2: Character ═══════════════ */

  private buildRunner() {
    const skin = new THREE.MeshLambertMaterial({ color: 0xd4a882 });
    const cloth = new THREE.MeshLambertMaterial({ color: 0x7a5a32, emissive: 0x1a0e04, emissiveIntensity: 0.12 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x3a3845 });
    const boots = new THREE.MeshLambertMaterial({ color: 0x4a3828 });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1a1210 });

    this.runner = new THREE.Group();
    this.runner.scale.setScalar(0.82);
    this.characterRig = new THREE.Group();

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), skin);
    this.head.position.y = 1.22;
    this.characterRig.add(this.head);
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairM.position.y = 1.26;
    this.characterRig.add(hairM);

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.22), cloth);
    this.torso.position.y = 0.92;
    this.characterRig.add(this.torso);

    const beltM = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.23), boots);
    beltM.position.y = 0.72;
    this.characterRig.add(beltM);

    this.armL = this.makeArm(skin, cloth, -0.22);
    this.armR = this.makeArm(skin, cloth, 0.22);
    this.characterRig.add(this.armL, this.armR);

    this.legL = this.makeLeg(pants, boots, -0.1);
    this.legR = this.makeLeg(pants, boots, 0.1);
    this.characterRig.add(this.legL, this.legR);

    this.runner.add(this.characterRig);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.01;
    this.runner.add(this.shadow);

    this.shieldVis = new THREE.Mesh(
      new THREE.SphereGeometry(0.78, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x4499ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, emissive: 0x2266cc, emissiveIntensity: 0.35 })
    );
    this.shieldVis.position.y = 0.82;
    this.shieldVis.visible = false;
    this.runner.add(this.shieldVis);

    this.magnetVis = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0xffdd44, transparent: true, opacity: 0.1, side: THREE.DoubleSide, emissive: 0xcc8800, emissiveIntensity: 0.3 })
    );
    this.magnetVis.position.y = 0.82;
    this.magnetVis.visible = false;
    this.runner.add(this.magnetVis);

    this.scene.add(this.runner);
  }

  private makeArm(skin: THREE.Material, cloth: THREE.Material, xOff: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(xOff, 1.06, 0);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), cloth);
    upper.position.y = -0.1;
    g.add(upper);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.09), skin);
    fore.position.y = -0.24;
    g.add(fore);
    return g;
  }

  private makeLeg(pants: THREE.Material, boots: THREE.Material, xOff: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(xOff, 0.56, 0);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.24, 0.13), pants);
    thigh.position.y = -0.12;
    g.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.11), pants);
    shin.position.y = -0.32;
    g.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.16), boots);
    boot.position.set(0, -0.44, 0.02);
    g.add(boot);
    return g;
  }

  /* ═══════════════ LAYER 3: Obstacles ═══════════════ */

  private buildObstacles() {
    // PILLARS — tapered column with decorative bands
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x7a7568, emissive: 0x221010, emissiveIntensity: 0.1 });
    const pillarMossMat = new THREE.MeshLambertMaterial({ color: 0x4a5a42, emissive: 0x0a1508, emissiveIntensity: 0.08 });
    const bandMat = new THREE.MeshLambertMaterial({ color: 0x8a8478, emissive: 0x181210, emissiveIntensity: 0.08 });

    const colBody = new THREE.CylinderGeometry(0.32, 0.44, 2.6, 8); colBody.translate(0, 1.55, 0);
    const topBand = new THREE.CylinderGeometry(0.38, 0.36, 0.15, 8); topBand.translate(0, 2.92, 0);
    const botBand = new THREE.CylinderGeometry(0.48, 0.5, 0.18, 8); botBand.translate(0, 0.16, 0);
    const basePlinth = new THREE.BoxGeometry(1.0, 0.12, 1.0); basePlinth.translate(0, 0.06, 0);
    const mossRing = new THREE.CylinderGeometry(0.46, 0.46, 0.3, 8); mossRing.translate(0, 0.4, 0);

    for (let i = 0; i < 10; i++) {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(colBody, pillarMat));
      grp.add(new THREE.Mesh(topBand, bandMat));
      grp.add(new THREE.Mesh(botBand, bandMat));
      grp.add(new THREE.Mesh(basePlinth, pillarMat));
      grp.add(new THREE.Mesh(mossRing, pillarMossMat));
      grp.visible = false;
      grp.userData = { obsType: "pillar", baseEmit: new THREE.Color(0x221010), warnBaseEmissive: 0.1 };
      this.scene.add(grp); this.obstaclePool.push(grp);
    }

    // BARRIERS — stone rubble blocks with variation
    const rubbleMat = new THREE.MeshLambertMaterial({ color: 0x6a5a48, emissive: 0x180808, emissiveIntensity: 0.08 });
    const rubbleTopMat = new THREE.MeshLambertMaterial({ color: 0x5a4a38, emissive: 0x140606, emissiveIntensity: 0.06 });
    const rubbleBody = new THREE.BoxGeometry(2.1, 0.45, 0.65); rubbleBody.translate(0, 0.23, 0);
    const rubbleTop = new THREE.BoxGeometry(1.8, 0.12, 0.55); rubbleTop.translate(0, 0.51, 0);
    const rubbleChip = new THREE.BoxGeometry(0.3, 0.2, 0.25); rubbleChip.translate(0.7, 0.1, 0.25);
    for (let i = 0; i < 7; i++) {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(rubbleBody, rubbleMat));
      grp.add(new THREE.Mesh(rubbleTop, rubbleTopMat));
      grp.add(new THREE.Mesh(rubbleChip, rubbleMat));
      grp.rotation.z = 0.04;
      grp.visible = false;
      grp.userData = { obsType: "barrier", baseEmit: new THREE.Color(0x180808), warnBaseEmissive: 0.08 };
      this.scene.add(grp); this.obstaclePool.push(grp);
    }

    // FIRE PITS — bowl + layered flame with additive glow
    const bowlMat = new THREE.MeshLambertMaterial({ color: 0x3a2818, emissive: 0x221008, emissiveIntensity: 0.2 });
    const flameCoreMat = new THREE.MeshLambertMaterial({
      color: 0xffcc22, emissive: 0xffaa00, emissiveIntensity: 1.2,
    });
    const flameOuterMat = new THREE.MeshBasicMaterial({
      color: 0xff4400, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.2,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });

    const bowlGeo = new THREE.CylinderGeometry(0.38, 0.28, 0.35, 8); bowlGeo.translate(0, 0.18, 0);
    const rimGeo = new THREE.TorusGeometry(0.38, 0.04, 6, 12); rimGeo.rotateX(Math.PI / 2); rimGeo.translate(0, 0.35, 0);
    const flameCoreGeo = new THREE.ConeGeometry(0.15, 0.5, 6); flameCoreGeo.translate(0, 0.62, 0);
    const flameOuterGeo = new THREE.ConeGeometry(0.25, 0.6, 6); flameOuterGeo.translate(0, 0.58, 0);
    const glowGeo = new THREE.SphereGeometry(0.4, 6, 4); glowGeo.translate(0, 0.55, 0);

    for (let i = 0; i < 5; i++) {
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(bowlGeo, bowlMat));
      grp.add(new THREE.Mesh(rimGeo, bowlMat));
      const core = new THREE.Mesh(flameCoreGeo, flameCoreMat); core.name = "fireCore";
      grp.add(core);
      const outer = new THREE.Mesh(flameOuterGeo, flameOuterMat); outer.name = "fireOuter";
      grp.add(outer);
      const glow = new THREE.Mesh(glowGeo, glowMat); glow.name = "fireGlow";
      grp.add(glow);
      grp.position.y = 0.02;
      grp.visible = false;
      grp.userData = { obsType: "fire", baseEmit: new THREE.Color(0x551510), warnBaseEmissive: 0.35, fireIdx: i };
      this.scene.add(grp); this.obstaclePool.push(grp);
    }
  }

  /* ═══════════════ LAYER 4: Coins + Power-ups ═══════════════ */

  private buildCoins() {
    const coinMat = new THREE.MeshLambertMaterial({ color: 0xffdd44, emissive: 0xffaa00, emissiveIntensity: 0.5 });
    this.coinMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10), coinMat, COIN_MAX);
    this.coinMesh.count = 0;
    this.scene.add(this.coinMesh);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.5, depthWrite: false });
    this.coinRingMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.24, 0.025, 6, 12), ringMat, COIN_MAX);
    this.coinRingMesh.count = 0;
    this.scene.add(this.coinRingMesh);
  }

  private buildPowerUps() {
    const defs: [string, number, number][] = [
      ["speed", 0xff3300, 0xff1100],
      ["shield", 0x0088ff, 0x0044ff],
      ["life", 0x00ff44, 0x00aa22],
      ["magnet", 0xffdd00, 0xffaa00],
    ];
    for (const [type, col, em] of defs) {
      const mat = new THREE.MeshLambertMaterial({ color: col, emissive: em, emissiveIntensity: 0.45 });
      for (let j = 0; j < 3; j++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), mat);
        m.visible = false;
        m.userData.puType = type;
        this.scene.add(m);
        this.powerUpPool.push(m);
      }
    }
  }

  /* ═══════════════ LAYER 5: Decorations ═══════════════ */

  private buildDecorations() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4020 });
    const crownMat = new THREE.MeshLambertMaterial({ color: 0x2a6a35, emissive: 0x0a2a10, emissiveIntensity: 0.12 });
    const bushMat = new THREE.MeshLambertMaterial({ color: 0x357a3a, emissive: 0x0c2a0e, emissiveIntensity: 0.1 });

    this.treeTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.55, 1, 8), trunkMat, NUM_TREES);
    this.treeCrowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 5), crownMat, NUM_TREES);
    this.bushMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), bushMat, NUM_BUSHES);
    this.treeTrunks.frustumCulled = false;
    this.treeCrowns.frustumCulled = false;
    this.bushMesh.frustumCulled = false;
    this.scene.add(this.treeTrunks, this.treeCrowns, this.bushMesh);

    const treeSpacing = DECOR_RANGE / NUM_TREES;
    for (let i = 0; i < NUM_TREES; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.treeData.push({
        x: side * (PATH_W / 2 + 5 + Math.random() * 12),
        z: -10 + i * treeSpacing + (Math.random() - 0.5) * 5,
        h: 7 + Math.random() * 8,
        cr: 2.5 + Math.random() * 3,
      });
    }
    this.syncTreeInstances();

    const bushSpacing = DECOR_RANGE / NUM_BUSHES;
    for (let i = 0; i < NUM_BUSHES; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.bushData.push({
        x: side * (PATH_W / 2 + 2 + Math.random() * 3.5),
        z: -10 + i * bushSpacing + (Math.random() - 0.5) * 4,
        r: 0.5 + Math.random() * 0.8,
      });
    }
    this.syncBushInstances();
  }

  private syncTreeInstances() {
    for (let i = 0; i < this.treeData.length; i++) {
      const d = this.treeData[i];
      _p.set(d.x, d.h / 2, d.z); _s.set(1, d.h, 1);
      _m.compose(_p, _q, _s); this.treeTrunks.setMatrixAt(i, _m);
      _p.set(d.x, d.h + d.cr * 0.4, d.z); _s.set(d.cr, d.cr * 0.8, d.cr);
      _m.compose(_p, _q, _s); this.treeCrowns.setMatrixAt(i, _m);
    }
    _s.set(1, 1, 1);
    this.treeTrunks.instanceMatrix.needsUpdate = true;
    this.treeCrowns.instanceMatrix.needsUpdate = true;
  }

  private syncBushInstances() {
    for (let i = 0; i < this.bushData.length; i++) {
      const d = this.bushData[i];
      _p.set(d.x, d.r * 0.4, d.z); _s.set(d.r * 1.2, d.r * 0.7, d.r);
      _m.compose(_p, _q, _s); this.bushMesh.setMatrixAt(i, _m);
    }
    _s.set(1, 1, 1);
    this.bushMesh.instanceMatrix.needsUpdate = true;
  }

  private torchGlowInst!: THREE.InstancedMesh;

  private buildTorches() {
    // stone column + base + capital + bowl
    const colGeo = new THREE.CylinderGeometry(0.1, 0.15, 1.2, 6); colGeo.translate(0, 0.7, 0);
    const baseGeo = new THREE.BoxGeometry(0.38, 0.18, 0.38); baseGeo.translate(0, 0.09, 0);
    const capGeo = new THREE.BoxGeometry(0.32, 0.12, 0.32); capGeo.translate(0, 1.34, 0);
    const bowlGeo = new THREE.CylinderGeometry(0.16, 0.1, 0.14, 6); bowlGeo.translate(0, 1.45, 0);
    const bracketL = new THREE.BoxGeometry(0.04, 0.2, 0.04); bracketL.translate(-0.12, 1.2, 0);
    const bracketR = new THREE.BoxGeometry(0.04, 0.2, 0.04); bracketR.translate(0.12, 1.2, 0);
    const merged = mergeGeometries([colGeo, baseGeo, capGeo, bowlGeo, bracketL, bracketR], false);

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x5a5348, emissive: 0x0a0805, emissiveIntensity: 0.1 });
    const flameMat = new THREE.MeshLambertMaterial({ color: 0xffaa22, emissive: 0xff6600, emissiveIntensity: 1.2 });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.15,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });

    this.torchBodyInst = new THREE.InstancedMesh(merged, bodyMat, NUM_TORCHES);
    this.torchFlameInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.32, 6), flameMat, NUM_TORCHES);
    this.torchGlowInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 6, 4), glowMat, NUM_TORCHES);
    this.torchBodyInst.frustumCulled = false;
    this.torchFlameInst.frustumCulled = false;
    this.torchGlowInst.frustumCulled = false;
    this.scene.add(this.torchBodyInst, this.torchFlameInst, this.torchGlowInst);

    let zAcc = -10;
    for (let i = 0; i < NUM_TORCHES; i++) {
      zAcc += 14 + Math.random() * 6;
      this.torchData.push({ z: zAcc, side: i % 2 === 0 ? -1 : 1 });
    }
    this.syncTorchInstances(0);
  }

  private syncTorchInstances(t: number) {
    for (let i = 0; i < this.torchData.length; i++) {
      const d = this.torchData[i];
      const x = d.side * (PATH_W / 2 + 1.2);
      _p.set(x, 0, d.z); _s.set(1, 1, 1);
      _m.compose(_p, _q, _s); this.torchBodyInst.setMatrixAt(i, _m);
      // flame with per-torch animation offset
      const phase = t * 9 + i * 2.3;
      const fs = 0.82 + Math.sin(phase) * 0.2;
      const fy = 0.85 + Math.sin(t * 7.5 + i * 1.9) * 0.18;
      _p.set(x, 1.62 + Math.sin(t * 6.5 + i * 1.5) * 0.03, d.z);
      _s.set(fs, fy, fs);
      _m.compose(_p, _q, _s); this.torchFlameInst.setMatrixAt(i, _m);
      // glow sphere pulses
      const gs = 0.8 + Math.sin(phase * 0.7) * 0.25;
      _p.set(x, 1.6, d.z);
      _s.set(gs, gs, gs);
      _m.compose(_p, _q, _s); this.torchGlowInst.setMatrixAt(i, _m);
      _s.set(1, 1, 1);
    }
    this.torchBodyInst.instanceMatrix.needsUpdate = true;
    this.torchFlameInst.instanceMatrix.needsUpdate = true;
    this.torchGlowInst.instanceMatrix.needsUpdate = true;
  }

  /* ═══════════════ LAYER 6: Parallax ═══════════════ */

  private buildParallax() {
    this.parallaxGroup = new THREE.Group();
    this.scene.add(this.parallaxGroup);

    this.skyMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    this.skyMesh.visible = false;

    const mountMat = new THREE.MeshBasicMaterial({ map: makeMountainTexture(), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const mountMesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 38), mountMat);
    mountMesh.position.set(0, 16, -85);
    this.parallaxGroup.add(mountMesh);

    const midCv = document.createElement("canvas"); midCv.width = 512; midCv.height = 80;
    const mcx = midCv.getContext("2d")!;
    mcx.fillStyle = "#1a2e22"; mcx.fillRect(0, 0, 512, 80);
    for (let i = 0; i < 50; i++) {
      const px = Math.random() * 512;
      mcx.fillStyle = `rgba(28,52,35,${0.5 + Math.random() * 0.4})`;
      const th = 25 + Math.random() * 45;
      mcx.fillRect(px, 80 - th, 4 + Math.random() * 8, th);
      mcx.beginPath(); mcx.arc(px + 4, 80 - th, 6 + Math.random() * 10, 0, Math.PI * 2);
      mcx.fillStyle = `rgba(25,50,32,${0.4 + Math.random() * 0.3})`; mcx.fill();
    }
    const midTex = new THREE.CanvasTexture(midCv);
    midTex.wrapS = THREE.RepeatWrapping; midTex.repeat.set(4, 1);
    const midMat = new THREE.MeshBasicMaterial({ map: midTex, transparent: true, opacity: 0.85, depthWrite: false });
    const midMesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 32), midMat);
    midMesh.position.set(0, 9, -55);
    this.parallaxGroup.add(midMesh);
  }

  /* ═══════════════ LAYER 7: Warnings + Debug ═══════════════ */

  private buildWarnings() {
    const wm = new THREE.MeshLambertMaterial({ color: 0xffcc00, emissive: 0xff6600, emissiveIntensity: 0.6, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.35), wm);
      m.visible = false; m.rotation.x = -Math.PI / 2.2;
      this.scene.add(m); this.warningPlanes.push(m);
    }
  }

  private buildHitboxDebug() {
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff88 });
    const obMat = new THREE.LineBasicMaterial({ color: 0xff4444 });
    const mkBox = (hx: number, hy: number, hz: number, mat: THREE.LineBasicMaterial) => {
      const g = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
      const e = new THREE.EdgesGeometry(g); g.dispose();
      return new THREE.LineSegments(e, mat);
    };
    this.hitboxDebugGroup = new THREE.Group();
    this.scene.add(this.hitboxDebugGroup);
    this.playerHitboxHelper = mkBox(0.2, 0.8, 0.2, lineMat);
    this.playerHitboxHelper.visible = false;
    this.hitboxDebugGroup.add(this.playerHitboxHelper);
    for (let i = 0; i < 36; i++) {
      const h = mkBox(0.5, 0.5, 0.5, obMat);
      h.visible = false;
      this.obstacleHitboxHelpers.push(h);
      this.hitboxDebugGroup.add(h);
    }
  }

  /* ═══════════════ RECYCLING ═══════════════ */

  private recycleDecorations(playerZ: number) {
    const BEHIND = 15;

    let maxTreeZ = -Infinity;
    for (let i = 0; i < this.treeData.length; i++) if (this.treeData[i].z > maxTreeZ) maxTreeZ = this.treeData[i].z;
    let treeDirty = false;
    for (let i = 0; i < this.treeData.length; i++) {
      const d = this.treeData[i];
      if (d.z < playerZ - BEHIND) {
        d.z = maxTreeZ + 8 + Math.random() * 14;
        d.x = (i % 2 === 0 ? -1 : 1) * (PATH_W / 2 + 5 + Math.random() * 12);
        d.h = 7 + Math.random() * 8; d.cr = 2.5 + Math.random() * 3;
        maxTreeZ = d.z; treeDirty = true;
      }
    }
    if (treeDirty) {
      this.syncTreeInstances();
      this.treeTrunks.computeBoundingSphere();
      this.treeCrowns.computeBoundingSphere();
    }

    let maxBushZ = -Infinity;
    for (let i = 0; i < this.bushData.length; i++) if (this.bushData[i].z > maxBushZ) maxBushZ = this.bushData[i].z;
    let bushDirty = false;
    for (let i = 0; i < this.bushData.length; i++) {
      const d = this.bushData[i];
      if (d.z < playerZ - BEHIND) {
        d.z = maxBushZ + 6 + Math.random() * 10;
        d.x = (i % 2 === 0 ? -1 : 1) * (PATH_W / 2 + 2 + Math.random() * 3.5);
        d.r = 0.5 + Math.random() * 0.8;
        maxBushZ = d.z; bushDirty = true;
      }
    }
    if (bushDirty) {
      this.syncBushInstances();
      this.bushMesh.computeBoundingSphere();
    }

    let maxTorchZ = -Infinity;
    for (let i = 0; i < this.torchData.length; i++) if (this.torchData[i].z > maxTorchZ) maxTorchZ = this.torchData[i].z;
    for (let i = 0; i < this.torchData.length; i++) {
      const d = this.torchData[i];
      if (d.z < playerZ - BEHIND) {
        d.z = maxTorchZ + 14 + Math.random() * 6;
        d.side = Math.random() < 0.5 ? -1 : 1;
        maxTorchZ = d.z;
      }
    }
  }

  /* ═══════════════ MAIN UPDATE ═══════════════ */

  update(state: GameState, deltaSec = 1 / 60) {
    const dt = Math.max(0, Math.min(0.05, deltaSec));
    this.lastDt = dt;
    const t = performance.now() * 0.001;
    const playerZ = state.worldZ;
    const run = state.phase === "running";
    const effSpd = state.speed * (state.speedBoostActive ? 1.5 : 1);

    // — ground tile recycling —
    this.recycleTiles(playerZ);

    // — parallax —
    this.parallaxGroup.position.z = playerZ * 0.06;
    this.skyMesh.rotation.y = t * 0.015;

    // — runner position —
    const targetX = state.laneOffset * LANE_W;
    const laneK = Math.min(1, 0.15 * 60 * dt);
    this.runner.position.x += (targetX - this.runner.position.x) * laneK;
    this.runner.position.z = playerZ;
    let jumpY = 0;
    if (state.isJumping) jumpY = Math.sin((state.jumpTime / C.JUMP_DURATION_SEC) * Math.PI) * C.JUMP_PEAK_HEIGHT;
    this.runner.position.y = jumpY;

    if (state.phase === "idle") { this.cameraSmoothedX = this.runner.position.x; this.runAnimTime = 0; }
    else if (run) this.runAnimTime += dt;

    // — lean —
    const targetLean = (state.laneOffset - state.lane) * 0.35 + (targetX - this.runner.position.x) * 0.4;
    this.laneLean += (targetLean - this.laneLean) * 0.12;
    this.runner.rotation.z = -this.laneLean * 0.25;
    this.runner.rotation.y = -this.laneLean * 0.08;

    // — blink when invincible —
    this.runner.visible = state.invincibleTimer > 0 ? Math.floor(state.frame * 0.5) % 2 === 0 : true;

    // — shadow —
    this.shadow.position.y = 0.01 - jumpY;
    const ss = 1 / (1 + jumpY * 0.14);
    this.shadow.scale.setScalar(ss);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.3 * ss;

    // — shield / magnet —
    this.shieldVis.visible = state.shieldActive;
    if (state.shieldActive) { this.shieldVis.scale.setScalar(1 + Math.sin(t * 4) * 0.08); this.shieldVis.rotation.y = t * 1.5; }
    this.magnetVis.visible = state.magnetActive;
    if (state.magnetActive) { this.magnetVis.scale.setScalar(1 + Math.sin(t * 3) * 0.06); this.magnetVis.rotation.y = -t * 2; }

    // — animation —
    if (state.isSliding) this.animSlide();
    else if (state.isJumping) this.animJump();
    else if (run) this.animRun(this.runAnimTime, effSpd);
    else this.animIdle();

    // — camera —
    const rx = this.runner.position.x, ry = this.runner.position.y, rz = this.runner.position.z;
    this.cameraSmoothedX += (rx - this.cameraSmoothedX) * laneK;
    this.camera.position.set(this.cameraSmoothedX, ry + 4, rz - 6);
    this.camera.lookAt(rx, ry + 1, rz + 2);

    // — sun —
    this.sunLight.position.set(rx + 14, 28, playerZ + 12);
    this.sunLight.target.position.set(rx, 0, playerZ + 4);

    // — recycle decorations —
    this.recycleDecorations(playerZ);
    this.syncTorchInstances(t);

    // — animate fire obstacles —
    for (let i = 0; i < this.obstaclePool.length; i++) {
      const o = this.obstaclePool[i];
      if (o.visible && o.userData.obsType === "fire") {
        const fi = (o.userData.fireIdx as number) || 0;
        o.traverse((ch) => {
          if (ch.name === "fireCore") {
            ch.scale.x = 0.85 + Math.sin(t * 10 + fi * 2) * 0.18;
            ch.scale.z = 0.85 + Math.cos(t * 11 + fi * 2.3) * 0.18;
            ch.scale.y = 0.9 + Math.sin(t * 8 + fi * 1.7) * 0.12;
          } else if (ch.name === "fireOuter") {
            ch.scale.x = 0.9 + Math.sin(t * 7 + fi * 1.5) * 0.15;
            ch.scale.z = 0.9 + Math.cos(t * 8.5 + fi * 1.8) * 0.15;
            ch.scale.y = 0.88 + Math.sin(t * 9 + fi * 2.1) * 0.14;
            ch.rotation.y += 0.08;
          } else if (ch.name === "fireGlow") {
            const gs = 0.8 + Math.sin(t * 5 + fi) * 0.3;
            ch.scale.setScalar(gs);
          }
        });
      }
    }

    // — obstacles —
    for (let i = 0; i < this.obstaclePool.length; i++) this.obstaclePool[i].visible = false;
    let warnIdx = 0;
    for (let i = 0; i < state.obstacles.length; i++) {
      const obs = state.obstacles[i];
      if (obs.hit) continue;
      const relZ = obs.z - playerZ;
      if (relZ < -5 || relZ > C.MAX_Z + 20) continue;
      const obsType = obs.type === "double_pillar" ? "pillar" : obs.type;

      const place = (lt: string, laneIdx: number) => {
        let obj: THREE.Object3D | undefined;
        for (let j = 0; j < this.obstaclePool.length; j++) {
          if (!this.obstaclePool[j].visible && this.obstaclePool[j].userData.obsType === lt) { obj = this.obstaclePool[j]; break; }
        }
        if (!obj) return;
        obj.visible = true;
        const baseY = lt === "barrier" ? 0 : lt === "fire" ? 0.02 : 0;
        obj.position.set(laneIdx * LANE_W, baseY, obs.z);
        const warn = relZ > 12 && relZ < 56;
        this.applyWarn(obj, warn, state.frame);
      };
      place(obsType, obs.lane);
      if (obs.type === "double_pillar") {
        const sl = obs.lane === 1 ? 0 : obs.lane === -1 ? 0 : 1;
        place("pillar", sl);
      }
      if (relZ > 28 && relZ < 48 && warnIdx < this.warningPlanes.length) {
        const w = this.warningPlanes[warnIdx++];
        w.visible = true; w.position.set(obs.lane * LANE_W, 0.05, obs.z - 2);
        (w.material as THREE.MeshLambertMaterial).opacity = 0.35 + Math.sin(state.frame * 0.4) * 0.2;
      }
    }
    for (let w = warnIdx; w < this.warningPlanes.length; w++) this.warningPlanes[w].visible = false;

    // — coins —
    let ci = 0;
    for (let i = 0; i < state.coinItems.length; i++) {
      const coin = state.coinItems[i];
      if (coin.collected) continue;
      const relZ = coin.z - playerZ;
      if (relZ < -5 || relZ > C.MAX_Z + 20 || ci >= COIN_MAX) continue;
      const cx = coin.lane * LANE_W;
      const cy = 0.65 + Math.sin(t * 2.8 + coin.z) * 0.12;
      _p.set(cx, cy, coin.z);
      const cq = new THREE.Quaternion().setFromAxisAngle(_yAxis, t * 5.5 + coin.z).multiply(_coinFlipQ);
      _s.set(1, 1, 1);
      _m.compose(_p, cq, _s); this.coinMesh.setMatrixAt(ci, _m);
      const rq = new THREE.Quaternion().setFromAxisAngle(_yAxis, t * 5.5 + coin.z).multiply(_coinFlipQ);
      _p.set(cx, cy + 0.4, coin.z);
      _m.compose(_p, rq, _s); this.coinRingMesh.setMatrixAt(ci, _m);
      ci++;
    }
    this.coinMesh.count = ci;
    this.coinRingMesh.count = ci;
    if (ci > 0) { this.coinMesh.instanceMatrix.needsUpdate = true; this.coinRingMesh.instanceMatrix.needsUpdate = true; }

    // — power-ups —
    for (let i = 0; i < this.powerUpPool.length; i++) this.powerUpPool[i].visible = false;
    for (let i = 0; i < state.powerUps.length; i++) {
      const pu = state.powerUps[i];
      if (pu.collected) continue;
      const relZ = pu.z - playerZ;
      if (relZ < -5 || relZ > C.MAX_Z + 20) continue;
      let obj: THREE.Mesh | undefined;
      for (let j = 0; j < this.powerUpPool.length; j++) {
        if (!this.powerUpPool[j].visible && this.powerUpPool[j].userData.puType === pu.type) { obj = this.powerUpPool[j]; break; }
      }
      if (obj) {
        obj.visible = true;
        let baseY = 1.55, sc = 1.0;
        switch (pu.type) {
          case "speed": sc = 1 + Math.sin(t * 5 + pu.z) * 0.18; obj.rotation.y = t * 6; break;
          case "shield": obj.rotation.y = t * 2; obj.rotation.x = t * 1.1; sc = 1 + Math.sin(t * 3) * 0.08; break;
          case "life": baseY += Math.abs(Math.sin(t * 3 + pu.z)) * 0.45; obj.rotation.y = t * 2.5; break;
          case "magnet": obj.rotation.y = t * 8; sc = 1 + Math.sin(t * 4) * 0.12; break;
        }
        obj.position.set(pu.lane * LANE_W, baseY, pu.z);
        obj.scale.setScalar(sc);
      }
    }

    // — debug hitboxes —
    if (state.debugHitboxes) {
      this.hitboxDebugGroup.visible = true;
      const p = getPlayerAabbWorld(state);
      this.playerHitboxHelper.visible = true;
      this.playerHitboxHelper.position.set(p.x, p.y, p.z);
      this.playerHitboxHelper.scale.set(p.hx / 0.2, p.hy / 0.8, p.hz / 0.2);
      let hi = 0;
      for (let oi = 0; oi < state.obstacles.length; oi++) {
        const obs = state.obstacles[oi];
        if (obs.hit) continue;
        const relZd = obs.z - playerZ;
        if (relZd < -8 || relZd > C.MAX_Z + 18) continue;
        const showBox = (laneIdx: number) => {
          if (hi >= this.obstacleHitboxHelpers.length) return;
          const o = getObstacleAabbAtLane(obs, laneIdx);
          const h = this.obstacleHitboxHelpers[hi++];
          h.visible = true; h.position.set(o.x, o.y, o.z); h.scale.set(o.hx / 0.5, o.hy / 0.5, o.hz / 0.5);
        };
        showBox(obs.lane);
        if (obs.type === "double_pillar") showBox(obs.lane === 1 ? 0 : obs.lane === -1 ? 0 : 1);
      }
      for (; hi < this.obstacleHitboxHelpers.length; hi++) this.obstacleHitboxHelpers[hi].visible = false;
    } else {
      this.hitboxDebugGroup.visible = false;
    }

    // — perf —
    if (this.showPerf && ++this.perfFrame % 60 === 0) {
      console.log({ drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, fps: this.lastDt > 0 ? Math.round(1 / this.lastDt) : 0 });
    }

    this.renderer.render(this.scene, this.camera);
  }

  /* ── animations ── */

  private animRun(time: number, speed: number) {
    const c = Math.sin(time * speed * 1.2);
    this.characterRig.position.y = Math.abs(Math.sin(time * speed * 1.2)) * 0.05;
    this.legL.rotation.x = c * 0.85;  this.legR.rotation.x = -c * 0.85;
    this.armL.rotation.x = -c * 0.65; this.armR.rotation.x = c * 0.65;
    this.torso.rotation.x = 0.15;     this.torso.rotation.y = c * 0.04;
    this.head.position.y = 1.22;
    this.runner.scale.setScalar(0.82);
  }

  private animJump() {
    this.characterRig.position.y = 0;
    this.legL.rotation.x = -0.6; this.legR.rotation.x = -0.6;
    this.armL.rotation.x = -0.75; this.armR.rotation.x = -0.75;
    this.torso.rotation.x = 0.1; this.torso.rotation.y = 0;
    this.head.position.y = 1.22;
    this.runner.scale.setScalar(0.82);
  }

  private animSlide() {
    this.characterRig.position.y = 0;
    this.runner.scale.set(0.88, 0.44, 0.88);
    this.legL.rotation.x = 0.22; this.legR.rotation.x = 0.22;
    this.armL.rotation.x = -0.38; this.armR.rotation.x = -0.38;
    this.torso.rotation.x = 0.48; this.torso.rotation.y = 0;
    this.head.position.y = 1.02;
  }

  private animIdle() {
    this.characterRig.position.y = 0;
    this.legL.rotation.x = 0; this.legR.rotation.x = 0;
    this.armL.rotation.x = 0; this.armR.rotation.x = 0;
    this.torso.rotation.x = 0; this.torso.rotation.y = 0;
    this.head.position.y = 1.22;
    this.runner.scale.setScalar(0.82);
  }

  private applyWarn(root: THREE.Object3D, warn: boolean, frame: number) {
    const apply = (obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material;
      if (!(mat instanceof THREE.MeshLambertMaterial)) return;
      if (warn) {
        mat.emissive.setHex(0x881818);
        mat.emissiveIntensity = 0.55 + Math.sin(frame * 0.22) * 0.18;
      } else {
        const base = root.userData.baseEmit as THREE.Color | undefined;
        if (base) mat.emissive.copy(base);
        mat.emissiveIntensity = (root.userData.warnBaseEmissive as number) ?? 0.1;
      }
    };
    if (root instanceof THREE.Group) {
      root.traverse(apply);
    } else {
      apply(root);
    }
  }

  /* ── lifecycle ── */

  resize() {
    const w = this.container.clientWidth || 400;
    const h = this.container.clientHeight || 700;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2));
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
