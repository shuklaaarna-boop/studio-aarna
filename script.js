let furniture = [];
let historyStack = [];
let redoStack = [];
let isTimeTraveling = false; 
let customFloorTexture = null; 

let scene, camera, renderer, controls;
let floorMesh, gridHelper, wallsGroup;
let dirLight, ambientLight; 
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let selectedItem = null;
let draggingItem = null;
let dragOffset = new THREE.Vector3();
let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); 

init3D();
animate();

function init3D() {
    let container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#1e1e26');

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 15, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); 
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    
    dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048; 
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -20;
    dirLight.shadow.camera.right = 20;
    dirLight.shadow.camera.top = 20;
    dirLight.shadow.camera.bottom = -20;
    dirLight.shadow.bias = -0.0005; 
    scene.add(dirLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let now = new Date();
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('timeOfDay').value = `${hh}:${mm}`;

    buildRoom();
    updateLighting(); 

    window.addEventListener('resize', onWindowResize);
    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') rotateSelected();
        if (e.key === 'c' || e.key === 'C') duplicateSelected();
        if (e.key === 'Backspace' || e.key === 'Delete') deleteSelected();
    });
}

function updateLighting() {
    let timeStr = document.getElementById('timeOfDay').value;
    if(!timeStr) timeStr = "12:00";
    let parts = timeStr.split(':');
    let decimalTime = parseInt(parts[0]) + (parseInt(parts[1])/60);

    if (decimalTime < 6 || decimalTime > 18) {
        scene.background = new THREE.Color('#0b0f19'); 
        dirLight.intensity = 0.1;
        dirLight.color.setHex(0x5555aa); 
        ambientLight.intensity = 0.1; 
        ambientLight.color.setHex(0x333344);
        dirLight.position.set(10, 20, 10);
    } else {
        let angle = ((decimalTime - 6) / 12) * Math.PI;
        let sunRadius = 30;
        dirLight.position.set(Math.cos(angle) * -sunRadius, Math.sin(angle) * sunRadius, 10);
        
        if (decimalTime < 8 || decimalTime > 16) {
            scene.background = new THREE.Color('#fd5e53'); 
            dirLight.intensity = 0.8;
            dirLight.color.setHex(0xffdab9); 
            ambientLight.intensity = 0.4;
            ambientLight.color.setHex(0xffffff);
        } else {
            scene.background = new THREE.Color('#87CEEB'); 
            dirLight.intensity = 1.0;
            dirLight.color.setHex(0xffffff); 
            ambientLight.intensity = 0.6;
            ambientLight.color.setHex(0xffffff);
        }
    }
}

function createFloorTexture(style) {
    let canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    let ctx = canvas.getContext('2d');
    
    if (style === 'wood') {
        ctx.fillStyle = '#8B5A2B'; ctx.fillRect(0,0,512,512);
        ctx.fillStyle = '#6B4226';
        for(let i=0; i<512; i+=32) { ctx.fillRect(0, i, 512, 4); }
    } else if (style === 'carpet') {
        ctx.fillStyle = '#95a5a6'; ctx.fillRect(0,0,512,512);
        for(let i=0; i<15000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#bdc3c7' : '#7f8c8d';
            ctx.fillRect(Math.random()*512, Math.random()*512, 3, 3);
        }
    } else if (style === 'tile') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,512,512);
        ctx.fillStyle = '#dcdde1';
        for(let i=0; i<4; i++) {
            for(let j=0; j<4; j++) { if ((i+j)%2===0) ctx.fillRect(i*128, j*128, 128, 128); }
        }
    } else {
        ctx.fillStyle = '#eeeeee'; ctx.fillRect(0,0,512,512);
    }
    
    let tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    let w = parseFloat(document.getElementById('roomWidth').value) || 12;
    let l = parseFloat(document.getElementById('roomLength').value) || 10;
    tex.repeat.set(w/4, l/4); 
    return tex;
}

function applyFloorTexture(event) {
    let file = event.target.files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            let texture = new THREE.TextureLoader().load(e.target.result);
            texture.wrapS = THREE.RepeatWrapping; 
            texture.wrapT = THREE.RepeatWrapping;
            let w = parseFloat(document.getElementById('roomWidth').value) || 12;
            let l = parseFloat(document.getElementById('roomLength').value) || 10;
            texture.repeat.set(w/4, l/4); 

            customFloorTexture = texture;
            floorMesh.material.map = customFloorTexture;
            floorMesh.material.needsUpdate = true;
            
            document.getElementById('customFloorOption').style.display = 'block';
            document.getElementById('floorStyle').value = 'custom';
            saveState();
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function createTextSprite(text) {
    let canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    let ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    let texture = new THREE.CanvasTexture(canvas);
    let spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    let sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.5, 1.5, 1);
    return sprite;
}

