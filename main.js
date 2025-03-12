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
const textObjects = []; // Stores the 3D title text meshes

let hoveredObject = null;
let currentPopupTitle = "";
let popupDom = null;

// Global variables for coin/fire effects:
let wizardModel = null;
let coinModel = null;

// Update mouse vector for desktop using mousemove on the window
window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// For mobile: attach touch events to the canvas
renderer.domElement.addEventListener(
  "touchstart",
  (event) => {
    if (event.touches.length > 0) {
      const touch = event.touches[0];
      mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      // Trigger raycasting on touchstart
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(textObjects);
      if (intersects.length > 0) {
        hoveredObject = intersects[0].object;
        const screenPos = getScreenPosition(hoveredObject, camera);
        showPopup(hoveredObject.name, screenPos);
      }
    }
  },
  false
);

renderer.domElement.addEventListener(
  "touchmove",
  (event) => {
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
  },
  undefined,
  (error) => {
    console.error("Error loading coin model:", error);
  }
);

// ----- Font and Title Text Loading -----
const fontLoader = new FontLoader();
fontLoader.load("/assets/helvetiker_regular.typeface.json", (font) => {
  // Helper function to create 3D title text
  const createText = (text, color, position) => {
    const textGeometry = new TextGeometry(text, {
      font: font,
      size: 0.2,
      height: 0.1,
      depth: 0.1,
    });
    const textMaterial = new THREE.MeshBasicMaterial({ color });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    textMesh.position.set(position.x, position.y, position.z);
    textMesh.name = text;
    scene.add(textMesh);
    textObjects.push(textMesh);
    return textMesh;
  };

  // Create the 3 titles
  createText("CONTRACT", 0xffffff, { x: 1, y: -1, z: -2 });
  createText("CHART", 0xffffff, { x: 0, y: 1, z: -1.5 });
  createText("INFO", 0xffffff, { x: -2.5, y: 1, z: 1.5 });

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
    }
    if (title === "CONTRACT") {
      div.innerHTML = `
<p style="font-size:40px;">Contract: 0x11111111111111111111111111111111</p>
      `;
    } else if (title === "INFO") {
      div.innerHTML = `
<p>Magic Internet Rewards enchants holders of $MIR with wBTC, wETH, and wSOL. Our wizard has studied thousands of books over his many years and crafted a completely unique spell to deliver these tokens.</p>
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
  <iframe src="https://dexscreener.com/solana/Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe>
</div>
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
      popupDom.classList.remove("popup-socials", "popup-info", "popup-chart");
      if (title === "CONTRACT") {
        popupDom.classList.add("popup-socials");
        popupDom.innerHTML = `
<p style="font-size:40px;">Contract: 0x11111111111111111111111111111111</p>
        `;
      } else if (title === "INFO") {
        popupDom.classList.add("popup-info");
        popupDom.innerHTML = `
<p>Magic Internet Rewards enchants holders of $MIR with wBTC, wETH, and wSOL. Our wizard has studied thousands of books over his many years and crafted a completely unique spell to deliver these tokens.</p>
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
  <iframe src="https://dexscreener.com/solana/Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe>
</div>
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

  // ----- Animation Loop -----
  function animate() {
    requestAnimationFrame(animate);
    // Make the title texts face the camera.
    textObjects.forEach((txt) => txt.lookAt(camera.position));
    controls.update();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(textObjects);
    if (intersects.length > 0) {
      const intersected = intersects[0].object;
      if (!hoveredObject || hoveredObject.name !== intersected.name) {
        hoveredObject = intersected;
        const screenPos = getScreenPosition(intersected, camera);
        showPopup(intersected.name, screenPos);
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

// ----- Coin & Fire Effect Functions -----
// Spawn a single coin with a directional pouring effect.
function spawnCoin() {
  if (!wizardModel || !coinModel) return;
  const coin = coinModel.clone();
  let tipPos = new THREE.Vector3();
  const wandTip = wizardModel.getObjectByName("wandTip");
  if (wandTip) {
    wandTip.getWorldPosition(tipPos);
  } else {
    wizardModel.getWorldPosition(tipPos);
    tipPos.y += 1.0; // Fallback offset—adjust if necessary.
  }
  coin.position.copy(tipPos);
  scene.add(coin);

  // Calculate a directional vector using the wand tip's orientation.
  let baseDir = new THREE.Vector3(2, 3, 2); // local upward
  if (wandTip) {
    const wandQuat = new THREE.Quaternion();
    wandTip.getWorldQuaternion(wandQuat);
    baseDir.applyQuaternion(wandQuat);
  }
  // Add slight random variation for a natural look.
  baseDir.x += (Math.random() - 0.5) * 0.1;
  baseDir.z += (Math.random() - 0.5) * 0.1;
  baseDir.normalize();

  const distance = 3 + Math.random() * 0.5;
  const targetPos = tipPos.clone().add(baseDir.multiplyScalar(distance));

  new TWEEN.Tween(coin.position)
    .to({ x: targetPos.x, y: targetPos.y, z: targetPos.z }, 1500)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();

  setTimeout(() => scene.remove(coin), 1600);
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


// Pour coins by spawning several coins in rapid succession.
function pourCoins(num, delay) {
  let count = 0;
  const interval = setInterval(() => {
    spawnCoin();
    count++;
    if (count >= num) clearInterval(interval);
  }, delay);
}

// Listen for clicks anywhere on the screen to trigger a pouring coin and fire effect.
window.addEventListener("click", () => {
  pourCoins(10, 100); // Spawn 10 coins with 100ms delay between each
  spawnFire();
});

// ----- Handle Window Resizing -----
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
