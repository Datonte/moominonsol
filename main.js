import './style.css'

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


// Snowflake Animation Engine
// Snowflake Animation Engine
const canvas = document.getElementById('snow-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
// Dynamic variables instead of constants
let particleCount = 1500;
let maxPileCount = 900;
let pileCount = 0;
const GRAVITY = 0.35;
const TERMINAL_VELOCITY = 8;

// Liquid Snow Globals
const GRID_SIZE = 25; // Size of density bins in pixels
let densityGrid = [];

// Mouse State
const mouse = { x: -1000, y: -1000 };

// Load Image
const snowImage = new Image();
snowImage.src = '/snowflake.png';

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
  // Goal: Maintain the exact same visual density and effects across all devices.

  // 1. Particle Density (Particles per pixel)
  // Desktop Reference: 1500 particles on ~1920x1080 (2,073,600 px)
  // Ratio: ~0.00072 particles per pixel
  const baseArea = 1920 * 1080;
  const currentArea = width * height;
  const particleRatio = 1500 / baseArea;

  // Calculate proportional count, but cap it for performance on huge screens
  // and set a healthy minimum for mobile so it doesn't look empty.
  particleCount = Math.floor(currentArea * particleRatio);

  // 2. Pile Density (Pile particles per width pixel)
  // Desktop Reference: 900 pile count on 1920 width.
  // Ratio: ~0.47 particles per lateral pixel.
  // This ensures the pile height (visual height) stays relatively constant % of screen.
  const pileRatio = 0.47;
  maxPileCount = Math.floor(width * pileRatio);

  // 3. Flake Size
  // Keep them relatively large to maintain the "Moomin" art style
  // Only scale down slightly on very narrow screens
  if (width < 600) {
    flakeSize = 18; // Readable on mobile
  } else {
    flakeSize = 25; // Original Desktop size
  }

  // 4. Respawn Logic
  // Maintain constant flow. Tighter multiplier on shorter screens.
  respawnMultiplier = height < 800 ? 1.2 : 1.5;

  // Bounds consistency: Ensure no counts drop to "zero" logic
  // Caps: Min 300 flakes (for looks), Max 1500 (for perf)
  particleCount = Math.min(Math.max(300, particleCount), 1500);
  maxPileCount = Math.max(150, maxPileCount);   // Always allow a pile

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
}

window.addEventListener('resize', resize);
window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener('touchmove', (e) => {
  mouse.x = e.touches[0].clientX;
  mouse.y = e.touches[0].clientY;
});

// Update the density grid for the current frame
function updateDensityGrid() {
  const bins = Math.ceil(width / GRID_SIZE);
  if (densityGrid.length !== bins) densityGrid = new Array(bins).fill(0);
  else densityGrid.fill(0);

  particles.forEach(p => {
    if (p.landed) {
      const bin = Math.floor(p.x / GRID_SIZE);
      if (bin >= 0 && bin < bins) {
        densityGrid[bin]++;
      }
    }
  });
}

class Particle {
  constructor() {
    this.reset(true);
    this.landed = false;
  }

  reset(initial = false) {
    this.x = Math.random() * width;

    // Use dynamic respawnMultiplier
    this.y = initial ? Math.random() * height : -flakeSize - (Math.random() * height * respawnMultiplier);

    this.vx = (Math.random() - 0.5) * 2;
    this.vy = 2 + Math.random() * 2;
    this.rot = Math.random() * 360;
    this.rotSpeed = (Math.random() - 0.5) * 4;
    this.size = (0.5 + Math.random() * 0.5) * flakeSize;
    this.alpha = 0.6 + Math.random() * 0.4;
    this.landed = false;

    // Natural sway params
    this.swaySpeed = 0.02 + Math.random() * 0.03;
    this.swayOffset = Math.random() * Math.PI * 2;
  }

  update() {
    // 1. Mouse Interaction
    const dx = this.x - mouse.x;
    const dy = this.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const interactionRadius = 150;

    let kicked = false;

    if (dist < interactionRadius) {
      const force = (interactionRadius - dist) / interactionRadius;

      if (this.landed && force > 0.1) {
        this.landed = false;
        pileCount = Math.max(0, pileCount - 1);

        // Kick UP
        this.vy = -6 - (Math.random() * 4);
        this.vx += (Math.random() - 0.5) * 3; // Bit more scatter allowed since liquid will fix it
        kicked = true;

      } else if (!this.landed) {
        // Push falling particles
        const forceDirectionX = dx / dist;
        const forceDirectionY = dy / dist;
        this.vx += forceDirectionX * force * 0.5;
        this.vy += forceDirectionY * force * 0.5;
      }
    }

    // 2. Physics
    if (!this.landed) {
      this.vy += GRAVITY;
      if (this.vy > TERMINAL_VELOCITY) this.vy = TERMINAL_VELOCITY;

      this.y += this.vy;

      // Add natural sine wave sway to X
      // Only if NOT being kicked violently (preserve jump physics)
      if (!kicked && Math.abs(this.vx) < 2) {
        this.x += this.vx + Math.sin(this.y * this.swaySpeed + this.swayOffset) * 0.5;
      } else {
        this.x += this.vx;
      }

      this.rot += this.rotSpeed;

      // Apply friction ONLY if moving fast (kicked/wind), otherwise let it sway natural
      if (Math.abs(this.vx) > 1) {
        this.vx *= 0.95;
      }

      // Wall Bouncing
      if (this.x <= 0 || this.x >= width - this.size) {
        this.vx *= -0.8;
        if (this.x <= 0) this.x = 1;
        if (this.x >= width - this.size) this.x = width - this.size - 1;
      }

      // Floor Interaction
      if (this.y >= height - this.size && this.vy > 0) {
        if (pileCount < maxPileCount) {
          this.landed = true;
          this.y = height - this.size;
          this.vy = 0;
          this.vx = 0;
          pileCount++;
        } else {
          this.reset();
        }
      }
    }
    // 3. LIQUID LOGIC (Landed Particles)
    else {
      // Self-Healing: Slide into gaps
      const bin = Math.floor(this.x / GRID_SIZE);
      const myDensity = densityGrid[bin] || 0;
      const leftDensity = densityGrid[bin - 1]; // Undefined if wall
      const rightDensity = densityGrid[bin + 1];

      // Treat walls as Infinite density walls so snow doesn't try to flow out
      const safeLeft = leftDensity === undefined ? 9999 : leftDensity;
      const safeRight = rightDensity === undefined ? 9999 : rightDensity;

      // Threshold of 3 prevents constant jittering on flat surfaces
      const flowThresh = 2;

      // Bias towards lower density
      // Move towards the neighbor with the BIGGER difference
      const leftDiff = myDensity - safeLeft;
      const rightDiff = myDensity - safeRight;

      let flowSpeed = 0;

      if (leftDiff > flowThresh && leftDiff >= rightDiff) {
        // Left is emptier, go left
        flowSpeed = -1.5;
      } else if (rightDiff > flowThresh && rightDiff > leftDiff) {
        // Right is emptier, go right
        flowSpeed = 1.5;
      }

      if (flowSpeed !== 0) {
        // Add some noise so they don't move in lockstep
        this.x += flowSpeed * (0.5 + Math.random());
      }

      // BOUNDS CHECK for landed particles (Critical for resize)
      if (this.x < 0) this.x = 0;
      if (this.x > width - this.size) this.x = width - this.size;
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rot * Math.PI) / 180);
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

  // Calculate densities for this frame
  updateDensityGrid();

  particles.forEach(p => {
    p.update();
    p.draw();
  });

  requestAnimationFrame(animate);
}
