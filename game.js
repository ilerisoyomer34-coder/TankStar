// =============================================================================
// TANK RUSH — 2 Cars-inspired mobile tank game
// Controls: Tap left half → left tank | Tap right half → right tank
// Collect stars, dodge mines. Both sides simultaneously!
// =============================================================================

const W = 390;
const H = 844;

const LANE = { L0: 68, L1: 127, R0: 263, R1: 322 };
const TANK_Y   = H - 130;
const HEADER_H = 90;

// Design tokens — Dark Corporate ağırlıklı (P2 dominant, P1 accent, P3 neutral)
const PAL = {
  // ── Backgrounds — koyu navy/yeşil saha ──────────────────────────────────
  bgLeft:       0x162820,  // deep green dark — sol saha
  bgRight:      0x111a25,  // dark navy — sağ saha
  roadLeft:     0x2a4c47,  // Deep Green (P2)
  roadRight:    0x1f3040,  // koyu navy yol
  roadEdgeL:    0x1e3830,  // daha koyu yeşil kenar
  roadEdgeR:    0x151e2c,  // daha koyu navy kenar

  // ── Sol tank — Teal Light (koyu zeminde parlak) ───────────────────────
  tankLBody:    0x58b6b8,  // Teal Light (P1)
  tankLDark:    0x357172,  // Petrol Teal (P4)
  tankLLight:   0xb0f5ed,  // Mint Accent (P1)
  tankLTrack:   0x2a4c47,  // Deep Green (P2)

  // ── Sağ tank — Gold Accent (sıcak, koyu zeminde çarpıcı) ─────────────
  tankRBody:    0xc28d3a,  // Gold Accent (P2)
  tankRDark:    0x8a6020,  // koyu altın
  tankRLight:   0xe8d080,  // açık altın
  tankRTrack:   0x3d3c39,  // Dark Gray (P3)

  // ── Yakıt bidonu — Gold (topla = değerli) ────────────────────────────
  fuelBody:     0xc28d3a,  // Gold Accent (P2)
  fuelDark:     0x8a6020,  // koyu altın
  fuelLight:    0xe8d080,  // açık altın
  fuelCap:      0xb8a342,  // Soft Gold (P2)
  fuelHandle:   0x1f2831,  // Dark Navy
  fuelStripe:   0xb8a342,  // Soft Gold

  // ── Hedgehog — Neutral, koyu zeminde görünür ──────────────────────────
  hedgeBeam:    0xb3bcbd,  // Light Gray (P3) — koyu zeminde kontrast
  hedgeDark:    0x3d3c39,  // Dark Gray (P3)
  hedgeLight:   0xdde4e6,  // açık gri
  hedgeCenter:  0x506866,  // Slate Green (P3)
  hedgeRivet:   0xf0f4f5,  // neredeyse beyaz

  // ── UI — Dark Corporate core ──────────────────────────────────────────
  divider:      0x357172,  // Petrol Teal
  header:       0x0d1117,  // neredeyse siyah navy
  headerLine:   0x2a4c47,  // Deep Green
  uiBadge:      0x2a4c47,  // Deep Green (P2) — kartlar

  // ── Text ──────────────────────────────────────────────────────────────
  textDark:     0xffffff,
  textMed:      0xb3bcbd,  // Light Gray (P3)
  textLight:    0x506866,  // Slate Green (P3)
};

// =============================================================================
// SOUND & VIBRATION MANAGER (Web Audio API — no external files needed)
// =============================================================================
const SFX = {
  _ctx: null,

  _getCtx() {
    if (!this._ctx) {
      try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  },

  // Soft tone: sine oscilator + low-pass filter + gentle ADSR envelope
  _soft(freq, endFreq, vol, attack, sustain, release, startOffset = 0) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + startOffset;

    const osc    = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Always sine for softness
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq)
      osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t0 + attack + sustain);

    // Low-pass smooths any harshness
    filter.type            = 'lowpass';
    filter.frequency.value = 1800;
    filter.Q.value         = 0.5;

    // ADSR: quick attack, hold, soft fade-out
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol,  t0 + attack);
    gain.gain.setValueAtTime(vol,            t0 + attack + sustain);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + sustain + release);

    const total = attack + sustain + release + 0.02;
    osc.start(t0);
    osc.stop(t0 + total);
  },

  collect() {
    // Two soft rising notes — like a gentle chime
    this._soft(523, 659, 0.18, 0.01, 0.04, 0.14);          // C5 → E5
    this._soft(659, 784, 0.12, 0.01, 0.03, 0.12, 0.07);    // E5 → G5
  },

  switch() {
    // Very subtle soft click — barely audible
    this._soft(440, 460, 0.07, 0.005, 0.01, 0.06);
  },

  hit() {
    // Low soft thud — muffled drum feel
    this._soft(180, 80,  0.22, 0.005, 0.03, 0.20);
    this._soft(120, 60,  0.12, 0.01,  0.02, 0.16, 0.03);
    if (navigator.vibrate) navigator.vibrate([40, 15, 40]);
  },

  miss() {
    // Soft descending tone
    this._soft(440, 330, 0.14, 0.01, 0.03, 0.18);
    if (navigator.vibrate) navigator.vibrate([25]);
  },

  gameOver() {
    // Three soft descending notes
    this._soft(392, 330, 0.18, 0.01, 0.06, 0.20, 0.00);   // G4 → E4
    this._soft(330, 262, 0.15, 0.01, 0.06, 0.20, 0.22);   // E4 → C4
    this._soft(262, 196, 0.13, 0.01, 0.08, 0.30, 0.44);   // C4 → G3
    if (navigator.vibrate) navigator.vibrate([60, 30, 60, 30, 120]);
  },
};

