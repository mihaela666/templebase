export const GAME_CONSTANTS = {
  CANVAS_W: 400,
  CANVAS_H: 700,
  HORIZON_Y: 170,
  GROUND_Y: 640,
  PLAYER_SCREEN_Y: 540,
  MAX_Z: 120,
  /** Run speed in world units per second (Temple Run style) */
  INITIAL_RUN_SPEED: 8,
  MAX_RUN_SPEED: 25,
  RUN_SPEED_RAMP_INTERVAL_SEC: 10,
  RUN_SPEED_RAMP_AMOUNT: 0.5,
  /** Lane follow lerp factor per second at 60fps equivalent = 0.15 * 60 */
  LANE_LERP_PER_SEC: 9,
  JUMP_DURATION_SEC: 32 / 60,
  SLIDE_DURATION_SEC: 26 / 60,
  OBSTACLE_MIN_GAP: 22,
  /** @deprecated use LANE_LERP_PER_SEC with delta time */
  LANE_SWITCH_SPEED: 0.15,
  DYING_FRAMES: 40,
  ROAD_NEAR_HALF_W: 175,
  ROAD_FAR_HALF_W: 18,
  COMBO_TIMEOUT: 90,
  SHIELD_DURATION: 300,
  MAGNET_DURATION: 480,
  SPEED_BOOST_DURATION: 300,
  POWERUP_CHANCE: 0.12,
  MILESTONE_INTERVAL: 500,
  /** ~0.12s at 60fps — no obstacle collision right after landing */
  LANDING_GRACE_FRAMES: 7,
  /** Apex height (feet above ground); ≥ 1.5 required, ~2.8 clears tall pillar hitboxes at peak */
  JUMP_PEAK_HEIGHT: 2.8,
};

const C = GAME_CONSTANTS;

const IS_MOBILE_ENGINE = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
const BEST_KEY = "temple-base-best";

export type Lane = -1 | 0 | 1;
export type Phase = "idle" | "running" | "dying" | "dead";
export type ObstacleType = "pillar" | "barrier" | "fire" | "double_pillar";
export type PowerUpType = "speed" | "shield" | "life" | "magnet";

export interface Obstacle {
  type: ObstacleType;
  lane: Lane;
  z: number;
  hit: boolean;
}

export interface CoinItem {
  lane: Lane;
  z: number;
  collected: boolean;
}

