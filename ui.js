// --- UI CONTROLS & LOGIC ---

let panelSide = 'left';
let panelOpen = true;

function toggleSidebar() {
    let sidebar = document.getElementById('sidebar');
    let toggles = document.getElementById('ui-toggles');
    let btn = document.getElementById('btn-collapse');
    panelOpen = !panelOpen;
    
    if (panelSide === 'left') {
        if (panelOpen) {
            sidebar.classList.remove('collapsed-left');
            toggles.style.left = '340px';
            btn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        } else {
            sidebar.classList.add('collapsed-left');
            toggles.style.left = '20px';
            btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        }
    } else {
        if (panelOpen) {
            sidebar.classList.remove('collapsed-right');
            toggles.style.right = '340px';
            btn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        } else {
            sidebar.classList.add('collapsed-right');
            toggles.style.right = '20px';
            btn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        }
    }
}

function switchSide() {
    panelSide = panelSide === 'left' ? 'right' : 'left';
    let sidebar = document.getElementById('sidebar');
    let toggles = document.getElementById('ui-toggles');
    let btn = document.getElementById('btn-collapse');
    
    if (panelSide === 'right') {
        sidebar.classList.add('right-side');
        toggles.style.left = 'auto';
        if (panelOpen) {
            toggles.style.right = '340px';
            btn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        } else {
            sidebar.classList.remove('collapsed-left');
            sidebar.classList.add('collapsed-right');
            toggles.style.right = '20px';
        }
    } else {
        sidebar.classList.remove('right-side');
        toggles.style.right = 'auto';
        if (panelOpen) {
            toggles.style.left = '340px';
            btn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        } else {
            sidebar.classList.remove('collapsed-right');
            sidebar.classList.add('collapsed-left');
            toggles.style.left = '20px';
        }
    }
}

