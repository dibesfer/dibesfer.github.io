import { createCircleIcon, createImageIcon, createVoxelIcon } from './icon.js';

export const GAME_MODE_CREATIVE = 'creative';
export const GAME_MODE_SURVIVAL = 'survival';

export function createInventoryUI(options) {
  const inventorySlots = options.inventorySlots;
  const inventorySelected = options.inventorySelected;
  const playerInventorySlots = options.playerInventorySlots;
  const itemEncyclopediaSlots = options.itemEncyclopediaSlots;
  const playerInventorySummary = options.playerInventorySummary;
  const playerInventorySelection = options.playerInventorySelection;
  const hotbarSlotEls = options.hotbarSlotEls;
  const gameModeReadout = options.gameModeReadout;
  const gameModeButtons = options.gameModeButtons;
  const voxelTypes = options.voxelTypes;
  const voxelTypeNames = new Set(voxelTypes.map(function (type) { return type.name; }));

  const PLAYER_INVENTORY_SLOT_COUNT = 32;
  const PLAYER_STACK_LIMIT = 99;
  const playerInventory = Array.from({ length: PLAYER_INVENTORY_SLOT_COUNT }, function () { return null; });
  let gameMode = GAME_MODE_SURVIVAL;
  let selectedInventorySlotIndex = 0;
  let selectedHotbarIndex = 0;
  let selectedVoxelType = (voxelTypes.find(function (type) { return type.name === 'green'; }) || voxelTypes[0] || { name: 'green' }).name;
  let inventorySlotEls = [];
  let inventoryDragState = null;
  let suppressInventorySlotClick = false;
  const inventoryDragPreview = document.createElement('div');
  const INVENTORY_DRAG_START_DISTANCE = 6;

  const encyclopediaItems = [
    { name: 'Spawn Point', iconSrc: 'assets/icons/diamonds.png' },
    { name: 'Gun', iconSrc: 'assets/weapons/pistol-gun.png' },
    { name: 'Sword', iconSrc: 'assets/weapons/gladius.png' },
    { name: 'Coin', iconKind: 'coin' },
  ];
  const itemIconByName = encyclopediaItems.reduce(function (lookup, item) {
    lookup[item.name] = item;
    return lookup;
  }, {});
  const ENCYCLOPEDIA_ITEM_SLOT_COUNT = 16;

  inventoryDragPreview.className = 'inventory-drag-preview';
  inventoryDragPreview.hidden = true;
  document.body.appendChild(inventoryDragPreview);

  function getVoxelTypeColor(typeName) {
    const found = voxelTypes.find(function (type) { return type.name === typeName; });
    return found ? found.color : 0xffffff;
  }

  function getVoxelTypeHexColor(typeName) {
    return '#' + getVoxelTypeColor(typeName).toString(16).padStart(6, '0');
  }

  function createInventoryStackIcon(typeName) {
    const iconDefinition = itemIconByName[typeName];
    if (iconDefinition?.iconKind === 'coin') {
      return createCircleIcon('#d4af37', '#ffe08a');
    }
    if (iconDefinition?.iconSrc) {
      // Item pickups like sword and gun should keep their authored icons in both
      // the inventory window and the hotbar instead of falling back to voxel cubes.
      return createImageIcon(iconDefinition.iconSrc, typeName);
    }
    return createVoxelIcon(getVoxelTypeHexColor(typeName));
  }

  function createEncyclopediaItemIcon(itemEntry) {
    if (!itemEntry) return null;

    // Reusing the same icon resolution rules keeps the encyclopedia aligned with
    // the inventory and hotbar, including generated icons like the coin circle.
    if (itemEntry.iconKind === 'coin') {
      return createCircleIcon('#d4af37', '#ffe08a');
    }
    if (itemEntry.iconSrc) {
      return createImageIcon(itemEntry.iconSrc, itemEntry.name);
    }
    return null;
  }



  function getSelectedSurvivalStack() {
    return playerInventory[selectedInventorySlotIndex];
  }

  function getSelectedPlaceableVoxelType() {
    const selectedStack = getSelectedSurvivalStack();
    if (!selectedStack?.typeName) return null;

    // Only real voxel entries may be used by the world placement flow.
    // Inventory collectibles like coins, guns, and swords should stay intact
    // even when the player right-clicks while aiming at an editable block.
    if (!voxelTypeNames.has(selectedStack.typeName)) return null;
    return selectedStack.typeName;
  }

  function findInventorySlotIndexByType(typeName) {
    if (!typeName) return -1;
    return playerInventory.findIndex(function (stack) { return stack && stack.typeName === typeName; });
  }

  function inventoryHasType(typeName) {
    return findInventorySlotIndexByType(typeName) >= 0;
  }

  function isVoxelInventoryType(typeName) {
    return voxelTypeNames.has(typeName);
  }

  function syncSelectedVoxelTypeFromMode() {
    const selectedStack = getSelectedSurvivalStack();
    if (selectedStack && selectedStack.typeName) {
      selectedVoxelType = selectedStack.typeName;
    }
  }

  function getSelectedInventoryLabel() {
    const slotNumber = selectedInventorySlotIndex + 1;
    const selectedStack = getSelectedSurvivalStack();
    if (!selectedStack) {
      return 'Selected slot: ' + slotNumber + ' (empty)';
    }
    return 'Selected slot: ' + slotNumber + ' (' + selectedStack.typeName + (selectedStack.count > 1 ? ' x' + selectedStack.count : '') + ')';
  }

  function updateGameModeUI() {
    if (gameModeReadout) {
      gameModeReadout.textContent = 'Mode: ' + (gameMode === GAME_MODE_SURVIVAL ? 'Survival' : 'Creative');
    }

    for (let i = 0; i < gameModeButtons.length; i += 1) {
      const isActive = gameModeButtons[i].dataset.gameMode === gameMode;
      gameModeButtons[i].classList.toggle('is-active', isActive);
    }
  }

  function renderPlayerInventorySlots() {
    if (!playerInventorySlots) return;
    playerInventorySlots.textContent = '';

    for (let i = 0; i < PLAYER_INVENTORY_SLOT_COUNT; i += 1) {
      const stack = playerInventory[i];
      const slot = document.createElement('button');
      const label = document.createElement('span');
      const count = document.createElement('span');

      slot.type = 'button';
      slot.className = 'hotbar-slot inventory-menu-slot';
      slot.dataset.slotIndex = String(i);
      if (i < hotbarSlotEls.length) slot.classList.add('inventory-hotbar-slot');
      if (!stack) slot.classList.add('is-empty');
      if (i === selectedInventorySlotIndex) slot.classList.add('is-selected');
      if (stack) slot.appendChild(createInventoryStackIcon(stack.typeName));

      label.className = 'hotbar-slot-label';
      label.textContent = stack ? stack.typeName : 'empty';
      slot.appendChild(label);

      count.className = 'hotbar-slot-count';
      count.textContent = stack && stack.count > 1 ? String(stack.count) : '';
      slot.appendChild(count);

      slot.addEventListener('click', function () {
        if (suppressInventorySlotClick) {
          suppressInventorySlotClick = false;
          return;
        }
        selectInventorySlot(i);
      });
      slot.addEventListener('pointerdown', function (event) {
        // Preventing default keeps the browser from competing with the custom inventory
        // drag interaction through text selection or native button drag behavior.
        event.preventDefault();
        beginInventorySlotDrag(i, event, slot);
      });

      playerInventorySlots.appendChild(slot);
    }

    if (playerInventorySummary) {
      const totalItems = playerInventory.reduce(function (sum, stack) { return sum + (stack ? stack.count : 0); }, 0);
      playerInventorySummary.textContent = totalItems + ' / ' + (PLAYER_INVENTORY_SLOT_COUNT * PLAYER_STACK_LIMIT) + ' items';
    }

    if (playerInventorySelection) {
      playerInventorySelection.textContent = getSelectedInventoryLabel();
    }
  }

  function updateInventorySelectionUI() {
    if (inventorySelected) {
      const selectedStack = getSelectedSurvivalStack();
      inventorySelected.textContent = selectedStack
        ? 'Selected: ' + selectedStack.typeName + (selectedStack.count > 1 ? ' x' + selectedStack.count : '')
        : 'Selected: empty slot';
    }
    if (!inventorySlots) return;

    for (let i = 0; i < inventorySlotEls.length; i += 1) {
      const selectedStack = getSelectedSurvivalStack();
      const isSelected = inventorySlotEls[i].dataset.voxelType === (selectedStack ? selectedStack.typeName : null);
      inventorySlotEls[i].classList.toggle('is-selected', isSelected);
    }

    for (let i = 0; i < hotbarSlotEls.length; i += 1) {
      const stack = playerInventory[i];
      hotbarSlotEls[i].classList.toggle('is-selected', i === selectedHotbarIndex);
      hotbarSlotEls[i].textContent = '';
      if (!stack) continue;

      hotbarSlotEls[i].appendChild(createInventoryStackIcon(stack.typeName));

      const label = document.createElement('span');
      label.className = 'hotbar-slot-label';
      label.textContent = stack.typeName;
      hotbarSlotEls[i].appendChild(label);

      const count = document.createElement('span');
      count.className = 'hotbar-slot-count';
      count.textContent = stack.count > 1 ? String(stack.count) : '';
      hotbarSlotEls[i].appendChild(count);
    }

    if (playerInventorySelection) {
      playerInventorySelection.textContent = getSelectedInventoryLabel();
    }
  }

  function setGameMode(nextMode) {
    const normalizedMode = nextMode === GAME_MODE_SURVIVAL ? GAME_MODE_SURVIVAL : GAME_MODE_CREATIVE;
    if (gameMode === normalizedMode) {
      updateGameModeUI();
      updateInventorySelectionUI();
      renderPlayerInventorySlots();
      return;
    }

    gameMode = normalizedMode;
    if (gameMode === GAME_MODE_SURVIVAL) {
      selectedHotbarIndex = selectedInventorySlotIndex < hotbarSlotEls.length ? selectedInventorySlotIndex : -1;
    }
    syncSelectedVoxelTypeFromMode();
    updateGameModeUI();
    updateInventorySelectionUI();
    renderPlayerInventorySlots();
  }

  function addItemToInventory(typeName, amount) {
    let remaining = amount === undefined ? 1 : amount;
    if (!typeName || remaining <= 0) return 0;

    for (let i = 0; i < playerInventory.length && remaining > 0; i += 1) {
      const stack = playerInventory[i];
      if (!stack || stack.typeName !== typeName || stack.count >= PLAYER_STACK_LIMIT) continue;
      const movedAmount = Math.min(PLAYER_STACK_LIMIT - stack.count, remaining);
      stack.count += movedAmount;
      remaining -= movedAmount;
    }

    for (let i = 0; i < playerInventory.length && remaining > 0; i += 1) {
      if (playerInventory[i]) continue;
      const movedAmount = Math.min(PLAYER_STACK_LIMIT, remaining);
      playerInventory[i] = { typeName: typeName, count: movedAmount };
      remaining -= movedAmount;
    }

    renderPlayerInventorySlots();
    updateInventorySelectionUI();
    return (amount === undefined ? 1 : amount) - remaining;
  }

  function consumeSelectedInventoryItem(amount) {
    const amountToConsume = amount === undefined ? 1 : amount;
    const selectedStack = getSelectedSurvivalStack();
    if (!selectedStack || amountToConsume <= 0 || selectedStack.count < amountToConsume) return false;

    selectedStack.count -= amountToConsume;
    if (selectedStack.count <= 0) {
      playerInventory[selectedInventorySlotIndex] = null;
    }

    syncSelectedVoxelTypeFromMode();
    renderPlayerInventorySlots();
    updateInventorySelectionUI();
    return true;
  }

  function selectInventorySlot(index) {
    if (index < 0 || index >= playerInventory.length) return;
    selectedInventorySlotIndex = index;
    selectedHotbarIndex = index < hotbarSlotEls.length ? index : -1;
    syncSelectedVoxelTypeFromMode();
    renderPlayerInventorySlots();
    updateInventorySelectionUI();
  }

  function beginInventorySlotDrag(index, event, element) {
    if (!playerInventory[index]) return;
    if (event.button !== undefined && event.button !== 0) return;

    // Capturing the pointer on the source slot makes fast drag motions much more stable,
    // because move and release events continue to arrive even after leaving the element.
    if (element.setPointerCapture && event.pointerId !== undefined) {
      element.setPointerCapture(event.pointerId);
    }

    inventoryDragState = {
      pointerId: event.pointerId,
      sourceIndex: index,
      sourceElement: element,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
      activeDropTarget: null,
    };
  }

  function clearInventoryDragPreview() {
    inventoryDragPreview.hidden = true;
    inventoryDragPreview.textContent = '';
  }

  function setInventoryDropTarget(element) {
    if (inventoryDragState?.activeDropTarget === element) return;

    // Highlighting the current destination while dragging gives immediate feedback
    // about where the stack will land before the player releases the pointer.
    if (inventoryDragState?.activeDropTarget) {
      inventoryDragState.activeDropTarget.classList.remove('is-drop-target');
    }
    if (element) {
      element.classList.add('is-drop-target');
    }
    if (inventoryDragState) {
      inventoryDragState.activeDropTarget = element;
    }
  }

  function stopInventoryDrag() {
    if (!inventoryDragState) return;
    inventoryDragState.sourceElement.classList.remove('is-drag-source');
    inventoryDragState.sourceElement.releasePointerCapture?.(inventoryDragState.pointerId);
    setInventoryDropTarget(null);
    inventoryDragState = null;
    clearInventoryDragPreview();
  }

  function moveInventoryStack(sourceIndex, targetIndex) {
    if (sourceIndex === targetIndex) return;
    if (sourceIndex < 0 || sourceIndex >= playerInventory.length) return;
    if (targetIndex < 0 || targetIndex >= playerInventory.length) return;

    const movedStack = playerInventory[sourceIndex];
    playerInventory[sourceIndex] = playerInventory[targetIndex];
    playerInventory[targetIndex] = movedStack;

    if (selectedInventorySlotIndex === sourceIndex) {
      selectedInventorySlotIndex = targetIndex;
    } else if (selectedInventorySlotIndex === targetIndex) {
      selectedInventorySlotIndex = sourceIndex;
    }

    selectedHotbarIndex = selectedInventorySlotIndex < hotbarSlotEls.length ? selectedInventorySlotIndex : -1;
    syncSelectedVoxelTypeFromMode();
    renderPlayerInventorySlots();
    updateInventorySelectionUI();
  }

  function updateInventoryDragPreviewPosition(clientX, clientY) {
    inventoryDragPreview.style.transform = 'translate(' + (clientX - 32) + 'px, ' + (clientY - 32) + 'px)';
  }

  function resolveInventoryDropTarget(clientX, clientY) {
    const target = document.elementFromPoint(clientX, clientY);
    const dropTarget = target && target.closest ? target.closest('.inventory-menu-slot') : null;
    if (!dropTarget || !inventoryDragState) return null;
    if (dropTarget === inventoryDragState.sourceElement) return null;
    return dropTarget;
  }

  function handleInventoryDragMove(event) {
    if (!inventoryDragState || event.pointerId !== inventoryDragState.pointerId) return;

    inventoryDragState.lastX = event.clientX;
    inventoryDragState.lastY = event.clientY;

    if (!inventoryDragState.dragging) {
      const deltaX = event.clientX - inventoryDragState.startX;
      const deltaY = event.clientY - inventoryDragState.startY;
      if (Math.hypot(deltaX, deltaY) < INVENTORY_DRAG_START_DISTANCE) return;

      inventoryDragState.dragging = true;
      suppressInventorySlotClick = true;
      inventoryDragState.sourceElement.classList.add('is-drag-source');
      const previewSlot = inventoryDragState.sourceElement.cloneNode(true);
      inventoryDragPreview.textContent = '';
      inventoryDragPreview.appendChild(previewSlot);
      inventoryDragPreview.hidden = false;
    }

    event.preventDefault();
    updateInventoryDragPreviewPosition(event.clientX, event.clientY);
    setInventoryDropTarget(resolveInventoryDropTarget(event.clientX, event.clientY));
  }

  function handleInventoryDragEnd(event) {
    if (!inventoryDragState || event.pointerId !== inventoryDragState.pointerId) return;

    const clientX = event.clientX === undefined ? inventoryDragState.lastX : event.clientX;
    const clientY = event.clientY === undefined ? inventoryDragState.lastY : event.clientY;

    if (inventoryDragState.dragging) {
      event.preventDefault();
      const dropTarget = resolveInventoryDropTarget(clientX, clientY);
      const targetIndex = Number(dropTarget && dropTarget.dataset ? dropTarget.dataset.slotIndex : NaN);
      if (Number.isInteger(targetIndex)) {
        moveInventoryStack(inventoryDragState.sourceIndex, targetIndex);
      }
      window.setTimeout(function () {
        suppressInventorySlotClick = false;
      }, 0);
    }

    stopInventoryDrag();
  }

  function addCreativeInventoryItem(typeName) {
    const added = addItemToInventory(typeName, 1);
    if (added <= 0) return;
    const slotIndex = findInventorySlotIndexByType(typeName);
    if (slotIndex >= 0) selectInventorySlot(slotIndex);
  }

  function renderItemEncyclopediaSlots() {
    if (!itemEncyclopediaSlots) return;
    itemEncyclopediaSlots.textContent = '';

    for (let i = 0; i < ENCYCLOPEDIA_ITEM_SLOT_COUNT; i += 1) {
      const itemEntry = encyclopediaItems[i] || null;
      const slot = document.createElement('button');
      const label = document.createElement('span');

      slot.type = 'button';
      slot.className = 'hotbar-slot encyclopedia-item-slot';
      if (!itemEntry) slot.classList.add('is-empty');

      if (itemEntry) {
        const icon = createEncyclopediaItemIcon(itemEntry);
        if (icon) slot.appendChild(icon);
      }

      label.className = 'hotbar-slot-label';
      label.textContent = itemEntry ? itemEntry.name : 'empty';
      slot.appendChild(label);

      itemEncyclopediaSlots.appendChild(slot);
    }
  }

  function renderInventorySlots() {
    if (!inventorySlots) return;
    inventorySlots.textContent = '';
    inventorySlotEls = [];

    for (let i = 0; i < voxelTypes.length; i += 1) {
      const voxelType = voxelTypes[i];
      const slot = document.createElement('button');
      const label = document.createElement('span');

      slot.type = 'button';
      slot.className = 'hotbar-slot creative-slot';
      slot.dataset.voxelType = voxelType.name;
      slot.appendChild(createVoxelIcon(getVoxelTypeHexColor(voxelType.name)));

      label.className = 'hotbar-slot-label';
      label.textContent = voxelType.name;
      slot.appendChild(label);

      slot.addEventListener('click', function () {
        if (gameMode === GAME_MODE_CREATIVE) {
          addCreativeInventoryItem(voxelType.name);
          return;
        }
        selectedVoxelType = voxelType.name;
        updateInventorySelectionUI();
      });

      inventorySlots.appendChild(slot);
      inventorySlotEls.push(slot);
    }

    updateInventorySelectionUI();
  }

  function selectHotbarSlot(index) {
    if (index < 0 || index >= hotbarSlotEls.length) return;
    selectedHotbarIndex = index;
    selectedInventorySlotIndex = index;
    syncSelectedVoxelTypeFromMode();
    updateInventorySelectionUI();
    renderPlayerInventorySlots();
  }

  for (let i = 0; i < gameModeButtons.length; i += 1) {
    gameModeButtons[i].addEventListener('click', function () {
      setGameMode(gameModeButtons[i].dataset.gameMode);
    });
  }

  for (let i = 0; i < hotbarSlotEls.length; i += 1) {
    const slot = hotbarSlotEls[i];
    slot.setAttribute('role', 'button');
    slot.setAttribute('tabindex', '0');
    slot.setAttribute('aria-label', 'Select hotbar slot ' + (i + 1));

    slot.addEventListener('mousedown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      selectHotbarSlot(i);
    });

    slot.addEventListener('touchstart', function (event) {
      event.preventDefault();
      event.stopPropagation();
      selectHotbarSlot(i);
    }, { passive: false });

    slot.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      selectHotbarSlot(i);
    });

    slot.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectHotbarSlot(i);
    });
  }

  document.addEventListener('pointermove', handleInventoryDragMove, { passive: false });
  document.addEventListener('pointerup', handleInventoryDragEnd);
  document.addEventListener('pointercancel', handleInventoryDragEnd);

  renderInventorySlots();
  renderItemEncyclopediaSlots();
  renderPlayerInventorySlots();
  updateGameModeUI();

  return {
    addCreativeInventoryItem: addCreativeInventoryItem,
    addItemToInventory: addItemToInventory,
    consumeSelectedInventoryItem: consumeSelectedInventoryItem,
    getGameMode: function () { return gameMode; },
    getSelectedPlaceableVoxelType: getSelectedPlaceableVoxelType,
    getSelectedSurvivalStack: getSelectedSurvivalStack,
    inventoryHasType: inventoryHasType,
    isVoxelInventoryType: isVoxelInventoryType,
    selectHotbarSlot: selectHotbarSlot,
    setGameMode: setGameMode,
  };
}
