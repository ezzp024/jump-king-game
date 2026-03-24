const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const heightEl = document.getElementById("height");
const bestEl = document.getElementById("best");
const fallsEl = document.getElementById("falls");
const checkpointEl = document.getElementById("checkpoint");
const statusEl = document.getElementById("status");
const chapterEl = document.getElementById("chapter");
const storyEl = document.getElementById("storyLine");

const heightLabelEl = document.getElementById("heightLabel");
const bestLabelEl = document.getElementById("bestLabel");
const fallsLabelEl = document.getElementById("fallsLabel");
const checkpointLabelEl = document.getElementById("checkpointLabel");

const soloBtn = document.getElementById("soloBtn");
const versusBtn = document.getElementById("versusBtn");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const stageShell = document.getElementById("stageShell");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const BASE_Y = 860;
const WORLD_TOP = -15000;
const GOAL_Y = WORLD_TOP + 120;
const FALL_LIMIT = 1080;

const GRAVITY = 2200;
const AIR_DRAG = 0.992;
const WALL_BOUNCE = -0.22;
const STORAGE_KEY = "skybound-crown-solo-best";

const keyState = {};
const touchInput = { left: false, right: false, jump: false };

const game = {
  mode: "title",
  type: "solo",
  winner: "",
  cameraY: 0,
  shake: 0,
  t: 0,
  soloBest: Number.parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10) || 0,
};

const players = [
  createPlayer("P1", "#eb6f3f", "#201a17", WIDTH * 0.45),
  createPlayer("P2", "#3a9a8e", "#182826", WIDTH * 0.55),
];

const story = [
  { at: 0, chapter: "Chapter I - Ash Road", line: "The old bell is silent. Climb to wake the city." },
  { at: 380, chapter: "Chapter II - Windcut Ledges", line: "The path tightens and the mountain tests your nerve." },
  { at: 920, chapter: "Chapter III - Broken Galleries", line: "Ancient bridges collapse under impatient steps." },
  { at: 1660, chapter: "Chapter IV - Iron Teeth", line: "Spikes guard every lazy landing." },
  { at: 2600, chapter: "Chapter V - Storm Canopy", line: "Moving relics drift through cloud and thunder." },
  { at: 3600, chapter: "Chapter VI - Bell Keep", line: "Only committed jumps survive the final climb." },
];

const raceStory = [
  "Race mode active. First to the crown wins.",
  "P1: arrows + /. P2: A/D + W.",
  "No mercy. No pause. Just climb.",
];

const world = buildLevel();
let storyIndex = 0;
let raceLineIndex = 0;
let raceStoryTimer = 0;

function createPlayer(name, mainColor, trimColor, spawnX) {
  return {
    name,
    mainColor,
    trimColor,
    x: spawnX - 13,
    y: BASE_Y - 38,
    w: 26,
    h: 38,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    charging: false,
    charge: 0,
    maxCharge: 1.3,
    jumpHeld: false,
    falls: 0,
    height: 0,
    checkpointName: "Base Camp",
    nextCheckpoint: 180,
    respawnX: spawnX - 13,
    respawnY: BASE_Y - 38,
  };
}

