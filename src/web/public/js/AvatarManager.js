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
        this.animations = {}; // Diubah menjadi Object agar bisa dipanggil berdasarkan nama
        this.currentAction = null;
        this.currentAnimName = "";
        this.vrmaEndTime = 0;
        
        // Sistem State Machine
        this.isCurrentlySpeaking = false;
        this.talkSwitchInterval = null;
        
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

            this.createPresentationBoard(); // Membuat papan tulis di sebelah Waguri
            this._extractBones();

            this.mixer = new THREE.AnimationMixer(this.vrm.scene);

            // Daftar semua aset Anda
            const vrmaList = [
                'Angry', 'Bashful', 'Happy', 'Standing Arguing', 
                'Standing Greeting', 'Talking', 'Thankful', 'Thinking', 'Yawn'
            ];
            await this.loadVRMA(vrmaList);

            // Pancing dengan pose awal
            this._playVRMANamed('Bashful', 0, false);

        } catch (error) {
            console.error("❌ Gagal memuat Avatar:", error);
        }
    }

    async loadVRMA(fileNames) {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

        for (const name of fileNames) {
            const url = `./${name}.vrma`;
            try {
                const fullUrl = new URL(url, window.location.href).href;
                
                const response = await fetch(fullUrl, { method: 'HEAD' });
                if (!response.ok) {
                    console.warn(`⚠️ SERVER MENOLAK AKSES (HTTP ${response.status}): ${url}`);
                    continue; 
                }

                const gltf = await loader.loadAsync(url);
                const vrmAnimation = gltf.userData.vrmAnimations?.[0];
                
                if (vrmAnimation) {
                    const clip = createVRMAnimationClip(vrmAnimation, this.vrm);
                    this.animations[name] = clip; // Simpan menggunakan nama file
                    console.log(`✅ VRMA berhasil dimuat: ${name}`);
                }
            } catch (error) {
                console.error(`❌ Gagal memproses VRMA (${url}):`, error);
            }
        }
    }

    createPresentationBoard() {
        // Buat geometri layar dengan rasio 16:9 (Lebar 1.6, Tinggi 0.9)
        const geometry = new THREE.PlaneGeometry(1.6, 0.9); 
        // Default warna hitam keabu-abuan saat belum ada gambar
        const material = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });
        
        this.boardMesh = new THREE.Mesh(geometry, material);

        // Atur Posisi: X=1.2 (sebelah kanan Waguri), Y=1.4 (setinggi dada), Z=-0.5 (sedikit ke belakang)
        this.boardMesh.position.set(1.2, 1.4, -0.5);
        
        this.scene.add(this.boardMesh);
    }

    showImageOnBoard(imageUrl) {
        if (!this.boardMesh) return;
        
        const loader = new THREE.TextureLoader();
        loader.load(imageUrl, (texture) => {
            // Pastikan warnanya tidak pudar
            texture.colorSpace = THREE.SRGBColorSpace; 
            
            // Ganti material papan dengan gambar
            this.boardMesh.material.map = texture;
            this.boardMesh.material.color.setHex(0xffffff); // Reset warna dasar ke putih murni
            this.boardMesh.material.needsUpdate = true;
        }, undefined, (err) => {
            console.error("Gagal memuat gambar ke papan tulis:", err);
        });
    }

    clearImageOnBoard() {
        if (!this.boardMesh) return;
        // Hapus tekstur gambar
        this.boardMesh.material.map = null;
        // Kembalikan warna papan ke abu-abu gelap
        this.boardMesh.material.color.setHex(0x222222); 
        this.boardMesh.material.needsUpdate = true;
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

    // FUNGSI BARU: Pemutar Animasi Berdasarkan Nama
    _playVRMANamed(name, time, loop = true) {
        const clip = this.animations[name];
        if (!clip || this.currentAnimName === name) return;

        const action = this.mixer.clipAction(clip);
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        action.clampWhenFinished = true;

        if (this.currentAction) {
            this.currentAction.fadeOut(0.5);
        }
        
        action.reset().fadeIn(0.5).play();
        this.currentAction = action;
        this.currentAnimName = name;

        // Jika loop (sedang bicara), vrmaEndTime dibuat infinity agar idle prosedural tertahan
        // Jika tidak loop (Bashful selesai), idle prosedural akan perlahan mengambil alih
        this.vrmaEndTime = loop ? Infinity : time + clip.duration;
    }

    update(delta, time, isSpeaking = false, volume = 0) {
        if (!this.vrm) return;

        // 1. STATE MACHINE (Deteksi Transisi Bicara)
        if (isSpeaking && !this.isCurrentlySpeaking) {
            // MULAI BICARA
            this.isCurrentlySpeaking = true;
            this._playVRMANamed('Talking', time, true);
            
            // Acak gestur saat bicara panjang
            this.talkSwitchInterval = setInterval(() => {
                if(this.isCurrentlySpeaking) {
                    const talkAnims = ['Talking', 'Standing Arguing', 'Happy'];
                    const randomTalk = talkAnims[Math.floor(Math.random() * talkAnims.length)];
                    this._playVRMANamed(randomTalk, time, true);
                }
            }, 5000 + Math.random() * 3000);

        } else if (!isSpeaking && this.isCurrentlySpeaking) {
            // SELESAI BICARA
            this.isCurrentlySpeaking = false;
            clearInterval(this.talkSwitchInterval);
            
            // Mainkan pose Bashful 1 kali. Setelah Bashful beres, Procedural Idle akan masuk.
            this._playVRMANamed('Bashful', time, false); 
        }

        // 2. UPDATE VRMA MIXER
        if (this.mixer) this.mixer.update(delta);

        // 3. LOGIKA CROSSFADING BERAT (WEIGHT) DARI SCRIPT ASLI ANDA
        const isVrmaPlaying = this.currentAction !== null && time < this.vrmaEndTime;
        
        if (isVrmaPlaying || this.isCurrentlySpeaking) {
            this.idleWeight = THREE.MathUtils.lerp(this.idleWeight, 0, 5 * delta);
        } else {
            this.idleWeight = THREE.MathUtils.lerp(this.idleWeight, 1, 3 * delta);
        }

        // 4. LAYER PROSEDURAL
        if (this.idleWeight > 0.01) {
            const breathe = Math.sin(time * 1.5) * 0.015;
            const sway = Math.sin(time * 0.5) * 0.02;

            if (this.bones.spine) this._blendBone(this.bones.spine, { x: breathe, y: sway, z: 0 }, this.idleWeight);
            if (this.bones.chest) this._blendBone(this.bones.chest, { x: breathe * 0.5, y: sway * 0.5, z: 0 }, this.idleWeight);
            if (this.bones.neck)  this._blendBone(this.bones.neck,  { x: 0, y: -sway * 0.8, z: 0 }, this.idleWeight);

            const armSwing = Math.sin(time * 1.2) * 0.02; 
            this._blendBone(this.bones.lUpperArm, { x: 0, y: 0, z: 1.25 + armSwing }, this.idleWeight);
            this._blendBone(this.bones.rUpperArm, { x: 0, y: 0, z: -1.25 - armSwing }, this.idleWeight);
            this._blendBone(this.bones.lLowerArm, { x: -0.1, y: 0, z: 0.05 }, this.idleWeight);
            this._blendBone(this.bones.rLowerArm, { x: -0.1, y: 0, z: -0.05 }, this.idleWeight);

            this._applyFingersBlended(time, this.idleWeight);
        }

        // 5. KEDIP & LIP SYNC
// 5. KEDIP & LIP SYNC WAJAH
        this._handleBlink(time, delta);
        this._handleExpressions(isSpeaking, volume);

        this.vrm.update(delta);
    }

    // FUNGSI BARU: Memaksa perubahan emosi berdasarkan deteksi teks
    forceEmotion(emotionName, time) {
        if (!this.animations[emotionName] || this.currentAnimName === emotionName) return;
        
        // Hentikan sementara pengacakan gestur agar emosi ini terlihat jelas
        clearInterval(this.talkSwitchInterval);
        
        // Mainkan animasi emosi
        this._playVRMANamed(emotionName, time, true);

        // Lanjutkan pengacakan gestur normal setelah 4 detik
        this.talkSwitchInterval = setInterval(() => {
            if(this.isCurrentlySpeaking) {
                const talkAnims = ['Talking', 'Standing Arguing', 'Happy'];
                const randomTalk = talkAnims[Math.floor(Math.random() * talkAnims.length)];
                this._playVRMANamed(randomTalk, time, true);
            }
        }, 4000 + Math.random() * 3000);
    }

    _blendBone(bone, targetRot, weight) {
        if (!bone) return;
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
                        joint.rotation.z = THREE.MathUtils.lerp(joint.rotation.z, targetZ, weight);
                    }
                });
            });
        };

        applyRot(this.bones.fingersL, 1);  
        applyRot(this.bones.fingersR, -1); 
    }

    _handleExpressions(isSpeaking, volume) {
        const em = this.vrm.expressionManager;
        if (!em) return;

        if (isSpeaking) {
            // Kalikan volume agar sangat sensitif terhadap suara. 
            // Angka 4.0 bisa dinaik-turunkan jika mulut kurang/terlalu lebar.
            const v = Math.min(1.0, volume * 4.0);

            let aa = 0, ih = 0, oh = 0;

            // Logika Vokal Dinamis: Bentuk mulut berubah sesuai seberapa keras suaranya
            if (v > 0.6) {
                aa = v;           // Suara keras = Mulut terbuka lebar (A)
            } else if (v > 0.3) {
                ih = v * 1.2;     // Suara sedang = Mulut melebar ke samping (I/E)
            } else if (v > 0.05) {
                oh = v * 1.5;     // Suara pelan = Bibir sedikit maju/membulat (O/U)
            }

            // Terapkan pergerakan mulut dengan mulus (Lerp)
            em.setValue('aa', THREE.MathUtils.lerp(em.getValue('aa'), aa, 0.4));
            em.setValue('ih', THREE.MathUtils.lerp(em.getValue('ih'), ih, 0.4));
            em.setValue('oh', THREE.MathUtils.lerp(em.getValue('oh'), oh, 0.4));

            // Tambahkan sedikit senyum ramah ('happy') secara konstan saat dia mengajar
            em.setValue('happy', THREE.MathUtils.lerp(em.getValue('happy'), 0.3, 0.1));

        } else {
            // Jika tidak bicara, tutup semua bentuk mulut secara perlahan
            em.setValue('aa', THREE.MathUtils.lerp(em.getValue('aa'), 0, 0.3));
            em.setValue('ih', THREE.MathUtils.lerp(em.getValue('ih'), 0, 0.3));
            em.setValue('oh', THREE.MathUtils.lerp(em.getValue('oh'), 0, 0.3));
            
            // Hilangkan senyum perlahan saat dia kembali ke mode idle
            em.setValue('happy', THREE.MathUtils.lerp(em.getValue('happy'), 0, 0.1));
        }
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