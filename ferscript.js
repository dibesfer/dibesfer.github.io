//Returns a document.getElementById(s)
function getid(s){
        return document.getElementById(s);
}

function write(where,what){
        where.innerHTML += what;
}

function clear(where){
        where.innerHTML = "";
}

function randomint(min, max) {
  return Math.floor(Math.random() * (max - min + 1) ) + min;
}
