// CloudSystem.js - A system to create and manage smooth low-poly clouds around the planet
import * as THREE from 'three';
import { ConvexGeometry } from '../three.js-dev/examples/jsm/geometries/ConvexGeometry.js';

class CloudSystem {
  constructor(scene, options = {}) {
    if (typeof options !== 'object' || options === null) {
      throw new Error('Options parameter must be an object.');
    }
    this.scene = scene;
    this.options = {
      count: 48,               // Total number of clouds
      minRadius: 1200,         // Minimum orbit distance
      maxRadius: 1500,         // Maximum orbit distance
      minScale: 40,            // Minimum cloud scale
      maxScale: 80,            // Maximum cloud scale
      rotationSpeed: 0.00035,  // Orbit rotation speed
      opacity: 0.9,            // Cloud opacity
      color: 0xffffff,         // Cloud color
      vertexCount: { min: 20, max: 32 }, // INCREASED: Even more vertices for smoother clouds
      vertexJitter: 0.2,       // Keep jitter for natural appearance
      distribution: 0.3,       // Distribution bias toward equator
      fogColor: 0x8bb0ff,      // Atmospheric fog color
      fogDensity: 0.000015,    // Fog density
      // Added smooth orbit parameters
      orbitSmoothing: 0.5,     // Higher values make orbits more natural
      individualRotation: true, // Whether clouds rotate on their own axis
      // Added anime style parameters
      horizontalStretch: 1.8,  // Horizontal stretch factor (anime style)
      verticalCompress: 0.7,   // Vertical compression factor (anime style)
      sphereRadius: 400,       // Planet radius to orbit around
      // Cloud rotation parameters
      cloudRotationSpeed: 0.005, // Slow base rotation speed for natural movement
      chunkiness: 0.6,         // Controls how chunky cloud protrusions are
      // Edge buffering parameters - ENHANCED
      edgeVertexDensity: 0.7,  // INCREASED: More vertices around edges (from 0.4)
      edgeSmoothing: 0.45,     // INCREASED: More smoothing of edge vertices (from 0.3)
      edgeFeathering: 0.2,     // NEW: Controls opacity gradient at edges
      // Movement parameters
      floatAmplitude: 0.2,     // REDUCED: Smaller float amplitude for less vertical movement (from 0.5)
      floatFrequency: 0.2,     // NEW: Controls speed of floating motion
      // NEW: Cloud complexity parameters for more organic shapes
      geometryDetail: 0.65,    // Controls overall geometry complexity
      layerCount: 2,           // Number of overlapping cloud layers for depth
      ...options
    };
    this.clouds = [];
    this.cloudGroups = [];
    this.planetCenter = new THREE.Vector3(0, 0, 0); // Default planet center
    this.options.sphereRadius = this.options.sphereRadius || 400; // Ensure sphereRadius is set

    // Pre-initialize materials to avoid flickering
    this._initMaterials();
    
    // Add initialization flag to prevent position jumps
    this.initialized = false;
    this.initializationTime = 1000;   // Keep 1 second initialization time
    this.initializing = false;
    this.fadeInTime = 1600;           // Extended fade-in time (from 1200ms)
    this.frozen = true;               // Start frozen
    this.positionsStabilized = false; // Flag to track position stabilization
    
    // Add property to track actual orbit rotation around the planet
    this._orbitStartTime = 0;
    
    console.log("[CloudSystem Constructor] Options received:", this.options); // Log options used
  }
  
