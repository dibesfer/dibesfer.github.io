export class Item {
  constructor({
    id = '',
    label = 'Item',
    description = '',
    icon = null,
    itemAppearance = null,
    pickable = true,
    stackLimit = 99,
    metadata = null,
  } = {}) {
    /* This class is intentionally introduced as a declaration-first redesign
    layer. Kolorlando currently creates item behavior through several separate
    flows, so this constructor defines the future shared shape without forcing
    the existing runtime to migrate all at once. */

    /* A stable id gives gameplay systems a machine-facing key that is safer
    than relying only on display labels once items gain more behaviors,
    variants, persistence, or multiplayer synchronization. */
    this.id = typeof id === 'string' ? id : '';

    /* The label remains the player-facing readable name for inventory slots,
    menus, and debug output. Keeping it separate from id lets the game evolve
    naming freely without breaking internal item references later. */
    this.label = typeof label === 'string' && label.trim() ? label.trim() : 'Item';

    /* Description is declared now so future UI panels such as encyclopedia,
    tooltips, crafting menus, or equipment panels can draw text from the same
    item definition instead of inventing separate description lookups. */
    this.description = typeof description === 'string' ? description : '';

    /* Icon is the future UI-facing visual descriptor. This can later point to
    an authored image asset, a generated voxel icon recipe, or a richer config
    object without changing the outer Item class contract. */
    this.icon = icon;

    /* itemAppearance is reserved for the world-space pickup representation.
    Declaring it here makes the future design explicit: the same item
    definition should know how it appears in the world, not only in menus. */
    this.itemAppearance = itemAppearance;

    /* pickable lets the shared item definition describe whether the world item
    may enter inventory at all. This cleanly covers special cases such as Spawn
    Point markers, which behave like items in the world but should not be
    collected into the player's stack-based inventory flow. */
    this.pickable = Boolean(pickable);

    /* Stack limit belongs in the shared item definition so inventory,
    pickups, shops, loot drops, and save data can all follow one item rule
    instead of duplicating magic numbers in separate systems. Non-pickable
    items effectively do not participate in stacking, so they clamp to zero
    until the runtime later decides to expose a more specialized rule set. */
    this.stackLimit = this.pickable
      ? (Number.isFinite(stackLimit) && stackLimit > 0 ? Math.floor(stackLimit) : 99)
      : 0;

    /* metadata is an intentionally open extension bag. This keeps the first
    declaration flexible while the real item system is still being designed,
    avoiding premature subclassing before the team sees which fields repeat. */
    this.metadata = metadata && typeof metadata === 'object'
      ? { ...metadata }
      : {};
  }
}

export class Holdable extends Item {
  constructor({
    attachment = null,
    actionType = 'none',
    ...itemOptions
  } = {}) {
    /* Holdables are the branch that participates in the active hand/tool flow,
    so actionType lives here instead of on every generic item. This keeps the
    base Item declaration focused on shared item identity and presentation. */
    super(itemOptions);

    /* actionType prints the intended gameplay family for hand-mounted items.
    Future systems can branch from this value to decide whether the holdable is
    used as a weapon, tool, consumable trigger, or other active hand action. */
    this.actionType = typeof actionType === 'string' && actionType.trim()
      ? actionType.trim()
      : 'none';

    /* Holdables are mounted into the active hand/item presentation flow, so
    attachment belongs here rather than on every generic item declaration. */
    this.attachment = attachment;
  }
}

export class Wearable extends Item {
  constructor({
    attachment = null,
    wearSlot = null,
    ...itemOptions
  } = {}) {
    /* Wearables are still items first, so the shared item constructor remains
    the single place where common behavior such as pickup rules, icons, stack
    handling, attachments, and action typing are declared. */
    super(itemOptions);

    /* The subclass itself already expresses that this item is wearable, so the
    dedicated property we need here is the stable slot name used by future
    equipment systems such as head, chest, legs, feet, hands, or back. */
    this.wearSlot = typeof wearSlot === 'string' && wearSlot.trim()
      ? wearSlot.trim()
      : null;

    /* Wearables also mount onto the player body, so attachment lives on this
    specialization instead of the generic item base. */
    this.attachment = attachment;
  }
}

/* The first concrete item definition keeps the migration deliberately narrow:
Coin becomes the pilot item for the new declaration-based flow before the rest
of Kolorlando's items move over to the shared item model. */
export const SPAWN_POINT_ITEM = new Item({
  id: 'spawn-point',
  label: 'Spawn Point',
  description: 'A world marker item that marks the starting point and stays in the scene.',
  icon: {
    kind: 'image',
    src: 'assets/icons/diamonds.png',
    alt: 'Spawn Point',
  },
  itemAppearance: {
    kind: 'default',
    groundYOffset: 2,
  },
  pickable: false,
});