// Helper: draw 5-pointed star polygon
function starPoly(cx, cy, outerR, innerR) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}

// =============================================================================
// BOOT SCENE — programmatic texture generation
// =============================================================================
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.makeTank('tank_body_left',  PAL.tankLBody, PAL.tankLDark, PAL.tankLLight, PAL.tankLTrack);
    this.makeTank('tank_body_right', PAL.tankRBody, PAL.tankRDark, PAL.tankRLight, PAL.tankRTrack);
    this.makeBarrel('barrel_left',   PAL.tankLDark, PAL.tankLLight);
    this.makeBarrel('barrel_right',  PAL.tankRDark, PAL.tankRLight);
    this.makeFuelCan();
    this.makeHedgehog();
    this.makeTankIcon('tank_icon', PAL.tankLBody, PAL.tankLDark, PAL.tankLTrack);
    this.scene.start('Menu');
  }

  makeTank(key, body, dark, light, track) {
    const g = this.make.graphics({ add: false });
    const W = 64, H = 80;

    // — Drop shadow —
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(35, 74, 52, 14);

    // — Tracks —
    g.fillStyle(track);
    g.fillRoundedRect(1,  6, 13, 64, 5);
    g.fillRoundedRect(50, 6, 13, 64, 5);

    // Track links (horizontal grooves)
    g.fillStyle(0x000000, 0.25);
    for (let y = 9; y < 68; y += 9) {
      g.fillRect(2,  y, 11, 2);
      g.fillRect(51, y, 11, 2);
    }

    // — Hull body —
    g.fillStyle(dark);
    g.fillRoundedRect(12, 4, 40, 68, 9);   // shadow base

    g.fillStyle(body);
    g.fillRoundedRect(12, 2, 40, 66, 9);   // main hull

    // Hull highlight strip (top-left bevel)
    g.fillStyle(light, 0.55);
    g.fillRoundedRect(14, 4, 22, 12, 4);

    // Hull bottom shadow strip
    g.fillStyle(dark, 0.4);
    g.fillRoundedRect(12, 54, 40, 14, 9);

    // — Turret ring (raised rim) —
    g.fillStyle(dark);
    g.fillCircle(32, 38, 17);

    g.fillStyle(body);
    g.fillCircle(32, 38, 14);

    // Turret highlight
    g.fillStyle(light, 0.6);
    g.fillCircle(28, 34, 6);

    // Turret hatch
    g.fillStyle(dark);
    g.fillCircle(32, 38, 6);

    g.fillStyle(body);
    g.fillCircle(32, 38, 3);

    // Hatch rivets
    g.fillStyle(dark);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      g.fillCircle(32 + Math.cos(a) * 9, 38 + Math.sin(a) * 9, 2);
    }

    g.generateTexture(key, W, H);
    g.destroy();
  }

  makeBarrel(key, dark, light) {
    const g = this.make.graphics({ add: false });

    // Barrel shadow
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(4, 2, 9, 34, 3);

    // Main shaft (tapered)
    g.fillStyle(dark);
    g.fillRoundedRect(2, 0, 10, 32, 4);

    // Muzzle brake
    g.fillStyle(dark);
    g.fillRoundedRect(0, 0, 14, 8, 3);
    g.fillRoundedRect(0, 10, 14, 5, 2);

    // Shaft highlight
    g.fillStyle(light, 0.5);
    g.fillRoundedRect(3, 2, 4, 26, 2);

    g.generateTexture(key, 14, 34);
    g.destroy();
  }

  makeFuelCan() {
    // 2× resolution → rendered at 88×88, displayed at 0.5 scale = crisp on Retina
    const g  = this.make.graphics({ add: false });
    const cx = 44, cy = 44;

    // Drop shadow
    g.fillStyle(0x000000, 0.20);
    g.fillEllipse(cx + 6, cy + 36, 60, 20);

    // Body outer rim (shadow)
    g.fillStyle(PAL.fuelDark);
    g.fillRoundedRect(cx - 28, cy - 36, 56, 72, 10);

    // Body main
    g.fillStyle(PAL.fuelBody);
    g.fillRoundedRect(cx - 26, cy - 34, 52, 68, 10);

    // Ribbed pressed lines (3 grooves)
    g.fillStyle(PAL.fuelDark, 0.40);
    g.fillRect(cx - 26, cy - 16, 52, 6);
    g.fillRect(cx - 26, cy + 2,  52, 6);
    g.fillRect(cx - 26, cy + 20, 52, 6);

    // Warning stripe (center band)
    g.fillStyle(PAL.fuelStripe, 0.80);
    g.fillRect(cx - 26, cy - 6, 52, 12);

    // Stripe text line (decorative thin mark)
    g.fillStyle(PAL.fuelDark, 0.3);
    g.fillRect(cx - 22, cy - 1, 44, 2);

    // Handle (dark bar at top)
    g.fillStyle(PAL.fuelHandle);
    g.fillRoundedRect(cx - 16, cy - 40, 32, 12, 6);
    // Handle highlight
    g.fillStyle(0xffffff, 0.25);
    g.fillRoundedRect(cx - 14, cy - 38, 28, 4, 4);

    // Fuel cap
    g.fillStyle(PAL.fuelDark);
    g.fillCircle(cx, cy - 12, 10);
    g.fillStyle(PAL.fuelCap);
    g.fillCircle(cx, cy - 12, 7);
    // Cap thread ring
    g.lineStyle(2, PAL.fuelDark, 0.5);
    g.strokeCircle(cx, cy - 12, 9);
    // Cap shine
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(cx - 2, cy - 14, 3);

    // Body shine highlight
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(cx - 10, cy - 18, 18, 28);

    g.generateTexture('fuel', 88, 88);
    g.destroy();
  }

  makeHedgehog() {
    // 2× resolution → rendered at 88×88, displayed at 0.5 scale = crisp on Retina
    const g  = this.make.graphics({ add: false });
    const cx = 44, cy = 44;

    const rotRect = (w, h, angleDeg) => {
      const a = angleDeg * Math.PI / 180;
      const c = Math.cos(a), s = Math.sin(a);
      const hw = w / 2, hh = h / 2;
      return [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]].map(([x, y]) =>
        new Phaser.Math.Vector2(cx + x*c - y*s, cy + x*s + y*c)
      );
    };

    // Drop shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx + 5, cy + 6, 72, 28);

    // Three I-beams at 0°, 60°, 120°
    [0, 60, 120].forEach(angle => {
      g.fillStyle(PAL.hedgeDark);
      g.fillPoints(rotRect(20, 80, angle), true);
      g.fillStyle(PAL.hedgeBeam);
      g.fillPoints(rotRect(16, 76, angle), true);
      // Side bevels (bright edge on each beam)
      g.fillStyle(PAL.hedgeLight, 0.50);
      g.fillPoints(rotRect(4, 70, angle), true);
    });

    // Center junction plate
    g.fillStyle(PAL.hedgeDark);
    g.fillCircle(cx, cy, 18);
    g.fillStyle(PAL.hedgeCenter);
    g.fillCircle(cx, cy, 14);
    // Plate shine
    g.fillStyle(PAL.hedgeLight, 0.35);
    g.fillCircle(cx - 3, cy - 3, 6);

    // Rivets at each beam tip
    [0, 60, 120, 180, 240, 300].forEach(angle => {
      const a  = angle * Math.PI / 180;
      const rx = cx + Math.cos(a) * 34;
      const ry = cy + Math.sin(a) * 34;
      g.fillStyle(PAL.hedgeDark);
      g.fillCircle(rx, ry, 7);
      g.fillStyle(PAL.hedgeRivet);
      g.fillCircle(rx - 1.5, ry - 1.5, 4);
    });

    // Center bolt
    g.fillStyle(PAL.hedgeDark);
    g.fillCircle(cx, cy, 7);
    g.fillStyle(PAL.hedgeRivet);
    g.fillCircle(cx - 1.5, cy - 1.5, 3.5);

    g.generateTexture('hedgehog', 88, 88);
    g.destroy();
  }

  makeTankIcon(key, body, dark, track) {
    const g = this.make.graphics({ add: false });
    // Tracks
    g.fillStyle(track);
    g.fillRoundedRect(0, 1, 6, 22, 2);
    g.fillRoundedRect(22, 1, 6, 22, 2);
    // Hull
    g.fillStyle(dark);
    g.fillRoundedRect(5, 0, 18, 24, 4);
    g.fillStyle(body);
    g.fillRoundedRect(5, 0, 17, 22, 4);
    // Turret
    g.fillStyle(dark);
    g.fillCircle(14, 11, 7);
    g.fillStyle(body);
    g.fillCircle(14, 11, 5);
    // Barrel
    g.fillStyle(dark);
    g.fillRect(13, 1, 3, 10);
    g.generateTexture(key, 28, 24);
    g.destroy();
  }
}

