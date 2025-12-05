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

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
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