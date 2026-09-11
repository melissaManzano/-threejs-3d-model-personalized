import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';


const scene = new THREE.Scene();

// Mismo tono que la base del degradado del cielo (ver "sky" más abajo), para

// que no haya un salto de color si el cielo aún no cargó o en los bordes.

scene.background = new THREE.Color(0x3b4a63);

// La niebla disimula el borde del terreno cargado (ver TILE_*), funde las

// colinas lejanas con el cielo y añade profundidad.

scene.fog = new THREE.FogExp2(0x3b4a63, 0.035);


const camera = new THREE.PerspectiveCamera(

  45,

  window.innerWidth / window.innerHeight,

  0.1,

  100

);

camera.position.set(5, 3.5, 7);


const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.shadowMap.enabled = true;

renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.toneMapping = THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.1;

document.getElementById('scene-container').appendChild(renderer.domElement);


const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;

controls.dampingFactor = 0.08;

controls.enablePan = false; // la cámara sigue al personaje; el paneo se desactiva para no pelear con ese seguimiento

controls.minDistance = 3;

controls.maxDistance = 12; // evita alejarse lo suficiente para ver el borde del terreno cargado (ver TILE_*)

controls.minPolarAngle = 0.2; // evita ver la escena desde arriba en picada

controls.maxPolarAngle = Math.PI / 2 - 0.05; // evita que la cámara baje del nivel del piso

controls.target.set(0, 1, 0);


// Cielo de atardecer: una esfera con degradado, hija de la cámara, para que

// siempre rodee la escena sin importar qué tan lejos camine el personaje

// (el mismo problema que resolvimos con la luz principal, aplicado al cielo).

function createSkyTexture() {

  const canvas = document.createElement('canvas');

  canvas.width = 2;

  canvas.height = 256;

  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, 256);

  gradient.addColorStop(0, '#26345a');

  gradient.addColorStop(0.55, '#4d668f');

  gradient.addColorStop(0.8, '#d98a52');

  gradient.addColorStop(1, '#3b4a63');

  ctx.fillStyle = gradient;

  ctx.fillRect(0, 0, 2, 256);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;

}


const sky = new THREE.Mesh(

  new THREE.SphereGeometry(80, 16, 16),

  new THREE.MeshBasicMaterial({ map: createSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })

);

camera.add(sky);

scene.add(camera);


// Luz de cielo/rebote: ilumina de forma pareja como luz ambiental "natural".

const hemiLight = new THREE.HemisphereLight(0x6f88b3, 0x33432c, 1.1);

scene.add(hemiLight);


// Luz principal (sol): la que proyecta las sombras. Como el personaje avanza

// de forma continua e ilimitada (ver TILE_* y el seguimiento de cámara),

// esta luz y su cámara de sombras deben seguirlo en animate(); si se dejara

// fija en el origen, al alejarse el personaje saldría del frustum y las

// sombras desaparecerían.

const LIGHT_OFFSET = new THREE.Vector3(5, 10, 6);


const mainLight = new THREE.DirectionalLight(0xffc98a, 3.2);

mainLight.position.copy(LIGHT_OFFSET);

mainLight.castShadow = true;

mainLight.shadow.mapSize.set(2048, 2048);

mainLight.shadow.camera.near = 1;

mainLight.shadow.camera.far = 30;

mainLight.shadow.camera.left = -8;

mainLight.shadow.camera.right = 8;

mainLight.shadow.camera.top = 8;

mainLight.shadow.camera.bottom = -8;

mainLight.shadow.bias = -0.0004;

mainLight.shadow.normalBias = 0.025;

scene.add(mainLight);

scene.add(mainLight.target);


// Luz de relleno fría (rebote del cielo) sin sombra, para que el lado

// opuesto al sol no quede completamente negro.

const fillLight = new THREE.DirectionalLight(0x7ea3d6, 0.65);

fillLight.position.set(-6, 4, -4);

scene.add(fillLight);


// ---- Terreno infinito por "tiles" ----

// En vez de recentrar todo el escenario bajo el personaje (lo que lo hacía

// ver "pegado" al mundo, sin sensación real de avance), el suelo y sus

// props viven en coordenadas absolutas repartidos en celdas de TILE_SIZE.

// Solo se mantienen activas las 3x3 celdas alrededor del personaje: cuando

// cruza a una celda nueva, la celda que quedó más atrás se recicla y

// reaparece por delante con contenido nuevo. Así los árboles/rocas quedan

// atrás de verdad al caminar, y el terreno nunca se acaba.

const TILE_SIZE = 20;

