import { Memory } from "./assets/code/Memory.js";
const memory = new Memory()

hit(window.location.href).then((res) => {
  const el = document.getElementById("visitsDisplay");
  if (!el) return;

  el.textContent =
    typeof res.count === "number" ? res.count : "";
});

let localVisits = memory.load("dibesferV3_localVisits")

if (!localVisits) {
  localVisits = memory.save("dibesferV3_localVisits", 1)
}

else {
  localVisits++
  localVisits = memory.save("dibesferV3_localVisits", localVisits)
}