import {
  GAME_CONSTANTS as C,
  projectToScreen,
  type GameState,
  type Obstacle,
  type CoinItem,
  type PowerUp,
  type Particle,
} from "./game-engine";

const PF = 8, GH = 150, RW = 80, HY = 185, CX = C.CANVAS_W / 2;

function pz(z: number) {
  const c = Math.max(z, 0.5), s = PF / c;
  return { y: HY + GH * s, hw: RW * s, s };
}
function pzl(z: number, lane: number) {
  const p = pz(z), lw = p.hw / 1.5;
  return { x: CX + lane * lw, y: p.y, hw: p.hw, lw, s: p.s };
}
function fog(z: number): number { return Math.min(0.85, Math.pow(z / 120, 1.8)); }

export function render(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, C.CANVAS_W, C.CANVAS_H);
  drawAtmosphere(ctx, state);
  drawRoadAndEnvironment(ctx, state);

  const items: { z: number; fn: () => void }[] = [];
  for (const o of state.obstacles) if (o.z > 0.5 && o.z < C.MAX_Z && !o.hit) items.push({ z: o.z, fn: () => drawObstacle(ctx, o, state.frame) });
  for (const c of state.coinItems) if (c.z > 0.5 && c.z < C.MAX_Z && !c.collected) items.push({ z: c.z, fn: () => drawCoin(ctx, c, state.frame) });
  for (const pu of state.powerUps) if (pu.z > 0.5 && pu.z < C.MAX_Z && !pu.collected) items.push({ z: pu.z, fn: () => drawPowerUp(ctx, pu, state.frame) });
  items.sort((a, b) => b.z - a.z);
  for (const i of items) i.fn();

  if (state.phase !== "dead") drawRunner(ctx, state);
  for (const p of state.particles) drawParticle(ctx, p);
  drawHUD(ctx, state);
  if (state.combo >= 3 && state.phase === "running") drawCombo(ctx, state);
  if (state.milestoneFlash > 0) drawMilestone(ctx, state);
  if (state.phase === "dying") { ctx.fillStyle = `rgba(80,0,0,${Math.min(state.dyingTimer / C.DYING_FRAMES, 0.5)})`; ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H); }
}