const TILE_SPAN = 1; // radio en celdas -> grilla de (2*TILE_SPAN+1)^2 = 3x3


const groundGroup = new THREE.Group();

scene.add(groundGroup);


// Textura de pasto generada por canvas (sin depender de imágenes externas):

// base verde con moteado aleatorio para que no se vea plana.

function createGrassTexture() {

  const size = 256;

  const canvas = document.createElement('canvas');

  canvas.width = size;

  canvas.height = size;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#3f5c34';

  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 2200; i++) {

    const shade = Math.random();

    const r = Math.floor(45 + shade * 30);

    const g = Math.floor(70 + shade * 60);

    const b = Math.floor(30 + shade * 20);

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;

    const s = 1 + Math.random() * 2;

    ctx.fillRect(Math.random() * size, Math.random() * size, s, s);

  }

  return canvas;

}


const groundTexture = new THREE.CanvasTexture(createGrassTexture());

groundTexture.wrapS = THREE.RepeatWrapping;

groundTexture.wrapT = THREE.RepeatWrapping;

groundTexture.repeat.set(6, 6); // se repite igual en cada tile, así el patrón queda continuo entre celdas

groundTexture.colorSpace = THREE.SRGBColorSpace;

groundTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();


// Geometría y material del piso se comparten entre todas las celdas (más liviano).

const floorGeometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);

const floorMaterial = new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.95 });


// ---- Escenario rústico: props que pueblan cada celda del terreno ----


const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 });

const foliageMaterials = [

  new THREE.MeshStandardMaterial({ color: 0x3f6b34, roughness: 0.85, flatShading: true }),

  new THREE.MeshStandardMaterial({ color: 0x4c7a3d, roughness: 0.85, flatShading: true })

];

const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x7c7c74, roughness: 0.95, flatShading: true });

const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85 });

const flowerMaterials = [

  new THREE.MeshStandardMaterial({ color: 0xffe27a, roughness: 0.6 }),

  new THREE.MeshStandardMaterial({ color: 0xff9ecf, roughness: 0.6 }),

  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })

];


function withShadow(mesh) {

  mesh.castShadow = true;

  mesh.receiveShadow = true;

  return mesh;

}


function createTree(x, z) {

  const group = new THREE.Group();

  const scale = 0.85 + Math.random() * 0.4;

  const trunkHeight = 1.3 * scale;

  const trunk = withShadow(new THREE.Mesh(

    new THREE.CylinderGeometry(0.07 * scale, 0.12 * scale, trunkHeight, 6),

    barkMaterial

  ));

  trunk.position.y = trunkHeight / 2;

  group.add(trunk);


  const foliageMat = foliageMaterials[Math.floor(Math.random() * foliageMaterials.length)];

  for (let i = 0; i < 3; i++) {

    const r = (0.95 - i * 0.22) * scale;

    const h = 1.05 * scale;

    const cone = withShadow(new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), foliageMat));

    cone.position.y = trunkHeight + i * 0.5 * scale + h * 0.35;

    group.add(cone);

  }


  group.position.set(x, 0, z);

  group.rotation.y = Math.random() * Math.PI * 2;

  return group;

}


function createRock(x, z) {

  const scale = 0.5 + Math.random() * 0.6;

  const geo = new THREE.IcosahedronGeometry(0.3 * scale, 0);

  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {

    const jitter = 0.8 + Math.random() * 0.35;

    pos.setXYZ(i, pos.getX(i) * jitter, pos.getY(i) * jitter, pos.getZ(i) * jitter);

  }

  geo.computeVertexNormals();

  const rock = withShadow(new THREE.Mesh(geo, rockMaterial));

  rock.position.set(x, 0.15 * scale, z);

  rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

  return rock;

}


function createBush(x, z) {

  const group = new THREE.Group();

  const scale = 0.6 + Math.random() * 0.4;

  const mat = foliageMaterials[Math.floor(Math.random() * foliageMaterials.length)];

  for (let i = 0; i < 4; i++) {

    const s = withShadow(new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 7, 6), mat));

    s.position.set(

      (Math.random() - 0.5) * 0.3 * scale,

      0.2 * scale + Math.random() * 0.1,

      (Math.random() - 0.5) * 0.3 * scale

    );

    group.add(s);

  }

  group.position.set(x, 0, z);

  return group;

}


function createFlower(x, z) {

  const mat = flowerMaterials[Math.floor(Math.random() * flowerMaterials.length)];

  const group = new THREE.Group();

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.12, 4), foliageMaterials[0]);

  stem.position.y = 0.06;

  group.add(stem);

  const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), mat);

  bloom.position.y = 0.12;

  group.add(bloom);

  group.position.set(x, 0, z);

  return group;

}


