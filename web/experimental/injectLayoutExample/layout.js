async function main() {

  const header = await fetch("components/header.html").then(r => r.text());
  const footer = await fetch("components/footer.html").then(r => r.text());

  let html = header + footer

  let layout = document.createElement("div")
  layout.id = "dibesfer_layout"
  layout.innerHTML = html

  document.body.appendChild(layout);
}
main()
  
 
