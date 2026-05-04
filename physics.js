// --- MOUSE INTERACTIONS & COLLISIONS ---

function onPointerDown(event) {
    let container = document.getElementById('canvas-container');
    let rect = container.getBoundingClientRect();
    
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    let intersects = raycaster.intersectObjects(furniture, true); 
    
    if (intersects.length > 0) {
        let clickedObj = intersects[0].object;
        while (clickedObj.parent && !clickedObj.userData.isFurniture) {
            clickedObj = clickedObj.parent;
        }
        
        if (clickedObj.userData && clickedObj.userData.isFurniture) {
            saveState(); 
            if (controls) controls.enabled = false; 
            draggingItem = selectedItem = clickedObj;
            
            plane.constant = -draggingItem.position.y;
            raycaster.ray.intersectPlane(plane, dragOffset); 
            dragOffset.sub(draggingItem.position);
            
            updateInspectorUI();
        }
    } else { 
        selectedItem = null; 
        let inspector = document.getElementById('inspector');
        if (inspector) inspector.style.display = 'none'; 
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
        
        let widthEl = document.getElementById('roomWidth');
        let lengthEl = document.getElementById('roomLength');
        let w = widthEl ? parseFloat(widthEl.value) : 12;
        let l = lengthEl ? parseFloat(lengthEl.value) : 10;
        let name = draggingItem.userData.name;
        
        // Wall Snapping
        if (name.includes('Door') || name === 'Window' || name === 'Poster' || name === 'Wall Light' || name === 'Curtains' || name === 'Balcony') {
            let dL = Math.abs(newX - (-w / 2));
            let dR = Math.abs(newX - (w / 2));
            let dB = Math.abs(newZ - (-l / 2));
            let dF = Math.abs(newZ - (l / 2));
            let minDist = Math.min(dL, dR, dB, dF);
            
            let offset = 0.05;
            if (name === 'Curtains') offset = 0.15; 
            if (name === 'Wall Light') offset = 0.1;
            if (name === 'Balcony') offset = draggingItem.userData.l / 2;
            
            let pad = draggingItem.userData.w / 2;
            
            if (minDist === dL) { 
                newX = -w / 2 + (name === 'Balcony' ? -offset : offset); 
                newZ = THREE.MathUtils.clamp(newZ, -l / 2 + pad, l / 2 - pad);
                draggingItem.rotation.y = Math.PI / 2; 
            } else if (minDist === dR) { 
                newX = w / 2 + (name === 'Balcony' ? offset : -offset); 
                newZ = THREE.MathUtils.clamp(newZ, -l / 2 + pad, l / 2 - pad);
                draggingItem.rotation.y = -Math.PI / 2; 
            } else if (minDist === dB) { 
                newZ = -l / 2 + (name === 'Balcony' ? -offset : offset); 
                newX = THREE.MathUtils.clamp(newX, -w / 2 + pad, w / 2 - pad);
                draggingItem.rotation.y = 0; 
            } else if (minDist === dF) { 
                newZ = l / 2 + (name === 'Balcony' ? offset : -offset); 
                newX = THREE.MathUtils.clamp(newX, -w / 2 + pad, w / 2 - pad);
                draggingItem.rotation.y = Math.PI; 
            }
        } 
        
        // General Collisions
        if (!draggingItem.userData.isGhost && !name.includes('Door') && name !== 'Window' && name !== 'Poster' && name !== 'Wall Light' && name !== 'Curtains' && name !== 'Balcony') {
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
                if (other === draggingItem || other.userData.isGhost || other.userData.name.includes('Door') || other.userData.name === 'Window' || other.userData.name === 'Poster' || other.userData.name === 'Wall Light' || other.userData.name === 'Curtains' || other.userData.name === 'Balcony') continue;
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
    if (controls) controls.enabled = true; 
    if (draggingItem && (draggingItem.userData.name.includes('Door') || draggingItem.userData.name === 'Window')) updateWalls();
    if (draggingItem) { 
        let rotEl = document.getElementById('editRot');
        let dispEl = document.getElementById('rotDisplay');
        if (rotEl && dispEl) {
            rotEl.value = Math.round(THREE.MathUtils.radToDeg(draggingItem.rotation.y) % 360); 
            dispEl.innerText = rotEl.value + '°'; 
        }
    }
    draggingItem = null; 
}