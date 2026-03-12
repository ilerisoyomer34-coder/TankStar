// =============================================================================
// TANK BATTLE — Grand Tanks style mobile top-down tank shooter
// Controls: Left joystick = move | Auto-aim & fire at nearest enemy
// =============================================================================

const W = 390;
const H = 844;

const PAL = {
  ground:       0x1a2a1a,
  groundDark:   0x141e14,
  groundLight:  0x223322,

  pBody:        0x58b6b8,
  pDark:        0x357172,
  pLight:       0xb0f5ed,
  pTrack:       0x2a4c47,

  e1Body:       0xc84040,
  e1Dark:       0x8a2020,
  e1Light:      0xf08080,
  e1Track:      0x3d1515,

  e2Body:       0xb87828,
  e2Dark:       0x7a5010,
  e2Light:      0xeac060,
  e2Track:      0x3d3020,

  bPlayer:      0xb0f5ed,
  bEnemy:       0xff7744,

  hpGreen:      0x44ee44,
  hpYellow:     0xeecc00,
  hpRed:        0xee2222,
  hpBg:         0x1a1a1a,

  header:       0x0d1117,
  uiBadge:      0x2a4c47,
  divider:      0x357172,

  exOrange:     0xff8c00,
  exYellow:     0xffd700,
  exRed:        0xff2200,
  exSmoke:      0x888888,
};

// =============================================================================
// SOUND MANAGER
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

  _soft(freq, endFreq, vol, attack, sustain, release, offset = 0) {
    const ctx = this._getCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + offset;
    const osc = ctx.createOscillator();
    const flt = ctx.createBiquadFilter();
    const g   = ctx.createGain();
    osc.connect(flt); flt.connect(g); g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 20), t0 + attack + sustain);
    flt.type = 'lowpass'; flt.frequency.value = 2400; flt.Q.value = 0.5;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + attack + sustain);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + sustain + release);
    osc.start(t0);
    osc.stop(t0 + attack + sustain + release + 0.02);
  },

  shoot()      { this._soft(900, 600, 0.10, 0.003, 0.008, 0.06); },
  enemyShoot() { this._soft(500, 320, 0.07, 0.003, 0.008, 0.07); },

  hit() {
    this._soft(180, 80,  0.22, 0.005, 0.03, 0.20);
    this._soft(120, 60,  0.12, 0.01,  0.02, 0.16, 0.03);
    if (navigator.vibrate) navigator.vibrate([40, 15, 40]);
  },

  explosion() {
    this._soft(160, 55,  0.30, 0.005, 0.05, 0.35);
    this._soft(100, 38,  0.20, 0.01,  0.06, 0.30, 0.04);
    if (navigator.vibrate) navigator.vibrate([60, 20, 80]);
  },

  gameOver() {
    this._soft(392, 330, 0.18, 0.01, 0.06, 0.20, 0.00);
    this._soft(330, 262, 0.15, 0.01, 0.06, 0.20, 0.22);
    this._soft(262, 196, 0.13, 0.01, 0.08, 0.30, 0.44);
    if (navigator.vibrate) navigator.vibrate([60, 30, 60, 30, 120]);
  },
};