function resetCamera() {
    if (camera && controls) {
        camera.position.set(0, 15, 20);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

// NEW V2.9: The Hotkeys Cheat Sheet
function showShortcuts() {
    let message = "W, A, S, D: Walk around\nLeft Click: Select/Drag Items\nRight Click: Rotate Camera\nScroll: Zoom In/Out\n\nR: Rotate Selected Item 90°\nC: Duplicate Selected Item\nDelete/Backspace: Delete Selected";
    showError(message);
}

function updateInspectorUI() {
    if (!selectedItem) return;
    let inspector = document.getElementById('inspector');
    if (inspector) inspector.style.display = 'block';
    
    let selectedItemName = document.getElementById('selectedItemName');
    if (selectedItemName) selectedItemName.innerHTML = `<i class="fa-solid fa-cube"></i> ${selectedItem.userData.name}`;
    
    let d = selectedItem.userData;
    let wFt = document.getElementById('editW_ft'); if (wFt) wFt.value = Math.floor(d.w); 
    let wIn = document.getElementById('editW_in'); if (wIn) wIn.value = Math.round((d.w % 1) * 12);
    let hFt = document.getElementById('editH_ft'); if (hFt) hFt.value = Math.floor(d.h); 
    let hIn = document.getElementById('editH_in'); if (hIn) hIn.value = Math.round((d.h % 1) * 12);
    let lFt = document.getElementById('editL_ft'); if (lFt) lFt.value = Math.floor(d.l); 
    let lIn = document.getElementById('editL_in'); if (lIn) lIn.value = Math.round((d.l % 1) * 12);
    let eFt = document.getElementById('editE_ft'); if (eFt) eFt.value = Math.floor(selectedItem.position.y); 
    let eIn = document.getElementById('editE_in'); if (eIn) eIn.value = Math.round((selectedItem.position.y % 1) * 12);
    
    let rot = Math.round(THREE.MathUtils.radToDeg(selectedItem.rotation.y) % 360);
    let editRot = document.getElementById('editRot');
    if (editRot) editRot.value = rot < 0 ? rot + 360 : rot;
    let rotDisplay = document.getElementById('rotDisplay');
    if (rotDisplay && editRot) rotDisplay.innerText = editRot.value + '°';
    
    let btnTexture = document.getElementById('btn-texture');
    if (btnTexture) btnTexture.style.display = (d.name === 'Curtains' || d.name === 'Poster') ? 'flex' : 'none';
    
    let btnToggleDoor = document.getElementById('btn-toggle-door');
    if (btnToggleDoor) {
        btnToggleDoor.style.display = d.name.includes('Door') ? 'flex' : 'none';
        btnToggleDoor.innerHTML = selectedItem.userData.isOpen ? '<i class="fa-solid fa-door-closed"></i> Close Door' : '<i class="fa-solid fa-door-open"></i> Open Door';
    }
}

function updateSelectedSize() {
    if (selectedItem) {
        let wFt = document.getElementById('editW_ft'); let wIn = document.getElementById('editW_in');
        let newW = (wFt ? parseFloat(wFt.value) || 0 : 0) + (wIn ? parseFloat(wIn.value) || 0 : 0) / 12;
        let hFt = document.getElementById('editH_ft'); let hIn = document.getElementById('editH_in');
        let newH = (hFt ? parseFloat(hFt.value) || 0 : 0) + (hIn ? parseFloat(hIn.value) || 0 : 0) / 12;
        let lFt = document.getElementById('editL_ft'); let lIn = document.getElementById('editL_in');
        let newL = (lFt ? parseFloat(lFt.value) || 0 : 0) + (lIn ? parseFloat(lIn.value) || 0 : 0) / 12;
        
        if (newW > 0 && newH > 0 && newL > 0) {
            saveState(); isTimeTraveling = true; 
            let d = selectedItem.userData, pos = selectedItem.position.clone(), rot = selectedItem.rotation.y;
            scene.remove(selectedItem); furniture = furniture.filter(f => f !== selectedItem);
            addItem(d.name, newW, newH, newL, d.color, d.isGhost, pos.x, pos.z, rot, pos.y, d.isOpen);
            selectedItem = furniture[furniture.length - 1]; 
            updateInspectorUI(); isTimeTraveling = false;
        }
    }
}

function updateSelectedElevation() { if (selectedItem) { saveState(); let eFt = document.getElementById('editE_ft'), eIn = document.getElementById('editE_in'); selectedItem.position.y = (eFt ? parseFloat(eFt.value) || 0 : 0) + (eIn ? parseFloat(eIn.value) || 0 : 0) / 12; updateWalls(); } }
function updateSelectedRotation() { if (selectedItem) { let editRot = document.getElementById('editRot'); if (!editRot) return; let deg = editRot.value; let rotDisplay = document.getElementById('rotDisplay'); if (rotDisplay) rotDisplay.innerText = deg + '°'; selectedItem.rotation.y = THREE.MathUtils.degToRad(deg); if (selectedItem.userData.name.includes('Door') || selectedItem.userData.name === 'Window') updateWalls(); } }
function duplicateSelected() { if (selectedItem) { saveState(); let d = selectedItem.userData; addItem(d.name, d.w, d.h, d.l, d.color, d.isGhost, selectedItem.position.x + 1, selectedItem.position.z + 1, selectedItem.rotation.y, selectedItem.position.y, d.isOpen); } }
function deleteSelected() { if (selectedItem) { saveState(); scene.remove(selectedItem); furniture = furniture.filter(f => f !== selectedItem); selectedItem = null; let inspector = document.getElementById('inspector'); if (inspector) inspector.style.display = 'none'; updateWalls(); } }

function rotateSelected() {
    if (selectedItem) {
        saveState();
        selectedItem.rotation.y += Math.PI / 2; // Adds 90 degrees
        
        let rot = Math.round(THREE.MathUtils.radToDeg(selectedItem.rotation.y) % 360);
        let editRot = document.getElementById('editRot');
        if (editRot) editRot.value = rot < 0 ? rot + 360 : rot;
        let rotDisplay = document.getElementById('rotDisplay');
        if (rotDisplay) rotDisplay.innerText = rot + '°';
        
        if (selectedItem.userData.name.includes('Door') || selectedItem.userData.name === 'Window') updateWalls();
    }
}

function toggleDoor() {
    if (!selectedItem || !selectedItem.userData.name.includes('Door')) return;
    selectedItem.userData.isOpen = !selectedItem.userData.isOpen;
    let isOpen = selectedItem.userData.isOpen, name = selectedItem.userData.name, w = selectedItem.userData.w;
    let dm = selectedItem.children.find(c => c.userData && c.userData.isDoorMesh);
    if (dm) { if (name === 'Wood Door') dm.rotation.y = isOpen ? -Math.PI / 2 : 0; else dm.position.x = isOpen ? w * 0.9 : 0; }
    saveState(); updateInspectorUI(); 
}

// NEW V2.9 FIX: 4K Perfect Posters!
function applyTexture(event) {
    if (!selectedItem) return;
    let file = event.target.files[0];
    if (file) {
        let reader = new FileReader();
        reader.onload = function(e) {
            let tex = new THREE.TextureLoader().load(e.target.result);
            
            // Turn up the texture filtering to maximum quality
            if (renderer) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            tex.encoding = THREE.sRGBEncoding;

            selectedItem.children.forEach(child => { 
                if (child.isMesh && child.geometry && child.geometry.type !== "CylinderGeometry") { 
                    
                    // If it is a Poster, make it glow slightly so it ignores shadows and looks like a real image
                    if (selectedItem.userData.name === 'Poster') {
                        child.material = new THREE.MeshBasicMaterial({ 
                            map: tex, 
                            color: 0xffffff 
                        });
                    } else {
                        // Regular furniture (like Curtains) get the standard texture
                        child.material = child.material.clone(); 
                        child.material.map = tex; 
                        child.material.color.setHex(0xffffff); 
                    }
                    
                    child.material.needsUpdate = true; 
                } 
            });
            saveState();
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
}

function showError(msg) { let alertText = document.getElementById('alert-text'), alertBox = document.getElementById('custom-alert'); if (alertText && alertBox) { alertText.innerText = msg; alertBox.style.display = 'block'; } else console.error(msg); }
function closeAlert() { let alertBox = document.getElementById('custom-alert'); if (alertBox) alertBox.style.display = 'none'; }
function exportBlueprint() { if (composer) composer.render(); else if (renderer && scene && camera) renderer.render(scene, camera); if (renderer) { let link = document.createElement('a'); link.download = 'StudioAarna_Snapshot.png'; link.href = renderer.domElement.toDataURL('image/png'); link.click(); showError("Snapshot exported!"); } }
function clearCanvas() { saveState(); furniture.forEach(f => scene.remove(f)); furniture = []; selectedItem = null; let inspector = document.getElementById('inspector'); if (inspector) inspector.style.display = 'none'; updateWalls(); }