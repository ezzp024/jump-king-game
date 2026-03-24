const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const heightEl = document.getElementById("height");
const bestEl = document.getElementById("best");
const fallsEl = document.getElementById("falls");
const checkpointEl = document.getElementById("checkpoint");
const statusEl = document.getElementById("status");
const chapterEl = document.getElementById("chapter");
const storyEl = document.getElementById("storyLine");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const stageShell = document.getElementById("stageShell");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const BASE_Y = 860;
const WORLD_TOP = -7600;
const GOAL_Y = WORLD_TOP + 120;

const GRAVITY = 2140;
const AIR_DRAG = 0.992;
const WALL_BOUNCE = -0.2;
const FALL_LIMIT = 1040;
const STORAGE_KEY = "skybound-crown-best-height";

const input = {
  left: false,
  right: false,
  jump: false,
};

const player = {
  x: WIDTH * 0.5 - 13,
  y: BASE_Y - 38,
  w: 26,
  h: 38,
  vx: 0,
  vy: 0,
  facing: 1,
  grounded: false,
  charging: false,
  charge: 0,
  maxCharge: 1.28,
};

const game = {
  mode: "title",
  cameraY: 0,
  shake: 0,
  falls: 0,
  best: Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0,
  currentHeight: 0,
  checkpointHeight: 0,
  checkpointName: "Base Camp",
  nextCheckpoint: 160,
  respawnX: WIDTH * 0.5 - 13,
  respawnY: BASE_Y - 38,
  storyIndex: 0,
  chapter: "Chapter I - The Foot of the Mountain",
};

const storyMoments = [
  {
    at: 0,
    chapter: "Chapter I - The Foot of the Mountain",
    line: "The old bell is silent. Climb and ring it from the sky keep.",
  },
  {
    at: 220,
    chapter: "Chapter II - Windcut Ledges",
    line: "Cold wind cuts through your armor. The path starts to narrow.",
  },
  {
    at: 560,
    chapter: "Chapter III - The Cracked Causeway",
    line: "Ruined stones crumble beneath your feet. Hesitation means falling.",
  },
  {
    at: 980,
    chapter: "Chapter IV - The Choir of Spires",
    line: "The mountain whispers. Spikes wait where pride jumps first.",
  },
  {
    at: 1480,
    chapter: "Chapter V - Cloud Bastion",
    line: "You pass the clouds. The crown tower finally appears above.",
  },
  {
    at: 2140,
    chapter: "Final Chapter - The Bell Keep",
    line: "One final ascent. The city below waits for the bell to ring.",
  },
];

const level = buildLevel();

