import { WatchlistEntry } from './watchlistTypes';

const SKIN_POOL = [
  { name: 'AK-47 | Redline', rarity: 'classified', wear: 'Field-Tested' },
  { name: 'AWP | Asiimov', rarity: 'covert', wear: 'Field-Tested' },
  { name: 'M4A4 | Howl', rarity: 'contraband', wear: 'Factory New' },
  { name: 'Karambit | Doppler', rarity: 'covert', wear: 'Factory New' },
  { name: 'Glock-18 | Fade', rarity: 'restricted', wear: 'Factory New' },
  { name: 'USP-S | Kill Confirmed', rarity: 'covert', wear: 'Minimal Wear' },
  { name: 'Desert Eagle | Blaze', rarity: 'restricted', wear: 'Factory New' },
  { name: 'AK-47 | Fire Serpent', rarity: 'covert', wear: 'Field-Tested' },
  { name: 'M4A1-S | Hot Rod', rarity: 'classified', wear: 'Factory New' },
  { name: 'AWP | Dragon Lore', rarity: 'covert', wear: 'Minimal Wear' },
  { name: 'Butterfly Knife | Fade', rarity: 'covert', wear: 'Factory New' },
  { name: 'AK-47 | Vulcan', rarity: 'classified', wear: 'Minimal Wear' },
  { name: 'M4A4 | Asiimov', rarity: 'covert', wear: 'Field-Tested' },
  { name: 'AWP | Hyper Beast', rarity: 'covert', wear: 'Minimal Wear' },
  { name: 'P250 | See Ya Later', rarity: 'classified', wear: 'Factory New' },
  { name: 'USP-S | Neo-Noir', rarity: 'classified', wear: 'Factory New' },
  { name: 'M9 Bayonet | Tiger Tooth', rarity: 'covert', wear: 'Factory New' },
  { name: 'AK-47 | Neon Rider', rarity: 'classified', wear: 'Factory New' },
  { name: 'AWP | Containment Breach', rarity: 'covert', wear: 'Minimal Wear' },
  { name: 'Glock-18 | Gamma Doppler', rarity: 'covert', wear: 'Factory New' },
  { name: 'M4A1-S | Printstream', rarity: 'covert', wear: 'Factory New' },
  { name: 'AK-47 | Nightwish', rarity: 'covert', wear: 'Minimal Wear' },
  { name: 'Desert Eagle | Printstream', rarity: 'covert', wear: 'Factory New' },
  { name: 'Bayonet | Marble Fade', rarity: 'covert', wear: 'Factory New' },
  { name: 'Sport Gloves | Vice', rarity: 'extraordinary', wear: 'Field-Tested' },
];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

export const generateWatchlistItems = (count: number = 50): WatchlistEntry[] => {
  return Array.from({ length: count }, (_, i) => {
    const base = SKIN_POOL[i % SKIN_POOL.length];
    const price = Math.round(rand(2, 5000) * 100) / 100;
    const delta = Math.round(rand(-15, 25) * 10) / 10;
    const floatVal = Math.round(rand(0.001, 0.75) * 100000) / 100000;
    const isStatTrak = Math.random() > 0.8;
    const isSouvenir = !isStatTrak && Math.random() > 0.9;

    return {
      id: `wl-${Date.now()}-${i}-${randInt(1000, 9999)}`,
      name: `${isStatTrak ? 'StatTrak™ ' : ''}${isSouvenir ? 'Souvenir ' : ''}${base.name}`,
      market_hash_name: base.name,
      icon_url: '/placeholder.svg',
      price_usd: price,
      prev_price_usd: Math.round(price * (1 - delta / 100) * 100) / 100,
      delta_percent: delta,
      float_value: floatVal,
      float_min: 0,
      float_max: 1,
      paint_seed: randInt(1, 999),
      status: Math.random() > 0.15 ? 'active' : 'paused',
      rarity: base.rarity,
      is_stattrak: isStatTrak,
      is_souvenir: isSouvenir,
      wear: base.wear,
      added_at: new Date(Date.now() - randInt(60000, 86400000 * 7)).toISOString(),
      last_updated: new Date().toISOString(),
    } satisfies WatchlistEntry;
  });
};

/** Simulate price changes on existing items */
export const simulatePriceChanges = (items: WatchlistEntry[]): { updated: WatchlistEntry[]; changed: WatchlistEntry[] } => {
  const changed: WatchlistEntry[] = [];
  const updated = items.map(item => {
    if (Math.random() > 0.3) return item; // 70% no change
    const changePct = (Math.random() - 0.5) * 6; // ±3%
    const newPrice = Math.round(item.price_usd * (1 + changePct / 100) * 100) / 100;
    const newItem: WatchlistEntry = {
      ...item,
      prev_price_usd: item.price_usd,
      price_usd: newPrice,
      delta_percent: Math.round(((newPrice - item.prev_price_usd) / item.prev_price_usd) * 100 * 10) / 10,
      last_updated: new Date().toISOString(),
    };
    if (Math.abs(changePct) > 1) changed.push(newItem);
    return newItem;
  });
  return { updated, changed };
};
