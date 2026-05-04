// --- PROCEDURAL TEXTURES & FACTORY ---

function createNoiseTexture(size, scaleX, scaleY, intensity) {
    try {
        let canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        let ctx = canvas.getContext('2d');
        if (!ctx) return null; 
        let imgData = ctx.createImageData(size, size);
        for (let i = 0; i < imgData.data.length; i += 4) {
            let val = (Math.random() * 255) * intensity + (255 * (1 - intensity));
            imgData.data[i] = val; imgData.data[i+1] = val; imgData.data[i+2] = val; imgData.data[i+3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
        let tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(scaleX, scaleY);
        return tex;
    } catch(e) { return null; }
}

const plasterBumpMap = createNoiseTexture(512, 3, 3, 0.4);     
const woodBumpMap = createNoiseTexture(512, 1, 20, 0.6);        
const fabricBumpMap = createNoiseTexture(512, 40, 40, 0.5);    
const carpetBumpMap = createNoiseTexture(512, 60, 60, 0.9); 

function createFloorTexture(style) {
    let canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    let ctx = canvas.getContext('2d');
    
    if (style === 'wood') {
        ctx.fillStyle = '#8B5A2B'; ctx.fillRect(0,0,512,512);
        ctx.fillStyle = '#6B4226';
        for(let i=0; i<512; i+=32) ctx.fillRect(0, i, 512, 4); 
    } else if (style === 'carpet') {
        ctx.fillStyle = '#95a5a6'; ctx.fillRect(0,0,512,512);
        for(let i=0; i<15000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#bdc3c7' : '#7f8c8d';
            ctx.fillRect(Math.random()*512, Math.random()*512, 3, 3);
        }
    } else if (style === 'tile') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,512,512);
        ctx.fillStyle = '#dcdde1';
        for(let i=0; i<4; i++) for(let j=0; j<4; j++) if ((i+j)%2===0) ctx.fillRect(i*128, j*128, 128, 128); 
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
            texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
            let w = parseFloat(document.getElementById('roomWidth').value) || 12;
            let l = parseFloat(document.getElementById('roomLength').value) || 10;
            texture.repeat.set(w/4, l/4); 
            customFloorTexture = texture;
            if (floorMesh && floorMesh.material) {
                floorMesh.material.map = customFloorTexture;
                floorMesh.material.needsUpdate = true;
            }
            let customOpt = document.getElementById('customFloorOption');
            let floorSel = document.getElementById('floorStyle');
            if (customOpt) customOpt.style.display = 'block';
            if (floorSel) floorSel.value = 'custom';
            saveState();
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function applyTexture(event) {
    if (!selectedItem) return;
    let file = event.target.files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            let tex = new THREE.TextureLoader().load(e.target.result);
            selectedItem.children.forEach(child => { 
                if (child.isMesh && child.geometry && child.geometry.type !== "CylinderGeometry") { 
                    child.material = child.material.clone(); 
                    child.material.map = tex; 
                    child.material.color.setHex(0xffffff); 
                    child.material.needsUpdate = true; 
                } 
            });
            saveState();
        };
        reader.readAsDataURL(file);
    }
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
    
    let colorEl = document.getElementById('wallColor');
    let opacityEl = document.getElementById('wallOpacity');
    let wColor = colorEl ? colorEl.value : '#3a404d';
    let wOpacity = opacityEl ? parseFloat(opacityEl.value) : 0.9;
    
    let wallMat = new THREE.MeshStandardMaterial({ 
        color: wColor, side: THREE.FrontSide, transparent: wOpacity < 1, opacity: wOpacity, 
        roughness: 0.9, bumpMap: plasterBumpMap, bumpScale: 0.04, depthWrite: wOpacity >= 1 
    });
    wallMat.shadowSide = THREE.DoubleSide;

    let widthEl = document.getElementById('roomWidth');
    let lengthEl = document.getElementById('roomLength');
    let w = widthEl ? parseFloat(widthEl.value) : 12;
    let l = lengthEl ? parseFloat(lengthEl.value) : 10;
    let wallH = 8;

    function makeWall(width, height, isXWall, sign) {
        let shape = new THREE.Shape();
        shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(width / 2, height); shape.lineTo(-width / 2, height); shape.lineTo(-width / 2, 0);
        
        for (let item of furniture) {
            let name = item.userData.name;
            if (name.includes('Door') || name === 'Window') {
                let ix = item.position.x, iy = item.position.y, iz = item.position.z, iw = item.userData.w, ih = item.userData.h;
                let rotY = Math.abs(item.rotation.y);
                let isFacingZ = rotY < 0.1 || Math.abs(rotY - Math.PI) < 0.1; 
                let isFacingX = Math.abs(rotY - Math.PI / 2) < 0.1;

                let onThisWall = false, localX = 0;
                if (isXWall) { if (Math.abs(iz - sign * l / 2) < 0.5 && isFacingZ) { onThisWall = true; localX = sign === -1 ? ix : -ix; } } 
                else { if (Math.abs(ix - sign * w / 2) < 0.5 && isFacingX) { onThisWall = true; localX = sign === -1 ? -iz : iz; } }
                
                if (onThisWall) {
                    let hole = new THREE.Path();
                    hole.moveTo(localX - iw / 2, iy); hole.lineTo(localX - iw / 2, iy + ih); hole.lineTo(localX + iw / 2, iy + ih); hole.lineTo(localX + iw / 2, iy); hole.lineTo(localX - iw / 2, iy);
                    shape.holes.push(hole);
                }
            }
        }
        let mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), wallMat);
        mesh.receiveShadow = true; return mesh;
    }

    let wB = makeWall(w, wallH, true, -1); wB.position.set(0, 0, -l / 2); wallsGroup.add(wB);
    let wF = makeWall(w, wallH, true, 1); wF.position.set(0, 0, l / 2); wF.rotation.y = Math.PI; wallsGroup.add(wF);
    let wL = makeWall(l, wallH, false, -1); wL.position.set(-w / 2, 0, 0); wL.rotation.y = Math.PI / 2; wallsGroup.add(wL);
    let wR = makeWall(l, wallH, false, 1); wR.position.set(w / 2, 0, 0); wR.rotation.y = -Math.PI / 2; wallsGroup.add(wR);
    scene.add(wallsGroup);
}