function createHill(x, z, radius, color) {

  const hill = new THREE.Mesh(

    new THREE.SphereGeometry(radius, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),

    new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })

  );

  hill.position.set(x, -radius * 0.55, z);

  return hill;

}


// Zona despejada alrededor del punto de aparición del personaje (0,0), para

// que el pueblo (ver más abajo) no quede tapado por árboles encima.

const CLEAR_RADIUS = 3.2;


// Los árboles/rocas/arbustos se generan con geometría única por instancia

// (varían de tamaño). Al reciclar una celda hay que liberarla explícitamente

// o se acumula en la GPU con cada celda nueva durante una sesión larga.

// El material sí se comparte entre instancias, así que no se libera aquí.

function disposeTileContents(group) {

  group.traverse((obj) => {

    if (obj.isMesh && obj.geometry && obj.geometry !== floorGeometry) {

      obj.geometry.dispose();

    }

  });

  group.clear();

}


// Genera el contenido (piso + vegetación) de una celda del terreno. Cada vez

// que una celda se recicla se vuelve a llamar con sus nuevas coordenadas,

// así que el contenido de cada celda es aleatorio (no persiste si el

// personaje se aleja mucho y vuelve, igual que ocurre en muchos mundos

// generados proceduralmente).

function populateTile(group, tx, tz) {

  const floor = new THREE.Mesh(floorGeometry, floorMaterial);

  floor.rotation.x = -Math.PI / 2;

  floor.receiveShadow = true;

  group.add(floor);


  const isHomeTile = tx === 0 && tz === 0;


  const scatter = (count, factory) => {

    for (let i = 0; i < count; i++) {

      const x = (Math.random() - 0.5) * TILE_SIZE * 0.9;

      const z = (Math.random() - 0.5) * TILE_SIZE * 0.9;

      if (isHomeTile && Math.hypot(x, z) < CLEAR_RADIUS) continue; // deja libre el claro del pueblo

      group.add(factory(x, z));

    }

  };


  scatter(3, createTree);

  scatter(2, createRock);

  scatter(2, createBush);

  scatter(4, createFlower);

}


// Pool fijo de 3x3 celdas activas alrededor del personaje. Se reciclan (se

// reposicionan y regeneran) en vez de crearse/destruirse constantemente.

const activeTiles = new Map();

const tileKey = (tx, tz) => `${tx},${tz}`;


for (let tx = -TILE_SPAN; tx <= TILE_SPAN; tx++) {

  for (let tz = -TILE_SPAN; tz <= TILE_SPAN; tz++) {

    const group = new THREE.Group();

    group.position.set(tx * TILE_SIZE, 0, tz * TILE_SIZE);

    populateTile(group, tx, tz);

    groundGroup.add(group);

    activeTiles.set(tileKey(tx, tz), { group, tx, tz });

  }

}


let currentTileX = 0;

let currentTileZ = 0;


function updateActiveTiles(charTileX, charTileZ) {

  const desired = new Set();

  for (let dx = -TILE_SPAN; dx <= TILE_SPAN; dx++) {

    for (let dz = -TILE_SPAN; dz <= TILE_SPAN; dz++) {

      desired.add(tileKey(charTileX + dx, charTileZ + dz));

    }

  }


  const freed = [];

  activeTiles.forEach((entry, key) => {

    if (!desired.has(key)) freed.push(entry);

  });

  freed.forEach((entry) => activeTiles.delete(tileKey(entry.tx, entry.tz)));


  const missing = [];

  desired.forEach((key) => { if (!activeTiles.has(key)) missing.push(key); });


  missing.forEach((key, i) => {

    const [tx, tz] = key.split(',').map(Number);

    const entry = freed[i];

    entry.tx = tx;

    entry.tz = tz;

    entry.group.position.set(tx * TILE_SIZE, 0, tz * TILE_SIZE);

    disposeTileContents(entry.group);

    populateTile(entry.group, tx, tz);

    activeTiles.set(key, entry);

  });

}


// ---- Pueblo de origen: punto fijo del mapa (no viaja con el personaje) ----

const villageGroup = new THREE.Group();

const FENCE_RADIUS = 9.6;

const FENCE_SEGMENTS = 14;

const LANTERN_EVERY = 4;

const fencePosts = [];

for (let i = 0; i < FENCE_SEGMENTS; i++) {

  const angle = (i / FENCE_SEGMENTS) * Math.PI * 2;

  fencePosts.push(new THREE.Vector3(Math.cos(angle) * FENCE_RADIUS, 0, Math.sin(angle) * FENCE_RADIUS));

}


