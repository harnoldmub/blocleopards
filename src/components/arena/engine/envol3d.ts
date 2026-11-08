import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Envol 243 : décollage sur le Boulevard du 30 Juin, survol de Kinshasa.
 * Le moteur reste vivant toute la partie : on enchaîne les vols avec reset().
 */

export interface EnvolCallbacks {
  onMultiplierUpdate: (mult: number, altitude: number) => void;
  onFlightEnd?: (secured: boolean, score: number, multiplier: number) => void;
  onFlightCrash?: (crashMultiplier: number) => void;
  /** L'avion est chargé et prêt à décoller. */
  onReady?: () => void;
}

type Phase = "ready" | "takeoff" | "climbing" | "secured" | "crashed";

/** Durée du roulage avant que le multiplicateur ne démarre (s). */
const ROLL = 1.5;
const BASE_POINTS = 100;
const ROAD_HALF = 12;
const LANES = [-9.2, -4.6, 4.6, 9.2];

/* ------------------------------------------------------------------ */
/* Textures dessinées (aucun fichier à charger)                        */
/* ------------------------------------------------------------------ */

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Ciel de fin d'après-midi sur Kinshasa (brume chaude). */
function skyTexture() {
  return canvasTex(16, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#5b8fc9");
    g.addColorStop(0.45, "#9fbfd9");
    g.addColorStop(0.7, "#f2c48d");
    g.addColorStop(0.86, "#f0a35e");
    g.addColorStop(1, "#d98b52");
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 512);
  });
}

/** Façade : rangées de fenêtres (multipliée par la couleur de l'immeuble). */
function facadeTexture() {
  const t = canvasTex(128, 128, (c) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const lit = (x * 7 + y * 3) % 5 === 0;
        c.fillStyle = lit ? "#5d6b7a" : "#3a4654";
        c.fillRect(8 + x * 30, 10 + y * 30, 18, 16);
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.fillRect(8 + x * 30, 10 + y * 30, 18, 3);
      }
    }
    c.fillStyle = "rgba(0,0,0,0.08)";
    for (let y = 0; y < 4; y++) c.fillRect(0, 30 + y * 30, 128, 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Bus « Esprit de Vie » : bande arc-en-ciel RDC et lettrage. */
function espritDeVieTexture() {
  return canvasTex(512, 160, (c) => {
    c.fillStyle = "#f4f4f0";
    c.fillRect(0, 0, 512, 160);
    c.fillStyle = "#1f2937";
    c.fillRect(10, 8, 492, 58);
    const band = (col: string, dy: number) => {
      c.strokeStyle = col;
      c.lineWidth = 9;
      c.beginPath();
      c.moveTo(70, 150 - dy);
      c.quadraticCurveTo(200, 70 - dy, 470, 118 - dy);
      c.stroke();
    };
    band("#f4c400", 0);
    band("#d81e27", 9);
    band("#1466e0", 18);
    c.fillStyle = "#ffffff";
    c.font = "900 26px Arial, sans-serif";
    c.fillText("ESPRIT DE VIE", 150, 108);
    c.fillStyle = "#3b82c4";
    for (let i = 0; i < 6; i++) c.fillRect(170 + i * 22, 122, 10, 24);
  });
}

/** Voiture Yango : rouge, lettrage blanc. */
function yangoTexture() {
  return canvasTex(256, 96, (c) => {
    c.fillStyle = "#e2261c";
    c.fillRect(0, 0, 256, 96);
    c.fillStyle = "#ffffff";
    c.font = "italic 900 40px Arial, sans-serif";
    c.fillText("YANGO", 40, 66);
  });
}

/** Panneau publicitaire coloré au bord du boulevard. */
function billboardTexture(i: number) {
  const palettes = [
    ["#1466e0", "#f4c400", "BLOC LÉOPARDS"],
    ["#e2261c", "#ffffff", "KINSHASA 243"],
    ["#f4c400", "#0b1f4d", "ALLEZ LES LÉOPARDS"],
    ["#0e7a3b", "#ffffff", "TOZA BOMOKO"]
  ];
  const [bg, fg, txt] = palettes[i % palettes.length];
  return canvasTex(256, 112, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 256, 112);
    c.fillStyle = fg;
    c.font = "900 28px Arial, sans-serif";
    c.textAlign = "center";
    c.fillText(txt, 128, 66);
  });
}

/* ------------------------------------------------------------------ */

