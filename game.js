const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const heightEl = document.getElementById("height");
const bestEl = document.getElementById("best");
const fallsEl = document.getElementById("falls");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const WORLD_TOP = -5600;
const GOAL_Y = WORLD_TOP + 140;

const player = {
  x: WIDTH * 0.5,
  y: 610,
  w: 26,
  h: 36,
  vx: 0,
  vy: 0,
  facing: 1,
  grounded: false,
  charging: false,
  charge: 0,
  maxCharge: 1.25,
};

const state = {
  cameraY: 0,
  bestHeight: 0,
  falls: 0,
  won: false,
};

const input = {
  left: false,
  right: false,
  jump: false,
};

const GRAVITY = 1750;
const FRICTION = 0.86;

const platforms = makePlatforms();

function makePlatforms() {
  const p = [
    { x: WIDTH * 0.5 - 90, y: 660, w: 180, h: 24, color: "#7f5941" },
  ];

  let y = 560;
  let side = 1;
  while (y > WORLD_TOP + 220) {
    const band = (560 - y) / (560 - WORLD_TOP);
    const gap = 95 + band * 48 + Math.random() * 35;
    y -= gap;

    const width = 140 - band * 62 + Math.random() * 16;
    side *= -1;
    const minX = 40;
    const maxX = WIDTH - width - 40;

    let x;
    if (side > 0) {
      x = minX + Math.random() * (WIDTH * 0.34);
    } else {
      x = maxX - Math.random() * (WIDTH * 0.34);
    }
    x = Math.min(maxX, Math.max(minX, x));

    p.push({
      x,
      y,
      w: width,
      h: 20,
      color: band > 0.65 ? "#6f4f3f" : "#8a6349",
    });
  }

  p.push({ x: WIDTH * 0.5 - 60, y: GOAL_Y + 55, w: 120, h: 20, color: "#5c4538" });
  return p;
}

function setInput(key, on) {
  input[key] = on;
  const btn = document.querySelector(`button[data-key="${key}"]`);
  if (btn) btn.classList.toggle("active", on);
}

function startCharge() {
  if (player.grounded) {
    player.charging = true;
    player.charge = 0;
  }
}

function releaseJump() {
  if (!player.charging || !player.grounded || state.won) return;
  const power = 540 + player.charge * 760;
  player.vy = -power;
  player.vx = player.facing * (160 + player.charge * 290);
  player.grounded = false;
  player.charging = false;
  player.charge = 0;
}

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(e.code)) {
    e.preventDefault();
  }
  if (e.code === "ArrowLeft" || e.code === "KeyA") setInput("left", true);
  if (e.code === "ArrowRight" || e.code === "KeyD") setInput("right", true);
  if (e.code === "Space" && !input.jump) {
    setInput("jump", true);
    startCharge();
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") setInput("left", false);
  if (e.code === "ArrowRight" || e.code === "KeyD") setInput("right", false);
  if (e.code === "Space") {
    setInput("jump", false);
    releaseJump();
  }
});

for (const button of document.querySelectorAll("button[data-key]")) {
  const key = button.dataset.key;
  if (key === "jump") {
    const down = (e) => {
      e.preventDefault();
      if (!input.jump) {
        setInput("jump", true);
        startCharge();
      }
    };
    const up = (e) => {
      e.preventDefault();
      setInput("jump", false);
      releaseJump();
    };
    button.addEventListener("mousedown", down);
    button.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("mouseup", up);
    button.addEventListener("touchend", up);
    button.addEventListener("touchcancel", up);
  } else {
    const down = (e) => {
      e.preventDefault();
      setInput(key, true);
    };
    const up = (e) => {
      e.preventDefault();
      setInput(key, false);
    };
    button.addEventListener("mousedown", down);
    button.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("mouseup", up);
    button.addEventListener("mouseleave", up);
    button.addEventListener("touchend", up);
    button.addEventListener("touchcancel", up);
  }
}

function resetFromFall() {
  state.falls += 1;
  player.x = WIDTH * 0.5;
  player.y = 610;
  player.vx = 0;
  player.vy = 0;
  player.charge = 0;
  player.charging = false;
  player.grounded = false;
}

