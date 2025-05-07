// VolumetricFogShader.js - Optimized minimal shader for volumetric fog effects
import * as THREE from 'three';

// Enhanced shader with ground-emanating volumetric fog
const VolumetricFogShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    tNoise: { value: null },
    resolution: { value: new THREE.Vector2() },
    cameraFar: { value: 1000.0 },
    cameraNear: { value: 1.0 },
    // Although cameraPosition exists in standard materials as a built-in,
    // we need to explicitly define it for post-processing
    cameraPosition: { value: new THREE.Vector3() },
    // ADDED: Uniform for the inverse projection matrix
    cameraProjectionMatrixInverse: { value: new THREE.Matrix4() },
    viewToWorld: { value: new THREE.Matrix4() },
    fogColor: { value: new THREE.Color(0x8bb0ff) },
    fogColorBottom: { value: new THREE.Color(0xefd1b5) }, // Warmer color for ground fog
    fogDensity: { value: 0.00015 },
    fogIntensity: { value: 50.0 },
    time: { value: 0 },
    noiseScale: { value: 0.005 },
    noiseIntensity: { value: 0.25 },
    noiseSpeed: { value: 0.04 },
    noiseOctaves: { value: 3 },
    noisePersistence: { value: 0.65 },
    noiseLacunarity: { value: 2.0 },
    fogHeight: { value: 0.5 },
    fogFalloff: { value: 1.5 },
    groundFogDensity: { value: 3.0 },
    groundFogHeight: { value: 15.0 },
    glowIntensity: { value: 0.3 }, // Control for the ground fog glow effect
    sunPosition: { value: new THREE.Vector3(0, 1, 0) }, // For light shaft/fringe effects
    sphereRadius: { value: 400.0 } // Radius of the planet for horizon shell mapping
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform sampler2D tNoise;
    uniform vec2 resolution;
    uniform float cameraFar;
    uniform float cameraNear;
    // ADDED: Declare the inverse projection matrix uniform
    uniform mat4 cameraProjectionMatrixInverse;
    uniform mat4 viewToWorld;
    uniform vec3 fogColor;
    uniform vec3 fogColorBottom;
    uniform float fogDensity;
    uniform float fogIntensity;
    uniform float time;
    uniform float noiseScale;
    uniform float noiseIntensity;
    uniform float noiseSpeed;
    uniform float noiseOctaves;
    uniform float noisePersistence;
    uniform float noiseLacunarity;
    uniform float fogHeight;
    uniform float fogFalloff;
    uniform float groundFogDensity;
    uniform float groundFogHeight;
    uniform float glowIntensity;
    uniform vec3 sunPosition;
    uniform float sphereRadius; // Radius of the planet for horizon shell mapping

    varying vec2 vUv;
    
    // Improved noise functions for better fog turbulence
    float hash(float n) { return fract(sin(n) * 43758.5453123); }
    
    // Improved noise function for ground fog turbulence
    float noise(vec3 x) {
      vec3 p = floor(x);
      vec3 f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      
      float n = p.x + p.y * 57.0 + p.z * 113.0;
      
      float a = hash(n);
      float b = hash(n + 1.0);
      float c = hash(n + 57.0);
      float d = hash(n + 58.0);
      float e = hash(n + 113.0);
      float f1 = hash(n + 114.0);
      float g = hash(n + 170.0);
      float h = hash(n + 171.0);
      
      return mix(
        mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
        mix(mix(e, f1, f.x), mix(g, h, f.x), f.y),
        f.z);
    }
    
    // FBM (Fractal Brownian Motion) for more natural fog patterns
    float fbm(vec3 x) {
      float v = 0.0;
      float amplitude = 1.0;
      float frequency = 1.0;
      
      for (int i = 0; i < 5; i++) {
        if (i >= int(noiseOctaves)) break;
        
        v += amplitude * noise(x * frequency);
        amplitude *= noisePersistence;
        frequency *= noiseLacunarity;
      }
      
      return v;
    }
    
    // Basic noise lookup from texture
    float basicNoise(vec2 uv) {
      return texture2D(tNoise, uv).r;
    }
    
    // More complex FBM using texture lookup
    float fbmNoise(vec2 uv) {
      float total = 0.0;
      float amplitude = 1.0;
      float frequency = 1.0;
      
      for (int i = 0; i < 5; i++) {
        if (i >= int(noiseOctaves)) break;
        
        total += texture2D(tNoise, uv * frequency + time * noiseSpeed * 0.1 * vec2(1.0, 0.5)).r * amplitude;
        amplitude *= noisePersistence;
        frequency *= noiseLacunarity;
      }
      
      return total;
    }

    // Get world position from depth texture
    vec3 getWorldPos(float depth, vec2 coord) {
      float z = depth * 2.0 - 1.0;
      
      vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
      
      // Unproject using inverse projection matrix
      // FIXED: Use cameraProjectionMatrixInverse instead of inverse(projectionMatrix)
      vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
      
      viewSpacePosition /= viewSpacePosition.w;
      
      vec4 worldSpacePosition = viewToWorld * viewSpacePosition;
      
      return worldSpacePosition.xyz;
    }
    
    void main() {
      vec2 uv = vUv;
      
      // Get scene color
      vec4 sceneColor = texture2D(tDiffuse, uv);
      
      // Get depth
      float depth = texture2D(tDepth, uv).x;
      
      // Skip fog calculation for sky (depth == 1.0)
      if (depth >= 0.9999) {
        gl_FragColor = sceneColor;
        return;
      }
      
      // Convert to linear depth
      float linearDepth = cameraFar * cameraNear / (cameraFar - depth * (cameraFar - cameraNear));
      
      // Get world position from depth
      vec3 worldPos = getWorldPos(depth, uv);
      
      // Ray direction from camera to fragment
      vec3 rayDir = normalize(worldPos - cameraPosition);
      
      // Raymarch through the fog
      // ADJUSTED: Increased step count slightly for better quality with higher resolution
      float stepSize = linearDepth / 30.0; // INCREASED steps from 20 to 30

      // Distance-based variable step size for better performance without sacrificing quality
      // stepSize = mix(linearDepth / 30.0, linearDepth / 18.0, smoothstep(0.0, 150.0, linearDepth)); // Adjusted mix range

      // Global fog pattern - create large-scale variations
      vec2 globalNoiseCoord = (cameraPosition.xz + rayDir.xz * 20.0) * 0.001;
      float globalNoise = fbmNoise(globalNoiseCoord);
      
      float fogAmount = 0.0;
      
      // Raymarch loop - INCREASED steps from 20 to 30
      for(int i = 0; i < 30; i++) { // INCREASED loop limit
        float t = float(i) * stepSize;
        // Prevent sampling beyond the actual depth
        if (t > linearDepth) break; 
        
        vec3 samplePos = cameraPosition + rayDir * t;
        
        // Add vertical wobble to sampling position for more smoke-like layering
        samplePos.y += sin(samplePos.x * 0.05 + samplePos.z * 0.03 + time * 0.2) * 5.0;
        samplePos.y += cos(samplePos.z * 0.06 + time * 0.15) * 4.0;
        
        // Determine height above the sphere surface (shell) instead of global Y
        float heightAboveSurface = max(0.0, length(samplePos) - sphereRadius);
        float groundFogFactor = exp(-heightAboveSurface / groundFogHeight);
        
        // Apply noise to the ground fog
        vec2 noiseCoord = samplePos.xz * noiseScale;
        float detailNoise = fbmNoise(noiseCoord);
        
        // Create perlin-like billowing effect 
        detailNoise = abs(detailNoise - 0.5) * 2.0; // Convert to [0,1] range with peaks
        
        // Apply larger scale variation in the fog
        float largeScaleVariation = fbm(samplePos * 0.03 + time * 0.01);
        
        // Combine ground fog with noise
        // MODIFIED: Increased noise influence for more natural smoke-like appearance
        float localDensity = groundFogFactor * groundFogDensity * (0.5 + detailNoise * 0.5); 
        
        // Apply rolling wave pattern to ground fog
        float waveEffect = sin(samplePos.x * 0.05 + time * 0.2) * 0.5 + 0.5;
        waveEffect *= sin(samplePos.z * 0.04 - time * 0.15) * 0.5 + 0.5;
        // INCREASED: Wave effect range for more vertical variation
        localDensity *= mix(0.6, 1.4, waveEffect); 
        
        // Apply global fog pattern to create patches of fog
        // INCREASED: Global noise influence for more patchy fog appearance
        localDensity *= (0.7 + globalNoise * 0.6); 
        
        // Add subtle vertical turbulence based on time
        // INCREASED: Vertical turbulence for more smoke-like behavior
        float turbulence = sin(samplePos.y * 0.2 + time * 0.1) * 0.15;
        localDensity *= (1.0 + turbulence);
        
        // Distance based fog density (thicker in the distance)
        float distanceFactor = clamp(t / linearDepth, 0.0, 1.0);
        localDensity *= mix(0.5, 1.0, distanceFactor); // Adjusted distance factor mix
        
        // Accumulate fog density
        fogAmount += localDensity * stepSize * fogDensity;
      }

      // Apply exponential fog with intensity control
      float finalFogAmount = 1.0 - exp(-fogAmount * fogIntensity);
      
      // Height-based fog color gradient with improved volume transition
      // Use radial height for height-based color blending instead of world Y
      float radialHeight = max(0.0, length(worldPos) - sphereRadius);
      float heightMix = clamp(radialHeight / (groundFogHeight * 1.5), 0.0, 1.0); // Increased blend region 
      // Non-linear blending for smoother transition 
      heightMix = pow(heightMix, 0.8); // Softer power curve for better volume
      vec3 finalFogColor = mix(fogColorBottom, fogColor, heightMix);
      
      // Add subtle variation to the color mix based on noise
      vec2 colorNoiseCoord = worldPos.xz * 0.003;
      float colorNoise = fbmNoise(colorNoiseCoord + time * 0.02);
      // Add subtle color variation for more interesting fog 
      finalFogColor = mix(finalFogColor, 
                         mix(fogColorBottom, fogColor, 1.0 - heightMix) * 1.05, 
                         colorNoise * 0.2);
      
      // Add subtle blue tint to distant fog
      float distanceFactor = clamp(linearDepth / (cameraFar * 0.5), 0.0, 1.0);
      finalFogColor = mix(finalFogColor, vec3(0.6, 0.7, 0.9), distanceFactor * 0.2);

      // Light shafts / fringe effect similar to Cloud Ten shader
      float sunDot = max(0.0, dot(rayDir, normalize(sunPosition)));
      finalFogColor += vec3(1.0, 0.9, 0.7) * pow(sunDot, 10.0) * finalFogAmount * 0.25; // Adjusted sun effect
      
      // Mix scene with fog
      gl_FragColor = mix(sceneColor, vec4(finalFogColor, 1.0), clamp(finalFogAmount, 0.0, 0.98)); // Increased max fog slightly
      
      // Add subtle glow to fog in darker areas (like in Cloud Ten shader)
      float luminance = dot(sceneColor.rgb, vec3(0.299, 0.587, 0.114));
      float glowAmount = clamp((1.0 - luminance) * finalFogAmount * glowIntensity, 0.0, 0.3);
      gl_FragColor.rgb += finalFogColor * glowAmount;
    }
  `
};

// Enhanced fog effect implementation
class VolumetricFog {
  constructor(scene, camera, renderer, options = {}) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    // Default options with new controls
    this.options = {
      enabled: true,
      fogColor: new THREE.Color(0x8bb0ff), // Bluish fog
      fogColorBottom: new THREE.Color(0xefd1b5), // Warmer color for ground fog
      fogDensity: 0.00025,
      fogIntensity: 30.0,
      noiseScale: 0.005,
      noiseIntensity: 0.2,
      noiseSpeed: 0.04,
      noiseOctaves: 3,
      noisePersistence: 0.65,
      noiseLacunarity: 2.0,
      fogHeight: 0.5,
      fogFalloff: 1.5,
      groundFogDensity: 3.0, // Intensity of ground fog
      groundFogHeight: 15.0, // Height of ground fog in world units
      glowIntensity: 0.3, // Intensity of the glow effect
      resolution: 1.0, // Use full resolution by default
      sphereRadius: 400, // World sphere radius 
      ...options
    };

    this.time = 0;
    this.enabled = this.options.enabled;

    this._initNoiseTexture();
    this._initRenderTargets();
    this._initShaderPass();
  }

  // Create improved noise texture
  _initNoiseTexture() {
    const size = 256; // Larger texture for better quality
    const data = new Uint8Array(size * size * 4);
    
    // Create perlin-like noise
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        
        // Create organic looking noise
        let nx = x / size * 12;
        let ny = y / size * 12;
        
        // Simplex-like noise approximation
        let noise = 0;
        let amp = 1.0;
        let freq = 1.0;
        
        // Use multiple frequencies for more natural look
        for (let o = 0; o < 4; o++) {
          const noiseValue = this._simpleNoise(nx * freq, ny * freq) * 0.5 + 0.5;
          noise += noiseValue * amp;
          amp *= 0.5;
          freq *= 2.0;
        }
        
        noise = noise / (1.0 + 0.5 + 0.25 + 0.125); // Normalize
        
        const value = Math.floor(noise * 255);
        
        data[i] = value;
        data[i+1] = value;
        data[i+2] = value;
        data[i+3] = 255;
      }
    }
    
    this.noiseTexture = new THREE.DataTexture(
      data,
      size,
      size,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    
    this.noiseTexture.wrapS = THREE.RepeatWrapping;
    this.noiseTexture.wrapT = THREE.RepeatWrapping;
    this.noiseTexture.needsUpdate = true;
  }
  
  // Simple noise function for texture generation
  _simpleNoise(x, y) {
    // Simplified noise implementation (not true perlin)
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    
    const u = this._fade(fx);
    const v = this._fade(fy);
    
    const A = (X + Y) & 255;
    const B = (X + Y + 1) & 255;
    
    // Use random values based on coordinates
    const aa = this._random(A);
    const ab = this._random(B);
    
    // Bi-linear interpolation
    return this._lerp(v, this._lerp(u, aa, ab), this._lerp(u, ab, aa));
  }
  
  _fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  _lerp(t, a, b) {
    return a + t * (b - a);
  }
  
  _random(i) {
    i = (i << 13) ^ i;
    return ((i * (i * i * 15731 + 789221) + 1376312589) & 0x7fffffff) / 0x40000000 - 1.0;
  }
  
  // Initialize render targets at reduced resolution
  _initRenderTargets() {
    // Create a Vector2 to store the size
    const sizeVector = new THREE.Vector2();
    // Use getSize with the Vector2 parameter (FIXED: This is the key fix)
    this.renderer.getSize(sizeVector);
    const pixelRatio = this.renderer.getPixelRatio();
    
    // Scaled down resolution for better performance
    const width = Math.floor(sizeVector.width * pixelRatio * this.options.resolution);
    const height = Math.floor(sizeVector.height * pixelRatio * this.options.resolution);
    
    // Create simple render targets
    this.colorTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType // Use standard type for better compatibility
    });
    
    this.depthTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter, 
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });
    
    // Create simple depth material
    this.depthMaterial = new THREE.MeshDepthMaterial();
    this.depthMaterial.depthPacking = THREE.BasicDepthPacking;
    this.depthMaterial.blending = THREE.NoBlending;
    
    // Store resolution for later use
    this.resolution = new THREE.Vector2(width, height);
  }
  
  // Set up shader pass with new uniforms
  _initShaderPass() {
    // Create the view-to-world matrix
    const viewToWorld = new THREE.Matrix4();

    // Create fog shader material
    this.fogMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(VolumetricFogShader.uniforms), // Clone base uniforms
      vertexShader: VolumetricFogShader.vertexShader,
      fragmentShader: VolumetricFogShader.fragmentShader
    });

    // Assign initial values from options
    this.fogMaterial.uniforms.tDiffuse.value = this.colorTarget.texture;
    this.fogMaterial.uniforms.tDepth.value = this.depthTarget.texture;
    this.fogMaterial.uniforms.tNoise.value = this.noiseTexture;
    this.fogMaterial.uniforms.resolution.value = this.resolution;
    this.fogMaterial.uniforms.cameraFar.value = this.camera.far;
    this.fogMaterial.uniforms.cameraNear.value = this.camera.near;
    
    // Ensure camera position is properly initialized
    if (!this.fogMaterial.uniforms.cameraPosition) {
      this.fogMaterial.uniforms.cameraPosition = { value: new THREE.Vector3() };
    }
    this.fogMaterial.uniforms.cameraPosition.value.copy(this.camera.position);
    
    // Make sure cameraProjectionMatrixInverse is properly initialized
    this.fogMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);

    this.fogMaterial.uniforms.viewToWorld.value = viewToWorld;
    this.fogMaterial.uniforms.fogColor.value = this.options.fogColor;
    this.fogMaterial.uniforms.fogColorBottom.value = this.options.fogColorBottom;
    this.fogMaterial.uniforms.fogDensity.value = this.options.fogDensity;
    this.fogMaterial.uniforms.fogIntensity.value = this.options.fogIntensity;
    this.fogMaterial.uniforms.time.value = 0;
    this.fogMaterial.uniforms.noiseScale.value = this.options.noiseScale;
    this.fogMaterial.uniforms.noiseIntensity.value = this.options.noiseIntensity;
    this.fogMaterial.uniforms.noiseSpeed.value = this.options.noiseSpeed;
    this.fogMaterial.uniforms.noiseOctaves.value = this.options.noiseOctaves;
    this.fogMaterial.uniforms.noisePersistence.value = this.options.noisePersistence;
    this.fogMaterial.uniforms.noiseLacunarity.value = this.options.noiseLacunarity;
    this.fogMaterial.uniforms.fogHeight.value = this.options.fogHeight;
    this.fogMaterial.uniforms.fogFalloff.value = this.options.fogFalloff;
    this.fogMaterial.uniforms.groundFogDensity.value = this.options.groundFogDensity;
    this.fogMaterial.uniforms.groundFogHeight.value = this.options.groundFogHeight;
    this.fogMaterial.uniforms.glowIntensity.value = this.options.glowIntensity;
    this.fogMaterial.uniforms.sunPosition.value = new THREE.Vector3(500, 300, -200); // Default sun position
    this.fogMaterial.uniforms.sphereRadius.value = this.options.sphereRadius;

    // Create simple fullscreen quad
    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.fogMaterial
    );
    this.quad.frustumCulled = false;

    // Create scene for final pass
    this.fogScene = new THREE.Scene();
    this.fogScene.add(this.quad);

    // Create simple camera
    this.fogCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  
  // Resize buffers when renderer size changes
  resize() {
    // Create a new Vector2 to store the size (FIXED)
    const sizeVector = new THREE.Vector2();
    this.renderer.getSize(sizeVector);
    const pixelRatio = this.renderer.getPixelRatio();
    const width = Math.floor(sizeVector.width * pixelRatio * this.options.resolution);
    const height = Math.floor(sizeVector.height * pixelRatio * this.options.resolution);
    
    this.colorTarget.setSize(width, height);
    this.depthTarget.setSize(width, height);
    this.fogMaterial.uniforms.resolution.value.set(width, height);
  }
  
  // Enable/disable fog
  setEnabled(enabled) {
    this.enabled = enabled;
    return this.enabled;
  }
  
  // Update fog properties
  setColors(fogColor, fogColorBottom = null) {
    if (fogColor) this.fogMaterial.uniforms.fogColor.value.set(fogColor);
    if (fogColorBottom) this.fogMaterial.uniforms.fogColorBottom.value.set(fogColorBottom);
  }

  setDensity(density) {
    this.fogMaterial.uniforms.fogDensity.value = density;
  }

  setIntensity(intensity) {
    this.fogMaterial.uniforms.fogIntensity.value = intensity;
  }

  setNoiseProperties(scale, intensity, speed, octaves, persistence, lacunarity) {
    if (scale !== undefined) this.fogMaterial.uniforms.noiseScale.value = scale;
    if (intensity !== undefined) this.fogMaterial.uniforms.noiseIntensity.value = intensity;
    if (speed !== undefined) this.fogMaterial.uniforms.noiseSpeed.value = speed;
    if (octaves !== undefined) this.fogMaterial.uniforms.noiseOctaves.value = octaves;
    if (persistence !== undefined) this.fogMaterial.uniforms.noisePersistence.value = persistence;
    if (lacunarity !== undefined) this.fogMaterial.uniforms.noiseLacunarity.value = lacunarity;
  }

  setGroundFogProperties(density, height) {
    if (density !== undefined) this.fogMaterial.uniforms.groundFogDensity.value = density;
    if (height !== undefined) this.fogMaterial.uniforms.groundFogHeight.value = height;
  }

  setHeightProperties(height, falloff) {
     if (height !== undefined) this.fogMaterial.uniforms.fogHeight.value = height;
     if (falloff !== undefined) this.fogMaterial.uniforms.fogFalloff.value = falloff;
  }
  
  setSunPosition(x, y, z) {
    this.fogMaterial.uniforms.sunPosition.value.set(x, y, z);
  }
  
  setGlowIntensity(intensity) {
    this.fogMaterial.uniforms.glowIntensity.value = intensity;
  }

  // Simple update function
  update(delta) {
    if (!this.enabled) return;
    
    // Update time
    this.time += delta;
    this.fogMaterial.uniforms.time.value = this.time;
    
    // Update view-to-world matrix
    this.fogMaterial.uniforms.viewToWorld.value.copy(this.camera.matrixWorld);
    
    // Update camera position (ensure it's always up-to-date)
    this.fogMaterial.uniforms.cameraPosition.value.copy(this.camera.position);
    
    // ADDED: Update inverse projection matrix if camera projection changes
    this.fogMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);

    // Update camera properties if changed
    if (this.fogMaterial.uniforms.cameraFar.value !== this.camera.far) {
      this.fogMaterial.uniforms.cameraFar.value = this.camera.far;
    }
    if (this.fogMaterial.uniforms.cameraNear.value !== this.camera.near) {
      this.fogMaterial.uniforms.cameraNear.value = this.camera.near;
    }
  }
  
  // Render the effect
  render() {
    if (!this.enabled) {
      // If disabled, render scene directly
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
      return;
    }
    
    const oldAutoClear = this.renderer.autoClear;
    
    // Render color pass
    this.renderer.setRenderTarget(this.colorTarget);
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    
    // Render depth pass
    const currentOverrideMaterial = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.depthMaterial;
    this.renderer.setRenderTarget(this.depthTarget);
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = currentOverrideMaterial;
    
    // Render fog pass to screen
    this.renderer.setRenderTarget(null);
    this.renderer.autoClear = true;
    this.renderer.render(this.fogScene, this.fogCamera);
    
    // Restore settings
    this.renderer.autoClear = oldAutoClear;
  }
}

export { VolumetricFog, VolumetricFogShader };