const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const heightEl = document.getElementById("height");
const bestEl = document.getElementById("best");
const fallsEl = document.getElementById("falls");
const checkpointEl = document.getElementById("checkpoint");
const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_BOTTOM = 710;
const WORLD_TOP = -7200;
const GOAL_Y = WORLD_TOP + 120;
const BASE_Y = 628;

const GRAVITY = 2050;
const AIR_DRAG = 0.994;
const WALL_BOUNCE = -0.22;
const FALL_LIMIT = 880;

const STORAGE_KEY = "skybound-crown-best";

const input = { left: false, right: false, jump: false };

const player = {
  x: WIDTH * 0.5 - 13,
  y: BASE_Y - 36,
  w: 26,
  h: 36,
  vx: 0,
  vy: 0,
  facing: 1,
  grounded: false,
  charging: false,
  charge: 0,
  maxCharge: 1.33,
};

const run = {
  mode: "title",
  cameraY: 0,
  shake: 0,
  falls: 0,
  best: Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0,
  currentHeight: 0,
  checkpointHeight: 0,
  nextCheckpointMilestone: 120,
  checkpointName: "Base Camp",
  respawnX: WIDTH * 0.5 - 13,
  respawnY: BASE_Y - 36,
  deathMessage: "",
};

const level = buildLevel(3407);