function buildLevel() {
  const platforms = [];
  const spikes = [];

  platforms.push({ type: "solid", x: WIDTH * 0.5 - 130, y: BASE_Y, w: 260, h: 24, broken: false, timer: 0 });

  let y = BASE_Y - 95;
  let x = WIDTH * 0.5 - 78;
  let w = 156;
  let lane = 1;

  for (let i = 0; y > WORLD_TOP + 260; i += 1) {
    const progress = (BASE_Y - y) / (BASE_Y - WORLD_TOP);
    const diff = Math.min(1, progress * 1.2);

    const gap = lerp(90 + diff * 45, 130 + diff * 95, prand(i * 17 + 9));
    y -= gap;

    const minW = 60;
    const maxW = 160 - diff * 70;
    w = clamp(maxW - prand(i * 13 + 5) * 20, minW, maxW);

    const laneShift = (prand(i * 7 + 13) - 0.5) * 2 * (115 + diff * 60);
    if (i % 6 === 0) {
      lane = (lane + 1) % 3;
      const target = lane === 0 ? 54 : lane === 1 ? WIDTH * 0.5 - w * 0.5 : WIDTH - w - 54;
      x += (target - x) * 0.65;
    } else {
      x += laneShift;
    }
    x = clamp(x, 20, WIDTH - w - 20);

    let type = "solid";
    if (diff > 0.2 && diff < 0.95 && i % 8 === 3) type = "crumbly";
    if (diff > 0.44 && i % 11 === 5) type = "moving";
    if (diff > 0.62 && i % 15 === 9) type = "spring";

    const platform = {
      type,
      x,
      y,
      w,
      h: 18,
      broken: false,
      timer: 0,
      amp: 0,
      speed: 0,
      phase: 0,
      xNow: x,
      dx: 0,
    };

    if (type === "moving") {
      platform.amp = 30 + prand(i * 10 + 2) * 60;
      platform.speed = 0.7 + prand(i * 3 + 2) * 1.1;
      platform.phase = prand(i * 8 + 6) * Math.PI * 2;
    }

    platforms.push(platform);

    if (i % 7 === 2) {
      const rescueW = clamp(w + 12, 84, 150);
      const rescueX = clamp(x + (prand(i * 5 + 4) - 0.5) * 40, 20, WIDTH - rescueW - 20);
      platforms.push({ type: "solid", x: rescueX, y: y + 66, w: rescueW, h: 14, broken: false, timer: 0, amp: 0, speed: 0, phase: 0, xNow: rescueX, dx: 0 });
    }

    if (diff > 0.3 && diff < 0.98 && i % 9 === 4) {
      const sw = clamp(w * 0.34, 22, 46);
      const sx = x + (w - sw) * clamp(prand(i * 29 + 11), 0.12, 0.88);
      spikes.push({ x: sx, y: y - 12, w: sw, h: 12 });
    }
  }

  platforms.push({ type: "solid", x: WIDTH * 0.5 - 75, y: GOAL_Y + 60, w: 150, h: 18, broken: false, timer: 0, amp: 0, speed: 0, phase: 0, xNow: WIDTH * 0.5 - 75, dx: 0 });
  return { platforms, spikes };
}

function resetWorld() {
  for (const p of world.platforms) {
    p.broken = false;
    p.timer = 0;
    p.xNow = p.x;
    p.dx = 0;
  }
}

function resetPlayer(player, spawnX) {
  player.x = spawnX - 13;
  player.y = BASE_Y - 38;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.grounded = false;
  player.charging = false;
  player.charge = 0;
  player.jumpHeld = false;
  player.falls = 0;
  player.height = 0;
  player.checkpointName = "Base Camp";
  player.nextCheckpoint = 180;
  player.respawnX = spawnX - 13;
  player.respawnY = BASE_Y - 38;
}

function startRun() {
  game.mode = "playing";
  game.winner = "";
  game.cameraY = 0;
  game.shake = 0;
  game.t = 0;

  resetWorld();
  resetPlayer(players[0], WIDTH * 0.45);
  resetPlayer(players[1], WIDTH * 0.55);

  storyIndex = 0;
  raceLineIndex = 0;
  raceStoryTimer = 0;

  if (game.type === "solo") {
    chapterEl.textContent = story[0].chapter;
    storyEl.textContent = story[0].line;
    setStatus("Climb started. Every jump counts.");
  } else {
    chapterEl.textContent = "Versus Mode - Twin Trial";
    storyEl.textContent = raceStory[0];
    setStatus("Race to the crown.");
  }

  syncHud();
}

function setStatus(text) {
  statusEl.textContent = text;
}