function buildRoom() {
    if (floorMesh) scene.remove(floorMesh);
    if (gridHelper) scene.remove(gridHelper);
    
    let widthEl = document.getElementById('roomWidth');
    let lengthEl = document.getElementById('roomLength');
    let w = widthEl ? parseFloat(widthEl.value) : 12;
    let l = lengthEl ? parseFloat(lengthEl.value) : 10;
    
    let styleEl = document.getElementById('floorStyle');
    let style = styleEl ? styleEl.value : 'wood';
    
    let floorMatConfig = { color: '#ffffff', roughness: style === 'wood' ? 0.3 : 0.8, bumpMap: style === 'wood' ? woodBumpMap : (style === 'carpet' ? carpetBumpMap : null), bumpScale: 0.03 };
    if (style === 'custom' && customFloorTexture) floorMatConfig.map = customFloorTexture;
    else floorMatConfig.map = createFloorTexture(style);

    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial(floorMatConfig));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.receiveShadow = true; scene.add(floorMesh);
    
    gridHelper = new THREE.Group();
    for (let i = 0; i <= w; i++) { let s = createTextSprite(i + "'"); s.position.set(-w / 2 + i, 0.2, l / 2 + 0.5); gridHelper.add(s); }
    for (let j = 0; j <= l; j++) { let s = createTextSprite(j + "'"); s.position.set(w / 2 + 0.5, 0.2, -l / 2 + j); gridHelper.add(s); }
    scene.add(gridHelper); 
    updateWalls(); 
}

function updateRoom() { buildRoom(); }

function getSpawnPosition(itemW, itemL, isGhost) {
    if (isGhost) return {x: 0, z: 0}; 
    let widthEl = document.getElementById('roomWidth');
    let lengthEl = document.getElementById('roomLength');
    let w = widthEl ? parseFloat(widthEl.value) : 12;
    let l = lengthEl ? parseFloat(lengthEl.value) : 10;
    
    for (let x = -w / 2 + itemW / 2; x <= w / 2 - itemW / 2; x += 1) {
        for (let z = -l / 2 + itemL / 2; z <= l / 2 - itemL / 2; z += 1) {
            let testBox = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 2, z), new THREE.Vector3(itemW - 0.2, 4, itemL - 0.2));
            let overlap = false;
            for (let other of furniture) {
                if (other.userData.isGhost) continue;
                if (testBox.intersectsBox(new THREE.Box3().setFromObject(other))) { overlap = true; break; }
            }
            if (!overlap) return {x: x, z: z};
        }
    }
    return null; 
}