function mulberry32(seed) {
  let t = seed;
  return function rand() {
    t += 0x6d2b79f5;
    let v = Math.imul(t ^ (t >>> 15), t | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLevel(seed) {
  const rand = mulberry32(seed);
  const platforms = [];
  const spikes = [];

  platforms.push({ x: WIDTH * 0.5 - 100, y: BASE_Y, w: 200, h: 24, type: "solid", broken: false, timer: 0 });

  let y = BASE_Y - 110;
  let side = 1;
  let layer = 0;

  while (y > WORLD_TOP + 180) {
    const progress = (BASE_Y - y) / (BASE_Y - WORLD_TOP);
    const gap = 92 + progress * 58 + rand() * 26;
    y -= gap;
    layer += 1;

    const minW = 68;
    const maxW = 140 - progress * 55;
    const w = Math.max(minW, maxW + rand() * 16);
    const margin = 28;
    side *= -1;

    let x;
    if (side > 0) {
      x = margin + rand() * (WIDTH * 0.4);
    } else {
      x = WIDTH - w - margin - rand() * (WIDTH * 0.4);
    }
    x = Math.max(margin, Math.min(WIDTH - w - margin, x));

    let type = "solid";
    if (progress > 0.2 && progress < 0.9 && rand() < 0.15) type = "crumbly";
    if (progress > 0.58 && rand() < 0.08) type = "spring";

    platforms.push({ x, y, w, h: 18, type, broken: false, timer: 0 });

    if (layer % 7 === 0) {
      const rw = 98 + rand() * 40;
      const rx = WIDTH * 0.5 - rw * 0.5 + (rand() - 0.5) * 44;
      const ry = y - 72 - rand() * 34;
      platforms.push({
        x: Math.max(20, Math.min(WIDTH - rw - 20, rx)),
        y: ry,
        w: rw,
        h: 16,
        type: "solid",
        broken: false,
        timer: 0,
      });
    }

    if (progress > 0.28 && progress < 0.95 && rand() < 0.14) {
      const sw = Math.max(18, Math.min(44, w * (0.3 + rand() * 0.26)));
      const sx = x + rand() * (w - sw);
      spikes.push({ x: sx, y: y - 11, w: sw, h: 11 });
    }
  }

  platforms.push({
    x: WIDTH * 0.5 - 62,
    y: GOAL_Y + 48,
    w: 124,
    h: 18,
    type: "solid",
    broken: false,
    timer: 0,
  });

  return { platforms, spikes };
}

function setInput(key, value) {
  input[key] = value;
  const button = document.querySelector(`button[data-key="${key}"]`);
  if (button) button.classList.toggle("active", value);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function checkpointLabel(heightMeters) {
  if (heightMeters < 180) return "Base Camp";
  if (heightMeters < 460) return "Boulder Pass";
  if (heightMeters < 900) return "Glass Ridge";
  if (heightMeters < 1400) return "Hammer Spine";
  if (heightMeters < 1900) return "Cloud Bastion";
  return "Final Climb";
}

function updateHud() {
  heightEl.textContent = `${run.currentHeight}m`;
  bestEl.textContent = `${run.best}m`;
  fallsEl.textContent = String(run.falls);
  checkpointEl.textContent = run.checkpointName;
}

function resetPlayerToSpawn() {
  player.x = run.respawnX;
  player.y = run.respawnY;
  player.vx = 0;
  player.vy = 0;
  player.charge = 0;
  player.charging = false;
  player.grounded = false;
}

function startRun() {
  run.mode = "playing";
  run.cameraY = 0;
  run.shake = 0;
  run.falls = 0;
  run.currentHeight = 0;
  run.checkpointHeight = 0;
  run.nextCheckpointMilestone = 120;
  run.checkpointName = "Base Camp";
  run.respawnX = WIDTH * 0.5 - 13;
  run.respawnY = BASE_Y - 36;
  run.deathMessage = "";

  for (const platform of level.platforms) {
    platform.broken = false;
    platform.timer = 0;
  }

  resetPlayerToSpawn();
  setStatus("Climb to the crown. One fall can cost everything.");
  updateHud();
}

function knockout(message) {
  run.falls += 1;
  run.shake = 0.3;
  run.deathMessage = message;
  resetPlayerToSpawn();
  setStatus(message);
}

function maybeUnlockCheckpoint(landedPlatform) {
  if (!landedPlatform) return;
  if (run.currentHeight < run.nextCheckpointMilestone) return;

  run.checkpointHeight = run.currentHeight;
  run.checkpointName = checkpointLabel(run.currentHeight);
  run.respawnX = landedPlatform.x + landedPlatform.w * 0.5 - player.w * 0.5;
  run.respawnY = landedPlatform.y - player.h;
  run.nextCheckpointMilestone += 220;
  setStatus(`Checkpoint reached: ${run.checkpointName}`);
}

function startCharge() {
  if (run.mode !== "playing") return;
  if (!player.grounded) return;
  player.charging = true;
  player.charge = 0;
}

function releaseJump() {
  if (run.mode !== "playing") return;
  if (!player.charging || !player.grounded) return;

  const charge = Math.max(0.08, player.charge);
  const jumpPower = 470 + charge * 910;
  const push = 170 + charge * 360;

  player.vy = -jumpPower;
  player.vx = player.facing * push;
  player.grounded = false;
  player.charging = false;
  player.charge = 0;
}

function pointerDownForButton(button, fn) {
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    fn();
  });
  button.addEventListener(
    "touchstart",
    (event) => {
      event.preventDefault();
      fn();
    },
    { passive: false }
  );
}

function pointerUpForButton(button, fn) {
  const wrapped = (event) => {
    event.preventDefault();
    fn();
  };
  button.addEventListener("mouseup", wrapped);
  button.addEventListener("mouseleave", wrapped);
  button.addEventListener("touchend", wrapped);
  button.addEventListener("touchcancel", wrapped);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space", "Enter", "KeyR"].includes(event.code)) {
    event.preventDefault();
  }

  if ((event.code === "ArrowLeft" || event.code === "KeyA") && run.mode === "playing") setInput("left", true);
  if ((event.code === "ArrowRight" || event.code === "KeyD") && run.mode === "playing") setInput("right", true);

  if (event.code === "Space" && !input.jump) {
    setInput("jump", true);
    startCharge();
  }

  if (event.code === "Enter") {
    if (run.mode === "title" || run.mode === "won") {
      startRun();
    }
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
    pointerDownForButton(button, () => {
      if (!input.jump) {
        setInput("jump", true);
        startCharge();
      }
    });
    pointerUpForButton(button, () => {
      setInput("jump", false);
      releaseJump();
    });
  } else {
    pointerDownForButton(button, () => {
      if (run.mode === "playing") setInput(key, true);
    });
    pointerUpForButton(button, () => {
      setInput(key, false);
    });
  }
}

pointerDownForButton(startBtn, () => {
  if (run.mode === "title" || run.mode === "won") {
    startRun();
  } else {
    setStatus("Run already active.");
  }
});

pointerDownForButton(restartBtn, () => {
  startRun();
});

function update(dt) {
  if (run.mode !== "playing") return;

  if (input.left) player.facing = -1;
  if (input.right) player.facing = 1;

  if (player.charging && input.jump && player.grounded) {
    player.charge = Math.min(player.maxCharge, player.charge + dt * 1.12);
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

  let landedPlatform = null;
  player.grounded = false;

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
        player.vy = -Math.max(740, Math.abs(player.vy) * 0.98);
        player.grounded = false;
        landedPlatform = null;
        player.charging = false;
        player.charge = 0;
      } else {
        player.vy = 0;
      }

      if (platform.type === "crumbly" && platform.timer <= 0) {
        platform.timer = 0.15;
      }
    }
  }

  for (const spike of level.spikes) {
    const overlap =
      player.x + player.w > spike.x &&
      player.x < spike.x + spike.w &&
      player.y + player.h > spike.y &&
      player.y < spike.y + spike.h;
    if (overlap) {
      knockdownFrom(prevX, prevY);
      return;
    }
  }

  if (player.y > FALL_LIMIT) {
    knockout("Long fall. Back to checkpoint.");
    return;
  }

  run.currentHeight = Math.max(0, Math.floor((BASE_Y - player.y) / 10));
  if (run.currentHeight > run.best) {
    run.best = run.currentHeight;
    localStorage.setItem(STORAGE_KEY, String(run.best));
  }

  maybeUnlockCheckpoint(landedPlatform);

  if (player.y <= GOAL_Y) {
    run.mode = "won";
    setStatus("You claimed the crown. Press Enter to run again.");
  }

  const targetCamera = player.y - HEIGHT * 0.58;
  run.cameraY += (targetCamera - run.cameraY) * Math.min(1, dt * 5.5);
  run.cameraY = Math.max(WORLD_TOP, Math.min(WORLD_BOTTOM, run.cameraY));

  if (run.shake > 0) run.shake = Math.max(0, run.shake - dt);

  updateHud();
}

