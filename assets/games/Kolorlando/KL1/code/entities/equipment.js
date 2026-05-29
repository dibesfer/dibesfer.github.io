export const EQUIPMENT_SLOT_KEYS = Object.freeze([
  'tabard',
  'cape',
  'helmet',
  'shoulders',
  'chest',
  'gloves',
  'pants',
  'handRight',
  'boots',
  'handLeft',
]);

export const EQUIPMENT_SLOT_LABELS = Object.freeze({
  tabard: 'Tabard',
  cape: 'Cape',
  helmet: 'Helmet',
  shoulders: 'Shoulders',
  chest: 'Chest',
  gloves: 'Gloves',
  pants: 'Pants',
  handRight: 'Hand Right',
  boots: 'Boots',
  handLeft: 'Hand Left',
});

const EQUIPMENT_SLOT_ALIAS_MAP = Object.freeze({
  head: 'helmet',
  back: 'cape',
  legs: 'pants',
  feet: 'boots',
  face: 'tabard',
  shoulder: 'shoulders',
  shoulders: 'shoulders',
  shoulderright: 'shoulders',
  shoulderleft: 'shoulders',
  rightshoulder: 'shoulders',
  leftshoulder: 'shoulders',
  gloves: 'gloves',
  glove: 'gloves',
  gloveright: 'gloves',
  gloveleft: 'gloves',
  rightHand: 'handRight',
  leftHand: 'handLeft',
  rightGlove: 'gloves',
  leftGlove: 'gloves',
  righthand: 'handRight',
  lefthand: 'handLeft',
  rightglove: 'gloves',
  leftglove: 'gloves',
  rightShoulder: 'shoulders',
  leftShoulder: 'shoulders',
});

function createEmptyEquipmentSlots() {
  return EQUIPMENT_SLOT_KEYS.reduce(function (slots, slotKey) {
    slots[slotKey] = null;
    return slots;
  }, {});
}

export function normalizeEquipmentSlot(slotName) {
  if (typeof slotName !== 'string') return null;
  const trimmedSlotName = slotName.trim();
  if (!trimmedSlotName) return null;
  if (EQUIPMENT_SLOT_KEYS.includes(trimmedSlotName)) return trimmedSlotName;

  // Normalizing the human-readable grid titles keeps the shared equipment
  // state aligned with menu labels without forcing the UI to pre-convert them.
  const compactSlotName = trimmedSlotName.replace(/\s+/g, '');
  const lowerCompactSlotName = compactSlotName.toLowerCase();

  return EQUIPMENT_SLOT_ALIAS_MAP[trimmedSlotName]
    ?? EQUIPMENT_SLOT_ALIAS_MAP[compactSlotName]
    ?? EQUIPMENT_SLOT_ALIAS_MAP[lowerCompactSlotName]
    ?? null;
}

export function isEquipmentSlot(slotName) {
  return normalizeEquipmentSlot(slotName) != null;
}

