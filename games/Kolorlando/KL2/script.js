
const consola = document.querySelector("#consola");

if (consola) {
  consola.textContent = ("Hello world! im the script, our current url is " + window.location.href + " our useragent: " + navigator.userAgent);
}

// WEB NAVIGATION

const routes = {
  home: "./assets/pages/home.html",
  avatar: "./assets/pages/avatar.html",
  worlds: "./assets/pages/worlds.html"
};

const menu = document.querySelector("#menu");
let dataRoutes = document.querySelectorAll("[data-route]")

async function loadRoute(routeName, push = true) {
  const src = routes[routeName];

  if (!src) return;

  const res = await fetch(src);
  const html = await res.text();

  menu.innerHTML = html;

  if (push) {
    history.pushState({ routeName }, "", `#${routeName}`);
  }
}

if (menu) {
  document.addEventListener("click", e => {
    const link = e.target.closest("[data-route]");
    if (!link) return;

    e.preventDefault();
    loadRoute(link.dataset.route);
  });

  window.addEventListener("popstate", e => {
    const routeName = e.state?.routeName || location.hash.slice(1) || "home";
    loadRoute(routeName, false);
  });

  loadRoute("home")
}