function updateWalls() {
    if (wallsGroup) scene.remove(wallsGroup);
    wallsGroup = new THREE.Group();

    let wColor = document.getElementById('wallColor') ? document.getElementById('wallColor').value : '#3a404d';
    let wOpacity = document.getElementById('wallOpacity') ? parseFloat(document.getElementById('wallOpacity').value) : 0.9;
    let wallMat = new THREE.MeshStandardMaterial({ color: wColor, side: THREE.FrontSide, transparent: wOpacity < 1, opacity: wOpacity });
    wallMat.shadowSide = THREE.DoubleSide;

    let w = parseFloat(document.getElementById('roomWidth').value) || 12;
    let l = parseFloat(document.getElementById('roomLength').value) || 10;
    let wallH = 8;

    function makeWall(width, height, isXWall, sign) {
        let shape = new THREE.Shape();
        shape.moveTo(-width/2, 0);
        shape.lineTo(width/2, 0);
        shape.lineTo(width/2, height);
        shape.lineTo(-width/2, height);
        shape.lineTo(-width/2, 0);

        for (let item of furniture) {
            let name = item.userData.name;
            if (name.includes('Door') || name === 'Window') {
                let ix = item.position.x;
                let iy = item.position.y;
                let iz = item.position.z;
                let iw = item.userData.w;
                let ih = item.userData.h;

                let rotY = Math.abs(item.rotation.y);
                let isFacingZ = rotY < 0.1 || Math.abs(rotY - Math.PI) < 0.1; 
                let isFacingX = Math.abs(rotY - Math.PI/2) < 0.1;

                let onThisWall = false;
                let localX = 0;

                if (isXWall) {
                    if (Math.abs(iz - sign * l/2) < 0.5 && isFacingZ) {
                        onThisWall = true;
                        localX = sign === -1 ? ix : -ix;
                    }
                } else {
                    if (Math.abs(ix - sign * w/2) < 0.5 && isFacingX) {
                        onThisWall = true;
                        localX = sign === -1 ? -iz : iz;
                    }
                }

                if (onThisWall) {
                    let hole = new THREE.Path();
                    let hw = iw / 2;
                    let bottom = iy;
                    let top = iy + ih;

                    let hLeft = Math.max(-width/2, localX - hw);
                    let hRight = Math.min(width/2, localX + hw);
                    let hBot = Math.max(0, bottom);
                    let hTop = Math.min(height, top);

                    if (hRight > hLeft && hTop > hBot) {
                        hole.moveTo(hLeft, hBot);
                        hole.lineTo(hLeft, hTop);
                        hole.lineTo(hRight, hTop);
                        hole.lineTo(hRight, hBot);
                        hole.lineTo(hLeft, hBot);
                        shape.holes.push(hole);
                    }
                }
            }
        }
        let geo = new THREE.ShapeGeometry(shape);
        let mesh = new THREE.Mesh(geo, wallMat);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        return mesh;
    }

    let wB = makeWall(w, wallH, true, -1); wB.position.set(0, 0, -l/2); wallsGroup.add(wB);
    let wF = makeWall(w, wallH, true, 1); wF.position.set(0, 0, l/2); wF.rotation.y = Math.PI; wallsGroup.add(wF);
    let wL = makeWall(l, wallH, false, -1); wL.position.set(-w/2, 0, 0); wL.rotation.y = Math.PI / 2; wallsGroup.add(wL);
    let wR = makeWall(l, wallH, false, 1); wR.position.set(w/2, 0, 0); wR.rotation.y = -Math.PI / 2; wallsGroup.add(wR);

    scene.add(wallsGroup);
}

