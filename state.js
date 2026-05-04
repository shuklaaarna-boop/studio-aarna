// --- THE ULTIMATE CRASH GUARD ---
window.addEventListener('error', function(e) {
    let alertBox = document.getElementById('custom-alert');
    let alertText = document.getElementById('alert-text');
    if(alertBox && alertText) {
        alertText.innerText = "Code Error: " + e.message;
        alertBox.style.display = 'block';
    } else {
        console.error("Code Error: " + e.message);
    }
});

// --- GLOBAL VARIABLES ---
let furniture = [];
let historyStack = [];
let redoStack = [];
let isTimeTraveling = false; 
let customFloorTexture = null; 

let scene, camera, renderer, controls, composer;
let floorMesh, gridHelper, wallsGroup;
let dirLight, ambientLight; 
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let selectedItem = null;
let draggingItem = null;
let dragOffset = new THREE.Vector3();
let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); 

// --- BACKEND LOGIC ---
function getCurrentState() { 
    let wEl = document.getElementById('roomWidth'), lEl = document.getElementById('roomLength'), cEl = document.getElementById('wallColor'), oEl = document.getElementById('wallOpacity'), sEl = document.getElementById('floorStyle'), tEl = document.getElementById('timeOfDay');
    return {
        width: wEl ? wEl.value : 12, length: lEl ? lEl.value : 10, wallColor: cEl ? cEl.value : "#3a404d", wallOpacity: oEl ? oEl.value : 0.9, floorStyle: sEl ? sEl.value : "wood", timeOfDay: tEl ? tEl.value : "12:00",
        inventory: furniture.map(f => ({ name: f.userData.name, w: f.userData.w, h: f.userData.h, l: f.userData.l, color: f.userData.color, isGhost: f.userData.isGhost, x: f.position.x, y: f.position.y, z: f.position.z, rot: f.rotation.y, isOpen: f.userData.isOpen || false }))
    }; 
}

function saveState() {
    if (isTimeTraveling) return; 
    let cur = getCurrentState();
    if (historyStack.length > 0 && JSON.stringify(historyStack[historyStack.length - 1]) === JSON.stringify(cur)) return;
    historyStack.push(cur); 
    if (historyStack.length > 20) historyStack.shift(); 
    redoStack = [];
}

function loadState(state) {
    if (!state) return;
    isTimeTraveling = true; 
    let wEl = document.getElementById('roomWidth'); if (wEl) wEl.value = state.width || 12; 
    let lEl = document.getElementById('roomLength'); if (lEl) lEl.value = state.length || 10; 
    let cEl = document.getElementById('wallColor'); if (cEl) cEl.value = state.wallColor || "#3a404d"; 
    let oEl = document.getElementById('wallOpacity'); if (oEl) oEl.value = state.wallOpacity || 0.9; 
    let sEl = document.getElementById('floorStyle'); if (sEl) sEl.value = state.floorStyle || "wood"; 
    let tEl = document.getElementById('timeOfDay'); if (tEl) tEl.value = state.timeOfDay || "12:00";
    
    updateLighting(); buildRoom();
    furniture.forEach(f => scene.remove(f)); furniture = []; selectedItem = null;
    let inspector = document.getElementById('inspector'); if (inspector) inspector.style.display = 'none';
    
    if (state.inventory && Array.isArray(state.inventory)) {
        state.inventory.forEach(item => addItem(item.name, item.w, item.h, item.l, item.color, item.isGhost, item.x, item.z, item.rot, item.y, item.isOpen));
    }
    isTimeTraveling = false; updateWalls();
}

function saveRoom() { 
    try { localStorage.setItem('aarnaRoomDesign3D', JSON.stringify(getCurrentState())); showError("Room saved!"); } 
    catch(e) { showError("Could not save."); } 
}

function loadRoom() { 
    try { 
        let dat = localStorage.getItem('aarnaRoomDesign3D'); 
        if (dat) loadState(JSON.parse(dat)); 
    } catch (e) { localStorage.removeItem('aarnaRoomDesign3D'); } 
}

function copyShareLink() { 
    let url = window.location.origin + window.location.pathname + '?room=' + btoa(JSON.stringify(getCurrentState())); 
    navigator.clipboard.writeText(url).then(() => showError("Share link copied!")).catch(() => showError("Failed to copy.")); 
}

function undo() { if (historyStack.length > 0) { redoStack.push(getCurrentState()); loadState(historyStack.pop()); } }
function redo() { if (redoStack.length > 0) { historyStack.push(getCurrentState()); loadState(redoStack.pop()); } }