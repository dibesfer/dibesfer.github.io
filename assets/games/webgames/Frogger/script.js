const timeLeft = getid("timeLeft");
const result = getid("result");
const startPauseBtn = getid("startPauseBtn");
const squares = document.querySelectorAll("#grid div");
const startPosition = getid("startBlock");
const width = 9;
const logsLeft = document.querySelectorAll(".logLeft");
const logsRight = document.querySelectorAll(".logRight");
const carsLeft = document.querySelectorAll(".carLeft");
const carsRight = document.querySelectorAll(".carRight");
let timerId;
let outcomeTimerId;
let currentPos = Array.from(squares).indexOf(startPosition);
let restart = false;
let currentTime = 20;

function moveFrog(e) {
  squares[currentPos].classList.remove("frog");
  switch (e.key) {
    case "ArrowLeft":
      if (currentPos % 9 !== 0) currentPos--;
      break;
    case "ArrowRight":
      if (currentPos % 9 < width - 1) currentPos++;
      break;
    case "ArrowUp":
      if (currentPos - width > 0) currentPos -= width;
      break;
    case "ArrowDown":
      if (currentPos + width < width ** 2) currentPos += width;
      break;
  }
  squares[currentPos].classList.add("frog");
}

function autoMoveElements() {
  currentTime--;
  timeLeft.textContent = currentTime;
  logsLeft.forEach((log) => moveLogLeft(log));
  logsRight.forEach((log) => moveLogRight(log));
  carsLeft.forEach((car) => moveCarLeft(car));
  carsRight.forEach((car) => moveCarRight(car));
}

function moveLogLeft(log) {
  switch (true) {
    case log.classList.contains("l1"):
      log.classList.remove("l1");
      log.classList.add("l2");
      break;
    case log.classList.contains("l2"):
      log.classList.remove("l2");
      log.classList.add("l3");
      break;
    case log.classList.contains("l3"):
      log.classList.remove("l3");
      log.classList.add("l4");
      break;
    case log.classList.contains("l4"):
      log.classList.remove("l4");
      log.classList.add("l5");
      break;
    case log.classList.contains("l5"):
      log.classList.remove("l5");
      log.classList.add("l1");
      break;
  }
}
function moveLogRight(log) {
  switch (true) {
    case log.classList.contains("l1"):
      log.classList.remove("l1");
      log.classList.add("l5");
      break;
    case log.classList.contains("l2"):
      log.classList.remove("l2");
      log.classList.add("l1");
      break;
    case log.classList.contains("l3"):
      log.classList.remove("l3");
      log.classList.add("l2");
      break;
    case log.classList.contains("l4"):
      log.classList.remove("l4");
      log.classList.add("l3");
      break;
    case log.classList.contains("l5"):
      log.classList.remove("l5");
      log.classList.add("l4");
      break;
  }
}

function moveCarLeft(car) {
  switch (true) {
    case car.classList.contains("c1"):
      car.classList.remove("c1");
      car.classList.add("c2");
      break;
    case car.classList.contains("c2"):
      car.classList.remove("c2");
      car.classList.add("c3");
      break;
    case car.classList.contains("c3"):
      car.classList.remove("c3");
      car.classList.add("c1");
      break;
  }
}
function moveCarRight(car) {
  switch (true) {
    case car.classList.contains("c1"):
      car.classList.remove("c1");
      car.classList.add("c3");
      break;
    case car.classList.contains("c2"):
      car.classList.remove("c2");
      car.classList.add("c1");
      break;
    case car.classList.contains("c3"):
      car.classList.remove("c3");
      car.classList.add("c2");
      break;
  }
}

function lose() {
  if (
    squares[currentPos].classList.contains("c1") ||
    squares[currentPos].classList.contains("l4") ||
    squares[currentPos].classList.contains("l5") ||
    currentTime < 1
  ) {
    result.textContent = "You lose!";
    clearInterval(timerId);
    clearInterval(outcomeTimerId);
    squares[currentPos].classList.remove("frog");
    document.removeEventListener("keyup", moveFrog);
    return true;
  }
}

function win() {
  if (squares[currentPos].id === "endingBlock") {
    result.textContent = "You win!";
    clearInterval(timerId);
    clearInterval(outcomeTimerId);
    document.removeEventListener("keyup", moveFrog);
    return true;
  }
}

function checkOutcome() {
  if (lose() || win()) {
    startPauseBtn.textContent = "Restart";
    restart = true;
  }
}

startPauseBtn.addEventListener("click", startPause);

function startPause(event) {
  if (restart) {
    squares[currentPos].classList.remove("frog");
    currentPos = Array.from(squares).indexOf(startPosition);
    squares[currentPos].classList.add("frog");
    currentTime = 20;
    result.textContent = "";
    timeLeft.textContent = 20;
    restart = false;
    //Started
    outcomeTimerId = setInterval(checkOutcome, 50);
    timerId = setInterval(autoMoveElements, 1000);
    document.addEventListener("keyup", moveFrog);
    event.currentTarget.textContent = "Pause";
  } else if (timerId) {
    //Paused
    clearInterval(timerId);
    clearInterval(outcomeTimerId);
    timerId = null;
    outcomeTimerId = null;
    document.removeEventListener("keyup", moveFrog);
    event.currentTarget.textContent = "Start";
  } else {
    //Started
    outcomeTimerId = setInterval(checkOutcome, 50);
    timerId = setInterval(autoMoveElements, 1000);
    document.addEventListener("keyup", moveFrog);
    event.currentTarget.textContent = "Pause";
  }
}