function buildRoom() {
    if (floorMesh) scene.remove(floorMesh);
    if (gridHelper) scene.remove(gridHelper);

    let w = parseFloat(document.getElementById('roomWidth').value) || 12;
    let l = parseFloat(document.getElementById('roomLength').value) || 10;
    let style = document.getElementById('floorStyle').value;

    let floorGeo = new THREE.PlaneGeometry(w, l);
    let floorMat;
    
    if (style === 'custom' && customFloorTexture) {
        floorMat = new THREE.MeshStandardMaterial({ map: customFloorTexture, roughness: 0.8 });
    } else {
        floorMat = new THREE.MeshStandardMaterial({ map: createFloorTexture(style), roughness: 0.8 });
    }

    floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2; 
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    gridHelper = new THREE.Group();
    let lineMat = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.4 });
    for (let x = 0; x <= w/2; x++) {
        gridHelper.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, -l/2), new THREE.Vector3(x, 0, l/2)]), lineMat));
        gridHelper.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-x, 0, -l/2), new THREE.Vector3(-x, 0, l/2)]), lineMat));
    }
    for (let z = 0; z <= l/2; z++) {
        gridHelper.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-w/2, 0, z), new THREE.Vector3(w/2, 0, z)]), lineMat));
        gridHelper.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-w/2, 0, -z), new THREE.Vector3(w/2, 0, -z)]), lineMat));
    }
    
    let borderMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
    let borderGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-w/2, 0, -l/2), new THREE.Vector3(w/2, 0, -l/2),
        new THREE.Vector3(w/2, 0, l/2), new THREE.Vector3(-w/2, 0, l/2), new THREE.Vector3(-w/2, 0, -l/2) 
    ]);
    gridHelper.add(new THREE.Line(borderGeo, borderMat));
    
    for (let i = 0; i <= w; i++) {
        let s1 = createTextSprite(i + "'"); s1.position.set(-w/2 + i, 0.2, l/2 + 0.5); gridHelper.add(s1);
    }
    for (let j = 0; j <= l; j++) {
        let s2 = createTextSprite(j + "'"); s2.position.set(w/2 + 0.5, 0.2, -l/2 + j); gridHelper.add(s2);
    }
    gridHelper.position.y = 0.01; 
    scene.add(gridHelper);

    updateWalls(); 
}

function updateRoom() { buildRoom(); }

function getSpawnPosition(itemW, itemL, isGhost) {
    if (isGhost) return {x: 0, z: 0}; 

    let w = parseFloat(document.getElementById('roomWidth').value) || 12;
    let l = parseFloat(document.getElementById('roomLength').value) || 10;
    
    for (let x = -w/2 + itemW/2; x <= w/2 - itemW/2; x += 1) {
        for (let z = -l/2 + itemL/2; z <= l/2 - itemL/2; z += 1) {
            let testBox = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(x, 2, z), new THREE.Vector3(itemW - 0.2, 4, itemL - 0.2)
            );
            let overlap = false;
            for (let other of furniture) {
                if (other.userData.isGhost) continue;
                let otherBox = new THREE.Box3().setFromObject(other);
                if (testBox.intersectsBox(otherBox)) { overlap = true; break; }
            }
            if (!overlap) return {x: x, z: z};
        }
    }
    return null; 
}

