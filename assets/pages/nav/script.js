const leftBar = document.getElementById("leftBar");
const leftBarBtn = document.getElementById("leftBarBtn");

const rightBar = document.getElementById("rightBar");
const rightBarBtn = document.getElementById("rightBarBtn");

const iframe = document.getElementById("myIframe");

// --- SIDE BARS ---
leftBarBtn.addEventListener("click", () => {
  leftBar.classList.toggle("leftBarOpen");
  leftBarBtn.classList.toggle("rotateRight")
});

rightBarBtn.addEventListener("click", () => {
  rightBar.classList.toggle("rightBarOpen");
  rightBarBtn.classList.toggle("rotateLeft")
});

// --- FULLSCREEN SAFE ---
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

const fullBtn = document.getElementById("fullScreenBtn");
const goBtn = document.getElementById("goDownBtn");

// FULLSCREEN
if (fullBtn) {
  fullBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFullscreen();
  });
}

// --- IFRAME CORE ---
function win() {
  return iframe?.contentWindow;
}

function scrollY(w) {
  return w.scrollY || w.document.documentElement.scrollTop || 0;
}

function scrollBottom(w) {
  const doc = w.document.documentElement;
  return doc.scrollHeight - w.innerHeight;
}

function scrollIframe(amount) {
  const w = win();
  if (!w) return;
  w.scrollBy({ top: amount, behavior: "smooth" });
}

function scrollIframeTop() {
  const w = win();
  if (!w) return;
  w.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollIframeBottom() {
  const w = win();
  if (!w) return;
  w.scrollTo({ top: scrollBottom(w), behavior: "smooth" });
}

// --- STATE: TOP vs NOT TOP ---
function updateGoButton() {
  const w = win();
  if (!w || !goBtn) return;

  const y = scrollY(w);

  // FIX: lógica correcta
  if (y <= 200) {
   
    goBtn.classList.remove("rotated180")
  } else {
    
    goBtn.classList.add("rotated180")
  }
}

// --- CLICK BEHAVIOR (single button dual state) ---
if (goBtn) {
  goBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const w = win();
    if (!w) return;

    const y = scrollY(w);

    if (y <= 200) {
      scrollIframeBottom();
    } else {
      scrollIframeTop();
    }
  });
}

// --- SCROLL LISTENER ---
function attachScroll() {
  const w = win();
  if (!w) return;

  w.addEventListener("scroll", updateGoButton);
}



// --- INIT ---
iframe.addEventListener("load", () => {
  attachScroll();
  updateGoButton();
  myIframe.style= "background-color: rgba(255, 255, 255, 0.5);border-top: 1px solid rgba(255, 255, 255, 0); border-bottom: 1px solid rgba(255, 255, 255, 0);"
});