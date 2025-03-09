import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// ----- Scene Setup -----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121212);
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
const textObjects = []; // Stores the 3D title meshes

let hoveredObject = null;
let currentPopupTitle = "";
let popupDom = null;

// Update mouse vector for desktop using mousemove on the window
window.addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// For mobile: attach touch events to the canvas
renderer.domElement.addEventListener("touchstart", (event) => {
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
}, false);

renderer.domElement.addEventListener("touchmove", (event) => {
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  }
}, false);

// ----- 3D Model Loading -----
const loader = new GLTFLoader();
loader.load(
  "/assets/wizard.glb",
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
    model.position.y -= 1.2;
    console.log("Model Loaded and Resized!");
  },
  undefined,
  (error) => { console.error("Error loading model:", error); }
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
  createText("SOCIALS", 0x5f7396, { x: 1, y: -1, z: -2 });
  createText("CHART", 0x5f7396, { x: 0, y: 1, z: -1.5 });
  createText("INFO", 0x5f7396, { x: -2.5, y: 1, z: 1.5 });

  // ----- 2D Popup DOM Functions -----

  // Compute the 2D screen position from a 3D object (used for INFO popup)
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
    if (title === "SOCIALS") {
      div.classList.add("popup-socials");
    } else if (title === "INFO") {
      div.classList.add("popup-info");
    } else if (title === "CHART") {
      div.classList.add("popup-chart");
    }
    if (title === "SOCIALS") {
      div.innerHTML = `
        <a href="https://telegram.org" target="_blank" style="color:#5f7396;">
          <img src="/tg.png" alt="Info Image" style="width:80px; height:auto;">
        </a>
        <a href="https://twitter.com" target="_blank" style="color:#5f7396;">
          <img src="/X.png" alt="Info Image" style="width:80px; height:auto;">
        </a>
      `;
    } else if (title === "INFO") {
      div.innerHTML = `
     
        <p>Backed by a community-driven vision, WZD thrives on memes, engagement, and a sprinkle of blockchain sorcery. Whether you're a crypto veteran or a new sorcerer entering the space, Wizard is designed to be fun, fast, and accessible, thanks to Solana’s high-speed, low-fee transactions. <br> CA : 111111111111111111111</p>
    
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

  // Show (or update) the popup DOM element with content and position it appropriately
  function showPopup(title, screenPos) {
    if (!popupDom) {
      popupDom = createPopupDom(title);
      document.body.appendChild(popupDom);
      currentPopupTitle = title;
    } else if (currentPopupTitle !== title) {
      popupDom.innerHTML = "";
      popupDom.classList.remove("popup-socials", "popup-info", "popup-chart");
      if (title === "SOCIALS") {
        popupDom.classList.add("popup-socials");
        popupDom.innerHTML = `
          <a href="https://telegram.org" target="_blank" style="color:#5f7396;">
            <img src="/tg.png" alt="Info Image" style="width:80px; height:auto;">
          </a>
          <a href="https://twitter.com" target="_blank" style="color:#5f7396;">
            <img src="/X.png" alt="Info Image" style="width:80px; height:auto;">
          </a>
        `;
      } else if (title === "INFO") {
        popupDom.classList.add("popup-info");
        popupDom.innerHTML = `
          
          <p>Introducing HedgeShot, the ultimate sniper bot built on Sonic Chain, an Ethereum Layer 2 solution designed for lightning-fast transactions and precision execution. Whether you're hunting for early entries or securing the best exits, this bot ensures seamless, gas-efficient performance on the Sonic Chain network.</p>
          <img src="/textlogo.png" alt="Info Image" style="width:40%; margin:auto;  height:auto;">
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
    // Set fixed positions for SOCIALS and CHART; for INFO, use dynamic positioning.
    if (title === "CHART") {
      popupDom.style.right = "20px";
      popupDom.style.bottom = "20px";
      popupDom.style.left = "";
      popupDom.style.top = "";
    } else if (title === "SOCIALS") {
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
  function animate() {
    requestAnimationFrame(animate);
    // biome-ignore lint/complexity/noForEach: <explanation>
    textObjects.forEach((txt) => txt.lookAt(camera.position));
    controls.update();
    // For desktop, use raycasting on mousemove
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
    // For INFO, update dynamic position continuously.
    if (popupDom && hoveredObject && currentPopupTitle === "INFO") {
      const screenPos = getScreenPosition(hoveredObject, camera);
      popupDom.style.left = `${screenPos.x}px`;
      popupDom.style.top = `${screenPos.y + 20}px`;
    }
    renderer.render(scene, camera);
  }
  animate();
});

// ----- Handle Window Resizing -----
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