function buildLevel() {
  const platforms = [];
  const spikes = [];

  platforms.push({ x: WIDTH * 0.5 - 120, y: BASE_Y, w: 240, h: 26, type: "solid", broken: false, timer: 0 });

  let y = BASE_Y - 100;
  let x = WIDTH * 0.5 - 70;
  let w = 140;
  let lane = 1;
  let step = 0;

  while (y > WORLD_TOP + 200) {
    const progress = (BASE_Y - y) / (BASE_Y - WORLD_TOP);
    const difficulty = Math.min(1, progress * 1.18);

    const minGap = 88 + difficulty * 52;
    const maxGap = 108 + difficulty * 72;
    const gap = minGap + pseudo(step * 13 + 7) * (maxGap - minGap);
    y -= gap;

    const minW = 74;
    const maxW = 158 - difficulty * 56;
    w = clamp(maxW - pseudo(step * 11 + 17) * 18, minW, maxW);

    const maxShift = 120 + difficulty * 44;
    const shift = (pseudo(step * 29 + 3) - 0.5) * 2 * maxShift;

    if (step % 5 === 0) {
      lane = (lane + 1) % 3;
      const laneTarget = lane === 0 ? 70 : lane === 1 ? WIDTH * 0.5 - w * 0.5 : WIDTH - w - 70;
      x += (laneTarget - x) * 0.64;
    } else {
      x += shift;
    }

    x = clamp(x, 34, WIDTH - w - 34);

    let type = "solid";
    if (difficulty > 0.24 && difficulty < 0.9 && step % 8 === 3) type = "crumbly";
    if (difficulty > 0.58 && step % 14 === 7) type = "spring";

    platforms.push({ x, y, w, h: 18, type, broken: false, timer: 0 });

    if (step % 6 === 2) {
      const catchW = clamp(w + 18, 88, 160);
      const catchX = clamp(x - (pseudo(step * 9 + 4) - 0.5) * 30, 24, WIDTH - catchW - 24);
      platforms.push({ x: catchX, y: y + 62, w: catchW, h: 14, type: "solid", broken: false, timer: 0 });
    }

    if (difficulty > 0.32 && difficulty < 0.95 && step % 9 === 6 && type === "solid") {
      const sw = clamp(w * 0.32, 22, 44);
      const sx = x + (w - sw) * clamp(pseudo(step * 6 + 1), 0.15, 0.85);
      spikes.push({ x: sx, y: y - 12, w: sw, h: 12 });
    }

    step += 1;
  }

  platforms.push({ x: WIDTH * 0.5 - 72, y: GOAL_Y + 52, w: 144, h: 18, type: "solid", broken: false, timer: 0 });
  return { platforms, spikes };
}

function pseudo(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setInput(key, value) {
  input[key] = value;
  const button = document.querySelector(`button[data-key="${key}"]`);
  if (button) button.classList.toggle("active", value);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function checkpointNameForHeight(h) {
  if (h < 180) return "Base Camp";
  if (h < 520) return "Ridge Marker";
  if (h < 980) return "Broken Arch";
  if (h < 1500) return "Choir Ledge";
  if (h < 2200) return "Cloud Bastion";
  return "Bell Keep Approach";
}

function syncHud() {
  heightEl.textContent = `${game.currentHeight}m`;
  bestEl.textContent = `${game.best}m`;
  fallsEl.textContent = String(game.falls);
  checkpointEl.textContent = game.checkpointName;
  chapterEl.textContent = game.chapter;
}

function resetPlayerToSpawn() {
  player.x = game.respawnX;
  player.y = game.respawnY;
  player.vx = 0;
  player.vy = 0;
  player.charge = 0;
  player.charging = false;
  player.grounded = false;
}

function startRun() {
  game.mode = "playing";
  game.cameraY = 0;
  game.shake = 0;
  game.falls = 0;
  game.currentHeight = 0;
  game.checkpointHeight = 0;
  game.checkpointName = "Base Camp";
  game.nextCheckpoint = 160;
  game.respawnX = WIDTH * 0.5 - 13;
  game.respawnY = BASE_Y - 38;
  game.storyIndex = 0;
  game.chapter = storyMoments[0].chapter;

  for (const platform of level.platforms) {
    platform.broken = false;
    platform.timer = 0;
  }

  storyEl.textContent = storyMoments[0].line;
  setStatus("Run started. Commit to each jump.");
  resetPlayerToSpawn();
  syncHud();
}

function loseLife(message) {
  game.falls += 1;
  game.shake = 0.28;
  setStatus(message);
  resetPlayerToSpawn();
}

function maybeSetCheckpoint(platform) {
  if (!platform) return;
  if (game.currentHeight < game.nextCheckpoint) return;

  game.checkpointHeight = game.currentHeight;
  game.checkpointName = checkpointNameForHeight(game.currentHeight);
  game.respawnX = platform.x + platform.w * 0.5 - player.w * 0.5;
  game.respawnY = platform.y - player.h;
  game.nextCheckpoint += 260;
  setStatus(`Checkpoint reached: ${game.checkpointName}`);
}

function maybeAdvanceStory() {
  const next = storyMoments[game.storyIndex + 1];
  if (!next) return;
  if (game.currentHeight < next.at) return;

  game.storyIndex += 1;
  game.chapter = next.chapter;
  storyEl.textContent = next.line;
  setStatus(`Story unlocked: ${next.chapter}`);
}

function startCharge() {
  if (game.mode !== "playing") return;
  if (!player.grounded) return;
  player.charging = true;
  player.charge = 0;
}

function releaseJump() {
  if (game.mode !== "playing") return;
  if (!player.charging || !player.grounded) return;

  const c = Math.max(0.08, player.charge);
  const jump = 480 + c * 940;
  const push = 180 + c * 350;

  player.vy = -jump;
  player.vx = player.facing * push;
  player.grounded = false;
  player.charging = false;
  player.charge = 0;
}

function bindPress(button, onDown, onUp) {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    onDown();
  });
  button.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      onDown();
    },
    { passive: false }
  );

  if (!onUp) return;

  const up = (event) => {
    event.preventDefault();
    onUp();
  };

  button.addEventListener("mouseup", up);
  button.addEventListener("mouseleave", up);
  button.addEventListener("touchend", up);
  button.addEventListener("touchcancel", up);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space", "Enter", "KeyR"].includes(event.code)) {
    event.preventDefault();
  }

  if ((event.code === "ArrowLeft" || event.code === "KeyA") && game.mode === "playing") setInput("left", true);
  if ((event.code === "ArrowRight" || event.code === "KeyD") && game.mode === "playing") setInput("right", true);

  if (event.code === "Space" && !input.jump) {
    setInput("jump", true);
    startCharge();
  }

  if (event.code === "Enter") {
    if (game.mode === "title" || game.mode === "won") startRun();
  }

  if (event.code === "KeyR") {
    startRun();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "ArrowLeft" || event.code === "KeyA") setInput("left", false);
  if (event.code === "ArrowRight" || event.code === "KeyD") setInput("right", false);

  if (event.code === "Space") {
    setInput("jump", false);
    releaseJump();
  }
});