fencePosts.forEach((p, i) => {

  const post = withShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.75, 6), woodMaterial));

  post.position.set(p.x, 0.375, p.z);

  villageGroup.add(post);


  if (i % LANTERN_EVERY === 0) {

    const pole = withShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), barkMaterial));

    pole.position.set(p.x, 0.7, p.z);

    villageGroup.add(pole);


    const glow = new THREE.Mesh(

      new THREE.SphereGeometry(0.09, 8, 8),

      new THREE.MeshStandardMaterial({ color: 0xffcf8a, emissive: 0xff9a3d, emissiveIntensity: 1.8, roughness: 0.4 })

    );

    glow.position.set(p.x, 1.4, p.z);

    villageGroup.add(glow);


    const lantern = new THREE.PointLight(0xffb066, 1.1, 5, 2);

    lantern.position.set(p.x, 1.4, p.z);

    villageGroup.add(lantern);

  }

});


for (let i = 0; i < FENCE_SEGMENTS; i++) {

  const a = fencePosts[i];

  const b = fencePosts[(i + 1) % FENCE_SEGMENTS];

  const dist = a.distanceTo(b);

  [0.55, 0.28].forEach((railHeight) => {

    const rail = withShadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, dist * 0.92), woodMaterial));

    rail.position.set((a.x + b.x) / 2, railHeight, (a.z + b.z) / 2);

    rail.lookAt(b.x, railHeight, b.z);

    villageGroup.add(rail);

  });

}


scene.add(villageGroup);


// ---- Colinas lejanas: dan profundidad al horizonte y siguen al personaje

// (a esa distancia el paralaje real es imperceptible, así que no hace falta

// que sean parte del terreno por tiles; es el mismo truco que usamos con el

// cielo y con la luz principal). ----

const HILL_COLORS = [0x4d6a4c, 0x5c7566, 0x74889b, 0x8fa0b8];

const HILL_COUNT = 10;

const hillsGroup = new THREE.Group();

for (let i = 0; i < HILL_COUNT; i++) {

  const angle = (i / HILL_COUNT) * Math.PI * 2 + Math.random() * 0.2;

  const dist = 13 + Math.random() * 6;

  const radius = 3 + Math.random() * 3;

  const color = HILL_COLORS[Math.floor(Math.random() * HILL_COLORS.length)];

  hillsGroup.add(createHill(Math.cos(angle) * dist, Math.sin(angle) * dist, radius, color));

}

scene.add(hillsGroup);


const loader = new FBXLoader();

const clock = new THREE.Clock();

const actions = {};

let model;

let mixer;

let currentAction;


// Velocidad de avance (unidades/seg) según la animación activa.

const MOVE_SPEED = {

  walking: 1.8,

  running: 4.2

};

const TURN_SPEED = Math.PI * 0.8; // radianes/seg al girar con las flechas

// Si el personaje avanza "de espaldas", cambia esto a Math.PI.

const MODEL_FORWARD_OFFSET = 0;


let currentSpeed = 0;

const keysPressed = new Set();

const prevModelPosition = new THREE.Vector3();

const moveDelta = new THREE.Vector3();

const forwardDir = new THREE.Vector3();


const animationFiles = {

  idle: './assets/model/animations/Talking%20On%20Phone.fbx',

  walking: './assets/model/animations/Strut%20Walking.fbx',

  running: './assets/model/animations/Jogging.fbx',

  jumping: './assets/model/animations/Excited.fbx',

  dance: './assets/model/animations/Hip%20Hop%20Dancing.fbx'

};


// Los FBX de Mixamo traen la traslación horizontal (X/Z) del hueso raíz

// "horneada" en la animación. Si no se quita, el personaje avanza dentro

// del propio clip y salta hacia atrás cada vez que el clip hace loop.

// Aquí se fija X/Z al valor del primer frame (se conserva Y para el rebote

// vertical natural) y todo el desplazamiento real lo controla nuestro código.

function removeHorizontalRootMotion(clip) {

  const rootTrack = clip.tracks.find(

    (track) => track.name.endsWith('.position') && /hips/i.test(track.name)

  );

  if (!rootTrack) return;


  const values = rootTrack.values;

  const baseX = values[0];

  const baseZ = values[2];

  for (let i = 0; i < values.length; i += 3) {

    values[i] = baseX;

    values[i + 2] = baseZ;

  }

}


