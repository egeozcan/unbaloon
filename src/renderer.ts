import {
  BALLOON_HIGHLIGHTS,
  BG_COLOR_TOP,
  BG_COLOR_BOTTOM,
  STRING_LENGTH_RATIO,
  POP_EXPAND_SCALE,
  PARTICLE_LIFETIME,
  RAINBOW_GRADIENT_COLORS,
} from './constants';
import type { Balloon, Particle } from './balloon';

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

}
