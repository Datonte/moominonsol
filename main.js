import './style.css'
import snowSrc from './assets/pngwing.com.png'

// Clipboard Logic
const copyBtn = document.getElementById('copy-btn');
const contractCode = document.getElementById('contract-address');

copyBtn.addEventListener('click', () => {
  const text = contractCode.innerText;
  navigator.clipboard.writeText(text).then(() => {
    // Visual feedback
    const originalIcon = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    contractCode.classList.add('highlight');

    setTimeout(() => {
      copyBtn.innerHTML = originalIcon;
      contractCode.classList.remove('highlight');
    }, 2000);
  });
});

// Scroll Animation Trigger (Simple intersection observer)
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animationPlayState = 'running';
    }
  });
});

document.querySelectorAll('.slide-in').forEach(el => {
  observer.observe(el);
});


// Gallery Auto-Scroll Logic - SIMPLIFIED (Auto-scroll only, no manual interaction)
const galleryWrapper = document.getElementById('gallery-wrapper');

if (galleryWrapper) {
  const scrollSpeed = 1.5; // Pixels per frame
  
  // Infinite Scroll Logic (Triple Set)
  const track = document.getElementById('gallery-track');
  
  if (track && track.children.length > 0) {
    const items = Array.from(track.children);
    // Clone TWICE for infinite loop
    items.forEach(item => track.appendChild(item.cloneNode(true)));
    items.forEach(item => track.appendChild(item.cloneNode(true)));
  }
  
  // Simple Auto-Scroll Animation Loop
  function autoScrollLoop() {
    // Check if gallery is ready
    if (!galleryWrapper || galleryWrapper.scrollWidth === 0) {
      requestAnimationFrame(autoScrollLoop);
      return;
    }

    // Apply continuous auto-scroll
    galleryWrapper.scrollLeft += scrollSpeed;

    // Infinite Loop Logic
    const singleSetWidth = galleryWrapper.scrollWidth / 3;
    if (singleSetWidth > 0) {
       // Jump back when we reach the end of second set
       if (galleryWrapper.scrollLeft >= 2 * singleSetWidth) {
          galleryWrapper.scrollLeft -= singleSetWidth;
       } 
       // Jump forward if we're at the beginning
       else if (galleryWrapper.scrollLeft <= 0) {
          galleryWrapper.scrollLeft += singleSetWidth;
       }
    }

    requestAnimationFrame(autoScrollLoop);
  }
  
  // Initialize gallery position
  function initializeGallery() {
    if (galleryWrapper.scrollWidth > 0 && track && track.children.length > 0) {
      // Start at the middle set
      galleryWrapper.scrollLeft = galleryWrapper.scrollWidth / 3;
      console.log('Gallery initialized:', {
        scrollWidth: galleryWrapper.scrollWidth,
        scrollLeft: galleryWrapper.scrollLeft,
        children: track.children.length
      });
    } else {
      // Retry if not ready
      setTimeout(initializeGallery, 100);
    }
  }
  
  // Wait for images to load
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeGallery, 500);
    });
  } else {
    setTimeout(initializeGallery, 500);
  }

  // Start auto-scroll loop
  requestAnimationFrame(autoScrollLoop);
  
  // Prevent any default scrolling behavior
  galleryWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
  }, { passive: false });
  
  galleryWrapper.addEventListener('touchstart', (e) => {
    e.preventDefault();
  }, { passive: false });
  
  galleryWrapper.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });
}


