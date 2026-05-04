// --- CORE RENDERING & INIT ---

let moveState = { forward: false, backward: false, left: false, right: false };

function init3D() {
    let container = document.getElementById('canvas-container');
    if (!container) return; 

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" }); 
    renderer.setPixelRatio(window.devicePixelRatio); 
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9; 
    container.appendChild(renderer.domElement);

    try {
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        scene.environment = pmremGenerator.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    } catch (e) { }

    ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -25; dirLight.shadow.camera.right = 25;
    dirLight.shadow.camera.top = 25; dirLight.shadow.camera.bottom = -25;
    dirLight.shadow.bias = -0.0005; 
    scene.add(dirLight);

    try {
        const renderScene = new THREE.RenderPass(scene, camera);
        const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 2.0; bloomPass.strength = 1.2; bloomPass.radius = 0.5;
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(renderScene); composer.addPass(bloomPass);
    } catch(e) { composer = null; }

    // Removed the default OrbitControls key binding so WASD works for walking!
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let timeEl = document.getElementById('timeOfDay');
    if (timeEl) {
        let now = new Date();
        timeEl.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    }

    buildRoom();
    updateLighting(); 

    let urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has('room')) {
        try { loadState(JSON.parse(atob(urlParams.get('room')))); } 
        catch(e) { loadRoom(); }
    } else {
        loadRoom();
    }

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);

    // --- VIDEO GAME MOVEMENT & SHORTCUTS ---
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        
        // Video Game Walking
        if(e.code === 'KeyW') moveState.forward = true;
        if(e.code === 'KeyS') moveState.backward = true;
        if(e.code === 'KeyA') moveState.left = true;
        if(e.code === 'KeyD') moveState.right = true;

        // Editor Shortcuts
        if (e.code === 'Delete' || e.code === 'Backspace') deleteSelected();
        if (e.code === 'KeyR') rotateSelected();
        if (e.code === 'KeyC') duplicateSelected();
    });

    window.addEventListener('keyup', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
        if(e.code === 'KeyW') moveState.forward = false;
        if(e.code === 'KeyS') moveState.backward = false;
        if(e.code === 'KeyA') moveState.left = false;
        if(e.code === 'KeyD') moveState.right = false;
    });
}

function updateLighting() {
    let timeEl = document.getElementById('timeOfDay');
    let timeStr = timeEl ? timeEl.value : "12:00";
    let parts = timeStr.split(':');
    let decimalTime = parseInt(parts[0]) + (parseInt(parts[1]) / 60);

    if (decimalTime < 6 || decimalTime > 18) {
        scene.background = new THREE.Color('#0f1015'); 
        dirLight.intensity = 0.05; ambientLight.intensity = 0.1;
    } else {
        let angle = ((decimalTime - 6) / 12) * Math.PI;
        dirLight.position.set(Math.cos(angle) * -30, Math.sin(angle) * 30, 10);
        scene.background = new THREE.Color(decimalTime < 8 || decimalTime > 16 ? '#ff9a9e' : '#87CEEB');
        dirLight.intensity = 1.2; ambientLight.intensity = 0.4;
    }
}

function onWindowResize() { 
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); 
        renderer.setSize(window.innerWidth, window.innerHeight); 
        if (composer) composer.setSize(window.innerWidth, window.innerHeight); 
    }
}

function animate() {
    requestAnimationFrame(animate); 
    
    // Process WASD Video Game Movement First
    if (camera && controls && (moveState.forward || moveState.backward || moveState.left || moveState.right)) {
        let speed = 0.4;
        
        let forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0; // Forces movement strictly along the flat ground plane!
        if (forward.lengthSq() > 0.0001) forward.normalize();

        let right = new THREE.Vector3();
        right.crossVectors(camera.up, forward).normalize();

        if (moveState.forward) {
            camera.position.addScaledVector(forward, speed);
            controls.target.addScaledVector(forward, speed);
        }
        if (moveState.backward) {
            camera.position.addScaledVector(forward, -speed);
            controls.target.addScaledVector(forward, -speed);
        }
        if (moveState.left) {
            camera.position.addScaledVector(right, speed);
            controls.target.addScaledVector(right, speed);
        }
        if (moveState.right) {
            camera.position.addScaledVector(right, -speed);
            controls.target.addScaledVector(right, -speed);
        }
    }

    if (controls) controls.update(); 
    
    furniture.forEach(f => {
        if (f.userData && f.userData.name === 'Ceiling Fan' && f.children) {
            let blades = f.children.find(c => c.userData && c.userData.isFan);
            if (blades) blades.rotation.y += 0.05; 
        }
        if (f.children) {
            f.children.forEach(c => { 
                if (c.isMesh && c.material) {
                    let mat = Array.isArray(c.material) ? c.material[0] : c.material;
                    if (mat && mat.emissive) {
                        if (c.userData && c.userData.isBulb) mat.emissive.setHex(f === selectedItem ? 0xffffff : 0xffddaa);
                        else if (f === selectedItem && !mat.transparent) mat.emissive.setHex(0x333333); 
                        else mat.emissive.setHex(0x000000);
                    }
                }
            });
        }
    });
    
    if (composer) composer.render(); else if (renderer && scene && camera) renderer.render(scene, camera);
}

// Start Engine
init3D();
animate();