export interface PowerUp {
  type: PowerUpType;
  lane: Lane;
  z: number;
  collected: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameState {
  phase: Phase;
  lane: Lane;
  laneOffset: number;
  isJumping: boolean;
  jumpTime: number;
  isSliding: boolean;
  slideTime: number;
  worldZ: number;
  distance: number;
  speed: number;
  /** Seconds spent in running phase (for speed ramps) */
  runTimeSec: number;
  coins: number;
  score: number;
  bestScore: number;
  obstacles: Obstacle[];
  coinItems: CoinItem[];
  powerUps: PowerUp[];
  particles: Particle[];
  roadOffset: number;
  frame: number;
  dyingTimer: number;
  lastObstacleZ: number;

  combo: number;
  maxCombo: number;
  comboTimer: number;

  lives: number;
  shieldActive: boolean;
  shieldTimer: number;
  magnetActive: boolean;
  magnetTimer: number;
  speedBoostActive: boolean;
  speedBoostTimer: number;
  invincibleTimer: number;
  powerUpsCollected: number;

  milestone: number;
  milestoneFlash: number;

  /** Camera shake frames (legacy; no longer moves camera) */
  hitShake: number;

  /** Frames left: ignore obstacle collision after landing from jump */
  landingGraceTimer: number;

  /** Toggle hitbox wireframes (renderer reads this) */
  debugHitboxes: boolean;
}

export interface UpdateResult {
  state: GameState;
  scored: boolean;
  coinCollected: boolean;
  died: boolean;
  milestoneReached: number;
  powerUpCollected: PowerUpType | null;
  /** True when player took damage this frame (shield/life hit) */
  hurtThisFrame: boolean;
}

export function getBestScore(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
}

function saveBestScore(score: number) {
  if (typeof window === "undefined") return;
  const current = getBestScore();
  if (score > current) {
    localStorage.setItem(BEST_KEY, String(score));
  }
}

export function createInitialState(): GameState {
  return {
    phase: "idle",
    lane: 0,
    laneOffset: 0,
    isJumping: false,
    jumpTime: 0,
    isSliding: false,
    slideTime: 0,
    worldZ: 0,
    distance: 0,
    speed: C.INITIAL_RUN_SPEED,
    runTimeSec: 0,
    coins: 0,
    score: 0,
    bestScore: getBestScore(),
    obstacles: [],
    coinItems: [],
    powerUps: [],
    particles: [],
    roadOffset: 0,
    frame: 0,
    dyingTimer: 0,
    lastObstacleZ: 40,

    combo: 0,
    maxCombo: 0,
    comboTimer: 0,

    lives: 3,
    shieldActive: false,
    shieldTimer: 0,
    magnetActive: false,
    magnetTimer: 0,
    speedBoostActive: false,
    speedBoostTimer: 0,
    invincibleTimer: 0,
    powerUpsCollected: 0,

    milestone: 0,
    milestoneFlash: 0,

    hitShake: 0,

    landingGraceTimer: 0,
    debugHitboxes: false,
  };
}

export function startRun(state: GameState): GameState {
  if (state.phase !== "idle") return state;
  return { ...state, phase: "running" };
}

export function moveLeft(state: GameState): GameState {
  if (state.phase !== "running" || state.lane === -1) return state;
  return { ...state, lane: (state.lane - 1) as Lane };
}

export function moveRight(state: GameState): GameState {
  if (state.phase !== "running" || state.lane === 1) return state;
  return { ...state, lane: (state.lane + 1) as Lane };
}

export function jump(state: GameState): GameState {
  if (state.phase !== "running" || state.isJumping || state.isSliding) return state;
  return { ...state, isJumping: true, jumpTime: 0 };
}

export function slide(state: GameState): GameState {
  if (state.phase !== "running" || state.isJumping || state.isSliding) return state;
  return { ...state, isSliding: true, slideTime: 0 };
}

function randomLane(): Lane {
  const r = Math.random();
  if (r < 0.33) return -1;
  if (r < 0.66) return 0;
  return 1;
}

function generateObstacle(lastZ: number, distance: number): {
  obstacle: Obstacle;
  coins: CoinItem[];
  powerUp: PowerUp | null;
} {
  const gap = C.OBSTACLE_MIN_GAP + Math.random() * 15;
  const z = lastZ + gap;
  const lane = randomLane();

  let types: ObstacleType[] = ["pillar", "barrier", "fire"];
  if (distance > 300) {
    types.push("double_pillar");
  }
  const type = types[Math.floor(Math.random() * types.length)];

  const coins: CoinItem[] = [];
  const coinLanes: Lane[] = ([-1, 0, 1] as Lane[]).filter((l) => {
    if (type === "double_pillar") {
      const blocked = [lane, lane === 1 ? 0 : lane === -1 ? 0 : 1];
      return !blocked.includes(l);
    }
    return l !== lane;
  });

  if (Math.random() < 0.65 && coinLanes.length > 0) {
    const coinLane = coinLanes[Math.floor(Math.random() * coinLanes.length)];
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      coins.push({ lane: coinLane, z: z - 4 + i * 3.5, collected: false });
    }
  }

  let powerUp: PowerUp | null = null;
  if (Math.random() < C.POWERUP_CHANCE && coinLanes.length > 0) {
    const puLane = coinLanes[Math.floor(Math.random() * coinLanes.length)];
    const puTypes: PowerUpType[] = ["speed", "shield", "life", "magnet"];
    powerUp = {
      type: puTypes[Math.floor(Math.random() * puTypes.length)],
      lane: puLane,
      z: z + 8,
      collected: false,
    };
  }

  return { obstacle: { type, lane, z, hit: false }, coins, powerUp };
}

