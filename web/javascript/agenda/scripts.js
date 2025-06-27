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
            <img class="iconCross" src="cerrar.svg" alt="botón de cerrar" onclick="eliminarContacto('${nombre}')">
            <img class="iconStar" src="destacar.svg" alt="botón de destacar" onclick="destacar('${nombre}')">
            <h2>${nombre}</h2>
            <a href="mailto:${correo}">${correo}</a>
            <p>Tel: 646269196</p>
            `
            contactos.appendChild(articulo)
            document.getElementById("contador").textContent = "Contactos totales: " + nombres.length
        }
    }
}

function agregarContactoAleatorio() {
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
            <img class="iconCross" src="cerrar.svg" alt="botón de cerrar" onclick="eliminarContacto('${nombre}')">
            <img class="iconStar" src="destacar.svg" alt="botón de destacar" onclick="destacar('${nombre}')">
            <h2>${nombre}</h2>
            <a href="mailto:${correo}">${correo}</a>
            <p>Tel: 646269196</p>
            `
            contactos.appendChild(articulo)
            document.getElementById("contador").textContent = "Contactos totales: " + nombres.length
        }
    }
}

function eliminarContacto(id) {
    document.getElementById(id).remove()
    nombres.splice(nombres.indexOf(id), 1)
    document.getElementById("contador").textContent = "Contactos totales: " + nombres.length
}

function destacar(id) {
    if (document.getElementById(id).style.backgroundColor == "blue") {
        document.getElementById(id).style.backgroundColor = "lightblue"
        document.getElementById(id).style.color = "unset"
    }
    else {
        document.getElementById(id).style.backgroundColor = "blue"
        document.getElementById(id).style.color = "white"
    }
}

function vaciarTodos() {
    nombres.forEach(
        (elemento) => {
            document.getElementById(elemento).remove()
        }
    )
    nombres = []
    document.getElementById("contador").textContent = "Contactos totales: " + nombres.length
}

function crearAleatorios() {
    vaciarTodos()
    const numContactos = Math.round(Math.random() * 20) 

    for (let i = 0; i < numContactos; i++) {
            let nombre = "Contacto" + i
            nombres.push(nombre)
            let correo = "correo" + i + "@gmail.com"
            let articulo = document.createElement("article")
            articulo.id = nombre
            articulo.innerHTML = `
            <img class="iconCross" src="cerrar.svg" alt="botón de cerrar" onclick="eliminarContacto('${nombre}')">
            <img class="iconStar" src="destacar.svg" alt="botón de destacar" onclick="destacar('${nombre}')">
            <h2>${nombre}</h2>
            <a href="mailto:${correo}">${correo}</a>
            <p>Tel: 646269196</p>
            `
            contactos.appendChild(articulo)
    }
    document.getElementById("contador").textContent = "Contactos totales: " + nombres.length
}