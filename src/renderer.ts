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
  BULLDOZER_BODY_COLOR,
  BULLDOZER_BODY_DARK,
  BULLDOZER_CAB_COLOR,
  BULLDOZER_WINDOW_COLOR,
  BULLDOZER_BLADE_COLOR,
  BULLDOZER_BLADE_DARK,
  BULLDOZER_TRACK_COLOR,
  BULLDOZER_WHEEL_COLOR,
  BULLDOZER_DETAIL_COLOR,
} from './constants';
import type { Balloon, Particle } from './balloon';
import type { ActiveEvent, Bubble } from './surprise';
import type { Dart, HelicopterManager } from './helicopter';
import type { Missile, PlaneManager } from './plane';
import type { BulldozerManager } from './bulldozer';

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

    const highlightColor = BALLOON_HIGHLIGHTS[b.number] || '#FFFFFF';
    const edgeColor = this.shadeColor(b.color, -0.34); // saturated/darker rim
    const aoColor = this.shadeColor(b.color, -0.55); // lower-right ambient occlusion

    // Calm, subtle motion only: a ~1px highlight drift and a faint string sway.
    const t = b.animTime || 0;
    const drift = Math.sin(t * 1.1) * rx * 0.012;

    ctx.save();
    ctx.translate(b.x, b.y);

    // --- Body: every fill is clipped to the exact (rx, ry) hit-test ellipse so
    // no pixel paints beyond it. The teardrop pinch is faked with shading only. ---
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    // 1) Base volumetric gradient: bright upper-left falling to a saturated rim.
    const body = ctx.createRadialGradient(
      -rx * 0.32, -ry * 0.40, rx * 0.05,
      -rx * 0.05, -ry * 0.05, ry * 1.18
    );
    body.addColorStop(0, this.shadeColor(b.color, 0.30));
    body.addColorStop(0.45, b.color);
    body.addColorStop(1, edgeColor);
    ctx.fillStyle = body;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    // 2) Lower-right ambient-occlusion crescent for grounded volume.
    const ao = ctx.createRadialGradient(
      rx * 0.55, ry * 0.62, rx * 0.1,
      rx * 0.40, ry * 0.50, ry * 1.05
    );
    ao.addColorStop(0, this.withAlpha(aoColor, 0.5));
    ao.addColorStop(0.55, this.withAlpha(aoColor, 0.16));
    ao.addColorStop(1, this.withAlpha(aoColor, 0));
    ctx.fillStyle = ao;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    // 3) Teardrop pinch toward the knot: a soft dark gather at the very bottom,
    // fully inside the ellipse, hinting the latex narrows to the tie.
    const pinch = ctx.createRadialGradient(
      0, ry * 0.92, rx * 0.05,
      0, ry * 0.98, rx * 0.95
    );
    pinch.addColorStop(0, this.withAlpha(aoColor, 0.38));
    pinch.addColorStop(1, this.withAlpha(aoColor, 0));
    ctx.fillStyle = pinch;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    // 4) Soft inner-rim light along the upper-left edge for a latex sheen.
    const rim = ctx.createRadialGradient(
      -rx * 0.18, -ry * 0.18, ry * 0.62,
      -rx * 0.18, -ry * 0.18, ry * 1.02
    );
    rim.addColorStop(0, this.withAlpha(highlightColor, 0));
    rim.addColorStop(0.82, this.withAlpha(highlightColor, 0));
    rim.addColorStop(1, this.withAlpha(highlightColor, 0.28));
    ctx.fillStyle = rim;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    // 5) Bright elongated specular highlight, upper-left, gently drifting.
    ctx.save();
    ctx.translate(-rx * 0.34 + drift, -ry * 0.40 + drift);
    ctx.rotate(-0.62);
    const specPath = new Path2D();
    specPath.ellipse(0, 0, rx * 0.20, ry * 0.34, 0, 0, Math.PI * 2);
    const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 0.30);
    spec.addColorStop(0, this.withAlpha('#FFFFFF', 0.85));
    spec.addColorStop(0.5, this.withAlpha(highlightColor, 0.45));
    spec.addColorStop(1, this.withAlpha(highlightColor, 0));
    ctx.fillStyle = spec;
    ctx.fill(specPath);
    ctx.restore();

    // 6) Tiny crisp hotspot for glossy sparkle.
    ctx.beginPath();
    ctx.ellipse(-rx * 0.40 + drift, -ry * 0.50 + drift, rx * 0.08, ry * 0.07, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = this.withAlpha('#FFFFFF', 0.9);
    ctx.fill();

    ctx.restore(); // end body clip

    // --- Number: drawn over the body, never rotated, with a subtle drop shadow ---
    const fontSize = Math.round(ry * 0.7);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = Math.max(2, ry * 0.06);
    ctx.shadowOffsetY = Math.max(1, ry * 0.03);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillText(String(b.number), 0, ry * 0.02);
    ctx.restore();

    // --- Knot: crisp little double-lobe just below the body, in the rim color ---
    const knotTop = ry * 0.985;
    const knotR = rx * 0.13;
    const knotGrad = ctx.createLinearGradient(0, knotTop, 0, knotTop + knotR * 2.4);
    knotGrad.addColorStop(0, b.color);
    knotGrad.addColorStop(1, edgeColor);
    ctx.fillStyle = knotGrad;
    ctx.beginPath();
    ctx.moveTo(0, knotTop);
    ctx.bezierCurveTo(-knotR * 1.7, knotTop + knotR * 0.5, -knotR * 1.2, knotTop + knotR * 2.4, 0, knotTop + knotR * 2.1);
    ctx.bezierCurveTo(knotR * 1.2, knotTop + knotR * 2.4, knotR * 1.7, knotTop + knotR * 0.5, 0, knotTop);
    ctx.closePath();
    ctx.fill();

    // --- String: thin, gently curved, with a calm sway ---
    const stringLen = ry * STRING_LENGTH_RATIO;
    const stringTop = knotTop + knotR * 2.1;
    const sway = Math.sin(t * 0.9) * rx * 0.18;
    ctx.beginPath();
    ctx.moveTo(0, stringTop);
    ctx.bezierCurveTo(
      rx * 0.32 + sway, stringTop + stringLen * 0.40,
      -rx * 0.20 + sway, stringTop + stringLen * 0.72,
      sway * 0.6, stringTop + stringLen
    );
    ctx.strokeStyle = 'rgba(120, 120, 120, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Lighten (amount > 0) or darken (amount < 0) a #RRGGBB color.
   * amount is in [-1, 1]; returns an #RRGGBB string. Pure, stable, no DOM.
   */
  private shadeColor(hex: string, amount: number): string {
    const { r, g, b } = this.parseHex(hex);
    const mix = (c: number) =>
      amount >= 0
        ? Math.round(c + (255 - c) * amount)
        : Math.round(c * (1 + amount));
    const clamp = (n: number) => Math.max(0, Math.min(255, mix(n)));
    const to2 = (n: number) => clamp(n).toString(16).padStart(2, '0');
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  }

  /** Convert a #RRGGBB color to an rgba() string with the given alpha. */
  private withAlpha(hex: string, alpha: number): string {
    const { r, g, b } = this.parseHex(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /** Parse a #RGB or #RRGGBB color into 0-255 components. */
  private parseHex(hex: string): { r: number; g: number; b: number } {
    let h = hex.replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    const num = parseInt(h, 16);
    return {
      r: (num >> 16) & 0xff,
      g: (num >> 8) & 0xff,
      b: num & 0xff,
    };
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

  // ── Bulldozer, spawn button ────────────────────────────────────────────────

  drawBulldozer(dozer: BulldozerManager): void {
    this.drawBulldozerShape(
      dozer.x, dozer.y, dozer.size, dozer.heading, dozer.trackPhase, dozer.alpha, dozer.crushing,
    );
  }

  // Build a rounded-rect path (caller fills/strokes). x,y is the top-left corner.
  private roundedRectPath(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // A wheel with a hub and a few rotating spokes (trackPhase drives the spin).
  private drawTrackWheel(wx: number, wy: number, wr: number, trackPhase: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = BULLDOZER_WHEEL_COLOR;
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, Math.PI * 2);
    ctx.fill();
    // Spokes.
    ctx.strokeStyle = BULLDOZER_BODY_DARK;
    ctx.lineWidth = Math.max(1.5, wr * 0.18);
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = trackPhase + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(a) * wr * 0.82, wy + Math.sin(a) * wr * 0.82);
      ctx.stroke();
    }
    // Hub.
    ctx.fillStyle = BULLDOZER_BODY_COLOR;
    ctx.beginPath();
    ctx.arc(wx, wy, wr * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  // Side-view bulldozer drawn nose/blade-to-the-right, then rotated to its
  // heading. When it drives left we mirror vertically so it stays upright (same
  // trick the plane uses) rather than flipping belly-up.
  private drawBulldozerShape(
    cx: number,
    cy: number,
    size: number,
    heading: number,
    trackPhase: number,
    alpha: number,
    crushing: boolean,
  ): void {
    if (alpha <= 0) return;
    const ctx = this.ctx;
    const s = size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(heading);
    if (Math.cos(heading) < 0) ctx.scale(1, -1);

    // ── Tracks (dark stadium frame + wheels) ──
    const trackTop = 0.10 * s;
    const trackBot = 0.345 * s;
    const trackL = -0.32 * s;
    const trackR = 0.24 * s;
    const trackCy = (trackTop + trackBot) / 2;
    const trackRad = (trackBot - trackTop) / 2;
    ctx.fillStyle = BULLDOZER_TRACK_COLOR;
    ctx.beginPath();
    ctx.moveTo(trackL, trackTop);
    ctx.lineTo(trackR, trackTop);
    ctx.arc(trackR, trackCy, trackRad, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(trackL, trackBot);
    ctx.arc(trackL, trackCy, trackRad, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    // Tread lugs along the bottom (short ticks that ride with trackPhase).
    ctx.strokeStyle = BULLDOZER_WHEEL_COLOR;
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.lineCap = 'butt';
    const lugSpan = trackR - trackL;
    for (let i = 0; i < 7; i++) {
      const frac = ((i + (trackPhase * 0.16) % 1) % 7) / 7;
      const lx = trackL + frac * lugSpan;
      ctx.beginPath();
      ctx.moveTo(lx, trackBot - s * 0.01);
      ctx.lineTo(lx, trackBot - s * 0.05);
      ctx.stroke();
    }
    this.drawTrackWheel(-0.23 * s, trackCy, 0.115 * s, trackPhase);
    this.drawTrackWheel(0.15 * s, trackCy, 0.10 * s, trackPhase);

    // ── Chassis body ──
    ctx.fillStyle = BULLDOZER_BODY_COLOR;
    this.roundedRectPath(-0.30 * s, -0.03 * s, 0.48 * s, 0.17 * s, 0.04 * s);
    ctx.fill();
    // Lower shading band.
    ctx.fillStyle = BULLDOZER_BODY_DARK;
    this.roundedRectPath(-0.30 * s, 0.085 * s, 0.48 * s, 0.06 * s, 0.03 * s);
    ctx.fill();

    // ── Operator cab (slanted windshield) ──
    ctx.fillStyle = BULLDOZER_CAB_COLOR;
    ctx.beginPath();
    ctx.moveTo(-0.27 * s, -0.03 * s);
    ctx.lineTo(-0.27 * s, -0.20 * s);
    ctx.lineTo(-0.20 * s, -0.235 * s);
    ctx.lineTo(-0.075 * s, -0.235 * s);
    ctx.lineTo(-0.055 * s, -0.03 * s);
    ctx.closePath();
    ctx.fill();
    // Window.
    ctx.fillStyle = BULLDOZER_WINDOW_COLOR;
    ctx.beginPath();
    ctx.moveTo(-0.235 * s, -0.055 * s);
    ctx.lineTo(-0.235 * s, -0.175 * s);
    ctx.lineTo(-0.185 * s, -0.205 * s);
    ctx.lineTo(-0.095 * s, -0.205 * s);
    ctx.lineTo(-0.08 * s, -0.055 * s);
    ctx.closePath();
    ctx.fill();
    // ROPS roof post hint.
    ctx.strokeStyle = BULLDOZER_DETAIL_COLOR;
    ctx.lineWidth = Math.max(1.5, s * 0.018);
    ctx.beginPath();
    ctx.moveTo(-0.20 * s, -0.235 * s);
    ctx.lineTo(-0.075 * s, -0.235 * s);
    ctx.stroke();

    // ── Exhaust stack ──
    ctx.fillStyle = BULLDOZER_DETAIL_COLOR;
    ctx.fillRect(0.055 * s, -0.205 * s, 0.035 * s, 0.18 * s);
    ctx.fillRect(0.045 * s, -0.225 * s, 0.055 * s, 0.025 * s);

    // ── Push arm + blade (front) ──
    const jit = crushing ? Math.sin(trackPhase * 6) * s * 0.02 : 0;
    // Arm from the chassis out to the blade.
    ctx.strokeStyle = BULLDOZER_BLADE_DARK;
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.05 * s, 0.10 * s);
    ctx.lineTo(0.30 * s + jit, 0.18 * s);
    ctx.stroke();

    ctx.save();
    ctx.translate(jit, 0);
    // Steel blade plate, concave toward the front (right).
    ctx.fillStyle = BULLDOZER_BLADE_COLOR;
    ctx.beginPath();
    ctx.moveTo(0.30 * s, -0.08 * s);
    ctx.quadraticCurveTo(0.47 * s, -0.02 * s, 0.45 * s, 0.16 * s);
    ctx.quadraticCurveTo(0.44 * s, 0.30 * s, 0.34 * s, 0.37 * s);
    ctx.lineTo(0.28 * s, 0.35 * s);
    ctx.quadraticCurveTo(0.355 * s, 0.16 * s, 0.30 * s, -0.08 * s);
    ctx.closePath();
    ctx.fill();
    // Top rolled edge.
    ctx.fillStyle = BULLDOZER_BLADE_DARK;
    ctx.beginPath();
    ctx.moveTo(0.30 * s, -0.08 * s);
    ctx.quadraticCurveTo(0.47 * s, -0.02 * s, 0.45 * s, 0.16 * s);
    ctx.lineTo(0.425 * s, 0.16 * s);
    ctx.quadraticCurveTo(0.445 * s, -0.01 * s, 0.295 * s, -0.055 * s);
    ctx.closePath();
    ctx.fill();
    // Cutting edge at the bottom.
    ctx.fillStyle = BULLDOZER_BLADE_DARK;
    ctx.beginPath();
    ctx.moveTo(0.34 * s, 0.37 * s);
    ctx.lineTo(0.28 * s, 0.35 * s);
    ctx.lineTo(0.30 * s, 0.305 * s);
    ctx.lineTo(0.365 * s, 0.325 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  drawBulldozerButton(dozer: BulldozerManager): void {
    if (dozer.isActive) return; // bulldozer is out — no button
    const ctx = this.ctx;
    const cx = dozer.buttonX;
    const cy = dozer.buttonY;
    const r = dozer.buttonRadius;
    const available = dozer.isAvailable;

    // Invite-to-tap pulse glow when available.
    if (available) {
      const pulse = dozer.buttonPulse;
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
    ctx.strokeStyle = available ? BULLDOZER_BODY_DARK : 'rgba(120, 140, 160, 0.8)';
    ctx.stroke();
    ctx.restore();

    // Bulldozer icon inside (dimmed during cooldown), level and facing right.
    this.drawBulldozerShape(cx, cy + r * 0.08, r * 1.55, 0, dozer.trackPhase, available ? 1 : 0.4, false);

    // Cooldown loading ring.
    if (!available) {
      const progress = dozer.cooldownProgress;
      ctx.save();
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.lineCap = 'round';
      ctx.strokeStyle = BULLDOZER_BODY_DARK;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
    }
  }

}
