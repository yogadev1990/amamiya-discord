import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';

export class AvatarManager {
    constructor(scene) {
        this.scene = scene;
        this.vrm = null;
        this.bones = {};
        
        this.blinkState = 0;
        this.blinkProgress = 0;
        this.nextBlinkTime = 3;

        // Sistem VRMA
        this.mixer = null;
        this.animations = [];
        this.currentAction = null;
        this.vrmaEndTime = 0;
        this.nextAnimTime = 5; 
        
        // PENTING: Variabel untuk transisi mulus antara VRMA dan Idle Prosedural
        this.idleWeight = 1.0; 
    }

    async load(url) {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        
        try {
            const gltf = await loader.loadAsync(url);
            this.vrm = gltf.userData.vrm;
            
            VRMUtils.removeUnnecessaryJoints(gltf.scene);
            this.scene.add(this.vrm.scene);
            this.vrm.scene.rotation.y = Math.PI; 
            
            this._extractBones();

            this.mixer = new THREE.AnimationMixer(this.vrm.scene);

            const vrmaList = [
                './VRMA_01.vrma', './VRMA_02.vrma', './VRMA_03.vrma',
                './VRMA_04.vrma', './VRMA_05.vrma', './VRMA_06.vrma', './VRMA_07.vrma'
            ];
            this.loadVRMA(vrmaList);
        } catch (error) {
            console.error("❌ Gagal memuat Avatar:", error);
        }
    }

    async loadVRMA(urls) {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

        for (const url of urls) {
            try {
                const fullUrl = new URL(url, window.location.href).href;
                console.log(`🔍 Memeriksa lokasi file di: ${fullUrl}`);

                const response = await fetch(fullUrl, { method: 'HEAD' });
                if (!response.ok) {
                    console.warn(`⚠️ SERVER MENOLAK AKSES (HTTP ${response.status}): Server Anda tidak mengenali atau memblokir file ${url}`);
                    continue; 
                }

                const gltf = await loader.loadAsync(url);
                const vrmAnimation = gltf.userData.vrmAnimations?.[0];
                
                if (vrmAnimation) {
                    const clip = createVRMAnimationClip(vrmAnimation, this.vrm);
                    this.animations.push(clip);
                    console.log(`✅ VRMA berhasil dimuat: ${url}`);
                } else {
                    console.warn(`⚠️ File terbaca, tapi isinya tidak memiliki data VRMAnimation: ${url}`);
                }
            } catch (error) {
                console.error(`❌ Gagal memproses VRMA (${url}):`, error);
            }
        }
    }

    _extractBones() {
        const h = this.vrm.humanoid;
        const getChain = (side, name) => [
            h.getNormalizedBoneNode(`${side}${name}Proximal`),
            h.getNormalizedBoneNode(`${side}${name}Intermediate`),
            h.getNormalizedBoneNode(`${side}${name}Distal`)
        ];

        this.bones = {
            spine: h.getNormalizedBoneNode('spine'),
            chest: h.getNormalizedBoneNode('chest'),
            neck: h.getNormalizedBoneNode('neck'),
            
            lUpperArm: h.getNormalizedBoneNode('leftUpperArm'),
            lLowerArm: h.getNormalizedBoneNode('leftLowerArm'),
            rUpperArm: h.getNormalizedBoneNode('rightUpperArm'),
            rLowerArm: h.getNormalizedBoneNode('rightLowerArm'),

            fingersL: [
                getChain('left', 'Thumb'), getChain('left', 'Index'),
                getChain('left', 'Middle'), getChain('left', 'Ring'), getChain('left', 'Little')
            ],
            fingersR: [
                getChain('right', 'Thumb'), getChain('right', 'Index'),
                getChain('right', 'Middle'), getChain('right', 'Ring'), getChain('right', 'Little')
            ]
        };
    }

