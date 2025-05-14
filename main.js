const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');

let scene, camera, renderer, cube, cornerMarkers = [], draggingCornerIndex = -1, isPinching = false;
let previousLeftFistX = null;
let previousLeftFistY = null;
let isLeftFist = false;
let activeColor = '#ff00ff';
let pinchThreshold = 0.045;

function initThree() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 4;

  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('three-canvas').appendChild(renderer.domElement);

  createCube();
  animate();
}

function createCube() {
  if (cube) scene.remove(cube);
  scene.children = scene.children.filter(child => child.name !== 'filledCube');

  if (cornerMarkers.length > 0) {
    const vertices = new Float32Array(cornerMarkers.map(m => m.position).flatMap(v => [v.x, v.y, v.z]));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex([
      0, 1, 3, 0, 3, 2,
      1, 5, 7, 1, 7, 3,
      5, 4, 6, 5, 6, 7,
      4, 0, 2, 4, 2, 6,
      2, 3, 7, 2, 7, 6,
      4, 5, 1, 4, 1, 0
    ]);

    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(activeColor),
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });

    const filledCube = new THREE.Mesh(geometry, material);
    filledCube.name = 'filledCube';
    scene.add(filledCube);

    const wireMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    cube = new THREE.Mesh(geometry, wireMaterial);
    scene.add(cube);
  } else {
    const cubeSize = 2;
    const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(activeColor),
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });

    const filledCube = new THREE.Mesh(geometry, material);
    filledCube.name = 'filledCube';
    scene.add(filledCube);

    const wireMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    cube = new THREE.Mesh(geometry, wireMaterial);
    scene.add(cube);

    const half = cubeSize / 2;
    const corners = [
      [-half, -half, -half], [ half, -half, -half],
      [-half,  half, -half], [ half,  half, -half],
      [-half, -half,  half], [ half, -half,  half],
      [-half,  half,  half], [ half,  half,  half],
    ];

    const markerGeo = new THREE.SphereGeometry(0.12, 16, 16);
    corners.forEach(([x, y, z]) => {
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xfffed6 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(x, y, z);
      marker.userData.originalColor = 0xfffed6;
      scene.add(marker);
      cornerMarkers.push(marker);
    });
  }
}

function drawColorPickerWheel() {
    const canvas = document.getElementById('color-picker-canvas');
    const ctx = canvas.getContext('2d');
    const radius = canvas.width / 2;
    const toRad = Math.PI / 180;

    for (let angle = 0; angle < 360; angle++) {
        ctx.beginPath();
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius, angle * toRad, (angle + 1) * toRad);
        ctx.closePath();
        ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
        ctx.fill();
    }
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

