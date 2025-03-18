import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import TWEEN from "@tweenjs/tween.js";

// ----- Scene Setup -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 2, 5);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("scene"),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 2;
controls.maxDistance = 10;

// Lights
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 10, 5);
scene.add(light);
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

// ----- Global Variables for Hover Detection and 2D Popup -----
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const textObjects = []; // Will store our interactive title containers

let hoveredObject = null;
let currentPopupTitle = "";
let popupDom = null;

// Global variables for coin/fire effects:
let wizardModel = null;
let coinModel = null;
let motoModel = null; // NEW global for moto model
let motoAnimations = null; // NEW to store moto animations

// Global array for mixers (for animated models)
const mixers = [];
const clock = new THREE.Clock();

// Flag to indicate if the user has interacted (via mousemove or touch)
let userInteracted = false;

// Update mouse vector for desktop using mousemove on the window
window.addEventListener("mousemove", (event) => {
  userInteracted = true;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// For mobile: attach touch events to the canvas
renderer.domElement.addEventListener(
  "touchstart",
  (event) => {
    userInteracted = true;
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      // Only update raycasting if the user has interacted
      if (userInteracted) {
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(textObjects);
        if (intersects.length > 0) {
          const intersected =
            intersects[0].object.parent || intersects[0].object;
          hoveredObject = intersected;
          const screenPos = getScreenPosition(intersected, camera);
          showPopup(intersected.name, screenPos);
        }
      }
    }
  },
  false
);

renderer.domElement.addEventListener(
  "touchmove",
  (event) => {
    userInteracted = true;
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    }
  },
  false
);

// ----- 3D Model Loading (Wizard) -----
const loader = new GLTFLoader();
loader.load(
  "/assets/wizo.glb",
  (gltf) => {
    wizardModel = gltf.scene;
    scene.add(wizardModel);
    const box = new THREE.Box3().setFromObject(wizardModel);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const scaleFactor = 4 / maxSize;
    wizardModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
    const center = box.getCenter(new THREE.Vector3());
    wizardModel.position.sub(center);
    wizardModel.position.y -= 0.6;

    // Check if the model has a wand tip. If not, add one.
    let wandTip = wizardModel.getObjectByName("wandTip");
    if (!wandTip) {
      wandTip = new THREE.Object3D();
      wandTip.name = "wandTip";
      // Set the marker's local position relative to the wizard.
      wandTip.position.set(3, 3.5, 0); // Adjust these values until it lines up with the wand tip.
      wizardModel.add(wandTip);
    }

    console.log("Wizard model loaded and wand tip set!");
  },
  undefined,
  (error) => {
    console.error("Error loading model:", error);
  }
);

// ----- Load Coin Model for Effects -----
loader.load(
  "/assets/coin.glb",
  (gltf) => {
    coinModel = gltf.scene;
    coinModel.scale.set(0.2, 0.2, 0.2);
  },
  undefined,
  (error) => {
    console.error("Error loading coin model:", error);
  }
);

// ----- Load Moto Model for Effects (with animation) -----
loader.load(
  "/assets/motoz.glb",
  (gltf) => {
    motoModel = gltf.scene;
    motoModel.scale.set(0.02, 0.02, 0.02);
    motoAnimations = gltf.animations; // store animations for later use
  },
  undefined,
  (error) => {
    console.error("Error loading moto model:", error);
  }
);