function chooseMode(type) {
  game.type = type;
  game.mode = "title";
  game.winner = "";
  updateModeButtons();
  if (type === "solo") {
    chapterEl.textContent = story[0].chapter;
    storyEl.textContent = story[0].line;
    setStatus("Solo mode selected. Press Start.");
  } else {
    chapterEl.textContent = "Versus Mode - Twin Trial";
    storyEl.textContent = raceStory[0];
    setStatus("Versus mode selected. Press Start.");
  }
  syncHud();
}

function updateModeButtons() {
  soloBtn.classList.toggle("mode-active", game.type === "solo");
  versusBtn.classList.toggle("mode-active", game.type === "versus");
}

function checkpointNameForHeight(h) {
  if (h < 300) return "Base Camp";
  if (h < 900) return "Ridge";
  if (h < 1600) return "Causeway";
  if (h < 2600) return "Spire";
  if (h < 3800) return "Cloud Bastion";
  return "Final Ascent";
}

function platformXAt(p, t) {
  if (p.type !== "moving") return p.x;
  return p.x + Math.sin(t * p.speed + p.phase) * p.amp;
}

function updatePlatforms(dt) {
  for (const p of world.platforms) {
    if (p.type === "crumbly" && p.timer > 0) {
      p.timer -= dt;
      if (p.timer <= 0) {
        p.broken = true;
        p.timer = 0;
      }
    }

    const prev = p.xNow;
    p.xNow = platformXAt(p, game.t);
    p.dx = p.xNow - prev;
  }
}

function getInputForPlayer(playerIndex) {
  if (playerIndex === 0) {
    if (game.type === "solo") {
      return {
        left: keyState.ArrowLeft || touchInput.left,
        right: keyState.ArrowRight || touchInput.right,
        jump: keyState.Space || touchInput.jump,
      };
    }

    return {
      left: keyState.ArrowLeft,
      right: keyState.ArrowRight,
      jump: keyState.Slash,
    };
  }

  return {
    left: keyState.KeyA,
    right: keyState.KeyD,
    jump: keyState.KeyW,
  };
}

function updatePlayer(player, controls, dt) {
  if (controls.left) player.facing = -1;
  if (controls.right) player.facing = 1;

  if (controls.jump && !player.jumpHeld && player.grounded) {
    player.charging = true;
    player.charge = 0;
  }

  if (player.charging && controls.jump && player.grounded) {
    player.charge = Math.min(player.maxCharge, player.charge + dt * 1.06);
  }

  if (!controls.jump && player.jumpHeld && player.charging && player.grounded) {
    const c = Math.max(0.08, player.charge);
    player.vy = -(500 + c * 930);
    player.vx = player.facing * (175 + c * 370);
    player.grounded = false;
    player.charging = false;
    player.charge = 0;
  }

  player.jumpHeld = controls.jump;

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
  let landed = null;

  for (const p of world.platforms) {
    if (p.broken) continue;

    const px = p.xNow;
    const touched =
      prevY + player.h <= p.y &&
      player.y + player.h >= p.y &&
      player.x + player.w > px &&
      player.x < px + p.w;

    if (touched && player.vy >= 0) {
      player.y = p.y - player.h;
      player.grounded = true;
      landed = p;

      if (p.type === "spring") {
        player.vy = -Math.max(760, Math.abs(player.vy) * 0.96);
        player.grounded = false;
      } else {
        player.vy = 0;
      }

      if (p.type === "crumbly" && p.timer <= 0) p.timer = 0.18;
      if (p.type === "moving") player.x += p.dx;
    }
  }

  for (const s of world.spikes) {
    const hit = player.x + player.w > s.x && player.x < s.x + s.w && player.y + player.h > s.y && player.y < s.y + s.h;
    if (hit) {
      player.x = prevX;
      player.y = prevY;
      losePlayer(player, "spike");
      return;
    }
  }

  if (player.y > FALL_LIMIT) {
    losePlayer(player, "fall");
    return;
  }

  player.height = Math.max(0, Math.floor((BASE_Y - player.y) / 10));

  if (player.height >= player.nextCheckpoint && landed) {
    player.nextCheckpoint += 300;
    player.checkpointName = checkpointNameForHeight(player.height);
    player.respawnX = landed.xNow + landed.w * 0.5 - player.w * 0.5;
    player.respawnY = landed.y - player.h;
    if (game.type === "solo") {
      setStatus(`Checkpoint reached: ${player.checkpointName}`);
    }
  }

  if (player.y <= GOAL_Y) {
    game.mode = "won";
    game.winner = player.name;
    if (game.type === "solo") {
      chapterEl.textContent = "Epilogue - Bell of Dawn";
      storyEl.textContent = "The bell roars across the valley. You did not stop climbing.";
      setStatus("Crown claimed. Press Enter to play again.");
    } else {
      setStatus(`${player.name} wins the race to the crown.`);
    }
  }
}