// =============================================================================
// BOOT SCENE
// =============================================================================
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    this.makeTankBody('tank_player', PAL.pBody,  PAL.pDark,  PAL.pLight,  PAL.pTrack);
    this.makeTankBody('tank_e1',     PAL.e1Body, PAL.e1Dark, PAL.e1Light, PAL.e1Track);
    this.makeTankBody('tank_e2',     PAL.e2Body, PAL.e2Dark, PAL.e2Light, PAL.e2Track);
    this.makeBarrel('barrel_p', PAL.pDark,  PAL.pLight);
    this.makeBarrel('barrel_e', PAL.e1Dark, PAL.e1Light);
    this.makeBullet('bullet_p', PAL.bPlayer, 0xffffff);
    this.makeBullet('bullet_e', PAL.bEnemy,  0xffcc88);
    this.makeTree();
    this.scene.start('Menu');
  }

  makeTankBody(key, body, dark, light, track) {
    const g = this.make.graphics({ add: false });
    const cx = 32, cy = 32;

    // Drop shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(cx + 4, cy + 5, 50, 50);

    // Tracks
    g.fillStyle(track);
    g.fillRoundedRect(cx - 28, cy - 24, 11, 48, 4);
    g.fillRoundedRect(cx + 17, cy - 24, 11, 48, 4);

    // Track links
    g.fillStyle(0x000000, 0.30);
    for (let i = 0; i < 6; i++) {
      g.fillRect(cx - 27, cy - 20 + i * 8, 9, 2);
      g.fillRect(cx + 18, cy - 20 + i * 8, 9, 2);
    }

    // Hull
    g.fillStyle(dark);
    g.fillRoundedRect(cx - 16, cy - 22, 32, 48, 7);
    g.fillStyle(body);
    g.fillRoundedRect(cx - 17, cy - 24, 34, 50, 8);

    // Hull highlight
    g.fillStyle(light, 0.40);
    g.fillRoundedRect(cx - 15, cy - 22, 18, 12, 4);

    // Hull bottom shadow
    g.fillStyle(dark, 0.45);
    g.fillRoundedRect(cx - 17, cy + 14, 34, 12, 7);

    // Turret ring
    g.fillStyle(dark);
    g.fillCircle(cx, cy, 15);
    g.fillStyle(body);
    g.fillCircle(cx, cy, 12);

    // Turret highlight
    g.fillStyle(light, 0.55);
    g.fillCircle(cx - 3, cy - 3, 5);

    // Hatch
    g.fillStyle(dark);
    g.fillCircle(cx, cy, 5);
    g.fillStyle(body);
    g.fillCircle(cx, cy, 3);

    // Rivets
    g.fillStyle(dark);
    [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(a => {
      g.fillCircle(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 2);
    });

    g.generateTexture(key, 64, 64);
    g.destroy();
  }

  makeBarrel(key, dark, light) {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x000000, 0.20);
    g.fillRoundedRect(3, 2, 8, 32, 3);
    g.fillStyle(dark);
    g.fillRoundedRect(2, 0, 8, 30, 4);
    g.fillRoundedRect(0, 0, 12, 8,  3);
    g.fillRoundedRect(0, 10, 12, 5, 2);
    g.fillStyle(light, 0.5);
    g.fillRoundedRect(3, 2, 3, 22, 2);
    g.generateTexture(key, 12, 34);
    g.destroy();
  }

  makeBullet(key, outer, inner) {
    const g = this.make.graphics({ add: false });
    g.fillStyle(outer, 0.40);
    g.fillCircle(6, 6, 6);
    g.fillStyle(outer);
    g.fillCircle(6, 6, 4);
    g.fillStyle(inner, 0.85);
    g.fillCircle(5, 5, 2);
    g.generateTexture(key, 12, 12);
    g.destroy();
  }

  makeTree() {
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x1a3a10, 0.85);
    g.fillCircle(16, 16, 15);
    g.fillStyle(0x2a5018);
    g.fillCircle(14, 14, 11);
    g.fillStyle(0x3a7020, 0.75);
    g.fillCircle(12, 12, 6);
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(10, 9, 4);
    g.generateTexture('tree', 32, 32);
    g.destroy();
  }
}

