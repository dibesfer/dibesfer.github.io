export const GAME_MODE_CREATIVE = 'creative';
export const GAME_MODE_SURVIVAL = 'survival';

export function createInventoryUI(options) {
  const inventorySlots = options.inventorySlots;
  const inventorySelected = options.inventorySelected;
  const playerInventorySlots = options.playerInventorySlots;
  const playerInventorySummary = options.playerInventorySummary;
  const playerInventorySelection = options.playerInventorySelection;
  const hotbarSlotEls = options.hotbarSlotEls;
  const gameModeReadout = options.gameModeReadout;
  const gameModeButtons = options.gameModeButtons;
  const voxelTypes = options.voxelTypes;

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

  function mixColorChannel(channel, target, amount) {
    return Math.round(channel + (target - channel) * amount);
  }

  function tintHexColor(hexColor, amount) {
    const cleanHex = hexColor.replace('#', '');
    const parsed = Number.parseInt(cleanHex, 16);
    if (!Number.isFinite(parsed)) return hexColor;

    const r = (parsed >> 16) & 0xff;
    const g = (parsed >> 8) & 0xff;
    const b = parsed & 0xff;
    const tinted = (
      (mixColorChannel(r, 255, amount) << 16)
      | (mixColorChannel(g, 255, amount) << 8)
      | mixColorChannel(b, 255, amount)
    );

    return '#' + tinted.toString(16).padStart(6, '0');
  }

  function createVoxelIcon(hexColor) {
    const icon = document.createElement('span');
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    const top = document.createElementNS(svgNs, 'polygon');
    const left = document.createElementNS(svgNs, 'polygon');
    const right = document.createElementNS(svgNs, 'polygon');
    const edge = document.createElementNS(svgNs, 'path');

    icon.className = 'hotbar-slot-swatch';
    icon.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', '0 0 64 64');

    top.setAttribute('points', '32,6 56,18 32,30 8,18');
    top.setAttribute('fill', tintHexColor(hexColor, 0.22));
    left.setAttribute('points', '8,18 32,30 32,56 8,44');
    left.setAttribute('fill', tintHexColor(hexColor, 0.06));
    right.setAttribute('points', '56,18 32,30 32,56 56,44');
    right.setAttribute('fill', hexColor);
    edge.setAttribute('d', 'M32 6L56 18L32 30L8 18ZM32 30V56M8 18V44L32 56L56 44V18');
    edge.setAttribute('fill', 'none');
    edge.setAttribute('stroke', 'rgba(15,23,42,0.35)');
    edge.setAttribute('stroke-width', '3');
    edge.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(top);
    svg.appendChild(left);
    svg.appendChild(right);
    svg.appendChild(edge);
    icon.appendChild(svg);
    return icon;
  }

  function getSelectedSurvivalStack() {
    return playerInventory[selectedInventorySlotIndex];
  }

  function findInventorySlotIndexByType(typeName) {
    if (!typeName) return -1;
    return playerInventory.findIndex(function (stack) { return stack && stack.typeName === typeName; });
  }

  function inventoryHasType(typeName) {
    return findInventorySlotIndexByType(typeName) >= 0;
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
      if (!stack) slot.classList.add('is-empty');
      if (i === selectedInventorySlotIndex) slot.classList.add('is-selected');
      if (stack) slot.appendChild(createVoxelIcon(getVoxelTypeHexColor(stack.typeName)));

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

      hotbarSlotEls[i].appendChild(createVoxelIcon(getVoxelTypeHexColor(stack.typeName)));

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

    inventoryDragState = {
      pointerId: event.pointerId,
      sourceIndex: index,
      sourceElement: element,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false,
    };
  }

  function clearInventoryDragPreview() {
    inventoryDragPreview.hidden = true;
    inventoryDragPreview.textContent = '';
  }

  function stopInventoryDrag() {
    if (!inventoryDragState) return;
    inventoryDragState.sourceElement.classList.remove('is-drag-source');
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

  function handleInventoryDragMove(event) {
    if (!inventoryDragState || event.pointerId !== inventoryDragState.pointerId) return;

    inventoryDragState.lastX = event.clientX;
    inventoryDragState.lastY = event.clientY;

    if (!inventoryDragState.dragging) {
      const deltaX = event.clientX - inventoryDragState.startX;
      const deltaY = event.clientY - inventoryDragState.startY;
      if (Math.hypot(deltaX, deltaY) < 8) return;

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
  }

  function handleInventoryDragEnd(event) {
    if (!inventoryDragState || event.pointerId !== inventoryDragState.pointerId) return;

    const clientX = event.clientX === undefined ? inventoryDragState.lastX : event.clientX;
    const clientY = event.clientY === undefined ? inventoryDragState.lastY : event.clientY;

    if (inventoryDragState.dragging) {
      event.preventDefault();
      const target = document.elementFromPoint(clientX, clientY);
      const dropTarget = target && target.closest ? target.closest('.inventory-menu-slot') : null;
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
  renderPlayerInventorySlots();
  updateGameModeUI();

  return {
    addCreativeInventoryItem: addCreativeInventoryItem,
    addItemToInventory: addItemToInventory,
    consumeSelectedInventoryItem: consumeSelectedInventoryItem,
    getGameMode: function () { return gameMode; },
    getSelectedSurvivalStack: getSelectedSurvivalStack,
    inventoryHasType: inventoryHasType,
    selectHotbarSlot: selectHotbarSlot,
    setGameMode: setGameMode,
  };
}