for (const button of document.querySelectorAll("button[data-key]")) {
  const key = button.dataset.key;
  if (key === "jump") {
    bindPress(
      button,
      () => {
        if (!input.jump) {
          setInput("jump", true);
          startCharge();
        }
      },
      () => {
        setInput("jump", false);
        releaseJump();
      }
    );
  } else {
    bindPress(
      button,
      () => {
        if (game.mode === "playing") setInput(key, true);
      },
      () => {
        setInput(key, false);
      }
    );
  }
}

bindPress(startBtn, () => {
  if (game.mode === "title" || game.mode === "won") {
    startRun();
  } else {
    setStatus("Run already active.");
  }
});

bindPress(restartBtn, () => {
  startRun();
});

bindPress(fullscreenBtn, async () => {
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  if (stageShell.requestFullscreen) {
    await stageShell.requestFullscreen();
  }
});

document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
});

function update(dt) {
  if (game.mode !== "playing") return;

  if (input.left) player.facing = -1;
  if (input.right) player.facing = 1;

  if (player.charging && input.jump && player.grounded) {
    player.charge = Math.min(player.maxCharge, player.charge + dt * 1.08);
  }

  for (const platform of level.platforms) {
    if (platform.type === "crumbly" && platform.timer > 0) {
      platform.timer -= dt;
      if (platform.timer <= 0) {
        platform.broken = true;
        platform.timer = 0;
      }
    }
  }

  player.vy += GRAVITY * dt;
  player.vx *= AIR_DRAG;

  const prevX = player.x;
  const prevY = player.y;

  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.x < 0) {
    player.x = 0;
    player.vx *= WALL_BOUNCE;
  }
  if (player.x + player.w > WIDTH) {
    player.x = WIDTH - player.w;
    player.vx *= WALL_BOUNCE;
  }

  player.grounded = false;
  let landedPlatform = null;

  for (const platform of level.platforms) {
    if (platform.broken) continue;

    const landed =
      prevY + player.h <= platform.y &&
      player.y + player.h >= platform.y &&
      player.x + player.w > platform.x &&
      player.x < platform.x + platform.w;

    if (landed && player.vy >= 0) {
      player.y = platform.y - player.h;
      player.grounded = true;
      landedPlatform = platform;

      if (platform.type === "spring") {
        player.vy = -Math.max(760, Math.abs(player.vy) * 0.94);
        player.grounded = false;
        landedPlatform = null;
      } else {
        player.vy = 0;
      }

      if (platform.type === "crumbly" && platform.timer <= 0) {
        platform.timer = 0.18;
      }
    }
  }

  for (const spike of level.spikes) {
    const hit =
      player.x + player.w > spike.x &&
      player.x < spike.x + spike.w &&
      player.y + player.h > spike.y &&
      player.y < spike.y + spike.h;
    if (hit) {
      player.x = prevX;
      player.y = prevY;
      loseLife("Spikes! You tumble back to your checkpoint.");
      return;
    }
  }

  if (player.y > FALL_LIMIT) {
    loseLife("A long fall. Regain focus and climb again.");
    return;
  }

  game.currentHeight = Math.max(0, Math.floor((BASE_Y - player.y) / 10));
  if (game.currentHeight > game.best) {
    game.best = game.currentHeight;
    localStorage.setItem(STORAGE_KEY, String(game.best));
  }

  maybeSetCheckpoint(landedPlatform);
  maybeAdvanceStory();

  if (player.y <= GOAL_Y) {
    game.mode = "won";
    game.chapter = "Epilogue - Bell of Dawn";
    storyEl.textContent = "The bell roars across the valley. The city wakes to your victory.";
    setStatus("Crown claimed. Press Enter to begin a new legend.");
  }

  const targetCamera = player.y - HEIGHT * 0.6;
  game.cameraY += (targetCamera - game.cameraY) * Math.min(1, dt * 5.2);
  game.cameraY = clamp(game.cameraY, WORLD_TOP, BASE_Y + 40);

  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
  syncHud();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#a4c9ea");
  gradient.addColorStop(0.58, "#f3dcc0");
  gradient.addColorStop(1, "#db9e76");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const parallaxFar = game.cameraY * 0.06;
  const parallaxNear = game.cameraY * 0.12;

  ctx.fillStyle = "rgba(255, 255, 255, 0.46)";
  for (let i = 0; i < 10; i += 1) {
    const x = ((i * 92 + parallaxNear) % (WIDTH + 140)) - 70;
    const y = 80 + i * 86;
    ctx.beginPath();
    ctx.ellipse(x, y, 46, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(83, 57, 43, 0.2)";
  for (let i = 0; i < 7; i += 1) {
    const x = i * 105 - (parallaxFar % 105);
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT);
    ctx.lineTo(x + 55, HEIGHT - 130 - (i % 2) * 18);
    ctx.lineTo(x + 140, HEIGHT);
    ctx.fill();
  }
}