// Snowflake Animation Engine
const canvas = document.getElementById('snow-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
// Dynamic variables instead of constants
let particleCount = 300; // Increased for fuller snow effect
let maxPileCount = 0; // Removed piling
let pileCount = 0;
let respawnMultiplier = 2.0; // Increased for more spread across screen
let interactionRadius = 150;
const GRAVITY = 0.02; // Reduced from 0.2 for slower fall
const TERMINAL_VELOCITY = 1.5; // Reduced from 4 for slower max speed

// Mobile detection and optimization
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isLowEndDevice = isMobile && (navigator.hardwareConcurrency <= 4 || window.devicePixelRatio <= 1);

// Liquid Snow Globals
const GRID_SIZE = 25; // Size of density bins in pixels
let densityGrid = [];

// Mouse State
const mouse = { x: -1000, y: -1000, pressed: false, prevX: -1000, prevY: -1000 };
let lastTouchTime = 0;
let mouseTrail = [];
const MAX_TRAIL_LENGTH = 15;

// Load Image
const snowImage = new Image();
snowImage.src = snowSrc;

// Offscreen buffer
let offscreenCanvas;
let offscreenCtx;
let flakeSize = 25; // Default

snowImage.onload = () => {
  offscreenCanvas = document.createElement('canvas');
  // Render at high res (desktop size) to allow pretty downscaling
  offscreenCanvas.width = 25;
  offscreenCanvas.height = 25;
  offscreenCtx = offscreenCanvas.getContext('2d');
  offscreenCtx.drawImage(snowImage, 0, 0, 25, 25);

  init();
  animate();
};

function resize() {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;

  // UNIVERSAL SCALING LOGIC
  // Goal: Maintain beautiful snow effect across all devices.

  // 1. Particle Density (Particles per pixel)
  const baseArea = 1920 * 1080;
  const currentArea = width * height;
  let particleRatio = 300 / baseArea; // Base ratio for 300 particles

  // Mobile optimizations
  if (isMobile) {
    particleRatio *= 0.8; // Slight reduction on mobile for better performance
  }
  
  if (isLowEndDevice) {
    particleRatio *= 0.6; // Further reduce on low-end devices
  }

  // Calculate proportional count
  particleCount = Math.floor(currentArea * particleRatio);

  // 2. Pile Density - Disabled
  maxPileCount = 0;

  // 3. Flake Size
  // Keep them relatively large to maintain the "Moomin" art style
  // Only scale down slightly on very narrow screens
  if (width < 600) {
    flakeSize = 18; // Readable on mobile
  } else {
    flakeSize = 25; // Original Desktop size
  }

  // Scale interaction radius for mobile
  if (isMobile) {
    interactionRadius = Math.max(60, Math.min(120, width * 0.2)); // Larger on mobile for easier interaction
  } else {
    interactionRadius = Math.max(40, Math.min(150, width * 0.15));
  }

  // 4. Respawn Logic - Increased for fuller screen coverage
  // Higher multiplier = snow spawns higher above screen = more natural fall across entire screen
  respawnMultiplier = height < 800 ? 1.5 : 2.5;

  // Bounds consistency: Good particle count for all devices
  // Caps: Min 50 flakes (for looks), Max 500 (for performance)
  if (isMobile) {
    particleCount = Math.min(Math.max(50, particleCount), 250); // Better limits on mobile
  } else {
    particleCount = Math.min(Math.max(100, particleCount), 500); // More snow on desktop
  }
  maxPileCount = 0;

  // Resample particles array match new target
  if (particles.length > particleCount) {
    particles = particles.slice(0, particleCount);
    // Recalculate pileCount just in case (approximate or just let it settle)
    pileCount = particles.filter(p => p.landed).length;
  } else {
    while (particles.length < particleCount) {
      particles.push(new Particle());
    }
  }

  // Fix landed particles position on resize (e.g. orientation change)
  particles.forEach(p => {
    if (p.landed) {
      // Force reset if they were landed, since we don't want them landed anymore
      p.reset();
    }
  });
  
  console.log(`Moomin Snow - Device: ${isMobile ? 'Mobile' : 'Desktop'}, Particles: ${particleCount}, Interaction Radius: ${interactionRadius}`);
}

window.addEventListener('resize', resize);

// Handle orientation changes on mobile
let orientationChangeTimeout;
window.addEventListener('orientationchange', () => {
  // Clear particles during orientation change for smoother transition
  particles = [];
  
  // Debounce resize to avoid multiple calls
  clearTimeout(orientationChangeTimeout);
  orientationChangeTimeout = setTimeout(() => {
    resize();
    init();
  }, 300);
});

// Enhanced Mouse/Touch Interaction with Trail
window.addEventListener('mousemove', (e) => {
  // Ignore emulated mouse events after touch
  if (Date.now() - lastTouchTime < 500) return;
  
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  
  // Calculate mouse velocity for dynamic trail size
  const dx = mouse.x - mouse.prevX;
  const dy = mouse.y - mouse.prevY;
  const velocity = Math.sqrt(dx * dx + dy * dy);
  const trailSize = interactionRadius * (1 + velocity * 0.02);
  
  // Add to trail
  mouseTrail.push({ 
    x: mouse.x, 
    y: mouse.y, 
    alpha: 1.0, 
    size: Math.min(trailSize, interactionRadius * 2),
    velocity: velocity
  });
  if (mouseTrail.length > MAX_TRAIL_LENGTH) mouseTrail.shift();
});

window.addEventListener('mousedown', (e) => {
  if (Date.now() - lastTouchTime < 500) return;
  mouse.pressed = true;
  document.body.classList.add('grabbing');
  createSnowBurst(e.clientX, e.clientY);
});

window.addEventListener('mouseup', () => {
  mouse.pressed = false;
  document.body.classList.remove('grabbing');
});

window.addEventListener('touchmove', (e) => {
  lastTouchTime = Date.now();
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  mouse.x = e.touches[0].clientX;
  mouse.y = e.touches[0].clientY;
  
  // Calculate velocity
  const dx = mouse.x - mouse.prevX;
  const dy = mouse.y - mouse.prevY;
  const velocity = Math.sqrt(dx * dx + dy * dy);
  const trailSize = interactionRadius * (1 + velocity * 0.02);
  
  // Add to trail
  mouseTrail.push({ 
    x: mouse.x, 
    y: mouse.y, 
    alpha: 1.0, 
    size: Math.min(trailSize, interactionRadius * 2),
    velocity: velocity
  });
  if (mouseTrail.length > MAX_TRAIL_LENGTH) mouseTrail.shift();
});

window.addEventListener('touchstart', (e) => {
  lastTouchTime = Date.now();
  mouse.pressed = true;
  document.body.classList.add('grabbing');
  mouse.x = e.touches[0].clientX;
  mouse.y = e.touches[0].clientY;
  createSnowBurst(mouse.x, mouse.y);
}, { passive: true });

window.addEventListener('touchend', (e) => {
  lastTouchTime = Date.now();
  mouse.pressed = false;
  document.body.classList.remove('grabbing');
  // Prevent ghost clicks or sustained force
  mouse.x = -1000;
  mouse.y = -1000;
  mouseTrail = [];
});

window.addEventListener('touchcancel', () => {
  lastTouchTime = Date.now();
  mouse.pressed = false;
  document.body.classList.remove('grabbing');
  mouse.x = -1000;
  mouse.y = -1000;
  mouseTrail = [];
});

window.addEventListener('mouseleave', () => {
  mouse.x = -1000;
  mouse.y = -1000;
  mouse.pressed = false;
  document.body.classList.remove('grabbing');
  mouseTrail = [];
});

// Create snow burst effect on click/touch
function createSnowBurst(x, y) {
  const burstCount = isMobile ? 20 : 30; // Fewer particles on mobile
  for (let i = 0; i < burstCount; i++) {
    if (particles.length < particleCount * 1.5) { // Allow temporary overflow
      const angle = (Math.PI * 2 * i) / burstCount;
      const speed = 3 + Math.random() * 5;
      const particle = new Particle();
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.size = flakeSize * (0.3 + Math.random() * 0.5);
      particle.isBurst = true;
      particle.burstLife = 60; // Frames until it becomes normal snow
      particles.push(particle);
    }
  }
}


// Update the density grid for the current frame
function updateDensityGrid() {
  // No longer needed for piling, but kept empty for safety if referenced
  const bins = Math.ceil(width / GRID_SIZE);
  if (densityGrid.length !== bins) densityGrid = new Array(bins).fill(0);
  else densityGrid.fill(0);
}

class Particle {
  constructor() {
    this.reset(true);
    this.landed = false;
    this.isBurst = false;
    this.burstLife = 0;
    this.hue = 0; // For color shifting on interaction
    this.magnetized = false;
  }

  reset(initial = false) {
    // Spawn across entire width with some padding
    this.x = -50 + Math.random() * (width + 100);

    // Use dynamic respawnMultiplier - spawn higher for natural fall across screen
    this.y = initial ? Math.random() * height : -flakeSize - (Math.random() * height * respawnMultiplier);

    // Increased horizontal velocity variation for more natural spread
    this.vx = (Math.random() - 0.5) * 2.5; // More horizontal movement
    this.vy = 0.5 + Math.random() * 1.2; // Slightly more vertical variation
    this.rot = Math.random() * 360;
    this.rotSpeed = (Math.random() - 0.5) * 2.5; // Slightly faster rotation
    this.size = (0.5 + Math.random() * 0.5) * flakeSize;
    this.alpha = 0.6 + Math.random() * 0.4;
    this.landed = false;
    this.isBurst = false;
    this.burstLife = 0;
    this.hue = 0;
    this.magnetized = false;

    // Natural sway params - more pronounced
    this.swaySpeed = 0.015 + Math.random() * 0.025; // Slightly more sway
    this.swayOffset = Math.random() * Math.PI * 2;
  }

  update() {
    // Handle burst particles
    if (this.isBurst && this.burstLife > 0) {
      this.burstLife--;
      if (this.burstLife <= 0) {
        this.isBurst = false;
      }
    }

    // 1. Enhanced Mouse Interaction with Multiple Effects
    const dx = this.x - mouse.x;
    const dy = this.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < interactionRadius) {
      const force = (interactionRadius - dist) / interactionRadius;

      // Effect 1: Push particles away (Repulsion)
      const forceDirectionX = dx / dist;
      const forceDirectionY = dy / dist;
      
      // Stronger force when mouse is pressed
      const forceMultiplier = mouse.pressed ? 0.8 : 0.35;
      this.vx += forceDirectionX * force * forceMultiplier;
      this.vy += forceDirectionY * force * forceMultiplier;

      // Effect 2: Increase rotation speed on interaction
      this.rotSpeed += (Math.random() - 0.5) * force * 3;

      // Effect 3: Color shift (subtle hue change)
      this.hue = Math.min(180, force * 180);

      // Effect 4: Size pulsing
      const sizePulse = 1 + force * 0.3;
      this.size = ((0.5 + Math.random() * 0.5) * flakeSize) * sizePulse;

      this.magnetized = true;
    } else {
      // Gradually reset hue when not near mouse
      this.hue *= 0.95;
      this.magnetized = false;
    }

    // 2. Particle-to-Particle Attraction (Liquid/Clumping Effect)
    // Skip on mobile for performance
    if (!this.isBurst && !isMobile && Math.random() < 0.1) { // Only check occasionally for performance
      for (let other of particles) {
        if (other === this || other.isBurst) continue;
        
        const dx2 = other.x - this.x;
        const dy2 = other.y - this.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        // Attract particles that are close
        if (dist2 < 60 && dist2 > 5) {
          const attractForce = 0.02;
          this.vx += (dx2 / dist2) * attractForce;
          this.vy += (dy2 / dist2) * attractForce;
        }
      }
    }

    // 3. Trail Interaction - particles respond to mouse trail
    mouseTrail.forEach((trail, index) => {
      const tdx = this.x - trail.x;
      const tdy = this.y - trail.y;
      const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
      
      if (tdist < trail.size * 0.7) {
        const tforce = (trail.size * 0.7 - tdist) / (trail.size * 0.7);
        const trailForce = tforce * trail.alpha * 0.15;
        
        this.vx += (tdx / tdist) * trailForce;
        this.vy += (tdy / tdist) * trailForce;
      }
    });

    // 4. Physics
    // Always apply physics since we never land
    if (!this.isBurst) {
      this.vy += GRAVITY;
      if (this.vy > TERMINAL_VELOCITY) this.vy = TERMINAL_VELOCITY;
    } else {
      // Burst particles have air resistance
      this.vx *= 0.98;
      this.vy *= 0.98;
      this.vy += GRAVITY * 0.5; // Less gravity during burst
    }

    this.y += this.vy;

    // Add natural sine wave sway to X (but not for burst particles)
    if (!this.isBurst && Math.abs(this.vx) < 2) {
      this.x += this.vx + Math.sin(this.y * this.swaySpeed + this.swayOffset) * 0.5;
    } else {
      this.x += this.vx;
    }

    this.rot += this.rotSpeed;

    // Apply friction - gentler for more natural movement
    if (Math.abs(this.vx) > 0.5) {
      this.vx *= 0.95; 
    } else {
      this.vx *= 0.99;
    }

    // Limit max rotation speed
    if (Math.abs(this.rotSpeed) > 8) {
      this.rotSpeed *= 0.9;
    }

    // Wall Wrapping (instead of bouncing, looks better for falling snow)
    if (this.x <= 0 || this.x >= width - this.size) {
      this.vx *= -0.3; 
      if (this.x <= 0) this.x = 1;
      if (this.x >= width - this.size) this.x = width - this.size - 1;
    }

    // Floor Interaction: Reset when off screen
    if (this.y >= height + this.size) {
      if (this.isBurst) {
        // Remove burst particles when they leave
        const index = particles.indexOf(this);
        if (index > -1 && particles.length > particleCount) {
          particles.splice(index, 1);
        } else {
          this.reset();
        }
      } else {
        this.reset();
      }
    }

    // Remove burst particles that go too far off screen
    if (this.isBurst && (this.x < -100 || this.x > width + 100 || this.y < -100)) {
      const index = particles.indexOf(this);
      if (index > -1 && particles.length > particleCount) {
        particles.splice(index, 1);
      }
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rot * Math.PI) / 180);
    
    // Apply color shift if interacting with mouse
    if (this.hue > 5 || this.magnetized) {
      ctx.filter = `hue-rotate(${this.hue}deg) brightness(${1 + this.hue / 360})`;
    }
    
    ctx.globalAlpha = this.alpha;
    if (offscreenCanvas) {
      ctx.drawImage(offscreenCanvas, -this.size / 2, -this.size / 2, this.size, this.size);
    }
    ctx.restore();
  }
}

