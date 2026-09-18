import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ==========================================
// 1. PROCEDURAL TEXTURE GENERATOR
// ==========================================
class TextureGenerator {
    static createCanvas(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        return { canvas, ctx: canvas.getContext('2d') };
    }

    static generateCarbonFiber() {
        const { canvas, ctx } = this.createCanvas(128);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#222';
        for (let y = 0; y < 128; y += 16) {
            for (let x = 0; x < 128; x += 16) {
                if ((x + y) % 32 === 0) {
                    ctx.fillRect(x, y, 16, 8);
                    ctx.fillRect(x + 8, y + 8, 16, 8);
                }
            }
        }
        for(let i = 0; i < 2000; i++) {
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
            ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }

    static generateBrushedMetal() {
        const { canvas, ctx } = this.createCanvas(256);
        ctx.fillStyle = '#888';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 1000; i++) {
            ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.1})`;
            ctx.fillRect(Math.random() * 256, 0, Math.random() * 2, 256);
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
            ctx.fillRect(Math.random() * 256, 0, Math.random() * 2, 256);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    static generateSpeakerMesh() {
        const { canvas, ctx } = this.createCanvas(128);
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#000';
        for (let y = 0; y < 128; y += 8) {
            for (let x = 0; x < 128; x += 8) {
                ctx.beginPath();
                ctx.arc(x + 4, y + 4, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(10, 10);
        return texture;
    }
}

// ==========================================
// 2. MATERIAL FACTORY
// ==========================================
class MaterialFactory {
    static getCarbon() {
        if (!this.carbonTex) this.carbonTex = TextureGenerator.generateCarbonFiber();
        return new THREE.MeshStandardMaterial({
            color: 0x111111, metalness: 0.6, roughness: 0.7,
            map: this.carbonTex, bumpMap: this.carbonTex, bumpScale: 0.01
        });
    }

    static getBrushedMetal() {
        if (!this.metalTex) this.metalTex = TextureGenerator.generateBrushedMetal();
        return new THREE.MeshStandardMaterial({
            color: 0xaaaaaa, metalness: 1.0, roughness: 0.3, map: this.metalTex
        });
    }

    static getSpeakerMesh() {
        if (!this.speakerTex) this.speakerTex = TextureGenerator.generateSpeakerMesh();
        return new THREE.MeshStandardMaterial({
            color: 0x333333, metalness: 0.3, roughness: 0.8,
            map: this.speakerTex, bumpMap: this.speakerTex, bumpScale: 0.05
        });
    }

    static getThickGlass() {
        return new THREE.MeshPhysicalMaterial({
            color: 0xffffff, metalness: 0.1, roughness: 0.05,
            transmission: 1.0, ior: 1.45, thickness: 1.5, transparent: true, opacity: 1
        });
    }

    static getNeon(colorHex, intensity = 2) {
        return new THREE.MeshStandardMaterial({
            color: colorHex, emissive: colorHex, emissiveIntensity: intensity
        });
    }

    static getNeonTransparent(colorHex, opacity = 0.8) {
        return new THREE.MeshStandardMaterial({
            color: colorHex, emissive: colorHex, emissiveIntensity: 1.5,
            transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        });
    }
    
    static getCeramic() {
        return new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.15 });
    }
}

// ==========================================
// 3. ORGANIZED 3D MODELS (BUILDERS)
// ==========================================
class BevelUtils {
    static createRoundedBox(width, height, depth, radius0) {
        const shape = new THREE.Shape();
        const x = -width/2, y = -height/2;
        shape.moveTo(x, y + radius0);
        shape.lineTo(x, y + height - radius0);
        shape.quadraticCurveTo(x, y + height, x + radius0, y + height);
        shape.lineTo(x + width - radius0, y + height);
        shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius0);
        shape.lineTo(x + width, y + radius0);
        shape.quadraticCurveTo(x + width, y, x + width - radius0, y);
        shape.lineTo(x + radius0, y);
        shape.quadraticCurveTo(x, y, x, y + radius0);

        return new THREE.ExtrudeGeometry(shape, {
            depth: depth - radius0 * 2, bevelEnabled: true, bevelSegments: 4, steps: 2,
            bevelSize: radius0, bevelThickness: radius0
        });
    }
}

class VisionARModel {
    static build() {
        const group = new THREE.Group();
        const matGlass = MaterialFactory.getThickGlass();
        const matFrame = MaterialFactory.getCarbon();
        const matMetal = MaterialFactory.getBrushedMetal();
        const matNeon = MaterialFactory.getNeonTransparent(0x00f0ff, 0.8);

        const lensGeom = BevelUtils.createRoundedBox(1.6, 0.9, 0.05, 0.2);
        const l1 = new THREE.Mesh(lensGeom, matGlass); l1.position.set(-0.85, 0, -0.025);
        const l2 = new THREE.Mesh(lensGeom, matGlass); l2.position.set(0.85, 0, -0.025);

        const frameGeom = BevelUtils.createRoundedBox(1.7, 1.0, 0.1, 0.25);
        const f1 = new THREE.Mesh(frameGeom, matFrame); f1.position.set(-0.85, 0, -0.15);
        const f2 = new THREE.Mesh(frameGeom, matFrame); f2.position.set(0.85, 0, -0.15);

        const bridgeGeom = BevelUtils.createRoundedBox(0.6, 0.2, 0.1, 0.05);
        const bridge = new THREE.Mesh(bridgeGeom, matMetal);
        bridge.position.set(0, 0.1, -0.15);
        
        const hingeGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16);
        const h1 = new THREE.Mesh(hingeGeom, matMetal); h1.position.set(-1.75, 0, -0.1);
        const h2 = new THREE.Mesh(hingeGeom, matMetal); h2.position.set(1.75, 0, -0.1);

        const armGeom = BevelUtils.createRoundedBox(0.1, 0.3, 2.5, 0.02);
        const a1 = new THREE.Mesh(armGeom, matFrame); a1.position.set(-1.75, 0, -2.6);
        const a2 = new THREE.Mesh(armGeom, matFrame); a2.position.set(1.75, 0, -2.6);

        const hudGeom = new THREE.RingGeometry(0.2, 0.25, 32);
        const hud1 = new THREE.Mesh(hudGeom, matNeon); hud1.position.set(-0.85, 0, 0.05); hud1.userData.spinZ = -0.02;
        const hud2 = new THREE.Mesh(hudGeom, matNeon); hud2.position.set(0.85, 0, 0.05); hud2.userData.spinZ = 0.02;

        group.add(l1, l2, f1, f2, bridge, h1, h2, a1, a2, hud1, hud2);
        return group;
    }
}

class PulseTouchModel {
    static build() {
        const group = new THREE.Group();
        const matCarbon = MaterialFactory.getCarbon();
        const matMetal = MaterialFactory.getBrushedMetal();
        const matNeon = MaterialFactory.getNeon(0xe4ff00, 3);
        const matDark = new THREE.MeshStandardMaterial({color: 0x050505, roughness: 0.9});

        const bandGeom = new THREE.TorusGeometry(1.5, 0.2, 32, 64);
        const band = new THREE.Mesh(bandGeom, matDark);
        group.add(band);

        const numSegments = 12;
        for(let i=0; i<numSegments; i++) {
            const angle = (i / numSegments) * Math.PI * 2;
            const armorGeom = BevelUtils.createRoundedBox(0.6, 0.8, 0.1, 0.05);
            const armor = new THREE.Mesh(armorGeom, matCarbon);
            
            const armorGroup = new THREE.Group();
            armor.position.z = -0.05;
            armorGroup.add(armor);
            armorGroup.position.set(Math.cos(angle)*1.7, Math.sin(angle)*1.7, 0);
            armorGroup.rotation.z = angle + Math.PI/2;
            group.add(armorGroup);

            const pinG = new THREE.CylinderGeometry(0.03, 0.03, 0.85, 16);
            const pin = new THREE.Mesh(pinG, matMetal);
            pin.position.set(Math.cos(angle + 0.25)*1.65, Math.sin(angle + 0.25)*1.65, 0);
            pin.rotation.z = angle + 0.25;
            group.add(pin);
            
            const neonG = new THREE.BoxGeometry(0.05, 0.2, 0.4);
            const neon = new THREE.Mesh(neonG, matNeon);
            neon.position.set(Math.cos(angle)*1.3, Math.sin(angle)*1.3, 0);
            neon.rotation.z = angle;
            group.add(neon);
        }
        group.rotation.x = Math.PI / 2;
        return group;
    }
}

class AuraRingModel {
    static build() {
        const group = new THREE.Group();
        const matMetal = MaterialFactory.getBrushedMetal();
        const matNeon = MaterialFactory.getNeon(0x00f0ff, 5);
        const matDark = MaterialFactory.getCarbon();

        const outerGeom = new THREE.TorusGeometry(1.2, 0.25, 64, 128);
        const outer = new THREE.Mesh(outerGeom, matMetal);
        
        const innerGeom = new THREE.TorusGeometry(1.15, 0.1, 64, 128);
        const inner = new THREE.Mesh(innerGeom, matDark);
        
        const neonGeom = new THREE.TorusGeometry(1.22, 0.05, 32, 128);
        const neon = new THREE.Mesh(neonGeom, matNeon);
        
        const grooveGeom = new THREE.TorusGeometry(1.25, 0.01, 8, 128);
        const g1 = new THREE.Mesh(grooveGeom, matDark); g1.position.z = 0.1;
        const g2 = new THREE.Mesh(grooveGeom, matDark); g2.position.z = -0.1;

        group.add(outer, inner, neon, g1, g2);
        return group;
    }
}

class HoloDeskModel {
    static build() {
        const group = new THREE.Group();
        const matCarbon = MaterialFactory.getCarbon();
        const matMetal = MaterialFactory.getBrushedMetal();
        const matNeon = MaterialFactory.getNeonTransparent(0x00f0ff, 0.5);
        const matGlow = MaterialFactory.getNeon(0x00f0ff, 4);

        const baseGeom = new THREE.CylinderGeometry(1.5, 1.8, 0.5, 64);
        const base = new THREE.Mesh(baseGeom, matCarbon);
        base.position.y = -0.25;

        const ringGeom = new THREE.TorusGeometry(1.3, 0.1, 32, 64);
        const ring = new THREE.Mesh(ringGeom, matMetal);
        ring.rotation.x = Math.PI/2;
        
        const mountGeom = new THREE.CylinderGeometry(0.8, 1.2, 0.2, 64);
        const mount = new THREE.Mesh(mountGeom, matMetal);
        mount.position.y = 0.1;

        const lensGeom = new THREE.SphereGeometry(0.5, 32, 32, 0, Math.PI*2, 0, Math.PI/2);
        const lens = new THREE.Mesh(lensGeom, matGlow);
        lens.position.y = 0.2;

        const holoGeom = new THREE.ConeGeometry(2, 4, 64, 1, true);
        const hologram = new THREE.Mesh(holoGeom, matNeon);
        hologram.position.y = 2.2;
        hologram.rotation.x = Math.PI;

        const coreGroup = new THREE.Group();
        for(let i=0; i<3; i++) {
            const wRing = new THREE.TorusGeometry(0.5 + (i*0.3), 0.01, 16, 64);
            const wMesh = new THREE.Mesh(wRing, MaterialFactory.getNeon(0x00f0ff, 2));
            wMesh.rotation.x = Math.PI/2;
            wMesh.position.y = (i*0.5) - 0.5;
            wMesh.userData.spinY = 0.02 + (i*0.01);
            wMesh.userData.spinX = (i%2 === 0) ? 0.01 : -0.01;
            coreGroup.add(wMesh);
        }
        coreGroup.position.y = 2.5;

        group.add(base, ring, mount, lens, hologram, coreGroup);
        return group;
    }
}

class HydroSmartModel {
    static build() {
        const group = new THREE.Group();
        const matGlass = MaterialFactory.getThickGlass();
        const matMetal = MaterialFactory.getBrushedMetal();
        const matCarbon = MaterialFactory.getCarbon();
        const matNeon = MaterialFactory.getNeonTransparent(0x00f0ff, 0.9);

        const shellGeom = new THREE.CylinderGeometry(0.9, 0.9, 4, 64);
        const shell = new THREE.Mesh(shellGeom, matGlass);
        
        const waterGeom = new THREE.CylinderGeometry(0.8, 0.8, 3.8, 64);
        const water = new THREE.Mesh(waterGeom, matNeon);
        
        const baseGeom = new THREE.CylinderGeometry(0.92, 0.92, 0.8, 64);
        const base = new THREE.Mesh(baseGeom, matCarbon);
        base.position.y = -2.4;

        const baseTrimGeom = new THREE.TorusGeometry(0.92, 0.05, 16, 64);
        const baseTrim = new THREE.Mesh(baseTrimGeom, MaterialFactory.getNeon(0x00f0ff, 3));
        baseTrim.rotation.x = Math.PI/2;
        baseTrim.position.y = -2;

        const capGeom = new THREE.CylinderGeometry(0.92, 0.92, 0.6, 64);
        const cap = new THREE.Mesh(capGeom, matMetal);
        cap.position.y = 2.3;

        for(let i=0; i<32; i++) {
            const groove = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 8), matCarbon);
            const angle = (i/32) * Math.PI*2;
            groove.position.set(Math.cos(angle)*0.92, 2.3, Math.sin(angle)*0.92);
            group.add(groove);
        }

        const bubbles = new THREE.Group();
        for(let i=0; i<15; i++) {
            const bubG = new THREE.SphereGeometry(Math.random()*0.08 + 0.02, 16, 16);
            const bub = new THREE.Mesh(bubG, MaterialFactory.getNeon(0xffffff, 2));
            bub.position.set((Math.random()-0.5)*1.2, (Math.random()-0.5)*3.5, (Math.random()-0.5)*1.2);
            bubbles.add(bub);
        }
        bubbles.userData.spinY = 0.01;

        group.add(shell, water, base, baseTrim, cap, bubbles);
        return group;
    }
}

class PureAirModel {
    static build() {
        const group = new THREE.Group();
        const matCeramic = MaterialFactory.getCeramic();
        const matMetal = MaterialFactory.getBrushedMetal();
        const matMesh = MaterialFactory.getSpeakerMesh();
        const matNeon = MaterialFactory.getNeon(0x00f0ff, 3);

        const haloGeom = new THREE.TorusGeometry(1.6, 0.25, 64, 128, Math.PI * 1.4);
        const halo = new THREE.Mesh(haloGeom, matCeramic);
        halo.rotation.z = Math.PI * 0.8;

        const innerMeshGeom = new THREE.TorusGeometry(1.6, 0.26, 32, 128, Math.PI * 1.0);
        const innerMesh = new THREE.Mesh(innerMeshGeom, matMesh);
        innerMesh.rotation.z = Math.PI * 1.0;

        const jointGeom = new THREE.TorusGeometry(1.62, 0.05, 16, 64, 0.2);
        const j1 = new THREE.Mesh(jointGeom, matMetal); j1.rotation.z = Math.PI * 0.8;
        const j2 = new THREE.Mesh(jointGeom, matMetal); j2.rotation.z = Math.PI * 2.2 - 0.2;
        
        const tipGeom = new THREE.CylinderGeometry(0.24, 0.1, 0.4, 32);
        const t1 = new THREE.Mesh(tipGeom, matNeon);
        t1.position.set(Math.cos(Math.PI*0.8)*1.6, Math.sin(Math.PI*0.8)*1.6, 0);
        t1.rotation.z = Math.PI*0.8 + Math.PI/2;

        const t2 = new THREE.Mesh(tipGeom, matNeon);
        t2.position.set(Math.cos(Math.PI*2.2)*1.6, Math.sin(Math.PI*2.2)*1.6, 0);
        t2.rotation.z = Math.PI*2.2 - Math.PI/2;

        group.add(halo, innerMesh, j1, j2, t1, t2);
        return group;
    }
}

class OrbitalSoundModel {
    static build() {
        const group = new THREE.Group();
        const matMetal = MaterialFactory.getBrushedMetal();
        const matDark = MaterialFactory.getCarbon();
        const matMesh = MaterialFactory.getSpeakerMesh();
        const matNeon = MaterialFactory.getNeon(0xff003c, 4);

        const baseGeom = new THREE.CylinderGeometry(1.6, 1.8, 0.5, 64);
        const base = new THREE.Mesh(baseGeom, matMetal);
        base.position.y = -1.5;
        
        const topBaseG = new THREE.CylinderGeometry(1.4, 1.6, 0.2, 64);
        const topBase = new THREE.Mesh(topBaseG, matDark);
        topBase.position.y = -1.15;

        const ringGeom = new THREE.TorusGeometry(1.3, 0.06, 32, 64);
        const ring = new THREE.Mesh(ringGeom, matNeon);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -1.0;

        const orbGroup = new THREE.Group();
        const orbGeom = new THREE.SphereGeometry(1.2, 64, 64);
        const orb = new THREE.Mesh(orbGeom, matMesh);
        
        const frameGeom = new THREE.TorusGeometry(1.22, 0.08, 32, 128);
        const f1 = new THREE.Mesh(frameGeom, matMetal);
        const f2 = new THREE.Mesh(frameGeom, matMetal); f2.rotation.x = Math.PI/2;
        const f3 = new THREE.Mesh(frameGeom, matMetal); f3.rotation.y = Math.PI/2;

        const coreG = new THREE.SphereGeometry(1.18, 32, 32);
        const core = new THREE.Mesh(coreG, MaterialFactory.getNeonTransparent(0xff003c, 0.5));

        orbGroup.add(orb, core, f1, f2, f3);
        orbGroup.position.y = 0.8;
        orbGroup.userData.spinY = 0.008;
        orbGroup.userData.spinZ = 0.004;
        orbGroup.userData.spinX = 0.002;

        group.add(base, topBase, ring, orbGroup);
        return group;
    }
}

class BeamTypeModel {
    static build() {
        const group = new THREE.Group();
        const matCarbon = MaterialFactory.getCarbon();
        const matMetal = MaterialFactory.getBrushedMetal();
        const matNeon = MaterialFactory.getNeon(0xff003c, 4);
        const matDarkGlass = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.1, transmission: 0.5, thickness: 0.5 });

        const baseGeom = BevelUtils.createRoundedBox(2.5, 0.8, 1.5, 0.1);
        const base = new THREE.Mesh(baseGeom, matCarbon);
        base.position.set(0, 0.4, -1.5);

        const panelGeom = BevelUtils.createRoundedBox(2.2, 0.5, 0.1, 0.05);
        const panel = new THREE.Mesh(panelGeom, matDarkGlass);
        panel.position.set(0, 0.4, -0.7);

        const emitterG = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16);
        const e1 = new THREE.Mesh(emitterG, matNeon); e1.rotation.x = Math.PI/2; e1.position.set(-0.8, 0.4, -0.75);
        const e2 = new THREE.Mesh(emitterG, matNeon); e2.rotation.x = Math.PI/2; e2.position.set(0.8, 0.4, -0.75);

        const camGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 32);
        const cam = new THREE.Mesh(camGeom, matMetal);
        cam.position.set(0, 0.9, -1.2);
        const camLens = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32, 0, Math.PI*2, 0, Math.PI/2), matDarkGlass);
        camLens.position.set(0, 1.0, -1.2);

        const grid = new THREE.GridHelper(6, 30, 0xff003c, 0x550011);
        grid.position.set(0, 0.01, 2.0);
        
        const kbCanvas = document.createElement('canvas');
        kbCanvas.width = 1024; kbCanvas.height = 512;
        const ctx = kbCanvas.getContext('2d');
        ctx.fillStyle = '#000'; ctx.fillRect(0,0,1024,512);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        
        const rows = [
            ['1','2','3','4','5','6','7','8','9','0','-','='],
            ['Q','W','E','R','T','Y','U','I','O','P','[',']'],
            ['A','S','D','F','G','H','J','K','L',';',"'",'ENTER'],
            ['Z','X','C','V','B','N','M',',','.','/','SHIFT']
        ];
        const kH = 60, gap = 15;
        rows.forEach((row, r) => {
            let startX = 80 + (r * 25);
            row.forEach(key => {
                let kW = 60;
                if(key === 'ENTER') kW = 120;
                if(key === 'SHIFT') kW = 150;
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
                ctx.strokeRect(startX, 60 + r*(kH+gap), kW, kH);
                ctx.fillText(key, startX + kW/2, 60 + r*(kH+gap) + kH/2);
                startX += kW + gap;
            });
        });
        ctx.strokeRect(250, 60 + 4*(kH+gap), 450, kH); // Spacebar
        
        const kbTex = new THREE.CanvasTexture(kbCanvas);
        const kbMat = new THREE.MeshStandardMaterial({
            color: 0x000000, emissive: 0xff003c, emissiveMap: kbTex, 
            emissiveIntensity: 5, transparent: true, alphaMap: kbTex,
            side: THREE.DoubleSide
        });
        const kbPlane = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), kbMat);
        kbPlane.rotation.x = -Math.PI/2;
        kbPlane.position.set(0, 0.02, 2.0);
        group.add(kbPlane);
        
        group.add(base, panel, e1, e2, cam, camLens, grid);
        return group;
    }
}

// Map strings to their respective Builder Classes
const ModelRegistry = {
    'visionar': VisionARModel,
    'pulsetouch': PulseTouchModel,
    'auraring': AuraRingModel,
    'holodesk': HoloDeskModel,
    'hydrosmart': HydroSmartModel,
    'pureair': PureAirModel,
    'orbital': OrbitalSoundModel,
    'beamtype': BeamTypeModel
};

// ==========================================
// 4. MAIN APP LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // UI Interactions (Preloader, Cursor, Nav, Reveals)
    setTimeout(() => {
        document.getElementById('preloader').classList.add('hidden');
        setTimeout(initReveals, 500);
    }, 1500);

    const cursorDot = document.getElementById('cursor-dot');
    const cursorOutline = document.getElementById('cursor-outline');
    if (!('ontouchstart' in window)) {
        window.addEventListener('mousemove', (e) => {
            cursorDot.style.left = `${e.clientX}px`;
            cursorDot.style.top = `${e.clientY}px`;
            cursorOutline.animate({ left: `${e.clientX}px`, top: `${e.clientY}px` }, { duration: 300, fill: "forwards" });
        });
        document.querySelectorAll('a, button, .product-item, input').forEach(el => {
            el.addEventListener('mouseenter', () => cursorOutline.classList.add('hover'));
            el.addEventListener('mouseleave', () => cursorOutline.classList.remove('hover'));
        });
    } else {
        cursorDot.style.display = 'none';
        cursorOutline.style.display = 'none';
    }

    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 50));

    document.getElementById('mobile-menu-btn')?.addEventListener('click', function() {
        document.querySelector('.nav-links').classList.toggle('active');
        const icon = this.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    });

    function initReveals() {
        const els = document.querySelectorAll('.reveal-fade, .reveal-slide, .reveal-text');
        els.forEach(e => e.classList.add('hidden'));
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if(entry.isIntersecting) {
                    entry.target.classList.remove('hidden');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
        els.forEach(e => observer.observe(e));
    }

    // Form
    document.getElementById('lead-form')?.addEventListener('submit', function(e) {
        e.preventDefault();
        const btn = this.querySelector('button');
        btn.innerHTML = 'PROCESSING... <i class="fas fa-spinner fa-spin"></i>';
        setTimeout(() => {
            this.style.display = 'none';
            document.getElementById('form-success').style.display = 'block';
        }, 1500);
    });

    // Background Particles
    const bgCtx = document.getElementById('bg-canvas').getContext('2d');
    const pArr = Array.from({length: 150}, () => ({
        x: Math.random() * innerWidth, y: Math.random() * innerHeight,
        r: Math.random() * 1.5, dx: (Math.random()-0.5)*0.5, dy: (Math.random()-0.5)*0.5
    }));
    function drawBg() {
        bgCtx.canvas.width = innerWidth; bgCtx.canvas.height = innerHeight;
        bgCtx.fillStyle = 'rgba(228, 255, 0, 0.5)';
        pArr.forEach(p => {
            p.x += p.dx; p.y += p.dy;
            if(p.x<0||p.x>innerWidth) p.dx*=-1;
            if(p.y<0||p.y>innerHeight) p.dy*=-1;
            bgCtx.beginPath(); bgCtx.arc(p.x, p.y, p.r, 0, 6.28); bgCtx.fill();
        });
        requestAnimationFrame(drawBg);
    }
    drawBg();

    // ==========================================
    // 5. THREE.JS ENGINE & MODAL
    // ==========================================
    const canvas = document.getElementById('webgl-canvas');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 3, 8);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    
    const spotLight = new THREE.SpotLight(0xffffff, 60);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    spotLight.castShadow = true;
    scene.add(spotLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 2.5, 0.5, 0.1);
    composer.addPass(bloom);

    const modelContainer = new THREE.Group();
    scene.add(modelContainer);

    function resize() {
        const w = canvas.parentElement.clientWidth, h = canvas.parentElement.clientHeight;
        if(!w || !h) return;
        renderer.setSize(w, h); composer.setSize(w, h);
        camera.aspect = w/h; camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        spotLight.position.copy(camera.position);
        spotLight.position.y += 5;

        // Apply internal rotations defined by builders
        if (modelContainer.children.length > 0) {
            modelContainer.children[0].traverse((child) => {
                if (child.userData.spinX) child.rotation.x += child.userData.spinX;
                if (child.userData.spinY) child.rotation.y += child.userData.spinY;
                if (child.userData.spinZ) child.rotation.z += child.userData.spinZ;
            });
        }
        composer.render();
    }
    animate();

    const productsData = {
        visionar: { title: 'VISION<span class="neon-text">AR</span> GLASS', desc: 'Óculos de Realidade Aumentada Ultraleves. Projeção holográfica de GPS, notificações e tradução de idiomas em tempo real diretamente na sua retina.', specs: ['Display: Micro-OLED 4K por olho', 'Bateria: 18 horas de uso contínuo', 'Sensores: Eye-tracking e Gestos'] },
        pulsetouch: { title: 'PULSETOUCH <span class="neon-text">PRO</span>', desc: 'Pulseira Háptica para Treinamento e Games. Emite feedback tátil e vibrações direcionais imersivas para jogos e treinos de alta performance.', specs: ['Feedback: 12 atuadores lineares independentes', 'Conexão: Bluetooth 6.0 Zero Latency', 'Material: Grafeno flexível'] },
        auraring: { title: 'AURA<span class="neon-text">RING</span>', desc: 'Anel inteligente que permite controlar apresentações, mídia e dispositivos de casa inteligente usando apenas gestos no ar.', specs: ['Sensores: Giroscópio 9 Eixos + Acelerômetro', 'Resistência: IP68 (À prova d\'água)', 'Carregamento: Indução magnética ultrarrápida'] },
        holodesk: { title: 'HOLO<span class="neon-text">DESK</span> AI', desc: 'Assistente virtual de mesa que projeta gráficos em 3D e interfaces flutuantes interativas bem na sua frente.', specs: ['Projeção: Matriz Fotônica 8K', 'IA: Processamento Neural Local de 50 TOPS', 'Interação: Câmeras LiDAR de profundidade'] },
        hydrosmart: { title: 'HYDRO<span class="neon-text">SMART</span>', desc: 'Garrafa inteligente que limpa a própria água via LED UV-C e envia alertas de hidratação baseados no seu metabolismo.', specs: ['Capacidade: 750ml', 'Esterilização: Elimina 99.9% das bactérias', 'Bateria: 1 Mês de uso contínuo'] },
        pureair: { title: 'PUREAIR <span class="neon-text">HALO</span>', desc: 'Dispositivo compacto em formato de colar que purifica o ar no microambiente ao redor do usuário filtrando alérgenos e vírus.', specs: ['Filtro: HEPA H14 Nano', 'Fluxo de Ar: 3.5 Litros por segundo', 'Peso: 85 gramas'] },
        orbital: { title: 'ORBITAL <span class="neon-text">SOUND</span>', desc: 'Alto-falante Bluetooth que flutua sobre a base enquanto recarrega por indução. Áudio espacial com propagação 360°.', specs: ['Driver: 50mm Neodímio Dual', 'Potência: 60W RMS', 'Levitação: Eletroímãs de Titânio Ativos'] },
        beamtype: { title: 'BEAM<span class="neon-text">TYPE</span>', desc: 'Gadget ultracompacto que projeta um teclado e um trackpad iluminados em qualquer superfície plana através de lasers de estado sólido.', specs: ['Sensor: Câmera IR de Mapeamento Óptico a 120fps', 'Layout: Full QWERTY + Trackpad', 'Conexão: USB-C e Bluetooth 6.0'] }
    };

    const modal = document.getElementById('product-modal');
    document.querySelectorAll('.product-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-product');
            if (productsData[key]) {
                document.getElementById('modal-title').innerHTML = productsData[key].title;
                document.getElementById('modal-desc').innerHTML = productsData[key].desc;
                document.getElementById('modal-specs').innerHTML = productsData[key].specs.map(s => `<div>// ${s}</div>`).join('');
                
                modelContainer.clear();
                modelContainer.add(ModelRegistry[key].build());
                camera.position.set(0, 3, 8);
                controls.target.set(0, 0, 0);

                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; 
                setTimeout(resize, 100);
            }
        });
    });

    document.getElementById('close-modal').addEventListener('click', () => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    });

    document.getElementById('modal-buy-btn')?.addEventListener('click', () => {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    });
});