// ----- Font and Title Text Loading -----
const fontLoader = new FontLoader();
fontLoader.load("/assets/helvetiker_regular.typeface.json", (font) => {
  // Helper function to create an interactive title with an invisible hit mesh.
  const createText = (text, color, position) => {
    // Create the text geometry and mesh.
    const textGeometry = new TextGeometry(text, {
      font: font,
      size: 0.13,
      height: 0.1,
      depth: 0.1,
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    // Create a container to hold both the text and its hit mesh.
    const container = new THREE.Object3D();
    container.position.set(position.x, position.y, position.z);
    container.name = text;
    container.add(textMesh);

    // Compute bounding box of the text geometry.
    textGeometry.computeBoundingBox();
    const bbox = textGeometry.boundingBox;
    const sizeVec = new THREE.Vector3();
    bbox.getSize(sizeVec);

    // Expand hit area by a factor (e.g., 2x)
    sizeVec.x *= 2;
    sizeVec.y *= 2;
    sizeVec.z *= 2;

    // Create an invisible box geometry for the hit area.
    const hitGeometry = new THREE.BoxGeometry(sizeVec.x, sizeVec.y, sizeVec.z);
    const hitMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
    });
    const hitMesh = new THREE.Mesh(hitGeometry, hitMaterial);
    // Center the hit mesh relative to the text.
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    hitMesh.position.copy(center);
    container.add(hitMesh);

    scene.add(container);
    textObjects.push(container);
    return container;
  };

  // Create the 4 titles.
  createText("CONTRACT", 0xffffff, { x: 1, y: -1, z: -2 });
  createText("CHART", 0xffffff, { x: 0, y: 1, z: -1.5 });
  createText("INFO", 0xffffff, { x: -2.5, y: 1, z: 1.5 });
  createText("SOCIALS", 0xffffff, { x: 2, y: -1, z: 1.5 });

  // ----- 2D Popup DOM Functions -----
  function getScreenPosition(object, camera) {
    const vector = new THREE.Vector3();
    object.getWorldPosition(vector);
    vector.project(camera);
    const x = ((vector.x + 1) / 2) * window.innerWidth;
    const y = ((1 - vector.y) / 2) * window.innerHeight;
    return { x, y };
  }

  function createPopupDom(title) {
    const div = document.createElement("div");
    div.id = "popupDom";
    Object.assign(div.style, {
      position: "fixed",
      padding: "10px",
      transform: "scale(0)",
      opacity: "0",
      transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
      zIndex: 1000,
    });
    div.classList.add("popup");
    if (title === "CONTRACT") {
      div.classList.add("popup-socials");
    } else if (title === "INFO") {
      div.classList.add("popup-info");
    } else if (title === "CHART") {
      div.classList.add("popup-chart");
    } else if (title === "SOCIALS") {
      div.classList.add("popup-socials-fixed");
    }
    if (title === "CONTRACT") {
      div.innerHTML = `
<p style="font-size:25px;">Contract: 7tXGPcSsWDgPHmLBS1EirBsPPitBktfCepp8KeGiJmrR</p>
      `;
    } else if (title === "INFO") {
      div.innerHTML = `
<p>Magic Internet Rewards enchants holders of $MIR with BTC, ETH, and SOL. Our wizard has studied thousands of books over his many years and crafted a completely unique spell to deliver these tokens to your wallet.</p>
      `;
    } else if (title === "CHART") {
      div.innerHTML = `
<style>
  #dexscreener-embed {
    position: relative;
    width: 100%;
    min-height: 300px;
    min-width: 300px;
    padding-bottom: 125%;
  }
  @media(min-width: 1400px) {
    #dexscreener-embed {
      padding-bottom: 65%;
    }
  }
  #dexscreener-embed iframe {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    border: 0;
  }
</style>
<div id="dexscreener-embed">
  <iframe src="https://dexscreener.com/solana/5jbdejq8jn1b5tpb8bwnn5hziq1ibfddeh8lyjnvuswy?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe>
</div>
      `;
    } else if (title === "SOCIALS") {
      // Fixed popup for SOCIALS: top right corner.
      div.innerHTML = `

<a href="https://x.com/MagicIntRewards" target="_blank">
  <img src="/X.png" alt="Twitter" style="width:60px; height:auto;">
</a>
      `;
    } else {
      div.innerHTML = `<p>Popup for ${title}</p>`;
    }
    return div;
  }

  function showPopup(title, screenPos) {
    if (!popupDom) {
      popupDom = createPopupDom(title);
      document.body.appendChild(popupDom);
      currentPopupTitle = title;
    } else if (currentPopupTitle !== title) {
      popupDom.innerHTML = "";
      popupDom.classList.remove(
        "popup-socials",
        "popup-info",
        "popup-chart",
        "popup-socials-fixed"
      );
      if (title === "CONTRACT") {
        popupDom.classList.add("popup-socials");
        popupDom.innerHTML = `
<p style="font-size:25px;">Contract: 7tXGPcSsWDgPHmLBS1EirBsPPitBktfCepp8KeGiJmrR</p>
        `;
      } else if (title === "INFO") {
        popupDom.classList.add("popup-info");
        popupDom.innerHTML = `
<p>Magic Internet Rewards enchants holders of $MIR with BTC, ETH, and SOL. Our wizard has studied thousands of books over his many years and crafted a completely unique spell to deliver these tokens to your wallet.</p>
        `;
      } else if (title === "CHART") {
        popupDom.classList.add("popup-chart");
        popupDom.innerHTML = `
<style>
  #dexscreener-embed {
    position: relative;
    width: 100%;
    min-height: 300px;
    min-width: 300px;
    padding-bottom: 125%;
  }
  @media(min-width: 1400px) {
    #dexscreener-embed {
      padding-bottom: 65%;
    }
  }
  #dexscreener-embed iframe {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    border: 0;
  }
</style>
<div id="dexscreener-embed">
  <iframe src="https://dexscreener.com/solana/5jbdejq8jn1b5tpb8bwnn5hziq1ibfddeh8lyjnvuswy?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe>
</div>
        `;
      } else if (title === "SOCIALS") {
        popupDom.classList.add("popup-socials-fixed");
        popupDom.innerHTML = `

<a href="https://x.com/MagicIntRewards" target="_blank">
  <img src="/X.png" alt="Twitter" style="width:60px; height:auto;">
</a>
        `;
      } else {
        popupDom.innerHTML = `<p>Popup for ${title}</p>`;
      }
      currentPopupTitle = title;
    }
    if (title === "CHART") {
      popupDom.style.right = "20px";
      popupDom.style.bottom = "20px";
      popupDom.style.left = "";
      popupDom.style.top = "";
    } else if (title === "CONTRACT") {
      popupDom.style.left = "20px";
      popupDom.style.bottom = "20px";
      popupDom.style.right = "";
      popupDom.style.top = "";
    } else if (title === "SOCIALS") {
      // Fixed at top right.
      popupDom.style.top = "20px";
      popupDom.style.right = "20px";
      popupDom.style.left = "";
      popupDom.style.bottom = "";
    } else {
      popupDom.style.left = `${screenPos.x}px`;
      popupDom.style.top = `${screenPos.y + 20}px`;
      popupDom.style.right = "";
      popupDom.style.bottom = "";
    }
    popupDom.getBoundingClientRect();
    popupDom.style.transform = "scale(1)";
    popupDom.style.opacity = "1";
  }

  // Set the default popup to INFO on load.
  const infoTitle = textObjects.find((obj) => obj.name === "INFO");
  if (infoTitle) {
    const screenPos = getScreenPosition(infoTitle, camera);
    hoveredObject = infoTitle;
    currentPopupTitle = "INFO";
    showPopup("INFO", screenPos);
  }

  // ----- Animation Loop -----
  function animate() {
    requestAnimationFrame(animate);
    // Update animated mixers.
    const delta = clock.getDelta();
    mixers.forEach((mixer) => mixer.update(delta));

    // Make the title containers face the camera.
    textObjects.forEach((container) => container.lookAt(camera.position));
    controls.update();
    // Only update raycasting after user interaction.
    if (userInteracted) {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(textObjects);
      if (intersects.length > 0) {
        const intersected = intersects[0].object.parent || intersects[0].object;
        if (!hoveredObject || hoveredObject.name !== intersected.name) {
          hoveredObject = intersected;
          const screenPos = getScreenPosition(intersected, camera);
          showPopup(intersected.name, screenPos);
        }
      }
    }
    if (popupDom && hoveredObject && currentPopupTitle === "INFO") {
      const screenPos = getScreenPosition(hoveredObject, camera);
      popupDom.style.left = `${screenPos.x}px`;
      popupDom.style.top = `${screenPos.y + 20}px`;
    }
    TWEEN.update();
    renderer.render(scene, camera);
  }
  animate();
});

