import type { IItem, IMagicProperty, IConstantData } from "@dschu012/d2s/lib/d2/types";

export interface SocketedItemSpec {
  itemCode: string;
  quality?: ItemSpec["quality"];
  level?: number;
  stats?: Array<{ id: number; values: number[] }>;
}

export interface ItemSpec {
  itemCode: string;
  quality: "low" | "normal" | "superior" | "magic" | "set" | "rare" | "unique" | "craft";
  level: number;
  identified?: boolean;
  ethereal?: boolean;
  sockets?: number;
  uniqueId?: number;
  setId?: number;
  magicPrefix?: number;
  magicSuffix?: number;
  rareNameId?: number;
  rareNameId2?: number;
  magicalNameIds?: (number | null)[];
  runewordId?: number;
  runewordAttributes?: Array<{ id: number; values: number[] }>;
  stats: Array<{ id: number; values: number[] }>;
  socketedItems?: SocketedItemSpec[];
  socketFill?: "mf" | "resist" | "damage" | "caster" | "ias" | "cbf";
  statOverrides?: Record<string, number[]>;
  defense?: number;
  maxDurability?: number;
  currentDurability?: number;
  quantity?: number;
  outputPath?: string;
  format?: "d2" | "raw";
}

const QUALITY_MAP: Record<ItemSpec["quality"], number> = {
  low: 1,
  normal: 2,
  superior: 3,
  magic: 4,
  set: 5,
  rare: 6,
  unique: 7,
  craft: 8,
};

const enum ItemType {
  Armor = 1,
  Shield = 2,
  Weapon = 3,
  Other = 4,
}

function resolveTypeId(itemCode: string, constants: IConstantData): ItemType {
  const trimmed = itemCode.trim();
  const armorEntry = (constants.armor_items as Record<string, any>)[trimmed];
  if (armorEntry) {
    return ItemType.Armor;
  }
  if ((constants.weapon_items as Record<string, any>)[trimmed]) {
    return ItemType.Weapon;
  }
  return ItemType.Other;
}

function toMagicProperty(stat: { id: number; values: number[] }, constants: IConstantData): IMagicProperty {
  const prop = constants.magical_properties[stat.id];
  return {
    id: stat.id,
    values: stat.values,
    name: prop?.s ?? "",
    description: "",
    visible: true,
    op_value: 0,
    op_stats: [],
  };
}

export function buildItem(spec: ItemSpec, constants: IConstantData): IItem {
  const qualityNum = QUALITY_MAP[spec.quality];
  const typeId = resolveTypeId(spec.itemCode, constants);
  const hasSockets = (spec.sockets ?? 0) > 0;

  const item: IItem = {
    // Flags
    identified: spec.identified !== false ? 1 : 0,
    socketed: hasSockets ? 1 : 0,
    new: 0,
    is_ear: 0,
    starter_item: 0,
    simple_item: 0,
    ethereal: spec.ethereal ? 1 : 0,
    personalized: 0,
    personalized_name: "",
    given_runeword: spec.runewordId != null ? 1 : 0,

    // CRITICAL: must be "100", not "101".
    // "100" (binary 4) = D2R v99 item version. The D2R game accepts this.
    // "101" (binary 5) = D2R v105 — causes runeword items to silently disappear in-game.
    // Note: the item version field is metadata only; the binary serialization format
    // is controlled separately by D2R_WRITE_VERSION in d2i-writer.ts.
    version: "100",

    // Location: stored in inventory
    location_id: 0,
    equipped_id: 0,
    position_x: 0,
    position_y: 0,
    alt_position_id: 0,

    // Type
    type: spec.itemCode.padEnd(4, " "),
    type_id: typeId,
    type_name: "",
    quest_difficulty: 0,

    // Sockets
    nr_of_items_in_sockets: 0,
    total_nr_of_sockets: spec.sockets ?? 0,

    // Item identity
    id: Math.floor(Math.random() * 0xffffffff),
    level: spec.level,
    quality: qualityNum,

    // Pictures
    multiple_pictures: 0,
    picture_id: 0,
    class_specific: 0,

    // Quality-specific fields
    low_quality_id: 0,
    timestamp: 0,
    ear_attributes: { class: 0, level: 0, name: "" },

    // Defense & durability
    defense_rating: spec.defense ?? 0,
    max_durability: spec.maxDurability ?? 0,
    current_durability: spec.currentDurability ?? spec.maxDurability ?? 0,
    quantity: spec.quantity ?? 0,

    // Magic
    magic_prefix: spec.magicPrefix ?? 0,
    magic_prefix_name: "",
    magic_suffix: spec.magicSuffix ?? 0,
    magic_suffix_name: "",

    // Runeword
    runeword_id: spec.runewordId ?? 0,
    runeword_name: "",
    runeword_attributes: [],

    // Set
    set_id: spec.setId ?? 0,
    set_name: "",
    set_list_count: 0,
    set_attributes: [],
    set_attributes_num_req: 0,
    set_attributes_ids_req: 0,

    // Rare
    rare_name: "",
    rare_name2: "",
    rare_name_id: spec.rareNameId ?? 0,
    rare_name_id2: spec.rareNameId2 ?? 0,
    magical_name_ids: (spec.magicalNameIds ?? [null, null, null, null, null, null]) as null[],

    // Unique
    unique_id: spec.uniqueId ?? 0,
    unique_name: "",

    // Attributes
    magic_attributes: spec.stats.map((s) => toMagicProperty(s, constants)),
    combined_magic_attributes: [],
    displayed_magic_attributes: [],
    displayed_runeword_attributes: [],
    displayed_combined_magic_attributes: [],

    // Socketed items
    socketed_items: [],

    // Display/metadata (not serialized)
    base_damage: { mindam: 0, maxdam: 0, twohandmindam: 0, twohandmaxdam: 0 },
    reqstr: 0,
    reqdex: 0,
    inv_width: 0,
    inv_height: 0,
    inv_file: 0,
    inv_transform: 0,
    transform_color: "",
    item_quality: 0,
    categories: [],
    file_index: 0,
    auto_affix_id: 0,
    _unknown_data: {},
  };

  // Runeword attributes
  if (spec.runewordId != null && spec.runewordAttributes) {
    item.runeword_attributes = spec.runewordAttributes.map((s) => toMagicProperty(s, constants));
  }

  // CRITICAL: position_x must be the socket slot index (0, 1, 2, ...).
  // Without this, all socketed items land at position 0 and the game cannot
  // determine rune order — runeword items silently disappear.
  if (spec.socketedItems?.length) {
    item.socketed_items = spec.socketedItems.map((s, i) => {
      const socketed = buildSocketedItem(s, spec.level, constants);
      socketed.position_x = i;
      return socketed;
    });
    item.nr_of_items_in_sockets = item.socketed_items.length;
  }

  return item;
}

