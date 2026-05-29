import { Input } from "../Input/Input.js";
import { ThreeD } from "../3D/3D.js";
import { GameRuntime } from "./GameRuntime.js";
import { Settings } from "./Settings.js";
import { UI } from "../UI/UI.js";

const input = new Input();
const threeScene = document.querySelector("#ThreeScene");
const uiOverlay = document.querySelector("#UIOverlay");
let settings = null;
let gameRuntime = null;

if (threeScene) {
  const threeD = new ThreeD(threeScene);
  settings = new Settings({ threeD, input });
  gameRuntime = new GameRuntime({ threeD, input });
  threeD.start();
}

if (uiOverlay) {
  const ui = new UI(uiOverlay, input);
  ui.start();
}

settings?.start();
await gameRuntime?.start();
input.start();