function update(dt) {
  if (state.won) return;

  if (input.left) player.facing = -1;
  if (input.right) player.facing = 1;

  if (player.charging && input.jump && player.grounded) {
    player.charge = Math.min(player.maxCharge, player.charge + dt * 1.2);
  }

  player.vy += GRAVITY * dt;
  player.vx *= FRICTION;

  const prevY = player.y;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  if (player.x < 0) {
    player.x = 0;
    player.vx *= -0.25;
  }
  if (player.x + player.w > WIDTH) {
    player.x = WIDTH - player.w;
    player.vx *= -0.25;
  }

  player.grounded = false;
  for (const plat of platforms) {
    const landed =
      prevY + player.h <= plat.y &&
      player.y + player.h >= plat.y &&
      player.x + player.w > plat.x &&
      player.x < plat.x + plat.w;
    if (landed) {
      player.y = plat.y - player.h;
      player.vy = 0;
      player.grounded = true;
    }
  }

  if (player.y > 800) {
    resetFromFall();
  }

  const reachedHeight = Math.max(0, Math.floor((620 - player.y) / 10));
  state.bestHeight = Math.max(state.bestHeight, reachedHeight);

  if (player.y <= GOAL_Y) {
    state.won = true;
  }

  const targetCam = player.y - HEIGHT * 0.56;
  state.cameraY += (targetCam - state.cameraY) * Math.min(1, dt * 4.2);
  state.cameraY = Math.max(WORLD_TOP, Math.min(680, state.cameraY));
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, "#cee2f4");
  grad.addColorStop(0.64, "#f3e2c9");
  grad.addColorStop(1, "#e8b98f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let i = 0; i < 6; i += 1) {
    const x = (i * 98 + (state.cameraY * 0.15) % 120 + 40) % (WIDTH + 80) - 40;
    const y = 90 + i * 90;
    ctx.fillStyle = "rgba(255,255,255,0.44)";
    ctx.beginPath();
    ctx.ellipse(x, y, 42, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGoal() {
  const y = GOAL_Y - state.cameraY;
  if (y < -60 || y > HEIGHT + 120) return;

  ctx.fillStyle = "#684028";
  ctx.fillRect(WIDTH * 0.5 - 4, y - 80, 8, 90);

  ctx.fillStyle = "#f8b949";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.5, y - 92, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7f2f1c";
  ctx.fillRect(WIDTH * 0.5 + 4, y - 120, 28, 18);
}

function drawPlatforms() {
  for (const plat of platforms) {
    const py = plat.y - state.cameraY;
    if (py < -30 || py > HEIGHT + 30) continue;
    ctx.fillStyle = plat.color;
    ctx.fillRect(plat.x, py, plat.w, plat.h);
    ctx.fillStyle = "rgba(255, 233, 200, 0.26)";
    ctx.fillRect(plat.x + 4, py + 3, Math.max(8, plat.w - 8), 4);
  }
}

function drawPlayer() {
  const px = player.x;
  const py = player.y - state.cameraY;

  ctx.fillStyle = "#1f1b1a";
  ctx.fillRect(px, py, player.w, player.h);
  ctx.fillStyle = "#ec7344";
  ctx.fillRect(px + 4, py + 8, player.w - 8, player.h - 12);

  const eyeX = player.facing > 0 ? px + player.w - 8 : px + 5;
  ctx.fillStyle = "#fff";
  ctx.fillRect(eyeX, py + 10, 4, 4);

  if (player.charging && player.grounded) {
    const ratio = player.charge / player.maxCharge;
    const barW = 70;
    const bx = px + player.w * 0.5 - barW * 0.5;
    const by = py - 14;
    ctx.fillStyle = "rgba(32, 20, 15, 0.45)";
    ctx.fillRect(bx, by, barW, 6);
    ctx.fillStyle = "#ff7847";
    ctx.fillRect(bx, by, barW * ratio, 6);
  }
}

function drawText() {
  const currentHeight = Math.max(0, Math.floor((620 - player.y) / 10));
  heightEl.textContent = `${currentHeight}m`;
  bestEl.textContent = `${state.bestHeight}m`;
  fallsEl.textContent = String(state.falls);

  if (state.won) {
    ctx.fillStyle = "rgba(25, 18, 14, 0.76)";
    ctx.fillRect(22, HEIGHT * 0.36, WIDTH - 44, 150);
    ctx.fillStyle = "#fff5e2";
    ctx.textAlign = "center";
    ctx.font = "700 42px Space Grotesk";
    ctx.fillText("CROWN CLAIMED", WIDTH * 0.5, HEIGHT * 0.46);
    ctx.font = "500 20px Space Grotesk";
    ctx.fillText("Refresh the page to play again", WIDTH * 0.5, HEIGHT * 0.53);
    ctx.textAlign = "left";
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  update(dt);
  drawBackground();
  drawGoal();
  drawPlatforms();
  drawPlayer();
  drawText();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
