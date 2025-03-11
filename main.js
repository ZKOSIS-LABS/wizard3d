import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

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
const titleObjects = []; // Stores the 3D title models

let hoveredObject = null;
let currentPopupTitle = "";
let popupDom = null;

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
      // Use recursive raycasting to check all nested meshes
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(titleObjects, true);
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

// ----- Main 3D Model Loading -----
const loader = new GLTFLoader();
loader.load(
  "/assets/wizo.glb",
  (gltf) => {
    const model = gltf.scene;
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const scaleFactor = 4 / maxSize;
    model.scale.set(scaleFactor, scaleFactor, scaleFactor);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    model.position.y -= 0.6;
    console.log("Main model loaded and resized!");
  },
  undefined,
  (error) => {
    console.error("Error loading main model:", error);
  }
);

// ----- Helper: Create Title Model -----
// Loads a glb model for a title, sets its position and name, and adds it to the scene and titleObjects array.
function createTitleModel(modelUrl, name, position, scale = 1) {
  loader.load(
    modelUrl,
    (gltf) => {
      const titleModel = gltf.scene;
      titleModel.position.set(position.x, position.y, position.z);
      titleModel.scale.set(scale, scale, scale);
      titleModel.name = name;
      // Ensure every mesh inside the model has the correct name for raycasting.
      titleModel.traverse((child) => {
        if (child.isMesh) {
          child.name = name;
        }
      });
      scene.add(titleModel);
      titleObjects.push(titleModel);
    },
    undefined,
    (error) => {
      console.error(`Error loading model for ${name}:`, error);
    }
  );
}

// ----- Load Title Models -----
// Replace the three text titles with GLB models.
// Adjust the URLs, positions, and scale factors as needed.
createTitleModel("/assets/contract.glb", "CONTRACT", { x: 1, y: -1, z: -2 }, 0.6);
createTitleModel("/assets/chart.glb", "CHART", { x: 0, y: 1, z: -1.5 }, 0.6);
createTitleModel("/assets/info.glb", "INFO", { x: -2.5, y: 1, z: 1.5 }, 0.6);

// ----- 2D Popup DOM Functions -----
// Compute the 2D screen ca from a 3D object (used for INFO popup)
function getScreenPosition(object, camera) {
  const vector = new THREE.Vector3();
  object.getWorldPosition(vector);
  vector.project(camera);
  const x = ((vector.x + 1) / 2) * window.innerWidth;
  const y = ((1 - vector.y) / 2) * window.innerHeight;
  return { x, y };
}

// Create a popup DOM element with content and assign style classes based on title
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
    div.classList.add("popup-contract");
    div.innerHTML = `
<p style="font-size:30px;" >Contract: 0x11111111111111111111111111111111</p>
    `;
  } else if (title === "INFO") {
    div.classList.add("popup-info");
    div.innerHTML = `
      <p>Backed by a community-driven vision, WZD thrives on memes, engagement, and a sprinkle of blockchain sorcery. Whether you're a crypto veteran or a new sorcerer entering the space, Wizard is designed to be fun, fast, and accessible, thanks to Solana’s high-speed, low-fee transactions. <br></p>
    `;
  } else if (title === "CHART") {
    div.classList.add("popup-chart");
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

// Show (or update) the popup DOM element with content and position it appropriately
function showPopup(title, screenPos) {
  if (!popupDom) {
    popupDom = createPopupDom(title);
    document.body.appendChild(popupDom);
    currentPopupTitle = title;
  } else if (currentPopupTitle !== title) {
    popupDom.innerHTML = "";
    popupDom.classList.remove("popup-contract", "popup-info", "popup-chart");
    if (title === "CONTRACT") {
      popupDom.classList.add("popup-contract");
      popupDom.innerHTML = `
<p style="font-size:30px;">Contract: 0x11111111111111111111111111111111</p>
      `;
    } else if (title === "INFO") {
      popupDom.classList.add("popup-info");
      popupDom.innerHTML = `
        <p>Backed by a community-driven vision, WZD thrives on memes, engagement, and a sprinkle of blockchain sorcery. Whether you're a crypto veteran or a new sorcerer entering the space, Wizard is designed to be fun, fast, and accessible, thanks to Solana’s high-speed, low-fee transactions. <br></p>
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
  // Set fixed positions for CONTRACT and CHART; for INFO, use dynamic positioning.
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
  // Trigger the pop-in animation
  popupDom.getBoundingClientRect();
  popupDom.style.transform = "scale(1)";
  popupDom.style.opacity = "1";
}

// ----- Animation Loop -----
// ----- Animation Loop -----
function animate() {
  requestAnimationFrame(animate);

  // Create an offset quaternion that rotates the model -90° on the X-axis.
  const offset = new THREE.Quaternion();
  offset.setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  
  // Instead of directly copying the camera's quaternion,
  // combine it with the offset to orient the models correctly.
  titleObjects.forEach((obj) => {
    obj.quaternion.copy(camera.quaternion).multiply(offset);
  });
  
  controls.update();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(titleObjects, true);
  if (intersects.length > 0) {
    const intersected = intersects[0].object;
    if (!hoveredObject || hoveredObject.name !== intersected.name) {
      hoveredObject = intersected;
      const screenPos = getScreenPosition(intersected, camera);
      showPopup(intersected.name, screenPos);
    }
  }
  // For INFO, update dynamic position continuously.
  if (popupDom && hoveredObject && currentPopupTitle === "INFO") {
    const screenPos = getScreenPosition(hoveredObject, camera);
    popupDom.style.left = `${screenPos.x}px`;
    popupDom.style.top = `${screenPos.y + 20}px`;
  }
  renderer.render(scene, camera);
}
animate();


// ----- Handle Window Resizing -----
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