function spawnParticles(x: number, y: number, color: string, count: number): Particle[] {
  if (IS_MOBILE_ENGINE) return [];
  const n = Math.min(20, count);
  const particles: Particle[] = [];
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 20 + Math.random() * 15,
      maxLife: 35,
      color,
      size: 2 + Math.random() * 3,
    });
  }
  return particles;
}

export function projectToScreen(z: number, lane: number) {
  const PF = 8;
  const RR = 150;
  const RW = 80;
  const HY = 190;
  const clampZ = Math.max(z, 0.5);
  const raw = PF / clampZ;
  const screenY = HY + RR * raw;
  const halfW = RW * raw;
  const laneW = halfW / 1.5;
  const cx = C.CANVAS_W / 2;
  const laneX = cx + lane * laneW;
  return { x: laneX, y: screenY, scale: Math.min(raw / PF, 1), halfW, laneW };
}

/** Feet height above ground during jump (0 on ground). Peak ≥ JUMP_PEAK_HEIGHT. */
export function getPlayerY(state: GameState): number {
  if (!state.isJumping) return 0;
  const t = state.jumpTime / C.JUMP_DURATION_SEC;
  return Math.sin(t * Math.PI) * C.JUMP_PEAK_HEIGHT;
}

/** Must match renderer lane width */
export const COLLISION_LANE_W = 2.2;

/** Player & obstacle AABB (world). Obstacle boxes = 80% of visual footprint. */
const HIT = {
  PLAYER_HALF_W: 0.2,
  PLAYER_HALF_H: 0.8,
  PLAYER_HALF_D: 0.2,
  SLIDE_HALF_H: 0.28,
  SLIDE_CENTER_Y: 0.28,
  OB_SCALE: 0.8,
};

function aabbIntersect(
  ax: number,
  ay: number,
  az: number,
  ahx: number,
  ahy: number,
  ahz: number,
  bx: number,
  by: number,
  bz: number,
  bhx: number,
  bhy: number,
  bhz: number
): boolean {
  return (
    Math.abs(ax - bx) < ahx + bhx &&
    Math.abs(ay - by) < ahy + bhy &&
    Math.abs(az - bz) < ahz + bhz
  );
}

/** Player AABB center (x,y,z) and half-extents — feet on ground + jump height */
export function getPlayerAabbWorld(state: GameState): {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
} {
  const x = state.laneOffset * COLLISION_LANE_W;
  const z = state.worldZ;
  const feet = getPlayerY(state);
  if (state.isSliding) {
    return {
      x,
      y: HIT.SLIDE_CENTER_Y,
      z,
      hx: HIT.PLAYER_HALF_W,
      hy: HIT.SLIDE_HALF_H,
      hz: HIT.PLAYER_HALF_D,
    };
  }
  const cy = feet + HIT.PLAYER_HALF_H;
  return {
    x,
    y: cy,
    z,
    hx: HIT.PLAYER_HALF_W,
    hy: HIT.PLAYER_HALF_H,
    hz: HIT.PLAYER_HALF_D,
  };
}

/** One obstacle AABB at given lane X (lane index * LANE_W) */
export function getObstacleAabbAtLane(
  obs: Obstacle,
  laneIndex: number
): { x: number; y: number; z: number; hx: number; hy: number; hz: number } {
  const s = HIT.OB_SCALE;
  const lx = laneIndex * COLLISION_LANE_W;
  switch (obs.type) {
    case "barrier":
      return { x: lx, y: 0.275 * s, z: obs.z, hx: 1.05 * s, hy: 0.275 * s, hz: 0.325 * s };
    case "fire":
      return { x: lx, y: 0.4 * s, z: obs.z, hx: 0.38 * s, hy: 0.4 * s, hz: 0.38 * s };
    case "pillar":
    case "double_pillar":
      return { x: lx, y: 1.55 * s, z: obs.z, hx: 0.42 * s, hy: 1.55 * s, hz: 0.42 * s };
    default:
      return { x: lx, y: 1.55 * s, z: obs.z, hx: 0.42 * s, hy: 1.55 * s, hz: 0.42 * s };
  }
}

export type ObstacleHeightCategory = "low" | "medium" | "high";