// ----- Coin, Moto & Fire Effect Functions -----
function spawnCoin() {
  if (!wizardModel || !coinModel) return;
  const coin = coinModel.clone();
  let tipPos = new THREE.Vector3();
  const wandTip = wizardModel.getObjectByName("wandTip");
  if (wandTip) {
    wandTip.getWorldPosition(tipPos);
  } else {
    wizardModel.getWorldPosition(tipPos);
    tipPos.y += 1.0;
  }
  coin.position.copy(tipPos);
  // Apply a random rotation.
  coin.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );
  scene.add(coin);

  let baseDir = new THREE.Vector3(12, 13, 2);
  if (wandTip) {
    const wandQuat = new THREE.Quaternion();
    wandTip.getWorldQuaternion(wandQuat);
    baseDir.applyQuaternion(wandQuat);
  }
  baseDir.x += (Math.random() - 0.5) * 0.1;
  baseDir.z += (Math.random() - 0.5) * 0.1;
  baseDir.normalize();

  const distance = 6 + Math.random() * 0.5;
  const targetPos = tipPos.clone().add(baseDir.multiplyScalar(distance));

  new TWEEN.Tween(coin.position)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1500)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();

  setTimeout(() => scene.remove(coin), 1600);
}

function spawnMoto() {
  if (!wizardModel || !motoModel) return;
  const moto = motoModel.clone();
  // Create an AnimationMixer for the clone and play its first clip.
  const mixer = new THREE.AnimationMixer(moto);
  if (motoAnimations && motoAnimations.length > 0) {
    const action = mixer.clipAction(motoAnimations[0]);
    action.play();
  }
  mixers.push(mixer);

  let tipPos = new THREE.Vector3();
  const wandTip = wizardModel.getObjectByName("wandTip");
  if (wandTip) {
    wandTip.getWorldPosition(tipPos);
  } else {
    wizardModel.getWorldPosition(tipPos);
    tipPos.y += 1.0;
  }
  moto.position.copy(tipPos);
  // Apply a random rotation.
  moto.rotation.set(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2
  );
  scene.add(moto);

  let baseDir = new THREE.Vector3(12, 13, 2);
  if (wandTip) {
    const wandQuat = new THREE.Quaternion();
    wandTip.getWorldQuaternion(wandQuat);
    baseDir.applyQuaternion(wandQuat);
  }
  baseDir.x += (Math.random() - 0.5) * 0.1;
  baseDir.z += (Math.random() - 0.5) * 0.1;
  baseDir.normalize();

  const distance = 6 + Math.random() * 0.5;
  const targetPos = tipPos.clone().add(baseDir.multiplyScalar(distance));

  new TWEEN.Tween(moto.position)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1500)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();

  setTimeout(() => scene.remove(moto), 1600);
}