// =============================================================================
// MENU SCENE
// =============================================================================
class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    // Backgrounds
    this.add.rectangle(W * 0.25, H * 0.5, W * 0.5, H, PAL.bgLeft);
    this.add.rectangle(W * 0.75, H * 0.5, W * 0.5, H, PAL.bgRight);

    // Road strips
    [LANE.L0, LANE.L1].forEach(x => this.add.rectangle(x, H * 0.5, 54, H, PAL.roadLeft));
    [LANE.R0, LANE.R1].forEach(x => this.add.rectangle(x, H * 0.5, 54, H, PAL.roadRight));

    // Center divider (thick white stripe)
    this.add.rectangle(W * 0.5, H * 0.5, 7, H, PAL.divider);
    this.add.rectangle(W * 0.5, H * 0.5, 3, H, 0xb0f5ed);

    // Title backdrop
    const titleBg = this.add.rectangle(W / 2, 210, 305, 132, PAL.uiBadge, 0.88);
    titleBg.setStrokeStyle(3, PAL.tankLBody);

    this.add.text(W / 2, 188, 'TANK', {
      fontSize: '58px', fontFamily: 'Arial Black, Arial',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(W / 2, 248, 'RUSH', {
      fontSize: '40px', fontFamily: 'Arial Black, Arial',
      color: '#b0f5ed', fontStyle: 'bold',
      letterSpacing: 10,
    }).setOrigin(0.5);

    // Tank showcase
    const lShadow = this.add.ellipse(W * 0.25 + 3, 448, 76, 20, 0x000000, 0.2);
    const rShadow = this.add.ellipse(W * 0.75 + 3, 448, 76, 20, 0x000000, 0.2);
    const lBody   = this.add.image(W * 0.25, 420, 'tank_body_left').setScale(1.7);
    const lBarrel = this.add.image(W * 0.25, 395, 'barrel_left').setScale(1.7).setOrigin(0.5, 1);
    const rBody   = this.add.image(W * 0.75, 420, 'tank_body_right').setScale(1.7);
    const rBarrel = this.add.image(W * 0.75, 395, 'barrel_right').setScale(1.7).setOrigin(0.5, 1);

    // Idle barrel sway
    this.tweens.add({
      targets: [lBarrel, rBarrel], angle: { from: -8, to: 8 },
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    // Subtle hover
    this.tweens.add({
      targets: [lBody, lBarrel, lShadow, rBody, rBarrel, rShadow],
      y: '-=6', duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Best score badge
    const best = localStorage.getItem('tankRushBest') || 0;
    const bestBg = this.add.rectangle(W / 2, 530, 180, 42, PAL.uiBadge, 0.75);
    bestBg.setStrokeStyle(2, 0xc28d3a);
    this.add.text(W / 2, 530, `⭐  EN İYİ: ${best}`, {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#C28D3A',
    }).setOrigin(0.5);

    // Tap to play pill button
    const tapBg = this.add.rectangle(W / 2, 620, 248, 52, PAL.tankLBody);
    tapBg.setStrokeStyle(3, 0xffffff, 0.7);
    const tapTxt = this.add.text(W / 2, 620, 'OYNAMAK İÇİN DOKUN', {
      fontSize: '16px', fontFamily: 'Arial Black, Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.tweens.add({ targets: [tapBg, tapTxt], alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });

    // Controls hint
    this.add.text(W * 0.25, 730, '◀  ▶\nSol Tank', {
      fontSize: '17px', fontFamily: 'Arial', color: '#' + PAL.tankLDark.toString(16).padStart(6,'0'),
      align: 'center',
    }).setOrigin(0.5);
    this.add.text(W * 0.75, 730, '◀  ▶\nSağ Tank', {
      fontSize: '17px', fontFamily: 'Arial', color: '#' + PAL.tankRDark.toString(16).padStart(6,'0'),
      align: 'center',
    }).setOrigin(0.5);

    this.input.once('pointerdown', () => {
      this.cameras.main.fadeOut(220);
      this.time.delayedCall(220, () => this.scene.start('Game'));
    });
    this.cameras.main.fadeIn(380);
  }
}

// =============================================================================
// GAME SCENE
// =============================================================================
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.score      = 0;
    this.lives      = 3;
    this.level      = 1;
    this.fallSpeed  = 195;
    this.spawnDelay = 1350;
    this.isOver     = false;
    this.leftLane   = 0;
    this.rightLane  = 0;
    this.objects    = [];

    this.buildBackground();
    this.buildRoadMarks();
    this.buildTanks();
    this.buildUI();
    this.buildInput();
    this.startSpawner();

    this.time.addEvent({
      delay: 6000, callback: this.escalate, callbackScope: this, loop: true,
    });
    this.cameras.main.fadeIn(280);
  }

  // ── Background ─────────────────────────────────────────────────────────────

  buildBackground() {
    this.add.rectangle(W * 0.25, H * 0.5, W * 0.5, H, PAL.bgLeft);
    this.add.rectangle(W * 0.75, H * 0.5, W * 0.5, H, PAL.bgRight);

    // Road edges (darker strips framing each lane)
    [LANE.L0, LANE.L1].forEach(x => {
      this.add.rectangle(x, HEADER_H + (H - HEADER_H) / 2, 58, H - HEADER_H, PAL.roadEdgeL);
      this.add.rectangle(x, HEADER_H + (H - HEADER_H) / 2, 52, H - HEADER_H, PAL.roadLeft);
    });
    [LANE.R0, LANE.R1].forEach(x => {
      this.add.rectangle(x, HEADER_H + (H - HEADER_H) / 2, 58, H - HEADER_H, PAL.roadEdgeR);
      this.add.rectangle(x, HEADER_H + (H - HEADER_H) / 2, 52, H - HEADER_H, PAL.roadRight);
    });

    // Statik shoulder lines (sabit, hareket etmez)
    const gfx = this.add.graphics();
    gfx.lineStyle(2, 0xffffff, 0.22);
    [LANE.L0 - 29, LANE.L1 + 29, LANE.R0 - 29, LANE.R1 + 29].forEach(x => {
      gfx.moveTo(x, HEADER_H); gfx.lineTo(x, H);
    });
    gfx.strokePath();

    // Hareketli yol çizgileri buildRoadMarks() ile oluşturuluyor

    // Center divider — bold white stripe
    this.add.rectangle(W * 0.5, HEADER_H + (H - HEADER_H) * 0.5, 8, H - HEADER_H, PAL.divider);
    this.add.rectangle(W * 0.5, HEADER_H + (H - HEADER_H) * 0.5, 3, H - HEADER_H, 0xb0f5ed);

    // Header
    this.add.rectangle(W * 0.5, HEADER_H * 0.5, W, HEADER_H, PAL.header);
    // Colored left/right accent in header
    this.add.rectangle(W * 0.25, HEADER_H * 0.5, W * 0.5, HEADER_H, PAL.tankLBody, 0.08);
    this.add.rectangle(W * 0.75, HEADER_H * 0.5, W * 0.5, HEADER_H, PAL.tankRBody, 0.08);
    this.add.rectangle(W * 0.5, HEADER_H, W, 3, PAL.headerLine);
  }

  // ── Hareketli yol çizgileri ────────────────────────────────────────────────

  buildRoadMarks() {
    const DASH_H   = 22;   // çizgi yüksekliği
    const DASH_GAP = 14;   // çizgiler arası boşluk
    const CYCLE    = DASH_H + DASH_GAP;
    const COUNT    = Math.ceil((H - HEADER_H) / CYCLE) + 2;

    const lMid = (LANE.L0 + LANE.L1) / 2;  // sol bölücü x
    const rMid = (LANE.R0 + LANE.R1) / 2;  // sağ bölücü x

    this._dashCycle = CYCLE;
    this._dashCount = COUNT;
    this._dashMarks = [];

    for (let i = 0; i < COUNT; i++) {
      const y = HEADER_H + i * CYCLE;

      // Merkez bölücü çizgiler
      this._dashMarks.push(
        this.add.rectangle(lMid, y, 3, DASH_H, 0xffffff, 0.60).setDepth(2),
        this.add.rectangle(rMid, y, 3, DASH_H, 0xffffff, 0.60).setDepth(2),
      );

      // Yol kenar tick'leri (her 2 cycle'da bir — görsel zenginlik)
      if (i % 2 === 0) {
        const tickH = 10, tickA = 0.22;
        this._dashMarks.push(
          this.add.rectangle(LANE.L0 - 25, y, 2, tickH, 0xffffff, tickA).setDepth(2),
          this.add.rectangle(LANE.L1 + 25, y, 2, tickH, 0xffffff, tickA).setDepth(2),
          this.add.rectangle(LANE.R0 - 25, y, 2, tickH, 0xffffff, tickA).setDepth(2),
          this.add.rectangle(LANE.R1 + 25, y, 2, tickH, 0xffffff, tickA).setDepth(2),
        );
      }
    }
  }

  // ── Tanks ─────────────────────────────────────────────────────────────────

  buildTanks() {
    this.leftTank  = this.createTank(LANE.L0, TANK_Y, 'tank_body_left',  'barrel_left');
    this.rightTank = this.createTank(LANE.R0, TANK_Y, 'tank_body_right', 'barrel_right');

    // Shadow for each tank
    this.leftShadow  = this.add.ellipse(LANE.L0 + 3, TANK_Y + 26, 42, 11, 0x000000, 0.22).setDepth(3);
    this.rightShadow = this.add.ellipse(LANE.R0 + 3, TANK_Y + 26, 42, 11, 0x000000, 0.22).setDepth(3);

    [this.leftTank.barrel, this.rightTank.barrel].forEach(b => {
      this.tweens.add({
        targets: b, angle: { from: -5, to: 5 },
        duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    });
  }

  createTank(x, y, bodyKey, barrelKey) {
    const c      = this.add.container(x, y).setDepth(5);
    const body   = this.add.image(0, 2, bodyKey).setOrigin(0.5, 0.5).setScale(0.72);
    const barrel = this.add.image(0, -11, barrelKey).setOrigin(0.5, 1).setScale(0.72);
    c.add([body, barrel]);
    c.barrel = barrel;
    return c;
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  buildUI() {
    // Score badge
    const scoreBadge = this.add.rectangle(W / 2, HEADER_H / 2, 110, 52, PAL.uiBadge, 0.85).setDepth(10);
    scoreBadge.setStrokeStyle(2, 0x34495e);

    this.scoreTxt = this.add.text(W / 2, HEADER_H / 2 + 2, '0', {
      fontSize: '42px', fontFamily: 'Arial Black, Arial',
      color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    // Lives — tank icons (left)
    this.lifeIcons = [];
    for (let i = 0; i < 3; i++) {
      const icon = this.add.image(16 + i * 32, HEADER_H / 2, 'tank_icon')
        .setOrigin(0, 0.5).setScale(0.88).setDepth(10);
      this.lifeIcons.push(icon);
    }

    // Level badge (right)
    this.add.rectangle(W - 52, HEADER_H / 2, 72, 34, PAL.uiBadge, 0.75).setDepth(10);
    this.levelTxt = this.add.text(W - 52, HEADER_H / 2, 'SEV.1', {
      fontSize: '17px', fontFamily: 'Arial Black, Arial', color: '#B0F5ED',
    }).setOrigin(0.5).setDepth(11);

    // Combo text (center, hidden)
    this.comboTxt = this.add.text(W / 2, H * 0.42, '', {
      fontSize: '44px', fontFamily: 'Arial Black, Arial', color: '#C28D3A',
      fontStyle: 'bold', stroke: '#B44123', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0).setDepth(15);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  buildInput() {
    this.input.on('pointerdown', (ptr) => {
      if (this.isOver) return;
      if (ptr.x < W / 2) this.switchLane('left');
      else               this.switchLane('right');
    });
  }

  switchLane(side) {
    SFX.switch();
    if (side === 'left') {
      this.leftLane = 1 - this.leftLane;
      const tx = this.leftLane === 0 ? LANE.L0 : LANE.L1;
      this.tweens.add({ targets: this.leftTank, x: tx, duration: 95, ease: 'Quad.easeOut' });
      this.leftShadow.x = tx + 3;
    } else {
      this.rightLane = 1 - this.rightLane;
      const tx = this.rightLane === 0 ? LANE.R0 : LANE.R1;
      this.tweens.add({ targets: this.rightTank, x: tx, duration: 95, ease: 'Quad.easeOut' });
      this.rightShadow.x = tx + 3;
    }
    // Ripple flash
    const fx = side === 'left' ? W * 0.25 : W * 0.75;
    const flash = this.add.rectangle(fx, H * 0.5, W * 0.5, H, 0xffffff, 0.14).setDepth(12);
    this.tweens.add({ targets: flash, alpha: 0, duration: 110, onComplete: () => flash.destroy() });
  }

  // ── Spawner ───────────────────────────────────────────────────────────────

  startSpawner() {
    this.spawnEvent = this.time.addEvent({
      delay: this.spawnDelay, callback: this.spawnWave, callbackScope: this, loop: true,
    });
  }

  spawnWave() {
    if (this.isOver) return;
    const lStar = Math.random() < 0.5 ? 0 : 1;
    const rStar = Math.random() < 0.5 ? 0 : 1;

    // Sol taraf hemen çıkar
    this.spawnObj(lStar === 0 ? LANE.L0 : LANE.L1, 'fuel',     'left',  lStar);
    this.spawnObj(lStar === 0 ? LANE.L1 : LANE.L0, 'hedgehog', 'left',  1 - lStar);

    // Sağ taraf rastgele 200-550ms sonra çıkar → aynı hizada olmaz
    const offset = 200 + Math.random() * 350;
    this.time.delayedCall(offset, () => {
      if (this.isOver) return;
      this.spawnObj(rStar === 0 ? LANE.R0 : LANE.R1, 'fuel',     'right', rStar);
      this.spawnObj(rStar === 0 ? LANE.R1 : LANE.R0, 'hedgehog', 'right', 1 - rStar);
    });
  }

  spawnObj(x, type, side, laneIdx) {
    // Textures are 2× — scale 0.5 = 1:1, fuel slightly smaller
    const baseScale = type === 'fuel' ? 0.40 : 0.50;
    const img = this.add.image(x, HEADER_H - 24, type).setDepth(6).setScale(baseScale);
    if (type === 'fuel') {
      this.tweens.add({ targets: img, scale: baseScale * 1.12, duration: 380, yoyo: true, repeat: -1 });
    } else {
      this.tweens.add({ targets: img, angle: 360, duration: 850, repeat: -1 });
    }
    this.objects.push({ img, type, side, laneIdx, processed: false });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  update(_, delta) {
    if (this.isOver) return;
    const move = (this.fallSpeed * delta) / 1000;

    // ── Yol çizgilerini kaydır ──────────────────────────────────────────
    const wrapBack = this._dashCount * this._dashCycle;
    for (const m of this._dashMarks) {
      m.y += move;
      if (m.y > H + 15) m.y -= wrapBack;
    }

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      obj.img.y += move;

      if (!obj.processed && obj.img.y >= TANK_Y - 24) {
        obj.processed = true;
        const tankLane = obj.side === 'left' ? this.leftLane : this.rightLane;
        const tank     = obj.side === 'left' ? this.leftTank  : this.rightTank;

        if (obj.type === 'fuel') {
          if (obj.laneIdx === tankLane) this.onCollect(obj.img);
          else                          this.onMiss(tank);
        } else {
          if (obj.laneIdx === tankLane) this.onHit(tank, obj.img);
        }
      }

      if (obj.img.y > H + 60) {
        obj.img.destroy();
        this.objects.splice(i, 1);
      }
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────

  onCollect(img) {
    this.score++;
    this.scoreTxt.setText(this.score.toString());
    this.tweens.killTweensOf(this.scoreTxt);
    this.tweens.add({ targets: this.scoreTxt, scale: 1.4, duration: 70, yoyo: true });

    // Floating score +1
    const pop = this.add.text(img.x, img.y, '+1', {
      fontSize: '28px', fontFamily: 'Arial Black', color: '#C28D3A',
      stroke: '#B44123', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(14);
    this.tweens.add({
      targets: pop, y: pop.y - 55, alpha: 0, duration: 600, ease: 'Cubic.easeOut',
      onComplete: () => pop.destroy(),
    });

    SFX.collect();
    this.burst(img.x, img.y, PAL.fuelBody, PAL.fuelStripe, 8);
    img.destroy();
  }

  onMiss(tank) {
    SFX.miss();
    this.cameras.main.shake(130, 0.007);
    this.flashTank(tank, 0xffd740, 0.5);
    this.loseLife();
  }

  onHit(tank, img) {
    SFX.hit();
    this.cameras.main.shake(280, 0.022);
    this.cameras.main.flash(160, 255, 60, 60, false);
    this.flashTank(tank, 0xff1744, 0.65);
    this.burst(img.x, img.y, PAL.hedgeBeam, PAL.hedgeDark, 12);
    img.destroy();
    this.loseLife();
  }

  flashTank(tank, color, alpha) {
    const f = this.add.rectangle(tank.x, tank.y, 66, 76, color, alpha).setDepth(8);
    this.tweens.add({
      targets: f, alpha: 0, scale: 1.5, duration: 320, ease: 'Cubic.easeOut',
      onComplete: () => f.destroy(),
    });
  }

  loseLife() {
    this.lives = Math.max(0, this.lives - 1);
    const icon = this.lifeIcons[this.lives];
    if (icon) {
      this.tweens.add({ targets: icon, alpha: 0.15, scaleX: 0.4, scaleY: 0.4, duration: 200 });
    }
    if (this.lives <= 0) this.endGame();
  }

  burst(x, y, color1, color2, count) {
    for (let i = 0; i < count; i++) {
      const c = i % 2 === 0 ? color1 : color2;
      const p = this.add.circle(x, y, 5 + Math.random() * 3, c).setDepth(9);
      const a = (i / count) * Math.PI * 2;
      const d = 28 + Math.random() * 22;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        alpha: 0, scale: 0, duration: 380, ease: 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  escalate() {
    if (this.isOver) return;
    this.level++;
    this.fallSpeed  = Math.min(this.fallSpeed + 18, 390);
    this.spawnDelay = Math.max(this.spawnDelay - 70, 680);
    this.spawnEvent.delay = this.spawnDelay;
    this.levelTxt.setText(`SEV.${this.level}`);

    const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0.1).setDepth(13);
    this.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
  }

  endGame() {
    this.isOver = true;
    this.spawnEvent.destroy();

    const best = parseInt(localStorage.getItem('tankRushBest') || 0);
    if (this.score > best) localStorage.setItem('tankRushBest', this.score);

    SFX.gameOver();
    [this.leftTank, this.rightTank].forEach(t => {
      this.burst(t.x, t.y, PAL.hedgeBeam, PAL.fuelBody, 16);
      this.tweens.add({ targets: t, alpha: 0, scaleX: 0.05, scaleY: 0.05, duration: 380 });
    });
    [this.leftShadow, this.rightShadow].forEach(s =>
      this.tweens.add({ targets: s, alpha: 0, duration: 380 })
    );

    this.cameras.main.shake(420, 0.025);
    this.time.delayedCall(680, () => this.scene.start('GameOver', { score: this.score }));
  }
}

// =============================================================================
// GAME OVER SCENE
// =============================================================================
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }
  init(data) { this.finalScore = data.score || 0; }

  create() {
    this.add.rectangle(W * 0.25, H * 0.5, W * 0.5, H, PAL.bgLeft);
    this.add.rectangle(W * 0.75, H * 0.5, W * 0.5, H, PAL.bgRight);
    [LANE.L0, LANE.L1].forEach(x => this.add.rectangle(x, H * 0.5, 52, H, PAL.roadLeft));
    [LANE.R0, LANE.R1].forEach(x => this.add.rectangle(x, H * 0.5, 52, H, PAL.roadRight));
    this.add.rectangle(W * 0.5, H * 0.5, 8, H, PAL.divider);
    // Dark overlay
    this.add.rectangle(W * 0.5, H * 0.5, W, H, 0x0a0f1a, 0.72);

    // GAME OVER card
    const card = this.add.rectangle(W / 2, 265, 310, 160, PAL.uiBadge, 0.92);
    card.setStrokeStyle(3, PAL.hedgeDark).setScale(0);
    this.tweens.add({ targets: card, scale: 1, duration: 420, ease: 'Back.easeOut' });

    const goTxt = this.add.text(W / 2, 238, 'GAME', {
      fontSize: '66px', fontFamily: 'Arial Black, Arial', color: '#DF532C',
      fontStyle: 'bold', stroke: '#B44123', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    const overTxt = this.add.text(W / 2, 295, 'OVER', {
      fontSize: '66px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      fontStyle: 'bold', stroke: '#1F2831', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [goTxt, overTxt], alpha: 1, duration: 300, delay: 200 });

    // Score area
    const scoreBg = this.add.rectangle(W / 2, 458, 250, 130, PAL.uiBadge, 0.85);
    scoreBg.setStrokeStyle(2, 0x2a4c47).setAlpha(0);
    this.tweens.add({ targets: scoreBg, alpha: 1, duration: 300, delay: 350 });

    const skorLabel = this.add.text(W / 2, 415, 'SKOR', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#B3BCBD',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: skorLabel, alpha: 1, duration: 280, delay: 350 });

    const scoreTxt = this.add.text(W / 2, 468, this.finalScore.toString(), {
      fontSize: '68px', fontFamily: 'Arial Black, Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setAlpha(0);

    this.tweens.add({ targets: scoreTxt, alpha: 1, duration: 280, delay: 400 });

    // Best / new record
    const best = parseInt(localStorage.getItem('tankRushBest') || 0);
    if (this.finalScore > 0 && this.finalScore >= best) {
      const rec = this.add.text(W / 2, 564, '⭐  YENİ REKOR!  ⭐', {
        fontSize: '28px', fontFamily: 'Arial Black', color: '#C28D3A',
        stroke: '#B44123', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: rec, alpha: 1, duration: 300, delay: 600 });
      this.tweens.add({ targets: rec, y: rec.y - 7, duration: 700, yoyo: true, repeat: -1, delay: 1000 });
    } else {
      const bestTxt = this.add.text(W / 2, 564, `EN İYİ: ${best}`, {
        fontSize: '22px', fontFamily: 'Arial', color: '#506866',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: bestTxt, alpha: 1, duration: 300, delay: 500 });
    }

    // Play Again button
    const btn = this.add.rectangle(W / 2, 660, 240, 62, PAL.tankLBody)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(3, 0xffffff, 0.5)
      .setAlpha(0);
    const btnTxt = this.add.text(W / 2, 660, 'TEKRAR OYNA', {
      fontSize: '26px', fontFamily: 'Arial Black', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [btn, btnTxt], alpha: 1, duration: 280, delay: 500 });

    btn.on('pointerover', () => btn.setFillColor(PAL.tankLDark));
    btn.on('pointerout',  () => btn.setFillColor(PAL.tankLBody));
    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(220);
      this.time.delayedCall(220, () => this.scene.start('Game'));
    });

    // Menu button
    const menuBtn = this.add.rectangle(W / 2, 748, 160, 44, 0x1f2831)
      .setInteractive({ useHandCursor: true }).setAlpha(0);
    const menuTxt = this.add.text(W / 2, 748, 'ANA MENÜ', {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#B3BCBD',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: [menuBtn, menuTxt], alpha: 1, duration: 280, delay: 550 });
    menuBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(220);
      this.time.delayedCall(220, () => this.scene.start('Menu'));
    });

    this.cameras.main.fadeIn(300);
  }
}

// =============================================================================
// PHASER CONFIG
// =============================================================================
new Phaser.Game({
  type: Phaser.WEBGL,
  width: W,
  height: H,
  backgroundColor: '#0d1117',
  antialias: true,
  resolution: Math.min(window.devicePixelRatio || 1, 3),
  parent: 'game-container',
  scene: [BootScene, MenuScene, GameScene, GameOverScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});
