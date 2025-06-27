window.onload = myOnloadFunc

let nombres = []
let contactos
function myOnloadFunc() {
    contactos = document.getElementById("contactos")
}

function agregarContacto() {
    let nombre = prompt("Introduce el nombre del contacto:")
    let correo
    if (nombre) {

        if (nombres.indexOf(nombre) != -1) {
            alert("Este nombre ya existe!!!")
        }
        else {
            nombres.push(nombre)
            correo = prompt("Introduce el correo del contacto:")
            let articulo = document.createElement("article")
            articulo.id = nombre
            articulo.innerHTML = `
            <img class="iconCross" src="cerrar.svg" alt="botón de cerrar" style="float: left;">
            <img class="iconStar" src="destacar.svg" alt="botón de destacar" style="float: right;">
            <h2>${nombre}</h2>
            <a href="mailto:${correo}">${correo}</a>
            <p>Tel: 646269196</p>
            `
            contactos.appendChild(articulo)
        }
        
    }


}