export const COIN_ITEM = new Item({
  id: 'coin',
  label: 'Coin',
  description: 'A pickable currency item used as a simple collectible.',
  icon: {
    kind: 'coin',
    src: 'assets/icons/KoloraMonero.png',
    alt: 'Coin',
  },
  itemAppearance: {
    kind: 'coin',
  },
  pickable: true,
  stackLimit: 99,
});

export const SWORD_ITEM = new Holdable({
  id: 'sword',
  label: 'Sword',
  description: 'A pickable melee weapon that can be held in the player hand.',
  icon: {
    kind: 'image',
    src: 'assets/weapons/gladius.png',
    alt: 'Sword',
  },
  itemAppearance: {
    kind: 'goxel',
    modelUrl: 'assets/3D/weapons/sword.gltf',
  },
  attachment: {
    slotName: 'rightHandSlot',
    modelUrl: 'assets/3D/weapons/sword.gltf',
    modelScale: 0.1,
    pivotMode: 'baseCenter',
    position: { x: 0, y: 0, z: -0.2 },
    firstPersonPosition: { x: 0, y: 0, z: 0.2 },
    rotation: { x: Math.PI * 0.5, y: 0, z: 0 },
  },
  actionType: 'weapon',
  pickable: true,
  stackLimit: 1,
});

export const GUN_ITEM = new Holdable({
  id: 'gun',
  label: 'Gun',
  description: 'A pickable ranged weapon that can be held and fired by the player.',
  icon: {
    kind: 'image',
    src: 'assets/weapons/pistol-gun.png',
    alt: 'Gun',
  },
  itemAppearance: {
    kind: 'goxel',
    modelUrl: 'assets/3D/weapons/gun.gltf',
  },
  attachment: {
    slotName: 'rightHandSlot',
    modelUrl: 'assets/3D/weapons/gun.gltf',
    modelScale: 0.05,
    pivotMode: 'baseCenter',
    position: { x: 0, y: -0.2, z: 0 },
    firstPersonPosition: { x: 0, y: -0.2, z: 0.15 },
    rotation: { x: 0, y: -Math.PI * 0.5, z: -Math.PI * 0.5 },
  },
  actionType: 'weapon',
  pickable: true,
  stackLimit: 1,
});

export const BOXEL_SELECTION_TOOL_ITEM = new Holdable({
  id: 'boxel-selection-tool',
  label: 'Boxel Selection Tool',
  description: 'A pickable selection tool used to mark voxel ranges in the world.',
  icon: {
    kind: 'image',
    src: 'assets/icons/Asymmetrical_symbol_of_Chaos.png',
    alt: 'Boxel Selection Tool',
  },
  itemAppearance: {
    kind: 'boxel-selection-tool',
    iconUrl: 'assets/icons/Asymmetrical_symbol_of_Chaos.png',
  },
  actionType: 'tool',
  pickable: true,
  stackLimit: 1,
});

export const COLOR_CHEST_ITEM = new Wearable({
  id: 'color-chest',
  label: 'Color Chest',
  description: 'A white wearable chest piece built from the player torso and arm silhouette.',
  icon: {
    kind: 'image',
    src: 'assets/armor/chest-armor.png',
    alt: 'Color Chest',
  },
  itemAppearance: {
    kind: 'color-chest',
    color: 0xffffff,
  },
  wearSlot: 'chest',
  attachment: {
    slotName: 'torso',
  },
  metadata: {
    humanoidWearable: {
      type: 'chest',
      color: 0xffffff,
    },
  },
  pickable: true,
  stackLimit: 1,
});

export const COLOR_PANTS_ITEM = new Wearable({
  id: 'color-pants',
  label: 'Color Pants',
  description: 'A white wearable pants piece built from the player leg silhouette.',
  icon: {
    kind: 'image',
    src: 'assets/armor/armored-pants.png',
    alt: 'Color Pants',
  },
  itemAppearance: {
    kind: 'color-pants',
    color: 0xffffff,
  },
  wearSlot: 'pants',
  metadata: {
    humanoidWearable: {
      type: 'pants',
      color: 0xffffff,
    },
  },
  pickable: true,
  stackLimit: 1,
});

export const COLOR_BOOTS_ITEM = new Wearable({
  id: 'color-boots',
  label: 'Color Boots',
  description: 'A white wearable boots piece built from the player foot silhouette.',
  icon: {
    kind: 'image',
    src: 'assets/armor/steeltoe-boots.png',
    alt: 'Color Boots',
  },
  itemAppearance: {
    kind: 'color-boots',
    color: 0xffffff,
  },
  wearSlot: 'boots',
  metadata: {
    humanoidWearable: {
      type: 'boots',
      color: 0xffffff,
    },
  },
  pickable: true,
  stackLimit: 1,
});