function init() {
  resize();
  particles = [];
  pileCount = 0;
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }
}

function animate() {
  ctx.clearRect(0, 0, width, height);

  // Draw mouse trail effect with velocity-based styling
  // Simplified trail on mobile for performance
  if (mouseTrail.length > 0) {
    // Update trail alpha
    mouseTrail.forEach((trail, index) => {
      trail.alpha -= 0.05;
      trail.size *= 0.95;
    });
    
    // Remove faded trails
    mouseTrail = mouseTrail.filter(t => t.alpha > 0);
    
    // Draw trail with gradient effect
    if (!isLowEndDevice) {
      // Full gradient effect on capable devices
      mouseTrail.forEach((trail, index) => {
        ctx.save();
        
        // Create radial gradient for trail
        const gradient = ctx.createRadialGradient(trail.x, trail.y, 0, trail.x, trail.y, trail.size * 0.3);
        gradient.addColorStop(0, mouse.pressed ? `rgba(0, 255, 255, ${trail.alpha * 0.4})` : `rgba(255, 255, 255, ${trail.alpha * 0.3})`);
        gradient.addColorStop(0.5, mouse.pressed ? `rgba(0, 200, 255, ${trail.alpha * 0.2})` : `rgba(200, 230, 255, ${trail.alpha * 0.15})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        // Fill circle with gradient
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw outline ring
        ctx.globalAlpha = trail.alpha * 0.4;
        ctx.strokeStyle = mouse.pressed ? '#00ffff' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.size * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
      });
    } else {
      // Simplified trail for low-end devices
      mouseTrail.forEach((trail, index) => {
        ctx.save();
        ctx.globalAlpha = trail.alpha * 0.4;
        ctx.strokeStyle = mouse.pressed ? '#00ffff' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.size * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  // Calculate densities for this frame (kept for compatibility if needed, but empty)
  updateDensityGrid();

  particles.forEach(p => {
    p.update();
    p.draw();
  });

  // Draw enhanced cursor effect when pressed
  if (mouse.pressed && mouse.x > 0 && mouse.y > 0) {
    ctx.save();
    
    if (!isLowEndDevice) {
      // Pulsing ring effect - full version
      const time = Date.now();
      const pulseSize1 = ((time % 1000) / 1000);
      const pulseSize2 = (((time + 500) % 1000) / 1000);
      
      // First pulse ring
      ctx.globalAlpha = 0.4 * (1 - pulseSize1);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, interactionRadius * pulseSize1, 0, Math.PI * 2);
      ctx.stroke();
      
      // Second pulse ring
      ctx.globalAlpha = 0.4 * (1 - pulseSize2);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, interactionRadius * pulseSize2, 0, Math.PI * 2);
      ctx.stroke();
      
      // Center glow
      const centerGradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 40);
      centerGradient.addColorStop(0, 'rgba(0, 255, 255, 0.6)');
      centerGradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = centerGradient;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 40, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Simplified cursor effect for low-end devices
      const time = Date.now();
      const pulseSize = ((time % 1000) / 1000);
      
      ctx.globalAlpha = 0.4 * (1 - pulseSize);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, interactionRadius * pulseSize, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    ctx.restore();
  } else if (mouse.x > 0 && mouse.y > 0 && !isMobile) {
    // Subtle cursor indicator when not pressed (desktop only)
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = '#2d9595';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  requestAnimationFrame(animate);
}
