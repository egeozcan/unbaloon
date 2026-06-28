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
  TRACTOR_BODY_COLOR,
  TRACTOR_BODY_DARK,
  TRACTOR_CAB_COLOR,
  TRACTOR_WINDOW_COLOR,
  TRACTOR_WHEEL_COLOR,
  TRACTOR_WHEEL_HUB,
  TRACTOR_TRAILER_COLOR,
  TRACTOR_TRAILER_DARK,
  TRACTOR_DETAIL_COLOR,
  RAIN_CLOUD_COLOR,
  RAIN_CLOUD_LIGHT,
  RAIN_CLOUD_DARK,
  RAIN_DROP_COLOR,
  RAIN_DROP_COUNT,
  RAIN_DROP_SPEED,
  RAIN_DROP_LENGTH,
  EXCAVATOR_BODY_COLOR,
  EXCAVATOR_BODY_DARK,
  EXCAVATOR_CAB_COLOR,
  EXCAVATOR_WINDOW_COLOR,
  EXCAVATOR_ARM_COLOR,
  EXCAVATOR_ARM_DARK,
  EXCAVATOR_BUCKET_COLOR,
  EXCAVATOR_BUCKET_DARK,
  EXCAVATOR_TRACK_COLOR,
  EXCAVATOR_WHEEL_COLOR,
  EXCAVATOR_DETAIL_COLOR,
} from './constants';
import type { Balloon, Particle } from './balloon';
import type { ActiveEvent, Bubble } from './surprise';
import type { Dart, HelicopterManager } from './helicopter';
import type { Missile, PlaneManager } from './plane';
import type { BulldozerManager } from './bulldozer';
import type { TractorManager } from './tractor';
import type { RainCloudManager } from './raincloud';
import type { ExcavatorManager } from './excavator';

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

    this.paintBalloonGloss(rx, ry, aoColor, highlightColor, drift);

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

    this.drawKnotAndString(rx, ry, b.color, edgeColor, t);

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

  // Layered "gloss" overlays shared by every balloon: a lower-right ambient
  // occlusion crescent, a teardrop pinch toward the knot, an upper-left rim
  // sheen, a bright specular highlight, and a tiny sparkle. Call this with an
  // active ellipse clip at the local origin so nothing escapes the body.
  // `specAlpha` pulses the highlight (star balloons twinkle); `aoScale` eases
  // the shadows back for already-busy fills like the rainbow gradient.
  private paintBalloonGloss(
    rx: number,
    ry: number,
    aoColor: string,
    highlightColor: string,
    drift: number,
    specAlpha: number = 1,
    aoScale: number = 1,
  ): void {
    const ctx = this.ctx;

    // Lower-right ambient-occlusion crescent for grounded volume.
    const ao = ctx.createRadialGradient(
      rx * 0.55, ry * 0.62, rx * 0.1,
      rx * 0.40, ry * 0.50, ry * 1.05
    );
    ao.addColorStop(0, this.withAlpha(aoColor, 0.5 * aoScale));
    ao.addColorStop(0.55, this.withAlpha(aoColor, 0.16 * aoScale));
    ao.addColorStop(1, this.withAlpha(aoColor, 0));
    ctx.fillStyle = ao;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    // Teardrop pinch toward the knot: a soft dark gather at the very bottom.
    const pinch = ctx.createRadialGradient(
      0, ry * 0.92, rx * 0.05,
      0, ry * 0.98, rx * 0.95
    );
    pinch.addColorStop(0, this.withAlpha(aoColor, 0.38 * aoScale));
    pinch.addColorStop(1, this.withAlpha(aoColor, 0));
    ctx.fillStyle = pinch;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    // Soft inner-rim light along the upper-left edge for a latex sheen.
    const rim = ctx.createRadialGradient(
      -rx * 0.18, -ry * 0.18, ry * 0.62,
      -rx * 0.18, -ry * 0.18, ry * 1.02
    );
    rim.addColorStop(0, this.withAlpha(highlightColor, 0));
    rim.addColorStop(0.82, this.withAlpha(highlightColor, 0));
    rim.addColorStop(1, this.withAlpha(highlightColor, 0.28));
    ctx.fillStyle = rim;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    // Bright elongated specular highlight, upper-left, gently drifting.
    if (specAlpha > 0) {
      ctx.save();
      ctx.translate(-rx * 0.34 + drift, -ry * 0.40 + drift);
      ctx.rotate(-0.62);
      const specPath = new Path2D();
      specPath.ellipse(0, 0, rx * 0.20, ry * 0.34, 0, 0, Math.PI * 2);
      const spec = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 0.30);
      spec.addColorStop(0, this.withAlpha('#FFFFFF', 0.85 * specAlpha));
      spec.addColorStop(0.5, this.withAlpha(highlightColor, 0.45 * specAlpha));
      spec.addColorStop(1, this.withAlpha(highlightColor, 0));
      ctx.fillStyle = spec;
      ctx.fill(specPath);
      ctx.restore();
    }

    // Tiny crisp hotspot for glossy sparkle.
    ctx.beginPath();
    ctx.ellipse(-rx * 0.40 + drift, -ry * 0.50 + drift, rx * 0.08, ry * 0.07, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = this.withAlpha('#FFFFFF', 0.9);
    ctx.fill();
  }

  // The knot (a crisp double-lobe just below the body) and a thin, gently
  // swaying string. Shared by numbered and special balloons.
  private drawKnotAndString(
    rx: number,
    ry: number,
    knotColor: string,
    edgeColor: string,
    t: number,
  ): void {
    const ctx = this.ctx;
    const knotTop = ry * 0.985;
    const knotR = rx * 0.13;
    const knotGrad = ctx.createLinearGradient(0, knotTop, 0, knotTop + knotR * 2.4);
    knotGrad.addColorStop(0, knotColor);
    knotGrad.addColorStop(1, edgeColor);
    ctx.fillStyle = knotGrad;
    ctx.beginPath();
    ctx.moveTo(0, knotTop);
    ctx.bezierCurveTo(-knotR * 1.7, knotTop + knotR * 0.5, -knotR * 1.2, knotTop + knotR * 2.4, 0, knotTop + knotR * 2.1);
    ctx.bezierCurveTo(knotR * 1.2, knotTop + knotR * 2.4, knotR * 1.7, knotTop + knotR * 0.5, 0, knotTop);
    ctx.closePath();
    ctx.fill();

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
  }

  private drawSpecialBalloon(b: Balloon): void {
    const ctx = this.ctx;
    const rx = b.radiusX * b.scaleX;
    const ry = b.radiusY * b.scaleY;
    const isRainbow = b.specialType === 'rainbow' || b.isFinale;

    const t = b.animTime || 0;
    const drift = Math.sin(t * 1.1) * rx * 0.012;

    // Colour roles, mirroring the numbered balloons' light model.
    const knotColor = isRainbow ? RAINBOW_GRADIENT_COLORS[0] : b.color;
    const edgeColor = this.shadeColor(knotColor, -0.34);
    const aoColor = isRainbow ? '#2A2740' : this.shadeColor(b.color, -0.55);
    const highlightColor = isRainbow ? '#FFFFFF' : this.shadeColor(b.color, 0.5);
    // Star balloons keep their twinkle: pulse the specular highlight.
    const specAlpha = b.specialType === 'star' ? 0.55 + 0.45 * Math.sin(t * 4) : 1;
    const aoScale = isRainbow ? 0.8 : 1;

    ctx.save();
    ctx.translate(b.x, b.y);

    // --- Body, clipped to the exact hit-test ellipse ---
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    if (isRainbow) {
      // Diagonal rainbow sweep — the signature special-balloon fill.
      const grad = ctx.createLinearGradient(-rx, -ry, rx, ry);
      RAINBOW_GRADIENT_COLORS.forEach((color, i) => {
        grad.addColorStop(i / (RAINBOW_GRADIENT_COLORS.length - 1), color);
      });
      ctx.fillStyle = grad;
    } else {
      // The same volumetric body the numbered balloons use.
      const body = ctx.createRadialGradient(
        -rx * 0.32, -ry * 0.40, rx * 0.05,
        -rx * 0.05, -ry * 0.05, ry * 1.18
      );
      body.addColorStop(0, this.shadeColor(b.color, 0.30));
      body.addColorStop(0.45, b.color);
      body.addColorStop(1, edgeColor);
      ctx.fillStyle = body;
    }
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    this.paintBalloonGloss(rx, ry, aoColor, highlightColor, drift, specAlpha, aoScale);

    ctx.restore(); // end body clip

    // --- Icon / face on top, kept crisp like the number on numbered balloons ---
    if (b.specialType === 'star') {
      this.drawStarIcon(rx, ry);
    } else if (b.specialType?.startsWith('animal-')) {
      this.drawAnimalFace(b.specialType, rx, ry);
    }

    this.drawKnotAndString(rx, ry, knotColor, edgeColor, t);

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

  // ── Tractor, trailer, spawn button ───────────────────────────────────────────

  drawTractor(tractor: TractorManager): void {
    const alpha = tractor.alpha;
    if (alpha <= 0) return;
    const s = tractor.size;
    // Trailer (behind, to the left) first, then the drawbar, then the body on top
    // so the tractor's rear overlaps the hitch.
    this.drawTrailer(tractor.trailerCenterX, tractor.bedSurfaceY, tractor.bedHalfWidth, s, tractor.wheelPhase, alpha);
    this.drawDrawbar(tractor, s, alpha);
    this.drawTractorBody(tractor.x, tractor.y, s, tractor.wheelPhase, alpha);
  }

  // A clean tractor tyre: dark rubber, a yellow hub with a few spokes, hub cap.
  private drawTractorWheel(wx: number, wy: number, wr: number, wheelPhase: number): void {
    const ctx = this.ctx;
    // Tyre.
    ctx.fillStyle = TRACTOR_WHEEL_COLOR;
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, Math.PI * 2);
    ctx.fill();
    // Soft tyre-wall ring for a hint of depth (no busy tread).
    ctx.strokeStyle = this.shadeColor(TRACTOR_WHEEL_COLOR, 0.22);
    ctx.lineWidth = wr * 0.09;
    ctx.beginPath();
    ctx.arc(wx, wy, wr * 0.80, 0, Math.PI * 2);
    ctx.stroke();
    // Yellow hub.
    ctx.fillStyle = TRACTOR_WHEEL_HUB;
    ctx.beginPath();
    ctx.arc(wx, wy, wr * 0.50, 0, Math.PI * 2);
    ctx.fill();
    // A few clean spokes (turn with the wheel).
    ctx.strokeStyle = this.shadeColor(TRACTOR_WHEEL_HUB, -0.2);
    ctx.lineWidth = Math.max(1.5, wr * 0.1);
    ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const a = wheelPhase + (k * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(a) * wr * 0.45, wy + Math.sin(a) * wr * 0.45);
      ctx.stroke();
    }
    // Hub cap.
    ctx.fillStyle = TRACTOR_DETAIL_COLOR;
    ctx.beginPath();
    ctx.arc(wx, wy, wr * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Side-view tractor drawn nose-to-the-right around (cx, cy). The tractor always
  // faces right, so no rotation/mirroring is needed. Kept clean and uncluttered:
  // solid body, simple wheels, subtle sheen and a framed cab window.
  private drawTractorBody(cx: number, cy: number, s: number, wheelPhase: number, alpha: number): void {
    if (alpha <= 0) return;
    const ctx = this.ctx;
    const green = TRACTOR_BODY_COLOR;
    const greenDark = TRACTOR_BODY_DARK;
    const greenLight = this.shadeColor(green, 0.22);

    const rwX = -0.15 * s, rwY = 0.16 * s, rwR = 0.26 * s; // rear wheel
    const fwX = 0.32 * s, fwY = 0.26 * s, fwR = 0.16 * s;  // front wheel (edge = FRONT_LOCAL)

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);

    // Wheels first so the body overlaps their tops (they peek out the bottom).
    this.drawTractorWheel(rwX, rwY, rwR, wheelPhase);
    this.drawTractorWheel(fwX, fwY, fwR, wheelPhase);

    // Chassis bar linking the axles.
    ctx.fillStyle = greenDark;
    this.roundedRectPath(-0.14 * s, 0.10 * s, 0.50 * s, 0.09 * s, 0.03 * s);
    ctx.fill();

    // Engine hood (front), with a top sheen and a lower shade for roundness.
    ctx.fillStyle = green;
    this.roundedRectPath(0.04 * s, -0.04 * s, 0.39 * s, 0.18 * s, 0.05 * s);
    ctx.fill();
    ctx.fillStyle = greenLight;
    this.roundedRectPath(0.06 * s, -0.04 * s, 0.34 * s, 0.04 * s, 0.02 * s);
    ctx.fill();
    ctx.fillStyle = greenDark;
    this.roundedRectPath(0.06 * s, 0.10 * s, 0.35 * s, 0.04 * s, 0.02 * s);
    ctx.fill();

    // Grille panel at the nose and a round headlight with a glint.
    ctx.fillStyle = greenDark;
    this.roundedRectPath(0.38 * s, 0.0 * s, 0.05 * s, 0.12 * s, 0.018 * s);
    ctx.fill();
    ctx.fillStyle = TRACTOR_WHEEL_HUB;
    ctx.beginPath();
    ctx.arc(0.41 * s, -0.04 * s, 0.035 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(0.40 * s, -0.052 * s, 0.012 * s, 0, Math.PI * 2);
    ctx.fill();

    // Cab: a rounded-roof block over the rear.
    ctx.fillStyle = TRACTOR_CAB_COLOR;
    ctx.beginPath();
    ctx.moveTo(-0.34 * s, 0.10 * s);
    ctx.lineTo(-0.34 * s, -0.25 * s);
    ctx.quadraticCurveTo(-0.34 * s, -0.34 * s, -0.25 * s, -0.34 * s);
    ctx.lineTo(-0.06 * s, -0.34 * s);
    ctx.quadraticCurveTo(0.03 * s, -0.33 * s, 0.05 * s, -0.18 * s);
    ctx.lineTo(0.07 * s, 0.04 * s);
    ctx.lineTo(0.0 * s, 0.10 * s);
    ctx.closePath();
    ctx.fill();

    // Window (framed light-blue glass) with a slanted windshield and a glint.
    ctx.fillStyle = TRACTOR_WINDOW_COLOR;
    ctx.beginPath();
    ctx.moveTo(-0.30 * s, -0.27 * s);
    ctx.lineTo(-0.07 * s, -0.27 * s);
    ctx.quadraticCurveTo(0.0 * s, -0.26 * s, 0.02 * s, -0.12 * s);
    ctx.lineTo(0.025 * s, -0.04 * s);
    ctx.lineTo(-0.30 * s, -0.04 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.moveTo(-0.25 * s, -0.25 * s);
    ctx.lineTo(-0.18 * s, -0.25 * s);
    ctx.lineTo(-0.26 * s, -0.06 * s);
    ctx.lineTo(-0.30 * s, -0.06 * s);
    ctx.closePath();
    ctx.fill();
    // Window divider post.
    ctx.strokeStyle = TRACTOR_CAB_COLOR;
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.12 * s, -0.27 * s);
    ctx.lineTo(-0.12 * s, -0.04 * s);
    ctx.stroke();

    // Exhaust stack with a flared cap, rising past the cab roof.
    ctx.fillStyle = TRACTOR_DETAIL_COLOR;
    ctx.fillRect(0.085 * s, -0.36 * s, 0.03 * s, 0.32 * s);
    this.roundedRectPath(0.073 * s, -0.39 * s, 0.054 * s, 0.034 * s, 0.012 * s);
    ctx.fill();

    ctx.restore();
  }

  // The flatbed trailer the tractor tows. Drawn as a low deck so loaded balloons
  // (painted earlier, in the balloon pass) sit visibly on top, cradled by the
  // end boards.
  private drawTrailer(
    centerX: number,
    surfaceY: number,
    half: number,
    s: number,
    wheelPhase: number,
    alpha: number,
  ): void {
    if (alpha <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Wheels under the bed (aligned to the same floor as the tractor).
    this.drawTractorWheel(centerX - half * 0.45, surfaceY + 0.30 * s, 0.16 * s, wheelPhase);
    this.drawTractorWheel(centerX + half * 0.45, surfaceY + 0.30 * s, 0.16 * s, wheelPhase);

    // Deck (the platform balloons rest on).
    ctx.fillStyle = TRACTOR_TRAILER_COLOR;
    this.roundedRectPath(centerX - half, surfaceY, half * 2, 0.12 * s, 0.03 * s);
    ctx.fill();
    // Top-edge sheen and underside shading for a little depth.
    ctx.fillStyle = this.shadeColor(TRACTOR_TRAILER_COLOR, 0.18);
    this.roundedRectPath(centerX - half + 0.02 * s, surfaceY + 0.008 * s, half * 2 - 0.04 * s, 0.022 * s, 0.01 * s);
    ctx.fill();
    ctx.fillStyle = TRACTOR_TRAILER_DARK;
    this.roundedRectPath(centerX - half, surfaceY + 0.07 * s, half * 2, 0.05 * s, 0.025 * s);
    ctx.fill();
    // Plank seams across the deck.
    ctx.strokeStyle = TRACTOR_TRAILER_DARK;
    ctx.lineWidth = Math.max(1, s * 0.008);
    const planks = 5;
    for (let i = 1; i < planks; i++) {
      const px = centerX - half + (half * 2 * i) / planks;
      ctx.beginPath();
      ctx.moveTo(px, surfaceY + 0.012 * s);
      ctx.lineTo(px, surfaceY + 0.105 * s);
      ctx.stroke();
    }

    // Low end boards (stake posts) that cradle the cargo, each with a cap.
    for (const ex of [centerX - half, centerX + half - 0.055 * s]) {
      ctx.fillStyle = TRACTOR_TRAILER_DARK;
      this.roundedRectPath(ex, surfaceY - 0.20 * s, 0.055 * s, 0.22 * s, 0.02 * s);
      ctx.fill();
      ctx.fillStyle = this.shadeColor(TRACTOR_TRAILER_COLOR, 0.1);
      this.roundedRectPath(ex - 0.006 * s, surfaceY - 0.215 * s, 0.067 * s, 0.03 * s, 0.012 * s);
      ctx.fill();
    }

    ctx.restore();
  }

  // The hitch bar linking the trailer's front board to the tractor's rear.
  private drawDrawbar(tractor: TractorManager, s: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = TRACTOR_DETAIL_COLOR;
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tractor.trailerCenterX + tractor.bedHalfWidth, tractor.bedSurfaceY + 0.05 * s);
    ctx.lineTo(tractor.x - 0.34 * s, tractor.y + 0.12 * s);
    ctx.stroke();
    ctx.restore();
  }

  drawTractorButton(tractor: TractorManager): void {
    if (tractor.isActive) return; // tractor is out — no button
    const ctx = this.ctx;
    const cx = tractor.buttonX;
    const cy = tractor.buttonY;
    const r = tractor.buttonRadius;
    const available = tractor.isAvailable;

    // Invite-to-tap pulse glow when available.
    if (available) {
      const pulse = tractor.buttonPulse;
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
    ctx.strokeStyle = available ? TRACTOR_BODY_DARK : 'rgba(120, 140, 160, 0.8)';
    ctx.stroke();
    ctx.restore();

    // Tractor icon inside (dimmed during cooldown), level and facing right.
    this.drawTractorBody(cx - r * 0.12, cy + r * 0.1, r * 1.5, tractor.wheelPhase, available ? 1 : 0.4);

    // Cooldown loading ring.
    if (!available) {
      const progress = tractor.cooldownProgress;
      ctx.save();
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.lineCap = 'round';
      ctx.strokeStyle = TRACTOR_BODY_DARK;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Rain cloud (effect), falling rain, spawn button ──────────────────────────

  drawRainCloud(rain: RainCloudManager): void {
    const alpha = rain.alpha;
    if (alpha <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Rain first so the cloud body sits over the top of the streaks.
    this.drawRainfall(rain, alpha);
    this.drawCloudShape(rain.x, rain.y, rain.size);
    ctx.restore();
  }

  // Procedural downpour: a fixed set of streaks falling within the rain column,
  // their positions derived from the cloud's anim clock so no per-drop state is
  // stored. Clipped to the band below the cloud base.
  private drawRainfall(rain: RainCloudManager, alpha: number): void {
    const ctx = this.ctx;
    const cx = rain.x;
    const half = rain.rainHalfWidth;
    const top = rain.cloudBaseY;
    const bottom = rain.fallBottomY;
    const span = bottom - top;
    if (span <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - half, top, half * 2, span);
    ctx.clip();
    ctx.strokeStyle = RAIN_DROP_COLOR;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha * 0.65;
    for (let i = 0; i < RAIN_DROP_COUNT; i++) {
      const dx = cx - half + this.hash01(i) * half * 2;
      // Each streak loops down the band at a steady rate, offset per-drop so they
      // never fall in lockstep. The +DROP_LENGTH padding lets a drop slide fully
      // off the bottom before re-entering at the top.
      const cycle = span + RAIN_DROP_LENGTH;
      const phase = (rain.animTime * RAIN_DROP_SPEED + this.hash01(i + 101) * cycle) % cycle;
      const dy = top - RAIN_DROP_LENGTH + phase;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - RAIN_DROP_LENGTH * 0.16, dy + RAIN_DROP_LENGTH);
      ctx.stroke();
    }
    ctx.restore();
  }

  // A friendly puffy cloud, centred at (cx, cy) spanning width `w`. A union of
  // lobes filled with one top-lit gradient, a softer flat underside, and a faint
  // outline. Used for both the sky cloud and (smaller) the spawn-button icon.
  private drawCloudShape(cx: number, cy: number, w: number): void {
    const ctx = this.ctx;
    // Lobes as fractions of width — a lumpy top over a flatter base.
    const lobes = [
      { dx: -0.34, dy: 0.06, r: 0.22 },
      { dx: -0.13, dy: -0.10, r: 0.27 },
      { dx: 0.12, dy: -0.13, r: 0.26 },
      { dx: 0.34, dy: 0.02, r: 0.23 },
      { dx: 0.04, dy: 0.14, r: 0.27 },
      { dx: -0.20, dy: 0.16, r: 0.22 },
    ];

    ctx.save();
    ctx.translate(cx, cy);

    const path = new Path2D();
    for (const l of lobes) {
      path.addPath(this.circlePath(l.dx * w, l.dy * w, l.r * w));
    }

    // Soft drop shadow under the cloud for a touch of depth.
    ctx.save();
    ctx.shadowColor = 'rgba(60, 80, 100, 0.28)';
    ctx.shadowBlur = w * 0.06;
    ctx.shadowOffsetY = w * 0.04;
    ctx.fillStyle = RAIN_CLOUD_COLOR;
    ctx.fill(path);
    ctx.restore();

    // Top-lit volume gradient. Filling the unioned lobe path (not stroking each
    // lobe) keeps a smooth puffy silhouette — stroking would draw every lobe's
    // full circle, including the arcs buried inside the cloud, reading as rings.
    const grad = ctx.createLinearGradient(0, -w * 0.34, 0, w * 0.34);
    grad.addColorStop(0, RAIN_CLOUD_LIGHT);
    grad.addColorStop(0.55, RAIN_CLOUD_COLOR);
    grad.addColorStop(1, this.shadeColor(RAIN_CLOUD_COLOR, -0.16));
    ctx.fillStyle = grad;
    ctx.fill(path);

    ctx.restore();
  }

  private circlePath(cx: number, cy: number, r: number): Path2D {
    const p = new Path2D();
    p.arc(cx, cy, r, 0, Math.PI * 2);
    return p;
  }

  // Stable [0,1) pseudo-random from an integer — keeps the raindrops deterministic
  // per frame (their motion comes only from the anim clock, not fresh randomness).
  private hash01(i: number): number {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  drawRainCloudButton(rain: RainCloudManager): void {
    if (rain.isActive) return; // cloud is out — no button
    const ctx = this.ctx;
    const cx = rain.buttonX;
    const cy = rain.buttonY;
    const r = rain.buttonRadius;
    const available = rain.isAvailable;

    // Invite-to-tap pulse glow when available.
    if (available) {
      const pulse = rain.buttonPulse;
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
    ctx.strokeStyle = available ? RAIN_CLOUD_DARK : 'rgba(120, 140, 160, 0.8)';
    ctx.stroke();
    ctx.restore();

    // Cloud icon + a few drops inside (dimmed during cooldown).
    ctx.save();
    ctx.globalAlpha = available ? 1 : 0.4;
    this.drawCloudShape(cx, cy - r * 0.22, r * 1.4);
    ctx.strokeStyle = RAIN_DROP_COLOR;
    ctx.lineWidth = Math.max(2, r * 0.07);
    ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      const dx = cx + k * r * 0.34;
      const dy0 = cy + r * 0.34;
      ctx.beginPath();
      ctx.moveTo(dx, dy0);
      ctx.lineTo(dx - r * 0.06, dy0 + r * 0.3);
      ctx.stroke();
    }
    ctx.restore();

    // Cooldown loading ring.
    if (!available) {
      const progress = rain.cooldownProgress;
      ctx.save();
      ctx.lineWidth = Math.max(3, r * 0.12);
      ctx.lineCap = 'round';
      ctx.strokeStyle = RAIN_CLOUD_DARK;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Excavator: tracked base, cab, articulated arm + bucket ───────────────────

  // The excavator is drawn straight in world space: the tracked base and cab sit
  // around (ex.x, ex.y), and the arm joints (shoulder → elbow → bucket) are already
  // world coordinates from the manager's IK solve, so no rotation is needed here.
  drawExcavator(ex: ExcavatorManager): void {
    const alpha = ex.alpha;
    if (alpha <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    const s = ex.size;
    this.drawExcavatorTracks(ex.x, ex.y, s, ex.trackPhase);
    this.drawExcavatorCab(ex.x, ex.y, s);
    this.drawExcavatorArm(ex, s);
    ctx.restore();
  }

  private drawExcavatorWheel(wx: number, wy: number, wr: number, phase: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = EXCAVATOR_WHEEL_COLOR;
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = EXCAVATOR_BODY_DARK;
    ctx.lineWidth = Math.max(1.5, wr * 0.2);
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = phase + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(a) * wr * 0.78, wy + Math.sin(a) * wr * 0.78);
      ctx.stroke();
    }
    ctx.fillStyle = EXCAVATOR_BODY_COLOR;
    ctx.beginPath();
    ctx.arc(wx, wy, wr * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark stadium track frame with drive sprockets, idler and tread lugs.
  private drawExcavatorTracks(cx: number, cy: number, s: number, phase: number): void {
    const ctx = this.ctx;
    const top = cy + 0.20 * s;
    const bot = cy + 0.46 * s;
    const left = cx - 0.42 * s;
    const right = cx + 0.42 * s;
    const midY = (top + bot) / 2;
    const rad = (bot - top) / 2;

    ctx.fillStyle = EXCAVATOR_TRACK_COLOR;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.arc(right, midY, rad, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(left, bot);
    ctx.arc(left, midY, rad, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();

    // Tread lugs riding along the bottom with the track phase.
    ctx.strokeStyle = EXCAVATOR_WHEEL_COLOR;
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.lineCap = 'butt';
    const span = right - left;
    // Normalise the scroll offset into [0, 1): driving left makes trackPhase
    // negative, and a raw `% 1` would keep the sign and push the first lug past the
    // left cap.
    const off = (((phase * 0.16) % 1) + 1) % 1;
    for (let i = 0; i < 8; i++) {
      const frac = ((i + off) % 8) / 8;
      const lx = left + frac * span;
      ctx.beginPath();
      ctx.moveTo(lx, bot - s * 0.01);
      ctx.lineTo(lx, bot - s * 0.05);
      ctx.stroke();
    }

    this.drawExcavatorWheel(left, midY, rad * 0.9, phase);
    this.drawExcavatorWheel(right, midY, rad * 0.9, phase);
    this.drawExcavatorWheel(cx, midY, rad * 0.6, phase);
  }

  // The slew deck, counterweight, house and operator cab.
  private drawExcavatorCab(cx: number, cy: number, s: number): void {
    const ctx = this.ctx;

    // Slew deck the house rotates on, sitting on the tracks.
    ctx.fillStyle = EXCAVATOR_BODY_DARK;
    this.roundedRectPath(cx - 0.40 * s, cy + 0.10 * s, 0.80 * s, 0.13 * s, 0.03 * s);
    ctx.fill();

    // Counterweight block at the back (left).
    ctx.fillStyle = EXCAVATOR_BODY_DARK;
    this.roundedRectPath(cx - 0.43 * s, cy - 0.08 * s, 0.20 * s, 0.22 * s, 0.03 * s);
    ctx.fill();

    // House body with a top sheen and a lower shade for roundness.
    ctx.fillStyle = EXCAVATOR_BODY_COLOR;
    this.roundedRectPath(cx - 0.36 * s, cy - 0.13 * s, 0.68 * s, 0.25 * s, 0.05 * s);
    ctx.fill();
    ctx.fillStyle = this.shadeColor(EXCAVATOR_BODY_COLOR, 0.2);
    this.roundedRectPath(cx - 0.34 * s, cy - 0.13 * s, 0.42 * s, 0.04 * s, 0.02 * s);
    ctx.fill();
    ctx.fillStyle = EXCAVATOR_BODY_DARK;
    this.roundedRectPath(cx - 0.36 * s, cy + 0.07 * s, 0.68 * s, 0.05 * s, 0.025 * s);
    ctx.fill();

    // Exhaust stack rising from the house top (back).
    ctx.fillStyle = EXCAVATOR_DETAIL_COLOR;
    ctx.fillRect(cx - 0.24 * s, cy - 0.25 * s, 0.03 * s, 0.13 * s);
    this.roundedRectPath(cx - 0.252 * s, cy - 0.275 * s, 0.054 * s, 0.03 * s, 0.012 * s);
    ctx.fill();

    // Operator cab (front-right of the house) with a slanted windshield and glint.
    ctx.fillStyle = EXCAVATOR_CAB_COLOR;
    this.roundedRectPath(cx + 0.06 * s, cy - 0.30 * s, 0.24 * s, 0.30 * s, 0.04 * s);
    ctx.fill();
    ctx.fillStyle = EXCAVATOR_WINDOW_COLOR;
    ctx.beginPath();
    ctx.moveTo(cx + 0.09 * s, cy - 0.04 * s);
    ctx.lineTo(cx + 0.09 * s, cy - 0.22 * s);
    ctx.lineTo(cx + 0.16 * s, cy - 0.27 * s);
    ctx.lineTo(cx + 0.27 * s, cy - 0.27 * s);
    ctx.lineTo(cx + 0.27 * s, cy - 0.04 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.moveTo(cx + 0.13 * s, cy - 0.25 * s);
    ctx.lineTo(cx + 0.19 * s, cy - 0.25 * s);
    ctx.lineTo(cx + 0.12 * s, cy - 0.06 * s);
    ctx.lineTo(cx + 0.09 * s, cy - 0.06 * s);
    ctx.closePath();
    ctx.fill();
  }

  // Boom (shoulder → elbow) and stick (elbow → bucket), each a tapered plate with a
  // dark outline, plus joint pivots, a couple of hydraulic cylinders, and the bucket.
  private drawExcavatorArm(ex: ExcavatorManager, s: number): void {
    const ctx = this.ctx;
    const sx = ex.shoulderX;
    const sy = ex.shoulderY;
    const elx = ex.elbowX;
    const ely = ex.elbowY;
    const bx = ex.bucketX;
    const by = ex.bucketY;

    // Hydraulic cylinders first, so the plates overlap their ends.
    ctx.strokeStyle = EXCAVATOR_DETAIL_COLOR;
    ctx.lineWidth = Math.max(1.5, s * 0.022);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx + 0.02 * s, sy + 0.06 * s);
    ctx.lineTo(elx + (sx - elx) * 0.45, ely + (sy - ely) * 0.45);
    ctx.moveTo(elx, ely);
    ctx.lineTo(bx + (elx - bx) * 0.55, by + (ely - by) * 0.55);
    ctx.stroke();

    this.drawArmSegment(sx, sy, elx, ely, 0.15 * s, 0.11 * s);
    this.drawArmSegment(elx, ely, bx, by, 0.105 * s, 0.075 * s);

    // Joint pivots.
    this.drawArmPivot(sx, sy, 0.075 * s);
    this.drawArmPivot(elx, ely, 0.065 * s);

    this.drawExcavatorBucket(ex, s);
  }

  // A tapered arm plate from (x1,y1) width w1 to (x2,y2) width w2, dark outline
  // under an arm-coloured fill.
  private drawArmSegment(x1: number, y1: number, x2: number, y2: number, w1: number, w2: number): void {
    const ctx = this.ctx;
    const o = Math.max(2, (w1 + w2) * 0.16); // outline thickness
    ctx.fillStyle = EXCAVATOR_ARM_DARK;
    this.armQuadPath(x1, y1, x2, y2, w1 + o, w2 + o);
    ctx.fill();
    ctx.fillStyle = EXCAVATOR_ARM_COLOR;
    this.armQuadPath(x1, y1, x2, y2, w1, w2);
    ctx.fill();
  }

  private armQuadPath(x1: number, y1: number, x2: number, y2: number, w1: number, w2: number): void {
    const ctx = this.ctx;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * 0.5;
    const ny = (dx / len) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
    ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
    ctx.lineTo(x2 - nx * w2, y2 - ny * w2);
    ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
    ctx.closePath();
  }

  private drawArmPivot(x: number, y: number, r: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = EXCAVATOR_ARM_DARK;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EXCAVATOR_ARM_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // The steel scoop at the stick tip — opens downward to bite a balloon from above,
  // tilting toward the stick for a natural wrist and curling in on each chomp.
  private drawExcavatorBucket(ex: ExcavatorManager, s: number): void {
    const ctx = this.ctx;
    const w = 0.34 * s;
    const h = 0.32 * s;
    const tilt = (ex.bucketAngle - Math.PI / 2) * 0.3 - 0.3 * ex.chompPulse;

    ctx.save();
    ctx.translate(ex.bucketX, ex.bucketY);
    ctx.rotate(tilt);

    // Scoop body, opening downward.
    ctx.fillStyle = EXCAVATOR_BUCKET_COLOR;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.08);
    ctx.quadraticCurveTo(-w * 0.62, h * 0.45, -w * 0.18, h * 0.62);
    ctx.lineTo(w * 0.18, h * 0.62);
    ctx.quadraticCurveTo(w * 0.62, h * 0.45, w * 0.5, -h * 0.08);
    ctx.closePath();
    ctx.fill();

    // Curved side shading for depth.
    ctx.fillStyle = EXCAVATOR_BUCKET_DARK;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.08);
    ctx.quadraticCurveTo(-w * 0.62, h * 0.45, -w * 0.18, h * 0.62);
    ctx.lineTo(-w * 0.06, h * 0.62);
    ctx.quadraticCurveTo(-w * 0.42, h * 0.4, -w * 0.34, -h * 0.08);
    ctx.closePath();
    ctx.fill();

    // Hinge plate at the top where the stick attaches.
    ctx.fillStyle = EXCAVATOR_BUCKET_DARK;
    this.roundedRectPath(-w * 0.5, -h * 0.26, w, h * 0.2, h * 0.05);
    ctx.fill();

    // Teeth along the bottom lip.
    ctx.fillStyle = EXCAVATOR_BUCKET_DARK;
    for (let i = -1; i <= 1; i++) {
      const tx = i * w * 0.27;
      ctx.beginPath();
      ctx.moveTo(tx - w * 0.07, h * 0.6);
      ctx.lineTo(tx + w * 0.07, h * 0.6);
      ctx.lineTo(tx, h * 0.6 + h * 0.16);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

}