function spawnFire() {
  if (!wizardModel) return;
  const textureLoader = new THREE.TextureLoader();
  const fireTexture = textureLoader.load("/assets/fire.png");
  const material = new THREE.SpriteMaterial({
    map: fireTexture,
    transparent: true,
  });
  const fireSprite = new THREE.Sprite(material);
  let tipPos = new THREE.Vector3();
  const wandTip = wizardModel.getObjectByName("wandTip");
  if (wandTip) {
    wandTip.getWorldPosition(tipPos);
  } else {
    wizardModel.getWorldPosition(tipPos);
    tipPos.y += 1.0;
  }
  fireSprite.position.copy(tipPos);
  fireSprite.scale.set(1, 1, 1);
  scene.add(fireSprite);

  new TWEEN.Tween(fireSprite.scale)
    .to({ x: 3, y: 3, z: 3 }, 1000)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();
  new TWEEN.Tween(fireSprite.material)
    .to({ opacity: 0 }, 1000)
    .onComplete(() => scene.remove(fireSprite))
    .start();
}

// New helper to randomly spawn either coin or moto:
function pourEffects(num, delay) {
  let count = 0;
  const interval = setInterval(() => {
    if (Math.random() < 0.5) {
      spawnCoin();
    } else {
      spawnMoto();
    }
    count++;
    if (count >= num) clearInterval(interval);
  }, delay);
}

window.addEventListener("click", () => {
  pourEffects(10, 100); // randomly spawns coin or moto 10 times
  spawnFire();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