// --- NEW V3.4: OPEN/CLOSE DOOR LOGIC & HINGES ---
function addItem(itemName, itemW, itemH, itemL, itemColor, isGhost = false, startX = null, startZ = null, startRot = 0, startY = null, isOpen = false) {
    if (!isTimeTraveling) saveState(); 

    if (startX === null || startZ === null) {
        let spot = getSpawnPosition(itemW, itemL, isGhost);
        if (!spot) {
            showError("Whoops! The room is too full to fit the " + itemName + ".");
            historyStack.pop(); 
            return;
        }
        startX = spot.x;
        startZ = spot.z;
    }

    if (startY === null) {
        startY = (itemName === 'Poster' || itemName === 'Window' || itemName === 'Wall Light') ? 3 : 0;
        if (itemName === 'Ceiling Fan') startY = 8 - itemH; 
    }

    let group = new THREE.Group();
    // Track isOpen state!
    group.userData = { name: itemName, w: itemW, h: itemH, l: itemL, color: itemColor, isGhost: isGhost, isFurniture: true, isOpen: isOpen };
    let mainMat = new THREE.MeshStandardMaterial({ color: itemColor, roughness: 0.7 });

    if (itemName === 'Bed') {
        let base = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH * 0.4, itemL), new THREE.MeshStandardMaterial({ color: '#5C4033' }));
        base.position.y = (itemH * 0.4) / 2; base.castShadow = true; group.add(base);
        
        let mattress = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.95, itemH * 0.4, itemL * 0.95), mainMat);
        mattress.position.y = (itemH * 0.4) + (itemH * 0.4) / 2; mattress.castShadow = true; group.add(mattress);

        let headboard = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, 0.2), new THREE.MeshStandardMaterial({ color: '#5C4033' }));
        headboard.position.set(0, itemH / 2, -itemL/2 + 0.1); headboard.castShadow = true; group.add(headboard);

        let pillowMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
        let p1 = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.4, 0.15, 0.4), pillowMat);
        p1.position.set(-itemW/4, itemH*0.8 + 0.075, -itemL/2 + 0.4); p1.castShadow = true; group.add(p1);
        let p2 = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.4, 0.15, 0.4), pillowMat);
        p2.position.set(itemW/4, itemH*0.8 + 0.075, -itemL/2 + 0.4); p2.castShadow = true; group.add(p2);

    } else if (itemName === 'Sofa') {
        let base = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH * 0.4, itemL), mainMat);
        base.position.y = (itemH * 0.4)/2; base.castShadow = true; group.add(base);
        let back = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, itemL * 0.3), mainMat);
        back.position.set(0, itemH/2, -itemL/2 + (itemL*0.3)/2); back.castShadow = true; group.add(back);
        let arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, itemH * 0.7, itemL), mainMat);
        arm1.position.set(-itemW/2 + 0.25, (itemH*0.7)/2, 0); arm1.castShadow = true; group.add(arm1);
        let arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, itemH * 0.7, itemL), mainMat);
        arm2.position.set(itemW/2 - 0.25, (itemH*0.7)/2, 0); arm2.castShadow = true; group.add(arm2);

    } else if (itemName === 'Bookshelf') {
        let woodMat = new THREE.MeshStandardMaterial({ color: '#5C4033' });
        let left = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH, itemL), woodMat);
        left.position.set(-itemW/2 + 0.05, itemH/2, 0); left.castShadow = true; group.add(left);
        let right = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH, itemL), woodMat);
        right.position.set(itemW/2 - 0.05, itemH/2, 0); right.castShadow = true; group.add(right);
        for(let i=0; i<=5; i++) {
            let shelf = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, itemL), woodMat);
            shelf.position.y = (i * (itemH/5)) + (i===0 ? 0.05 : i===5 ? -0.05 : 0); 
            shelf.castShadow = true; group.add(shelf);
        }

    } else if (itemName === 'TV Stand') {
        let base = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH*0.4, itemL), new THREE.MeshStandardMaterial({ color: '#5C4033' }));
        base.position.y = (itemH*0.4)/2; base.castShadow = true; group.add(base);
        let tv = new THREE.Mesh(new THREE.BoxGeometry(itemW*0.9, itemH*0.6, 0.1), new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.1 }));
        tv.position.set(0, (itemH*0.4) + (itemH*0.6)/2 + 0.1, 0); tv.castShadow = true; group.add(tv);

    } else if (itemName === 'Desk') {
        let top = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, itemL), mainMat);
        top.position.y = itemH - 0.05; top.castShadow = true; group.add(top);
        let legMat = new THREE.MeshStandardMaterial({ color: '#222222' });
        for(let i of [-1, 1]) {
            for(let j of [-1, 1]) {
                let leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, itemH - 0.1), legMat);
                leg.position.set(i * (itemW/2 - 0.2), (itemH-0.1)/2, j * (itemL/2 - 0.2));
                leg.castShadow = true; group.add(leg);
            }
        }

    } else if (itemName === 'Wall Light') {
        let fixture = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, 0.1), mainMat);
        fixture.position.y = itemH / 2; fixture.castShadow = true; group.add(fixture);
        let bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({emissive: 0xffddaa, emissiveIntensity: 1}));
        bulb.position.set(0, itemH / 2, 0.15); bulb.userData.isBulb = true; group.add(bulb);
        
        let light = new THREE.PointLight(0xffddaa, 1.5, 15);
        light.position.set(0, itemH / 2, 0.2); light.castShadow = true; group.add(light);

    } else if (itemName === 'Ceiling Fan') {
        let pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8), mainMat);
        pole.position.y = itemH - 0.4; pole.castShadow = true; group.add(pole);
        let motor = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2), mainMat);
        motor.position.y = itemH - 0.8; motor.castShadow = true; group.add(motor);

        let blades = new THREE.Group();
        for(let i=0; i<4; i++) {
            let blade = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.2), new THREE.MeshStandardMaterial({color: '#5C4033'}));
            blade.position.set(0.7, 0, 0); blade.castShadow = true;
            let pivot = new THREE.Group();
            pivot.rotation.y = (Math.PI / 2) * i;
            pivot.add(blade); blades.add(pivot);
        }
        blades.position.y = itemH - 0.8;
        group.add(blades);
        group.userData.isFan = true;

        let bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshStandardMaterial({emissive: 0xffddaa, emissiveIntensity: 1}));
        bulb.position.y = itemH - 0.95; bulb.userData.isBulb = true; group.add(bulb);
        let light = new THREE.PointLight(0xffddaa, 1, 20);
        light.position.y = itemH - 1.0; light.castShadow = true; group.add(light);

    } else if (itemName === 'Window') {
        let fMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
        let gMat = new THREE.MeshStandardMaterial({ color: '#85c1e9', transparent: true, opacity: 0.4 });
        let glass = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, 0.1), gMat);
        glass.position.y = itemH / 2; group.add(glass);
        let vBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH, 0.15), fMat);
        vBar.position.y = itemH / 2; group.add(vBar);
        let hBar = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, 0.15), fMat);
        hBar.position.y = itemH / 2; group.add(hBar);

    // --- NEW V3.4: HINGED WOOD DOORS & SLIDING GLASS DOORS ---
    } else if (itemName === 'Balcony Door' || itemName === 'Door') {
        let mat = itemName === 'Door' ? mainMat : new THREE.MeshStandardMaterial({ color: itemColor, transparent: true, opacity: 0.6 });
        
        let geo = new THREE.BoxGeometry(itemW, itemH, itemL);
        if (itemName === 'Door') {
            geo.translate(itemW/2, 0, 0); // Shift origin to create a mechanical hinge on left side!
        }
        
        let mesh = new THREE.Mesh(geo, mat);
        if (itemName === 'Door') {
            mesh.position.set(-itemW/2, itemH / 2, 0); // Shift mesh back to center inside the group
        } else {
            mesh.position.y = itemH / 2;
        }
        
        mesh.castShadow = true; 
        mesh.userData.isDoorMesh = true; // Tag it so we can find it when clicking toggle!
        group.add(mesh);
        
    } else if (itemName === 'Curtains') {
        let geo = new THREE.PlaneGeometry(itemW, itemH, 32, 1); 
        let pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let x = pos.getX(i);
            pos.setZ(i, Math.sin(x * 10) * 0.15); 
        }
        geo.computeVertexNormals(); 
        let curtainMat = new THREE.MeshStandardMaterial({ color: itemColor, side: THREE.DoubleSide, roughness: 0.9 });
        let mesh = new THREE.Mesh(geo, curtainMat);
        mesh.position.y = itemH / 2; mesh.castShadow = true; group.add(mesh);
        
        let rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, itemW + 0.4), new THREE.MeshStandardMaterial({color: '#222'}));
        rod.rotation.z = Math.PI / 2; rod.position.y = itemH - 0.1; group.add(rod);
        
    } else if (itemName === 'Poster') {
        let mesh = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, 0.05), mainMat);
        mesh.position.y = itemH / 2; mesh.castShadow = true; group.add(mesh);

    } else {
        let mesh = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, itemL), mainMat);
        mesh.position.y = itemH / 2; mesh.castShadow = true; group.add(mesh);
    }