function losePlayer(player, reason) {
  player.falls += 1;
  player.x = player.respawnX;
  player.y = player.respawnY;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.charging = false;
  player.charge = 0;
  game.shake = 0.24;

  if (game.type === "solo") {
    setStatus(reason === "spike" ? "Spikes hit. Back to checkpoint." : "Long fall. Back to checkpoint.");
  }
}

function updateStory() {
  if (game.type === "solo") {
    const p1 = players[0];
    if (p1.height > game.soloBest) {
      game.soloBest = p1.height;
      localStorage.setItem(STORAGE_KEY, String(game.soloBest));
    }

    const next = story[storyIndex + 1];
    if (next && p1.height >= next.at) {
      storyIndex += 1;
      chapterEl.textContent = next.chapter;
      storyEl.textContent = next.line;
      setStatus(`New chapter: ${next.chapter}`);
    }
    return;
  }

  raceStoryTimer += 1;
  if (raceStoryTimer % 540 === 0) {
    raceLineIndex = (raceLineIndex + 1) % raceStory.length;
    storyEl.textContent = raceStory[raceLineIndex];
  }
}

function syncHud() {
  const p1 = players[0];
  const p2 = players[1];

  if (game.type === "solo") {
    heightLabelEl.textContent = "Height";
    bestLabelEl.textContent = "Best";
    fallsLabelEl.textContent = "Falls";
    checkpointLabelEl.textContent = "Checkpoint";

    heightEl.textContent = `${p1.height}m`;
    bestEl.textContent = `${game.soloBest}m`;
    fallsEl.textContent = String(p1.falls);
    checkpointEl.textContent = p1.checkpointName;
    return;
  }

  heightLabelEl.textContent = "P1 Height";
  bestLabelEl.textContent = "P2 Height";
  fallsLabelEl.textContent = "Lead";
  checkpointLabelEl.textContent = "Race";

  heightEl.textContent = `${p1.height}m`;
  bestEl.textContent = `${p2.height}m`;

  const lead = p1.height - p2.height;
  if (lead === 0) fallsEl.textContent = "Tie";
  if (lead > 0) fallsEl.textContent = `P1 +${lead}m`;
  if (lead < 0) fallsEl.textContent = `P2 +${Math.abs(lead)}m`;

  const race = Math.max(p1.height, p2.height);
  const target = Math.max(1, Math.floor((BASE_Y - GOAL_Y) / 10));
  checkpointEl.textContent = `${Math.min(100, Math.floor((race / target) * 100))}%`;
}

