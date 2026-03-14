import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AvatarManager } from './AvatarManager.js';
import { AudioManager } from './AudioManager.js';
import { SocketManager } from './SocketManager.js';

// --- SETUP UI ---
const statusEl = document.getElementById('status');
const uiLayer = document.getElementById('ui-layer');
const teksEl = document.getElementById('teks-ai');
const btnStart = document.getElementById('btn-start');
const startScreen = document.getElementById('start-screen');

// --- SETUP THREE.JS ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 20);
camera.position.set(0, 1.4, 1.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.4, 0);
controls.update();

const light = new THREE.DirectionalLight(0xffffff, 2.0);
light.position.set(1, 1, 1).normalize();
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// --- INISIALISASI MANAGER ---
const avatarManager = new AvatarManager(scene);

let kalimatAktif = ""; 
let hideUITimeout = null; 
let isGeminiReady = false; // FLAG PENCEGAH ERROR 1008
// --- BACA URL PARAMETERS ---
const urlParams = new URLSearchParams(window.location.search);
const discordUserId = urlParams.get('user');
const sessionId = urlParams.get('session');

// Modifikasi saat tombol mulai ditekan:
btnStart.addEventListener('click', async () => {
    startScreen.style.display = 'none';
    await audioManager.startMicrophone(); 
    
    // Kirim ID User ke server saat menghubungkan socket
    socketManager.connect(discordUserId, sessionId); 
});

const socketManager = new SocketManager({
    onStatus: (msg) => {
        statusEl.style.display = 'block';
        statusEl.innerText = msg;
        
        if (msg.includes('Siap Mendengar')) {
            socketManager.sendSetup();
        }
        
        if (msg.includes('Setup Selesai')) {
            isGeminiReady = true;
        }
    },
    
    // --- TAMBAHKAN PINTU KHUSUS GAMBAR DI SINI ---
    onImage: (url) => {
        console.log("Menerima gambar dari server:", url);
        avatarManager.showImageOnBoard(url);
    },
    // ---------------------------------------------

    onText: (text) => {
        clearTimeout(hideUITimeout); 
        kalimatAktif += text;
        teksEl.innerText = `"${kalimatAktif}"`;
        uiLayer.style.display = 'block';

        // --- SISTEM DETEKSI EMOSI BERDASARKAN KATA KUNCI ---
        const lowerText = kalimatAktif.toLowerCase();
        const time = clock.elapsedTime;

        if (lowerText.includes("salah") || lowerText.includes("jangan") || lowerText.includes("harus")) {
            avatarManager.forceEmotion('Angry', time);
        } else if (lowerText.includes("halo") || lowerText.includes("pagi") || lowerText.includes("bye")) {
            avatarManager.forceEmotion('Standing Greeting', time);
        } else if (lowerText.includes("bagus") || lowerText.includes("benar") || lowerText.includes("tepat")) {
            avatarManager.forceEmotion('Happy', time);
        } else if (lowerText.includes("hmm") || lowerText.includes("coba saya pikir") || lowerText.includes("sebentar")) {
            avatarManager.forceEmotion('Thinking', time);
        } else if (lowerText.includes("terima kasih") || lowerText.includes("maaf") || lowerText.includes("silakan")) {
            avatarManager.forceEmotion('Thankful', time);
        } else if (lowerText.includes("lelah") || lowerText.includes("ngantuk") || lowerText.includes("panjang sekali")) {
            avatarManager.forceEmotion('Yawn', time);
        }
    },
    
    onAudio: (base64Audio) => {
        audioManager.enqueueAudio(base64Audio);
    }
});

const audioManager = new AudioManager(
    (base64MicData) => {
        // ATURAN MUTLAK: Jangan kirim audio jika Gemini belum siap
        if (isGeminiReady) {
            socketManager.sendAudio(base64MicData);
        }
    },
    () => {
        clearTimeout(hideUITimeout);
        hideUITimeout = setTimeout(() => {
            uiLayer.style.display = 'none';
            kalimatAktif = ""; 
        }, 1500); 
    }
);

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.elapsedTime;
    
    avatarManager.update(delta, time, audioManager.isSpeaking, audioManager.currentVolume);
    renderer.render(scene, camera);
}

// --- EVENT LISTENERS ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

btnStart.addEventListener('click', async () => {
    startScreen.style.display = 'none';
    await audioManager.startMicrophone(); 
    socketManager.connect();
});

// --- JALANKAN ---
avatarManager.load('./avatar.vrm').then(() => {
    animate();
});