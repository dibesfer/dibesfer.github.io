const computerChoice = getid("computerChoice");
const userChoice = getid("userChoice");
const result = getid("result");
const totalWins = getid("totalWins");
const possibleChoices = document.querySelectorAll("button");
const userCounterDisplay = getid("userCounterDisplay");
const computerCounterDisplay = getid("computerCounterDisplay");
const drawsCounterDisplay = getid("drawsCounterDisplay");
let userInput;
let computerInput;
let userWinCounter = 0;
let computerWinCounter = 0;
let drawsCounter = 0;

possibleChoices.forEach((i) =>
  i.addEventListener("click", (event) => {
    userInput = event.target.getAttribute("data-type");
    userChoice.textContent = userInput;
    generateComputerChoice();
    getResult();
    fillRanking();
  })
);
/*
🗿 Rock
📄 Paper
✂️ Scissors
*/
function generateComputerChoice() {
  const randomNumber = randomInt(1, 3);
  switch (randomNumber) {
    case 1:
      computerInput = "🗿 Rock";
      break;
    case 2:
      computerInput = "📄 Paper";
      break;

    case 3:
      computerInput = "✂️ Scissors";
      break;
  }
  computerChoice.textContent = computerInput;
}

function getResult() {
  let resultResponse;
  switch (true) {
    case computerInput == userInput:
      resultResponse = "<p style='color:gold'>It's a draw!</p>";
      drawsCounter++;
      break;
    case (computerInput == "🗿 Rock" && userInput == "✂️ Scissors") ||
      (computerInput == "✂️ Scissors" && userInput == "📄 Paper") ||
      (computerInput == "📄 Paper" && userInput == "🗿 Rock"):
      resultResponse = "<p style='color:red'>You loose!</p>";
      computerWinCounter++;
      break;
    default:
      resultResponse = "<p style='color:limegreen'>You win!</p>";
      userWinCounter++;
      break;
  }
  result.innerHTML = resultResponse;
}
function fillRanking() {
  userCounterDisplay.textContent = userWinCounter;
  computerCounterDisplay.textContent = computerWinCounter;
  drawsCounterDisplay.textContent = drawsCounter;
}
