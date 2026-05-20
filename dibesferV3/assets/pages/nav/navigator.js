const ROUTES = {
  gallery: "../../gallery",
  games: "../../games",
  web: "../../web",
};

// --- CORE ---
function changeIframeSrc(src) {
  if (!iframe || !src) return;

  iframe.src = src;
}

// --- URL ROUTING ---
function loadRouteFromURL() {
  const params = new URLSearchParams(window.location.search);

  const page = params.get("page");

  if (page && ROUTES[page]) {
    changeIframeSrc(ROUTES[page]);
  } else {
    changeIframeSrc(ROUTES.gallery);
  }
}

// --- CLICKABLE ELEMENTS ---
document.querySelectorAll("[data-iframe-link]").forEach(el => {

  el.classList.add("clickable");

  el.addEventListener("click", () => {

    const routeName = el.getAttribute("data-iframe-link");

    if (!routeName || !ROUTES[routeName]) return;

    // iframe
    changeIframeSrc(ROUTES[routeName]);

    // url
    const url = new URL(window.location);

    url.searchParams.set("page", routeName);

    window.history.pushState({}, "", url);
  });
});

// --- INIT ---
loadRouteFromURL();