  _initMaterials() {
    // Create base material that all cloud instances will clone
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: this.options.color,
      transparent: true,
      opacity: this.options.opacity,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
      emissive: 0x334466,
      emissiveIntensity: 0.08
    });
  }

  init(preservePositions = false) {
    console.log("[CloudSystem] Init started."); // Log start
    // Set initializing flag to prevent jumps during update
    this.initializing = true;
    this.positionsStabilized = false; // Ensure this is false initially
    
    // Set up atmospheric fog
    if (!this.scene.fog) {
      this.scene.fog = new THREE.FogExp2(
        this.options.fogColor,
        this.options.fogDensity
      );
      
      // Set sky background color for cosmic effect
      if (!this.scene.background) {
        const skyColor = new THREE.Color(this.options.fogColor).lerp(new THREE.Color(0x0a1030), 0.4);
        this.scene.background = skyColor;
      }
      
      // Create atmospheric halo effect if needed
      this._createAtmosphericHalo();
    }
    
    // Store existing cloud positions before recreation if preserving
    const oldClouds = preservePositions ? this.clouds.map(cloud => ({
      position: cloud.mesh.position.clone(),
      direction: cloud.relativePos.clone().normalize(),
      radius: cloud.relativePos.length()
    })) : [];
    
    // 1. Create clouds (meshes are added to scene here)
    console.log("[CloudSystem] Creating clouds..."); // Log
    this.createClouds(preservePositions, oldClouds);
    console.log(`[CloudSystem] ${this.clouds.length} clouds created.`); // Log
    
    // Reset initialization state timers
    this.initialized = false; // Keep false until initialization time passes
    this.startTime = Date.now();
    this._orbitStartTime = Date.now() + this.initializationTime; // Set orbit start time
    
    // 2. CRITICAL: Update initial positions *immediately* after creation
    console.log("[CloudSystem] Setting initial positions..."); // Log
    this._updateInitialPositions();
    console.log("[CloudSystem] Initial positions set."); // Log
    
    // 3. Hide all clouds initially by setting opacity to 0 *after* positions are set
    console.log("[CloudSystem] Hiding clouds (setting opacity to 0)..."); // Log
    this.clouds.forEach(cloud => {
      if (cloud.mesh) {
        cloud.mesh.visible = true; // Ensure mesh is technically visible
        cloud.mesh.children.forEach(child => {
          if (child.material && child.material.opacity !== undefined) {
            // Store original opacity if not already stored
            if (child.material._originalOpacity === undefined) {
              child.material._originalOpacity = child.material.opacity;
            }
            // Set initial opacity to 0 for fade-in
            child.material.opacity = 0;
            child.material.transparent = true; // Ensure transparency is enabled
          }
        });
      }
    });
    console.log("[CloudSystem] Clouds hidden."); // Log

    // 4. Mark positions as stabilized *immediately* after hiding.
    // The fade-in logic in update() will start on the next frame.
    this.positionsStabilized = true;
    console.log("[CloudSystem] Positions stabilized, fade-in will start on next frame."); // Log
    
    // REMOVED: setTimeout for positionsStabilized
    
    console.log(`[CloudSystem] Init finished. ${this.clouds.length} clouds ready for fade-in.`); // Log end
  }

  /**
   * Creates an atmospheric halo effect around the planet
   * @private
   */
  _createAtmosphericHalo() {
    // Get reference to planet radius 
    const planetRadius = this.options.sphereRadius || 400;
    
    // Create a sphere slightly larger than the planet
    const atmosphereGeometry = new THREE.SphereGeometry(planetRadius * 1.1, 64, 48);
    
    // Create atmospheric shader material
    const atmosphereMaterial = new THREE.ShaderMaterial({
      uniforms: {
        planetRadius: { value: planetRadius },
        atmosphereRadius: { value: planetRadius * 1.1 },
        atmosphereColor: { value: new THREE.Color(0x4a85ff) },
        sunDirection: { value: new THREE.Vector3(1, 0.4, 0.1).normalize() },
        glowIntensity: { value: 0.8 } // Add adjustable intensity parameter
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 atmosphereColor;
        uniform vec3 sunDirection;
        uniform float planetRadius;
        uniform float atmosphereRadius;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // Calculate view direction
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          
          // Calculate rim lighting effect (stronger at edges)
          float rim = 1.0 - max(dot(vNormal, viewDirection), 0.0);
          rim = pow(rim, 2.5); // Adjust power for thickness
          
          // Add sun-side highlight
          float sunFactor = max(dot(vNormal, sunDirection), 0.0);
          float glowIntensity = mix(0.3, 1.0, sunFactor);
          
          // Final atmosphere color with rim effect
          vec3 finalColor = atmosphereColor * glowIntensity;
          
          // Set alpha for transparency
          float alpha = rim * 0.6; // Adjust for visibility
          
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide, // Only show the inside of the sphere
      depthWrite: false
    });
    
    // Create mesh and add to scene
    const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    this.scene.add(atmosphereMesh);
    
    // Store reference for updates
    this.atmosphereMesh = atmosphereMesh;
  }

  createClouds(preservePositions = false, oldClouds = []) {
    // Clean up any existing clouds
    this.clouds.forEach(cloud => {
      if (cloud.mesh) {
        if (cloud.mesh.geometry) cloud.mesh.geometry.dispose();
        if (cloud.mesh.material && cloud.mesh.material !== this.cloudMaterial) {
          cloud.mesh.material.dispose();
        }
        this.scene.remove(cloud.mesh);
      }
    });
    this.clouds = [];

    // Use Fibonacci sphere distribution for better coverage of entire sphere
    const count = this.options.count;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    
    for (let i = 0; i < count; i++) {
      // For position preservation, use the old cloud's position if available
      if (preservePositions && i < oldClouds.length) {
        const oldCloud = oldClouds[i];
        const mesh = this.createSmoothCloudMesh(
          THREE.MathUtils.lerp(this.options.minScale, this.options.maxScale, Math.random())
        );
        
        // Use the old position and direction
        mesh.position.copy(oldCloud.position);
        
        // Setup cloud with preserved position data
        const cloud = {
          mesh,
          relativePos: oldCloud.direction.clone().multiplyScalar(oldCloud.radius),
          orbitAxis: new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5
          ).normalize(),
          orbitSpeed: this.options.rotationSpeed * (0.7 + Math.random() * 0.6),
          floatOffset: Math.random() * Math.PI * 2,
          floatSpeed: 0.2 + Math.random() * 0.3,
          floatAmplitude: mesh.scale.x * 0.05
        };
        
        // Make cloud face outward from center
        mesh.lookAt(this.planetCenter);
        mesh.rotateY(Math.PI); // Flip to face outward
        
        // Add some random rotation for variety
        mesh.rotation.z += Math.random() * Math.PI;
        
        this.scene.add(mesh);
        this.clouds.push(cloud);
      } else {
        // Regular cloud creation for new clouds
        const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1
        const radius = Math.sqrt(1 - y * y);  // radius at y
        
        // Apply distribution bias if configured (more clouds around equator)
        let adjustedY = y;
        if (this.options.distribution < 0.7) {
          adjustedY *= this.options.distribution;
        }
        
        // Golden angle increment around the sphere
        const theta = i * (2 * Math.PI / goldenRatio);
        
        // Convert to Cartesian coordinates on unit sphere
        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);
        const dir = new THREE.Vector3(x, adjustedY, z).normalize();
        
        // Scale to desired orbit radius range
        // FIXED: Use sphereRadius as the base for orbit calculation
        const orbitRadius = this.options.sphereRadius + 
                            THREE.MathUtils.lerp(
                              this.options.minRadius, 
                              this.options.maxRadius,
                              Math.random()
                            );

        // Create cloud with this position and direction
        this.createCloud(dir, orbitRadius, i / count);
      }
    }
  }

  createCloud(direction, orbitRadius, heightFactor = 0.5) {
    // Choose cloud scale
    const scale = THREE.MathUtils.lerp(
      this.options.minScale,
      this.options.maxScale,
      Math.random()
    );
    
    // Create orbit parameters
    // --- REVISED Orbit Axis Calculation ---
    // Ensure the orbit axis is perpendicular to the cloud's direction vector
    // This promotes movement *around* the planet.
    
    // 1. Get a vector roughly perpendicular to the direction (tangent 1)
    const tangent1 = new THREE.Vector3(0, 1, 0); // Use global up as a reference
    tangent1.cross(direction).normalize();
    // Handle case where direction is parallel to global up
    if (tangent1.lengthSq() < 0.1) {
      tangent1.set(1, 0, 0).cross(direction).normalize();
    }

    // 2. Get another perpendicular vector (tangent 2)
    const tangent2 = direction.clone().cross(tangent1).normalize();

    // 3. Create the orbit axis by randomly combining the two tangents
    // This ensures the axis is in the plane perpendicular to the direction vector.
    const randomAngle = Math.random() * Math.PI * 2;
    const orbitAxis = tangent1.clone().multiplyScalar(Math.cos(randomAngle))
                       .add(tangent2.clone().multiplyScalar(Math.sin(randomAngle)))
                       .normalize();
    // --- END REVISED Orbit Axis Calculation ---

    const orbitAngle = Math.random() * Math.PI * 2; // Keep random start angle
    const orbitSpeed = this.options.rotationSpeed * (0.7 + Math.random() * 0.6); // Varied speeds
    
    // Create natural float parameters
    const floatOffset = Math.random() * Math.PI * 2;
    const floatSpeed = this.options.floatFrequency * (0.7 + Math.random() * 0.6); // Use option
    // Use reduced float amplitude from options
    const floatAmplitude = scale * this.options.floatAmplitude * (0.8 + Math.random() * 0.4); 
    
    // compute initial rotated offset so no jump at first update
    const initialQuat = new THREE.Quaternion()
      .setFromAxisAngle(orbitAxis, orbitAngle);
    const rel = direction.clone()
      .applyQuaternion(initialQuat)
      .multiplyScalar(orbitRadius);

    const mesh = this.createSmoothCloudMesh(scale);
    mesh.position.copy(rel.add(this.planetCenter)); // Add planetCenter here for initial placement
    
    // Make cloud face outward from center
    mesh.lookAt(this.planetCenter);
    mesh.rotateY(Math.PI); // Flip to face outward
    
    // Add some random rotation for variety (only affects initial orientation)
    mesh.rotation.z += Math.random() * Math.PI;
    
    // Store the relative position vector for smooth orbit
    const cloud = {
      mesh,
      relativePos: rel.clone(), // Store vector relative to planet center
      orbitAxis,
      orbitSpeed,
      floatOffset,
      floatSpeed,
      floatAmplitude
    };
    
    this.scene.add(mesh);
    this.clouds.push(cloud);
    
    return mesh;
  }
  
  createSmoothCloudMesh(scale) {
    // Generate random vertices for convex hull
    const vertices = [];
    const vertexCount = THREE.MathUtils.randInt(
      this.options.vertexCount.min + 2, // Add 2 more points
      this.options.vertexCount.max + 2
    );
    
    // Start with a base elongated shape
    for (let i = 0; i < vertexCount; i++) {
      // Create points approximately in an elongated ellipsoid pattern
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      // Base vertex on sphere
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      
      // Apply jitter for organic shape
      const jitter = this.options.vertexJitter;
      const jitteredVertex = new THREE.Vector3(
        x + (Math.random() - 0.5) * jitter,
        y + (Math.random() - 0.5) * jitter * 0.5, // Less vertical jitter
        z + (Math.random() - 0.5) * jitter
      );
      
      // Apply anime-style elongation (horizontal stretch, vertical flatten)
      jitteredVertex.x *= scale * this.options.horizontalStretch * (0.8 + Math.random() * 0.4);
      jitteredVertex.y *= scale * this.options.verticalCompress * (0.6 + Math.random() * 0.3);
      jitteredVertex.z *= scale * (0.8 + Math.random() * 0.4);
      
      vertices.push(jitteredVertex);
    }
    
    // Add extra vertices along the horizontal axis to enhance the elongated look
    const extraHorizontalPoints = Math.floor(vertexCount * 0.8); // INCREASED: from 0.7
    for (let i = 0; i < extraHorizontalPoints; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = scale * (0.7 + Math.random() * 0.5) * this.options.horizontalStretch;
      const y = (Math.random() - 0.5) * scale * 0.5 * this.options.verticalCompress;
      
      vertices.push(new THREE.Vector3(
        Math.cos(angle) * r,
        y,
        Math.sin(angle) * r
      ));
    }
    
    // Add some vertices underneath to ensure volume and roundness
    // INCREASED: more bottom vertices for chunkier shape
    for (let i = 0; i < Math.min(7, Math.floor(vertexCount / 3)); i++) { // Increased from 5
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.7 * scale * this.options.horizontalStretch;
      vertices.push(new THREE.Vector3(
        Math.cos(theta) * r,
        -scale * this.options.verticalCompress * (0.3 + Math.random() * 0.2),
        Math.sin(theta) * r
      ));
    }
    
    // Add top vertices for more volume and roundness
    // INCREASED: more top vertices for chunkier shape
    for (let i = 0; i < Math.min(5, Math.floor(vertexCount / 4)); i++) { // Increased from 4
      const theta = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.6 * scale * this.options.horizontalStretch;
      vertices.push(new THREE.Vector3(
        Math.cos(theta) * r,
        scale * this.options.verticalCompress * (0.2 + Math.random() * 0.2),
        Math.sin(theta) * r
      ));
    }
    
    // ENHANCED: Add more prominent random protrusion points for chunkiness
    const protrusionPoints = Math.floor(Math.random() * 3) + 3; // 3-5 protrusion points
    for (let i = 0; i < protrusionPoints; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      // Calculate position on sphere
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      
      // Push vertex outward for a more prominent protrusion
      // Use chunkiness parameter to control protrusion amount
      const protrusionAmount = 0.8 + Math.random() * this.options.chunkiness; // 0.8-1.4 range with default chunkiness
      vertices.push(new THREE.Vector3(
        x * scale * this.options.horizontalStretch * protrusionAmount,
        y * scale * this.options.verticalCompress * protrusionAmount,
        z * scale * protrusionAmount
      ));
    }
    
    // Add some additional smaller bumps for more natural cloud texture
    const bumpCount = Math.floor(Math.random() * 5) + 3; // 3-7 smaller bumps
    for (let i = 0; i < bumpCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      
      // Smaller protrusions for texture
      const bumpAmount = 0.2 + Math.random() * 0.3; // 0.2-0.5 range
      vertices.push(new THREE.Vector3(
        x * scale * this.options.horizontalStretch * (1 + bumpAmount),
        y * scale * this.options.verticalCompress * (1 + bumpAmount),
        z * scale * (1 + bumpAmount)
      ));
    }
    
    // Add edge-buffering vertices to smooth the perimeter - ENHANCED
    const edgePointCount = Math.floor(vertexCount * this.options.edgeVertexDensity * 1.5); // INCREASED: 50% more edge points
    for (let i = 0; i < edgePointCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const tiltAngle = (Math.random() * 0.8 - 0.4) * Math.PI; // Mostly horizontal
      
      // Create points along cloud perimeter
      const baseRadius = scale * (0.92 + Math.random() * 0.16) * this.options.horizontalStretch;
      
      // Multiple layers of edge points for smoother transitions
      const layerCount = Math.floor(Math.random() * 2) + 2; // 2-3 layers at each edge point
      
      for (let layer = 0; layer < layerCount; layer++) {
        // Calculate radius for this layer - slightly different for each
        const layerFactor = 1.0 - (layer * 0.04); // Shrink slightly for inner layers
        const radius = baseRadius * layerFactor;
        
        // Create points at different heights along the edge
        const height = (Math.random() * 0.8 - 0.4) * scale * this.options.verticalCompress;
        
        // Calculate position using spherical coordinates
        const x = radius * Math.cos(angle);
        const y = height;
        const z = radius * Math.sin(angle);
        
        // Add slight inward/outward variation for less perfect edge
        const edgeFuzz = (Math.random() * this.options.edgeSmoothing - this.options.edgeSmoothing/2) * scale;
        
        // Create vertex with smoother edge characteristics
        vertices.push(new THREE.Vector3(
          x + edgeFuzz * Math.cos(angle),
          y + edgeFuzz * 0.3, // Less vertical fuzz
          z + edgeFuzz * Math.sin(angle)
        ));
      }
    }
    
    // NEW: Add subdivision points between existing vertices for smoother surfaces
    const interpolatedVertices = [];
    if (this.options.geometryDetail > 0.5 && vertices.length < 100) {
      // Only add interpolated points if we don't already have too many vertices
      // Select random pairs of vertices to interpolate between
      const interpolationPairCount = Math.floor(vertices.length * this.options.geometryDetail * 0.3);
      
      for (let i = 0; i < interpolationPairCount; i++) {
        const idx1 = Math.floor(Math.random() * vertices.length);
        const idx2 = Math.floor(Math.random() * vertices.length);
        
        if (idx1 !== idx2) {
          const v1 = vertices[idx1];
          const v2 = vertices[idx2];
          
          // Create 1-2 points between these vertices
          const pointCount = Math.floor(Math.random() * 2) + 1;
          
          for (let j = 1; j <= pointCount; j++) {
            const t = j / (pointCount + 1);
            // Interpolate with slight randomization
            const jitterAmount = this.options.vertexJitter * 0.3;
            const jitter = new THREE.Vector3(
              (Math.random() - 0.5) * jitterAmount,
              (Math.random() - 0.5) * jitterAmount,
              (Math.random() - 0.5) * jitterAmount
            );
            
            // Create the interpolated point with jitter
            const interpolated = new THREE.Vector3().lerpVectors(v1, v2, t).add(jitter);
            interpolatedVertices.push(interpolated);
          }
        }
      }
    }
    
    // Add the interpolated vertices to our collection
    vertices.push(...interpolatedVertices);
    
    // Add a few more subtle bumps for smoother, less angular transitions
    const smoothingPoints = Math.floor(vertexCount * 0.6); // INCREASED: from 0.4
    for (let i = 0; i < smoothingPoints; i++) {
      // Add points that help smooth transitions between features
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      // Use medium-distance points that help fill gaps
      const r = scale * (0.5 + Math.random() * 0.6) * this.options.horizontalStretch;
      
      vertices.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * this.options.verticalCompress * 0.8 * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      ));
    }
    
    // Create the convex geometry
    const geometry = new ConvexGeometry(vertices);
    geometry.computeVertexNormals();
    
    // NEW: Create layered cloud for more depth and buffered appearance
    const cloudGroup = new THREE.Group();
    
    // First layer (main cloud)
    const material = this.cloudMaterial.clone();
    material.opacity = THREE.MathUtils.lerp(
      this.options.opacity * 0.8,
      this.options.opacity,
      Math.random()
    );
    
    const mainCloudMesh = new THREE.Mesh(geometry, material);
    // ADDED: Store original scale in userData for pulsation reference
    mainCloudMesh.userData.originalScale = 1.0;
    cloudGroup.add(mainCloudMesh);
    
    // Add additional layers with slight offsets if enabled
    if (this.options.layerCount > 1) {
      for (let i = 1; i < this.options.layerCount; i++) {
        // Create slightly smaller geometry for inner layers
        const layerScale = 0.94 - (i * 0.05);
        const layerMesh = mainCloudMesh.clone();
        layerMesh.scale.multiplyScalar(layerScale);
        // ADDED: Store original scale in userData for pulsation reference
        layerMesh.userData.originalScale = layerScale;
        
        // Random small offset
        layerMesh.position.set(
          (Math.random() - 0.5) * scale * 0.06,
          (Math.random() - 0.5) * scale * 0.04,
          (Math.random() - 0.5) * scale * 0.06
        );
        
        // Slightly different opacity for depth effect
        layerMesh.material = material.clone();
        layerMesh.material.opacity = material.opacity * (0.85 + Math.random() * 0.15);
        
        cloudGroup.add(layerMesh);
      }
    }
    
    // Store individual rotation axis for cloud spinning with more natural variation
    const rotationAxis = new THREE.Vector3(
      Math.random() - 0.5,
      (Math.random() - 0.5) * 0.3, // Less vertical rotation
      Math.random() - 0.5
    ).normalize();
    
    cloudGroup.userData.rotationAxis = rotationAxis;
    
    // MODIFIED: Reduce individual cloud rotation settings to minimum
    // This prevents clouds from appearing to rotate in place
    const rotSpeed = this.options.cloudRotationSpeed * 0.05; // Drastically reduced
    cloudGroup.userData.rotationSpeed = rotSpeed;
    
    // NEW: Add additional movement patterns for more organic feel
    cloudGroup.userData.floatOffset = Math.random() * Math.PI * 2;
    cloudGroup.userData.floatSpeed = this.options.floatFrequency * (0.7 + Math.random() * 0.6);
    cloudGroup.userData.floatAmplitude = this.options.floatAmplitude * (0.8 + Math.random() * 0.4);
    
    // NEW: Add secondary oscillation on a different axis for more complex movement
    cloudGroup.userData.secondaryAxis = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();
    // FIX: Use rotSpeed instead of undefined baseSpeed
    cloudGroup.userData.secondarySpeed = rotSpeed * 1.5;
    cloudGroup.userData.secondaryAmplitude = 0.3;
    
    return cloudGroup;
  }

  // New method to update initial positions without any movement
  _updateInitialPositions() {
    this.clouds.forEach(cloud => {
      const mesh = cloud.mesh;
      if (!mesh) return;
      
      // Calculate initial position directly using relativePos + planetCenter
      const pos = cloud.relativePos.clone().add(this.planetCenter);
      
      // Apply position without any animation or easing
      mesh.position.copy(pos);
      
      // Face outward from center
      mesh.lookAt(this.planetCenter);
      mesh.rotateY(Math.PI);
    });
    console.log("[CloudSystem] _updateInitialPositions completed."); // Add log for confirmation
  }

  update(deltaTime) {
    // Update atmospheric halo if it exists
    if (this.atmosphereMesh) {
      // Update sun direction slowly over time for dynamic lighting
      const time = Date.now() * 0.0001;
      const sunDir = new THREE.Vector3(
        Math.sin(time * 0.5),
        Math.cos(time * 0.3),
        Math.sin(time * 0.7)
      ).normalize();
      
      this.atmosphereMesh.material.uniforms.sunDirection.value.copy(sunDir);
    }

    const dt = Math.min(deltaTime, 0.1);
    
    // Check initialization status
    const elapsed = Date.now() - (this.startTime || 0);
    
    // Handle initialization completion (unfreezing movement)
    if (!this.initialized && elapsed >= this.initializationTime) {
      this.initialized = true;
      this.initializing = false; // Clear initializing flag
      this.frozen = false; // Unfreeze movement after initialization
      console.log("[CloudSystem] Initialization complete, movement unfrozen."); // Log
      
      // Apply higher speed after initialization to make orbits noticeable
      // this.setOrbitSpeed(3.0); // You might adjust/remove this depending on desired final speed
    }

    // Only handle opacity fade-in *after* positions are stabilized
    if (this.positionsStabilized) {
      // Calculate fade progress based on the main initialization timer
      const fadeProgress = Math.min(elapsed / this.fadeInTime, 1.0);
      
      // Apply an exponential easing curve
      const easedFadeProgress = Math.pow(fadeProgress, 3); // Cubic easing
      
      this.clouds.forEach(cloud => {
        if (cloud.mesh) {
          cloud.mesh.children.forEach(child => {
            if (child.material && child.material._originalOpacity !== undefined) {
              // Ensure opacity doesn't exceed original
              child.material.opacity = Math.min(
                easedFadeProgress * child.material._originalOpacity,
                child.material._originalOpacity
              );
            }
          });
        }
      });
    }
    
    // Guard movement: Don't move if frozen, still initializing, OR not yet fully initialized
    if (this.frozen || this.initializing || !this.initialized) {
       // console.log(`[CloudSystem Update Guard] frozen: ${this.frozen}, initializing: ${this.initializing}, initialized: ${this.initialized}`); // Optional debug log
       return; 
    }
    
    // Process each cloud - ONLY orbital movement + radial float
    this.clouds.forEach(cloud => {
      const mesh = cloud.mesh;
      if (!mesh) return;
      
      // 1. Apply orbit rotation around the calculated orbitAxis
      // This rotates the relativePos vector around the planet center.
      cloud.relativePos.applyAxisAngle(
        cloud.orbitAxis,
        cloud.orbitSpeed * dt
      );

      // 2. Add subtle floating motion - varying the *radius* (altitude)
      cloud.floatOffset += dt * cloud.floatSpeed;
      // Use a smaller amplitude for the float effect
      const floatDelta = Math.sin(cloud.floatOffset) * cloud.floatAmplitude; 

      // 3. Compute position: Get the base radius, add floatDelta, apply direction, add planet center
      const baseR = cloud.relativePos.length(); // Current base radius from relativePos
      const dir = cloud.relativePos.clone().normalize(); // Current direction from center
      // Apply the floatDelta radially and add the planet center offset
      const pos = dir.multiplyScalar(baseR + floatDelta).add(this.planetCenter); 
      mesh.position.copy(pos);

      // 4. Make cloud face outward from center - important for proper orientation
      mesh.lookAt(this.planetCenter);
      mesh.rotateY(Math.PI);
      
      // 5. REMOVED: Individual cloud rotation to emphasize orbital motion
    });
  }

  // Helper methods for disposing resources
  dispose() {
    this.clouds.forEach(cloud => {
      if (cloud.mesh) {
        if (cloud.mesh.geometry) cloud.mesh.geometry.dispose();
        if (cloud.mesh.material && cloud.mesh.material !== this.cloudMaterial) {
          cloud.mesh.material.dispose();
        }
        this.scene.remove(cloud.mesh);
      }
    });
    
    if (this.cloudMaterial) this.cloudMaterial.dispose();
    this.clouds = [];
  }

  // Set planet center position
  setPlanetCenter(position) {
    this.planetCenter.copy(position);
    console.log(`Cloud system planet center updated to: ${position.x}, ${position.y}, ${position.z}`);
  }

  // Controls for atmospheric effects
  setAtmosphericDensity(density) {
    if (this.scene.fog && this.scene.fog.density !== undefined) {
      this.scene.fog.density = density;
      console.log(`Atmospheric fog density updated to: ${density}`);
    }
  }

  setAtmosphereIntensity(intensity) {
    if (this.atmosphereMesh && this.atmosphereMesh.material) {
      const material = this.atmosphereMesh.material;
      material.uniforms.glowIntensity = { value: Math.max(0, Math.min(1, intensity)) };
    }
    
    if (this.scene.fog && this.scene.fog.density !== undefined) {
      const baseDensity = this.options.fogDensity;
      this.scene.fog.density = baseDensity * (1.0 / Math.max(0.1, intensity));
    }
  }

  // Adjust cloud heights
  adjustCloudHeight(heightMultiplier) {
    if (!this._originalMinRadius) {
      this._originalMinRadius = this.options.minRadius;
      this._originalMaxRadius = this.options.maxRadius;
    }
    
    this.options.minRadius = this._originalMinRadius * heightMultiplier;
    this.options.maxRadius = this._originalMaxRadius * heightMultiplier;
    
    console.log(`Adjusting cloud height: min=${this.options.minRadius}, max=${this.options.maxRadius} (x${heightMultiplier})`);
    
    this.init(true);
    
    return {
      minRadius: this.options.minRadius,
      maxRadius: this.options.maxRadius,
      multiplier: heightMultiplier
    };
  }
  
  // Add method to adjust anime style parameters
  setCloudStyle(horizontalStretch = 1.8, verticalCompress = 0.7) {
    this.options.horizontalStretch = horizontalStretch;
    this.options.verticalCompress = verticalCompress;
    console.log(`Cloud style updated: horizontalStretch=${horizontalStretch}, verticalCompress=${verticalCompress}`);
    
    // Recreate clouds with new style and explicitly preserve positions
    const oldClouds = this.clouds.map(cloud => ({
      position: cloud.mesh.position.clone(),
      direction: cloud.relativePos.clone().normalize(),
      radius: cloud.relativePos.length()
    }));
    
    // Use our own preserved positions rather than relying on the built-in preservation
    this.createClouds(true, oldClouds);
    
    return {
      horizontalStretch,
      verticalCompress
    };
  }

  // NEW: Add method to adjust cloud buffer/smoothing settings
  setCloudSmoothness(settings = {}) {
    // Update smoothness-related parameters
    if (settings.edgeVertexDensity !== undefined) {
      this.options.edgeVertexDensity = settings.edgeVertexDensity;
    }
    
    if (settings.edgeSmoothing !== undefined) {
      this.options.edgeSmoothing = settings.edgeSmoothing;
    }
    
    if (settings.vertexCount !== undefined) {
      this.options.vertexCount.min = settings.vertexCount.min || this.options.vertexCount.min;
      this.options.vertexCount.max = settings.vertexCount.max || this.options.vertexCount.max;
    }
    
    if (settings.geometryDetail !== undefined) {
      this.options.geometryDetail = settings.geometryDetail;
    }
    
    if (settings.layerCount !== undefined) {
      this.options.layerCount = settings.layerCount;
    }
    
    // Regenerate clouds with new parameters
    this.init(true);
    
    return {
      edgeVertexDensity: this.options.edgeVertexDensity,
      edgeSmoothing: this.options.edgeSmoothing,
      vertexCount: this.options.vertexCount,
      geometryDetail: this.options.geometryDetail,
      layerCount: this.options.layerCount
    };
  }

  // NEW: Set movement pattern parameters
  setCloudMovement(settings = {}) {
    // Update movement-related parameters
    if (settings.cloudRotationSpeed !== undefined) {
      this.options.cloudRotationSpeed = settings.cloudRotationSpeed;
    }
    
    if (settings.floatAmplitude !== undefined) {
      this.options.floatAmplitude = settings.floatAmplitude;
    }
    
    if (settings.floatFrequency !== undefined) {
      this.options.floatFrequency = settings.floatFrequency;
    }
    
    // Apply new movement parameters to existing clouds
    this.clouds.forEach(cloud => {
      if (cloud.mesh && cloud.mesh.userData) {
        cloud.mesh.userData.rotationSpeed = this.options.cloudRotationSpeed * 
          (0.3 + Math.random() * 0.4);
        cloud.mesh.userData.floatSpeed = this.options.floatFrequency * 
          (0.7 + Math.random() * 0.6);
        cloud.mesh.userData.floatAmplitude = this.options.floatAmplitude * 
          (0.8 + Math.random() * 0.4);
      }
    });
    
    return {
      cloudRotationSpeed: this.options.cloudRotationSpeed,
      floatAmplitude: this.options.floatAmplitude,
      floatFrequency: this.options.floatFrequency
    };
  }

  // Add method to make cloud movement more noticeable for testing
  increaseCloudSpeed(multiplier = 2.0) {
    this.options.rotationSpeed *= multiplier;
    
    // Also update existing clouds
    this.clouds.forEach(cloud => {
      cloud.orbitSpeed *= multiplier;
    });
    
    console.log(`Cloud rotation speed increased by ${multiplier}x to ${this.options.rotationSpeed}`);
    return this.options.rotationSpeed;
  }

  // Add this method to make orbit movement more noticeable
  setOrbitSpeed(multiplier = 1.0) {
    // Store original value if not already stored
    if (!this._originalRotationSpeed) {
      this._originalRotationSpeed = this.options.rotationSpeed;
    }
    
    // Apply multiplier to original speed
    const newSpeed = this._originalRotationSpeed * multiplier;
    this.options.rotationSpeed = newSpeed;
    
    // Update existing clouds
    this.clouds.forEach(cloud => {
      cloud.orbitSpeed = newSpeed * (0.7 + Math.random() * 0.6);
    });
    
    // Add console log showing the new cloud movement speed is applied
    console.log(`Cloud orbit speed set to ${newSpeed.toFixed(6)} (${multiplier}x base) - clouds now orbiting around planet radius ${this.options.sphereRadius}`);
    return newSpeed;
  }
}

export default CloudSystem;
