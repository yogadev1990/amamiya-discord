import { setupScene } from './SceneSetup.js';
import { AudioEngine } from './AudioEngine.js';
import { AvatarManager } from './AvatarManager.js';
import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";
import * as THREE from 'three';

// Inisialisasi Komponen
const { scene, camera, renderer } = setupScene();
const audio = new AudioEngine();
const avatar = new AvatarManager(scene);
const clock = new THREE.Clock();
const socket = io();

// UI Elements
const startScreen = document.getElementById('start-screen');
const statusEl = document.getElementById('status');
const uiLayer = document.getElementById('ui-layer');
const teksEl = document.getElementById('teks-ai');

// Load Avatar & Start Loop
avatar.load('./avatar.vrm').then(() => {
    animate();
});

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.elapsedTime;

    avatar.update(delta, time, audio.isSpeaking, audio.getVolume());
    renderer.render(scene, camera);
}

// Interaction
startScreen.addEventListener('click', () => {
    audio.init();
    startScreen.style.display = 'none';
    statusEl.style.display = 'block';
});

socket.on('connect', () => {
    statusEl.innerText = '🟢 Amamiya Siap Mendengar';
});

socket.on('ai_speak', (data) => {
    if (data.teks) {
        teksEl.innerText = `"${data.teks}"`;
        uiLayer.style.display = 'block';
    }
    if (data.emosi) avatar.setEmotion(data.emosi);
    if (data.audioData) {
        audio.play(data.audioData, () => {
            uiLayer.style.display = 'none';
            avatar.setEmotion('neutral');
        });
    }
});