function drawAtmosphere(ctx: CanvasRenderingContext2D, state: GameState) {
  const g = ctx.createLinearGradient(0, 0, 0, HY + 30);
  g.addColorStop(0, "#5a7a88");
  g.addColorStop(0.4, "#6a8a90");
  g.addColorStop(0.7, "#7a9a98");
  g.addColorStop(1, "#8aaa9a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, C.CANVAS_W, HY + 30);

  ctx.fillStyle = "#3a5540";
  ctx.beginPath(); ctx.moveTo(0, HY + 10);
  for (let i = 0; i <= 20; i++) { const x = (i / 20) * C.CANVAS_W; ctx.lineTo(x, HY - 15 - Math.sin(i * 0.9) * 20 - Math.cos(i * 1.8) * 12); }
  ctx.lineTo(C.CANVAS_W, HY + 10); ctx.closePath(); ctx.fill();

  const trunks = [15, 50, 85, 120, 280, 315, 350, 385];
  for (const tx of trunks) {
    if (tx > 160 && tx < 240) continue;
    const tw = 12 + (tx % 15), th = 55 + (tx % 30);
    ctx.fillStyle = `rgb(${55 + tx % 20},${38 + tx % 15},${22 + tx % 10})`;
    ctx.fillRect(tx - tw / 2, HY - th, tw, th + 15);
    ctx.fillStyle = `rgb(${35 + tx % 18},${58 + tx % 25},${28 + tx % 12})`;
    ctx.beginPath(); ctx.arc(tx, HY - th - 5, 22 + tx % 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgb(${30 + tx % 15},${50 + tx % 20},${25 + tx % 10})`;
    ctx.beginPath(); ctx.arc(tx - 8, HY - th - 15, 16 + tx % 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(tx + 10, HY - th + 2, 14 + tx % 7, 0, Math.PI * 2); ctx.fill();
  }

  for (let i = 0; i < 5; i++) {
    const vx = 30 + i * 90, vy = HY - 30 - (i % 3) * 15;
    ctx.strokeStyle = `rgba(40,70,30,${0.4 + (i % 2) * 0.15})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(vx, vy);
    ctx.quadraticCurveTo(vx + 10, vy + 25, vx + 5 + Math.sin(state.frame * 0.015 + i) * 6, vy + 50);
    ctx.stroke();
  }

  const fogG = ctx.createLinearGradient(0, HY - 20, 0, HY + 30);
  fogG.addColorStop(0, "rgba(120,150,140,0.5)");
  fogG.addColorStop(1, "rgba(120,150,140,0)");
  ctx.fillStyle = fogG;
  ctx.fillRect(0, HY - 20, C.CANVAS_W, 50);
}

function drawRoadAndEnvironment(ctx: CanvasRenderingContext2D, state: GameState) {
  const zVals: number[] = [];
  for (let z = 100; z >= 2.5; z -= 0.35) zVals.push(z);

  const phase = state.roadOffset;

  for (let i = 0; i < zVals.length - 1; i++) {
    const z0 = zVals[i], z1 = zVals[i + 1];
    const p0 = pz(z0), p1 = pz(z1);
    if (p0.y < HY - 5 || p1.y > C.CANVAS_H + 10) continue;

    const f = fog(z0);
    const tileIdx = Math.floor(phase * 0.55 + z0 * 2.2);
    const tileAlt = (tileIdx % 6) < 3;

    const waterR = 25 + f * 80, waterG = 100 + f * 50, waterB = 105 + f * 45;
    const shimmer = Math.sin(state.frame * 0.03 + z0 * 0.5) * 8;
    ctx.fillStyle = `rgb(${Math.floor(waterR + shimmer)},${Math.floor(waterG + shimmer)},${Math.floor(waterB + shimmer)})`;
    ctx.beginPath();
    ctx.moveTo(0, p0.y); ctx.lineTo(C.CANVAS_W, p0.y);
    ctx.lineTo(C.CANVAS_W, p1.y); ctx.lineTo(0, p1.y);
    ctx.closePath(); ctx.fill();

    const wallW0 = Math.max(p0.hw * 0.5, 2), wallW1 = Math.max(p1.hw * 0.5, 2);

    for (const side of [-1, 1]) {
      const light = side === 1 ? 12 : -5;
      const brickOff = tileAlt ? 8 : 0;
      const wr = Math.floor((105 + light + brickOff) * (1 - f) + 120 * f);
      const wg = Math.floor((90 + light + brickOff) * (1 - f) + 135 * f);
      const wb = Math.floor((65 + brickOff) * (1 - f) + 125 * f);

      const inner0 = CX + side * p0.hw, outer0 = CX + side * (p0.hw + wallW0);
      const inner1 = CX + side * p1.hw, outer1 = CX + side * (p1.hw + wallW1);

      ctx.fillStyle = `rgb(${wr},${wg},${wb})`;
      ctx.beginPath();
      ctx.moveTo(inner0, p0.y); ctx.lineTo(outer0, p0.y);
      ctx.lineTo(outer1, p1.y); ctx.lineTo(inner1, p1.y);
      ctx.closePath(); ctx.fill();

      if (i % 5 === 0 && p0.s > 0.12) {
        ctx.strokeStyle = `rgba(40,30,15,${Math.min(0.3, p0.s * 0.5) * (1 - f)})`;
        ctx.lineWidth = Math.max(0.3, p0.s * 1.5);
        const my = (p0.y + p1.y) / 2;
        ctx.beginPath(); ctx.moveTo(inner0, my); ctx.lineTo(outer0, my); ctx.stroke();
      }
      if (i % 10 === 2 && p0.s > 0.15) {
        ctx.fillStyle = `rgba(50,80,35,${Math.min(0.3, p0.s * 0.5) * (1 - f)})`;
        ctx.beginPath(); ctx.arc((inner0 + outer0) / 2, (p0.y + p1.y) / 2, Math.max(1.5, p0.s * 6), 0, Math.PI * 2); ctx.fill();
      }
    }

    const stoneBase = tileAlt ? 185 : 170;
    const stoneR = Math.floor(stoneBase * (1 - f) + 120 * f);
    const stoneG = Math.floor((stoneBase - 20) * (1 - f) + 135 * f);
    const stoneB = Math.floor((stoneBase - 55) * (1 - f) + 125 * f);
    ctx.fillStyle = `rgb(${stoneR},${stoneG},${stoneB})`;
    ctx.beginPath();
    ctx.moveTo(CX - p0.hw, p0.y); ctx.lineTo(CX + p0.hw, p0.y);
    ctx.lineTo(CX + p1.hw, p1.y); ctx.lineTo(CX - p1.hw, p1.y);
    ctx.closePath(); ctx.fill();

    if (i % 3 === 0 && p0.s > 0.06) {
      ctx.strokeStyle = `rgba(90,70,35,${Math.min(0.18, p0.s * 0.3) * (1 - f)})`;
      ctx.lineWidth = Math.max(0.3, p0.s * 0.8);
      ctx.beginPath(); ctx.moveTo(CX - p0.hw, p0.y); ctx.lineTo(CX + p0.hw, p0.y); ctx.stroke();
    }

    if (i % 6 === 0 && p0.s > 0.1) {
      ctx.strokeStyle = `rgba(90,70,35,${Math.min(0.12, p0.s * 0.2) * (1 - f)})`;
      ctx.lineWidth = Math.max(0.2, p0.s * 0.6);
      const cols = Math.max(2, Math.floor(p0.hw * 2 / (20 * p0.s)));
      for (let c = 1; c < cols; c++) {
        const cx2 = CX - p0.hw + (2 * p0.hw) * (c / cols);
        const cx3 = CX - p1.hw + (2 * p1.hw) * (c / cols);
        ctx.beginPath(); ctx.moveTo(cx2, p0.y); ctx.lineTo(cx3, p1.y); ctx.stroke();
      }
    }

    if (i % 12 === 5 && p0.s > 0.15) {
      ctx.fillStyle = `rgba(60,90,40,${Math.min(0.12, p0.s * 0.2) * (1 - f)})`;
      const mossX = CX - p0.hw * 0.6 + (tileIdx % 5) * p0.hw * 0.3;
      ctx.beginPath(); ctx.arc(mossX, (p0.y + p1.y) / 2, Math.max(1, p0.s * 5), 0, Math.PI * 2); ctx.fill();
    }

    if (i % 3 === 0 && p0.s > 0.12) {
      ctx.fillStyle = `rgba(90,70,35,${Math.min(0.15, p0.s * 0.25) * (1 - f)})`;
      ctx.fillRect(CX - p0.hw - 1, p0.y - 1, 2 * p0.hw + 2, Math.max(1, p0.s * 1.5));
    }
  }

  ctx.strokeStyle = "rgba(80,60,30,0.35)";
  ctx.lineWidth = 2.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < zVals.length; i += 2) {
      const p = pz(zVals[i]);
      if (p.y < HY) break;
      if (!started) { ctx.moveTo(CX + side * p.hw, p.y); started = true; }
      else ctx.lineTo(CX + side * p.hw, p.y);
    }
    ctx.stroke();
  }
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, frame: number) {
  if (obs.type === "double_pillar") {
    drawPillar(ctx, obs.z, obs.lane, frame);
    drawPillar(ctx, obs.z, obs.lane === 1 ? 0 : obs.lane === -1 ? 0 : 1, frame);
    return;
  }
  if (obs.type === "pillar") { drawPillar(ctx, obs.z, obs.lane, frame); return; }
  const p = pzl(obs.z, obs.lane); const s = p.s, f = fog(obs.z);
  if (s < 0.04) return;
  const alpha = 1 - f;

  if (obs.type === "barrier") {
    const w = 65 * s, h = 24 * s;
    const gr = ctx.createLinearGradient(p.x - w / 2, p.y - h, p.x + w / 2, p.y);
    gr.addColorStop(0, `rgba(150,130,90,${alpha})`); gr.addColorStop(0.5, `rgba(170,150,105,${alpha})`); gr.addColorStop(1, `rgba(130,110,75,${alpha})`);
    ctx.fillStyle = gr;
    ctx.fillRect(p.x - w / 2, p.y - h, w, h);
    ctx.fillStyle = `rgba(160,140,95,${alpha * 0.8})`;
    ctx.fillRect(p.x - w / 2, p.y - h, w, 4 * s);
    ctx.fillRect(p.x - w / 2, p.y - 4 * s, w, 4 * s);
    ctx.strokeStyle = `rgba(60,45,20,${alpha * 0.3})`; ctx.lineWidth = Math.max(0.3, s);
    ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
    for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(p.x - w / 2 + j * w / 4, p.y - h); ctx.lineTo(p.x - w / 2 + j * w / 4, p.y); ctx.stroke(); }
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.06})`; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2 * s, w * 0.4, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
  } else if (obs.type === "fire") {
    const h = 50 * s;
    ctx.fillStyle = `rgba(50,35,15,${alpha * 0.5})`; ctx.beginPath(); ctx.ellipse(p.x, p.y - 2 * s, 18 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill();
    for (let fi = 0; fi < 5; fi++) {
      const fx = p.x + (fi - 2) * 5 * s, fl = Math.sin(frame * 0.18 + fi * 2.3) * 5 * s;
      const fh = (h + fl) * (0.5 + fi * 0.12);
      const fg = ctx.createLinearGradient(fx, p.y - fh, fx, p.y);
      fg.addColorStop(0, `rgba(255,240,80,0)`); fg.addColorStop(0.15, `rgba(255,200,30,${alpha * 0.9})`);
      fg.addColorStop(0.5, `rgba(255,120,0,${alpha * 0.85})`); fg.addColorStop(0.8, `rgba(220,40,0,${alpha * 0.7})`);
      fg.addColorStop(1, `rgba(100,10,0,${alpha * 0.15})`);
      ctx.fillStyle = fg; ctx.beginPath();
      ctx.moveTo(fx - 6 * s, p.y - 3 * s);
      ctx.quadraticCurveTo(fx - 9 * s, p.y - fh * 0.5, fx + Math.sin(frame * 0.12 + fi) * 3 * s, p.y - fh);
      ctx.quadraticCurveTo(fx + 9 * s, p.y - fh * 0.5, fx + 6 * s, p.y - 3 * s);
      ctx.closePath(); ctx.fill();
    }
    const gl = ctx.createRadialGradient(p.x, p.y - h * 0.4, 0, p.x, p.y - h * 0.4, h * 1.2);
    gl.addColorStop(0, `rgba(255,140,0,${alpha * 0.15})`); gl.addColorStop(1, "rgba(255,50,0,0)");
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y - h * 0.4, h * 1.2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPillar(ctx: CanvasRenderingContext2D, z: number, lane: number, frame: number) {
  const p = pzl(z, lane); const s = p.s, f = fog(z), a = 1 - f;
  if (s < 0.04) return;
  const w = 40 * s, h = 80 * s;

  ctx.fillStyle = `rgba(0,0,0,${a * 0.06})`; ctx.beginPath(); ctx.ellipse(p.x + 3 * s, p.y + 2 * s, w * 0.5, 5 * s, 0, 0, Math.PI * 2); ctx.fill();

  const bg = ctx.createLinearGradient(p.x - w / 2, p.y - h, p.x + w / 2, p.y);
  bg.addColorStop(0, `rgba(130,110,70,${a})`); bg.addColorStop(0.3, `rgba(160,140,95,${a})`);
  bg.addColorStop(0.6, `rgba(140,120,80,${a})`); bg.addColorStop(1, `rgba(110,90,55,${a})`);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x - w / 2 - 2 * s, p.y - h);
  ctx.lineTo(p.x + w / 2 + 2 * s, p.y - h); ctx.lineTo(p.x + w / 2, p.y);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = `rgba(145,125,85,${a})`;
  ctx.fillRect(p.x - w / 2 - 6 * s, p.y - h - 7 * s, w + 12 * s, 9 * s);
  ctx.fillRect(p.x - w / 2 - 6 * s, p.y - 5 * s, w + 12 * s, 7 * s);

  ctx.strokeStyle = `rgba(60,45,20,${a * 0.3})`; ctx.lineWidth = Math.max(0.3, s * 0.8);
  for (let j = 1; j <= 5; j++) { const ly = p.y - h * (j / 6); ctx.beginPath(); ctx.moveTo(p.x - w / 2, ly); ctx.lineTo(p.x + w / 2, ly); ctx.stroke(); }

  ctx.fillStyle = `rgba(55,85,35,${a * 0.25})`;
  ctx.beginPath(); ctx.arc(p.x - w * 0.3, p.y - h * 0.1, 5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(p.x + w * 0.2, p.y - h * 0.5, 3.5 * s, 0, Math.PI * 2); ctx.fill();

  if (s > 0.3) {
    ctx.fillStyle = `rgba(100,80,50,${a * 0.15})`;
    ctx.beginPath();
    ctx.moveTo(p.x - 3 * s, p.y - h * 0.75); ctx.lineTo(p.x, p.y - h * 0.85);
    ctx.lineTo(p.x + 3 * s, p.y - h * 0.75); ctx.lineTo(p.x, p.y - h * 0.65);
    ctx.closePath(); ctx.fill();
  }
}

function drawCoin(ctx: CanvasRenderingContext2D, coin: CoinItem, frame: number) {
  const p = pzl(coin.z, coin.lane); const s = p.s, f = fog(coin.z);
  if (s < 0.05 || f > 0.8) return;
  const r = 11 * s, bob = Math.sin(frame * 0.08 + coin.z * 0.5) * 4 * s;
  const rot = (frame * 0.07 + coin.z * 0.3) % (Math.PI * 2);
  const stretch = 0.35 + Math.abs(Math.cos(rot)) * 0.65;
  const cy = p.y - 28 * s + bob;

  ctx.save(); ctx.translate(p.x, cy); ctx.scale(stretch, 1);
  ctx.fillStyle = `rgba(255,215,0,${(1 - f) * 0.2})`; ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.fill();

  ctx.save(); ctx.rotate(Math.PI / 4);
  const g = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
  g.addColorStop(0, "#fff9c4"); g.addColorStop(0.25, "#ffd54f"); g.addColorStop(0.6, "#ffab00"); g.addColorStop(1, "#e65100");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = `rgba(180,120,0,${0.6 * (1 - f)})`; ctx.lineWidth = Math.max(0.5, s * 0.8); ctx.stroke();
  if (stretch > 0.6) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - f)})`; ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.2, r * 0.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();

  ctx.fillStyle = `rgba(200,150,0,${0.5 * (1 - f) * stretch})`;
  ctx.fillRect(-r * 0.15, -r * 0.4, r * 0.3, r * 0.8);
  ctx.fillRect(-r * 0.4, -r * 0.15, r * 0.8, r * 0.3);
  ctx.restore();
}

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp, frame: number) {
  const p = pzl(pu.z, pu.lane); const s = p.s, f = fog(pu.z);
  if (s < 0.06 || f > 0.8) return;
  const r = 13 * s, bob = Math.sin(frame * 0.06 + pu.z * 0.5) * 5 * s, pulse = 1 + Math.sin(frame * 0.12) * 0.1;
  let c1: string, c2: string, lbl: string;
  if (pu.type === "shield") { c1 = "#60a5fa"; c2 = "#1d4ed8"; lbl = "\u{1F6E1}"; }
  else if (pu.type === "magnet") { c1 = "#c084fc"; c2 = "#7c3aed"; lbl = "\u{1F9F2}"; }
  else { c1 = "#34d399"; c2 = "#047857"; lbl = "x2"; }
  const cy = p.y - 30 * s + bob;
  ctx.fillStyle = c1 + "20"; ctx.beginPath(); ctx.arc(p.x, cy, r * 2.2 * pulse, 0, Math.PI * 2); ctx.fill();
  const gr = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, r);
  gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, cy, r * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = Math.max(0.5, s); ctx.stroke();
  ctx.fillStyle = "white"; ctx.font = `bold ${Math.max(8, 13 * s)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(lbl, p.x, cy); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
}

function drawRunner(ctx: CanvasRenderingContext2D, state: GameState) {
  const p = pzl(2.8, state.laneOffset); const s = p.s;
  let by = p.y, jumpH = 0;
  if (state.isJumping) { const t = state.jumpTime / C.JUMP_DURATION_SEC; jumpH = Math.sin(t * Math.PI) * 105 * s; by -= jumpH; }
  if (state.shieldActive) {
    ctx.strokeStyle = `rgba(96,165,250,${0.3 + Math.sin(state.frame * 0.15) * 0.1})`;
    ctx.lineWidth = 2.5 * s; ctx.beginPath(); ctx.arc(p.x, by - 28 * s, 40 * s, 0, Math.PI * 2); ctx.stroke();
  }
  if (jumpH > 15) { ctx.fillStyle = `rgba(0,0,0,0.1)`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 16 * s, 5 * s, 0, 0, Math.PI * 2); ctx.fill(); }

  const sliding = state.isSliding, run = state.phase === "running" ? state.frame * 0.32 : 0;
  const leg = Math.sin(run), arm = -leg;
  ctx.save(); ctx.translate(p.x, by);

  if (sliding) {
    ctx.fillStyle = "#6a5a3a"; ctx.beginPath(); ctx.ellipse(0, -7 * s, 17 * s, 9 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e0d4c0"; ctx.beginPath(); ctx.ellipse(0, -9 * s, 13 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#c8956e"; ctx.beginPath(); ctx.arc(11 * s, -14 * s, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6a4020"; ctx.beginPath(); ctx.ellipse(11 * s, -19 * s, 8 * s, 5 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
  } else {
    const ll = 20 * s;
    ctx.strokeStyle = "#5a4a30"; ctx.lineWidth = 6 * s; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-4 * s, -5 * s); ctx.lineTo(-4 * s + leg * 14 * s, -5 * s + ll); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4 * s, -5 * s); ctx.lineTo(4 * s - leg * 14 * s, -5 * s + ll); ctx.stroke();
    ctx.fillStyle = "#4a3a22";
    ctx.beginPath(); ctx.ellipse(-4 * s + leg * 14 * s, -4 * s + ll, 4 * s, 2.5 * s, leg * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4 * s - leg * 14 * s, -4 * s + ll, 4 * s, 2.5 * s, -leg * 0.3, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#e0d4c0"; ctx.beginPath(); ctx.ellipse(0, -24 * s, 10 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d5c8b0"; ctx.beginPath(); ctx.ellipse(0, -24 * s, 8 * s, 15 * s, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#6a5a3a"; ctx.fillRect(-3 * s, -17 * s, 6 * s, 8 * s);

    ctx.strokeStyle = "#d5c8b0"; ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.moveTo(-9 * s, -30 * s); ctx.lineTo(-9 * s - 5 * s, -30 * s + arm * 13 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(9 * s, -30 * s); ctx.lineTo(9 * s + 5 * s, -30 * s - arm * 13 * s); ctx.stroke();
    ctx.fillStyle = "#c8956e";
    ctx.beginPath(); ctx.arc(-9 * s - 5 * s, -30 * s + arm * 13 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9 * s + 5 * s, -30 * s - arm * 13 * s, 3 * s, 0, Math.PI * 2); ctx.fill();

    const hy = -45 * s;
    ctx.fillStyle = "#c8956e"; ctx.beginPath(); ctx.ellipse(0, hy, 8.5 * s, 9.5 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6a4020";
    ctx.beginPath(); ctx.ellipse(0, hy - 5 * s, 9.5 * s, 6 * s, 0, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillRect(-9.5 * s, hy - 5 * s, 19 * s, 4 * s);
    ctx.fillStyle = "#c8956e"; ctx.beginPath(); ctx.arc(0, hy, 7.5 * s, 0.35, Math.PI - 0.35); ctx.fill();
    ctx.fillStyle = "#c8956e";
    ctx.beginPath(); ctx.ellipse(-9 * s, hy - 1 * s, 2 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(9 * s, hy - 1 * s, 2 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  if (state.phase === "idle") return;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; rr(ctx, C.CANVAS_W - 100, 10, 90, 52, 14); ctx.fill();
  ctx.fillStyle = "#ffd54f"; ctx.font = "bold 22px Inter,sans-serif"; ctx.textAlign = "right";
  ctx.fillText(String(state.score), C.CANVAS_W - 18, 45);
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "bold 9px Inter,sans-serif";
  ctx.fillText("SCORE", C.CANVAS_W - 18, 26);

  ctx.fillStyle = "rgba(0,0,0,0.5)"; rr(ctx, 10, 10, 75, 52, 14); ctx.fill();
  ctx.fillStyle = "#ffd54f"; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("\u{1FA99}", 30, 28);
  ctx.fillStyle = "white"; ctx.font = "bold 18px Inter,sans-serif";
  ctx.fillText(String(state.coins), 50, 48);

  let py = 72;
  if (state.shieldActive) { drawPI(ctx, 10, py, "#60a5fa", "\u{1F6E1}", state.shieldTimer, C.SHIELD_DURATION); py += 24; }
  if (state.magnetActive) { drawPI(ctx, 10, py, "#c084fc", "\u{1F9F2}", state.magnetTimer, C.MAGNET_DURATION); py += 24; }
  if (state.speedBoostActive) { drawPI(ctx, 10, py, "#ff3300", "\u26A1", state.speedBoostTimer, C.SPEED_BOOST_DURATION); py += 24; }
  ctx.textAlign = "left";
}
function drawPI(ctx: CanvasRenderingContext2D, x: number, y: number, c: string, ic: string, t: number, m: number) {
  ctx.fillStyle = "rgba(0,0,0,0.35)"; rr(ctx, x, y, 52, 18, 8); ctx.fill();
  ctx.fillStyle = c + "44"; rr(ctx, x, y, 52 * t / m, 18, 8); ctx.fill();
  ctx.fillStyle = "white"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.fillText(ic, x + 26, y + 14);
}
function drawCombo(ctx: CanvasRenderingContext2D, st: GameState) {
  ctx.save(); ctx.globalAlpha = Math.min(1, st.comboTimer / 30);
  ctx.fillStyle = "rgba(0,0,0,0.4)"; rr(ctx, CX - 50, C.CANVAS_H - 80, 100, 28, 10); ctx.fill();
  ctx.fillStyle = st.combo >= 10 ? "#ffd54f" : st.combo >= 5 ? "#f97316" : "#60a5fa";
  ctx.font = `bold ${Math.min(15, 12 + st.combo * 0.3)}px Inter,sans-serif`; ctx.textAlign = "center";
  ctx.fillText(`${st.combo}x COMBO`, CX, C.CANVAS_H - 61); ctx.restore();
}
function drawMilestone(ctx: CanvasRenderingContext2D, st: GameState) {
  ctx.save(); ctx.globalAlpha = Math.min(1, st.milestoneFlash / 20);
  ctx.fillStyle = "rgba(255,200,50,0.1)"; ctx.fillRect(0, C.CANVAS_H / 2 - 20, C.CANVAS_W, 40);
  ctx.fillStyle = "#ffd54f"; ctx.font = "bold 22px Inter,sans-serif"; ctx.textAlign = "center";
  ctx.fillText(`${st.milestone * C.MILESTONE_INTERVAL}m`, CX, C.CANVAS_H / 2 + 7); ctx.restore();
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
