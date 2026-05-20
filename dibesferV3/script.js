hit(window.location.pathname).then((res) => {
  const el = document.getElementById("visitsDisplay");
  if (!el) return;

  if (typeof res.count === "number") {
    el.textContent = res.count;
  } else {
    el.textContent = "";
  }
});