function drawGoal() {
  const gy = GOAL_Y - game.cameraY;
  if (gy < -150 || gy > HEIGHT + 100) return;

  ctx.fillStyle = "#6a4430";
  ctx.fillRect(WIDTH * 0.5 - 5, gy - 95, 10, 105);

  ctx.fillStyle = "#7f271a";
  ctx.fillRect(WIDTH * 0.5 + 5, gy - 128, 36, 24);

  ctx.fillStyle = "#fac55d";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.5, gy - 104, 19, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlatforms() {
  for (const platform of level.platforms) {
    if (platform.broken) continue;

    const py = platform.y - game.cameraY;
    if (py < -30 || py > HEIGHT + 30) continue;

    if (platform.type === "solid") ctx.fillStyle = "#8f5f45";
    if (platform.type === "crumbly") ctx.fillStyle = "#a28161";
    if (platform.type === "spring") ctx.fillStyle = "#3d644f";

    if (platform.timer > 0) ctx.globalAlpha = 0.72;
    ctx.fillRect(platform.x, py, platform.w, platform.h);
    ctx.fillStyle = "rgba(255, 237, 204, 0.34)";
    ctx.fillRect(platform.x + 4, py + 3, Math.max(8, platform.w - 8), 4);
    ctx.globalAlpha = 1;
  }
}

function drawSpikes() {
  ctx.fillStyle = "#6b3b35";
  for (const spike of level.spikes) {
    const sy = spike.y - game.cameraY;
    if (sy < -24 || sy > HEIGHT + 24) continue;

    const count = Math.max(2, Math.floor(spike.w / 10));
    const slice = spike.w / count;
    for (let i = 0; i < count; i += 1) {
      const x0 = spike.x + i * slice;
      ctx.beginPath();
      ctx.moveTo(x0, sy + spike.h);
      ctx.lineTo(x0 + slice * 0.5, sy);
      ctx.lineTo(x0 + slice, sy + spike.h);
      ctx.fill();
    }
  }
}

function drawPlayer() {
  const px = player.x;
  const py = player.y - game.cameraY;

  ctx.fillStyle = "#1f1a18";
  ctx.fillRect(px, py, player.w, player.h);
  ctx.fillStyle = "#ea6f40";
  ctx.fillRect(px + 4, py + 7, player.w - 8, player.h - 11);

  const eyeX = player.facing > 0 ? px + player.w - 8 : px + 4;
  ctx.fillStyle = "#fff";
  ctx.fillRect(eyeX, py + 10, 4, 4);

  if (player.charging && player.grounded) {
    const ratio = player.charge / player.maxCharge;
    const bw = 84;
    const bx = px + player.w * 0.5 - bw * 0.5;
    const by = py - 15;
    ctx.fillStyle = "rgba(25, 17, 12, 0.5)";
    ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = "#ff7f4d";
    ctx.fillRect(bx, by, bw * ratio, 7);
  }
}

function drawOverlay() {
  if (game.mode === "playing") return;

  ctx.fillStyle = "rgba(22, 16, 12, 0.76)";
  ctx.fillRect(36, HEIGHT * 0.27, WIDTH - 72, 240);
  ctx.textAlign = "center";

  if (game.mode === "title") {
    ctx.fillStyle = "#fff1d2";
    ctx.font = "700 46px Space Grotesk";
    ctx.fillText("SKYBOUND CROWN", WIDTH * 0.5, HEIGHT * 0.38);
    ctx.font = "500 24px Space Grotesk";
    ctx.fillText("Hold jump, release to launch", WIDTH * 0.5, HEIGHT * 0.46);
    ctx.fillText("Press Enter or Start", WIDTH * 0.5, HEIGHT * 0.52);
  }

  if (game.mode === "won") {
    ctx.fillStyle = "#ffeccc";
    ctx.font = "700 52px Space Grotesk";
    ctx.fillText("CROWN CLAIMED", WIDTH * 0.5, HEIGHT * 0.39);
    ctx.font = "500 24px Space Grotesk";
    ctx.fillText(`Final Height: ${game.currentHeight}m`, WIDTH * 0.5, HEIGHT * 0.47);
    ctx.fillText("Press Enter or Restart", WIDTH * 0.5, HEIGHT * 0.53);
  }

  ctx.textAlign = "left";
}

function render() {
  ctx.save();
  if (game.shake > 0) {
    const mag = game.shake * 7;
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
  }

  drawBackground();
  drawGoal();
  drawPlatforms();
  drawSpikes();
  drawPlayer();
  drawOverlay();
  ctx.restore();
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(tick);
}

syncHud();
storyEl.textContent = storyMoments[0].line;
requestAnimationFrame(tick);
