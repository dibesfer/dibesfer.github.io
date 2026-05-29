const ROUTES = {
  gallery: "/assets/gallery",
  games: "/assets/games",
  web: "/assets/web",
  fonish: "/assets/web/conlang/fonish",
  dibesGallery: "/assets/web/dibesgallery"
};

// --- ELEMENTS ---

let allIframeLinks = document.querySelectorAll("[data-iframe-link]");
let selectedIframeLink;

// --- CORE ---
function changeIframeSrc(src, selectedEl = null) {
  if (!iframe || !src) return;

  // clear previous selection
  allIframeLinks.forEach(el => {
    el.classList.remove("selectedLinkIframe");
  });

  // apply new selection
  if (selectedEl) {
    selectedEl.classList.add("selectedLinkIframe");
    selectedIframeLink = selectedEl;
  }

  // change iframe
  iframe.src = src;
}

// --- URL ROUTING ---
function loadRouteFromURL() {
  const params = new URLSearchParams(window.location.search);

  const page = params.get("page");

  if (page && ROUTES[page]) {

    const selectedEl = document.querySelector(
      `[data-iframe-link="${page}"]`
    );

    changeIframeSrc(ROUTES[page], selectedEl);

  } else {
    // TODO change to 404.html
    //KEEP FOR HISTORY: 
    //changeIframeSrc("/assets/web/experimental/armillary");
    changeIframeSrc("404.hmtl");
    iframe.src = "/404.html"
    /*iframe.srcdoc = `

    <style>
      a {
        text-decoration: none;
      }
    </style>

    <div style="
      text-align:center;
      margin-top: 80px;
      font-family: sans-serif;
    ">
    <div>
    <h2>dibesfer navigator</h2>
    </div>

    <div><a href="/" class="leftBarLink" target="_top">Landing</a></div>
    <div><a href="/assets/pages/nav/?page=gallery" class="leftBarLink" target="_top">Gallery</a></div>
    <div><a href="/assets/pages/nav/?page=games" class="leftBarLink" target="_top">Games</a></div>
    <div><a href="/assets/pages/nav/?page=web" class="leftBarLink" target="_top">Web</a></div>

    <div><a href="https://liberapay.com/dibesfer" target="_top" class="leftBarLink">Donate</a></div>
    <div><a href="https://discord.gg/tUHBS9eERn" target="_top" class="leftBarLink">Discord</a></div>
    </div>


    `*/
  }
}

// --- CLICKABLE ELEMENTS ---
allIframeLinks.forEach(el => {

  el.classList.add("clickable");

  el.addEventListener("click", () => {

    const routeName = el.getAttribute("data-iframe-link");

    if (!routeName || !ROUTES[routeName]) return;

    // iframe + visual state
    changeIframeSrc(ROUTES[routeName], el);

    // optional ui
    if (typeof leftBar !== "undefined") {
      leftBar.classList.toggle("leftBarOpen");
      leftBarBtn.classList.toggle("rotateRight")
    }

    // url
    const url = new URL(window.location);

    url.searchParams.set("page", routeName);

    window.history.pushState({}, "", url);
  });
});

// --- BROWSER NAVIGATION ---
window.addEventListener("popstate", loadRouteFromURL);

// --- INIT ---
loadRouteFromURL();