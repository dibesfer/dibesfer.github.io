const leftBar = document.getElementById("leftBar");
const leftBarBtn = document.getElementById("leftBarBtn");

const rightBar = document.getElementById("rightBar");
const rightBarBtn = document.getElementById("rightBarBtn");

const bottomBar = document.getElementById("bottomBar");

const iframe = document.getElementById("myIframe");

// --- SIDE BARS ---
leftBarBtn.addEventListener("click", () => {
  leftBar.classList.toggle("leftBarOpen");
});

rightBarBtn.addEventListener("click", () => {
  rightBar.classList.toggle("rightBarOpen");
});

// --- FULLSCREEN ---
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

// FULLSCREEN solo si no es UP/DOWN
bottomBar.addEventListener("click", (e) => {
  const txt = e.target.textContent.trim();

  if (txt === "UP" || txt === "DOWN") return;

  toggleFullscreen();
});

// --- IFRAME SCROLL CORE ---
function getIframeWindow() {
  return iframe?.contentWindow;
}

function scrollIframe(amount) {
  const win = getIframeWindow();
  if (!win) return;

  win.scrollBy({
    top: amount,
    behavior: "smooth",
  });
}

function scrollIframeTop() {
  const win = getIframeWindow();
  if (!win) return;

  win.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// detect UP / DOWN (solo 2 botones reales)
const buttons = bottomBar.querySelectorAll("div");
const upBtn = buttons[1];
const downBtn = buttons[2];

upBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  const win = getIframeWindow();
  if (!win) return;

  const y = win.scrollY || win.document.documentElement.scrollTop;

  if (y > 200) {
    scrollIframeTop();
  } else {
    scrollIframe(-win.innerHeight);
  }
});

downBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  const win = getIframeWindow();
  if (!win) return;

  scrollIframe(win.innerHeight);
});

// keyboard controls (iframe-aware)
window.addEventListener("keydown", (e) => {
  const win = getIframeWindow();
  if (!win) return;

  if (e.key === "ArrowUp") {
    win.scrollBy({ top: -win.innerHeight, behavior: "smooth" });
  }

  if (e.key === "ArrowDown") {
    win.scrollBy({ top: win.innerHeight, behavior: "smooth" });
  }

  if (e.key === "f") toggleFullscreen();
});