export class Envol3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private running = false;
  private raf = 0;
  private reduced = false;

  private plane = new THREE.Group();
  private planeMats: THREE.Material[] = [];
  private propeller: THREE.Object3D | null = null;
  private taxiProto: THREE.Group | null = null;
  private minibusProto: THREE.Group | null = null;
  private busProto: THREE.Group | null = null;
  private vehicles: {
    obj: THREE.Object3D;
    speed: number;
    dir: number;
    wheels: THREE.Object3D[];
    kind: "minibus207" | "taxi" | "bus" | "yango" | "moto";
  }[] = [];
  private crashCloud = new THREE.Group();
  private sun: THREE.DirectionalLight;

  private phase: Phase = "ready";
  private t0 = 0;
  private endT = 0;
  private mult = 1;
  private crashAt = 2;
  private pos = new THREE.Vector3(0, 0, 0);
  private rot = new THREE.Euler(0, 0, 0, "YXZ");
  private camPos = new THREE.Vector3(0, 3, -9);
  private look = new THREE.Vector3(0, 1, 8);
  private fogBase = 0.0042;

  constructor(private canvas: HTMLCanvasElement, private cb: EnvolCallbacks) {
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 2200);
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.FogExp2(0xe9b98a, this.fogBase);

    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x8a6a4a, 1.25));
    this.sun = new THREE.DirectionalLight(0xffd7a0, 2.6);
    this.sun.position.set(60, 90, -40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const s = this.sun.shadow.camera;
    s.left = -40;
    s.right = 40;
    s.top = 40;
    s.bottom = -40;
    s.near = 1;
    s.far = 260;
    this.scene.add(this.sun, this.sun.target);

    this.buildWorld();
    this.scene.add(this.crashCloud);
    this.loadPlane();
    this.loadVehicleModels();
    this.resize(w, h);
    this.placeCamera(true);
  }

  setReduced(v: boolean) {
    this.reduced = v;
  }

  /* ------------------------------ Monde ------------------------------ */

  private buildWorld() {
    const sc = this.scene;
    // terre rouge et herbe de Kinshasa
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 2600),
      new THREE.MeshStandardMaterial({ color: 0x7d6a45, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, 900);
    ground.receiveShadow = true;
    sc.add(ground);

    // Boulevard du 30 Juin : 2 × 2 voies, trottoirs, terre-plein
    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_HALF * 2, 2600),
      new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.95 })
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, 0, 900);
    asphalt.receiveShadow = true;
    sc.add(asphalt);
    const walkMat = new THREE.MeshStandardMaterial({ color: 0xb9ad98, roughness: 0.95 });
    for (const sx of [-1, 1]) {
      const walk = new THREE.Mesh(new THREE.BoxGeometry(4, 0.18, 2600), walkMat);
      walk.position.set(sx * (ROAD_HALF + 2), 0.09, 900);
      walk.receiveShadow = true;
      sc.add(walk);
    }
    // marquage : lignes de rive, pointillés, axe central jaune (piste de l'avion)
    const white = new THREE.MeshBasicMaterial({ color: 0xf1f1ea });
    const yellow = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
    const line = (x: number, wdt: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wdt, 2600), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.015, 900);
      sc.add(m);
    };
    line(-ROAD_HALF + 0.4, 0.25, white);
    line(ROAD_HALF - 0.4, 0.25, white);
    line(-0.2, 0.18, yellow);
    line(0.2, 0.18, yellow);
    const dashGeo = new THREE.PlaneGeometry(0.18, 3);
    const dashes = new THREE.InstancedMesh(dashGeo, white, 850);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (const x of [-6.9, 6.9]) {
      for (let z = -150; z < 2150; z += 6) {
        m4.makeRotationX(-Math.PI / 2).setPosition(x, 0.016, z);
        dashes.setMatrixAt(k++, m4);
      }
    }
    dashes.count = k;
    dashes.instanceMatrix.needsUpdate = true;
    sc.add(dashes);

    // Passages piétons (bandes blanches transversales aux carrefours)
    const zebraGeo = new THREE.PlaneGeometry(0.65, 4.4);
    const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf5f5ef });
    const zebraCrossings = [32, 170, 520, 980, 1520];
    const zebraMesh = new THREE.InstancedMesh(zebraGeo, zebraMat, 150);
    let zIdx = 0;
    for (const cz of zebraCrossings) {
      for (let sx = -ROAD_HALF + 1.2; sx <= ROAD_HALF - 1.2; sx += 1.45) {
        if (Math.abs(sx) < 1.1) continue; // terre-plein central préservé
        m4.makeRotationX(-Math.PI / 2).setPosition(sx, 0.018, cz);
        zebraMesh.setMatrixAt(zIdx++, m4);
      }
    }
    zebraMesh.count = zIdx;
    zebraMesh.instanceMatrix.needsUpdate = true;
    sc.add(zebraMesh);

    // Bordures de trottoir bicolores kinois (alternance jaune et noir)
    const curbGeo = new THREE.BoxGeometry(0.24, 0.22, 1.4);
    const curbYel = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.8 });
    const curbDark = new THREE.MeshStandardMaterial({ color: 0x1f2328, roughness: 0.85 });
    const curbMeshYel = new THREE.InstancedMesh(curbGeo, curbYel, 2000);
    const curbMeshDark = new THREE.InstancedMesh(curbGeo, curbDark, 2000);
    let cYel = 0;
    let cDark = 0;
    for (const sx of [-1, 1]) {
      const curbX = sx * (ROAD_HALF + 0.12);
      let step = 0;
      for (let z = -120; z < 2100; z += 1.4) {
        m4.makeRotationX(0).setPosition(curbX, 0.11, z);
        if ((step % 2) === 0) {
          curbMeshYel.setMatrixAt(cYel++, m4);
        } else {
          curbMeshDark.setMatrixAt(cDark++, m4);
        }
        step++;
      }
    }
    curbMeshYel.count = cYel;
    curbMeshYel.instanceMatrix.needsUpdate = true;
    curbMeshDark.count = cDark;
    curbMeshDark.instanceMatrix.needsUpdate = true;
    sc.add(curbMeshYel, curbMeshDark);

    // Feux de signalisation aux carrefours (carcasse noire avec feux rouge/orange/vert)
    const signalPoles = [34, 172, 522];
    const poleSigMat = new THREE.MeshStandardMaterial({ color: 0x2b3036, metalness: 0.4, roughness: 0.6 });
    const redLightMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const amberLightMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const greenLightMat = new THREE.MeshBasicMaterial({ color: 0x34c759 });
    for (const pz of signalPoles) {
      for (const sx of [-1, 1]) {
        const sigGroup = new THREE.Group();
        const pMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6.2, 8), poleSigMat);
        pMesh.position.y = 3.1;
        const armMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), poleSigMat);
        armMesh.position.set(sx * -1.4, 6.0, 0);
        // Boîtier de feu suspendu
        const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.2, 0.35), poleSigMat);
        boxMesh.position.set(sx * -2.8, 5.5, 0);
        // Trois optiques
        const rLight = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), redLightMat);
        rLight.position.set(sx * -2.8, 5.85, 0.18);
        const aLight = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), amberLightMat);
        aLight.position.set(sx * -2.8, 5.5, 0.18);
        const gLight = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), greenLightMat);
        gLight.position.set(sx * -2.8, 5.15, 0.18);
        sigGroup.add(pMesh, armMesh, boxMesh, rLight, aLight, gLight);
        sigGroup.position.set(sx * (ROAD_HALF + 0.8), 0, pz);
        sc.add(sigGroup);
      }
    }

    // palmiers et lampadaires sur les trottoirs
    for (let z = -120; z < 1700; z += 26) {
      for (const sx of [-1, 1]) {
        const p = this.palm();
        p.position.set(sx * (ROAD_HALF + 2.6), 0.18, z + (sx > 0 ? 13 : 0));
        p.rotation.y = (z * 13) % 6;
        sc.add(p);
      }
    }
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.5, roughness: 0.5 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1c9 });
    for (let z = -100; z < 1700; z += 40) {
      for (const sx of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 6), poleMat);
        pole.position.set(sx * (ROAD_HALF + 1), 3.5, z);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), poleMat);
        arm.position.set(sx * (ROAD_HALF + 0.3), 6.95, z);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.25), lampMat);
        lamp.position.set(sx * (ROAD_HALF - 0.4), 6.85, z);
        sc.add(pole, arm, lamp);
      }
    }

    this.buildCity();
    this.buildTraffic();

    const stade = this.stadium();
    stade.position.set(-170, 0, 620);
    sc.add(stade);

    // Fleuve Congo à l'horizon
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 900),
      new THREE.MeshStandardMaterial({ color: 0x5f7f8f, roughness: 0.25, metalness: 0.35 })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.03, 2200);
    sc.add(river);

    this.buildClouds();
  }

  private palm() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.28, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 })
    );
    trunk.position.y = 3.5;
    trunk.castShadow = true;
    g.add(trunk);
    const leaf = new THREE.MeshStandardMaterial({ color: 0x2f6b2a, roughness: 0.8, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 3.4), leaf);
      f.position.set(0, 7, 0);
      f.rotation.set(-1.05, (i / 7) * Math.PI * 2, 0, "YXZ");
      f.translateY(1.5);
      g.add(f);
    }
    return g;
  }

  /** Immeubles de la Gombe : façades fenêtrées, toits plats, réservoirs, tôle. */
  private buildCity() {
    const tex = facadeTexture();
    const colors = [0xefe6d6, 0xe6d3b3, 0xd7dde3, 0xf2efe8, 0xc9b79a, 0xbcc8d2, 0xe9cfa8];
    const tank = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8c3b2a, roughness: 0.7, metalness: 0.3 });
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let z = -120; z < 1900; z += 18 + rnd() * 10) {
      for (const sx of [-1, 1]) {
        if (rnd() < 0.12) continue;
        const tall = z > 250 && z < 1100 && rnd() < 0.35;
        const h = tall ? 30 + rnd() * 45 : 7 + rnd() * 16;
        const w = 10 + rnd() * 12;
        const d = 10 + rnd() * 12;
        const geo = new THREE.BoxGeometry(w, h, d);
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 7), uv.getY(i) * (h / 6));
        const mat = new THREE.MeshStandardMaterial({ color: colors[Math.floor(rnd() * colors.length)], map: tex, roughness: 0.85 });
        const b = new THREE.Mesh(geo, mat);
        const x = sx * (ROAD_HALF + 9 + w / 2 + rnd() * 14);
        b.position.set(x, h / 2, z);
        b.castShadow = true;
        b.receiveShadow = true;
        this.scene.add(b);
        if (!tall && rnd() < 0.45) {
          const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3, 4), roofMat);
          roof.position.set(x, h + 1.5, z);
          roof.rotation.y = Math.PI / 4;
          roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
          this.scene.add(roof);
        } else if (rnd() < 0.6) {
          const t = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10), tank);
          t.position.set(x + (rnd() - 0.5) * w * 0.5, h + 0.8, z + (rnd() - 0.5) * d * 0.5);
          this.scene.add(t);
        }
      }
    }
    // panneaux publicitaires
    for (let i = 0; i < 10; i++) {
      const sx = i % 2 ? 1 : -1;
      const z = 60 + i * 120;
      const g = new THREE.Group();
      const legMat = new THREE.MeshStandardMaterial({ color: 0x52575e });
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 6), legMat);
      leg.position.y = 4;
      const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), new THREE.MeshBasicMaterial({ map: billboardTexture(i), side: THREE.DoubleSide }));
      board.position.y = 9.5;
      board.rotation.y = sx > 0 ? -Math.PI / 2.6 : Math.PI / 2.6;
      g.add(leg, board);
      g.position.set(sx * (ROAD_HALF + 7), 0, z);
      this.scene.add(g);
    }
  }

  /** Stade des Martyrs : cuvette ovale, tribunes, pelouse et anneau tricolore. */
  private stadium() {
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(70, 80, 22, 48, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.8, side: THREE.DoubleSide })
    );
    bowl.position.y = 11;
    bowl.scale.z = 0.72;
    const stands = new THREE.Mesh(
      new THREE.CylinderGeometry(70, 46, 20, 48, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1d4fa8, roughness: 0.9, side: THREE.DoubleSide })
    );
    stands.position.y = 12;
    stands.scale.z = 0.72;
    const pitch = new THREE.Mesh(new THREE.CircleGeometry(46, 40), new THREE.MeshStandardMaterial({ color: 0x2f8a3a, roughness: 1 }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 2.1;
    pitch.scale.y = 0.72;
    const ring = (r0: number, r1: number, col: number, y: number) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.scale.y = 0.72;
      g.add(m);
    };
    ring(80, 83, 0x1466e0, 22.1);
    ring(83, 85, 0xf4c400, 22.15);
    ring(85, 87, 0xd81e27, 22.2);
    g.add(bowl, stands, pitch);
    return g;
  }

  private buildClouds() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff6ec, roughness: 1, transparent: true, opacity: 0.9, depthWrite: false });
    const geo = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 46; i++) {
      const c = new THREE.Group();
      const n = 4 + (i % 4);
      for (let j = 0; j < n; j++) {
        const p = new THREE.Mesh(geo, mat);
        const r = 9 + ((i * 7 + j * 5) % 10);
        p.scale.set(r * 1.3, r * 0.8, r);
        p.position.set(j * 11 - n * 5, ((j * 3) % 5) - 2, ((j * 7) % 9) - 4);
        c.add(p);
      }
      c.position.set(((i * 137) % 900) - 450, 85 + ((i * 29) % 50), 150 + ((i * 211) % 1900));
      this.scene.add(c);
    }
  }

  /* ----------------------------- Trafic ----------------------------- */

  private wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 14);
  private wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  private hubMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.6, roughness: 0.4 });
  private glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2533, roughness: 0.15, metalness: 0.4 });

  private box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  private wheels(g: THREE.Group, halfW: number, zs: number[], r = 0.38) {
    const list: THREE.Object3D[] = [];
    for (const z of zs) {
      for (const sx of [-1, 1]) {
        const wg = new THREE.Group();
        const t = new THREE.Mesh(this.wheelGeo, this.wheelMat);
        t.rotation.z = Math.PI / 2;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.3, 10), this.hubMat);
        hub.rotation.z = Math.PI / 2;
        wg.add(t, hub);
        wg.scale.setScalar(r / 0.38);
        wg.position.set(sx * halfW, r, z);
        g.add(wg);
        list.push(wg);
      }
    }
    return list;
  }

  /** Mercedes 207 : bas jaune usé, haut bleu, toit surélevé bleu ciel. */
  private minibus207() {
    const g = new THREE.Group();
    if (this.minibusProto) {
      g.add(this.minibusProto.clone(true));
      return { g, wheels: [] };
    }
    const yellow = new THREE.MeshStandardMaterial({ color: 0xd2ac2c, roughness: 0.75 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2c6fd6, roughness: 0.6 });
    const sky = new THREE.MeshStandardMaterial({ color: 0x37a3e3, roughness: 0.55 });
    this.box(2.05, 1.05, 4.9, yellow, 0, 1.0, 0, g);
    this.box(2.0, 0.95, 4.2, blue, 0, 1.98, -0.3, g);
    this.box(1.9, 0.35, 4.0, sky, 0, 2.62, -0.35, g);
    // capot court et calandre
    this.box(1.95, 0.55, 0.7, yellow, 0, 1.25, 2.55, g);
    this.box(1.5, 0.3, 0.06, new THREE.MeshStandardMaterial({ color: 0x111111 }), 0, 1.15, 2.92, g);
    // vitres : pare-brise et bande latérale
    this.box(1.85, 0.75, 0.06, this.glassMat, 0, 2.0, 1.83, g);
    this.box(2.02, 0.55, 3.4, this.glassMat, 0, 2.02, -0.55, g);
    for (const sx of [-1, 1]) this.box(0.2, 0.18, 0.06, new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), sx * 0.75, 1.3, 2.92, g);
    return { g, wheels: this.wheels(g, 1.0, [1.6, -1.5]) };
  }

  /** Bus « Esprit de Vie » blanc, bande RDC. */
  private busEspritDeVie() {
    const g = new THREE.Group();
    if (this.busProto) {
      g.add(this.busProto.clone(true));
      return { g, wheels: [] };
    }
    const white = new THREE.MeshStandardMaterial({ color: 0xf1f1ec, roughness: 0.55 });
    const side = new THREE.MeshStandardMaterial({ map: espritDeVieTexture(), roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 7.8), [side, side, white, white, white, white]);
    body.position.y = 1.65;
    body.castShadow = true;
    g.add(body);
    this.box(2.2, 1.0, 0.06, this.glassMat, 0, 2.2, 3.92, g);
    return { g, wheels: this.wheels(g, 1.15, [2.5, -2.4], 0.45) };
  }

  /** Taxi jaune (Toyota IST) avec rétroviseurs bleus. */
  private taxi() {
    const g = new THREE.Group();
    if (this.taxiProto) {
      g.add(this.taxiProto.clone(true));
      return { g, wheels: [] };
    }
    const yel = new THREE.MeshStandardMaterial({ color: 0xf0c419, roughness: 0.45 });
    this.box(1.7, 0.75, 3.8, yel, 0, 0.75, 0, g);
    this.box(1.55, 0.6, 2.1, yel, 0, 1.42, -0.25, g);
    this.box(1.58, 0.45, 1.6, this.glassMat, 0, 1.45, -0.25, g);
    this.box(1.45, 0.45, 0.06, this.glassMat, 0, 1.42, 0.83, g);
    const mirror = new THREE.MeshStandardMaterial({ color: 0x1e7fd6 });
    for (const sx of [-1, 1]) this.box(0.22, 0.14, 0.24, mirror, sx * 0.95, 1.18, 0.75, g);
    return { g, wheels: this.wheels(g, 0.82, [1.2, -1.2], 0.34) };
  }

  /** Voiture Yango rouge. */
  private yango() {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xe2261c, roughness: 0.4 });
    const side = new THREE.MeshStandardMaterial({ map: yangoTexture(), roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.8, 3.6), [side, side, red, red, red, red]);
    body.position.y = 0.8;
    body.castShadow = true;
    g.add(body);
    this.box(1.5, 0.62, 2.2, red, 0, 1.5, -0.2, g);
    this.box(1.53, 0.46, 1.7, this.glassMat, 0, 1.52, -0.2, g);
    return { g, wheels: this.wheels(g, 0.8, [1.15, -1.15], 0.34) };
  }

  /** Moto-taxi (wewa) avec son conducteur. */
  private moto(i: number) {
    const g = new THREE.Group();
    const frame = new THREE.MeshStandardMaterial({ color: [0x7f1d1d, 0x1f2937, 0x1e3a8a][i % 3], roughness: 0.5 });
    this.box(0.25, 0.4, 1.4, frame, 0, 0.7, 0, g);
    const shirt = new THREE.MeshStandardMaterial({ color: [0xf4c400, 0x84cc16, 0xea580c, 0x2563eb][i % 4] });
    this.box(0.5, 0.65, 0.35, shirt, 0, 1.35, -0.1, g);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: [0xdc2626, 0x111827, 0xf8fafc][i % 3], roughness: 0.3 }));
    helmet.position.set(0, 1.85, -0.05);
    g.add(helmet);
    this.box(0.12, 0.12, 0.06, new THREE.MeshBasicMaterial({ color: 0xfff3c4 }), 0, 0.95, 0.72, g);
    return { g, wheels: this.wheels(g, 0, [0.6, -0.6], 0.3) };
  }

  private buildTraffic() {
    for (let i = 0; i < 64; i++) {
      const lane = LANES[i % LANES.length];
      const dir = lane > 0 ? 1 : -1;
      const kind = i % 9;
      let vKind: "minibus207" | "taxi" | "bus" | "yango" | "moto" = "moto";
      let v: { g: THREE.Group; wheels: THREE.Object3D[] };
      if (kind === 0 || kind === 4 || kind === 7) {
        vKind = "minibus207";
        v = this.minibus207();
      } else if (kind === 1 || kind === 5) {
        vKind = "taxi";
        v = this.taxi();
      } else if (kind === 2) {
        vKind = "bus";
        v = this.busEspritDeVie();
      } else if (kind === 3) {
        vKind = "yango";
        v = this.yango();
      } else {
        vKind = "moto";
        v = this.moto(i);
      }
      const isMoto = kind === 6 || kind === 8;
      v.g.position.set(lane + (isMoto ? (lane > 0 ? 1.6 : -1.6) : 0), 0, -140 + ((i * 47) % 1800));
      if (dir < 0) v.g.rotation.y = Math.PI;
      this.scene.add(v.g);
      this.vehicles.push({ obj: v.g, speed: (isMoto ? 13 : 9) + ((i * 7) % 6), dir, wheels: v.wheels, kind: vKind });
    }
  }

  private loadVehicleModels() {
    const loader = new GLTFLoader();
    const loadOne = (url: string) =>
      new Promise<THREE.Group | null>((resolve) => {
        loader.load(
          url,
          (gltf) => {
            const root = gltf.scene;
            root.traverse((o: any) => {
              if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
              }
            });
            resolve(root);
          },
          undefined,
          (err) => {
            console.warn(`[Envol3D] Failed to load vehicle ${url}:`, err);
            resolve(null);
          }
        );
      });

    Promise.all([
      loadOne("/game3d/envol243/taxi.glb"),
      loadOne("/game3d/envol243/minibus207.glb"),
      loadOne("/game3d/envol243/bus.glb"),
    ]).then(([taxi, minibus, bus]) => {
      if (taxi) this.taxiProto = taxi;
      if (minibus) this.minibusProto = minibus;
      if (bus) this.busProto = bus;
      this.upgradeTraffic();
    });
  }

  private upgradeTraffic() {
    for (const v of this.vehicles) {
      let proto: THREE.Group | null = null;
      if (v.kind === "taxi") proto = this.taxiProto;
      else if (v.kind === "minibus207") proto = this.minibusProto;
      else if (v.kind === "bus") proto = this.busProto;

      if (proto) {
        while (v.obj.children.length > 0) {
          v.obj.remove(v.obj.children[0]);
        }
        v.obj.add(proto.clone(true));
        v.wheels = [];
      }
    }
  }

  /* ------------------------------ Avion ------------------------------ */

  private async loadPlane() {
    try {
      // les textures du FBX ne sont pas fournies (matériaux repeints) : pixel vide plutôt que des 404
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) =>
        /\.(png|jpe?g|tga|bmp|tiff?)$/i.test(url)
          ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
          : url
      );
      const loader = new FBXLoader(manager);
      const obj = await Promise.race([
        loader.loadAsync("/game3d/envol243/old_plane.fbx"),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Plane load timeout")), 2500))
      ]);
      const b = new THREE.Box3().setFromObject(obj);
      const size = b.getSize(new THREE.Vector3());
      const center = b.getCenter(new THREE.Vector3());
      const scale = 7 / Math.max(size.x, size.y, size.z);
      obj.scale.setScalar(scale);
      obj.position.set(-center.x * scale, -b.min.y * scale, -center.z * scale);
      obj.traverse((child: any) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        const n = String(child.name).toLowerCase();
        let color = 0x2fa2e3;
        let metal = 0.25;
        let rough = 0.4;
        if (n.includes("propeller")) {
          color = 0xf4c400;
          metal = 0.7;
          rough = 0.25;
          this.propeller = child;
        } else if (n.includes("wing") || n.includes("top")) color = 0xd81e27;
        else if (n.includes("window") || n.includes("windshield")) {
          color = 0x1e293b;
          rough = 0.1;
        } else if (n.includes("wheel")) {
          color = 0x111111;
          rough = 0.9;
        }
        const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, transparent: true });
        this.planeMats.push(mat);
        child.material = mat;
      });
      this.plane.add(obj);
    } catch {
      this.fallbackPlane();
    }
    this.scene.add(this.plane);
    this.cb.onReady?.();
  }

  private fallbackPlane() {
    const mk = (c: number) => {
      const m = new THREE.MeshStandardMaterial({ color: c, transparent: true });
      this.planeMats.push(m);
      return m;
    };
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 4, 6, 12), mk(0x2fa2e3));
    body.rotation.x = Math.PI / 2;
    body.position.y = 1.2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(7, 0.12, 1.3), mk(0xd81e27));
    wing.position.set(0, 1.6, 0.3);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.8), mk(0x2fa2e3));
    tail.position.set(0, 1.3, -2.4);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(2, 0.14, 0.08), mk(0xf4c400));
    prop.position.set(0, 1.2, 2.75);
    this.propeller = prop;
    this.plane.add(body, wing, tail, prop);
  }

  private setPlaneOpacity(o: number) {
    for (const m of this.planeMats) (m as THREE.MeshStandardMaterial).opacity = o;
  }

  /* ------------------------------- Vol ------------------------------- */

  /** Remet l'avion en bout de piste, prêt pour le vol suivant. */
  reset() {
    this.phase = "ready";
    this.mult = 1;
    this.pos.set(0, 0, 0);
    this.rot.set(0, 0, 0);
    this.setPlaneOpacity(1);
    this.crashCloud.clear();
    (this.scene.fog as THREE.FogExp2).density = this.fogBase;
    this.placeCamera(true);
  }

  startFlight(targetCrashMult: number) {
    if (this.phase !== "ready") this.reset();
    this.crashAt = Math.max(1.12, targetCrashMult);
    this.mult = 1;
    this.phase = "takeoff";
    this.t0 = performance.now();
  }

  private cashoutUntil = 0;

  celebrateCashout() {
    this.cashoutUntil = performance.now() + 800;
  }

  securePoints(): number {
    if (this.phase !== "climbing") return 0;
    this.phase = "secured";
    this.endT = performance.now();
    const score = Math.floor(BASE_POINTS * this.mult);
    this.cb.onFlightEnd?.(true, score, this.mult);
    return score;
  }

  get canSecure() {
    return this.phase === "climbing";
  }

  startLoop() {
    this.running = true;
    let last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      this.step(dt, now);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private step(dt: number, now: number) {
    const e = (now - this.t0) / 1000;
    if (this.propeller) this.propeller.rotation.z += dt * (this.phase === "ready" ? 14 : 40 + this.mult * 6);

    if (this.phase === "takeoff" || this.phase === "climbing") {
      // roulage : accélération sur l'axe jaune, puis rotation et envol
      const speed = Math.min(62, 8 + e * 26);
      this.pos.z += speed * dt;
      const air = Math.max(0, e - ROLL);
      const alt = 32 * (1 - Math.exp(-air * 0.32)) + air * 3.2;
      this.pos.y = alt;
      this.rot.x = e < ROLL ? -Math.min(0.12, Math.max(0, e - ROLL + 0.45) * 0.3) : -Math.max(0.05, 0.22 * Math.exp(-air * 0.5));
      this.rot.z = Math.sin(e * 0.9) * 0.08 + Math.sin(e * 7.3) * 0.006;
      this.pos.x = Math.sin(e * 0.35) * Math.min(1, air * 0.4) * 4;
      if (e >= ROLL) {
        this.phase = "climbing";
        this.mult = 1 + Math.pow(0.42 * air, 1.35);
      }
      if (this.cashoutUntil && now < this.cashoutUntil) {
        const p = (this.cashoutUntil - now) / 800;
        this.rot.z += Math.sin(p * Math.PI * 4) * 0.18;
      }
      this.cb.onMultiplierUpdate(this.mult, this.pos.y);
      if (this.phase === "climbing" && this.mult >= this.crashAt) {
        this.mult = this.crashAt;
        this.phase = "crashed";
        this.endT = now;
        this.spawnCrashCloud();
        this.cb.onFlightCrash?.(this.crashAt);
        this.cb.onFlightEnd?.(false, 0, this.crashAt);
      }
    } else if (this.phase === "secured") {
      // tonneau de victoire, puis l'avion reprend sa route
      const s = (now - this.endT) / 1000;
      this.pos.z += (55 + s * 8) * dt;
      this.pos.y += 9 * dt;
      this.rot.z = !this.reduced && s < 1.3 ? (s / 1.3) * Math.PI * 2 : 0;
      this.rot.x += (-0.08 - this.rot.x) * 0.05;
    } else if (this.phase === "crashed") {
      // l'avion s'enfonce dans le banc de nuages et disparaît
      const s = (now - this.endT) / 1000;
      this.pos.z += 50 * dt;
      this.pos.y += 6 * dt;
      this.rot.z = Math.sin(s * 9) * 0.12 * Math.max(0, 1 - s);
      this.setPlaneOpacity(Math.max(0, 1 - s / 0.9));
      (this.scene.fog as THREE.FogExp2).density = this.fogBase + Math.min(0.012, s * 0.02);
    } else {
      // au point d'attente : petit ronronnement
      this.pos.y = Math.sin(now * 0.02) * 0.008;
    }

    this.plane.position.copy(this.pos);
    this.plane.rotation.copy(this.rot);
    this.sun.position.set(this.pos.x + 60, this.pos.y + 90, this.pos.z - 40);
    this.sun.target.position.copy(this.pos);
    this.updateTraffic(dt);
    this.placeCamera(false, now);
  }

  private spawnCrashCloud() {
    this.crashCloud.clear();
    const mat = new THREE.MeshStandardMaterial({ color: 0xfaf3ea, roughness: 1, transparent: true, opacity: 0.95, depthWrite: false });
    const geo = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 22; i++) {
      const p = new THREE.Mesh(geo, mat);
      const r = 5 + (i % 5) * 1.6;
      p.scale.set(r * 1.4, r, r * 1.2);
      p.position.set(this.pos.x + ((i * 37) % 34) - 17, this.pos.y + ((i * 13) % 12) - 2, this.pos.z + 34 + ((i * 29) % 40));
      this.crashCloud.add(p);
    }
  }

  private updateTraffic(dt: number) {
    for (const v of this.vehicles) {
      v.obj.position.z += v.speed * v.dir * dt;
      if (v.obj.position.z > 1700) v.obj.position.z = -150;
      if (v.obj.position.z < -150) v.obj.position.z = 1700;
      for (const w of v.wheels) w.rotation.x += v.speed * dt * 2.4;
    }
  }

  private placeCamera(snap: boolean, now = 0) {
    const portrait = this.camera.aspect < 0.85;
    const back = portrait ? 15 : 12;
    const up = portrait ? 4.2 : 3.6;
    let target: THREE.Vector3;
    if (this.phase === "ready") {
      const sway = this.reduced ? 0 : Math.sin(now * 0.00035) * 2.5;
      target = new THREE.Vector3(sway, up + 0.6, -back);
    } else if (this.phase === "crashed") {
      // la caméra ralentit : on voit l'avion entrer dans le nuage
      target = this.camPos.clone().add(new THREE.Vector3(0, 0, 0.3));
    } else {
      target = this.pos.clone().add(new THREE.Vector3(0, up + Math.min(4, this.pos.y * 0.05), -back));
    }
    if (snap) this.camPos.copy(target);
    else if (this.phase === "crashed") this.camPos.lerp(target, 0.02);
    else {
      // poursuite serrée : l'avion reste dans le tiers bas de l'écran, sous le multiplicateur
      this.camPos.lerp(target, 0.22);
      this.camPos.z = Math.max(this.camPos.z, target.z - 1.5);
    }
    this.camera.position.copy(this.camPos);
    const ahead = this.phase === "ready" ? 14 : 22;
    const lift = this.phase === "ready" ? 1.6 : 3.4;
    this.look.lerp(new THREE.Vector3(this.pos.x, this.pos.y + lift, this.pos.z + ahead), snap ? 1 : 0.15);
    this.camera.lookAt(this.look);
  }

  resize(width: number, height: number) {
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.fov = width / height < 0.85 ? 62 : 52;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }
}
