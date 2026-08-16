// Rolfe Legends 2 — Farm Treasures (relics). Data; hooks live in combat.js/run.js.
// Every relic names its StS original. James-approved list, Thu 2026-07-30.

export const RELICS = {
  // starters
  big_breakfast: { name: 'Big Breakfast', emoji: '🥞', sts: 'Burning Blood', starter: 'aaron',
    text: 'Heal 8 HP after every fight.' },
  head_start: { name: 'Head Start', emoji: '👟', sts: 'Ring of the Snake', starter: 'wyatt',
    text: 'Draw 2 extra cards on your first turn.' },
  diaper_bag: { name: 'Diaper Bag', emoji: '👜', sts: 'Cracked Core', starter: 'liam',
    text: 'Float a Stinky Diaper at the start of each fight.' },
  // pool
  fence_post: { name: 'Fence Post', emoji: '🪵', sts: 'Anchor', text: 'Start each fight with 8 Block.' },
  grannys_thermos: { name: "Granny's Thermos", emoji: '☕', sts: 'Blood Vial', text: 'Heal 2 HP at the start of each fight.' },
  barbed_wire: { name: 'Barbed Wire', emoji: '🌵', sts: 'Bronze Scales', text: 'Enemies that attack you take 3 damage.' },
  barn_lantern: { name: 'Barn Lantern', emoji: '🏮', sts: 'Lantern', text: 'Gain 1 extra ⚡ on your first turn.' },
  lucky_horseshoe: { name: 'Lucky Horseshoe', emoji: '🧲', sts: 'Vajra', text: 'Start each fight with 1 Strength.' },
  skipping_stone: { name: 'Skipping Stone', emoji: '🪨', sts: 'Oddly Smooth Stone', text: 'Start each fight with 1 Dexterity.' },
  old_quilt: { name: 'Old Quilt', emoji: '🛏️', sts: 'Orichalcum', text: 'End your turn with no Block? Gain 6 Block.' },
  sunflower: { name: 'Sunflower', emoji: '🌻', sts: 'Happy Flower', text: 'Every 3rd turn, gain 1 extra ⚡.' },
  slingshot: { name: 'Slingshot', emoji: '🪃', sts: 'Pen Nib', text: 'Every 10th Attack you play deals double damage.' },
  soccer_drills: { name: 'Soccer Drills', emoji: '⚽', sts: 'Kunai', text: 'Play 3 Attacks in one turn: gain 1 Dexterity.' },
  hay_bale_toss: { name: 'Hay Bale Toss', emoji: '🌾', sts: 'Shuriken', text: 'Play 3 Attacks in one turn: gain 1 Strength.' },
  rally_cap: { name: 'Rally Cap', emoji: '🧢', sts: 'Centennial Puzzle', text: 'First time you lose HP each fight: draw 3 cards.' },
  // boss
  keys_tractor: { name: 'Keys to the Tractor', emoji: '🔑', sts: '(energy boss relic, no downside)', boss: true,
    text: 'Gain 1 extra ⚡ every turn.' },
};

export function relicPool(ownedRelics) {
  return Object.keys(RELICS).filter((id) => !RELICS[id].starter && !RELICS[id].boss && !ownedRelics.includes(id));
}