function knockdownFrom(prevX, prevY) {
  player.x = prevX;
  player.y = prevY;
  knockout("Spikes! You were knocked down.");
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#b8d6f2");
  gradient.addColorStop(0.56, "#efe3ce");
  gradient.addColorStop(1, "#e0b088");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const parallax = run.cameraY * 0.12;
  for (let i = 0; i < 8; i += 1) {
    const x = ((i * 74 + parallax) % (WIDTH + 120)) - 60;
    const y = 60 + i * 78;
    ctx.fillStyle = "rgba(255, 255, 255, 0.42)";
    ctx.beginPath();
    ctx.ellipse(x, y, 42, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(82, 60, 48, 0.28)";
  for (let i = 0; i < 6; i += 1) {
    const sx = i * 100 - ((run.cameraY * 0.06) % 100);
    ctx.beginPath();
    ctx.moveTo(sx, HEIGHT);
    ctx.lineTo(sx + 60, HEIGHT - 120 - (i % 2) * 20);
    ctx.lineTo(sx + 130, HEIGHT);
    ctx.fill();
  }
}

function drawGoal() {
  const y = GOAL_Y - run.cameraY;
  if (y < -140 || y > HEIGHT + 90) return;

  ctx.fillStyle = "#674329";
  ctx.fillRect(WIDTH * 0.5 - 5, y - 88, 10, 100);

  ctx.fillStyle = "#7a2817";
  ctx.fillRect(WIDTH * 0.5 + 5, y - 116, 30, 22);

  ctx.fillStyle = "#f8c55a";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.5, y - 98, 18, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpikes() {
  ctx.fillStyle = "#6d3b34";
  for (const spike of level.spikes) {
    const sy = spike.y - run.cameraY;
    if (sy < -20 || sy > HEIGHT + 20) continue;
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

function drawPlatforms() {
  for (const platform of level.platforms) {
    const py = platform.y - run.cameraY;
    if (py < -30 || py > HEIGHT + 30) continue;
    if (platform.broken) continue;

    if (platform.type === "solid") ctx.fillStyle = "#8b5f45";
    if (platform.type === "crumbly") ctx.fillStyle = "#9e7f5f";
    if (platform.type === "spring") ctx.fillStyle = "#406350";

    if (platform.timer > 0) {
      ctx.globalAlpha = 0.7;
    }

    ctx.fillRect(platform.x, py, platform.w, platform.h);
    ctx.fillStyle = "rgba(255, 240, 217, 0.34)";
    ctx.fillRect(platform.x + 4, py + 3, Math.max(8, platform.w - 8), 4);
    ctx.globalAlpha = 1;
  }
}

function drawPlayer() {
  const px = player.x;
  const py = player.y - run.cameraY;

  ctx.fillStyle = "#1c1918";
  ctx.fillRect(px, py, player.w, player.h);

  ctx.fillStyle = "#ea6f40";
  ctx.fillRect(px + 4, py + 7, player.w - 8, player.h - 10);

  const eyeX = player.facing > 0 ? px + player.w - 8 : px + 4;
  ctx.fillStyle = "#fff";
  ctx.fillRect(eyeX, py + 10, 4, 4);

  if (player.grounded && player.charging) {
    const ratio = player.charge / player.maxCharge;
    const bw = 76;
    const bx = px + player.w * 0.5 - bw * 0.5;
    const by = py - 14;
    ctx.fillStyle = "rgba(21, 13, 9, 0.5)";
    ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = "#ff7f4e";
    ctx.fillRect(bx, by, bw * ratio, 6);
  }
}

function drawOverlay() {
  if (run.mode === "playing") return;

  ctx.fillStyle = "rgba(19, 14, 11, 0.74)";
  ctx.fillRect(22, HEIGHT * 0.24, WIDTH - 44, 220);
  ctx.textAlign = "center";

  if (run.mode === "title") {
    ctx.fillStyle = "#fff3dd";
    ctx.font = "700 38px Space Grotesk";
    ctx.fillText("SKYBOUND CROWN", WIDTH * 0.5, HEIGHT * 0.34);
    ctx.font = "500 20px Space Grotesk";
    ctx.fillText("Hold jump, release to launch", WIDTH * 0.5, HEIGHT * 0.41);
    ctx.fillText("Press Enter or Start Run", WIDTH * 0.5, HEIGHT * 0.47);
  }

  if (run.mode === "won") {
    ctx.fillStyle = "#fff0d0";
    ctx.font = "700 42px Space Grotesk";
    ctx.fillText("CROWN CLAIMED", WIDTH * 0.5, HEIGHT * 0.35);
    ctx.font = "500 22px Space Grotesk";
    ctx.fillText(`Final height: ${run.currentHeight}m`, WIDTH * 0.5, HEIGHT * 0.43);
    ctx.fillText("Press Enter or Restart", WIDTH * 0.5, HEIGHT * 0.49);
  }

  ctx.textAlign = "left";
}

function render() {
  ctx.save();
  if (run.shake > 0) {
    const amount = run.shake * 8;
    const dx = (Math.random() * 2 - 1) * amount;
    const dy = (Math.random() * 2 - 1) * amount;
    ctx.translate(dx, dy);
  }

  drawBackground();
  drawGoal();
  drawPlatforms();
  drawSpikes();
  drawPlayer();
  drawOverlay();
  ctx.restore();
}

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

updateHud();
requestAnimationFrame(frame);
