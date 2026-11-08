import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export interface EnvolCallbacks {
  onMultiplierUpdate: (mult: number, altitude: number) => void;
  onFlightEnd: (secured: boolean, score: number, multiplier: number) => void;
}

export class Envol3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private running = false;
  private raf = 0;

  // Objets clés
  private planeGroup = new THREE.Group();
  private propeller: THREE.Object3D | null = null;
  private vehicles: { mesh: THREE.Group; speed: number; laneZ: number; direction: number }[] = [];
  private water: THREE.Mesh | null = null;
  private clouds: THREE.Group = new THREE.Group();
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  // État du vol
  private state: "idle" | "intro" | "takeoff" | "climbing" | "secured" | "crashed" = "idle";
  private flightStartTime = 0;
  private currentMultiplier = 1.0;
  private crashMultiplier = 3.5;
  private isSecured = false;
  private securedMultiplier = 0;
  private basePoints = 100;
  private callbacks: EnvolCallbacks;

  // Positions & dynamiques
  private planePos = new THREE.Vector3(0, 0.4, 0);
  private planeRot = new THREE.Euler(0, 0, 0);
  private cameraOffset = new THREE.Vector3(0, 2.2, -6.5);
  private targetLookAt = new THREE.Vector3(0, 1.5, 5);

  constructor(private canvas: HTMLCanvasElement, cb: EnvolCallbacks) {
    this.callbacks = cb;
    const w = canvas.clientWidth || 800;
    const h = canvas.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf59e0b); // Coucher de soleil kinois
    this.scene.fog = new THREE.FogExp2(0xe28743, 0.0035);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1500);

    // Lumières : Golden hour sur Kinshasa
    this.ambientLight = new THREE.AmbientLight(0xffeedd, 1.2);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xffcc88, 3.2);
    this.sunLight.position.set(80, 120, -100);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;
    const d = 50;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    this.buildKinshasaEnvironment();
    this.loadAirplane();
  }

  /* ------------------------------------------------------------------ */
  /* Construction de Kinshasa : Boulevard, 207, Stade des Martyrs, Fleuve */
  /* ------------------------------------------------------------------ */
  private buildKinshasaEnvironment() {
    // 1. Sol / Boulevard du 30 Juin
    const groundGeo = new THREE.PlaneGeometry(800, 1600);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x272e38, // Asphalte foncé
      roughness: 0.85
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Lignes blanches et terre-plein central
    const roadMarkingGeo = new THREE.PlaneGeometry(0.4, 1500);
    const roadMarkingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const markL = new THREE.Mesh(roadMarkingGeo, roadMarkingMat);
    markL.rotation.x = -Math.PI / 2;
    markL.position.set(-6, 0.02, 0);
    this.scene.add(markL);

    const markR = new THREE.Mesh(roadMarkingGeo, roadMarkingMat);
    markR.rotation.x = -Math.PI / 2;
    markR.position.set(6, 0.02, 0);
    this.scene.add(markR);

    // Ligne centrale discontinue du Boulevard
    const medianGeo = new THREE.PlaneGeometry(0.35, 1500);
    const medianMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Bande jaune centrale
    const median = new THREE.Mesh(medianGeo, medianMat);
    median.rotation.x = -Math.PI / 2;
    median.position.set(0, 0.02, 0);
    this.scene.add(median);

    // Palmiers stylisés sur les trottoirs latéraux du Boulevard
    for (let z = -200; z < 800; z += 35) {
      const palmL = this.createPalmTree();
      palmL.position.set(-15, 0.3, z);
      this.scene.add(palmL);

      const palmR = this.createPalmTree();
      palmR.position.set(15, 0.3, z);
      this.scene.add(palmR);
    }

    // 2. Véhicules de Kinshasa : Minibus 207 ("Esprit de mort"), Ketchs jaunes, Bus Esprit de Vie
    this.spawnKinshasaTraffic();

    // 3. Stade des Martyrs (survolé après le décollage)
    const stade = this.createStadeDesMartyrs();
    stade.position.set(130, 0, 180);
    this.scene.add(stade);

    // 4. Bâtiments & Immeubles de la Gombe
    this.spawnGombeBuildings();

    // 5. Fleuve Congo & Pool Malebo (à l'horizon nord)
    const waterGeo = new THREE.PlaneGeometry(1200, 600);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.1,
      metalness: 0.8
    });
    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 0.01, 750);
    this.scene.add(this.water);

    // 6. Nuages volumétriques
    this.buildCloudLayer();
  }

  /** Modélisation du minibus Mercedes 207 kinois bleu et jaune */
  private createMinibus207(): THREE.Group {
    const bus = new THREE.Group();

    // Bas de carrosserie jaune (jaune kinois usé)
    const lowerGeo = new THREE.BoxGeometry(2.1, 1.1, 4.6);
    const lowerMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b, // Jaune taxi
      roughness: 0.6,
      metalness: 0.1
    });
    const lower = new THREE.Mesh(lowerGeo, lowerMat);
    lower.position.y = 0.85;
    lower.castShadow = true;
    bus.add(lower);

    // Haut et toit bleu ciel
    const upperGeo = new THREE.BoxGeometry(1.95, 0.9, 4.4);
    const upperMat = new THREE.MeshStandardMaterial({
      color: 0x2fa2e3, // Bleu ciel caractéristique
      roughness: 0.5
    });
    const upper = new THREE.Mesh(upperGeo, upperMat);
    upper.position.y = 1.7;
    upper.castShadow = true;
    bus.add(upper);

    // Vitres sombres
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const windshieldGeo = new THREE.PlaneGeometry(1.7, 0.6);
    const windshield = new THREE.Mesh(windshieldGeo, windowMat);
    windshield.position.set(0, 1.7, 2.21);
    bus.add(windshield);

    // Calandre et phares noirs/jaunes
    const grilleGeo = new THREE.BoxGeometry(1.4, 0.35, 0.1);
    const grilleMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const grille = new THREE.Mesh(grilleGeo, grilleMat);
    grille.position.set(0, 0.75, 2.31);
    bus.add(grille);

    // Roues
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const positions = [
      [-1.0, 0.35, 1.4],
      [1.0, 0.35, 1.4],
      [-1.0, 0.35, -1.4],
      [1.0, 0.35, -1.4]
    ];
    for (const [wx, wy, wz] of positions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      bus.add(wheel);
    }

    return bus;
  }

  /** Modélisation taxi kinois jaune (Toyota IST) */
  private createTaxiKetch(): THREE.Group {
    const car = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(1.7, 0.75, 3.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    car.add(body);

    const roofGeo = new THREE.BoxGeometry(1.4, 0.55, 1.8);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 1.15, -0.2);
    car.add(roof);

    // Rétroviseurs bleus (spécificité des taxis kinois de l'image de référence)
    const mirrorMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });
    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.2), mirrorMat);
    mirrorL.position.set(-0.9, 0.9, 0.5);
    car.add(mirrorL);

    const mirrorR = mirrorL.clone();
    mirrorR.position.x = 0.9;
    car.add(mirrorR);

    return car;
  }

  /** Fait circuler le trafic kinois (minibus 207, taxis, bus) */
  private spawnKinshasaTraffic() {
    const lanes = [-10, -6.5, 6.5, 10];
    for (let i = 0; i < 36; i++) {
      const lane = lanes[i % lanes.length];
      const dir = lane > 0 ? 1 : -1;
      const is207 = i % 2 === 0;
      const mesh = is207 ? this.createMinibus207() : this.createTaxiKetch();

      mesh.position.set(lane, 0, (i * 22) % 600 - 150);
      if (dir < 0) mesh.rotation.y = Math.PI;

      this.scene.add(mesh);
      this.vehicles.push({
        mesh,
        speed: 12 + Math.random() * 8,
        laneZ: lane,
        direction: dir
      });
    }
  }

  /** Stade des Martyrs reconnaissable avec anneau tricolore (bleu, jaune, rouge) */
  private createStadeDesMartyrs(): THREE.Group {
    const stade = new THREE.Group();

    // Enceinte ovale extérieure
    const wallGeo = new THREE.CylinderGeometry(45, 52, 14, 32);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 7;
    stade.add(wall);

    // Piste d'athlétisme rouge
    const trackGeo = new THREE.RingGeometry(22, 38, 32);
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x991b1b }); // Rouge brique
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.y = 3.5;
    stade.add(track);

    // Pelouse verte centrale
    const pitchGeo = new THREE.PlaneGeometry(36, 22);
    const pitchMat = new THREE.MeshBasicMaterial({ color: 0x15803d });
    const pitch = new THREE.Mesh(pitchGeo, pitchMat);
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 3.52;
    stade.add(pitch);

    // Gradins aux couleurs de la RDC (anneaux bleu, jaune, rouge)
    const r1 = new THREE.Mesh(new THREE.RingGeometry(38, 42, 32), new THREE.MeshBasicMaterial({ color: 0x1d4ed8 }));
    r1.rotation.x = -Math.PI / 2; r1.position.y = 6; stade.add(r1);

    const r2 = new THREE.Mesh(new THREE.RingGeometry(42, 46, 32), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    r2.rotation.x = -Math.PI / 2; r2.position.y = 8; stade.add(r2);

    const r3 = new THREE.Mesh(new THREE.RingGeometry(46, 50, 32), new THREE.MeshBasicMaterial({ color: 0xdc2626 }));
    r3.rotation.x = -Math.PI / 2; r3.position.y = 10; stade.add(r3);

    return stade;
  }

  /** Immeubles de la Gombe et toitures en tôle rouge/verte */
  private spawnGombeBuildings() {
    const bGroup = new THREE.Group();
    const colors = [0xd6d3d1, 0xf5ebe0, 0xe7d7c1, 0xa8a29e];

    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (35 + Math.random() * 80);
      const z = (i * 28) % 700 - 50;
      const h = 15 + Math.random() * 45;
      const w = 12 + Math.random() * 16;
      const d = 12 + Math.random() * 16;

      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.8
      });
      const bldg = new THREE.Mesh(geo, mat);
      bldg.position.set(x, h / 2, z);
      bldg.castShadow = true;
      bldg.receiveShadow = true;
      bGroup.add(bldg);

      // Toit en tôle rouge ou antenne relais
      if (Math.random() > 0.4) {
        const roofGeo = new THREE.ConeGeometry(w * 0.7, 4, 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b }); // tôle rouge
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(x, h + 2, z);
        roof.rotation.y = Math.PI / 4;
        bGroup.add(roof);
      }
    }
    this.scene.add(bGroup);
  }

  /** Palmier kinois */
  private createPalmTree(): THREE.Group {
    const palm = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3;
    trunk.castShadow = true;
    palm.add(trunk);

    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const leafGeo = new THREE.ConeGeometry(1.6, 3, 4);
      const leaf = new THREE.Mesh(leafGeo, leavesMat);
      leaf.position.set(0, 5.8, 0);
      leaf.rotation.z = 0.8;
      leaf.rotation.y = (i * Math.PI) / 3;
      palm.add(leaf);
    }
    return palm;
  }

  /** Couche de nuages volumétriques en haute altitude */
  private buildCloudLayer() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xfff7ed,
      roughness: 1.0,
      transparent: true,
      opacity: 0.75
    });

    for (let i = 0; i < 35; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < puffs; j++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(14 + Math.random() * 12, 8, 8),
          cloudMat
        );
        puff.position.set(j * 12 - 15, Math.random() * 6, Math.random() * 12);
        cloud.add(puff);
      }
      cloud.position.set((Math.random() - 0.5) * 600, 110 + Math.random() * 40, Math.random() * 700);
      this.clouds.add(cloud);
    }
    this.scene.add(this.clouds);
  }

  /** Charge et prépare le modèle d'avion FBX aux couleurs des Léopards */
  private async loadAirplane() {
    try {
      const loader = new FBXLoader();
      const resp = await fetch("/game3d/envol243/old_plane.fbx");
      const ab = await resp.arrayBuffer();
      const obj = loader.parse(ab, "");

      // Ajustement dimensions et centrage
      const b = new THREE.Box3().setFromObject(obj);
      const c = b.getCenter(new THREE.Vector3());
      const s = b.getSize(new THREE.Vector3());
      const maxDim = Math.max(s.x, s.y, s.z);
      const scale = 3.6 / maxDim;

      obj.position.set(-c.x * scale, -c.y * scale, -c.z * scale);
      obj.scale.setScalar(scale);

      // Couleurs officielles Léopards
      obj.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = true;
          let col = 0x2fa2e3; // Bleu roi Léopards
          let met = 0.2;
          let rough = 0.35;

          if (child.name.includes("propeller")) {
            col = 0xf4c400; // Hélice dorée
            met = 0.8;
            rough = 0.2;
            this.propeller = child;
          } else if (child.name.includes("wing") || child.name.includes("top")) {
            col = 0xe0263a; // Ailes rouges
          } else if (child.name.includes("window") || child.name.includes("windshield")) {
            col = 0x1e293b; // Verre teinté
            rough = 0.1;
          } else if (child.name.includes("wheel")) {
            col = 0x111111;
            rough = 0.9;
          }

          child.material = new THREE.MeshStandardMaterial({
            color: col,
            roughness: rough,
            metalness: met
          });
        }
      });

      this.planeGroup.add(obj);
      this.planeGroup.position.copy(this.planePos);
      this.scene.add(this.planeGroup);
    } catch (err) {
      console.error("Erreur chargement avion:", err);
      // Fallback géométrique simple si réseau hors-service
      this.buildFallbackPlane();
    }
  }

  private buildFallbackPlane() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 4), new THREE.MeshStandardMaterial({ color: 0x2fa2e3 }));
    const wings = new THREE.Mesh(new THREE.BoxGeometry(7, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: 0xe0263a }));
    wings.position.set(0, 0.5, 0.3);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 0.1), new THREE.MeshStandardMaterial({ color: 0xf4c400 }));
    prop.position.set(0, 0, 2.1);
    this.propeller = prop;
    g.add(body, wings, prop);
    this.planeGroup.add(g);
    this.planeGroup.position.copy(this.planePos);
    this.scene.add(this.planeGroup);
  }

  /* ------------------------------------------------------------------ */
  /* Contrôle du Vol & Multiplicateur                                   */
  /* ------------------------------------------------------------------ */

  /** Démarre un nouveau vol avec un crash multiplier secret côté serveur */
  public startFlight(targetCrashMult: number) {
    this.crashMultiplier = Math.max(1.15, targetCrashMult);
    this.currentMultiplier = 1.0;
    this.isSecured = false;
    this.securedMultiplier = 0;
    this.state = "takeoff";
    this.flightStartTime = performance.now();

    this.planePos.set(0, 0.4, 0);
    this.planeRot.set(0, 0, 0);
  }

  /** Le joueur clique sur « Sécuriser mes points » */
  public securePoints(): number {
    if (this.state !== "climbing" && this.state !== "takeoff") return 0;
    this.isSecured = true;
    this.securedMultiplier = this.currentMultiplier;
    this.state = "secured";

    const finalScore = Math.floor(this.basePoints * this.securedMultiplier);
    this.callbacks.onFlightEnd(true, finalScore, this.securedMultiplier);
    return finalScore;
  }

  /** Boucle principale d'animation 60 FPS */
  public startLoop() {
    this.running = true;
    let lastTime = performance.now();

    const loop = (time: number) => {
      if (!this.running) return;
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      this.updatePhysics(dt, time);
      this.updateVehicles(dt);
      this.renderer.render(this.scene, this.camera);

      this.raf = requestAnimationFrame(loop);
    };

    this.raf = requestAnimationFrame(loop);
  }

  private updatePhysics(dt: number, now: number) {
    // 1. Rotation de l'hélice
    if (this.propeller) {
      const propSpeed = 25 + (this.currentMultiplier - 1) * 10;
      this.propeller.rotation.z += dt * propSpeed;
    }

    // 2. Évolution du vol selon l'état
    if (this.state === "takeoff" || this.state === "climbing") {
      const elapsed = Math.max(0, (now - this.flightStartTime) / 1000);

      // Courbe de multiplicateur progressive exponentielle
      this.currentMultiplier = 1.0 + Math.pow(Math.max(0, elapsed * 0.48), 1.35);

      // Ascension de l'avion
      const speed = 25 + elapsed * 6;
      this.planePos.z += speed * dt;

      if (elapsed > 1.2) {
        this.state = "climbing";
        this.planePos.y += (12 + elapsed * 4.5) * dt;
        this.planeRot.x = Math.max(-0.25, -0.05 * Math.log(elapsed + 1)); // Légère inclinaison vers le haut
        // Légères vibrations réalistes
        this.planeRot.z = Math.sin(now * 0.008) * 0.04;
      }

      this.callbacks.onMultiplierUpdate(this.currentMultiplier, this.planePos.y);

      // Fin de vol imprévisible (crash dans les nuages)
      if (this.currentMultiplier >= this.crashMultiplier) {
        this.state = "crashed";
        this.callbacks.onFlightEnd(false, 0, this.crashMultiplier);
      }
    } else if (this.state === "secured") {
      // Manœuvre victorieuse de l'avion
      this.planePos.z += 40 * dt;
      this.planePos.y += 18 * dt;
      this.planeRot.z += dt * 3.0; // Tonneau de célébration
    } else if (this.state === "crashed") {
      // Disparition dans les nuages
      this.planePos.z += 45 * dt;
      this.planePos.y += 30 * dt;
    }

    // Positionnement de l'avion
    this.planeGroup.position.copy(this.planePos);
    this.planeGroup.rotation.copy(this.planeRot);

    // Caméra dynamique suiveuse
    const targetCam = this.planePos.clone().add(this.cameraOffset);
    this.camera.position.lerp(targetCam, 0.1);
    this.targetLookAt.set(this.planePos.x, this.planePos.y + 0.8, this.planePos.z + 10);
    this.camera.lookAt(this.targetLookAt);
  }

  private updateVehicles(dt: number) {
    for (const v of this.vehicles) {
      v.mesh.position.z += v.speed * v.direction * dt;
      if (v.mesh.position.z > 600) v.mesh.position.z = -150;
      if (v.mesh.position.z < -150) v.mesh.position.z = 600;
    }
  }

  public resize(width: number, height: number) {
    if (!this.renderer || !this.camera) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
  }
}