function getObstacleHeightCategory(obs: Obstacle): ObstacleHeightCategory {
  const o = getObstacleAabbAtLane(obs, obs.lane);
  const fullH = o.hy * 2;
  if (fullH < 1.0) return "low";
  if (fullH <= 2.0) return "medium";
  return "high";
}

function checkCollision(state: GameState, obs: Obstacle): boolean {
  if (obs.hit) return false;
  if (state.invincibleTimer > 0) return false;
  if (state.landingGraceTimer > 0) return false;

  const p = getPlayerAabbWorld(state);
  const charFeetY = getPlayerY(state);
  const heightCat = getObstacleHeightCategory(obs);

  const testBox = (laneIdx: number): boolean => {
    const o = getObstacleAabbAtLane(obs, laneIdx);
    const zClose = Math.abs(p.z - o.z) <= p.hz + o.hz + 0.02;
    const obstacleHeight = o.hy * 2;

    if (!zClose) return false;

    // X/Z must overlap for a hit; Y checked via AABB after category rules
    const xOverlap = Math.abs(p.x - o.x) < p.hx + o.hx;
    if (!xOverlap) return false;

    // LOW: no collision while jumping (entire arc), or when feet clearly above low profile
    if (heightCat === "low") {
      if (state.isJumping) return false;
      if (charFeetY > 0.5) return false;
    }

    // MEDIUM: only vertical overlap matters for “clearance” — full 3-axis AABB
    // HIGH: full AABB (includes tall pillars)

    const yOverlap = Math.abs(p.y - o.y) < p.hy + o.hy;
    const zOverlap = zClose;
    const hit = xOverlap && yOverlap && zOverlap;
    return hit;
  };

  if (obs.type === "double_pillar") {
    const secondLane = obs.lane === 1 ? 0 : obs.lane === -1 ? 0 : 1;
    return testBox(obs.lane) || testBox(secondLane);
  }

  return testBox(obs.lane);
}

function checkCoinCollect(state: GameState, coin: CoinItem): boolean {
  if (coin.collected) return false;
  if (Math.abs(coin.z - state.worldZ) > 3) return false;

  if (state.magnetActive) {
    return Math.abs(coin.z - state.worldZ) < 8;
  }

  return coin.lane === state.lane;
}

function checkPowerUpCollect(state: GameState, pu: PowerUp): boolean {
  if (pu.collected) return false;
  if (Math.abs(pu.z - state.worldZ) > 3.5) return false;
  return pu.lane === state.lane;
}

const FPS_60 = 60;