// Restore Open State if loading from save!
    if (isOpen && (itemName === 'Door' || itemName === 'Balcony Door')) {
        let doorMesh = group.children.find(c => c.userData.isDoorMesh);
        if (doorMesh) {
            // FIX: Match the inward swing for saved files
            if (itemName === 'Door') doorMesh.rotation.y = -Math.PI / 2; 
            if (itemName === 'Balcony Door') doorMesh.position.x = itemW * 0.9; 
        }
    }

    group.position.set(startX, startY, startZ);
    group.rotation.y = startRot;
    scene.add(group);
    furniture.push(group);
    
    updateWalls(); // Updates holes if it was a window/door
}

// NEW V3.4: TOGGLE DOOR FUNCTION
function toggleDoor() {
    if (!selectedItem || !selectedItem.userData.name.includes('Door')) return;
    
    selectedItem.userData.isOpen = !selectedItem.userData.isOpen;
    let isOpen = selectedItem.userData.isOpen;
    let name = selectedItem.userData.name;
    let w = selectedItem.userData.w;
    
    let doorMesh = selectedItem.children.find(c => c.userData.isDoorMesh);
    if (doorMesh) {
        if (name === 'Door') {
            // FIX: Negative PI/2 swings the door toward the +Z axis (Inside the room!)
            doorMesh.rotation.y = isOpen ? -Math.PI / 2 : 0; 
        } else if (name === 'Balcony Door') {
            doorMesh.position.x = isOpen ? w * 0.9 : 0; // Slide alongside wall
        }
    }
    
    saveState();
    updateInspectorUI(); // Update text on the button
}

function addBalcony() {
    if (!isTimeTraveling) saveState();
    let mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 4), new THREE.MeshStandardMaterial({ color: '#bdc3c7' }));
    let w = parseFloat(document.getElementById('roomWidth').value) || 12;
    mesh.position.set(-(w/2) - 2, 0.1, 0); 
    mesh.userData = { name: "Balcony", w: 10, h: 0.2, l: 4, isGhost: true, isFurniture: true };
    mesh.receiveShadow = true;
    scene.add(mesh); furniture.push(mesh);
}

