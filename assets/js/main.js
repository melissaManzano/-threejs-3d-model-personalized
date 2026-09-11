import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';


const scene = new THREE.Scene();

scene.background = new THREE.Color(0x07111f);

// La niebla oculta el borde del piso/grid cuando se recentra bajo el

// personaje (ver GROUND_*) y añade profundidad a la escena.

scene.fog = new THREE.FogExp2(0x07111f, 0.045);


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

controls.maxDistance = 12; // evita alejarse lo suficiente para ver el borde del piso recentrado

controls.minPolarAngle = 0.2; // evita ver la escena desde arriba en picada

controls.maxPolarAngle = Math.PI / 2 - 0.05; // evita que la cámara baje del nivel del piso

controls.target.set(0, 1, 0);


const hemiLight = new THREE.HemisphereLight(0xffffff, 0x223344, 1.8);

scene.add(hemiLight);


const mainLight = new THREE.DirectionalLight(0xffffff, 3);

mainLight.position.set(5, 10, 6);

mainLight.castShadow = true;

mainLight.shadow.mapSize.set(2048, 2048);

scene.add(mainLight);


const GROUND_SIZE = 20;

const GROUND_CELL = 1; // tamaño de celda del GridHelper (size / divisions)


const groundGroup = new THREE.Group();


const floor = new THREE.Mesh(

  new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),

  new THREE.MeshStandardMaterial({ color: 0x263445, roughness: 0.9 })

);

floor.rotation.x = -Math.PI / 2;

floor.receiveShadow = true;

groundGroup.add(floor);

groundGroup.add(new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE, 0x7dd3fc, 0x475569));

scene.add(groundGroup);


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


    // El plano/grid se recentra bajo el personaje (ajustado a la celda del grid)

    // para dar la ilusión de un suelo infinito sin que el personaje salga de él.

    groundGroup.position.set(

      Math.round(model.position.x / GROUND_CELL) * GROUND_CELL,

      0,

      Math.round(model.position.z / GROUND_CELL) * GROUND_CELL

    );


    // La cámara sigue al personaje conservando el ángulo/zoom elegido con el mouse.

    moveDelta.subVectors(model.position, prevModelPosition);

    camera.position.add(moveDelta);

    controls.target.set(model.position.x, 1, model.position.z);

    prevModelPosition.copy(model.position);

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