export function update(state: GameState, deltaSec = 1 / 60): UpdateResult {
  const dt = Math.max(0, Math.min(0.1, deltaSec));

  if (state.phase === "idle") {
    return {
      state: { ...state, frame: state.frame + 1, roadOffset: state.roadOffset + 0.1 },
      scored: false, coinCollected: false, died: false, milestoneReached: 0, powerUpCollected: null, hurtThisFrame: false,
    };
  }

  if (state.phase === "dead") {
    return { state, scored: false, coinCollected: false, died: false, milestoneReached: 0, powerUpCollected: null, hurtThisFrame: false };
  }

  if (state.phase === "dying") {
    const timer = state.dyingTimer + dt * FPS_60;
    if (timer >= C.DYING_FRAMES) {
      const finalScore = computeScore(state);
      saveBestScore(finalScore);
      return {
        state: {
          ...state,
          phase: "dead",
          dyingTimer: timer,
          score: finalScore,
          bestScore: Math.max(state.bestScore, finalScore),
        },
        scored: false, coinCollected: false, died: false, milestoneReached: 0, powerUpCollected: null, hurtThisFrame: false,
      };
    }
    return {
      state: { ...state, dyingTimer: timer, frame: state.frame + 1 },
      scored: false, coinCollected: false, died: false, milestoneReached: 0, powerUpCollected: null, hurtThisFrame: false,
    };
  }

  const wasJumping = state.isJumping;

  let next = { ...state };
  next.frame++;

  if (next.phase === "running") {
    next.runTimeSec += dt;
  }
  const rampSteps = Math.floor(next.runTimeSec / C.RUN_SPEED_RAMP_INTERVAL_SEC);
  next.speed = Math.min(C.MAX_RUN_SPEED, C.INITIAL_RUN_SPEED + rampSteps * C.RUN_SPEED_RAMP_AMOUNT);

  const effectiveSpeed = next.speed * (next.speedBoostActive ? 1.5 : 1);
  next.worldZ += effectiveSpeed * dt;
  next.distance = next.worldZ;

  const targetOffset = next.lane;
  const laneAlpha = 1 - Math.exp((-C.LANE_LERP_PER_SEC * dt) / 1);
  next.laneOffset += (targetOffset - next.laneOffset) * laneAlpha;
  if (Math.abs(targetOffset - next.laneOffset) < 0.002) next.laneOffset = targetOffset;

  if (next.isJumping) {
    next.jumpTime += dt;
    if (next.jumpTime >= C.JUMP_DURATION_SEC) {
      next.isJumping = false;
      next.jumpTime = 0;
    }
  }
  if (wasJumping && !next.isJumping) {
    next.landingGraceTimer = C.LANDING_GRACE_FRAMES;
  }

  if (next.isSliding) {
    next.slideTime += dt;
    if (next.slideTime >= C.SLIDE_DURATION_SEC) {
      next.isSliding = false;
      next.slideTime = 0;
    }
  }

  const tickFrames = dt * FPS_60;
  if (next.shieldActive) {
    next.shieldTimer -= tickFrames;
    if (next.shieldTimer <= 0) next.shieldActive = false;
  }
  if (next.magnetActive) {
    next.magnetTimer -= tickFrames;
    if (next.magnetTimer <= 0) next.magnetActive = false;
  }
  if (next.speedBoostActive) {
    next.speedBoostTimer -= tickFrames;
    if (next.speedBoostTimer <= 0) next.speedBoostActive = false;
  }
  if (next.invincibleTimer > 0) {
    next.invincibleTimer -= tickFrames;
  }

  if (next.comboTimer > 0) {
    next.comboTimer -= tickFrames;
    if (next.comboTimer <= 0) {
      next.combo = 0;
    }
  }

  if (next.milestoneFlash > 0) {
    next.milestoneFlash -= tickFrames;
  }

  let died = false;
  let coinCollected = false;
  let milestoneReached = 0;
  let powerUpCollected: PowerUpType | null = null;
  let hurtThisFrame = false;
  const newParticles: Particle[] = [];

  const obstacles = next.obstacles;
  for (let oi = 0; oi < obstacles.length; oi++) {
    const obs = obstacles[oi];
    if (checkCollision(next, obs)) {
      hurtThisFrame = true;
      if (next.shieldActive) {
        next.shieldActive = false;
        next.shieldTimer = 0;
        obs.hit = true;
        next.hitShake = Math.max(next.hitShake, 20);
        const proj = projectToScreen(obs.z, obs.lane);
        newParticles.push(...spawnParticles(proj.x, proj.y, "#60a5fa", 15));
      } else if (next.lives > 0) {
        next.lives--;
        next.invincibleTimer = 120;
        obs.hit = true;
        next.hitShake = Math.max(next.hitShake, 26);
        const proj = projectToScreen(obs.z, obs.lane);
        newParticles.push(...spawnParticles(proj.x, proj.y, "#ff6666", 10));
      } else {
        died = true;
        obs.hit = true;
        next.hitShake = Math.max(next.hitShake, 45);
        const proj = projectToScreen(obs.z, obs.lane);
        newParticles.push(...spawnParticles(proj.x, proj.y, "#ef4444", 12));
      }
      break;
    }
  }

  if (next.landingGraceTimer > 0) {
    next.landingGraceTimer -= tickFrames;
    if (next.landingGraceTimer < 0) next.landingGraceTimer = 0;
  }

  const coins = next.coinItems;
  for (let ci = 0; ci < coins.length; ci++) {
    const coin = coins[ci];
    if (checkCoinCollect(next, coin)) {
      coin.collected = true;
      next.coins += 1;
      next.combo++;
      next.comboTimer = C.COMBO_TIMEOUT;
      if (next.combo > next.maxCombo) next.maxCombo = next.combo;
      coinCollected = true;
      const proj = projectToScreen(coin.z, coin.lane);
      newParticles.push(...spawnParticles(proj.x, proj.y, "#fbbf24", 6));
    }
  }

  const powerUps = next.powerUps;
  for (let pi = 0; pi < powerUps.length; pi++) {
    const pu = powerUps[pi];
    if (checkPowerUpCollect(next, pu)) {
      pu.collected = true;
      next.powerUpsCollected++;
      powerUpCollected = pu.type;
      const proj = projectToScreen(pu.z, pu.lane);

      switch (pu.type) {
        case "speed":
          next.speedBoostActive = true;
          next.speedBoostTimer = C.SPEED_BOOST_DURATION;
          newParticles.push(...spawnParticles(proj.x, proj.y, "#ff3300", 12));
          break;
        case "shield":
          next.shieldActive = true;
          next.shieldTimer = C.SHIELD_DURATION;
          newParticles.push(...spawnParticles(proj.x, proj.y, "#60a5fa", 10));
          break;
        case "life":
          next.lives = Math.min(3, next.lives + 1);
          newParticles.push(...spawnParticles(proj.x, proj.y, "#00ff44", 12));
          break;
        case "magnet":
          next.magnetActive = true;
          next.magnetTimer = C.MAGNET_DURATION;
          newParticles.push(...spawnParticles(proj.x, proj.y, "#ffdd00", 10));
          break;
      }
    }
  }

  const currentMilestone = Math.floor(next.distance / C.MILESTONE_INTERVAL);
  if (currentMilestone > next.milestone) {
    next.milestone = currentMilestone;
    next.milestoneFlash = 60;
    milestoneReached = currentMilestone * C.MILESTONE_INTERVAL;
    next.speed = Math.min(C.MAX_RUN_SPEED, next.speed + 0.5);
  }

  next.obstacles = next.obstacles.filter((o) => o.z > next.worldZ - 10);
  next.coinItems = next.coinItems.filter((c) => c.z > next.worldZ - 10 && !c.collected);
  next.powerUps = next.powerUps.filter((p) => p.z > next.worldZ - 10 && !p.collected);

  let farthestObsZ = next.worldZ;
  for (let i = 0; i < next.obstacles.length; i++) {
    if (next.obstacles[i].z > farthestObsZ) farthestObsZ = next.obstacles[i].z;
  }

  if (farthestObsZ < next.worldZ + C.MAX_Z + 20) {
    const startZ = Math.max(farthestObsZ, next.lastObstacleZ);
    const { obstacle, coins, powerUp } = generateObstacle(startZ, next.distance);
    next.obstacles.push(obstacle);
    next.coinItems.push(...coins);
    if (powerUp) next.powerUps.push(powerUp);
    next.lastObstacleZ = obstacle.z;
  }

  let merged = next.particles;
  if (newParticles.length > 0) {
    merged = merged.concat(newParticles);
  }
  const nextParts: Particle[] = [];
  for (let pi = 0; pi < merged.length; pi++) {
    const p = merged[pi];
    const life = p.life - tickFrames;
    if (life <= 0) continue;
    nextParts.push({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.15,
      life,
    });
  }
  next.particles = nextParts;

  if (died) {
    const finalScore = computeScore(next);
    next.phase = "dying";
    next.dyingTimer = 0;
    next.score = finalScore;
  }

  next.score = computeScore(next);

  if (next.hitShake > 0) next.hitShake -= tickFrames;
  if (next.hitShake < 0) next.hitShake = 0;

  return { state: next, scored: false, coinCollected, died, milestoneReached, powerUpCollected, hurtThisFrame };
}

function computeScore(state: GameState): number {
  // Distance ticks every frame via worldZ; coins apply immediately when collected
  const distPoints = Math.floor(state.distance);
  const coinPoints = state.coins * 10;
  const comboBonus = Math.floor(state.maxCombo * state.maxCombo * 0.5);
  return distPoints + coinPoints + comboBonus;
}
