// CloudSystem.js - A system to create and manage chunky low-poly clouds around the planet
import * as THREE from 'three';

class CloudSystem {
  constructor(scene, options = {}) {
    if (typeof options !== 'object' || options === null) {
      throw new Error('Options parameter must be an object.');
    }
    this.scene = scene;
    this.options = {
      count: 48,  // Doubled cloud count for better coverage
      // ADJUSTED CLOUD ELEVATIONS - Much closer to be visible
      minRadius: 1200,  // Reduced from 15000 to 1200 - visible but still high
      maxRadius: 1500,  // Reduced from 20000 to 1500 - creates stratosphere effect
      minScale: 40,     // Adjusted for better visibility at new height
      maxScale: 80,     // Adjusted for better visibility at new height
      rotationSpeed: 0.00035, // Increased for more noticeable rotation
      opacity: 0.9,     // Higher opacity to be more visible
      color: 0xffffff,
      distribution: 0.3, // More concentrated at equator for better visual effect
      vertexJitter: 0.3, // More jitter for more dramatic shapes
      bottomFlatten: -0.4,
      // Enhanced atmospheric fog settings for space-like effect
      fogColor: 0x8bb0ff, // Slightly more blue for cosmic look
      fogDensity: 0.000015, // Adjusted density for better visibility
      ...options
    };
    this.clouds = [];
    this.cloudGroups = [];
    this.planetCenter = new THREE.Vector3(0, 0, 0); // Default planet center
    this.init();
  }

