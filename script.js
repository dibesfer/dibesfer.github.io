// script.js
const local = parseInt(localStorage.getItem("dibesferV3_localVisits")) || 0;
desc.classList.remove("invisible");
if (local > 1) {
  desc.innerHTML = "<b>Dib</b>ujos y <u>es</u>critos de <i>Fer</i>";
}