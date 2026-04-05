import { createCoinSymbolIcon, createImageIcon, createVoxelIcon } from './icon.js';
import { BOXEL_SELECTION_TOOL_ITEM, COLOR_BOOTS_ITEM, COLOR_CAPE_ITEM, COLOR_CHEST_ITEM, COLOR_GLOVES_ITEM, COLOR_HELMET_ITEM, COLOR_PANTS_ITEM, COLOR_SHOULDERS_ITEM, COLOR_TABARD_ITEM, COIN_ITEM, GUN_ITEM, ITEM_DEFINITIONS, SPAWN_POINT_ITEM, SWORD_ITEM } from '../item.js';
import { EQUIPMENT_SLOT_LABELS, normalizeEquipmentSlot } from '../entities/equipment.js';

export const GAME_MODE_CREATIVE = 'creative';
export const GAME_MODE_SURVIVAL = 'survival';

export function createInventoryUI(options) {
  const inventorySlots = options.inventorySlots;
  const inventorySelected = options.inventorySelected;
  const playerInventorySlots = options.playerInventorySlots;
  const itemEncyclopediaSlots = options.itemEncyclopediaSlots;
  const playerInventorySummary = options.playerInventorySummary;
  const playerInventorySelection = options.playerInventorySelection;
  const characterEquipmentSlotEls = options.characterEquipmentSlotEls || [];
  const characterEquipmentStage = options.characterEquipmentStage;
  const characterEquipmentPicker = options.characterEquipmentPicker;
  const characterEquipmentPickerTitle = options.characterEquipmentPickerTitle;
  const characterEquipmentPickerSlots = options.characterEquipmentPickerSlots;
  const equipment = options.equipment ?? null;
  const hotbarSlotEls = options.hotbarSlotEls;
  const gameModeReadout = options.gameModeReadout;
  const gameModeButtons = options.gameModeButtons;
  const voxelTypes = options.voxelTypes;
  const onSelectedHotbarStackChange = typeof options.onSelectedHotbarStackChange === 'function'
    ? options.onSelectedHotbarStackChange
    : null;
  const voxelTypeNames = new Set(voxelTypes.map(function (type) { return type.name; }));
  const itemDefinitionList = Object.values(ITEM_DEFINITIONS);
  const itemDefinitionById = itemDefinitionList.reduce(function (lookup, itemDefinition) {
    lookup[itemDefinition.id] = itemDefinition;
    return lookup;
  }, {});
  const itemDefinitionByLabel = itemDefinitionList.reduce(function (lookup, itemDefinition) {
    lookup[itemDefinition.label] = itemDefinition;
    return lookup;
  }, {});

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
  let activeCharacterEquipmentSlot = null;
  const inventoryDragPreview = document.createElement('div');
  const INVENTORY_DRAG_START_DISTANCE = 6;
  let lastSelectedHotbarItemId = null;

  const encyclopediaSections = [
    {
      title: '✨ Special',
      items: [
        {
          itemId: SPAWN_POINT_ITEM.id,
          name: SPAWN_POINT_ITEM.label,
          iconKind: SPAWN_POINT_ITEM.icon?.kind ?? null,
          iconSrc: SPAWN_POINT_ITEM.icon?.src ?? null,
        },
        {
          itemId: BOXEL_SELECTION_TOOL_ITEM.id,
          name: BOXEL_SELECTION_TOOL_ITEM.label,
          iconKind: BOXEL_SELECTION_TOOL_ITEM.icon?.kind ?? null,
          iconSrc: BOXEL_SELECTION_TOOL_ITEM.icon?.src ?? null,
        },
        {
          itemId: COIN_ITEM.id,
          name: COIN_ITEM.label,
          iconKind: COIN_ITEM.icon?.kind ?? null,
          iconSrc: COIN_ITEM.icon?.src ?? null,
        },
      ],
    },
    {
      title: '🗡️ Holdable',
      items: [
        {
          itemId: GUN_ITEM.id,
          name: GUN_ITEM.label,
          iconKind: GUN_ITEM.icon?.kind ?? null,
          iconSrc: GUN_ITEM.icon?.src ?? null,
        },
        {
          itemId: SWORD_ITEM.id,
          name: SWORD_ITEM.label,
          iconKind: SWORD_ITEM.icon?.kind ?? null,
          iconSrc: SWORD_ITEM.icon?.src ?? null,
        },
      ],
    },
    {
      title: '🧥 Wearable',
      items: [
        {
          itemId: COLOR_CHEST_ITEM.id,
          name: COLOR_CHEST_ITEM.label,
          iconKind: COLOR_CHEST_ITEM.icon?.kind ?? null,
          iconSrc: COLOR_CHEST_ITEM.icon?.src ?? null,
        },
        {
          itemId: COLOR_PANTS_ITEM.id,
          name: COLOR_PANTS_ITEM.label,
          iconKind: COLOR_PANTS_ITEM.icon?.kind ?? null,
          iconSrc: COLOR_PANTS_ITEM.icon?.src ?? null,
        },
        {
          itemId: COLOR_BOOTS_ITEM.id,
          name: COLOR_BOOTS_ITEM.label,
          iconKind: COLOR_BOOTS_ITEM.icon?.kind ?? null,
          iconSrc: COLOR_BOOTS_ITEM.icon?.src ?? null,
        },
        {
          itemId: COLOR_GLOVES_ITEM.id,
          name: COLOR_GLOVES_ITEM.label,
          iconKind: COLOR_GLOVES_ITEM.icon?.kind ?? null,
          iconSrc: COLOR_GLOVES_ITEM.icon?.src ?? null,
        },
        {
          itemId: COLOR_SHOULDERS_ITEM.id,
          name: COLOR_SHOULDERS_ITEM.label,
          iconKind: COLOR_SHOULDERS_ITEM.icon?.kind ?? null,
          iconSrc: COLOR_SHOULDERS_ITEM.icon?.src ?? null,
        },
        {
          itemId: COLOR_HELMET_ITEM.id,
          name: COLOR_HELMET_ITEM.label,
          iconKind: COLOR_HELMET_ITEM.icon?.kind ?? null,
          iconSrc: COLOR_HELMET_ITEM.icon?.src ?? null,
        },
        {
          itemId: COLOR_CAPE_ITEM.id,
          name: COLOR_CAPE_ITEM.label,
          iconKind: COLOR_CAPE_ITEM.icon?.kind ?? null,
          iconSrc: COLOR_CAPE_ITEM.icon?.src ?? null,
        },
        {
          itemId: COLOR_TABARD_ITEM.id,
          name: COLOR_TABARD_ITEM.label,
          iconKind: COLOR_TABARD_ITEM.icon?.kind ?? null,
          iconSrc: COLOR_TABARD_ITEM.icon?.src ?? null,
        },
      ],
    },
  ];

  inventoryDragPreview.className = 'inventory-drag-preview';
  inventoryDragPreview.hidden = true;
  document.body.appendChild(inventoryDragPreview);

  function resolveInventoryItemId(rawValue) {
    /* The migration keeps existing callers working while shifting storage onto
    stable item ids. Known labels map to declared item ids; voxel names and
    already-canonical ids pass through unchanged. */
    if (typeof rawValue !== 'string' || !rawValue) return null;
    if (itemDefinitionById[rawValue]) return rawValue;
    if (itemDefinitionByLabel[rawValue]) return itemDefinitionByLabel[rawValue].id;
    return rawValue;
  }

  function getItemDefinition(itemId) {
    return itemDefinitionById[itemId] ?? null;
  }

  function getInventoryItemLabel(itemId) {
    const itemDefinition = getItemDefinition(itemId);
    return itemDefinition?.label ?? itemId;
  }

  function getVoxelTypeColor(itemId) {
    const found = voxelTypes.find(function (type) { return type.name === itemId; });
    return found ? found.color : 0xffffff;
  }

  function getVoxelTypeHexColor(itemId) {
    return '#' + getVoxelTypeColor(itemId).toString(16).padStart(6, '0');
  }

  function createInventoryStackIcon(itemId) {
    const itemDefinition = getItemDefinition(itemId);
    const itemLabel = itemDefinition?.label ?? getInventoryItemLabel(itemId);
    const iconDefinition = itemDefinition?.icon ?? null;
    if (iconDefinition?.kind === 'coin') {
      return createCoinSymbolIcon({
        symbolSrc: iconDefinition.src,
        symbolAlt: itemLabel,
        symbolOpacity: 0.75,
      });
    }
    if (iconDefinition?.src) {
      // Item pickups like sword and gun should keep their authored icons in both
      // the inventory window and the hotbar instead of falling back to voxel cubes.
      return createImageIcon(iconDefinition.src, itemLabel);
    }
    return createVoxelIcon(getVoxelTypeHexColor(itemId));
  }

  function createEncyclopediaItemIcon(itemEntry) {
    if (!itemEntry) return null;

    // Reusing the same icon resolution rules keeps the encyclopedia aligned with
    // the inventory and hotbar, including generated icons like the coin circle.
    if (itemEntry.iconKind === 'coin') {
      return createCoinSymbolIcon({
        symbolSrc: itemEntry.iconSrc,
        symbolAlt: itemEntry.name,
        symbolOpacity: 0.75,
      });
    }
    if (itemEntry.iconSrc) {
      return createImageIcon(itemEntry.iconSrc, itemEntry.name);
    }
    return null;
  }

  function hideCharacterEquipmentPicker() {
    activeCharacterEquipmentSlot = null;

    for (let i = 0; i < characterEquipmentSlotEls.length; i += 1) {
      characterEquipmentSlotEls[i].classList.remove('is-active');
    }

    if (characterEquipmentPicker) {
      characterEquipmentPicker.hidden = true;
    }
    if (characterEquipmentPickerSlots) {
      characterEquipmentPickerSlots.textContent = '';
    }
  }

  function getCharacterEquipmentSlotElement(slotName) {
    const resolvedSlot = normalizeEquipmentSlot(slotName);
    if (!resolvedSlot) return null;

    return characterEquipmentSlotEls.find(function (slotEl) {
      return normalizeEquipmentSlot(slotEl.dataset.equipmentSlot) === resolvedSlot;
    }) ?? null;
  }

  function getEquippedItemIdForSlot(slotName) {
    if (!equipment?.getEquippedItemId) return null;
    return equipment.getEquippedItemId(slotName);
  }

  function renderCharacterEquipmentSlotContent(slotEl) {
    if (!slotEl) return;

    const slotName = normalizeEquipmentSlot(slotEl.dataset.equipmentSlot);
    const equippedItemId = slotName ? getEquippedItemIdForSlot(slotName) : null;
    const defaultMarkup = slotEl.dataset.defaultMarkup ?? slotEl.innerHTML;
    const defaultTitle = slotEl.dataset.defaultTitle ?? slotEl.title;

    if (!slotEl.dataset.defaultMarkup) {
      slotEl.dataset.defaultMarkup = slotEl.innerHTML;
    }
    if (!slotEl.dataset.defaultTitle) {
      slotEl.dataset.defaultTitle = slotEl.title;
    }

    slotEl.textContent = '';

    if (!equippedItemId) {
      slotEl.innerHTML = defaultMarkup;
      slotEl.title = defaultTitle;
      return;
    }

    const itemDefinition = getItemDefinition(equippedItemId);
    const icon = createInventoryStackIcon(equippedItemId);
    if (icon) {
      slotEl.appendChild(icon);
    }

    slotEl.title = itemDefinition?.label ?? slotEl.title;
  }

  function syncCharacterEquipmentSlotUI() {
    for (let i = 0; i < characterEquipmentSlotEls.length; i += 1) {
      const slotEl = characterEquipmentSlotEls[i];
      const slotName = normalizeEquipmentSlot(slotEl.dataset.equipmentSlot);
      const isEmpty = !slotName || !getEquippedItemIdForSlot(slotName);

      renderCharacterEquipmentSlotContent(slotEl);
      slotEl.classList.toggle('is-empty', isEmpty);
      slotEl.classList.toggle('is-active', slotName != null && slotName === activeCharacterEquipmentSlot);
    }
  }

  function getInventoryWearablesForSlot(slotName) {
    const resolvedSlot = normalizeEquipmentSlot(slotName);
    if (!resolvedSlot) return [];

    return playerInventory.reduce(function (matches, stack, slotIndex) {
      if (!stack?.itemId) return matches;

      const itemDefinition = getItemDefinition(stack.itemId);
      const wearSlot = normalizeEquipmentSlot(itemDefinition?.wearSlot);
      if (!itemDefinition || wearSlot !== resolvedSlot) {
        return matches;
      }

      matches.push({
        slotIndex,
        stack,
        itemDefinition,
      });

      return matches;
    }, []);
  }

  function renderCharacterEquipmentPicker(slotName) {
    const resolvedSlot = normalizeEquipmentSlot(slotName);
    if (!characterEquipmentPicker || !characterEquipmentPickerSlots || !resolvedSlot) {
      hideCharacterEquipmentPicker();
      return;
    }

    const matchingWearables = getInventoryWearablesForSlot(resolvedSlot);
    if (!matchingWearables.length) {
      hideCharacterEquipmentPicker();
      return;
    }

    activeCharacterEquipmentSlot = resolvedSlot;
    characterEquipmentPicker.hidden = false;
    characterEquipmentPickerSlots.textContent = '';

    if (characterEquipmentPickerTitle) {
      const slotLabel = EQUIPMENT_SLOT_LABELS[resolvedSlot] ?? resolvedSlot;
      characterEquipmentPickerTitle.textContent = slotLabel + ' inventory';
    }

    const MAX_VISIBLE_EQUIPMENT_CHOICES = 32;
    const equippedItemId = getEquippedItemIdForSlot(resolvedSlot);
    matchingWearables.slice(0, MAX_VISIBLE_EQUIPMENT_CHOICES).forEach(function (entry) {
      const slotButton = document.createElement('button');
      const label = document.createElement('span');
      const count = document.createElement('span');
      const isEquippedItem = equippedItemId != null && equippedItemId === entry.itemDefinition.id;

      slotButton.type = 'button';
      slotButton.className = 'hotbar-slot character-equipment-picker-slot';
      if (isEquippedItem) slotButton.classList.add('is-selected');
      slotButton.dataset.itemId = entry.itemDefinition.id;
      slotButton.dataset.slotIndex = String(entry.slotIndex);
      slotButton.appendChild(createInventoryStackIcon(entry.itemDefinition.id));

      label.className = 'hotbar-slot-label';
      label.textContent = entry.itemDefinition.label;
      slotButton.appendChild(label);

      count.className = 'hotbar-slot-count';
      count.textContent = entry.stack.count > 1 ? String(entry.stack.count) : '';
      slotButton.appendChild(count);

      slotButton.addEventListener('click', function () {
        if (isEquippedItem) {
          equipment?.unequip?.(resolvedSlot);
          hideCharacterEquipmentPicker();
          syncCharacterEquipmentSlotUI();
          return;
        }

        if (!equipment?.equip) return;
        equipment.equip(entry.itemDefinition, resolvedSlot);
        hideCharacterEquipmentPicker();
        syncCharacterEquipmentSlotUI();
      });

      characterEquipmentPickerSlots.appendChild(slotButton);
    });

    syncCharacterEquipmentSlotUI();
  }

  function isEventInsideCharacterEquipmentUI(target) {
    if (!target || !(target instanceof Element)) return false;
    if (characterEquipmentPicker?.contains(target)) return true;
    if (characterEquipmentStage?.contains(target)) return true;
    return false;
  }



  function getSelectedSurvivalStack() {
    return playerInventory[selectedInventorySlotIndex];
  }

  function getSelectedHotbarStack() {
    if (selectedHotbarIndex < 0 || selectedHotbarIndex >= hotbarSlotEls.length) return null;
    return playerInventory[selectedHotbarIndex];
  }

  function emitSelectedHotbarStackChangeIfNeeded(force) {
    if (!onSelectedHotbarStackChange) return;

    const selectedStack = getSelectedHotbarStack();
    const nextItemId = selectedStack?.itemId ?? null;

    // The held item model only depends on the selected hotbar item type, so we
    // skip notifying the game when only the stack count changes in place.
    if (!force && nextItemId === lastSelectedHotbarItemId) return;

    lastSelectedHotbarItemId = nextItemId;
    onSelectedHotbarStackChange(selectedStack);
  }

  function getSelectedPlaceableVoxelType() {
    const selectedStack = getSelectedSurvivalStack();
    if (!selectedStack?.itemId) return null;

    // Only real voxel entries may be used by the world placement flow.
    // Inventory collectibles like coins, guns, and swords should stay intact
    // even when the player right-clicks while aiming at an editable block.
    if (!voxelTypeNames.has(selectedStack.itemId)) return null;
    return selectedStack.itemId;
  }

  function findInventorySlotIndexByItemId(itemIdOrLabel) {
    const itemId = resolveInventoryItemId(itemIdOrLabel);
    if (!itemId) return -1;
    return playerInventory.findIndex(function (stack) { return stack && stack.itemId === itemId; });
  }

  function inventoryHasType(itemIdOrLabel) {
    return findInventorySlotIndexByItemId(itemIdOrLabel) >= 0;
  }

  function isVoxelInventoryType(itemId) {
    return voxelTypeNames.has(itemId);
  }

  function syncSelectedVoxelTypeFromMode() {
    const selectedStack = getSelectedSurvivalStack();
    if (selectedStack && selectedStack.itemId) {
      selectedVoxelType = selectedStack.itemId;
    }
  }

  function getSelectedInventoryLabel() {
    const slotNumber = selectedInventorySlotIndex + 1;
    const selectedStack = getSelectedSurvivalStack();
    if (!selectedStack) {
      return 'Selected slot: ' + slotNumber + ' (empty)';
    }
    return 'Selected slot: ' + slotNumber + ' (' + getInventoryItemLabel(selectedStack.itemId) + (selectedStack.count > 1 ? ' x' + selectedStack.count : '') + ')';
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
      if (stack) slot.appendChild(createInventoryStackIcon(stack.itemId));

      label.className = 'hotbar-slot-label';
      label.textContent = stack ? getInventoryItemLabel(stack.itemId) : 'empty';
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

    if (activeCharacterEquipmentSlot) {
      renderCharacterEquipmentPicker(activeCharacterEquipmentSlot);
    } else {
      syncCharacterEquipmentSlotUI();
    }
  }

  function updateInventorySelectionUI() {
    if (inventorySelected) {
      const selectedStack = getSelectedSurvivalStack();
      inventorySelected.textContent = selectedStack
        ? 'Selected: ' + getInventoryItemLabel(selectedStack.itemId) + (selectedStack.count > 1 ? ' x' + selectedStack.count : '')
        : 'Selected: empty slot';
    }
    if (!inventorySlots) return;

    for (let i = 0; i < inventorySlotEls.length; i += 1) {
      const selectedStack = getSelectedSurvivalStack();
      const isSelected = inventorySlotEls[i].dataset.voxelType === (selectedStack ? selectedStack.itemId : null);
      inventorySlotEls[i].classList.toggle('is-selected', isSelected);
    }

    for (let i = 0; i < hotbarSlotEls.length; i += 1) {
      const stack = playerInventory[i];
      hotbarSlotEls[i].classList.toggle('is-selected', i === selectedHotbarIndex);
      hotbarSlotEls[i].textContent = '';
      if (!stack) continue;

      hotbarSlotEls[i].appendChild(createInventoryStackIcon(stack.itemId));

      const label = document.createElement('span');
      label.className = 'hotbar-slot-label';
      label.textContent = getInventoryItemLabel(stack.itemId);
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
    emitSelectedHotbarStackChangeIfNeeded(false);
  }

  function getInventoryStackLimit(itemId) {
    const itemDefinition = getItemDefinition(itemId);
    if (itemDefinition) {
      return itemDefinition.stackLimit;
    }
    return PLAYER_STACK_LIMIT;
  }

  function addItemToInventory(itemIdOrLabel, amount) {
    const itemId = resolveInventoryItemId(itemIdOrLabel);
    let remaining = amount === undefined ? 1 : amount;
    if (!itemId || remaining <= 0) return 0;
    const stackLimit = getInventoryStackLimit(itemId);
    if (stackLimit <= 0) return 0;

    for (let i = 0; i < playerInventory.length && remaining > 0; i += 1) {
      const stack = playerInventory[i];
      if (!stack || stack.itemId !== itemId || stack.count >= stackLimit) continue;
      const movedAmount = Math.min(stackLimit - stack.count, remaining);
      stack.count += movedAmount;
      remaining -= movedAmount;
    }

    for (let i = 0; i < playerInventory.length && remaining > 0; i += 1) {
      if (playerInventory[i]) continue;
      const movedAmount = Math.min(stackLimit, remaining);
      playerInventory[i] = { itemId: itemId, count: movedAmount };
      remaining -= movedAmount;
    }

    renderPlayerInventorySlots();
    updateInventorySelectionUI();
    emitSelectedHotbarStackChangeIfNeeded(false);
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
    emitSelectedHotbarStackChangeIfNeeded(false);
    return true;
  }

  function selectInventorySlot(index) {
    if (index < 0 || index >= playerInventory.length) return;
    selectedInventorySlotIndex = index;
    selectedHotbarIndex = index < hotbarSlotEls.length ? index : -1;
    syncSelectedVoxelTypeFromMode();
    renderPlayerInventorySlots();
    updateInventorySelectionUI();
    emitSelectedHotbarStackChangeIfNeeded(false);
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
    emitSelectedHotbarStackChangeIfNeeded(false);
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

  function addCreativeInventoryItem(itemIdOrLabel) {
    const itemId = resolveInventoryItemId(itemIdOrLabel);
    const added = addItemToInventory(itemId, 1);
    if (added <= 0) return;
    const slotIndex = findInventorySlotIndexByItemId(itemId);
    if (slotIndex >= 0) selectInventorySlot(slotIndex);
  }

  function renderItemEncyclopediaSlots() {
    if (!itemEncyclopediaSlots) return;
    itemEncyclopediaSlots.textContent = '';

    encyclopediaSections.forEach(function (section) {
      const sectionEl = document.createElement('section');
      const titleEl = document.createElement('h3');
      const gridEl = document.createElement('div');

      sectionEl.className = 'encyclopedia-section';
      titleEl.className = 'encyclopedia-section-title';
      titleEl.textContent = section.title;
      gridEl.className = 'encyclopedia-section-grid';

      section.items.forEach(function (itemEntry) {
        const slot = document.createElement('button');
        const label = document.createElement('span');

        slot.type = 'button';
        slot.className = 'hotbar-slot encyclopedia-item-slot';

        const icon = createEncyclopediaItemIcon(itemEntry);
        if (icon) slot.appendChild(icon);

        label.className = 'hotbar-slot-label';
        label.textContent = itemEntry.name;
        slot.appendChild(label);

        slot.addEventListener('click', function () {
          /* Encyclopedia items should mirror the voxel encyclopedia behavior in
          creative mode so every listed item can be pulled straight into the
          inventory without needing a separate world pickup first. */
          if (gameMode !== GAME_MODE_CREATIVE) return;
          addCreativeInventoryItem(itemEntry.itemId ?? itemEntry.name);
        });

        gridEl.appendChild(slot);
      });

      sectionEl.appendChild(titleEl);
      sectionEl.appendChild(gridEl);
      itemEncyclopediaSlots.appendChild(sectionEl);
    });
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
    emitSelectedHotbarStackChangeIfNeeded(false);
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

  for (let i = 0; i < characterEquipmentSlotEls.length; i += 1) {
    const slotEl = characterEquipmentSlotEls[i];
    slotEl.addEventListener('click', function () {
      const resolvedSlot = normalizeEquipmentSlot(slotEl.dataset.equipmentSlot);
      if (!resolvedSlot) return;

      if (activeCharacterEquipmentSlot === resolvedSlot) {
        hideCharacterEquipmentPicker();
        syncCharacterEquipmentSlotUI();
        return;
      }

      renderCharacterEquipmentPicker(resolvedSlot);
    });
  }

  document.addEventListener('pointerdown', function (event) {
    if (!activeCharacterEquipmentSlot) return;
    if (isEventInsideCharacterEquipmentUI(event.target)) return;
    hideCharacterEquipmentPicker();
    syncCharacterEquipmentSlotUI();
  });

  document.addEventListener('pointermove', handleInventoryDragMove, { passive: false });
  document.addEventListener('pointerup', handleInventoryDragEnd);
  document.addEventListener('pointercancel', handleInventoryDragEnd);

  renderInventorySlots();
  renderItemEncyclopediaSlots();
  renderPlayerInventorySlots();
  updateGameModeUI();
  syncCharacterEquipmentSlotUI();

  return {
    addCreativeInventoryItem: addCreativeInventoryItem,
    addItemToInventory: addItemToInventory,
    consumeSelectedInventoryItem: consumeSelectedInventoryItem,
    getGameMode: function () { return gameMode; },
    getSelectedHotbarStack: getSelectedHotbarStack,
    getSelectedPlaceableVoxelType: getSelectedPlaceableVoxelType,
    getSelectedSurvivalStack: getSelectedSurvivalStack,
    inventoryHasType: inventoryHasType,
    isVoxelInventoryType: isVoxelInventoryType,
    selectHotbarSlot: selectHotbarSlot,
    setGameMode: setGameMode,
  };
}
