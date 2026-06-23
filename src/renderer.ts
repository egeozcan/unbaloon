import {
  BALLOON_HIGHLIGHTS,
  BG_COLOR_TOP,
  BG_COLOR_BOTTOM,
  STRING_LENGTH_RATIO,
  POP_EXPAND_SCALE,
  PARTICLE_LIFETIME,
  RAINBOW_GRADIENT_COLORS,
  RAINBOW_DURATION,
  STARBURST_DURATION,
  CONFETTI_DURATION,
  CONFETTI_WIDTH,
  CONFETTI_HEIGHT,
  DART_LENGTH,
  DART_WIDTH,
  DART_COLOR,
  DART_TIP_COLOR,
  HELICOPTER_BODY_COLOR,
  HELICOPTER_WINDOW_COLOR,
  HELICOPTER_ROTOR_COLOR,
  HELICOPTER_SKID_COLOR,
  PLANE_BODY_COLOR,
  PLANE_WING_COLOR,
  PLANE_WINDOW_COLOR,
  PLANE_ACCENT_COLOR,
  PLANE_PROP_COLOR,
  MISSILE_LENGTH,
  MISSILE_WIDTH,
  MISSILE_BODY_COLOR,
  MISSILE_NOSE_COLOR,
  MISSILE_FIN_COLOR,
  MISSILE_FLAME_COLOR,
} from './constants';
import type { Balloon, Particle } from './balloon';
import type { ActiveEvent, Bubble } from './surprise';
import type { Dart, HelicopterManager } from './helicopter';
import type { Missile, PlaneManager } from './plane';

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  drawBackground(width: number, height: number): void {
    const grad = this.ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, BG_COLOR_TOP);
    grad.addColorStop(1, BG_COLOR_BOTTOM);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawBalloon(b: Balloon): void {
    if (b.state === 'popping') {
      this.drawPoppingBalloon(b);
      return;
    }

    if (b.specialType || b.isFinale) {
      this.drawSpecialBalloon(b);
      return;
    }

    const ctx = this.ctx;
    const rx = b.radiusX * b.scaleX;
    const ry = b.radiusY * b.scaleY;

    ctx.save();
    ctx.translate(b.x, b.y);

    // Balloon body
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();

    // 3D highlight shine
    const highlightColor = BALLOON_HIGHLIGHTS[b.number] || '#FFFFFF';
    const shine = ctx.createRadialGradient(
      -rx * 0.3, -ry * 0.3, rx * 0.05,
      -rx * 0.1, -ry * 0.1, rx * 0.6
    );
    shine.addColorStop(0, highlightColor);
    shine.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();

    // Number text
    const fontSize = Math.round(ry * 0.7);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText(String(b.number), 0, 0);

    // Tie knot (small triangle at bottom)
    const knotY = ry;
    const knotSize = rx * 0.15;
    ctx.beginPath();
    ctx.moveTo(-knotSize, knotY);
    ctx.lineTo(knotSize, knotY);
    ctx.lineTo(0, knotY + knotSize * 2);
    ctx.closePath();
    ctx.fillStyle = b.color;
    ctx.fill();

    // String (quadratic curve hanging down)
    const stringLen = ry * STRING_LENGTH_RATIO;
    ctx.beginPath();
    ctx.moveTo(0, knotY + knotSize * 2);
    ctx.quadraticCurveTo(rx * 0.3, knotY + knotSize * 2 + stringLen * 0.5, 0, knotY + knotSize * 2 + stringLen);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  private drawSpecialBalloon(b: Balloon): void {
    const ctx = this.ctx;
    const rx = b.radiusX * b.scaleX;
    const ry = b.radiusY * b.scaleY;

    ctx.save();
    ctx.translate(b.x, b.y);

    // Balloon body
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);

    if (b.specialType === 'rainbow' || b.isFinale) {
      const grad = ctx.createLinearGradient(-rx, -ry, rx, ry);
      RAINBOW_GRADIENT_COLORS.forEach((color, i) => {
        grad.addColorStop(i / (RAINBOW_GRADIENT_COLORS.length - 1), color);
      });
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = b.color;
    }
    ctx.fill();

    // Highlight shine — star balloons get oscillating shimmer
    const shimmerAlpha = b.specialType === 'star'
      ? 0.3 + 0.3 * Math.sin(b.animTime * 4)
      : 0.6;
    const shine = ctx.createRadialGradient(
      -rx * 0.3, -ry * 0.3, rx * 0.05,
      -rx * 0.1, -ry * 0.1, rx * 0.6
    );
    shine.addColorStop(0, `rgba(255, 255, 255, ${shimmerAlpha})`);
    shine.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();

    // Icon/face
    if (b.specialType === 'star') {
      this.drawStarIcon(rx, ry);
    } else if (b.specialType?.startsWith('animal-')) {
      this.drawAnimalFace(b.specialType, rx, ry);
    }

    // Tie knot
    const knotY = ry;
    const knotSize = rx * 0.15;
    ctx.beginPath();
    ctx.moveTo(-knotSize, knotY);
    ctx.lineTo(knotSize, knotY);
    ctx.lineTo(0, knotY + knotSize * 2);
    ctx.closePath();
    ctx.fillStyle = b.isFinale ? RAINBOW_GRADIENT_COLORS[0] : b.color;
    ctx.fill();

    // String
    const stringLen = ry * STRING_LENGTH_RATIO;
    ctx.beginPath();
    ctx.moveTo(0, knotY + knotSize * 2);
    ctx.quadraticCurveTo(rx * 0.3, knotY + knotSize * 2 + stringLen * 0.5, 0, knotY + knotSize * 2 + stringLen);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  private drawStarIcon(rx: number, ry: number): void {
    const ctx = this.ctx;
    const size = Math.min(rx, ry) * 0.5;
    const spikes = 5;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const angle = (Math.PI * 2 * i) / (spikes * 2) - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.45;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();
  }

  private drawAnimalFace(type: string, rx: number, ry: number): void {
    const ctx = this.ctx;
    const s = Math.min(rx, ry) * 0.4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    switch (type) {
      case 'animal-cat': {
        // Ears
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, -s * 0.3);
        ctx.lineTo(-s * 0.4, -s);
        ctx.lineTo(-s * 0.1, -s * 0.3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * 0.1, -s * 0.3);
        ctx.lineTo(s * 0.4, -s);
        ctx.lineTo(s * 0.7, -s * 0.3);
        ctx.fill();
        // Eyes
        ctx.beginPath();
        ctx.arc(-s * 0.25, 0, s * 0.08, 0, Math.PI * 2);
        ctx.arc(s * 0.25, 0, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        // "w" mouth
        ctx.beginPath();
        ctx.moveTo(-s * 0.2, s * 0.25);
        ctx.lineTo(-s * 0.05, s * 0.4);
        ctx.lineTo(s * 0.05, s * 0.25);
        ctx.lineTo(s * 0.15, s * 0.4);
        ctx.lineTo(s * 0.3, s * 0.25);
        ctx.stroke();
        break;
      }
      case 'animal-frog': {
        // Big eyes
        ctx.beginPath();
        ctx.arc(-s * 0.3, -s * 0.15, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(s * 0.3, -s * 0.15, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(-s * 0.3, -s * 0.15, s * 0.08, 0, Math.PI * 2);
        ctx.arc(s * 0.3, -s * 0.15, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        // Smile
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(0, s * 0.05, s * 0.4, 0.1, Math.PI - 0.1);
        ctx.stroke();
        break;
      }
      case 'animal-bird': {
        // Eyes
        ctx.beginPath();
        ctx.arc(-s * 0.2, -s * 0.1, s * 0.06, 0, Math.PI * 2);
        ctx.arc(s * 0.2, -s * 0.1, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        // Beak
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(0, s * 0.05);
        ctx.lineTo(-s * 0.15, s * 0.25);
        ctx.lineTo(s * 0.15, s * 0.25);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }
  }

  private drawPoppingBalloon(b: Balloon): void {
    const ctx = this.ctx;
    const t = b.popProgress;

    // Expanding and fading balloon body
    if (t < 0.5) {
      const expandT = t / 0.5;
      const scale = 1 + (POP_EXPAND_SCALE - 1) * expandT;
      const alpha = 1 - expandT;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(b.x, b.y);
      ctx.beginPath();
      ctx.ellipse(0, 0, b.radiusX * scale, b.radiusY * scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.restore();
    }

    // Particles — star balloons get star-shaped
    if (b.specialType === 'star') {
      this.drawStarParticles(b.particles);
    } else {
      this.drawParticles(b.particles);
    }

    // Animal silhouette floating up
    if (b.specialType?.startsWith('animal-') && t < 1) {
      this.drawAnimalSilhouette(b, t);
    }
  }

  private drawStarParticles(particles: Particle[]): void {
    const ctx = this.ctx;
    for (const p of particles) {
      if (p.age >= PARTICLE_LIFETIME) continue;
      const alpha = 1 - p.age / PARTICLE_LIFETIME;
      const twinkle = 0.5 + 0.5 * Math.sin(p.age * 12);
      ctx.save();
      ctx.globalAlpha = alpha * twinkle;
      ctx.translate(p.x, p.y);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
        const r = i % 2 === 0 ? p.radius : p.radius * 0.45;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.restore();
    }
  }

  private drawAnimalSilhouette(b: Balloon, progress: number): void {
    const ctx = this.ctx;
    const floatY = b.y - progress * 150;
    const alpha = 1 - progress;
    const scale = 1 + progress * 0.3;
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.translate(b.x, floatY);
    ctx.scale(scale, scale);
    const rx = b.radiusX;
    const ry = b.radiusY;
    this.drawAnimalFace(b.specialType!, rx, ry);
    ctx.restore();
  }

  private drawParticles(particles: Particle[]): void {
    const ctx = this.ctx;
    for (const p of particles) {
      if (p.age >= PARTICLE_LIFETIME) continue;
      const alpha = 1 - p.age / PARTICLE_LIFETIME;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    }
  }

  drawSurpriseEventBelow(event: ActiveEvent, width: number, height: number): void {
    switch (event.type) {
      case 'rainbow': this.drawRainbow(event, width, height); break;
      case 'confetti': this.drawConfetti(event); break;
      case 'starburst': this.drawStarBurst(event); break;
    }
  }

  drawSurpriseEventAbove(event: ActiveEvent): void {
    if (event.type === 'bubbles' && event.bubbles) {
      this.drawBubbles(event.bubbles, event.age, event.duration);
    }
  }

  private drawRainbow(event: ActiveEvent, width: number, height: number): void {
    const ctx = this.ctx;
    const t = event.age / RAINBOW_DURATION;
    let alpha: number;
    if (t < 0.3) alpha = t / 0.3;
    else if (t < 0.7) alpha = 1;
    else alpha = 1 - (t - 0.7) / 0.3;
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    const cx = width / 2;
    const cy = height * 0.6;
    const baseRadius = Math.min(width, height) * 0.35;
    const bandWidth = baseRadius * 0.04;
    RAINBOW_GRADIENT_COLORS.forEach((color, i) => {
      const r = baseRadius - i * bandWidth * 2;
      if (r <= 0) return;
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = bandWidth;
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawConfetti(event: ActiveEvent): void {
    if (!event.confetti) return;
    const ctx = this.ctx;
    for (const c of event.confetti) {
      const alpha = 1 - c.age / CONFETTI_DURATION;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rotation);
      ctx.fillStyle = c.color;
      ctx.fillRect(-CONFETTI_WIDTH / 2, -CONFETTI_HEIGHT / 2, CONFETTI_WIDTH, CONFETTI_HEIGHT);
      ctx.restore();
    }
  }

  private drawStarBurst(event: ActiveEvent): void {
    if (!event.stars) return;
    const ctx = this.ctx;
    for (const s of event.stars) {
      const alpha = 1 - s.age / STARBURST_DURATION;
      if (alpha <= 0) continue;
      const twinkle = 0.5 + 0.5 * Math.sin(s.age * 12);
      ctx.save();
      ctx.globalAlpha = alpha * twinkle;
      ctx.translate(s.x, s.y);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
        const r = i % 2 === 0 ? s.size : s.size * 0.45;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#FFD700';
      ctx.fill();
      ctx.restore();
    }
  }

  private drawBubbles(bubbles: Bubble[], eventAge: number, duration: number): void {
    const ctx = this.ctx;
    for (const b of bubbles) {
      if (b.popped) {
        if (b.popAge < 0.3) {
          const splashAlpha = 1 - b.popAge / 0.3;
          const splashR = b.radius * (1 + b.popAge * 3);
          ctx.save();
          ctx.globalAlpha = splashAlpha * 0.4;
          ctx.beginPath();
          ctx.arc(b.x, b.y, splashR, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(150, 200, 255, 1)';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
        continue;
      }
      const alpha = Math.min(1, 1 - (eventAge - duration + 0.5) / 0.5);
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(150, 200, 255, 1)';
      ctx.fill();
      // Highlight
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.25, b.y - b.radius * 0.25, b.radius * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Helicopter, darts, spawn button ────────────────────────────────────────

  drawDarts(darts: Dart[]): void {
    const ctx = this.ctx;
    for (const d of darts) {
      const len = Math.hypot(d.vx, d.vy) || 1;
      const ux = d.vx / len;
      const uy = d.vy / len;
      const angle = Math.atan2(uy, ux);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(angle);
      // Shaft
      ctx.strokeStyle = DART_COLOR;
      ctx.lineWidth = DART_WIDTH;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-DART_LENGTH, 0);
      ctx.lineTo(DART_LENGTH * 0.4, 0);
      ctx.stroke();
      // Pointed tip
      ctx.fillStyle = DART_TIP_COLOR;
      ctx.beginPath();
      ctx.moveTo(DART_LENGTH, 0);
      ctx.lineTo(DART_LENGTH * 0.4, -DART_WIDTH);
      ctx.lineTo(DART_LENGTH * 0.4, DART_WIDTH);
      ctx.closePath();
      ctx.fill();
      // Tail fletching
      ctx.fillStyle = DART_COLOR;
      ctx.beginPath();
      ctx.moveTo(-DART_LENGTH, 0);
      ctx.lineTo(-DART_LENGTH - DART_WIDTH, -DART_WIDTH);
      ctx.lineTo(-DART_LENGTH + DART_WIDTH, 0);
      ctx.lineTo(-DART_LENGTH - DART_WIDTH, DART_WIDTH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawHelicopter(heli: HelicopterManager): void {
    this.drawHelicopterShape(heli.x, heli.displayY, heli.size, heli.rotorAngle, heli.alpha);
  }

  // Side-view helicopter: nose to the right, tail to the left.
  private drawHelicopterShape(cx: number, cy: number, size: number, rotorAngle: number, alpha: number): void {
    if (alpha <= 0) return;
    const ctx = this.ctx;
    const s = size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);

    // Tail boom
    ctx.fillStyle = HELICOPTER_BODY_COLOR;
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.07);
    ctx.lineTo(-s * 0.46, -s * 0.03);
    ctx.lineTo(-s * 0.46, s * 0.04);
    ctx.lineTo(-s * 0.08, s * 0.09);
    ctx.closePath();
    ctx.fill();

    // Tail fin (vertical stabiliser)
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.02);
    ctx.lineTo(-s * 0.5, -s * 0.15);
    ctx.lineTo(-s * 0.42, s * 0.04);
    ctx.closePath();
    ctx.fill();

    // Skids
    ctx.strokeStyle = HELICOPTER_SKID_COLOR;
    ctx.lineWidth = Math.max(2, s * 0.025);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, s * 0.3);
    ctx.lineTo(s * 0.24, s * 0.3);
    ctx.moveTo(-s * 0.06, s * 0.18);
    ctx.lineTo(-s * 0.09, s * 0.3);
    ctx.moveTo(s * 0.14, s * 0.18);
    ctx.lineTo(s * 0.16, s * 0.3);
    ctx.stroke();

    // Cabin body
    ctx.beginPath();
    ctx.ellipse(s * 0.05, 0, s * 0.27, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = HELICOPTER_BODY_COLOR;
    ctx.fill();

    // Cockpit window
    ctx.beginPath();
    ctx.ellipse(s * 0.15, -s * 0.01, s * 0.1, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = HELICOPTER_WINDOW_COLOR;
    ctx.fill();

    // Mast
    ctx.strokeStyle = HELICOPTER_ROTOR_COLOR;
    ctx.lineWidth = Math.max(2, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 0.18);
    ctx.lineTo(s * 0.05, -s * 0.26);
    ctx.stroke();

    // Main rotor (edge-on bar) with spinning shimmer + slight wobble
    const rotorSpan = s * 0.5;
    const wob = Math.sin(rotorAngle) * s * 0.012;
    ctx.save();
    ctx.translate(s * 0.05, -s * 0.27 + wob);
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = HELICOPTER_ROTOR_COLOR;
    ctx.beginPath();
    ctx.ellipse(0, 0, rotorSpan, s * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.fillRect(-rotorSpan, -s * 0.012, rotorSpan * 2, s * 0.024);
    ctx.globalAlpha = alpha * 0.7;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(Math.cos(rotorAngle) * rotorSpan * 0.75, 0, s * 0.05, s * 0.02, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Tail rotor (spinning disc, seen face-on from the side)
    ctx.save();
    ctx.translate(-s * 0.47, s * 0.0);
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = HELICOPTER_ROTOR_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = HELICOPTER_ROTOR_COLOR;
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(-Math.cos(rotorAngle) * s * 0.08, -Math.sin(rotorAngle) * s * 0.08);
    ctx.lineTo(Math.cos(rotorAngle) * s * 0.08, Math.sin(rotorAngle) * s * 0.08);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  drawHelicopterButton(heli: HelicopterManager): void {
    if (heli.isActive) return; // helicopter is out — no button
    const ctx = this.ctx;
    const cx = heli.buttonX;
    const cy = heli.buttonY;
    const r = heli.buttonRadius;
    const available = heli.isAvailable;

    // Invite-to-tap pulse glow when available
    if (available) {
      const pulse = heli.buttonPulse;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.1 + 0.12 * pulse), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.restore();
    }

    // Button disc
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = available ? 'rgba(255, 255, 255, 0.9)' : 'rgba(214, 222, 230, 0.75)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = available ? HELICOPTER_BODY_COLOR : 'rgba(120, 140, 160, 0.8)';
    ctx.stroke();
    ctx.restore();

    // Helicopter icon inside (dimmed during cooldown)
    this.drawHelicopterShape(cx, cy + r * 0.05, r * 1.4, heli.rotorAngle, available ? 1 : 0.4);

    // Cooldown loading ring
    if (!available) {
      const progress = heli.cooldownProgress;
      ctx.save();
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.lineCap = 'round';
      ctx.strokeStyle = HELICOPTER_BODY_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Plane, missiles, spawn button ──────────────────────────────────────────

  drawMissiles(missiles: Missile[]): void {
    const ctx = this.ctx;
    for (const m of missiles) {
      const angle = Math.atan2(m.vy, m.vx); // atan2 is scale-invariant
      const L = MISSILE_LENGTH;
      const W = MISSILE_WIDTH;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(angle);

      // Exhaust flame trailing behind, flickering with age.
      const flick = 0.6 + 0.4 * Math.sin(m.age * 40);
      ctx.fillStyle = MISSILE_FLAME_COLOR;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(-L * 0.7, -W * 0.32);
      ctx.lineTo(-L * 0.7 - L * 0.7 * flick, 0);
      ctx.lineTo(-L * 0.7, W * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Body (rounded capsule).
      ctx.fillStyle = MISSILE_BODY_COLOR;
      ctx.beginPath();
      ctx.moveTo(-L * 0.7, -W / 2);
      ctx.lineTo(L * 0.45, -W / 2);
      ctx.lineTo(L * 0.45, W / 2);
      ctx.lineTo(-L * 0.7, W / 2);
      ctx.closePath();
      ctx.fill();
      // Rounded tail cap.
      ctx.beginPath();
      ctx.arc(-L * 0.7, 0, W / 2, 0, Math.PI * 2);
      ctx.fill();

      // Nose cone.
      ctx.fillStyle = MISSILE_NOSE_COLOR;
      ctx.beginPath();
      ctx.moveTo(L * 0.45, -W / 2);
      ctx.lineTo(L, 0);
      ctx.lineTo(L * 0.45, W / 2);
      ctx.closePath();
      ctx.fill();

      // Tail fins.
      ctx.fillStyle = MISSILE_FIN_COLOR;
      ctx.beginPath();
      ctx.moveTo(-L * 0.5, -W / 2);
      ctx.lineTo(-L * 0.75, -W);
      ctx.lineTo(-L * 0.4, -W / 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-L * 0.5, W / 2);
      ctx.lineTo(-L * 0.75, W);
      ctx.lineTo(-L * 0.4, W / 2);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  drawPlane(plane: PlaneManager): void {
    this.drawPlaneShape(plane.x, plane.y, plane.size, plane.heading, plane.propAngle, plane.alpha);
  }

  // Side-view plane drawn nose-to-the-right, then rotated to its heading. When it
  // banks left we mirror vertically so it stays upright rather than belly-up.
  private drawPlaneShape(
    cx: number,
    cy: number,
    size: number,
    heading: number,
    propAngle: number,
    alpha: number,
  ): void {
    if (alpha <= 0) return;
    const ctx = this.ctx;
    const s = size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(heading);
    if (Math.cos(heading) < 0) ctx.scale(1, -1); // keep upright when facing left

    const lw = Math.max(1.5, s * 0.012);

    // Tail fin (vertical stabiliser): tall & swept, unmistakably the BACK.
    ctx.fillStyle = PLANE_BODY_COLOR;
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.05);
    ctx.lineTo(-s * 0.40, -s * 0.30);
    ctx.quadraticCurveTo(-s * 0.435, -s * 0.34, -s * 0.45, -s * 0.295);
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.16, -s * 0.36, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PLANE_ACCENT_COLOR;
    ctx.beginPath();
    ctx.moveTo(-s * 0.395, -s * 0.255);
    ctx.lineTo(-s * 0.435, -s * 0.295);
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.225, -s * 0.40, -s * 0.18);
    ctx.closePath();
    ctx.fill();

    // Horizontal tailplane.
    ctx.fillStyle = PLANE_WING_COLOR;
    ctx.beginPath();
    ctx.moveTo(-s * 0.30, -s * 0.02);
    ctx.lineTo(-s * 0.49, -s * 0.075);
    ctx.quadraticCurveTo(-s * 0.52, -s * 0.05, -s * 0.49, -s * 0.02);
    ctx.lineTo(-s * 0.32, s * 0.01);
    ctx.closePath();
    ctx.fill();

    // Fuselage: rounded nose -> smooth taper to a slim tail (NOT an ellipse).
    ctx.fillStyle = PLANE_BODY_COLOR;
    ctx.beginPath();
    ctx.moveTo(s * 0.41, -s * 0.005);
    ctx.quadraticCurveTo(s * 0.41, -s * 0.135, s * 0.20, -s * 0.135);
    ctx.quadraticCurveTo(-s * 0.06, -s * 0.145, -s * 0.42, -s * 0.035);
    ctx.quadraticCurveTo(-s * 0.47, 0, -s * 0.42, s * 0.05);
    ctx.quadraticCurveTo(-s * 0.10, s * 0.155, s * 0.18, s * 0.15);
    ctx.quadraticCurveTo(s * 0.41, s * 0.14, s * 0.41, -s * 0.005);
    ctx.closePath();
    ctx.fill();

    // Belly shading for depth.
    ctx.fillStyle = PLANE_WING_COLOR;
    ctx.beginPath();
    ctx.moveTo(s * 0.36, s * 0.085);
    ctx.quadraticCurveTo(-s * 0.06, s * 0.155, -s * 0.42, s * 0.05);
    ctx.quadraticCurveTo(-s * 0.28, s * 0.10, -s * 0.04, s * 0.115);
    ctx.quadraticCurveTo(s * 0.18, s * 0.115, s * 0.36, s * 0.05);
    ctx.closePath();
    ctx.fill();

    // Main wing: a bold slab projecting down-and-back below the belly.
    ctx.fillStyle = PLANE_WING_COLOR;
    ctx.beginPath();
    ctx.moveTo(s * 0.10, s * 0.085);
    ctx.lineTo(s * 0.02, s * 0.255);
    ctx.lineTo(-s * 0.18, s * 0.255);
    ctx.quadraticCurveTo(-s * 0.24, s * 0.235, -s * 0.16, s * 0.10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PLANE_BODY_COLOR;
    ctx.beginPath();
    ctx.moveTo(s * 0.10, s * 0.085);
    ctx.lineTo(s * 0.05, s * 0.155);
    ctx.lineTo(-s * 0.16, s * 0.135);
    ctx.lineTo(-s * 0.16, s * 0.10);
    ctx.closePath();
    ctx.fill();

    // Yellow accent cheat-line along the upper fuselage.
    ctx.strokeStyle = PLANE_ACCENT_COLOR;
    ctx.lineWidth = Math.max(2, s * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.31, -s * 0.04);
    ctx.quadraticCurveTo(-s * 0.04, -s * 0.02, -s * 0.36, -s * 0.02);
    ctx.stroke();

    // Cockpit canopy: two cheerful windows on the nose shoulder.
    ctx.fillStyle = PLANE_WINDOW_COLOR;
    ctx.beginPath();
    ctx.moveTo(s * 0.06, -s * 0.10);
    ctx.quadraticCurveTo(s * 0.20, -s * 0.155, s * 0.29, -s * 0.075);
    ctx.lineTo(s * 0.27, -s * 0.06);
    ctx.lineTo(s * 0.05, -s * 0.07);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PLANE_WING_COLOR;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.165, -s * 0.135);
    ctx.lineTo(s * 0.155, -s * 0.065);
    ctx.stroke();

    // Fixed landing-gear hint: a single wheel on a strut under the belly.
    ctx.strokeStyle = PLANE_PROP_COLOR;
    ctx.lineWidth = Math.max(1.5, s * 0.022);
    ctx.beginPath();
    ctx.moveTo(s * 0.22, s * 0.12);
    ctx.lineTo(s * 0.245, s * 0.215);
    ctx.stroke();
    ctx.fillStyle = PLANE_PROP_COLOR;
    ctx.beginPath();
    ctx.arc(s * 0.25, s * 0.235, s * 0.028, 0, Math.PI * 2);
    ctx.fill();

    // Nose spinner + spinning two-blade propeller (animated via propAngle).
    ctx.save();
    ctx.translate(s * 0.41, 0);
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * 0.15;
    ctx.fillStyle = PLANE_PROP_COLOR;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.028, s * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a0;
    const blade = s * 0.215 * Math.abs(Math.cos(propAngle));
    const tip = Math.max(s * 0.012, s * 0.024 * Math.abs(Math.cos(propAngle)));
    ctx.fillStyle = PLANE_PROP_COLOR;
    ctx.beginPath();
    ctx.moveTo(-s * 0.013, 0);
    ctx.quadraticCurveTo(-tip, -blade * 0.6, 0, -blade);
    ctx.quadraticCurveTo(tip, -blade * 0.6, s * 0.013, 0);
    ctx.quadraticCurveTo(tip, blade * 0.6, 0, blade);
    ctx.quadraticCurveTo(-tip, blade * 0.6, -s * 0.013, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PLANE_ACCENT_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PLANE_PROP_COLOR;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.022, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  drawPlaneButton(plane: PlaneManager): void {
    if (plane.isActive) return; // plane is out — no button
    const ctx = this.ctx;
    const cx = plane.buttonX;
    const cy = plane.buttonY;
    const r = plane.buttonRadius;
    const available = plane.isAvailable;

    // Invite-to-tap pulse glow when available.
    if (available) {
      const pulse = plane.buttonPulse;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, r * (1.1 + 0.12 * pulse), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.restore();
    }

    // Button disc.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = available ? 'rgba(255, 255, 255, 0.9)' : 'rgba(214, 222, 230, 0.75)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.08);
    ctx.strokeStyle = available ? PLANE_BODY_COLOR : 'rgba(120, 140, 160, 0.8)';
    ctx.stroke();
    ctx.restore();

    // Plane icon inside (dimmed during cooldown), nose pointing up-right.
    this.drawPlaneShape(cx, cy, r * 1.5, -0.35, plane.propAngle, available ? 1 : 0.4);

    // Cooldown loading ring.
    if (!available) {
      const progress = plane.cooldownProgress;
      ctx.save();
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.lineCap = 'round';
      ctx.strokeStyle = PLANE_BODY_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
    }
  }

}