function update(dt) {
  if (game.mode !== "playing") return;

  game.t += dt;
  updatePlatforms(dt);

  updatePlayer(players[0], getInputForPlayer(0), dt);
  if (game.type === "versus") {
    updatePlayer(players[1], getInputForPlayer(1), dt);
  }

  updateStory();

  const camTarget = game.type === "solo"
    ? players[0].y - HEIGHT * 0.62
    : Math.min(players[0].y, players[1].y) - HEIGHT * 0.64;

  game.cameraY += (camTarget - game.cameraY) * Math.min(1, dt * 5.2);
  game.cameraY = clamp(game.cameraY, WORLD_TOP, BASE_Y + 40);
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);

  syncHud();
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, "#95bfe5");
  g.addColorStop(0.52, "#f3dbc0");
  g.addColorStop(1, "#cf8f67");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const far = game.cameraY * 0.05;
  const near = game.cameraY * 0.1;

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  for (let i = 0; i < 12; i += 1) {
    const x = ((i * 96 + near) % (WIDTH + 160)) - 80;
    const y = 70 + i * 80;
    ctx.beginPath();
    ctx.ellipse(x, y, 44, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(80, 54, 42, 0.2)";
  for (let i = 0; i < 8; i += 1) {
    const x = i * 100 - (far % 100);
    ctx.beginPath();
    ctx.moveTo(x, HEIGHT);
    ctx.lineTo(x + 52, HEIGHT - 150 - (i % 2) * 18);
    ctx.lineTo(x + 140, HEIGHT);
    ctx.fill();
  }
}

function drawGoal() {
  const y = GOAL_Y - game.cameraY;
  if (y < -160 || y > HEIGHT + 100) return;

  ctx.fillStyle = "#6b4632";
  ctx.fillRect(WIDTH * 0.5 - 5, y - 100, 10, 108);

  ctx.fillStyle = "#7b2418";
  ctx.fillRect(WIDTH * 0.5 + 5, y - 132, 36, 24);

  ctx.fillStyle = "#f9c45a";
  ctx.beginPath();
  ctx.arc(WIDTH * 0.5, y - 104, 19, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlatforms() {
  for (const p of world.platforms) {
    if (p.broken) continue;

    const py = p.y - game.cameraY;
    if (py < -30 || py > HEIGHT + 30) continue;

    if (p.type === "solid") ctx.fillStyle = "#8c5f47";
    if (p.type === "crumbly") ctx.fillStyle = "#a48261";
    if (p.type === "spring") ctx.fillStyle = "#3f684f";
    if (p.type === "moving") ctx.fillStyle = "#4d5872";

    if (p.timer > 0) ctx.globalAlpha = 0.72;
    ctx.fillRect(p.xNow, py, p.w, p.h);
    ctx.fillStyle = "rgba(255, 239, 211, 0.34)";
    ctx.fillRect(p.xNow + 4, py + 3, Math.max(8, p.w - 8), 4);
    ctx.globalAlpha = 1;
  }
}

function drawSpikes() {
  ctx.fillStyle = "#6d3a34";
  for (const s of world.spikes) {
    const sy = s.y - game.cameraY;
    if (sy < -24 || sy > HEIGHT + 24) continue;

    const count = Math.max(2, Math.floor(s.w / 10));
    const slice = s.w / count;
    for (let i = 0; i < count; i += 1) {
      const x0 = s.x + i * slice;
      ctx.beginPath();
      ctx.moveTo(x0, sy + s.h);
      ctx.lineTo(x0 + slice * 0.5, sy);
      ctx.lineTo(x0 + slice, sy + s.h);
      ctx.fill();
    }
  }
}

function drawPlayer(player) {
  if (game.type === "solo" && player.name === "P2") return;

  const px = player.x;
  const py = player.y - game.cameraY;

  ctx.fillStyle = player.trimColor;
  ctx.fillRect(px, py, player.w, player.h);
  ctx.fillStyle = player.mainColor;
  ctx.fillRect(px + 4, py + 7, player.w - 8, player.h - 11);

  const eyeX = player.facing > 0 ? px + player.w - 8 : px + 4;
  ctx.fillStyle = "#fff";
  ctx.fillRect(eyeX, py + 10, 4, 4);

  ctx.fillStyle = "rgba(18, 14, 11, 0.72)";
  ctx.font = "700 12px Space Grotesk";
  ctx.fillText(player.name, px - 2, py - 5);

  if (player.grounded && player.charging) {
    const r = player.charge / player.maxCharge;
    const bw = 74;
    const bx = px + player.w * 0.5 - bw * 0.5;
    const by = py - 16;
    ctx.fillStyle = "rgba(22, 15, 11, 0.46)";
    ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = player.mainColor;
    ctx.fillRect(bx, by, bw * r, 6);
  }
}

function drawOverlay() {
  if (game.mode === "playing") return;

  ctx.fillStyle = "rgba(20, 14, 11, 0.78)";
  ctx.fillRect(36, HEIGHT * 0.27, WIDTH - 72, 250);
  ctx.textAlign = "center";

  if (game.mode === "title") {
    ctx.fillStyle = "#ffefcf";
    ctx.font = "700 46px Space Grotesk";
    ctx.fillText("SKYBOUND CROWN", WIDTH * 0.5, HEIGHT * 0.38);
    ctx.font = "500 22px Space Grotesk";
    if (game.type === "solo") {
      ctx.fillText("Solo climb across a giant mountain", WIDTH * 0.5, HEIGHT * 0.45);
    } else {
      ctx.fillText("Two-player race to the crown", WIDTH * 0.5, HEIGHT * 0.45);
    }
    ctx.fillText("Press Enter or Start", WIDTH * 0.5, HEIGHT * 0.51);
  }

  if (game.mode === "won") {
    ctx.fillStyle = "#ffedca";
    ctx.font = "700 48px Space Grotesk";
    ctx.fillText("CROWN CLAIMED", WIDTH * 0.5, HEIGHT * 0.39);
    ctx.font = "500 24px Space Grotesk";
    if (game.type === "solo") {
      ctx.fillText(`Final Height: ${players[0].height}m`, WIDTH * 0.5, HEIGHT * 0.47);
    } else {
      ctx.fillText(`${game.winner} wins the race`, WIDTH * 0.5, HEIGHT * 0.47);
    }
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
  drawPlayer(players[0]);
  drawPlayer(players[1]);
  drawOverlay();
  ctx.restore();
}

function bindPointer(button, onDown, onUp) {
  const down = (event) => {
    event.preventDefault();
    onDown();
  };
  button.addEventListener("mousedown", down);
  button.addEventListener("touchstart", down, { passive: false });

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

for (const button of document.querySelectorAll("button[data-key]")) {
  const key = button.dataset.key;
  if (key === "jump") {
    bindPointer(
      button,
      () => {
        touchInput.jump = true;
        button.classList.add("active");
      },
      () => {
        touchInput.jump = false;
        button.classList.remove("active");
      }
    );
    continue;
  }

  bindPointer(
    button,
    () => {
      touchInput[key] = true;
      button.classList.add("active");
    },
    () => {
      touchInput[key] = false;
      button.classList.remove("active");
    }
  );
}

bindPointer(soloBtn, () => chooseMode("solo"));
bindPointer(versusBtn, () => chooseMode("versus"));
bindPointer(startBtn, () => startRun());
bindPointer(restartBtn, () => startRun());
bindPointer(fullscreenBtn, async () => {
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

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "KeyA", "KeyD", "KeyW", "Space", "Slash", "Enter", "KeyR"].includes(event.code)) {
    event.preventDefault();
  }

  keyState[event.code] = true;

  if (event.code === "Enter" && (game.mode === "title" || game.mode === "won")) startRun();
  if (event.code === "KeyR") startRun();
});

window.addEventListener("keyup", (event) => {
  keyState[event.code] = false;
});

function tick(now) {
  const dt = Math.min(0.033, (now - tick.last) / 1000);
  tick.last = now;
  update(dt);
  render();
  requestAnimationFrame(tick);
}
tick.last = performance.now();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function prand(n) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

updateModeButtons();
syncHud();
chapterEl.textContent = story[0].chapter;
storyEl.textContent = story[0].line;
setStatus("Choose Solo or Versus, then press Start.");
requestAnimationFrame(tick);