function buildSocketedItem(spec: SocketedItemSpec, parentLevel: number, constants: IConstantData): IItem {
  const code = spec.itemCode.trim();
  const isRune = /^r\d{2}$/.test(code);
  const isGem = /^g[a-z]{2}$/.test(code);
  const isSimple = isRune || isGem;

  if (isSimple) {
    return {
      identified: 1,
      socketed: 0,
      new: 0,
      is_ear: 0,
      starter_item: 0,
      simple_item: 1,
      ethereal: 0,
      personalized: 0,
      personalized_name: "",
      given_runeword: 0,
      // CRITICAL: must be "100" — see buildItem() version comment for rationale.
      version: "100",
      // CRITICAL: must be 6. Indicates "socketed inside a parent item".
      // Other values (0 = stored, 1 = equipped, etc.) cause the item to
      // appear as a standalone item instead of inside the socket.
      location_id: 6,
      equipped_id: 0,
      position_x: 0,
      position_y: 0,
      alt_position_id: 0,
      type: code.padEnd(4, " "),
      type_id: ItemType.Other,
      type_name: "",
      quest_difficulty: 0,
      nr_of_items_in_sockets: 0,
      total_nr_of_sockets: 0,
      id: Math.floor(Math.random() * 0xffffffff),
      level: 0,
      quality: 0,
      multiple_pictures: 0,
      picture_id: 0,
      class_specific: 0,
      low_quality_id: 0,
      timestamp: 0,
      ear_attributes: { class: 0, level: 0, name: "" },
      defense_rating: 0,
      max_durability: 0,
      current_durability: 0,
      quantity: 0,
      magic_prefix: 0,
      magic_prefix_name: "",
      magic_suffix: 0,
      magic_suffix_name: "",
      runeword_id: 0,
      runeword_name: "",
      runeword_attributes: [],
      set_id: 0,
      set_name: "",
      set_list_count: 0,
      set_attributes: [],
      set_attributes_num_req: 0,
      set_attributes_ids_req: 0,
      rare_name: "",
      rare_name2: "",
      rare_name_id: 0,
      rare_name_id2: 0,
      magical_name_ids: [null, null, null, null, null, null] as null[],
      unique_id: 0,
      unique_name: "",
      magic_attributes: [],
      combined_magic_attributes: [],
      displayed_magic_attributes: [],
      displayed_runeword_attributes: [],
      displayed_combined_magic_attributes: [],
      socketed_items: [],
      base_damage: { mindam: 0, maxdam: 0, twohandmindam: 0, twohandmaxdam: 0 },
      reqstr: 0,
      reqdex: 0,
      inv_width: 0,
      inv_height: 0,
      inv_file: 0,
      inv_transform: 0,
      transform_color: "",
      item_quality: 0,
      categories: [],
      file_index: 0,
      auto_affix_id: 0,
      _unknown_data: {},
    };
  }

  // Non-simple socketed item (jewels, etc.) — full item
  const quality = spec.quality ?? "normal";
  const level = spec.level ?? parentLevel;
  const fullSpec: ItemSpec = {
    itemCode: spec.itemCode,
    quality,
    level,
    stats: spec.stats ?? [],
  };
  const item = buildItem(fullSpec, constants);
  // CRITICAL: must be 6 — see simple socketed item comment for rationale.
  item.location_id = 6;
  return item;
}