function onPointerDown(event) {
    let container = document.getElementById('canvas-container');
    let rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    let intersects = raycaster.intersectObjects(furniture, true); 

    if (intersects.length > 0) {
        let clickedObj = intersects[0].object;
        while(clickedObj.parent && !clickedObj.userData.isFurniture) clickedObj = clickedObj.parent;
        if(clickedObj.userData && clickedObj.userData.isFurniture) {
            saveState(); 
            controls.enabled = false; 
            draggingItem = clickedObj;
            selectedItem = draggingItem;
            
            plane.constant = -draggingItem.position.y;
            raycaster.ray.intersectPlane(plane, dragOffset);
            dragOffset.sub(draggingItem.position);
            
            updateInspectorUI();
        }
    } else {
        selectedItem = null;
        document.getElementById('inspector').style.display = 'none';
    }
}

function onPointerMove(event) {
    if (!draggingItem) return;

    let container = document.getElementById('canvas-container');
    let rect = container.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    let target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    
    if (target) {
        let newX = target.x - dragOffset.x;
        let newZ = target.z - dragOffset.z;
        let canMove = true;
        let w = parseFloat(document.getElementById('roomWidth').value) || 12;
        let l = parseFloat(document.getElementById('roomLength').value) || 10;
        let name = draggingItem.userData.name;

        if (name.includes('Door') || name === 'Poster' || name === 'Window' || name === 'Wall Light') {
            let distLeft = Math.abs(newX - (-w/2));
            let distRight = Math.abs(newX - (w/2));
            let distBack = Math.abs(newZ - (-l/2));
            let distFront = Math.abs(newZ - (l/2));
            
            if (camera.position.x <= -w/2) distLeft = Infinity;
            if (camera.position.x >= w/2) distRight = Infinity;
            if (camera.position.z <= -l/2) distBack = Infinity;
            if (camera.position.z >= l/2) distFront = Infinity;

            let minDist = Math.min(distLeft, distRight, distBack, distFront);
            let offset = (name === 'Poster' || name === 'Window' || name === 'Wall Light') ? 0.05 : 0;
            
            // FIX: Calculate padding so the edge of the item stops at the corner!
            let pad = draggingItem.userData.w / 2;

            if (minDist === distLeft) { 
                newX = -w/2 + offset; 
                newZ = THREE.MathUtils.clamp(newZ, -l/2 + pad, l/2 - pad); 
                draggingItem.rotation.y = Math.PI / 2; 
            }
            else if (minDist === distRight) { 
                newX = w/2 - offset; 
                newZ = THREE.MathUtils.clamp(newZ, -l/2 + pad, l/2 - pad); 
                draggingItem.rotation.y = -Math.PI / 2; 
            }
            else if (minDist === distBack) { 
                newZ = -l/2 + offset; 
                newX = THREE.MathUtils.clamp(newX, -w/2 + pad, w/2 - pad); 
                draggingItem.rotation.y = 0; 
            }
            else if (minDist === distFront) { 
                newZ = l/2 - offset; 
                newX = THREE.MathUtils.clamp(newX, -w/2 + pad, w/2 - pad); 
                draggingItem.rotation.y = Math.PI; 
            }
        }
        if (!draggingItem.userData.isGhost && !name.includes('Door') && name !== 'Window') { 
            let itemW = draggingItem.userData.w;
            let itemL = draggingItem.userData.l;
            let isRotated = Math.abs(draggingItem.rotation.y) > 0.1;
            let boundX = isRotated ? itemL : itemW;
            let boundZ = isRotated ? itemW : itemL;

            let maxX = (w / 2) - (boundX / 2);
            let maxZ = (l / 2) - (boundZ / 2);

            newX = THREE.MathUtils.clamp(newX, -maxX, maxX);
            newZ = THREE.MathUtils.clamp(newZ, -maxZ, maxZ);

            let oldX = draggingItem.position.x;
            let oldZ = draggingItem.position.z;
            draggingItem.position.set(newX, draggingItem.position.y, newZ);
            draggingItem.updateMatrixWorld();

            let dragBox = new THREE.Box3().setFromObject(draggingItem);
            dragBox.expandByScalar(-0.05); 

            for (let other of furniture) {
                if (other === draggingItem || other.userData.isGhost || other.userData.name.includes('Door') || other.userData.name === 'Window') continue;
                let otherBox = new THREE.Box3().setFromObject(other);
                otherBox.expandByScalar(-0.05);
                if (dragBox.intersectsBox(otherBox)) { canMove = false; break; }
            }
            draggingItem.position.set(oldX, draggingItem.position.y, oldZ);
        }

        if (canMove) {
            draggingItem.position.x = newX;
            draggingItem.position.z = newZ;
        }
    }
}