// =============================================================================
// MENU SCENE
// =============================================================================
class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, PAL.ground);
    const gfx = this.add.graphics();
    gfx.lineStyle(1, PAL.groundLight, 0.18);
    for (let x = 0; x <= W; x += 48) { gfx.moveTo(x, 0); gfx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 48) { gfx.moveTo(0, y); gfx.lineTo(W, y); }
    gfx.strokePath();

    // Title card
    const card = this.add.rectangle(W / 2, 200, 315, 148, 0x0d1117, 0.92);
    card.setStrokeStyle(3, PAL.pBody);
    this.add.text(W / 2, 164, 'TANK', {
      fontSize: '64px', fontFamily: 'Arial Black, Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(W / 2, 234, 'BATTLE', {
      fontSize: '40px', fontFamily: 'Arial Black, Arial', color: '#b0f5ed', fontStyle: 'bold', letterSpacing: 8,
    }).setOrigin(0.5);

    // Animated player tank
    const body   = this.add.image(W / 2, 418, 'tank_player').setScale(1.6);
    const barrel = this.add.image(W / 2, 418, 'barrel_p').setScale(1.6).setOrigin(0.5, 0.85);

    this.tweens.add({ targets: barrel, angle: { from: -22, to: 22 }, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: [body, barrel], y: '-=7', duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Decorative enemy tanks
    this.add.image(W / 2 - 108, 412, 'tank_e1').setScale(1.0).setAlpha(0.35).setAngle(155);
    this.add.image(W / 2 + 108, 412, 'tank_e2').setScale(1.0).setAlpha(0.35).setAngle(-155);

    // Best score
    const best = localStorage.getItem('tankBattleBest') || 0;
    const bestBg = this.add.rectangle(W / 2, 532, 210, 44, PAL.uiBadge, 0.82);
    bestBg.setStrokeStyle(2, 0xc28d3a);
    this.add.text(W / 2, 532, `⭐  EN İYİ: ${best}`, {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#C28D3A',
    }).setOrigin(0.5);

    // Play button
    const tapBg  = this.add.rectangle(W / 2, 630, 270, 58, PAL.pBody);
    tapBg.setStrokeStyle(3, 0xffffff, 0.6);
    const tapTxt = this.add.text(W / 2, 630, 'SAVAŞA BAŞLA', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({ targets: [tapBg, tapTxt], alpha: 0.35, duration: 660, yoyo: true, repeat: -1 });

    // Hint
    this.add.text(W / 2, 732, '← Sol sürükle: Hareket  |  Oto-ateş →', {
      fontSize: '14px', fontFamily: 'Arial', color: '#506866',
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
    this.score        = 0;
    this.wave         = 1;
    this.isOver       = false;
    this.waveClearing = false;
    this.waveTotal    = 0;
    this.waveKills    = 0;

    this.enemies  = [];
    this.pBullets = [];
    this.eBullets = [];

    this.px          = W / 2;
    this.py          = H * 0.65;
    this.pBodyAngle  = -Math.PI / 2;   // facing up
    this.pHp         = 100;
    this.pInvincible = false;
    this.pFireCd     = 0;
    this.PFIRE_RATE  = 700;
    this.PBSPEED     = 420;
    this.EBSPEED     = 240;

    this.buildGround();
    this.buildTrees();
    this.buildPlayer();
    this.buildHUD();
    this.buildJoystick();

    this.time.delayedCall(700, () => this.startWave(this.wave));
    this.cameras.main.fadeIn(280);
  }

  // ── Ground ────────────────────────────────────────────────────────────────
  buildGround() {
    this.add.rectangle(W / 2, H / 2, W, H, PAL.ground).setDepth(0);
    const gfx = this.add.graphics().setDepth(1);
    gfx.lineStyle(1, PAL.groundLight, 0.14);
    for (let x = 0; x <= W; x += 48) { gfx.moveTo(x, 0); gfx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 48) { gfx.moveTo(0, y); gfx.lineTo(W, y); }
    gfx.strokePath();
    // Ground patches
    gfx.fillStyle(PAL.groundDark, 0.38);
    [[55,120],[180,75],[310,200],[80,360],[290,460],[140,610],[340,710],[50,760],[200,300]].forEach(([x, y]) => {
      gfx.fillEllipse(x, y, 20 + (x % 12), 11 + (y % 8));
    });
  }

  buildTrees() {
    [[28,95],[W-28,115],[22,380],[W-25,360],[W/2-90,55],[W/2+90,60],
     [30,660],[W-30,680],[90,780],[W-90,790],[45,500],[W-45,520]].forEach(([x, y]) => {
      this.add.image(x, y, 'tree').setDepth(2).setAlpha(0.82).setScale(1.1 + (x % 5) * 0.1);
    });
  }

  // ── Player ────────────────────────────────────────────────────────────────
  buildPlayer() {
    this.pShadow = this.add.ellipse(this.px + 4, this.py + 5, 50, 18, 0x000000, 0.22).setDepth(3);
    this.pBody   = this.add.image(this.px, this.py, 'tank_player').setDepth(5)
                     .setRotation(this.pBodyAngle + Math.PI / 2);
    this.pBarrel = this.add.image(this.px, this.py, 'barrel_p').setDepth(6)
                     .setOrigin(0.5, 0.85).setRotation(this.pBodyAngle + Math.PI / 2);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  buildHUD() {
    const HH = 62;
    this.add.rectangle(W / 2, HH / 2, W, HH, PAL.header, 0.93).setDepth(20);
    this.add.rectangle(W / 2, HH, W, 3, PAL.divider).setDepth(21);

    // Wave badge — left
    this.add.rectangle(46, HH / 2, 84, 36, PAL.uiBadge, 0.75).setDepth(20);
    this.waveTxt = this.add.text(46, HH / 2, 'DALGA 1', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#b0f5ed',
    }).setOrigin(0.5).setDepth(21);

    // Score — center
    this.scoreTxt = this.add.text(W / 2, HH / 2, '0', {
      fontSize: '38px', fontFamily: 'Arial Black', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22);

    // HP bar — right
    const barW = 110;
    const bx   = W - 20;
    this.add.text(bx - barW - 4, HH / 2, 'CAN', {
      fontSize: '12px', fontFamily: 'Arial Black', color: '#b3bcbd',
    }).setOrigin(1, 0.5).setDepth(21);
    this.add.rectangle(bx - barW / 2, HH / 2, barW + 4, 16, PAL.hpBg).setOrigin(0.5).setDepth(20);
    this._hpX    = bx - barW;
    this._hpMaxW = barW;
    this.hpFill  = this.add.rectangle(this._hpX, HH / 2, barW, 12, PAL.hpGreen)
                     .setOrigin(0, 0.5).setDepth(21);
  }

  updateHUD() {
    const r = Math.max(0, this.pHp / 100);
    this.hpFill.setScale(r, 1);
    this.hpFill.setFillStyle(r > 0.5 ? PAL.hpGreen : r > 0.25 ? PAL.hpYellow : PAL.hpRed);
  }

  // ── Joystick ──────────────────────────────────────────────────────────────
  buildJoystick() {
    this.joy = { active: false, pid: -1, bx: 0, by: 0, dx: 0, dy: 0 };

    this.joyBase  = this.add.circle(0, 0, 52, 0xffffff, 0.10).setDepth(25).setVisible(false);
    this.joyRing  = this.add.circle(0, 0, 52, 0x000000, 0).setDepth(25).setVisible(false);
    this.joyRing.setStrokeStyle(2, PAL.pBody, 0.55);
    this.joyStick = this.add.circle(0, 0, 28, PAL.pBody, 0.60).setDepth(26).setVisible(false);

    this.input.on('pointerdown', ptr => {
      if (this.isOver || this.joy.pid !== -1) return;
      if (ptr.x < W * 0.55) {
        this.joy.pid = ptr.id;
        this.joy.bx  = Phaser.Math.Clamp(ptr.x, 60, W * 0.55 - 60);
        this.joy.by  = Phaser.Math.Clamp(ptr.y, 80, H - 20);
        [this.joyBase, this.joyRing, this.joyStick].forEach(o =>
          o.setPosition(this.joy.bx, this.joy.by).setVisible(true)
        );
      }
    });

    this.input.on('pointermove', ptr => {
      if (ptr.id !== this.joy.pid) return;
      const dx = ptr.x - this.joy.bx;
      const dy = ptr.y - this.joy.by;
      const dist  = Math.hypot(dx, dy);
      const R     = 48;
      const angle = Math.atan2(dy, dx);
      this.joy.dx     = dist > 8 ? Math.cos(angle) : 0;
      this.joy.dy     = dist > 8 ? Math.sin(angle) : 0;
      this.joy.active = dist > 8;
      const cr = Math.min(dist, R);
      this.joyStick.setPosition(this.joy.bx + Math.cos(angle) * cr, this.joy.by + Math.sin(angle) * cr);
    });

    const endJoy = ptr => {
      if (ptr.id !== this.joy.pid) return;
      this.joy.pid = -1; this.joy.active = false; this.joy.dx = 0; this.joy.dy = 0;
      [this.joyBase, this.joyRing, this.joyStick].forEach(o => o.setVisible(false));
    };
    this.input.on('pointerup', endJoy);
    this.input.on('pointerupoutside', endJoy);
  }

  // ── Wave Spawning ─────────────────────────────────────────────────────────
  startWave(wave) {
    this.waveClearing = false;
    this.waveKills    = 0;

    const count   = Math.min(3 + wave, 11);
    const speed   = Math.min(55 + wave * 10, 140);
    const hp      = 1 + Math.floor((wave - 1) / 3);
    const fRate   = Math.max(2500 - wave * 160, 900);
    const bodyKey = wave >= 5 ? 'tank_e2' : 'tank_e1';
    this.waveTotal = count;

    // Wave announcement
    const ann = this.add.text(W / 2, H * 0.44, `DALGA ${wave}`, {
      fontSize: '52px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#357172', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0).setDepth(18);
    this.tweens.add({
      targets: ann, alpha: { from: 0, to: 1 }, duration: 260,
      yoyo: true, hold: 800, onComplete: () => ann.destroy(),
    });

    for (let i = 0; i < count; i++) {
      this.time.delayedCall(i * 380 + 350, () => {
        if (!this.isOver) this.spawnEnemy(speed, hp, fRate, bodyKey);
      });
    }
  }

  spawnEnemy(speed, hp, fireRate, bodyKey) {
    const MARGIN = 32, HH = 65;
    const edge = Math.floor(Math.random() * 4);
    let ex, ey;
    if      (edge === 0) { ex = MARGIN + Math.random() * (W - 2 * MARGIN); ey = HH + MARGIN; }
    else if (edge === 1) { ex = W - MARGIN; ey = HH + MARGIN + Math.random() * (H - HH - 2 * MARGIN); }
    else if (edge === 2) { ex = MARGIN + Math.random() * (W - 2 * MARGIN); ey = H - MARGIN; }
    else                 { ex = MARGIN; ey = HH + MARGIN + Math.random() * (H - HH - 2 * MARGIN); }

    const shadow = this.add.ellipse(ex + 4, ey + 5, 46, 16, 0x000000, 0.22).setDepth(3);
    const body   = this.add.image(ex, ey, bodyKey).setDepth(5);
    const barrel = this.add.image(ex, ey, 'barrel_e').setDepth(6).setOrigin(0.5, 0.85);

    const hpBg  = this.add.rectangle(ex, ey - 40, 46, 8, PAL.hpBg, 0.85).setDepth(8);
    const hpBar = this.add.rectangle(ex - 23, ey - 40, 46, 6, PAL.hpGreen).setOrigin(0, 0.5).setDepth(9);

    this.enemies.push({
      ex, ey, hp, maxHp: hp, speed, fireRate,
      fireCd: Math.random() * fireRate,
      ramCd: 0,
      body, barrel, shadow, hpBg, hpBar, alive: true,
    });
  }

  // ── Bullets ───────────────────────────────────────────────────────────────
  firePlayer(tx, ty) {
    const angle = Phaser.Math.Angle.Between(this.px, this.py, tx, ty);
    const bx = this.px + Math.cos(angle) * 36;
    const by = this.py + Math.sin(angle) * 36;
    const img = this.add.image(bx, by, 'bullet_p').setDepth(7).setRotation(angle + Math.PI / 2);
    this.pBullets.push({ img, vx: Math.cos(angle) * this.PBSPEED, vy: Math.sin(angle) * this.PBSPEED, life: 2200 });
    SFX.shoot();
  }

  fireEnemy(e) {
    const angle = Phaser.Math.Angle.Between(e.ex, e.ey, this.px, this.py);
    const img   = this.add.image(e.ex, e.ey, 'bullet_e').setDepth(7).setRotation(angle + Math.PI / 2);
    this.eBullets.push({ img, vx: Math.cos(angle) * this.EBSPEED, vy: Math.sin(angle) * this.EBSPEED, life: 3000 });
    SFX.enemyShoot();
  }

  // ── Update ────────────────────────────────────────────────────────────────
  update(_, delta) {
    if (this.isOver) return;
    const dt  = delta / 1000;
    const HH  = 65;

    // ── Player movement ──────────────────────────────────────────────────
    if (this.joy.active) {
      this.px = Phaser.Math.Clamp(this.px + this.joy.dx * 150 * dt, 28, W - 28);
      this.py = Phaser.Math.Clamp(this.py + this.joy.dy * 150 * dt, HH + 28, H - 28);
      const movAngle = Math.atan2(this.joy.dy, this.joy.dx);
      const diff = Phaser.Math.Angle.Wrap(movAngle - this.pBodyAngle);
      this.pBodyAngle += diff * 0.20;
    }
    this.pBody.setPosition(this.px, this.py).setRotation(this.pBodyAngle + Math.PI / 2);
    this.pShadow.setPosition(this.px + 4, this.py + 5);

    // ── Auto-aim & fire ──────────────────────────────────────────────────
    const nearest = this.nearestEnemy();
    if (nearest) {
      const aimAngle = Phaser.Math.Angle.Between(this.px, this.py, nearest.ex, nearest.ey);
      this.pBarrel.setPosition(this.px, this.py).setRotation(aimAngle + Math.PI / 2);
      this.pFireCd -= delta;
      if (this.pFireCd <= 0) {
        this.pFireCd = this.PFIRE_RATE;
        this.firePlayer(nearest.ex, nearest.ey);
      }
    } else {
      this.pBarrel.setPosition(this.px, this.py).setRotation(this.pBodyAngle + Math.PI / 2);
    }

    // ── Enemies ──────────────────────────────────────────────────────────
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx   = this.px - e.ex;
      const dy   = this.py - e.ey;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.1) continue;
      const angle = Math.atan2(dy, dx);

      const ORBIT = 160;
      if (dist > ORBIT + 20) {
        e.ex += (dx / dist) * e.speed * dt;
        e.ey += (dy / dist) * e.speed * dt;
      } else if (dist < ORBIT - 20) {
        e.ex -= (dx / dist) * e.speed * 0.4 * dt;
        e.ey -= (dy / dist) * e.speed * 0.4 * dt;
      }
      e.ex = Phaser.Math.Clamp(e.ex, 28, W - 28);
      e.ey = Phaser.Math.Clamp(e.ey, HH + 28, H - 28);

      e.body.setPosition(e.ex, e.ey).setRotation(angle + Math.PI / 2);
      e.barrel.setPosition(e.ex, e.ey).setRotation(angle + Math.PI / 2);
      e.shadow.setPosition(e.ex + 4, e.ey + 5);
      e.hpBg.setPosition(e.ex, e.ey - 40);
      e.hpBar.setPosition(e.ex - 23, e.ey - 40);

      // Enemy fire
      e.fireCd -= delta;
      if (e.fireCd <= 0 && dist < 400) {
        e.fireCd = e.fireRate + Math.random() * 400;
        this.fireEnemy(e);
      }

      // Ram damage
      e.ramCd = Math.max(0, e.ramCd - delta);
      if (dist < 40 && e.ramCd === 0 && !this.pInvincible) {
        e.ramCd = 900;
        this.damagePlayer(15);
      }
    }

    // ── Player bullets ────────────────────────────────────────────────────
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const b = this.pBullets[i];
      b.img.x += b.vx * dt;
      b.img.y += b.vy * dt;
      b.life  -= delta;
      if (b.life <= 0 || b.img.x < -10 || b.img.x > W + 10 || b.img.y < -10 || b.img.y > H + 10) {
        b.img.destroy();
        this.pBullets.splice(i, 1);
        continue;
      }
      let hit = false;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Phaser.Math.Distance.Between(b.img.x, b.img.y, e.ex, e.ey) < 28) {
          b.img.destroy();
          this.pBullets.splice(i, 1);
          this.damageEnemy(e);
          hit = true;
          break;
        }
      }
      if (hit) continue;
    }

    // ── Enemy bullets ─────────────────────────────────────────────────────
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const b = this.eBullets[i];
      b.img.x += b.vx * dt;
      b.img.y += b.vy * dt;
      b.life  -= delta;
      if (b.life <= 0 || b.img.x < -10 || b.img.x > W + 10 || b.img.y < -10 || b.img.y > H + 10) {
        b.img.destroy();
        this.eBullets.splice(i, 1);
        continue;
      }
      if (!this.pInvincible &&
          Phaser.Math.Distance.Between(b.img.x, b.img.y, this.px, this.py) < 24) {
        b.img.destroy();
        this.eBullets.splice(i, 1);
        this.damagePlayer(20);
      }
    }
  }

  nearestEnemy() {
    let best = null, bestD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = Phaser.Math.Distance.Between(this.px, this.py, e.ex, e.ey);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // ── Combat ────────────────────────────────────────────────────────────────
  damageEnemy(e) {
    e.hp--;
    const r = Math.max(0, e.hp / e.maxHp);
    e.hpBar.setScale(r, 1);
    e.hpBar.setFillStyle(r > 0.5 ? PAL.hpGreen : r > 0.25 ? PAL.hpYellow : PAL.hpRed);
    this.tweens.add({ targets: e.body, alpha: 0.2, duration: 65, yoyo: true });
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    const idx = this.enemies.indexOf(e);
    if (idx !== -1) this.enemies.splice(idx, 1);

    this.score++;
    this.waveKills++;
    this.scoreTxt.setText(this.score.toString());
    this.tweens.add({ targets: this.scoreTxt, scale: 1.35, duration: 80, yoyo: true });

    this.explode(e.ex, e.ey);
    SFX.explosion();
    e.body.destroy(); e.barrel.destroy(); e.shadow.destroy();
    e.hpBg.destroy(); e.hpBar.destroy();

    // Score popup
    const pop = this.add.text(e.ex, e.ey - 8, '+1', {
      fontSize: '26px', fontFamily: 'Arial Black', color: '#FFD700',
      stroke: '#333333', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);
    this.tweens.add({
      targets: pop, y: pop.y - 52, alpha: 0, duration: 650, ease: 'Cubic.easeOut',
      onComplete: () => pop.destroy(),
    });

    // Wave clear?
    if (this.waveKills >= this.waveTotal && !this.waveClearing) {
      this.waveClearing = true;
      this.wave++;
      this.waveTxt.setText(`DALGA ${this.wave}`);
      this.time.delayedCall(1700, () => {
        if (!this.isOver) this.startWave(this.wave);
      });
    }
  }

  damagePlayer(amount) {
    if (this.pInvincible) return;
    this.pHp = Math.max(0, this.pHp - amount);
    this.updateHUD();
    SFX.hit();
    this.cameras.main.shake(180, 0.016);

    this.pInvincible = true;
    let ct = 0;
    this.time.addEvent({ delay: 80, repeat: 7, callback: () => {
      ct++;
      const a = ct % 2 === 0 ? 1 : 0.22;
      this.pBody.setAlpha(a);
      this.pBarrel.setAlpha(a);
    }});
    this.time.delayedCall(700, () => {
      this.pInvincible = false;
      this.pBody.setAlpha(1);
      this.pBarrel.setAlpha(1);
    });

    if (this.pHp <= 0) this.endGame();
  }

  explode(x, y) {
    const cols = [PAL.exOrange, PAL.exYellow, PAL.exRed, PAL.exSmoke, 0xffffff];
    for (let i = 0; i < 16; i++) {
      const c = cols[i % cols.length];
      const p = this.add.circle(x, y, 3 + Math.random() * 5, c).setDepth(10);
      const a = (i / 16) * Math.PI * 2;
      const d = 22 + Math.random() * 44;
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        alpha: 0, scale: 0, duration: 460 + Math.random() * 200,
        ease: 'Cubic.easeOut', onComplete: () => p.destroy(),
      });
    }
    // Shockwave ring
    const ring = this.add.circle(x, y, 8, 0x000000, 0).setDepth(10);
    ring.setStrokeStyle(3, PAL.exOrange, 0.88);
    this.tweens.add({
      targets: ring, scale: 4.2, alpha: 0, duration: 360,
      ease: 'Cubic.easeOut', onComplete: () => ring.destroy(),
    });
  }

  endGame() {
    this.isOver = true;
    const best = parseInt(localStorage.getItem('tankBattleBest') || 0);
    if (this.score > best) localStorage.setItem('tankBattleBest', this.score);

    SFX.gameOver();
    this.explode(this.px, this.py);
    this.explode(this.px - 14, this.py + 10);
    this.tweens.add({ targets: [this.pBody, this.pBarrel, this.pShadow], alpha: 0, duration: 480 });
    this.cameras.main.shake(500, 0.028);

    this.time.delayedCall(950, () => {
      this.cameras.main.fadeOut(280);
      this.time.delayedCall(280, () =>
        this.scene.start('GameOver', { score: this.score, wave: this.wave })
      );
    });
  }
}