  init() {
    // Set up enhanced atmospheric fog for cosmic distance
    if (!this.scene.fog) {
      this.scene.fog = new THREE.FogExp2(
        this.options.fogColor,
        this.options.fogDensity
      );
      
      // Set sky background color to create cosmic atmosphere gradient
      if (!this.scene.background) {
        const skyColor = new THREE.Color(this.options.fogColor).lerp(new THREE.Color(0x0a1030), 0.4);
        this.scene.background = skyColor;
      }
      
      // Create atmospheric haze effect around planet
      this._createAtmosphericHalo();
      
      console.log("Added cosmic fog and atmospheric halo");
    }

    // Use MeshStandardMaterial with adjusted properties for cosmic cloud look
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: this.options.color,
      transparent: true,
      opacity: this.options.opacity,
      roughness: 0.7, // Smoother clouds for distant viewing
      metalness: 0.1, // Slightly reflective for sunlight catching
      flatShading: true,
      emissive: 0x334466, // Increased blue emissive for cosmic glow
      emissiveIntensity: 0.12 // Stronger glow effect
    });
    
    this.createCloudGroups();
    console.log(`CloudSystem initialized with ${this.clouds.length} clouds at cosmic elevation ${this.options.minRadius}-${this.options.maxRadius}`);
  }

  /**
   * Creates an atmospheric halo effect around the planet
   * @private
   */
  _createAtmosphericHalo() {
    // Get reference to planet radius (approximately 400)
    const planetRadius = 400; 
    
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

  createCloudGroups() {
    // tear down any old
    this.clouds.forEach(c => c.mesh && this.scene.remove(c.mesh));
    this.cloudGroups.forEach(g => this.scene.remove(g.group));
    this.clouds = [];
    this.cloudGroups = [];

    // Create multiple cloud layers with more even distribution
    const layerCount = 5; // Keep 5 layers for depth
    
    // Create rotation axes at different angles for better distribution
    const rotationAxes = [
      new THREE.Vector3(0, 1, 0), // Y axis (equatorial orbit)
      new THREE.Vector3(0.3, 1, 0.1).normalize(), // More dramatically tilted axis 1
      new THREE.Vector3(-0.2, 1, 0.3).normalize(), // More dramatically tilted axis 2
      new THREE.Vector3(0.1, 1, -0.4).normalize(), // Added another tilted axis
      new THREE.Vector3(-0.3, 1, -0.2).normalize(), // Added another tilted axis
    ];

    // Create groups with wider vertical distribution
    for (let g = 0; g < layerCount; g++) {
      const group = new THREE.Group();
      this.scene.add(group);

      // Define layer-specific settings with improved separation
      const layerSettings = {
        // Each layer has different height range with better separation
        minRadius: this.options.minRadius + (g * (this.options.maxRadius - this.options.minRadius) / layerCount * 0.8),
        maxRadius: this.options.minRadius + ((g + 1) * (this.options.maxRadius - this.options.minRadius) / layerCount * 0.9),
        // Alternative rotation directions and speeds
        direction: g % 2 === 0 ? 1 : -1,
        // INCREASED rotation speed for more visible movement
        speed: this.options.rotationSpeed * (1.5 + g * 0.4),
        // More progressive opacity reduction with height
        opacity: this.options.opacity * (1 - (g * 0.12)), // Higher clouds are more transparent
        // Use a different rotation axis for each layer
        rotationAxis: rotationAxes[g % rotationAxes.length]
      };

      this.cloudGroups.push({
        group,
        direction: layerSettings.direction,
        speed: layerSettings.speed,
        layerIndex: g,
        rotationAxis: layerSettings.rotationAxis
      });

      // Create clouds for this layer
      const perLayer = Math.floor(this.options.count / layerCount);
      for (let i = 0; i < perLayer; i++) {
        this.createCloud(group, layerSettings);
      }
    }
  }

  createCloud(group, layerSettings) {
    const scale = THREE.MathUtils.lerp(
      this.options.minScale,
      this.options.maxScale,
      Math.random()
    );
    
    // Use layer-specific radius range for better stratification
    const radius = THREE.MathUtils.lerp(
      layerSettings.minRadius || this.options.minRadius,
      layerSettings.maxRadius || this.options.maxRadius,
      Math.random()
    );

    // spherical coords with improved distribution
    const phi = Math.random() * Math.PI * 2;
    let theta = (Math.random() - 0.5) * Math.PI;
    
    // If distribution is less than 0.8, concentrate clouds more around the equator
    // This prevents clouds from clustering at the poles
    theta *= this.options.distribution < 0.8
      ? this.options.distribution
      : 0.5;

    // Calculate position on sphere
    const x = radius * Math.sin(theta) * Math.cos(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(theta);

    const geo = this.createCloudGeometry(scale);
    
    // Clone the material for this specific cloud for layer-specific opacity
    const material = this.cloudMaterial.clone();
    if (layerSettings.opacity !== undefined) {
      material.opacity = layerSettings.opacity;
    }
    
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);

    // Store the orbital parameters for proper animation
    mesh.userData.orbitalRadius = radius;
    mesh.userData.orbitalTheta = theta;
    mesh.userData.orbitalPhi = phi;

    // have it face roughly outward from planet center
    mesh.lookAt(this.planetCenter);
    // Rotate to create some variation
    mesh.rotateY(Math.PI); // Flip to face outward
    mesh.rotateX(Math.random() * Math.PI * 0.3);
    mesh.rotateZ(Math.random() * Math.PI * 2);

    // Add subtle movement animation to individual clouds
    const floatOffset = Math.random() * Math.PI * 2;
    mesh.userData.floatSpeed = 0.2 + Math.random() * 0.3;
    
    // IMPORTANT: Limit float amplitude to a small percentage of orbital radius
    // This ensures clouds don't pass through the planet
    mesh.userData.floatAmplitude = Math.min(scale * 0.1, radius * 0.03); 
    mesh.userData.floatOffset = floatOffset;
    mesh.userData.originalPosition = mesh.position.clone();

    group.add(mesh);
    this.clouds.push({ 
      mesh, 
      scale, 
      radius,
      material, // Track material for disposal
      floatOffset,
      floatSpeed: mesh.userData.floatSpeed,
      floatAmplitude: mesh.userData.floatAmplitude,
      // Store orbital parameters for animation
      orbitalRadius: radius,
      orbitalTheta: theta,
      orbitalPhi: phi,
      // Store reference to parent group for proper orbiting
      group: group
    });
    
    return mesh;
  }

  createCloudGeometry(scale) {
    // Create merged geometry from multiple spheres
    const geometry = new THREE.BufferGeometry();
    const geometries = [];
    
    // Create first tuft sphere
    const tuft1 = new THREE.SphereGeometry(scale * 0.75, 7, 8);
    tuft1.translate(-scale * 0.6, 0, 0);
    geometries.push(tuft1);
    
    // Create second tuft sphere
    const tuft2 = new THREE.SphereGeometry(scale * 0.75, 7, 8);
    tuft2.translate(scale * 0.6, 0, 0);
    geometries.push(tuft2);
    
    // Create middle/main sphere (slightly larger)
    const tuft3 = new THREE.SphereGeometry(scale, 7, 8);
    geometries.push(tuft3);
    
    // Add some random additional tufts for variety
    const extraTufts = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < extraTufts; i++) {
      const tuftSize = scale * (0.5 + Math.random() * 0.3);
      const tuft = new THREE.SphereGeometry(tuftSize, 7, 8);
      
      // Position randomly but not too far from center
      const angle = Math.random() * Math.PI * 2;
      const dist = scale * 0.4 * Math.random();
      tuft.translate(
        Math.cos(angle) * dist,
        (Math.random() * 0.6 - 0.2) * scale,
        Math.sin(angle) * dist
      );
      geometries.push(tuft);
    }
    
    // Merge all geometries into one
    geometry.copy(this.mergeBufferGeometries(geometries));
    
    // Apply jitter to vertices
    this.jitterGeometry(geometry, scale * this.options.vertexJitter);
    
    // Flatten bottom
    this.chopBottom(geometry, -scale * 0.5);
    
    // Clean up temporary geometries
    geometries.forEach(g => g.dispose());
    
    return geometry;
  }
  
  // Helper to merge BufferGeometries
  mergeBufferGeometries(geometries) {
    const positions = [];
    const normals = [];
    const uvs = [];
    
    let vertexCount = 0;
    let indexCount = 0;
    
    // Count total vertices and indices
    for (const geo of geometries) {
      if (geo.index) indexCount += geo.index.count;
      else indexCount += geo.attributes.position.count;
      vertexCount += geo.attributes.position.count;
    }
    
    // Create arrays for attributes
    const positionArray = new Float32Array(vertexCount * 3);
    const normalArray = new Float32Array(vertexCount * 3);
    const uvArray = new Float32Array(vertexCount * 2);
    
    // Create new index array if needed
    let hasIndex = geometries[0].index !== null;
    let indexArray = hasIndex ? new Uint32Array(indexCount) : null;
    
    let indexOffset = 0;
    let vertexOffset = 0;
    
    // Merge each geometry
    for (const geo of geometries) {
      const posAttr = geo.attributes.position;
      const normAttr = geo.attributes.normal;
      const uvAttr = geo.attributes.uv;
      
      // Copy position data
      for (let i = 0; i < posAttr.count; i++) {
        positionArray[3 * (vertexOffset + i)] = posAttr.getX(i);
        positionArray[3 * (vertexOffset + i) + 1] = posAttr.getY(i);
        positionArray[3 * (vertexOffset + i) + 2] = posAttr.getZ(i);
      }
      
      // Copy normal data
      for (let i = 0; i < normAttr.count; i++) {
        normalArray[3 * (vertexOffset + i)] = normAttr.getX(i);
        normalArray[3 * (vertexOffset + i) + 1] = normAttr.getY(i);
        normalArray[3 * (vertexOffset + i) + 2] = normAttr.getZ(i);
      }
      
      // Copy UV data if available
      if (uvAttr) {
        for (let i = 0; i < uvAttr.count; i++) {
          uvArray[2 * (vertexOffset + i)] = uvAttr.getX(i);
          uvArray[2 * (vertexOffset + i) + 1] = uvAttr.getY(i);
        }
      }
      
      // Copy indices
      if (hasIndex) {
        const index = geo.index;
        for (let i = 0; i < index.count; i++) {
          indexArray[indexOffset + i] = index.getX(i) + vertexOffset;
        }
        indexOffset += index.count;
      }
      
      vertexOffset += posAttr.count;
    }
    
    // Create result geometry
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
    result.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
    result.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    
    if (hasIndex) {
      result.setIndex(new THREE.BufferAttribute(indexArray, 1));
    }
    
    return result;
  }
  
  // Apply random jitter to vertices
  jitterGeometry(geometry, amount) {
    const pos = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    
    // Helper to map random values to range
    const map = (val, smin, smax, emin, emax) => 
      (emax - emin) * (val - smin) / (smax - smin) + emin;
    
    // Jitter each vertex position
    for (let i = 0; i < pos.count; i++) {
      pos.setX(i, pos.getX(i) + map(Math.random(), 0, 1, -amount, amount));
      pos.setY(i, pos.getY(i) + map(Math.random(), 0, 1, -amount, amount));
      pos.setZ(i, pos.getZ(i) + map(Math.random(), 0, 1, -amount, amount));
    }
    
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  
  // Flatten the bottom of clouds for that cartoon cloud look
  chopBottom(geometry, bottom) {
    const pos = geometry.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < bottom) {
        pos.setY(i, bottom);
      }
    }
    
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
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
    
    // ENHANCED: Make sure deltaTime is reasonable to prevent huge jumps
    const safeDeltatime = Math.min(deltaTime, 0.1);
    
    // Update each cloud group separately
    this.cloudGroups.forEach(g => {
      // Get the group's clouds
      const groupClouds = this.clouds.filter(cloud => cloud.group === g.group);
      
      // Calculate rotation angle based on speed, direction and delta
      // INCREASED rotation effect - use larger factor to be more visible
      const rotationAngle = safeDeltatime * g.speed * g.direction * 2.5;
      
      // Create rotation quaternion around the specific axis for this group
      const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(
        g.rotationAxis, 
        rotationAngle
      );
      
      // Apply rotation to each cloud's position directly
      groupClouds.forEach(cloud => {
        if (!cloud.mesh) return;
        
        // Get current position relative to planet center
        const relativePos = cloud.mesh.position.clone().sub(this.planetCenter);
        
        // Apply rotation to the position vector
        relativePos.applyQuaternion(rotationQuaternion);
        
        // Add floating motion along the radial direction
        cloud.floatOffset += safeDeltatime * cloud.floatSpeed;
        const floatY = Math.sin(cloud.floatOffset) * cloud.floatAmplitude;
        
        // Get normalized radial direction and apply floating
        const radialDir = relativePos.clone().normalize();
        const targetRadius = cloud.orbitalRadius + floatY;
        
        // Set new position - combine orbital rotation with floating
        const newPosition = radialDir.multiplyScalar(targetRadius).add(this.planetCenter);
        cloud.mesh.position.copy(newPosition);
        
        // Make cloud face away from planet center
        cloud.mesh.lookAt(this.planetCenter);
        cloud.mesh.rotateY(Math.PI); // Rotate 180° to face outward
        
        // Add subtle rotation for more dynamic appearance
        cloud.mesh.rotation.z += safeDeltatime * 0.15 * g.direction;
      });
    });
  }

  dispose() {
    this.clouds.forEach(c => {
      if (c.mesh && c.mesh.geometry) c.mesh.geometry.dispose();
      if (c.material && c.material !== this.cloudMaterial) c.material.dispose();
      if (c.mesh) this.scene.remove(c.mesh);
    });
    
    this.cloudGroups.forEach(g => this.scene.remove(g.group));
    
    if (this.cloudMaterial) this.cloudMaterial.dispose();
    
    this.clouds = [];
    this.cloudGroups = [];
    
    // Don't remove fog as it might be used by other systems
  }

  // Set planet center position - useful if planet isn't at origin
  setPlanetCenter(position) {
    this.planetCenter.copy(position);
    console.log(`Cloud system planet center updated to: ${position.x}, ${position.y}, ${position.z}`);
  }

  // Add a method to adjust fog settings
  setAtmosphericDensity(density) {
    if (this.scene.fog && this.scene.fog.density !== undefined) {
      this.scene.fog.density = density;
      console.log(`Atmospheric fog density updated to: ${density}`);
    }
  }

  // Add method to adjust atmospheric visuals
  setAtmosphereIntensity(intensity) {
    if (this.atmosphereMesh && this.atmosphereMesh.material) {
      // Adjust glow intensity
      const material = this.atmosphereMesh.material;
      material.uniforms.glowIntensity = { value: Math.max(0, Math.min(1, intensity)) };
      console.log(`Atmospheric glow intensity updated to: ${intensity}`);
    }
    
    // Also adjust fog density based on intensity
    if (this.scene.fog && this.scene.fog.density !== undefined) {
      // Scale fog density inversely with intensity (more intensity = less fog)
      const baseDensity = this.options.fogDensity;
      this.scene.fog.density = baseDensity * (1.0 / Math.max(0.1, intensity));
    }
  }

  // Add a method to bring clouds closer/further in real-time
  adjustCloudHeight(heightMultiplier) {
    // Store original min/max if not already stored
    if (!this._originalMinRadius) {
      this._originalMinRadius = this.options.minRadius;
      this._originalMaxRadius = this.options.maxRadius;
    }
    
    // Calculate new radius values
    const newMinRadius = this._originalMinRadius * heightMultiplier;
    const newMaxRadius = this._originalMaxRadius * heightMultiplier;
    
    console.log(`Adjusting cloud height: min=${newMinRadius}, max=${newMaxRadius} (x${heightMultiplier})`);
    
    // Update options
    this.options.minRadius = newMinRadius;
    this.options.maxRadius = newMaxRadius;
    
    // Reinitialize clouds at new height
    this.init();
    
    return {
      minRadius: newMinRadius,
      maxRadius: newMaxRadius,
      multiplier: heightMultiplier
    };
  }
}

export default CloudSystem;
