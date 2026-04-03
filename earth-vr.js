// ============================================================================
// VR Earth Simulation using Three.js
// Đồ án giữa kỳ: Mô phỏng Trái Đất xoay trong VR
// ============================================================================

class EarthVRSimulation {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.earth = null;
        this.earthNight = null;
        this.clouds = null;
        this.frameCount = 0;
        this.lastTime = performance.now();
        
        // VR Properties
        this.xrSession = null;
        this.xrRefSpace = null;
        this.isVR = false;
        this.controllers = {};
        this.hands = { left: null, right: null };
        this.gestures = { leftPinch: false, rightPinch: false, leftGrab: false, rightGrab: false };
        
        this.init();
    }

    // Initialize Three.js scene
    init() {
        try {
            console.log('🌍 Starting Earth VR Simulation...');
            
            // Scene setup
            this.scene = new THREE.Scene();
            console.log('✓ Scene created');
            
            // Camera setup
            const width = window.innerWidth;
            const height = window.innerHeight;
            this.camera = new THREE.PerspectiveCamera(
                75,
                width / height,
                0.1,
                10000
            );
            this.camera.position.z = 3;
            console.log('✓ Camera created');
            
            // Renderer setup - HIGH QUALITY
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: false,
                powerPreference: 'high-performance',
                precision: 'highp'
            });
            this.renderer.setSize(width, height);
            this.renderer.setPixelRatio(window.devicePixelRatio);
            
            // Better shadow rendering
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
            this.renderer.shadowMap.resolution = 4096; // Higher resolution shadows
            
            // Better color rendering
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.8;  // Reduced from 1.2 for more detail
            
            document.getElementById('container').appendChild(this.renderer.domElement);
            console.log('✓ Renderer created with high-quality settings');
            console.log('   ✨ ACES Filmic tone mapping enabled');
            console.log('   ✨ sRGB color space enabled');
            console.log('   ✨ 4K shadow resolution enabled');
            
            // Initialize WebXR for VR Support
            this.initializeWebXR();
            
            // Create scene elements
            console.log('Creating scene elements...');
            this.createStarfield();
            console.log('✓ Starfield created');
            
            this.createEarth();
            console.log('✓ Earth created');
            
            this.createCloudLayer();
            console.log('✓ Clouds created');
            
            this.createLighting();
            console.log('✓ Lighting created (3-point system)');
            
            // Setup controls
            this.setupControls();
            console.log('✓ Controls setup');
            
            // Event listeners
            window.addEventListener('resize', () => this.onWindowResize());
            window.addEventListener('keydown', (e) => this.handleKeyPress(e));
            console.log('✓ Event listeners added');
            
            // Start animation loop
            this.animate();
            console.log('✅ Earth VR Simulation started!');
            console.log('');
            console.log('Load textures:');
            console.log('  - earth.jpg (for Earth)');
            console.log('  - clouds.png (for Clouds)');
            console.log('  - stars.jpg (for Stars)');
        } catch (error) {
            console.error('❌ Error initializing simulation:', error);
            console.error(error.stack);
        }
    }

    // Create starfield background
    createStarfield() {
        // Try to load stars.jpg first
        const textureLoader = new THREE.TextureLoader();
        
        try {
            textureLoader.load(
                './stars.jpg',
                (texture) => {
                    console.log('✓ Stars texture loaded from stars.jpg');
                    // Use loaded image as background
                    this.scene.background = new THREE.Color(0x000000);
                    
                    // Create a large sphere with stars texture
                    const starSphereGeometry = new THREE.SphereGeometry(500, 64, 64);
                    const starMaterial = new THREE.MeshBasicMaterial({
                        map: texture,
                        side: THREE.BackSide
                    });
                    const starSphere = new THREE.Mesh(starSphereGeometry, starMaterial);
                    this.scene.add(starSphere);
                },
                undefined,
                (error) => {
                    console.warn('⚠️ Failed to load stars.jpg, using procedural stars');
                    this.createProceduralStarfield();
                }
            );
        } catch (error) {
            console.warn('Error loading stars.jpg:', error);
            this.createProceduralStarfield();
        }
    }
    
    // Fallback procedural starfield
    createProceduralStarfield() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 2000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        
        // Generate random star positions
        for (let i = 0; i < starCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 400;
            positions[i + 1] = (Math.random() - 0.5) * 400;
            positions[i + 2] = (Math.random() - 0.5) * 400;
            
            // Random star colors
            const starColor = Math.random();
            if (starColor < 0.5) {
                colors[i] = 1; colors[i + 1] = 1; colors[i + 2] = 1; // White
            } else if (starColor < 0.7) {
                colors[i] = 1; colors[i + 1] = 0.8; colors[i + 2] = 0.5; // Yellow
            } else {
                colors[i] = 0.8; colors[i + 1] = 0.9; colors[i + 2] = 1; // Blue
            }
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Create star material
        const starMaterial = new THREE.PointsMaterial({
            size: 0.5,
            sizeAttenuation: true,
            vertexColors: true,
            transparent: true
        });
        
        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
    }

    // Create Earth texture - load from file or use solid color fallback
    createEarthTexture() {
        const textureLoader = new THREE.TextureLoader();
        let texture;
        
        try {
            texture = textureLoader.load('./earth.jpg');
            console.log('✓ Earth texture loaded from earth.jpg');
        } catch (error) {
            console.warn('⚠️ Earth.jpg not found - add earth.jpg to project folder');
            texture = this.createFallbackEarthTexture();
        }
        
        return texture;
    }
    
    // Simple fallback - solid blue ocean
    createFallbackEarthTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Simple blue ocean
        ctx.fillStyle = '#1a5490';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        return new THREE.CanvasTexture(canvas);
    }

    // Create cloud texture
    createCloudTexture() {
        const textureLoader = new THREE.TextureLoader();
        let texture;
        
        try {
            texture = textureLoader.load('./clouds.png');
            console.log('✓ Cloud texture loaded from clouds.png');
        } catch (error) {
            console.warn('⚠️ Clouds.png not found - add clouds.png to project folder');
            texture = this.createFallbackCloudTexture();
        }
        
        return texture;
    }
    
    createFallbackCloudTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return new THREE.CanvasTexture(canvas);
    }

    // Create Earth sphere
    createEarth() {
        // High-resolution sphere for smooth appearance
        const geometry = new THREE.IcosahedronGeometry(1, 64);
        
        // Load textures
        const dayTexture = this.createEarthTexture();
        const nightTexture = this.createNightmapTexture();
        
        // Create Day Earth material with standard lighting
        const dayMaterial = new THREE.MeshPhongMaterial({
            map: dayTexture,
            shininess: 10,
            emissive: 0x000000,
            specular: 0x222222,
            wireframe: false,
            flatShading: false,
            side: THREE.FrontSide
        });
        
        this.earth = new THREE.Mesh(geometry, dayMaterial);
        this.earth.receiveShadow = false;
        this.earth.castShadow = false;
        this.scene.add(this.earth);
        
        // Create Night Earth overlay - city lights on dark side
        const nightMaterial = new THREE.MeshPhongMaterial({
            emissiveMap: nightTexture,
            emissive: 0x888888,
            emissiveIntensity: 1.5,
            transparent: true,
            opacity: 0.8,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.earthNight = new THREE.Mesh(geometry, nightMaterial);
        this.earthNight.position.z = 0.0001;  // Prevent z-fighting
        this.scene.add(this.earthNight);
        
        // Store textures and material for updates
        this.dayMaterial = dayMaterial;
        this.nightMaterial = nightMaterial;
        
        // Add atmospheric glow for realism
        this.addAtmosphericGlow();
    }
    
    // Load night map texture
    createNightmapTexture() {
        const textureLoader = new THREE.TextureLoader();
        let texture;
        
        try {
            texture = textureLoader.load('./earth_nightmap.jpg');
            console.log('✓ Night map texture loaded from earth_nightmap.jpg');
        } catch (error) {
            console.warn('⚠️ earth_nightmap.jpg not found - using fallback');
            texture = this.createFallbackNightmapTexture();
        }
        
        return texture;
    }
    
    // Fallback procedural night map
    createFallbackNightmapTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Dark background for night
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        return new THREE.CanvasTexture(canvas);
    }
    
    // Add atmospheric glow effect around Earth
    addAtmosphericGlow() {
        // Outer glow layer (blue atmosphere) - subtle
        const glowGeometry = new THREE.IcosahedronGeometry(1.06, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x4499ff,
            transparent: true,
            opacity: 0.08,             // Reduced further for more visibility
            side: THREE.BackSide
        });
        const glow1 = new THREE.Mesh(glowGeometry, glowMaterial);
        this.earth.add(glow1);
        
        // Inner glow layer (very subtle)
        const glowGeometry2 = new THREE.IcosahedronGeometry(1.03, 32);
        const glowMaterial2 = new THREE.MeshBasicMaterial({
            color: 0x2266ff,
            transparent: true,
            opacity: 0.03,             // Reduced further
            side: THREE.BackSide
        });
        const glow2 = new THREE.Mesh(glowGeometry2, glowMaterial2);
        this.earth.add(glow2);
    }

    // Create cloud layer
    createCloudLayer() {
        const geometry = new THREE.IcosahedronGeometry(1.025, 64);
        const texture = this.createCloudTexture();
        
        const material = new THREE.MeshPhongMaterial({
            map: texture,
            transparent: true,
            opacity: 0.20,             // Balanced at 0.20 for natural clouds
            emissive: 0x000000,        // NO self-illumination
            specular: 0x000000,        // No shiny reflections on clouds
            depthWrite: false,
            shininess: 0,              // Completely matte
            side: THREE.FrontSide
        });
        
        this.clouds = new THREE.Mesh(geometry, material);
        this.clouds.castShadow = false;
        this.scene.add(this.clouds);
    }

    // Setup lighting
    createLighting() {
        // Main Sun Light - MUCH STRONGER for visible day/night contrast
        const sunLight = new THREE.DirectionalLight(0xfffbf0, 1.0);  // Reduced to 1.0 for better detail
        sunLight.position.set(15, 8, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.camera.left = -15;
        sunLight.shadow.camera.right = 15;
        sunLight.shadow.camera.top = 15;
        sunLight.shadow.camera.bottom = -15;
        sunLight.shadow.camera.near = 0.1;
        sunLight.shadow.camera.far = 100;
        sunLight.shadow.bias = -0.001;
        this.scene.add(sunLight);
        
        // Fill light - WEAKER for more contrast (dark side should be darker)
        const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.35);  // Reduced to further darken
        fillLight.position.set(-10, 5, -8);
        this.scene.add(fillLight);
        
        // Back light - subtle rim light
        const backLight = new THREE.DirectionalLight(0xffa500, 0.2);  // Reduced from 0.3
        backLight.position.set(0, -3, -15);
        this.scene.add(backLight);
        
        // Ambient light - MUCH DARKER (key to creating day/night contrast)
        const ambientLight = new THREE.AmbientLight(0x333344, 0.25);  // Reduced to 0.25
        this.scene.add(ambientLight);
        
        // Hemisphere light - subtle
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x1a1a2e, 0.3);  // Reduced from 0.6
        this.scene.add(hemiLight);
        
        // Add visual Sun (glowing sphere to show light source)
        this.createSunVisual();
        
        console.log('✓ Professional lighting with strong day/night contrast');
    }
    
    // Create visual representation of the sun
    createSunVisual() {
        const textureLoader = new THREE.TextureLoader();
        let sunTexture = null;
        
        // Load sun.jpg
        try {
            sunTexture = textureLoader.load('./sun.jpg');
            console.log('✓ Sun texture loaded from sun.jpg');
        } catch (error) {
            console.warn('⚠️ Sun.jpg not found');
            sunTexture = this.createSunTexture();
        }
        
        // Main sun sphere - bright with strong self-illumination
        const sunGeometry = new THREE.IcosahedronGeometry(0.3, 64);
        const sunMaterial = new THREE.MeshPhongMaterial({
            map: sunTexture,
            color: 0xffff99,              // Bright yellow base
            emissive: 0xffff88,           // Strong self-illumination
            emissiveIntensity: 2.0,       // Makes center bright
            specular: 0xffff00,           // Yellow specular
            shininess: 50,
            wireframe: false,
            side: THREE.FrontSide
        });
        const sun = new THREE.Mesh(sunGeometry, sunMaterial);
        sun.position.set(15, 8, 10);
        this.scene.add(sun);
        
        // Layer 1: Inner bright glow (immediate halo)
        const layer1Geometry = new THREE.IcosahedronGeometry(0.35, 32);
        const layer1Material = new THREE.MeshBasicMaterial({
            color: 0xffff99,
            transparent: true,
            opacity: 0.6,
            side: THREE.FrontSide,
            toneMapped: false
        });
        const layer1 = new THREE.Mesh(layer1Geometry, layer1Material);
        layer1.position.copy(sun.position);
        this.scene.add(layer1);
        
        // Layer 2: Medium glow (soft glow)
        const layer2Geometry = new THREE.IcosahedronGeometry(0.45, 32);
        const layer2Material = new THREE.MeshBasicMaterial({
            color: 0xffdd66,
            transparent: true,
            opacity: 0.4,
            side: THREE.FrontSide,
            toneMapped: false
        });
        const layer2 = new THREE.Mesh(layer2Geometry, layer2Material);
        layer2.position.copy(sun.position);
        this.scene.add(layer2);
        
        // Layer 3: Outer glow (corona - largest and most transparent)
        const layer3Geometry = new THREE.IcosahedronGeometry(0.65, 32);
        const layer3Material = new THREE.MeshBasicMaterial({
            color: 0xffcc44,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide,
            toneMapped: false
        });
        const layer3 = new THREE.Mesh(layer3Geometry, layer3Material);
        layer3.position.copy(sun.position);
        this.scene.add(layer3);
        
        // Layer 4: Far glow (very subtle, gives depth)
        const layer4Geometry = new THREE.IcosahedronGeometry(1.0, 16);
        const layer4Material = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.08,
            side: THREE.BackSide,
            toneMapped: false
        });
        const layer4 = new THREE.Mesh(layer4Geometry, layer4Material);
        layer4.position.copy(sun.position);
        this.scene.add(layer4);
        
        // Add point light at sun position for realistic lighting
        const sunLight = new THREE.PointLight(0xffff88, 0.8, 50);
        sunLight.position.copy(sun.position);
        this.scene.add(sunLight);
        
        console.log('✓ Realistic sun with 4-layer glow created');
    }
    
    // Fallback procedural sun if jpg not found
    createSunTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base sun gradient
        const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
        gradient.addColorStop(0, '#ffff99');
        gradient.addColorStop(0.3, '#ffdd55');
        gradient.addColorStop(0.7, '#ff9900');
        gradient.addColorStop(1, '#ff6600');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Solar granulation
        ctx.fillStyle = 'rgba(255, 200, 0, 0.6)';
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const dist = Math.sqrt((x - 256) ** 2 + (y - 256) ** 2);
            
            if (dist < 240) {
                const size = 2 + Math.random() * 4;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // Sunspots
        ctx.fillStyle = 'rgba(100, 50, 0, 0.8)';
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 100 + Math.random() * 80;
            const x = 256 + Math.cos(angle) * distance;
            const y = 256 + Math.sin(angle) * distance;
            const size = 5 + Math.random() * 15;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        return new THREE.CanvasTexture(canvas);
    }

    // Setup simple mouse controls (no external library needed)
    setupControls() {
        this.cameraRotation = { x: 0, y: 0 };
        this.cameraDistance = 3;
        this.mouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetDistance = this.cameraDistance;
        
        console.log('✓ Simple mouse controls initialized');
        
        // Mouse events
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            this.mouseDown = true;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        
        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (this.mouseDown) {
                const deltaX = e.clientX - this.mouseX;
                const deltaY = e.clientY - this.mouseY;
                
                // Rotate based on mouse movement
                this.cameraRotation.y += deltaX * 0.005;
                this.cameraRotation.x += deltaY * 0.005;
                
                // Clamp vertical rotation
                this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
                
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
            }
        });
        
        this.renderer.domElement.addEventListener('mouseup', () => {
            this.mouseDown = false;
        });
        
        // Zoom with mouse wheel
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.targetDistance += e.deltaY * 0.01;
            this.targetDistance = Math.max(1.5, Math.min(15, this.targetDistance));
        }, { passive: false });
    }
    
    // Update camera position based on rotation
    updateCameraPosition() {
        const distance = this.cameraDistance;
        
        // Smooth zoom animation
        this.cameraDistance += (this.targetDistance - this.cameraDistance) * 0.05;
        
        // Calculate camera position with spherical coordinates
        this.camera.position.x = Math.sin(this.cameraRotation.y) * Math.cos(this.cameraRotation.x) * this.cameraDistance;
        this.camera.position.y = Math.sin(this.cameraRotation.x) * this.cameraDistance;
        this.camera.position.z = Math.cos(this.cameraRotation.y) * Math.cos(this.cameraRotation.x) * this.cameraDistance;
        
        // Always look at center
        this.camera.lookAt(0, 0, 0);
    }

    // ============ VR SUPPORT METHODS ============
    
    // Initialize WebXR for Meta Quest VR
    async initializeWebXR() {
        if (!navigator.xr) {
            console.log('⚠️ WebXR not supported - Desktop mode only');
            return;
        }
        
        try {
            // Enable XR on renderer
            const supported = await navigator.xr.isSessionSupported('immersive-vr');
            if (supported) {
                // Add VR entry button
                this.createVRButton();
                console.log('✓ WebXR VR mode available');
            } else {
                console.log('⚠️ VR not supported on this device');
            }
        } catch (error) {
            console.log('⚠️ WebXR check failed:', error);
        }
    }
    
    // Create VR Entry Button
    createVRButton() {
        const button = document.createElement('button');
        button.textContent = '🥽 Enter VR Mode';
        button.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #00ff88;
            color: #000;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
            z-index: 1000;
            transition: all 0.3s;
        `;
        button.onmouseover = () => button.style.background = '#00ff99';
        button.onmouseout = () => button.style.background = '#00ff88';
        button.onclick = () => this.enterVRMode();
        document.body.appendChild(button);
        this.vrButton = button;
    }
    
    // Enter VR Mode
    async enterVRMode() {
        try {
            this.xrSession = await navigator.xr.requestSession('immersive-vr', {
                requiredFeatures: ['hand-tracking', 'local-floor'],
                optionalFeatures: ['hand-tracking']
            });
            
            this.isVR = true;
            console.log('✓ VR Mode Activated!');
            
            // Setup XR rendering
            await this.renderer.xr.setSession(this.xrSession);
            this.setupVRControllers();
            this.vrButton.textContent = '🥽 Exit VR Mode';
            this.vrButton.onclick = () => this.exitVRMode();
            
        } catch (error) {
            console.error('❌ Failed to enter VR:', error);
        }
    }
    
    // Exit VR Mode
    async exitVRMode() {
        if (this.xrSession) {
            await this.xrSession.end();
            this.isVR = false;
            console.log('✓ VR Mode Disabled');
            this.vrButton.textContent = '🥽 Enter VR Mode';
            this.vrButton.onclick = () => this.enterVRMode();
        }
    }
    
    // Setup VR Hand Controllers and Tracking
    setupVRControllers() {
        const session = this.xrSession;
        
        // Track input sources (hand controllers + hand tracking)
        session.addEventListener('inputsourceschange', (event) => {
            for (const source of event.added) {
                if (source.hand) {
                    const side = source.handedness;
                    this.hands[side] = {
                        inputSource: source,
                        joints: {},
                        visible: true
                    };
                    console.log(`✓ Hand tracking (${side}) connected`);
                }
            }
            
            for (const source of event.removed) {
                if (source.hand) {
                    const side = source.handedness;
                    if (this.hands[side]) {
                        this.hands[side] = null;
                        console.log(`✗ Hand tracking (${side}) disconnected`);
                    }
                }
            }
        });
        
        console.log('✓ VR Controllers initialized');
    }
    
    // Update Hand Tracking Data
    updateHandTracking(frame) {
        const session = frame.session;
        
        // Update hand poses
        for (const inputSource of session.inputSources) {
            if (inputSource.hand) {
                const side = inputSource.handedness;
                const hand = this.hands[side];
                if (hand) {
                    try {
                        const pose = frame.getPose(inputSource, this.xrRefSpace);
                        if (pose) {
                            // Get hand joints for gesture detection
                            this.updateHandJoints(inputSource, frame);
                            this.detectGestures(side);
                        }
                    } catch (error) {
                        console.warn('Hand tracking update failed:', error);
                    }
                }
            }
        }
    }
    
    // Update Hand Joint Positions
    updateHandJoints(inputSource, frame) {
        const side = inputSource.handedness;
        const hand = this.hands[side];
        if (!hand) return;
        
        try {
            // Get all hand joints (thumb, index, middle, ring, pinky)
            for (const jointName of ['thumb-tip', 'index-finger-tip', 'middle-finger-tip', 
                                     'ring-finger-tip', 'pinky-finger-tip', 'wrist']) {
                try {
                    const space = inputSource.hand.get(jointName);
                    const pose = frame.getPose(space, this.xrRefSpace);
                    if (pose) {
                        hand.joints[jointName] = {
                            position: pose.transform.position,
                            radius: pose.inputSource?.hand?.get(jointName)?.radius || 0.008
                        };
                    }
                } catch (e) {
                    // Joint not available
                }
            }
        } catch (error) {
            console.warn('Could not update hand joints:', error);
        }
    }
    
    // Detect Hand Gestures (Pinch, Grab, etc)
    detectGestures(side) {
        const hand = this.hands[side];
        if (!hand || !hand.joints) return;
        
        const thumb = hand.joints['thumb-tip'];
        const index = hand.joints['index-finger-tip'];
        const middle = hand.joints['middle-finger-tip'];
        const wrist = hand.joints['wrist'];
        
        if (!thumb || !index) return;
        
        // Calculate distance between thumb and index (for pinch detection)
        const pinchDistance = Math.hypot(
            thumb.position.x - index.position.x,
            thumb.position.y - index.position.y,
            thumb.position.z - index.position.z
        );
        
        // Pinch gesture (distance < 0.05 meters = 5cm)
        const isPinching = pinchDistance < 0.05;
        this.gestures[`${side}Pinch`] = isPinching;
        
        // If pinching - zoom Earth
        if (isPinching && !this.lastPinchState?.[side]) {
            this.applyHapticFeedback(side, 0.5, 50);
            console.log(`▪️ ${side} Pinch detected`);
        }
        
        if (isPinching) {
            // Zoom based on hand distance from wrist
            if (wrist && middle) {
                const handOpenness = Math.hypot(
                    middle.position.x - wrist.position.x,
                    middle.position.y - wrist.position.y,
                    middle.position.z - wrist.position.z
                );
                this.targetDistance = 1.5 + handOpenness * 3;
                this.targetDistance = Math.max(1.5, Math.min(15, this.targetDistance));
            }
        }
        
        if (!this.lastPinchState) this.lastPinchState = {};
        this.lastPinchState[side] = isPinching;
    }
    
    // Apply Haptic Feedback
    async applyHapticFeedback(side, intensity = 0.5, duration = 50) {
        try {
            const hand = this.hands[side];
            if (hand?.inputSource?.gamepad?.hapticActuators) {
                const actuators = hand.inputSource.gamepad.hapticActuators;
                if (actuators.length > 0) {
                    await actuators[0].pulse(intensity, duration);
                }
            }
        } catch (error) {
            // Haptic not available
        }
    }
    
    // Update VR Controls Each Frame
    updateVRControls(frame) {
        if (!this.isVR || !this.xrSession) return;
        
        this.xrRefSpace = this.xrRefSpace || frame.session.requestReferenceSpace('local-floor');
        
        // Update hand tracking
        if (this.hands.left || this.hands.right) {
            this.updateHandTracking(frame);
        }
        
        // Apply hand rotation if gesture detected
        for (const side of ['left', 'right']) {
            if (this.gestures[`${side}Pinch`]) {
                const hand = this.hands[side];
                if (hand?.joints?.['index-finger-tip']) {
                    // Use hand position to rotate view
                    const fingerPos = hand.joints['index-finger-tip'].position;
                    // Subtle rotation based on finger position
                    this.cameraRotation.y += fingerPos.x * 0.01;
                    this.cameraRotation.x += fingerPos.y * 0.01;
                }
            }
        }
    }

    // Handle keyboard input
    handleKeyPress(event) {
        switch(event.code) {
            case 'KeyR':
                this.resetView();
                break;
            case 'KeyF':
                const infoPanel = document.getElementById('info');
                infoPanel.style.display = infoPanel.style.display === 'none' ? 'block' : 'none';
                break;
        }
    }
    
    // Reset camera view
    resetView() {
        this.cameraRotation = { x: 0, y: 0 };
        this.cameraDistance = 3;
        this.targetDistance = 3;
        this.camera.position.set(0, 0, 3);
        this.camera.lookAt(0, 0, 0);
        console.log('🔄 Camera reset to default view');
    }

    // Handle window resize
    onWindowResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // Update Earth and cloud rotation
    update() {
        if (this.earth) {
            this.earth.rotation.y += 0.001; // Earth rotates
        }
        if (this.earthNight) {
            this.earthNight.rotation.y += 0.001; // Night Earth rotates with day earth
        }
        if (this.clouds) {
            this.clouds.rotation.y += 0.001; // Clouds rotate WITH Earth (same speed - physics accurate)
        }
        
        // Update camera position based on mouse
        this.updateCameraPosition();
    }

    // Update FPS counter
    updateFPS() {
        this.frameCount++;
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastTime;
        
        if (elapsed >= 1000) {
            document.getElementById('fps').textContent = `FPS: ${this.frameCount}`;
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
    }

    // Main animation loop
    animate = () => {
        this.renderer.setAnimationLoop((time, frame) => {
            // Support both VR and desktop rendering
            if (this.isVR && frame) {
                this.updateVRControls(frame);
            }
            
            this.update();
            this.updateFPS();
            this.renderer.render(this.scene, this.camera);
        });
    }
}

// Start application when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    console.log('📍 DOM Content Loaded - Initializing simulation...');
    try {
        window.simulation = new EarthVRSimulation();
    } catch (error) {
        console.error('❌ Failed to create simulation:', error);
        console.error(error.stack);
    }
});
