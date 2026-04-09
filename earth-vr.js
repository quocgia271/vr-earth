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

        this.isControllerGrabbing = false;
        this.activeController = null;
        this.previousControllerPosition = new THREE.Vector3();
        
        this.tempSunPos = new THREE.Vector3();
        this.tempEarthPos = new THREE.Vector3();
        this.tempSunDir = new THREE.Vector3();

        this.worldAxisX = new THREE.Vector3(1, 0, 0);
this.worldAxisY = new THREE.Vector3(0, 1, 0);
        
        
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
            // Dùng pixel ratio của thiết bị, nhưng giới hạn tối đa ở mức 1.5 để cân bằng độ nét/hiệu năng trong VR
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            
            // Better shadow rendering
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
            this.renderer.shadowMap.resolution = 4096; // Higher resolution shadows
            
            // Better color rendering
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 0.8;  // Reduced from 1.2 for more detail
            this.renderer.xr.enabled = true;
            
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
            // ✨ ĐOẠN CODE MỚI CẦN THÊM VÀO ĐÚNG CHỖ NÀY
            // ==========================================
            this.universeGroup = new THREE.Group();
            this.scene.add(this.universeGroup);

            // Gom các đối tượng vào Group. 
            // (Three.js sẽ tự động lấy chúng ra khỏi scene cũ để đưa vào group mới)
            if (this.earth) this.universeGroup.add(this.earth);
            if (this.clouds) this.universeGroup.add(this.clouds);
            if (this.sun) this.universeGroup.add(this.sun); // Dùng this.sun thay vì sunCore
            // Bổ sung: Cho ánh sáng chính vào Group để khi kéo/xoay, hướng sáng cũng xoay theo
            if (this.mainDirectionalLight) this.universeGroup.add(this.mainDirectionalLight);

            // Đặt toàn bộ hệ thống lên ngang tầm mắt (cao 1.5m, lùi ra xa 2.5m)
            this.universeGroup.position.set(0, 1.5, -2.5);
            // ==========================================
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
  // Create Earth sphere
  createEarth() {
        // High-resolution sphere for smooth appearance
        const geometry = new THREE.IcosahedronGeometry(1, 64);
        const textureLoader = new THREE.TextureLoader();
        // Load textures
        const dayTexture = this.createEarthTexture();
        const nightTexture = this.createNightmapTexture();
        const bumpTexture = textureLoader.load('./earth_bump.jpg');
        const specularTexture = textureLoader.load('./earth_specular.jpg');
        
        // Create Day Earth material with night map as emissive overlay
        const dayMaterial = new THREE.MeshPhongMaterial({
            map: dayTexture,
            emissiveMap: nightTexture,
            emissive: 0xffffff,        
            emissiveIntensity: 1,
        
            // ✨ THÊM 3 DÒNG NÀY ĐỂ ĐỊA HÌNH GỒ GHỀ VÀ ĐẠI DƯƠNG LẤP LÁNH ✨
            bumpMap: bumpTexture,
            bumpScale: 0.015,          // Độ gồ ghề của núi (chỉnh từ 0.01 đến 0.05)
            specularMap: specularTexture,
        
            shininess: 15, // Độ bóng của nước
            specular: new THREE.Color(0x333333), // Màu của phản chiếu (hơi xám)
            wireframe: false,
            flatShading: false,
            side: THREE.FrontSide
        });
        // 1. Tạo biến lưu trữ Uniforms ở cấp độ class (để dùng trong hàm update)
        this.earthUniforms = {
            sunPosition: { value: new THREE.Vector3(15, 8, 10).normalize() }
        };
        // =========================================================
        // ✨ ĐOẠN CODE SHADER XỬ LÝ CHUYỂN NGÀY/ĐÊM VÀ LỌC NỀN ✨
        // =========================================================
       // ✨ ĐOẠN CODE SHADER XỬ LÝ CHUYỂN NGÀY/ĐÊM VÀ LỌC NỀN ✨
        // =========================================================
        dayMaterial.onBeforeCompile = (shader) => { // <--- SỬA function(shader) THÀNH (shader) =>
            // Trỏ uniform của shader vào biến chúng ta vừa tạo
            shader.uniforms.sunPosition = this.earthUniforms.sunPosition;
            
            // Truyền Vector pháp tuyến bề mặt (world normal) sang Fragment Shader
            shader.vertexShader = `
                varying vec3 vWorldNormal;
            ` + shader.vertexShader;
            
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `
                #include <worldpos_vertex>
                vWorldNormal = normalize(mat3(modelMatrix) * normal);
                `
            );
            
            // Xử lý logic bật/tắt đèn dựa trên hướng mặt trời
            shader.fragmentShader = `
                uniform vec3 sunPosition;
                varying vec3 vWorldNormal;
            ` + shader.fragmentShader;
            
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `
                #include <emissivemap_fragment>
                
                #ifdef USE_EMISSIVEMAP
                    // 1. Tính toán vùng tối (ban đêm)
                    // Bỏ normalize(sunPosition) vì nó đã được normalize từ CPU rồi
float sunDot = dot(normalize(vWorldNormal), sunPosition);
                    
                    // 0.25: Bắt đầu bật đèn từ hoàng hôn, -0.05: Sáng 100% khi tối hẳn
                    float nightMask = 1.0 - smoothstep(-0.05, 0.25, sunDot);
                    
                    // 2. LỌC BỎ NỀN XANH ĐEN (Cắt ngưỡng)
                    // Ép các mảng màu tối (dưới 0.15) thành đen thui tuyệt đối
                    totalEmissiveRadiance = max(vec3(0.0), totalEmissiveRadiance - 0.15);
                    
                    // 3. KHUẾCH ĐẠI ĐÈN THÀNH PHỐ
                    // Nhân mặt nạ ngày/đêm và tăng độ sáng lên 5.0 lần (hoặc hơn)
                    totalEmissiveRadiance *= nightMask * 5.0; 
                #endif
                `
            );
        };
        // =========================================================

        this.earth = new THREE.Mesh(geometry, dayMaterial);
        this.earth.receiveShadow = false;
        this.earth.castShadow = false;
        this.scene.add(this.earth);
        
        // Store material for updates
        this.dayMaterial = dayMaterial;
        
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
            depthWrite: false,
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
            depthWrite: false,
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
        sunLight.castShadow = false;
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
        // 2. Lưu lại đèn chiếu chính
        this.mainDirectionalLight = sunLight;
    }
    
    // Create visual representation of the sun
    // Create visual representation of the sun
    // Create an advanced volumetric, pulsating sun visual using a single shader sphere
    // Create an advanced volumetric, pulsating sun visual using Fresnel Effect
  // Create an advanced textured, volumetric, pulsating sun visual
   // Create an advanced textured, volumetric, fiercely burning sun
   // Create a 3D Textured Sun with independent Volumetric Glow