function addItem(itemName, itemW, itemH, itemL, itemColor, isGhost = false, startX = null, startZ = null, startRot = 0, startY = null, isOpen = false) {
    if (!isTimeTraveling) saveState(); 
    
    if (startX === null || startZ === null) {
        let spot = getSpawnPosition(itemW, itemL, isGhost);
        if (!spot) { showError("Whoops! The room is too full to fit the " + itemName + "."); historyStack.pop(); return; }
        startX = spot.x; startZ = spot.z;
    }

    if (startY === null) { 
        startY = 0;
        if (itemName === 'Poster' || itemName === 'Window' || itemName === 'Wall Light') startY = 3; 
        else if (itemName === 'Ceiling Fan') startY = 7.5; 
    }

    let group = new THREE.Group();
    group.userData = { name: itemName, w: itemW, h: itemH, l: itemL, color: itemColor, isGhost: isGhost, isFurniture: true, isOpen: isOpen };
    
    let handleMat = new THREE.MeshStandardMaterial({ color: '#c0c0c0', metalness: 0.9, roughness: 0.2 });
    let brassMat = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.8, roughness: 0.3 });
    let woodMat = new THREE.MeshStandardMaterial({ color: itemColor, roughness: 0.5, bumpMap: woodBumpMap, bumpScale: 0.04 });
    let softMat = new THREE.MeshStandardMaterial({ color: itemColor, roughness: 1.0, bumpMap: fabricBumpMap, bumpScale: 0.03 });
    let darkMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.8 });
    let glassMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.9, opacity: 1, transparent: true, metalness: 0.1, roughness: 0.05, ior: 1.5, thickness: 0.05 });

    if (itemName === 'Bed') {
        let frame = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH * 0.15, itemL), woodMat); frame.position.y = itemH * 0.125; frame.castShadow = true; group.add(frame);
        let plinthBase = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.8, itemH * 0.05, itemL * 0.8), darkMat); plinthBase.position.y = itemH * 0.025; group.add(plinthBase);
        let headboard = new THREE.Mesh(new THREE.BoxGeometry(itemW + 1.2, itemH, 0.15), woodMat); headboard.position.set(0, itemH / 2, -itemL / 2 + 0.075); headboard.castShadow = true; group.add(headboard);
        
        for (let x of [-1, 1]) {
            let ns = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), woodMat); ns.position.set(x * (itemW / 2 + 0.3), itemH * 0.4, -itemL / 2 + 0.2); ns.castShadow = true; group.add(ns);
            let drawer = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.05), new THREE.MeshStandardMaterial({color:'#ffffff'})); drawer.position.set(x * (itemW / 2 + 0.3), itemH * 0.4, -itemL / 2 + 0.4); group.add(drawer);
            let knob = new THREE.Mesh(new THREE.SphereGeometry(0.03), handleMat); knob.position.set(x * (itemW / 2 + 0.3), itemH * 0.4, -itemL / 2 + 0.43); group.add(knob);
            let lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.05), brassMat); lampBase.position.set(x * (itemW / 2 + 0.3), itemH * 0.4 + 0.175, -itemL / 2 + 0.2); group.add(lampBase);
            let lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.2, 32, 1, true), new THREE.MeshStandardMaterial({color:'#ffffff', roughness: 0.9})); lampShade.position.set(x * (itemW / 2 + 0.3), itemH * 0.4 + 0.3, -itemL / 2 + 0.2); group.add(lampShade);
            let lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshStandardMaterial({emissive:0xffddaa, emissiveIntensity: 2})); lampBulb.position.set(x * (itemW / 2 + 0.3), itemH * 0.4 + 0.3, -itemL / 2 + 0.2); lampBulb.userData.isBulb = true; group.add(lampBulb);
        }

        let mattress = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.96, itemH * 0.3, itemL * 0.94), new THREE.MeshStandardMaterial({color:'#fdfdfd', bumpMap: fabricBumpMap, bumpScale: 0.02})); mattress.position.y = itemH * 0.35; mattress.castShadow = true; group.add(mattress);
        let duvet = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.98, 0.06, itemL * 0.65), softMat); duvet.position.set(0, itemH * 0.53, itemL * 0.15); duvet.castShadow = true; group.add(duvet);
        let foldLayer = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.99, 0.1, 0.3), softMat); foldLayer.position.set(0, itemH * 0.55, -itemL * 0.175); foldLayer.castShadow = true; group.add(foldLayer);
        let throwBlanket = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.99, 0.04, 0.5), new THREE.MeshStandardMaterial({color:'#8e44ad', bumpMap: fabricBumpMap, bumpScale: 0.06})); throwBlanket.position.set(0, itemH * 0.57, itemL * 0.3); throwBlanket.castShadow = true; group.add(throwBlanket);

        let pillowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, bumpMap: fabricBumpMap, bumpScale: 0.05 });
        let accentMat = new THREE.MeshStandardMaterial({ color: '#e67e22', roughness: 0.9, bumpMap: fabricBumpMap, bumpScale: 0.05 });
        for (let x of [-0.28, 0.28]) {
            let pBack = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.4, 0.15, 0.45), pillowMat); pBack.position.set(x * itemW, itemH * 0.56, -itemL * 0.35); pBack.rotation.x = Math.PI / 10; pBack.castShadow = true; group.add(pBack);
            let pFront = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.35, 0.12, 0.4), softMat); pFront.position.set(x * itemW * 0.9, itemH * 0.53, -itemL * 0.25); pFront.rotation.x = Math.PI / 8; pFront.castShadow = true; group.add(pFront);
        }
        for (let x of [-0.1, 0.1]) {
            let pAcc = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), accentMat); pAcc.position.set(x * itemW, itemH * 0.52, -itemL * 0.15); pAcc.rotation.x = Math.PI / 6; pAcc.rotation.y = x * Math.PI / 8; pAcc.castShadow = true; group.add(pAcc);
        }

    } else if (itemName === 'Sofa') {
        let base = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH * 0.2, itemL), softMat); base.position.y = itemH * 0.15; base.castShadow = true; group.add(base);
        for (let x of [-1, 1]) for (let z of [-1, 1]) {
            let legGroup = new THREE.Group();
            let legWood = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, itemH * 0.1), woodMat); legWood.position.y = itemH * 0.05; legWood.castShadow = true; legGroup.add(legWood);
            let legCap = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.04), brassMat); legCap.position.y = 0.02; legCap.castShadow = true; legGroup.add(legCap);
            legGroup.position.set(x * (itemW / 2 - 0.2), 0, z * (itemL / 2 - 0.2)); legGroup.rotation.z = x * Math.PI / 16; legGroup.rotation.x = z * Math.PI / 16;
            group.add(legGroup);
        }
        let cushionW = (itemW - 0.8) / 3;
        for (let i = 0; i < 3; i++) {
            let seat = new THREE.Mesh(new THREE.BoxGeometry(cushionW - 0.02, 0.2, itemL * 0.8), softMat); seat.position.set(-itemW / 2 + 0.4 + cushionW / 2 + (i * cushionW), itemH * 0.35, itemL * 0.05); seat.castShadow = true; group.add(seat);
            let back = new THREE.Mesh(new THREE.BoxGeometry(cushionW - 0.02, itemH * 0.6, 0.25), softMat); back.position.set(-itemW / 2 + 0.4 + cushionW / 2 + (i * cushionW), itemH * 0.65, -itemL / 2 + 0.15); back.rotation.x = Math.PI / 16; back.castShadow = true; group.add(back);
        }
        for (let x of [-1, 1]) { 
            let arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, itemH * 0.6, itemL), softMat); arm.position.set(x * (itemW / 2 - 0.2), itemH * 0.35, 0); arm.castShadow = true; group.add(arm); 
            let armCap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, itemL * 1.02), softMat); armCap.position.set(x * (itemW / 2 - 0.2), itemH * 0.65, 0); armCap.castShadow = true; group.add(armCap); 
            let tp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.4), new THREE.MeshStandardMaterial({color:'#f1c40f', bumpMap: fabricBumpMap, bumpScale: 0.05})); tp.position.set(x * (itemW / 2 - 0.45), itemH * 0.45, -itemL / 2 + 0.3); tp.rotation.x = Math.PI / 4; tp.rotation.z = x * Math.PI / 6; tp.castShadow = true; group.add(tp);
        }

    } else if (itemName === 'Wardrobe') {
        let body = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH * 0.85, itemL), woodMat); 
        body.position.y = itemH * 0.525; body.castShadow = true; group.add(body);
        let plinth = new THREE.Mesh(new THREE.BoxGeometry(itemW * 1.02, itemH * 0.1, itemL * 1.02), woodMat); 
        plinth.position.y = itemH * 0.05; plinth.castShadow = true; group.add(plinth);
        let crown = new THREE.Mesh(new THREE.BoxGeometry(itemW * 1.05, itemH * 0.05, itemL * 1.05), woodMat); 
        crown.position.y = itemH * 0.975; crown.castShadow = true; group.add(crown);
        let doorW = itemW / 3;
        for (let i = 0; i < 3; i++) {
            let door = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.02, itemH * 0.68, 0.05), woodMat); 
            door.position.set(-itemW / 2 + doorW / 2 + (i * doorW), itemH * 0.61, itemL / 2 + 0.025); door.castShadow = true; group.add(door);
            let handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8), handleMat); 
            handle.position.set(-itemW / 2 + doorW * 0.85 + (i * doorW), itemH * 0.61, itemL / 2 + 0.07); group.add(handle);
        }
        let drawerH = itemH * 0.15;
        for (let i = 0; i < 2; i++) {
            let dW = itemW / 2;
            let drawer = new THREE.Mesh(new THREE.BoxGeometry(dW - 0.02, drawerH - 0.02, 0.05), woodMat); 
            drawer.position.set(-itemW / 2 + dW / 2 + (i * dW), itemH * 0.1 + drawerH / 2 + 0.01, itemL / 2 + 0.025); group.add(drawer);
            let dHandle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.02), handleMat); 
            dHandle.position.set(-itemW / 2 + dW / 2 + (i * dW), itemH * 0.1 + drawerH / 2 + 0.01, itemL / 2 + 0.06); group.add(dHandle);
        }

    } else if (itemName === 'Dining Table') {
        let top = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, itemL), woodMat); top.position.y = itemH - 0.05; top.castShadow = true; group.add(top);
        let apron = new THREE.Mesh(new THREE.BoxGeometry(itemW - 0.2, 0.15, itemL - 0.2), darkMat); apron.position.y = itemH - 0.175; apron.castShadow = true; group.add(apron);
        let runner = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.9, 0.01, itemL * 0.3), new THREE.MeshStandardMaterial({color:'#ffffff', bumpMap: fabricBumpMap, bumpScale: 0.02})); runner.position.y = itemH; group.add(runner);
        for (let x of [-0.25, 0.25]) for (let z of [-0.35, 0.35]) {
            let mat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.01, 0.3), new THREE.MeshStandardMaterial({color:'#34495e', bumpMap: fabricBumpMap, bumpScale: 0.02})); mat.position.set(x * itemW, itemH, z * itemL); group.add(mat);
        }
        for (let x of [-1, 1]) for (let z of [-1, 1]) { 
            let leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.03, itemH - 0.1), woodMat); leg.position.set(x * (itemW / 2 - 0.2), (itemH - 0.1) / 2, z * (itemL / 2 - 0.2)); leg.rotation.z = x * Math.PI / 24; leg.rotation.x = -z * Math.PI / 24; leg.castShadow = true; group.add(leg); 
        }

    } else if (itemName === 'Chair') {
        let seatHeight = itemH * 0.45;
        let seat = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.08, itemL), woodMat); seat.position.y = seatHeight; seat.castShadow = true; group.add(seat);
        let cushion = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.9, 0.06, itemL * 0.9), softMat); cushion.position.y = seatHeight + 0.07; cushion.castShadow = true; group.add(cushion);
        let backPosts = new THREE.Group();
        for (let x of [-1, 1]) {
            let post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, itemH - seatHeight), woodMat); post.position.set(x * (itemW / 2 - 0.1), (itemH - seatHeight) / 2, 0); post.castShadow = true; backPosts.add(post);
        }
        for (let y = 1; y <= 4; y++) {
            let slat = new THREE.Mesh(new THREE.BoxGeometry(itemW - 0.2, 0.08, 0.02), woodMat); slat.position.set(0, y * ((itemH - seatHeight) / 5), 0.02); slat.castShadow = true; backPosts.add(slat);
        }
        backPosts.position.set(0, seatHeight, -itemL / 2 + 0.1); backPosts.rotation.x = -Math.PI / 16; group.add(backPosts);
        for (let x of [-1, 1]) for (let z of [-1, 1]) {
            let leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, seatHeight), woodMat); leg.position.set(x * (itemW / 2 - 0.1), seatHeight / 2, z * (itemL / 2 - 0.1)); leg.rotation.x = z * Math.PI / 24; leg.rotation.z = -x * Math.PI / 24; leg.castShadow = true; group.add(leg);
        }

    } else if (itemName === 'Bookshelf') {
        let lowerH = itemH * 0.3;
        let base = new THREE.Mesh(new THREE.BoxGeometry(itemW, lowerH, itemL), woodMat); base.position.y = lowerH / 2; base.castShadow = true; group.add(base);
        for (let x of [-1, 1]) {
            let door = new THREE.Mesh(new THREE.BoxGeometry(itemW / 2 - 0.02, lowerH - 0.05, 0.05), woodMat); door.position.set(x * itemW / 4, lowerH / 2, itemL / 2 + 0.025); group.add(door);
            let handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.02), handleMat); handle.position.set(x * 0.1, lowerH / 2 + 0.1, itemL / 2 + 0.06); group.add(handle);
        }
        let left = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH - lowerH, itemL * 0.8), woodMat); left.position.set(-itemW / 2 + 0.05, lowerH + (itemH - lowerH) / 2, -itemL * 0.1); left.castShadow = true; group.add(left);
        let right = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH - lowerH, itemL * 0.8), woodMat); right.position.set(itemW / 2 - 0.05, lowerH + (itemH - lowerH) / 2, -itemL * 0.1); right.castShadow = true; group.add(right);
        let back = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH - lowerH, 0.05), woodMat); back.position.set(0, lowerH + (itemH - lowerH) / 2, -itemL / 2 + 0.025); back.castShadow = true; group.add(back);
        let crown = new THREE.Mesh(new THREE.BoxGeometry(itemW + 0.1, 0.1, itemL * 0.8 + 0.05), woodMat); crown.position.set(0, itemH - 0.05, -itemL * 0.1 + 0.025); crown.castShadow = true; group.add(crown);
        
        let numShelves = 4;
        let shelfSpacing = (itemH - lowerH - 0.2) / numShelves;
        for (let i = 1; i <= numShelves; i++) {
            let shelfY = lowerH + (i * shelfSpacing);
            if (i < numShelves) { 
                let shelf = new THREE.Mesh(new THREE.BoxGeometry(itemW - 0.2, 0.05, itemL * 0.8 - 0.05), woodMat); shelf.position.set(0, shelfY, -itemL * 0.1 + 0.025); shelf.castShadow = true; group.add(shelf); 
            }
            let currentX = -itemW / 2 + 0.15;
            while (currentX < itemW / 2 - 0.2) {
                if (Math.random() > 0.3) {
                    let bookW = 0.04 + Math.random() * 0.08; let bookH = 0.4 + Math.random() * 0.35; let bookD = 0.3 + Math.random() * 0.2;
                    let book = new THREE.Mesh(new THREE.BoxGeometry(bookW, bookH, bookD), new THREE.MeshStandardMaterial({color: new THREE.Color().setHSL(Math.random(), 0.6, 0.4)}));
                    if (Math.random() > 0.9) { book.rotation.z = Math.PI / 12; currentX += 0.1; }
                    book.position.set(currentX + bookW / 2, shelfY - shelfSpacing + bookH / 2 + 0.05, -itemL / 2 + bookD / 2 + 0.05); book.castShadow = true; group.add(book);
                    currentX += bookW + 0.01;
                } else { currentX += 0.15 + Math.random() * 0.3; } 
            }
        }

    } else if (itemName === 'TV Stand') {
        let top = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, itemL), woodMat); top.position.y = itemH * 0.4; top.castShadow = true; group.add(top);
        let base = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.05, itemL), woodMat); base.position.y = 0.1; base.castShadow = true; group.add(base);
        for (let x of [-1, 1]) for (let z of [-1, 1]) { 
            let foot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.1), handleMat); foot.position.set(x * (itemW / 2 - 0.1), 0.05, z * (itemL / 2 - 0.1)); group.add(foot); 
        }
        let left = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH * 0.4, itemL), woodMat); left.position.set(-itemW / 2 + 0.05, itemH * 0.2, 0); left.castShadow = true; group.add(left);
        let right = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH * 0.4, itemL), woodMat); right.position.set(itemW / 2 - 0.05, itemH * 0.2, 0); right.castShadow = true; group.add(right);
        let mid1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, itemH * 0.4, itemL), woodMat); mid1.position.set(-itemW / 6, itemH * 0.2, 0); group.add(mid1);
        let mid2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, itemH * 0.4, itemL), woodMat); mid2.position.set(itemW / 6, itemH * 0.2, 0); group.add(mid2);
        for (let x of [-1, 1]) {
            let doorSolid = new THREE.Mesh(new THREE.BoxGeometry(itemW / 3 - 0.05, itemH * 0.4 - 0.15, 0.05), woodMat); doorSolid.position.set(x * (itemW / 3), itemH * 0.225, itemL / 2); group.add(doorSolid);
            let handleSolid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.02), handleMat); handleSolid.position.set(x * (itemW / 3), itemH * 0.35, itemL / 2 + 0.035); group.add(handleSolid);
        }
        let doorGlassL = new THREE.Mesh(new THREE.BoxGeometry(itemW / 3 - 0.05, itemH * 0.4 - 0.15, 0.02), glassMat); doorGlassL.position.set(-0.08, itemH * 0.225, itemL / 2); group.add(doorGlassL);
        let doorGlassR = new THREE.Mesh(new THREE.BoxGeometry(itemW / 3 - 0.05, itemH * 0.4 - 0.15, 0.02), glassMat); doorGlassR.position.set(0.08, itemH * 0.225, itemL / 2); group.add(doorGlassR);
        let tvBase = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.3), darkMat); tvBase.position.set(0, itemH * 0.4 + 0.01, 0); group.add(tvBase);
        let neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.05), darkMat); neck.position.set(0, itemH * 0.4 + 0.1, 0); group.add(neck);
        let screenBody = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.9, itemH * 0.6, 0.05), darkMat); screenBody.position.set(0, itemH * 0.4 + 0.2 + itemH * 0.3, 0); screenBody.castShadow = true; group.add(screenBody);
        let screenGlass = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.88, itemH * 0.58, 0.01), new THREE.MeshStandardMaterial({color:'#020202', metalness: 0.9, roughness: 0.1})); screenGlass.position.set(0, itemH * 0.4 + 0.2 + itemH * 0.3, 0.026); group.add(screenGlass);

    } else if (itemName === 'Desk') {
        let top = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, itemL), woodMat); top.position.y = itemH - 0.05; top.castShadow = true; group.add(top);
        let legL1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH - 0.1, 0.1), darkMat); legL1.position.set(-itemW / 2 + 0.1, (itemH - 0.1) / 2, itemL / 2 - 0.1); legL1.castShadow = true; group.add(legL1);
        let legL2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH - 0.1, 0.1), darkMat); legL2.position.set(-itemW / 2 + 0.1, (itemH - 0.1) / 2, -itemL / 2 + 0.1); legL2.castShadow = true; group.add(legL2);
        let braceL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, itemL - 0.2), darkMat); braceL.position.set(-itemW / 2 + 0.1, 0.2, 0); group.add(braceL);
        let drawerBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, itemH - 0.1, itemL - 0.1), woodMat); drawerBox.position.set(itemW / 2 - 0.65, (itemH - 0.1) / 2, 0); drawerBox.castShadow = true; group.add(drawerBox);
        for (let i = 0; i < 3; i++) {
            let dFront = new THREE.Mesh(new THREE.BoxGeometry(1.16, (itemH - 0.3) / 3, 0.05), woodMat); dFront.position.set(itemW / 2 - 0.65, 0.15 + (itemH - 0.3) / 6 + i * ((itemH - 0.3) / 3 + 0.02), itemL / 2 - 0.025); group.add(dFront);
            let dHandle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.02), handleMat); dHandle.position.set(itemW / 2 - 0.65, 0.15 + (itemH - 0.3) / 6 + i * ((itemH - 0.3) / 3 + 0.02) + 0.1, itemL / 2 + 0.01); group.add(dHandle);
        }
        let deskMat = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.01, 1.0), new THREE.MeshStandardMaterial({color:'#222222', bumpMap: fabricBumpMap, bumpScale: 0.01})); deskMat.position.set(-0.5, itemH, 0.2); group.add(deskMat);
        let keyboard = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.4), new THREE.MeshStandardMaterial({color:'#ddd'})); keyboard.position.set(-0.7, itemH + 0.02, 0.3); keyboard.rotation.x = Math.PI / 32; group.add(keyboard);
        let mouseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.3), new THREE.MeshStandardMaterial({color:'#fff'})); mouseMesh.position.set(0.2, itemH + 0.025, 0.3); group.add(mouseMesh);
        let monBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.4), darkMat); monBase.position.set(-0.5, itemH + 0.01, -0.3); group.add(monBase);
        let monNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4), darkMat); monNeck.position.set(-0.5, itemH + 0.2, -0.3); group.add(monNeck);
        let monitor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.05), darkMat); monitor.position.set(-0.5, itemH + 0.5, -0.2); group.add(monitor);
        let screen = new THREE.Mesh(new THREE.BoxGeometry(1.95, 1.05, 0.01), new THREE.MeshStandardMaterial({color:'#000000', metalness:0.8, roughness:0.2})); screen.position.set(-0.5, itemH + 0.5, -0.17); group.add(screen);

    } else if (itemName.includes('Plant')) {
        let potColor = itemName === 'Small Plant' ? '#ffffff' : '#e67e22';
        let potMat = new THREE.MeshStandardMaterial({color: potColor, roughness: 0.8});
        let saucer = new THREE.Mesh(new THREE.CylinderGeometry(itemW / 1.9, itemW / 1.9, 0.05, 32), potMat); saucer.position.y = 0.025; group.add(saucer);
        let pot = new THREE.Mesh(new THREE.CylinderGeometry(itemW / 2, itemW / 3, itemH * 0.3, 32), potMat); pot.position.y = itemH * 0.15 + 0.05; pot.castShadow = true; group.add(pot);
        let potLip = new THREE.Mesh(new THREE.CylinderGeometry(itemW / 1.9, itemW / 1.9, 0.05, 32), potMat); potLip.position.y = itemH * 0.3 + 0.05; group.add(potLip);
        let soil = new THREE.Mesh(new THREE.CircleGeometry(itemW / 2.1, 32), new THREE.MeshStandardMaterial({color:'#2c1e16', roughness: 1.0})); soil.rotation.x = -Math.PI / 2; soil.position.y = itemH * 0.29 + 0.05; group.add(soil);
        
        let stemCount = itemName === 'Small Plant' ? 3 : 7;
        let stemMat = new THREE.MeshStandardMaterial({color:'#4caf50'});
        let leafMat = new THREE.MeshStandardMaterial({color:'#2e7d32', roughness: 0.6});
        
        for (let i = 0; i < stemCount; i++) {
            let height = itemH * 0.4 + Math.random() * itemH * 0.3;
            let stem = new THREE.Mesh(new THREE.CylinderGeometry(itemW * 0.02, itemW * 0.04, height), stemMat);
            stem.position.set((Math.random() - 0.5) * itemW * 0.3, itemH * 0.3 + height / 2 + 0.05, (Math.random() - 0.5) * itemW * 0.3);
            stem.rotation.set(Math.random() * 0.6 - 0.3, 0, Math.random() * 0.6 - 0.3); stem.castShadow = true; group.add(stem);
            for (let j = 0; j < 5; j++) {
                let leaf = new THREE.Mesh(new THREE.ConeGeometry(itemW * 0.2, itemH * 0.2, 3), leafMat);
                leaf.position.copy(stem.position); leaf.position.y += height / 2 - Math.random() * (height * 0.4);
                leaf.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI); leaf.castShadow = true; group.add(leaf);
            }
        }

    } else if (itemName === 'Floor Mirror') {
        let frame = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, 0.05), brassMat); frame.position.y = itemH / 2; frame.castShadow = true; group.add(frame);
        let mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(itemW - 0.2, itemH - 0.2, 0.06), new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.0, metalness: 1.0 })); 
        mirrorGlass.position.y = itemH / 2; group.add(mirrorGlass);
        let stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, itemH * 0.8), handleMat);
        stand.position.set(0, itemH * 0.4, -itemH * 0.2); stand.rotation.x = -Math.PI / 8; stand.castShadow = true; group.add(stand);
        group.rotation.x = Math.PI / 24;

    } else if (itemName === 'Wall Light') {
        let backplate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32), handleMat); backplate.rotation.x = Math.PI / 2; backplate.position.set(0, itemH / 2, 0.025); backplate.castShadow = true; group.add(backplate);
        for (let i = 0; i < 4; i++) { let screw = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06), darkMat); screw.rotation.x = Math.PI / 2; screw.position.set(Math.cos(i * Math.PI / 2) * 0.2, itemH / 2 + Math.sin(i * Math.PI / 2) * 0.2, 0.03); group.add(screw); }
        let arm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4), handleMat); arm.rotation.x = Math.PI / 2; arm.position.set(0, itemH / 2, 0.2); arm.castShadow = true; group.add(arm);
        let bulbBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1), brassMat); bulbBase.position.set(0, itemH / 2 - 0.05, 0.4); bulbBase.castShadow = true; group.add(bulbBase);
        let bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 32), new THREE.MeshStandardMaterial({emissive: 0xffddaa, emissiveIntensity: 5})); bulb.position.set(0, itemH / 2 - 0.15, 0.4); bulb.userData.isBulb = true; group.add(bulb);
        let filament = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.1), new THREE.MeshStandardMaterial({color:'#ffff00'})); filament.position.set(0, itemH / 2 - 0.15, 0.4); group.add(filament);
        let shade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.1, 0.4, 32, 1, true), glassMat); shade.position.set(0, itemH / 2 - 0.1, 0.4); group.add(shade);
        let light = new THREE.PointLight(0xffddaa, 1.5, 15); light.position.set(0, itemH / 2 - 0.2, 0.4); light.castShadow = true; group.add(light);

    } else if (itemName === 'Ceiling Fan') {
        let canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 32), handleMat); canopy.position.y = itemH - 0.05; canopy.castShadow = true; group.add(canopy);
        let rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8), handleMat); rod.position.y = itemH - 0.45; rod.castShadow = true; group.add(rod);
        let motorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 32), handleMat); motorTop.position.y = itemH - 0.925; motorTop.castShadow = true; group.add(motorTop);
        let motorMid = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 32), darkMat); motorMid.position.y = itemH - 1.05; motorMid.castShadow = true; group.add(motorMid);
        for (let i = 0; i < 20; i++) { let vent = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.5), darkMat); vent.position.y = itemH - 0.925; vent.rotation.y = i * (Math.PI * 2 / 20); group.add(vent); }
        let blades = new THREE.Group();
        for (let i = 0; i < 4; i++) {
            let bracket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.05), handleMat); bracket.position.set(0.55, 0, 0); bracket.rotation.x = Math.PI / 16; group.add(bracket);
            let blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.25), woodMat); blade.position.set(1.4, 0, 0); blade.rotation.x = Math.PI / 16; blade.castShadow = true; group.add(blade);
            let pivot = new THREE.Group(); pivot.rotation.y = (Math.PI / 2) * i; pivot.add(bracket); pivot.add(blade); blades.add(pivot);
        }
        blades.position.y = itemH - 1.05; group.add(blades); blades.userData.isFan = true;
        let lightBase = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 32), brassMat); lightBase.position.y = itemH - 1.125; group.add(lightBase);
        let shade = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glassMat); shade.position.y = itemH - 1.15; group.add(shade);
        let bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({emissive: 0xffddaa, emissiveIntensity: 5})); bulb.position.y = itemH - 1.25; bulb.userData.isBulb = true; group.add(bulb);
        let light = new THREE.PointLight(0xffddaa, 1.2, 20); light.position.y = itemH - 1.3; light.castShadow = true; group.add(light);
        let chain = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5), brassMat); chain.position.set(0.1, itemH - 1.4, 0); group.add(chain);

    } else if (itemName === 'Window' || itemName === 'Balcony Door' || itemName === 'Wood Door') {
        let isGlass = itemName !== 'Wood Door';
        let fMat = !isGlass ? woodMat : new THREE.MeshStandardMaterial({ color: '#ffffff' });
        let pMat = !isGlass ? woodMat : glassMat;
        let frameL = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH, itemL), fMat); frameL.position.set(-itemW / 2 + 0.05, itemH / 2, 0); group.add(frameL);
        let frameR = new THREE.Mesh(new THREE.BoxGeometry(0.1, itemH, itemL), fMat); frameR.position.set(itemW / 2 - 0.05, itemH / 2, 0); group.add(frameR);
        let frameT = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, itemL), fMat); frameT.position.set(0, itemH - 0.05, 0); group.add(frameT);
        let trimW = itemW + 0.2; let trimH = itemH + 0.1;
        let trimL = new THREE.Mesh(new THREE.BoxGeometry(0.1, trimH, 0.02), fMat); trimL.position.set(-itemW / 2 - 0.05, trimH / 2, itemL / 2 + 0.01); group.add(trimL);
        let trimR = new THREE.Mesh(new THREE.BoxGeometry(0.1, trimH, 0.02), fMat); trimR.position.set(itemW / 2 + 0.05, trimH / 2, itemL / 2 + 0.01); group.add(trimR);
        let trimTop = new THREE.Mesh(new THREE.BoxGeometry(trimW, 0.1, 0.02), fMat); trimTop.position.set(0, trimH - 0.05, itemL / 2 + 0.01); group.add(trimTop);
        if (itemName === 'Window') { 
            let frameB = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, itemL), fMat); frameB.position.set(0, 0.05, 0); group.add(frameB); 
            let sill = new THREE.Mesh(new THREE.BoxGeometry(trimW + 0.1, 0.05, 0.1), fMat); sill.position.set(0, 0, itemL / 2 + 0.05); group.add(sill);
        }
        let panelGeo = new THREE.BoxGeometry(itemW - 0.2, itemName === 'Window' ? itemH - 0.2 : itemH - 0.1, 0.05);
        if (itemName.includes('Door')) panelGeo.translate((itemW - 0.2) / 2, 0, 0);
        let panel = new THREE.Mesh(panelGeo, pMat);
        if (itemName.includes('Door')) {
            panel.position.set(-(itemW - 0.2) / 2, !isGlass ? itemH / 2 - 0.05 : itemH / 2, 0);
            if (!isGlass) {
                let backplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.06), handleMat); backplate.position.set((itemW - 0.2) * 0.85, 0, 0); panel.add(backplate);
                let lever = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15), handleMat); lever.rotation.z = Math.PI / 2; lever.position.set((itemW - 0.2) * 0.85 + 0.05, 0.05, 0.05); panel.add(lever);
                let lock = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.07), brassMat); lock.rotation.x = Math.PI / 2; lock.position.set((itemW - 0.2) * 0.85, -0.05, 0); panel.add(lock);
            }
        } else {
            panel.position.set(0, itemH / 2, 0);
            let mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.05, itemH - 0.2, 0.06), fMat); panel.add(mullionV);
            let mullionH = new THREE.Mesh(new THREE.BoxGeometry(itemW - 0.2, 0.05, 0.06), fMat); panel.add(mullionH);
        }
        panel.userData.isDoorMesh = true; panel.castShadow = true; group.add(panel);

    } else if (itemName === 'Curtains') {
        let rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, itemW + 0.6, 32), handleMat); rod.rotation.z = Math.PI / 2; rod.position.set(0, itemH - 0.1, 0.15); rod.castShadow = true; group.add(rod);
        for (let x of [-1, 1]) {
            let finial = new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 32), handleMat); finial.position.set(x * (itemW / 2 + 0.35), itemH - 0.1, 0.15); group.add(finial);
            let bracket = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.15), handleMat); bracket.position.set(x * (itemW / 2 + 0.15), itemH - 0.05, 0.075); group.add(bracket);
        }
        let sheerGeo = new THREE.PlaneGeometry(itemW, itemH - 0.2, 64, 1); 
        let pos = sheerGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 15) * 0.15); 
        sheerGeo.computeVertexNormals(); 
        let sheer = new THREE.Mesh(sheerGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, side: THREE.DoubleSide })); sheer.position.set(0, itemH / 2 - 0.1, 0.10); sheer.castShadow = true; group.add(sheer);
        let geoSplit = new THREE.PlaneGeometry(itemW / 3, itemH - 0.2, 32, 1);
        let posS = geoSplit.attributes.position;
        for (let i = 0; i < posS.count; i++) posS.setZ(i, Math.sin(posS.getX(i) * 20) * 0.2); 
        geoSplit.computeVertexNormals();
        let heavyMat = new THREE.MeshStandardMaterial({ color: itemColor, side: THREE.DoubleSide, roughness: 0.9, bumpMap: fabricBumpMap, bumpScale: 0.05 });
        let heavyL = new THREE.Mesh(geoSplit, heavyMat); heavyL.position.set(-itemW / 3, itemH / 2 - 0.1, 0.25); heavyL.castShadow = true; group.add(heavyL);
        let heavyR = new THREE.Mesh(geoSplit, heavyMat); heavyR.position.set(itemW / 3, itemH / 2 - 0.1, 0.25); heavyR.castShadow = true; group.add(heavyR);
        for (let i = 0; i < 15; i++) {
            let ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 16, 32), handleMat); ring.position.set(-itemW / 2 + i * (itemW / 14), itemH - 0.1, 0.15); ring.rotation.y = Math.PI / 2; group.add(ring);
        }

    } else if (itemName === 'Rug') {
        let mesh = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, itemL), softMat); mesh.position.y = itemH / 2; mesh.castShadow = true; group.add(mesh);
        let border = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.9, itemH + 0.01, itemL * 0.9), new THREE.MeshStandardMaterial({color:'#ffffff', bumpMap: fabricBumpMap, bumpScale: 0.03})); border.position.y = itemH / 2; group.add(border);
        let inner = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.85, itemH + 0.02, itemL * 0.85), softMat); inner.position.y = itemH / 2; group.add(inner);
        let fringeMat = new THREE.MeshStandardMaterial({color: '#dddddd', roughness: 1.0});
        let fringe1 = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.02, 0.2), fringeMat); fringe1.position.set(0, 0.01, itemL / 2 + 0.1); group.add(fringe1);
        let fringe2 = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.02, 0.2), fringeMat); fringe2.position.set(0, 0.01, -itemL / 2 - 0.1); group.add(fringe2);

    } else if (itemName === 'Poster') {
        let frame = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, 0.05), darkMat); frame.position.y = itemH / 2; frame.castShadow = true; group.add(frame);
        let matboard = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.9, itemH * 0.9, 0.06), new THREE.MeshStandardMaterial({color:'#ffffff'})); matboard.position.y = itemH / 2; group.add(matboard);
        let art = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.7, itemH * 0.7, 0.07), softMat); art.position.y = itemH / 2; group.add(art);
        let glass = new THREE.Mesh(new THREE.BoxGeometry(itemW * 0.95, itemH * 0.95, 0.08), glassMat); glass.position.y = itemH / 2; group.add(glass);

    } else if (itemName === 'Balcony') {
        let balcMat = new THREE.MeshStandardMaterial({ color: itemColor, bumpMap: plasterBumpMap, bumpScale: 0.01 });
        let railMat = new THREE.MeshStandardMaterial({ color: '#2c3e50', metalness: 0.8, roughness: 0.2 });
        let floor = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.2, itemL), balcMat); floor.position.y = 0.1; floor.castShadow = true; floor.receiveShadow = true; group.add(floor);
        let railH = 3; 
        let topBarF = new THREE.Mesh(new THREE.BoxGeometry(itemW, 0.1, 0.1), railMat); topBarF.position.set(0, railH, itemL/2 - 0.05); topBarF.castShadow = true; group.add(topBarF);
        let topBarL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, itemL), railMat); topBarL.position.set(-itemW/2 + 0.05, railH, 0); topBarL.castShadow = true; group.add(topBarL);
        let topBarR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, itemL), railMat); topBarR.position.set(itemW/2 - 0.05, railH, 0); topBarR.castShadow = true; group.add(topBarR);
        let postCount = Math.floor(itemW * 1.5);
        for(let i=0; i<=postCount; i++) {
            let px = -itemW/2 + 0.05 + (i * ((itemW-0.1)/postCount));
            let post = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, 0.05), railMat); post.position.set(px, railH/2, itemL/2 - 0.05); post.castShadow = true; group.add(post);
        }
        let sidePostCount = Math.floor(itemL * 1.5);
        for(let i=1; i<sidePostCount; i++) {
            let pz = -itemL/2 + 0.05 + (i * ((itemL-0.1)/sidePostCount));
            let postL = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, 0.05), railMat); postL.position.set(-itemW/2 + 0.05, railH/2, pz); postL.castShadow = true; group.add(postL);
            let postR = new THREE.Mesh(new THREE.BoxGeometry(0.05, railH, 0.05), railMat); postR.position.set(itemW/2 - 0.05, railH/2, pz); postR.castShadow = true; group.add(postR);
        }
    } else {
        let mesh = new THREE.Mesh(new THREE.BoxGeometry(itemW, itemH, itemL), woodMat); mesh.position.y = itemH / 2; group.add(mesh);
    }

    if (isOpen && itemName.includes('Door')) {
        let dm = group.children.find(c => c.userData && c.userData.isDoorMesh);
        if (dm) { 
            if (itemName === 'Wood Door') dm.rotation.y = -Math.PI / 2; 
            else dm.position.x = itemW * 0.9; 
        }
    }

    group.position.set(startX, startY, startZ); 
    group.rotation.y = startRot; 
    scene.add(group); 
    furniture.push(group);
    
    updateWalls(); 
}