    update(delta, time, isSpeaking = false, volume = 0) {
        if (!this.vrm) return;

        // 1. UPDATE VRMA MIXER
        if (this.mixer) this.mixer.update(delta);

        // Menentukan fase animasi: Sedang main, atau transisi kembali ke Idle
        const isVrmaPlaying = this.currentAction !== null && time < this.vrmaEndTime;
        
        // Logika Crossfading Berat (Weight)
        if (isVrmaPlaying) {
            // Saat VRMA main, bobot idle turun perlahan ke 0
            this.idleWeight = THREE.MathUtils.lerp(this.idleWeight, 0, 5 * delta);
        } else {
            // Saat VRMA selesai, bobot idle naik perlahan ke 1 (Transisi Mulus)
            this.idleWeight = THREE.MathUtils.lerp(this.idleWeight, 1, 3 * delta);
        }

        // Play random VRMA jika sedang tidak bicara dan waktu jeda sudah habis
        if (this.animations.length > 0 && time > this.nextAnimTime && !isSpeaking) {
            this._playRandomVRMA(time);
        }

        // 2. LAYER PROSEDURAL DENGAN PENCAMPURAN BOBOT (WEIGHT BLENDING)
        // Kita hanya mengaplikasikan rotasi idle jika bobotnya > 0.01 untuk efisiensi
        if (this.idleWeight > 0.01) {
            
            const breathe = Math.sin(time * 1.5) * 0.015;
            const sway = Math.sin(time * 0.5) * 0.02;

            // --- A. NAPAS & AYUNAN (Menggunakan slerp/lerp agar bercampur dengan akhir VRMA) ---
            if (this.bones.spine) this._blendBone(this.bones.spine, { x: breathe, y: sway, z: 0 }, this.idleWeight);
            if (this.bones.chest) this._blendBone(this.bones.chest, { x: breathe * 0.5, y: sway * 0.5, z: 0 }, this.idleWeight);
            if (this.bones.neck)  this._blendBone(this.bones.neck,  { x: 0, y: -sway * 0.8, z: 0 }, this.idleWeight);

            // --- B. LENGAN CEWEK (Jatuh natural) ---
            const armSwing = Math.sin(time * 1.2) * 0.02; 
            this._blendBone(this.bones.lUpperArm, { x: 0, y: 0, z: 1.25 + armSwing }, this.idleWeight);
            this._blendBone(this.bones.rUpperArm, { x: 0, y: 0, z: -1.25 - armSwing }, this.idleWeight);
            
            this._blendBone(this.bones.lLowerArm, { x: -0.1, y: 0, z: 0.05 }, this.idleWeight);
            this._blendBone(this.bones.rLowerArm, { x: -0.1, y: 0, z: -0.05 }, this.idleWeight);

            // --- C. JARI LENTIK ---
            this._applyFingersBlended(time, this.idleWeight);
        }

        // 3. KEDIP & LIP SYNC (Selalu berjalan independen dari gerakan tubuh)
        this._handleBlink(time, delta);
        if (isSpeaking) {
            const mouthOpen = Math.min(1.0, volume / 45.0);
            this.vrm.expressionManager.setValue('aa', THREE.MathUtils.lerp(this.vrm.expressionManager.getValue('aa'), mouthOpen, 0.4));
        }

        this.vrm.update(delta);
    }

    _playRandomVRMA(time) {
        const clip = this.animations[Math.floor(Math.random() * this.animations.length)];
        const action = this.mixer.clipAction(clip);
        
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;

        if (this.currentAction) {
            this.currentAction.fadeOut(0.5);
        }
        
        action.reset().fadeIn(0.5).play();
        this.currentAction = action;

        // Jadwal selesai dan animasi berikutnya
        this.vrmaEndTime = time + clip.duration;
        this.nextAnimTime = this.vrmaEndTime + (5 + Math.random() * 10);
    }

    // FUNGSI BARU: Mencampur rotasi saat ini dengan rotasi target berdasarkan bobot (0.0 - 1.0)
    _blendBone(bone, targetRot, weight) {
        if (!bone) return;
        // Jika weight 1, rotasi penuh ke target (Idle Prosedural).
        // Jika weight 0, rotasi tidak diubah (Membiarkan VRMA memegang kendali).
        bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, targetRot.x, weight);
        bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, targetRot.y, weight);
        bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, targetRot.z, weight);
    }

    _applyFingersBlended(time, weight) {
        const bendAngles = [0.1, 0.2, 0.3]; 
        
        const applyRot = (fingerGroup, sign) => {
            fingerGroup.forEach((chain, fIdx) => {
                chain.forEach((joint, jIdx) => {
                    if (joint) {
                        const noise = Math.sin(time * 2 + fIdx) * 0.02; 
                        const targetZ = sign * (bendAngles[jIdx] + noise);
                        // Mencampur posisi jari VRMA terakhir dengan posisi jari Idle
                        joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, targetZ, weight);
                    }
                });
            });
        };

        applyRot(this.bones.fingersL, 1);  
        applyRot(this.bones.fingersR, -1); 
    }

    _handleBlink(time, delta) {
        if (this.blinkState === 0 && time > this.nextBlinkTime) {
            this.blinkState = 1;
            this.nextBlinkTime = time + 2 + Math.random() * 5;
        } else if (this.blinkState > 0) {
            const s = 20 * delta;
            this.blinkState === 1 ? this.blinkProgress += s : this.blinkProgress -= s;
            if (this.blinkProgress >= 1) this.blinkState = 2;
            if (this.blinkProgress <= 0) { this.blinkProgress = 0; this.blinkState = 0; }
            this.vrm.expressionManager.setValue('blink', this.blinkProgress);
        }
    }

    // FUNGSI INI DIKEMBALIKAN: Digunakan oleh main.js untuk mengatur emosi dari backend
    setEmotion(name) {
        if (!this.vrm) return;
        
        // Reset semua emosi dasar ke 0 terlebih dahulu agar tidak bertabrakan
        ['happy', 'sad', 'angry', 'surprised', 'neutral'].forEach(e => 
            this.vrm.expressionManager.setValue(e, 0)
        );
        
        // Aktifkan emosi yang diminta
        if (name) {
            this.vrm.expressionManager.setValue(name.toLowerCase(), 1.0);
        } else {
            this.vrm.expressionManager.setValue('neutral', 1.0);
        }
    }
}