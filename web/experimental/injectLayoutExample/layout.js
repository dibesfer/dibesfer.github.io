async function main() {

  const html = await fetch("components/layout.html").then(r => r.text());
  
  let layout = document.createElement("div")
  layout.id = "dibesfer_layout"
  layout.innerHTML = html

  document.body.appendChild(layout);
}
main()
  
 
