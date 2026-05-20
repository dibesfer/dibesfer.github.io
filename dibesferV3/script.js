hit(window.location.pathname);

getCount().then((count) => {
  const el = document.getElementById("visitsDisplay");
  if (!el) return;

  el.textContent = typeof count === "number" ? count : "";
});