export const COLOR_GLOVES_ITEM = new Wearable({
  id: 'color-gloves',
  label: 'Color Gloves',
  description: 'White wearable gloves that replace both player hands together.',
  icon: {
    kind: 'image',
    src: 'assets/armor/gauntlet.png',
    alt: 'Color Gloves',
  },
  itemAppearance: {
    kind: 'color-gloves',
    color: 0xffffff,
  },
  wearSlot: 'gloves',
  metadata: {
    humanoidWearable: {
      type: 'gloves',
      color: 0xffffff,
    },
  },
  pickable: true,
  stackLimit: 1,
});

export const COLOR_SHOULDERS_ITEM = new Wearable({
  id: 'color-shoulders',
  label: 'Color Shoulders',
  description: 'White shoulder cubes that equip symmetrically on both shoulders.',
  icon: {
    kind: 'image',
    src: 'assets/armor/spiked-shoulder-armor.png',
    alt: 'Color Shoulders',
  },
  itemAppearance: {
    kind: 'color-shoulders',
    color: 0xffffff,
  },
  wearSlot: 'shoulders',
  metadata: {
    humanoidWearable: {
      type: 'shoulders',
      color: 0xffffff,
    },
  },
  pickable: true,
  stackLimit: 1,
});

export const COLOR_HELMET_ITEM = new Wearable({
  id: 'color-helmet',
  label: 'Color Helmet',
  description: 'A white helmet that replaces the full head, face, and hair silhouette.',
  icon: {
    kind: 'image',
    src: 'assets/armor/crested-helmet.png',
    alt: 'Color Helmet',
  },
  itemAppearance: {
    kind: 'color-helmet',
    color: 0xffffff,
  },
  wearSlot: 'helmet',
  metadata: {
    humanoidWearable: {
      type: 'helmet',
      color: 0xffffff,
    },
  },
  pickable: true,
  stackLimit: 1,
});

export const COLOR_CAPE_ITEM = new Wearable({
  id: 'color-cape',
  label: 'Color Cape',
  description: 'A white cape mounted from the upper middle back and falling to the floor.',
  icon: {
    kind: 'image',
    src: 'assets/armor/cape.png',
    alt: 'Color Cape',
  },
  itemAppearance: {
    kind: 'color-cape',
    color: 0xffffff,
  },
  wearSlot: 'cape',
  metadata: {
    humanoidWearable: {
      type: 'cape',
      color: 0xffffff,
    },
  },
  pickable: true,
  stackLimit: 1,
});

export const COLOR_TABARD_ITEM = new Wearable({
  id: 'color-tabard',
  label: 'Color Tabard',
  description: 'A front-chest emblem tabard that renders the chaos symbol on the torso.',
  icon: {
    kind: 'image',
    src: 'assets/armor/eagle-emblem.png',
    alt: 'Color Tabard',
  },
  itemAppearance: {
    kind: 'color-tabard',
    imageUrl: 'assets/icons/Asymmetrical_symbol_of_Chaos.png',
  },
  wearSlot: 'tabard',
  metadata: {
    humanoidWearable: {
      type: 'tabard',
      imageUrl: 'assets/icons/Asymmetrical_symbol_of_Chaos.png',
    },
  },
  pickable: true,
  stackLimit: 1,
});

/* A tiny registry makes the first item definition reusable from UI and world
code without committing the whole project to a larger item-database design yet. */
export const ITEM_DEFINITIONS = {
  [SPAWN_POINT_ITEM.id]: SPAWN_POINT_ITEM,
  [COIN_ITEM.id]: COIN_ITEM,
  [SWORD_ITEM.id]: SWORD_ITEM,
  [GUN_ITEM.id]: GUN_ITEM,
  [BOXEL_SELECTION_TOOL_ITEM.id]: BOXEL_SELECTION_TOOL_ITEM,
  [COLOR_CHEST_ITEM.id]: COLOR_CHEST_ITEM,
  [COLOR_PANTS_ITEM.id]: COLOR_PANTS_ITEM,
  [COLOR_BOOTS_ITEM.id]: COLOR_BOOTS_ITEM,
  [COLOR_GLOVES_ITEM.id]: COLOR_GLOVES_ITEM,
  [COLOR_SHOULDERS_ITEM.id]: COLOR_SHOULDERS_ITEM,
  [COLOR_HELMET_ITEM.id]: COLOR_HELMET_ITEM,
  [COLOR_CAPE_ITEM.id]: COLOR_CAPE_ITEM,
  [COLOR_TABARD_ITEM.id]: COLOR_TABARD_ITEM,
};