export function createEquipment(options = {}) {
  const resolveItemDefinition = typeof options.resolveItemDefinition === 'function'
    ? options.resolveItemDefinition
    : function defaultResolveItemDefinition(itemOrDefinition) {
      return itemOrDefinition && typeof itemOrDefinition === 'object'
        ? itemOrDefinition
        : null;
    };

  const listeners = new Set();
  const slots = createEmptyEquipmentSlots();

  function emitChange(change) {
    const snapshot = getSnapshot();
    listeners.forEach(function (listener) {
      listener({
        ...change,
        slots: snapshot,
      });
    });
  }

  function getResolvedItemDefinition(itemOrDefinition) {
    return resolveItemDefinition(itemOrDefinition) ?? null;
  }

  function getResolvedWearSlot(itemOrDefinition, preferredSlot) {
    const itemDefinition = getResolvedItemDefinition(itemOrDefinition);
    const normalizedItemSlot = normalizeEquipmentSlot(itemDefinition?.wearSlot);
    if (normalizedItemSlot) {
      return normalizedItemSlot;
    }

    return normalizeEquipmentSlot(preferredSlot);
  }

  function isWearableItem(itemOrDefinition) {
    const itemDefinition = getResolvedItemDefinition(itemOrDefinition);
    return Boolean(itemDefinition && getResolvedWearSlot(itemDefinition));
  }

  function canEquip(itemOrDefinition, preferredSlot) {
    const itemDefinition = getResolvedItemDefinition(itemOrDefinition);
    const resolvedSlot = getResolvedWearSlot(itemDefinition, preferredSlot);
    const normalizedPreferredSlot = normalizeEquipmentSlot(preferredSlot);

    if (!itemDefinition || !resolvedSlot) {
      return {
        ok: false,
        reason: 'invalid-item',
        slot: null,
        item: itemDefinition,
      };
    }

    if (normalizedPreferredSlot && normalizedPreferredSlot !== resolvedSlot) {
      return {
        ok: false,
        reason: 'slot-mismatch',
        slot: resolvedSlot,
        preferredSlot: normalizedPreferredSlot,
        item: itemDefinition,
      };
    }

    return {
      ok: true,
      reason: null,
      slot: resolvedSlot,
      item: itemDefinition,
      replacedItemId: slots[resolvedSlot],
    };
  }

  function equip(itemOrDefinition, preferredSlot) {
    const result = canEquip(itemOrDefinition, preferredSlot);
    if (!result.ok) {
      return result;
    }

    const nextItemId = result.item.id ?? null;
    if (!nextItemId) {
      return {
        ok: false,
        reason: 'missing-item-id',
        slot: result.slot,
        item: result.item,
      };
    }

    const previousItemId = slots[result.slot];
    slots[result.slot] = nextItemId;

    emitChange({
      type: 'equip',
      slot: result.slot,
      itemId: nextItemId,
      previousItemId,
    });

    return {
      ok: true,
      slot: result.slot,
      item: result.item,
      itemId: nextItemId,
      previousItemId,
    };
  }

  function unequip(slotName) {
    const resolvedSlot = normalizeEquipmentSlot(slotName);
    if (!resolvedSlot) {
      return {
        ok: false,
        reason: 'invalid-slot',
        slot: null,
        itemId: null,
      };
    }

    const removedItemId = slots[resolvedSlot];
    if (!removedItemId) {
      return {
        ok: false,
        reason: 'empty-slot',
        slot: resolvedSlot,
        itemId: null,
      };
    }

    slots[resolvedSlot] = null;

    emitChange({
      type: 'unequip',
      slot: resolvedSlot,
      itemId: removedItemId,
      previousItemId: removedItemId,
    });

    return {
      ok: true,
      slot: resolvedSlot,
      itemId: removedItemId,
    };
  }

  function clear() {
    const previousSnapshot = getSnapshot();
    let changed = false;

    EQUIPMENT_SLOT_KEYS.forEach(function (slotKey) {
      if (!slots[slotKey]) return;
      slots[slotKey] = null;
      changed = true;
    });

    if (!changed) return previousSnapshot;

    emitChange({
      type: 'clear',
      slot: null,
      itemId: null,
      previousItemId: null,
    });

    return getSnapshot();
  }

  function hydrate(snapshot) {
    const nextSlots = createEmptyEquipmentSlots();

    EQUIPMENT_SLOT_KEYS.forEach(function (slotKey) {
      const nextItemId = snapshot && typeof snapshot === 'object'
        ? snapshot[slotKey] ?? null
        : null;
      nextSlots[slotKey] = typeof nextItemId === 'string' && nextItemId.trim()
        ? nextItemId
        : null;
    });

    EQUIPMENT_SLOT_KEYS.forEach(function (slotKey) {
      slots[slotKey] = nextSlots[slotKey];
    });

    emitChange({
      type: 'hydrate',
      slot: null,
      itemId: null,
      previousItemId: null,
    });

    return getSnapshot();
  }

  function getSnapshot() {
    return {
      ...slots,
    };
  }

  function getEquippedItemId(slotName) {
    const resolvedSlot = normalizeEquipmentSlot(slotName);
    return resolvedSlot ? slots[resolvedSlot] : null;
  }

  function getEquippedItem(slotName) {
    const itemId = getEquippedItemId(slotName);
    return itemId ? getResolvedItemDefinition(itemId) : null;
  }

  function has(slotName) {
    return Boolean(getEquippedItemId(slotName));
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return function noop() {};
    }

    listeners.add(listener);

    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  return {
    canEquip,
    clear,
    equip,
    getEquippedItem,
    getEquippedItemId,
    getResolvedWearSlot,
    getSnapshot,
    has,
    hydrate,
    isWearableItem,
    subscribe,
    unequip,
  };
}
