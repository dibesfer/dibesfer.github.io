const ROUTES = {
  gallery: "../../gallery",
  games: "../../games",
  web: "../../web",
  fonish: "../../../../web/conlang/fonish",
  dibesGallery: "../../web/dibesgallery"
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
    changeIframeSrc("/web/experimental/armillary");

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