// Create a 3D Textured Sun with independent *SUPER* Volumetric Glow
  // Create a 3D Textured Sun with independent, soft, pulsating Glow
    createSunVisual() {
        const textureLoader = new THREE.TextureLoader();
        let sunMap;
        try {
            sunMap = textureLoader.load('./sun.jpg');
        } catch (error) {
            console.warn('sun.jpg not found, using fallback.');
            sunMap = this.createFallbackSunTexture();
        }

        // ==========================================
        // 1. LỚP LÕI (CORE): Quả cầu 3D vật lý (Giữ chi tiết sun.jpg)
        // ==========================================
        // Bán kính 1.5, hiển thị texture sắc nét
        const coreGeometry = new THREE.IcosahedronGeometry(1.5, 64);
        
        const coreMaterial = new THREE.MeshBasicMaterial({
            map: sunMap,
            color: 0xffffff 
        });
        
        const sunCore = new THREE.Mesh(coreGeometry, coreMaterial);
        sunCore.position.set(45, 24, 30);
        this.scene.add(sunCore);
        
        this.sun = sunCore; // Để xoay trong update()

        // ==========================================
        // 2. LỚP HÀO QUANG (GLOW): *NÂNG CẤP ĐỂ GỌN & MƯỢT*
        // ==========================================
        this.sunUniforms = { uTime: { value: 0 } };
        
        // ✨ THAY ĐỔI 1: BÁN KÍNH NHỎ LẠI
        // Giảm bán kính từ 3.0 xuống 1.8 để quầng sáng gọn gàng, ôm sát lõi (1.5)
        const glowGeometry = new THREE.IcosahedronGeometry(3.2, 64);
        
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: this.sunUniforms,
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -normalize(mvPosition.xyz);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    float intensity = dot(normalize(vNormal), normalize(vViewPosition));
                    intensity = max(0.0, intensity);

                    // ✨ THAY ĐỔI 2: PHẬP PHỒNG CHẬM MƯỢT LẠI (sin * 1.5)
                    // Giảm tốc độ phập phồng từ 5.0 xuống 1.5 để tạo cảm giác êm ái
                    float pulse = sin(uTime * 1.5) * 0.1 + 0.9;

                    // ✨ THAY ĐỔI 3: SỬA LỖI HÀO QUANG ĐÈ LÊN MẶT TRỜI
                    // Tăng lũy thừa falloff lên 3.5 (thay vì 1.8). Số lớn làm cường độ
                    // giảm cực nhanh khi đi vào tâm (intensity -> 1.0),
                    // giúp vùng giữa hào quang rất trong suốt, hiện rõ lõi 3D.
                    float alpha = pow(intensity, 3.5);

                    // Màu quầng lửa (Cam đỏ gắt)
                    vec3 glowColor = vec3(1.0, 0.3, 0.0);

                    // ✨ THAY ĐỔI 4: ĐIỀU CHỈNH CƯỜNG ĐỘ (Nhân 2.0 thay vì 3.0)
                    // Làm cho hào quang rõ nhưng không quá chói lóa,
                    // kết hợp với alpha tan mượt tạo quầng sáng mọng.
                    gl_FragColor = vec4(glowColor * alpha * 2.0 * pulse, alpha * pulse);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending, // Cộng dồn ánh sáng
            depthWrite: false, 
            side: THREE.FrontSide
        });

        const sunGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        sunCore.add(sunGlow); // Gắn quầng lửa đi theo quả cầu lõi

        // ==========================================
        // 3. ĐÈN CHIẾU SÁNG TRÁI ĐẤT (Giữ Nguyên)
        // ==========================================
        const sunLight = new THREE.PointLight(0xffffbb, 2.5, 200); 
        // Đặt tọa độ của đèn tại (0,0,0) so với Mặt Trời và gắn thẳng vào lõi
        sunLight.position.set(0, 0, 0); 
        sunCore.add(sunLight);
        
        console.log('✓ 3D Sun with Compact Soft Pulsating Glow created.');
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
    
 // 1. Cập nhật hàm kiểm tra để LUÔN LUÔN tạo nút
 async initializeWebXR() {
    if (!navigator.xr) {
        console.log('⚠️ WebXR not supported - Desktop mode only');
        this.createVRButton(false); // Vẫn tạo nút nhưng truyền false
        return;
    }
    
    try {
        const supported = await navigator.xr.isSessionSupported('immersive-vr');
        this.createVRButton(supported); // Truyền trạng thái thật
    } catch (error) {
        console.log('⚠️ WebXR check failed:', error);
        this.createVRButton(false);
    }
}
    // Create VR Entry Button
   // 2. Vẽ lại nút bằng biểu tượng SVG y hệt ảnh bạn gửi
   createVRButton(isSupported) {
    // Xóa nút cũ nếu có
    if (this.vrButton) this.vrButton.remove();

    const button = document.createElement('button');
    
    // Thay thế bằng icon kính và chữ
    button.innerHTML = '🥽 Enter VR';

    // Điều chỉnh CSS thành nút hình viên thuốc (pill-shape) cho đẹp mắt
    button.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        padding: 12px 24px !important;
        background: rgba(0, 0, 0, 0.7) !important;
        color: white !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        font-size: 15px !important;
        font-weight: bold !important;
        border: 2px solid rgba(255, 255, 255, 0.6) !important;
        border-radius: 30px !important; /* Bo tròn mạnh tạo hình viên thuốc */
        cursor: pointer !important;
        z-index: 1000 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4) !important;
        transition: all 0.3s ease !important;
    `;

    // Hiệu ứng hover khi di chuột vào
    button.onmouseover = () => {
        button.style.background = 'rgba(255, 255, 255, 0.15)';
        button.style.borderColor = '#ffffff';
        button.style.transform = 'scale(1.05)';
    };
    
    // Hiệu ứng khi đưa chuột ra
    button.onmouseout = () => {
        button.style.background = 'rgba(0, 0, 0, 0.7)';
        button.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        button.style.transform = 'scale(1)';
    };

    button.onclick = () => {
        if (isSupported) {
            // Nếu có kính Meta Quest, vào thẳng VR
            this.enterVRMode();
        } else {
            // Nếu chạy trên PC, click vào sẽ phóng to toàn màn hình
            if (!document.fullscreenElement) {
                document.body.requestFullscreen().catch(err => {
                    console.log('Lỗi không thể phóng to màn hình:', err);
                });
                button.innerHTML = '🥽 Exit Fullscreen'; // Đổi chữ khi đang ở toàn màn hình
            } else {
                document.exitFullscreen();
                button.innerHTML = '🥽 Enter VR'; // Trả lại chữ cũ
            }
        }
    };

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
        // ---- THÊM ĐOẠN NÀY VÀO TRƯỚC DẤU NGOẶC NHỌN ĐÓNG CỦA HÀM ----
        // Khởi tạo tay cầm 1 (Tay phải)
        const controller1 = this.renderer.xr.getController(0);
        controller1.addEventListener('selectstart', (e) => this.onSelectStart(e));
        controller1.addEventListener('selectend', (e) => this.onSelectEnd(e));
        this.scene.add(controller1);

        // Khởi tạo tay cầm 2 (Tay trái)
        const controller2 = this.renderer.xr.getController(1);
        controller2.addEventListener('selectstart', (e) => this.onSelectStart(e));
        controller2.addEventListener('selectend', (e) => this.onSelectEnd(e));
        this.scene.add(controller2);

        // Vẽ tia laser trắng để biết tay cầm đang chỉ đi đâu
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
        line.scale.z = 5; // Tia dài 5 mét
        controller1.add(line.clone());
        controller2.add(line.clone());
        // ---- KẾT THÚC THÊM CODE ----
    }
    // ---- THÊM 2 HÀM MỚI NÀY ----
    onSelectStart(event) {
        this.isControllerGrabbing = true;
        this.activeController = event.target;
        // Lưu lại vị trí tay cầm ngay khoảnh khắc vừa bóp cò
        this.previousControllerPosition.copy(this.activeController.position);
    }

    onSelectEnd(event) {
        this.isControllerGrabbing = false;
        this.activeController = null;
    }
    // ---------------------------
    
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
        
       // ---- THÊM CODE ZOOM BẰNG CẦN GẠT TẠI ĐÂY ----
        for (const source of this.xrSession.inputSources) {
            // Đảm bảo thiết bị có gamepad và có đủ 4 trục (có thumbstick)
            if (source.gamepad && source.gamepad.axes.length >= 4) {
                const thumbstickX = source.gamepad.axes[2]; // Trục ngang (Trái/Phải)
                const thumbstickY = source.gamepad.axes[3]; // Trục dọc (Lên/Xuống)
                
                // KHÓA HƯỚNG: 
                // 1. Math.abs(thumbstickY) > 0.1: Bỏ qua vùng deadzone tránh trôi cần gạt
                // 2. Math.abs(thumbstickY) > Math.abs(thumbstickX): Chỉ nhận khi lực đẩy dọc MẠNH HƠN lực đẩy ngang
               // Trong đoạn xử lý gamepad thumbstick:
if (Math.abs(thumbstickY) > 0.1 && Math.abs(thumbstickY) > Math.abs(thumbstickX)) {
    // Đẩy vũ trụ ra xa hoặc kéo lại gần dọc theo trục Z
    this.universeGroup.position.z -= thumbstickY * 0.05; 
    
    // Giới hạn khoảng cách không cho bay đi quá xa hoặc đập vào mặt
    this.universeGroup.position.z = Math.max(-10, Math.min(-1, this.universeGroup.position.z));
}
            }
        }
        // --------------------------------------------
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
        // ---- THÊM ĐOẠN NÀY VÀO TRƯỚC DẤU NGOẶC NHỌN ĐÓNG CỦA HÀM ----
        // Xử lý khi đang bóp giữ cò tay cầm
        // Thay thế đoạn xử lý isControllerGrabbing:
// Xử lý khi đang bóp giữ cò tay cầm
if (this.isControllerGrabbing && this.activeController) {
    const currentPosition = this.activeController.position;
    const deltaX = currentPosition.x - this.previousControllerPosition.x;
    const deltaY = currentPosition.y - this.previousControllerPosition.y;

    // 1. TĂNG TỐC ĐỘ XOAY DÀNH CHO KÍNH THẬT
    const rotationSpeed = 25.0;

    // 2. CHỈNH LẠI HƯỚNG VUỐT DÙNG TRỤC THẾ GIỚI (WORLD AXIS) VÀ TỐI ƯU RÁC BỘ NHỚ
    // Dùng this.worldAxisY và this.worldAxisX đã khởi tạo trên constructor
    this.universeGroup.rotateOnWorldAxis(this.worldAxisY, deltaX * rotationSpeed);
    this.universeGroup.rotateOnWorldAxis(this.worldAxisX, -deltaY * rotationSpeed);

    this.previousControllerPosition.copy(currentPosition);
}
        // ---- KẾT THÚC THÊM CODE ----
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
        if (this.clouds) {
            this.clouds.rotation.y += 0.001; // Clouds rotate WITH Earth (same speed - physics accurate)
        }
       // Bổ sung: CẬP NHẬT HƯỚNG SÁNG CHO SHADER LIÊN TỤC
      // Bổ sung: CẬP NHẬT HƯỚNG SÁNG CHO SHADER LIÊN TỤC
      if (this.sun && this.earth && this.earthUniforms) {
           
        // SỬ DỤNG LẠI BIẾN ĐÃ TẠO Ở CONSTRUCTOR, KHÔNG DÙNG "new" ĐỂ KHÔNG TẠO RÁC
        this.sun.getWorldPosition(this.tempSunPos);
        this.earth.getWorldPosition(this.tempEarthPos);

        // Tính vector hướng chiếu sáng từ Trái Đất tới Mặt Trời
        this.tempSunDir.subVectors(this.tempSunPos, this.tempEarthPos).normalize();

        // Cập nhật hướng này vào Custom Shader
        this.earthUniforms.sunPosition.value.copy(this.tempSunDir);
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
    // Main animation loop
    animate = () => {
        this.renderer.setAnimationLoop((time, frame) => {
            // Support both VR and desktop rendering
            if (this.isVR && frame) {
                this.updateVRControls(frame);
            }
            
            // =======================================================
            // ✨ THÊM ĐOẠN NÀY ĐỂ MẶT TRỜI PHẬP PHỒNG VÀ CHÁY SÁNG ✨
            // =======================================================
            if (this.sunUniforms) {
                // Biến 'time' của Three.js là mili-giây, nhân với 0.001 để ra giây
                this.sunUniforms.uTime.value = time * 0.001; 
            }
            // =======================================================

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
