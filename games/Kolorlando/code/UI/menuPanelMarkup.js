export function renderKolorlandoMenuPanel(container) {
  if (!container) return;

  /* The menu panel markup is shared by both game.html and multiplayer.html so
  future menu edits land in one place instead of drifting between two copies.
  This renderer stays intentionally small and string-based because the menu is
  still static markup today; if scenario-specific branches appear later we can
  add options without rewriting the rest of the pages again. */
  container.outerHTML = `
    <div id="menuCentral" hidden>
        <div id="menuCloseButton">X</div>
        <h1 class="not-on-landscape">Kolorlando</h1>
        <div class="menu-tabs" role="tablist" aria-label="Main menu sections">
            <button class="menu-tab" type="button" data-menu-tab="creative">📖 ENCYCLOPEDIA</button>
            <button class="menu-tab" type="button" data-menu-tab="inventory">🎒 INVENTORY</button>
            <button class="menu-tab" type="button" data-menu-tab="character">👤 CHARACTER</button>
            <button class="menu-tab is-active" type="button" data-menu-tab="settings">⚙️ SETTINGS</button>
            <button class="menu-tab" type="button" data-menu-tab="about">🪶 ABOUT</button>
        </div>

        <section class="menu-panel" data-menu-panel="creative">
            <h2>Encyclopedia</h2>
            <h3>Voxels</h3>
            <div id="inventorySlots"></div>

            <h3>Items</h3>
            <div id="itemEncyclopediaSlots"></div>

            <h3>Entities</h3>
            <ul>
                <li>Walker</li>
                <li>Chaser</li>
                <li>Talker</li>
            </ul>

            <p id="inventorySelected">Selected: green</p>

            <p class="inventory-help">Press <code>C</code> to open Encyclopedia quickly.</p>
        </section>

        <section class="menu-panel" data-menu-panel="inventory">
            <h2>Inventory</h2>
            <div id="playerInventorySlots"></div>
            <p id="playerInventorySummary">0 / 3168 items</p>
            <p id="playerInventorySelection">Selected slot: 1</p>
            <p class="inventory-help">Click any slot to select its stack for Survival mode.</p>
            <p class="inventory-help">Press <code>I</code> to open this tab quickly.</p>
        </section>

        <section class="menu-panel" data-menu-panel="character">
            <h2>Character</h2>
            <div id="kolorlandiaCharacterMenu">
                <div id="kolorlandiaCharacterMenu_player"></div>

                <div id="kolorlandiaCharacterMenu_slots">
                    <div></div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div title="Cape">
                        <img src="assets/armor/cape.png" alt="">
                    </div>
                    <div></div>
                    <div></div>
                    <div title="Helmet">
                        <img src="assets/armor/crested-helmet.png" alt="">
                    </div>
                    <div></div>
                    <div></div>
                    <div></div>
                    <div title="Shoulder Right">
                        <img src="assets/armor/spiked-shoulder-armor.png" alt="">
                    </div>
                    <div title="Chest">
                        <img src="assets/armor/chest-armor.png" alt="">
                    </div>
                    <div title="Shoulder Left">
                        <img class="inverted" src="assets/armor/spiked-shoulder-armor.png" alt="">
                    </div>
                    <div></div>
                    <div></div>
                    <div title="Right Glove">
                        <img class="inverted" src="assets/armor/gauntlet.png" alt="">
                    </div>
                    <div title="Pants">
                        <img src="assets/armor/armored-pants.png" alt="">
                    </div>
                    <div title="Left Glove">
                        <img src="assets/armor/gauntlet.png" alt="">
                    </div>
                    <div></div>
                    <div title="Cape"Right Hand>✋</div>
                    <div></div>
                    <div title="Boots">
                        <img src="assets/armor/steeltoe-boots.png" alt="">
                    </div>
                    <div></div>
                    <div title="Left Hand">🤚</div>
                </div>

                <div id="kolorlandiaCharacterMenu_info">
                    <p>Name: <span id="characterMenuNameValue">Anonymous</span></p>
                    <p>Life: 100/100</p>
                    <p>Money: 0</p>
                    <p>Face: 😎</p>
                    <p>Height: 1.70</p>
                    
                </div>
            </div>
            <p>Edit your face in <a href="/web/SquareFaceCreator">SquareFaceCreator</a></p>
        </section>

        <section class="menu-panel is-active" data-menu-panel="settings">
            <h2>Settings</h2>

            <div class="game-mode-picker" aria-label="Game mode">
                <span>Game mode</span>
                <button class="game-mode-button" type="button" data-game-mode="creative">Creative</button>
                <button class="game-mode-button is-active" type="button" data-game-mode="survival">Survival</button>
            </div>

            <div class="camera-mode-picker">
                <fieldset>
                    <legend>Camera mode</legend>

                    <input type="radio" id="cameraModeSkyrim" name="cameraMode" value="skyrim" checked>
                    <label for="cameraModeSkyrim">Skyrim</label><br>

                    <input type="radio" id="cameraModeWow" name="cameraMode" value="wow">
                    <label for="cameraModeWow">WoW</label><br>

                    <input type="radio" id="cameraModeLegoLol" name="cameraMode" value="legoLol">
                    <label for="cameraModeLegoLol">Lego Lol</label>
                </fieldset>
            </div>
            <hr>

            <div class="settings-toggle">
                <input type="checkbox" name="fullScreen" id="settingsFullScreen">
                <label for="settingsFullScreen">Full screen</label>
            </div>
            <div class="settings-toggle">
                <input type="checkbox" name="menuThemeDark" id="settingsMenuThemeDark">
                <label for="settingsMenuThemeDark">Dark menu theme</label>
            </div>
            <div class="settings-toggle">
                <input type="checkbox" name="shadows" id="settingsShadows" checked>
                <label for="settingsShadows">Shadows</label>
            </div>
            <div class="settings-toggle">
                <label for="settingsUndersampling">Undersampling</label>
                <select id="settingsUndersampling">
                    <option value="1">Off (100%)</option>
                    <option value="0.75">Light (75%)</option>
                    <option value="0.5">Strong (50%)</option>
                </select>
            </div>

            <button id="settingsReloadWorldButton" type="button">Reload World</button>
            <br><br>
            <label for="volume">Volume</label>
            <input type="range">
            <br>
            <input type="checkbox" name="bgMusic" id="">

            <label for="bgMusic">Background music</label>

            <br>

            <h3>Controls</h3>
            <hr>
            <p>Click PLAY to lock your cursor and drive the camera.</p>
            <p>Move with WASD</p>
            <p>Jump with Space</p>
            <p>Press <code>C</code> for Encyclopedia</p>
            <p>Press <code>I</code> for Inventory</p>
            <p>Type <code>/debugmode</code> in chat to toggle collision debug boxes.</p>
            <p>Desktop: clicking outside this menu closes it and returns to cursor lock.</p>
            <p>Mobile: clicking outside this menu closes it.</p>
            <p>Mobile: pinch on the scene to zoom between first-person and third-person.</p>
            <p>Press Escape to unlock your cursor and open this menu.</p>
            <button id="playButton" type="button">PLAY</button>
        </section>

        <section class="menu-panel" data-menu-panel="about">
            <h2>About</h2>
            <h3>Links</h3>
            <ul>
                <li><a href="/games/Kolorlando/">Landing Page</a></li>
                <li><a href="/games/Kolorlando/game.html">Game</a></li>
                <li><a href="/games/Kolorlando/characteristics.html">Characteristics</a></li>
            </ul>
            <p>Game made with Three.js by dibesfer.</p>
        </section>
    </div>
  `;
}