function onPointerUp() { 
    controls.enabled = true; 
    if (draggingItem && (draggingItem.userData.name.includes('Door') || draggingItem.userData.name === 'Window')) {
        updateWalls();
    }
    draggingItem = null; 
}

function updateInspectorUI() {
    if (selectedItem) {
        document.getElementById('inspector').style.display = 'block';
        document.getElementById('selectedItemName').innerText = selectedItem.userData.name;
        
        let w = selectedItem.userData.w; let h = selectedItem.userData.h; let l = selectedItem.userData.l;
        document.getElementById('editW_ft').value = Math.floor(w); document.getElementById('editW_in').value = Math.round((w % 1) * 12);
        document.getElementById('editH_ft').value = Math.floor(h); document.getElementById('editH_in').value = Math.round((h % 1) * 12);
        document.getElementById('editL_ft').value = Math.floor(l); document.getElementById('editL_in').value = Math.round((l % 1) * 12);

        let e = selectedItem.position.y;
        document.getElementById('editE_ft').value = Math.floor(e);
        document.getElementById('editE_in').value = Math.round((e % 1) * 12);

        if (selectedItem.userData.name === 'Curtains' || selectedItem.userData.name === 'Poster') {
            document.getElementById('btn-texture').style.display = 'block';
            document.getElementById('btn-texture').innerHTML = selectedItem.userData.name === 'Poster' ? '🖼️ Upload Image' : '🖼️ Upload Pattern';
        } else {
            document.getElementById('btn-texture').style.display = 'none';
        }
        
        // NEW V3.4 Show Open/Close toggle if it is a door!
        if (selectedItem.userData.name.includes('Door')) {
            document.getElementById('btn-toggle-door').style.display = 'block';
            document.getElementById('btn-toggle-door').innerText = selectedItem.userData.isOpen ? '🚪 Close Door' : '🚪 Open Door';
        } else {
            document.getElementById('btn-toggle-door').style.display = 'none';
        }
    }
} 

function updateSelectedSize() {
    if (selectedItem) {
        let w_ft = parseFloat(document.getElementById('editW_ft').value) || 0; let w_in = parseFloat(document.getElementById('editW_in').value) || 0;
        let h_ft = parseFloat(document.getElementById('editH_ft').value) || 0; let h_in = parseFloat(document.getElementById('editH_in').value) || 0;
        let l_ft = parseFloat(document.getElementById('editL_ft').value) || 0; let l_in = parseFloat(document.getElementById('editL_in').value) || 0;
        
        let newW = w_ft + (w_in / 12); let newH = h_ft + (h_in / 12); let newL = l_ft + (l_in / 12);

        if (newW > 0 && newH > 0 && newL > 0) {
            saveState(); isTimeTraveling = true; 
            
            let data = selectedItem.userData;
            let oldPos = selectedItem.position.clone(); let oldRot = selectedItem.rotation.clone();
            let oldOpen = selectedItem.userData.isOpen || false; // Pass the open state through!
            
            scene.remove(selectedItem); furniture = furniture.filter(f => f !== selectedItem);
            addItem(data.name, newW, newH, newL, data.color, data.isGhost, oldPos.x, oldPos.z, oldRot.y, oldPos.y, oldOpen);
            
            selectedItem = furniture[furniture.length - 1];
            updateInspectorUI(); isTimeTraveling = false;
        }
    }
}

function updateSelectedElevation() {
    if (selectedItem) {
        let e_ft = parseFloat(document.getElementById('editE_ft').value) || 0;
        let e_in = parseFloat(document.getElementById('editE_in').value) || 0;
        let newE = e_ft + (e_in / 12);
        
        saveState();
        selectedItem.position.y = newE;
        updateWalls(); 
    }
}

function rotateSelected() { if (selectedItem) { saveState(); selectedItem.rotation.y += Math.PI / 2; updateWalls(); } }

function deleteSelected() {
    if (selectedItem) {
        saveState(); scene.remove(selectedItem);
        furniture = furniture.filter(f => f !== selectedItem);
        selectedItem = null; document.getElementById('inspector').style.display = 'none';
        updateWalls();
    }
}

function duplicateSelected() {
    if (selectedItem) {
        saveState();
        let d = selectedItem.userData;
        let oldOpen = selectedItem.userData.isOpen || false;
        addItem(d.name, d.w, d.h, d.l, d.color, d.isGhost, selectedItem.position.x + 1, selectedItem.position.z + 1, selectedItem.rotation.y, selectedItem.position.y, oldOpen);
    }
}

