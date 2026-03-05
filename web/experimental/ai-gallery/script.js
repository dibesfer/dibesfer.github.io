document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".photo");

  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add("is-visible");
    }, index * 80);
  });
});
