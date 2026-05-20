hit(window.location.href).then((res) => {
  const el = document.getElementById("visitsDisplay");
  if (!el) return;

  el.textContent =
    typeof res.count === "number" ? res.count : "";
});