function applyTexture(event) {
    if (!selectedItem || (selectedItem.userData.name !== 'Curtains' && selectedItem.userData.name !== 'Poster')) return;
    
    let file = event.target.files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            let texture = new THREE.TextureLoader().load(e.target.result);
            if (selectedItem.userData.name === 'Curtains') { texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; }
            
            selectedItem.children.forEach(child => {
                if (child.isMesh && child.geometry.type !== "CylinderGeometry") {
                    child.material = child.material.clone();
                    child.material.map = texture;     
                    child.material.color.setHex(0xffffff); 
                    child.material.needsUpdate = true;
                }
            });
            saveState();
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function exportBlueprint() {
    renderer.render(scene, camera); 
    let link = document.createElement('a'); link.download = 'Aarna_3D_Snapshot.png';
    link.href = renderer.domElement.toDataURL('image/png'); link.click();
    showError("3D Snapshot downloaded!");
}

function clearCanvas() { saveState(); for(let f of furniture) { scene.remove(f); } furniture = []; selectedItem = null; document.getElementById('inspector').style.display = 'none'; updateWalls(); }

function getCurrentState() { return furniture.map(f => ({ name: f.userData.name, w: f.userData.w, h: f.userData.h, l: f.userData.l, color: f.userData.color, isGhost: f.userData.isGhost, x: f.position.x, y: f.position.y, z: f.position.z, rot: f.rotation.y, isOpen: f.userData.isOpen || false })); }

function saveState() {
    if (isTimeTraveling) return;
    let currentState = getCurrentState();
    if (historyStack.length > 0) { let lastState = historyStack[historyStack.length - 1]; if (JSON.stringify(lastState) === JSON.stringify(currentState)) return; }
    historyStack.push(currentState);
    if (historyStack.length > 20) historyStack.shift();
    redoStack = [];
}

function loadState(state) {
    isTimeTraveling = true; 
    for(let f of furniture) { scene.remove(f); } furniture = []; selectedItem = null; document.getElementById('inspector').style.display = 'none';
    for(let item of state) { addItem(item.name, item.w, item.h, item.l, item.color, item.isGhost, item.x, item.z, item.rot, item.y, item.isOpen); }
    isTimeTraveling = false;
    updateWalls();
}

function undo() { if (historyStack.length > 0) { redoStack.push(getCurrentState()); loadState(historyStack.pop()); } }
function redo() { if (redoStack.length > 0) { historyStack.push(getCurrentState()); loadState(redoStack.pop()); } }

function showError(msg) { document.getElementById('alert-text').innerText = msg; document.getElementById('custom-alert').style.display = 'block'; }
function closeAlert() { document.getElementById('custom-alert').style.display = 'none'; }

function onWindowResize() { let container = document.getElementById('canvas-container'); camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); }

function animate() {
    requestAnimationFrame(animate); controls.update(); 
    for(let f of furniture) {
        
        if (f.userData.isFan && f.children.length > 2) {
            f.children[2].rotation.y += 0.05; 
        }

        f.children.forEach(child => {
            if (child.isMesh) {
                if (child.userData.isBulb) {
                    child.material.emissive.setHex(f === selectedItem ? 0xffffff : 0xffddaa);
                } else if(f === selectedItem) {
                    child.material.emissive.setHex(0x333333);
                } else {
                    child.material.emissive.setHex(0x000000);
                }
            }
        });
    }
    renderer.render(scene, camera);
}

function saveRoom() {
    let saveFile = {
        width: document.getElementById('roomWidth').value,
        length: document.getElementById('roomLength').value,
        wallColor: document.getElementById('wallColor').value,
        wallOpacity: document.getElementById('wallOpacity').value,
        floorStyle: document.getElementById('floorStyle').value,
        timeOfDay: document.getElementById('timeOfDay').value,
        inventory: getCurrentState()
    };
    localStorage.setItem('aarnaRoomDesign3D', JSON.stringify(saveFile));
    showError("Room saved successfully!");
}

function loadRoom() {
    let savedDataText = localStorage.getItem('aarnaRoomDesign3D');
    if (savedDataText) {
        let saveFile = JSON.parse(savedDataText);
        document.getElementById('roomWidth').value = saveFile.width; document.getElementById('roomLength').value = saveFile.length;
        if (saveFile.wallColor) document.getElementById('wallColor').value = saveFile.wallColor;
        if (saveFile.wallOpacity) document.getElementById('wallOpacity').value = saveFile.wallOpacity;
        if (saveFile.floorStyle) document.getElementById('floorStyle').value = saveFile.floorStyle;
        if (saveFile.timeOfDay) { document.getElementById('timeOfDay').value = saveFile.timeOfDay; updateLighting(); }
        
        buildRoom(); loadState(saveFile.inventory); showError("Room loaded!");
    } else {
        showError("No saved room found.");
    }
}