function loadAnimation(name, url) {

  return new Promise((resolve) => {

    loader.load(url, (fbx) => {

      const clip = fbx.animations[0];

      if (clip) {

        removeHorizontalRootMotion(clip);

        actions[name] = mixer.clipAction(clip);

      } else console.warn(`La animación "${name}" no contiene clips: ${url}`);

      resolve();

    }, undefined, (error) => {

      console.warn(`No se pudo cargar la animación "${name}" (${url}):`, error);

      resolve();

    });

  });

}


function playAction(name) {

  const nextAction = actions[name];

  if (!nextAction || nextAction === currentAction) return;


  if (currentAction) currentAction.fadeOut(0.25);


  nextAction

    .reset()

    .setEffectiveTimeScale(1)

    .setEffectiveWeight(1)

    .fadeIn(0.25)

    .play();


  currentAction = nextAction;

  currentSpeed = MOVE_SPEED[name] || 0;

  document.getElementById('animation-name').textContent = name.toUpperCase();

}


loader.load('./assets/model/Peasant%20Girl.fbx', async (fbx) => {

  model = fbx;

  model.scale.setScalar(0.01);

  model.position.set(0, 0, 0);


  let hasMesh = false;

  model.traverse((child) => {

    if (child.isMesh) {

      hasMesh = true;

      child.castShadow = true;

      child.receiveShadow = true;

    }

  });


  if (!hasMesh) {

    console.error(

      'El FBX cargado no contiene malla (mesh). Descarga el personaje de Mixamo ' +

      'en formato FBX CON SKIN y guárdalo como assets/model/character.fbx'

    );

    document.getElementById('animation-name').textContent = 'SIN MALLA';

  }


  scene.add(model);

  prevModelPosition.copy(model.position);

  mixer = new THREE.AnimationMixer(model);


  await Promise.all(

    Object.entries(animationFiles).map(([name, url]) => loadAnimation(name, url))

  );


  playAction('idle');

}, undefined, (error) => console.error('Error al cargar el modelo:', error));


window.addEventListener('keydown', (event) => {

  const keyboard = {

    Digit1: 'idle',

    Digit2: 'walking',

    Digit3: 'running',

    Digit4: 'jumping',

    Digit5: 'dance'

  };


  if (keyboard[event.code]) {

    playAction(keyboard[event.code]);

    return;

  }


  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {

    keysPressed.add(event.code);

  }

});


window.addEventListener('keyup', (event) => {

  keysPressed.delete(event.code);

});


function animate() {

  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);


  if (model) {

    if (keysPressed.has('ArrowLeft')) model.rotation.y += TURN_SPEED * delta;

    if (keysPressed.has('ArrowRight')) model.rotation.y -= TURN_SPEED * delta;


    if (currentSpeed > 0) {

      forwardDir.set(

        Math.sin(model.rotation.y + MODEL_FORWARD_OFFSET),

        0,

        Math.cos(model.rotation.y + MODEL_FORWARD_OFFSET)

      );

      model.position.addScaledVector(forwardDir, currentSpeed * delta);

    }


    // Recicla las celdas de terreno que quedaron atrás hacia el frente del

    // personaje solo cuando cruza a una celda nueva (no en cada frame), así

    // el suelo es infinito sin que nada se sienta "pegado" al personaje.

    const charTileX = Math.round(model.position.x / TILE_SIZE);

    const charTileZ = Math.round(model.position.z / TILE_SIZE);

    if (charTileX !== currentTileX || charTileZ !== currentTileZ) {

      updateActiveTiles(charTileX, charTileZ);

      currentTileX = charTileX;

      currentTileZ = charTileZ;

    }


    // Las colinas lejanas sí siguen al personaje en cada frame: a esa

    // distancia el paralaje real es imperceptible (igual que un horizonte).

    hillsGroup.position.set(model.position.x, 0, model.position.z);


    // La cámara sigue al personaje conservando el ángulo/zoom elegido con el mouse.

    moveDelta.subVectors(model.position, prevModelPosition);

    camera.position.add(moveDelta);

    controls.target.set(model.position.x, 1, model.position.z);

    prevModelPosition.copy(model.position);


    // La luz/sombra principal también sigue al personaje, manteniendo el

    // mismo ángulo de incidencia (ver comentario junto a LIGHT_OFFSET).

    mainLight.position.set(

      model.position.x + LIGHT_OFFSET.x,

      LIGHT_OFFSET.y,

      model.position.z + LIGHT_OFFSET.z

    );

    mainLight.target.position.set(model.position.x, 0, model.position.z);

  }


  controls.update();

  renderer.render(scene, camera);

}


renderer.setAnimationLoop(animate);


function handleResize() {

  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  renderer.setSize(window.innerWidth, window.innerHeight);

}


window.addEventListener('resize', handleResize);

window.addEventListener('orientationchange', handleResize);
