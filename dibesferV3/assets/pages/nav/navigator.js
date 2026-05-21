const ROUTES = {
  gallery: "../../gallery",
  games: "../../games",
  web: "../../web",
  fonish: "../../../../web/conlang/fonish"
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
    changeIframeSrc("/web/experimental/armillary");
  }
}

// --- CLICKABLE ELEMENTS ---

let allIframeLinks = document.querySelectorAll("[data-iframe-link]")


allIframeLinks.forEach(el => {

  el.classList.add("clickable");

  el.addEventListener("click", () => {

    const routeName = el.getAttribute("data-iframe-link");

    if (!routeName || !ROUTES[routeName]) return;

    // iframe
    changeIframeSrc(ROUTES[routeName]);
    leftBar.classList.toggle("leftBarOpen")

    allIframeLinks.forEach(el => {
      el.classList.remove("selectedLinkIframe")
    })

    el.classList.toggle("selectedLinkIframe")
    
    // url
    const url = new URL(window.location);

    url.searchParams.set("page", routeName);

    window.history.pushState({}, "", url);
  });

  
});

// --- INIT ---
loadRouteFromURL();