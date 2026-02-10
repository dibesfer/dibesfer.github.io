function getid(id) {
  return document.getElementById(id)
}

function getclass(classname) {
  return document.getElementsByClassName(classname)
}

function gettag(tag) {
  return document.getElementsByTagName(tag)[0]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFromArray(array) {
  return array[randomInt(0, array.length - 1)]
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function needsazero(number) {
  let result

  if (number < 10) {
    result = "0" + number
    return result
  }
  return number
}

function decimalTwo(num) {
  return (Math.round(num * 100) / 100).toFixed(2);
}
let typeWriteCount = 0

function typeWrite(what, where, speed) {

  if (!speed) speed = 75

  let interval = setInterval(type, speed)

  function type() {
    if (typeWriteCount < what.length) {
      if (where) where.textContent += what[typeWriteCount]
      else console.log(what[typeWriteCount])
      typeWriteCount++;
    }
    else clearInterval(interval)
  }

}

function thousandDot(number) {
  let dotCounter = 0
  let newNumberString = ""

  if (typeof number != "string")
    number = BigInt(number).toString()

  for (let i = number.length - 1; i >= 0; i--) {
    const element = number[i];

    if (dotCounter != 0 && dotCounter % 3 == 0) {
      //console.log(dotCounter + "dot")
      newNumberString += "."
    }
    dotCounter++
    //console.log(element, i)
    newNumberString += element

  }

  newNumberString = newNumberString.split('').reverse().join('');
  //console.log(newNumberString)
  return newNumberString

}

let elem = document.documentElement;

// let toggleFull = getid("toggleFull")

let fullmode = false

if (document.fullscreenElement) {
  fullmode = true
  //toggleFull.textContent = "No Full"
}

else {
  //toggleFull.textContent = "Full"
}

function toggleFullscreen() {

  console.log("clicked")

  if (document.fullscreenElement) {
    fullmode = true
  } else { fullmode = false }

  if (fullmode) {
    closeFullscreen()
    //toggleFull.textContent = "Full"
  }
  else {
    console.log("no full")
    openFullscreen()
    //toggleFull.textContent = "No Full"

  }

}
function openFullscreen() {
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.webkitRequestFullscreen) { /* Safari */
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) { /* IE11 */
    elem.msRequestFullscreen();
  }
}

function closeFullscreen() {
  console.log("activated")
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) { /* Safari */
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) { /* IE11 */
    document.msExitFullscreen();
  }
}