function updateCanvasSize() {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function isHoveringColorControl(x, y) {
  const rect = document.getElementById('color-control').getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function detectDrag(handLandmarks) {
  const indexTip = handLandmarks[8];
  const thumbTip = handLandmarks[4];

  const screenX = (1 - indexTip.x) * window.innerWidth;
  const screenY = indexTip.y * window.innerHeight;

  const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);

    const colorCanvas = document.getElementById('color-picker-canvas');
    const colorRect = colorCanvas.getBoundingClientRect();
    const inColorPicker = screenX >= colorRect.left && screenX <= colorRect.right &&
                        screenY >= colorRect.top && screenY <= colorRect.bottom;

    if (inColorPicker && pinchDist < pinchThreshold) {
    const localX = screenX - colorRect.left;
    const localY = screenY - colorRect.top;
    const ctx = colorCanvas.getContext('2d');
    const pixel = ctx.getImageData(localX, localY, 1, 1).data;
    const hex = `#${[pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;
    activeColor = hex;
    createCube();
    }

  let hoveringIndex = -1;
  for (let i = 0; i < cornerMarkers.length; i++) {
    const marker = cornerMarkers[i];
    const projected = marker.position.clone().project(camera);
    const markerX = (projected.x + 1) / 2 * window.innerWidth;
    const markerY = (1 - projected.y) / 2 * window.innerHeight;
    const dist = Math.hypot(screenX - markerX, screenY - markerY);
    if (dist < 40) {
      hoveringIndex = i;
      marker.material.color.set(0xff9700);
    } else {
      marker.material.color.set(marker.userData.originalColor);
    }
  }

  const isCurrentlyPinching = pinchDist < pinchThreshold;
  if (draggingCornerIndex === -1 && isCurrentlyPinching && hoveringIndex !== -1) {
    draggingCornerIndex = hoveringIndex;
  }

  if (draggingCornerIndex !== -1 && isCurrentlyPinching) {
    const marker = cornerMarkers[draggingCornerIndex];
    const projected = marker.position.clone().project(camera);
    const originalZ = projected.z;

    const ndcX = (screenX / window.innerWidth) * 2 - 1;
    const ndcY = -(screenY / window.innerHeight) * 2 + 1;

    const newPosition = new THREE.Vector3(ndcX, ndcY, originalZ).unproject(camera);
    marker.position.copy(newPosition);
    createCube();
  }

  if (!isCurrentlyPinching && isPinching) {
    draggingCornerIndex = -1;
  }

  isPinching = isCurrentlyPinching;
}

function isFist(landmarks) {
  const fingers = [[8, 6], [12, 10], [16, 14], [20, 18]];
  return fingers.every(([tip, pip]) => landmarks[tip].y > landmarks[pip].y);
}

function drawLandmarks(hands) {
  hands.forEach(landmarks => {
    for (const landmark of landmarks) {
      const x = landmark.x * canvasElement.width;
      const y = landmark.y * canvasElement.height;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 5, 0, 2 * Math.PI);
      canvasCtx.fillStyle = 'cyan';
      canvasCtx.fill();
    }
  });
}

async function initWebcam() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  videoElement.srcObject = stream;
  return new Promise(resolve => videoElement.onloadedmetadata = () => resolve());
}

async function main() {
  await initWebcam();
  initThree();
  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);
  drawColorPickerWheel();

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.5
  });

  hands.onResults((results) => {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    const handsLandmarks = results.multiHandLandmarks;
    if (!handsLandmarks || handsLandmarks.length === 0) {
      draggingCornerIndex = -1;
      previousLeftFistX = null;
      cornerMarkers.forEach(marker => marker.material.color.set(marker.userData.originalColor));
      return;
    }

    drawLandmarks(handsLandmarks);

    let rightHand = null, leftHand = null;
    if (results.multiHandedness.length === 2) {
      results.multiHandedness.forEach((handedness, i) => {
        if (handedness.label === 'Right') leftHand = handsLandmarks[i];
        else rightHand = handsLandmarks[i];
      });
    } else if (results.multiHandedness.length === 1) {
      if (results.multiHandedness[0].label === 'Right') leftHand = handsLandmarks[0];
      else rightHand = handsLandmarks[0];
    }

    if (rightHand) {
      detectDrag(rightHand);
    } else {
      draggingCornerIndex = -1;
      cornerMarkers.forEach(marker => marker.material.color.set(marker.userData.originalColor));
    }

    if (leftHand && isFist(leftHand)) {
      isLeftFist = true;
      const x = (1 - leftHand[9].x) * window.innerWidth;
      const y = leftHand[9].y * window.innerHeight;

      if (previousLeftFistX !== null && previousLeftFistY !== null) {
        const deltaX = x - previousLeftFistX;
        const deltaY = y - previousLeftFistY;

        const radius = camera.position.length();
        const theta = Math.atan2(camera.position.x, camera.position.z) + deltaX * -0.005;
        const phi = Math.atan2(camera.position.y, Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2)) - deltaY * -0.005;
        const clampedPhi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, phi));

        camera.position.x = radius * Math.sin(theta) * Math.cos(clampedPhi);
        camera.position.z = radius * Math.cos(theta) * Math.cos(clampedPhi);
        camera.position.y = radius * Math.sin(clampedPhi);
        camera.lookAt(0, 0, 0);
      }

      previousLeftFistX = x;
      previousLeftFistY = y;
    } else {
      isLeftFist = false;
      previousLeftFistX = null;
      previousLeftFistY = null;
    }
  });

  const cam = new Camera(videoElement, {
    onFrame: async () => await hands.send({ image: videoElement }),
    width: 1280,
    height: 960,
  });
  cam.start();
}

main();