// =============================================================================
// GAME OVER SCENE
// =============================================================================
class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }
  init(data) { this.finalScore = data.score || 0; this.finalWave = data.wave || 1; }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, PAL.ground);
    const gfx = this.add.graphics();
    gfx.lineStyle(1, PAL.groundLight, 0.12);
    for (let x = 0; x <= W; x += 48) { gfx.moveTo(x, 0); gfx.lineTo(x, H); }
    for (let y = 0; y <= H; y += 48) { gfx.moveTo(0, y); gfx.lineTo(W, y); }
    gfx.strokePath();
    this.add.rectangle(W / 2, H / 2, W, H, 0x0a0f1a, 0.72);

    // GAME OVER card
    const card = this.add.rectangle(W / 2, 265, 310, 160, PAL.uiBadge, 0.92);
    card.setStrokeStyle(3, 0x3d2020).setScale(0);
    this.tweens.add({ targets: card, scale: 1, duration: 420, ease: 'Back.easeOut' });

    const goTxt   = this.add.text(W / 2, 238, 'GAME', {
      fontSize: '66px', fontFamily: 'Arial Black, Arial', color: '#DF532C', fontStyle: 'bold',
      stroke: '#B44123', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);
    const overTxt = this.add.text(W / 2, 295, 'OVER', {
      fontSize: '66px', fontFamily: 'Arial Black, Arial', color: '#ffffff', fontStyle: 'bold',
      stroke: '#1F2831', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [goTxt, overTxt], alpha: 1, duration: 300, delay: 200 });

    // Stats card
    const statBg = this.add.rectangle(W / 2, 462, 260, 160, PAL.uiBadge, 0.88);
    statBg.setStrokeStyle(2, 0x2a4c47).setAlpha(0);
    this.tweens.add({ targets: statBg, alpha: 1, duration: 300, delay: 350 });

    const waveTxt   = this.add.text(W / 2, 406, `DALGA ${this.finalWave}`, {
      fontSize: '18px', fontFamily: 'Arial Black', color: '#b0f5ed',
    }).setOrigin(0.5).setAlpha(0);
    const killLabel = this.add.text(W / 2, 438, 'ÖLDÜRME', {
      fontSize: '16px', fontFamily: 'Arial Black', color: '#b3bcbd',
    }).setOrigin(0.5).setAlpha(0);
    const killTxt   = this.add.text(W / 2, 490, this.finalScore.toString(), {
      fontSize: '68px', fontFamily: 'Arial Black, Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setAlpha(0);
    this.tweens.add({ targets: [waveTxt, killLabel, killTxt], alpha: 1, duration: 280, delay: 400 });

    // Best / record
    const best = parseInt(localStorage.getItem('tankBattleBest') || 0);
    if (this.finalScore > 0 && this.finalScore >= best) {
      const rec = this.add.text(W / 2, 566, '⭐  YENİ REKOR!  ⭐', {
        fontSize: '26px', fontFamily: 'Arial Black', color: '#C28D3A',
        stroke: '#B44123', strokeThickness: 3,
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: rec, alpha: 1, duration: 300, delay: 600 });
      this.tweens.add({ targets: rec, y: rec.y - 7, duration: 700, yoyo: true, repeat: -1, delay: 1000 });
    } else {
      const bestTxt = this.add.text(W / 2, 566, `EN İYİ: ${best}`, {
        fontSize: '22px', fontFamily: 'Arial', color: '#506866',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: bestTxt, alpha: 1, duration: 300, delay: 500 });
    }

    // Play Again
    const btn    = this.add.rectangle(W / 2, 660, 240, 62, PAL.pBody)
      .setInteractive({ useHandCursor: true }).setStrokeStyle(3, 0xffffff, 0.5).setAlpha(0);
    const btnTxt = this.add.text(W / 2, 660, 'TEKRAR OYNA', {
      fontSize: '26px', fontFamily: 'Arial Black', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    this.tweens.add({ targets: [btn, btnTxt], alpha: 1, duration: 280, delay: 500 });
    btn.on('pointerover', () => btn.setFillColor(PAL.pDark));
    btn.on('pointerout',  () => btn.setFillColor(PAL.pBody));
    btn.on('pointerdown', () => {
      this.cameras.main.fadeOut(220);
      this.time.delayedCall(220, () => this.scene.start('Game'));
    });

    // Menu
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
