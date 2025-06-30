window.onload = myOnloadFunc

let nombres = []
let db = []
/*
Example:
[
    ["nombre", "correo"]
]
*/
let contactos
function myOnloadFunc() {
    contactos = document.getElementById("contactos")
}

//localStorage.setItem("usuario", "dibesfer")
//alert(localStorage.getItem("usuario"))
localStorage.removeItem("usuario")

function agregarContacto() {
    let nombre = prompt("Introduce el nombre del contacto:")
    let correo
    if (nombre) {
        if (nombres.indexOf(nombre) != -1) {
            alert("Este nombre ya existe!!!")
        }
        else {
            
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
            nombres.push(nombre)
            db.push([nombre,correo])
            contactos.appendChild(articulo)
            document.getElementById("contador").textContent = "Contactos totales: " + nombres.length
            
        }
    }
}

function eliminarContacto(id) {
    document.getElementById(id).remove()
    nombres.splice(nombres.indexOf(id), 1)
    db.splice(db.indexOf(id),0)
    let whatToDelete
    db.forEach((elemento)=>{
        if (elemento[0] == id){
            whatToDelete = elemento
            // console.log(elemento[0] + " es " + id)
        }
    })
    // console.log(id ,  db.splice(db.indexOf(whatToDelete),1))
    db.splice(db.indexOf(whatToDelete),1)
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
    db = []
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
            db.push([nombre, correo])
    }
    document.getElementById("contador").textContent = "Contactos totales: " + nombres.length
}

function traerContactos(arr){
    contactos.innerHTML = ""
    arr.forEach(
        (elemento) => {
            let nombre = elemento[0]
            nombres.push(nombre)
            let correo = elemento[1]
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
            db.push([nombre, correo])
        }
    )
}

/* MEMORIA LOCALHOST */

function guardarMemoria(){
    localStorage.setItem("db", JSON.stringify(db))
    alert("Memoria guardada")
}

function recuperarMemoria(){
    let memory = localStorage.getItem("db")
    if (memory){
        
        memory = JSON.parse(memory)
        alert("Retrieving data of " + typeof memory + " length: " + memory.length )
        traerContactos(memory)
    }
    else{
        alert("No data to load")
    }
}

function borrarMemoria(){
    if (confirm("Esto eliminará todos los datos, ¿estás seguro?")){
        localStorage.clear();
        alert("Memoria limpia")
    }
}