import { MonitorItem, StickerInfo, CharmInfo } from './monitorTypes';

const stickerPool: Omit<StickerInfo, 'slot'>[] = [
  { name: 'Tyloo (Holo) | Stockholm 2021', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/stockh2021/tylo_holo.png', wear: 0, referencePrice: 13.26, globalListings: 1098 },
  { name: 'Natus Vincere (Holo) | Katowice 2014', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/katowice2014/navi_holo.png', wear: 0.02, referencePrice: 1250.00, globalListings: 42 },
  { name: 'Crown (Foil)', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/community02/crown_foil.png', wear: 0, referencePrice: 420.00, globalListings: 315 },
  { name: 'Reason Gaming (Holo) | Katowice 2014', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/katowice2014/reason_holo.png', wear: 0.05, referencePrice: 3800.00, globalListings: 18 },
  { name: 'Flammable (Foil)', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/community01/flammable_foil.png', wear: 0, referencePrice: 85.00, globalListings: 580 },
];

const generateStickers = (): StickerInfo[] | undefined => {
  if (Math.random() > 0.4) return undefined; // 60% no stickers
  const count = Math.random() > 0.5 ? Math.floor(Math.random() * 3) + 2 : 1;
  const stickers: StickerInfo[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    let idx: number;
    do { idx = Math.floor(Math.random() * stickerPool.length); } while (used.has(idx));
    used.add(idx);
    stickers.push({ ...stickerPool[idx], slot: i + 1 });
  }
  return stickers;
};

const charmPool: Omit<CharmInfo, 'pattern'>[] = [
  { name: 'Charm | Disco Ball', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/community02/crown_foil.png', referencePrice: 2.45 },
  { name: 'Charm | Wood Frog', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/community01/flammable_foil.png', referencePrice: 1.20 },
  { name: 'Charm | Semi-Precious', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/katowice2014/navi_holo.png', referencePrice: 8.50 },
  { name: 'Charm | Chicken Lil', imageUrl: 'https://steamcdn-a.akamaihd.net/apps/730/icons/econ/stickers/katowice2014/reason_holo.png', referencePrice: 0.85 },
];

const generateCharm = (): CharmInfo | undefined => {
  if (Math.random() > 0.35) return undefined;
  const base = charmPool[Math.floor(Math.random() * charmPool.length)];
  return { ...base, pattern: Math.floor(Math.random() * 9999) + 1 };
};

// Generate a colored SVG placeholder with weapon silhouette text
const makeSkinSvg = (weaponType: string, skinName: string, hue: number): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue},60%,25%)"/>
        <stop offset="100%" stop-color="hsl(${hue},40%,15%)"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" fill="url(#g)" rx="8"/>
    <text x="128" y="118" text-anchor="middle" fill="hsl(${hue},70%,70%)" font-family="sans-serif" font-size="18" font-weight="bold">${weaponType}</text>
    <text x="128" y="148" text-anchor="middle" fill="hsl(${hue},50%,55%)" font-family="sans-serif" font-size="14">${skinName}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const skinHues: Record<string, number> = {
  'M9 Bayonet | Doppler (Phase 4)': 220, 'USP-S | Kill Confirmed': 0, 'Desert Eagle | Golden Koi': 45,
  'MP5-SD | Phosphor': 160, 'SCAR-20 | Bloodsport': 10, 'USP-S | Lead Conduit': 200,
  'Butterfly Knife | Case Hardened': 210, 'M4A1-S | Golden Coil': 50, 'AK-47 | Inheritance': 270,
  'M4A4 | Hellish': 350, 'FAMAS | Roll Cage': 30, 'MP7 | Fade': 300,
  'Driver Gloves | Imperial Plaid': 25, 'Bowie Knife | Ultraviolet': 280,
  'USP-S | Royal Guard': 240, 'AWP | Asiimov': 35, 'AK-47 | Aquamarine Revenge': 175,
  'Karambit | Fade': 330, 'Glock-18 | Fade': 310, 'AK-47 | Fire Serpent': 15,
  'Sport Gloves | Crimson Kimono': 355,
};

const skinPool: Omit<MonitorItem, 'id' | 'price' | 'priceChange' | 'priceChangePercent' | 'bidPrice' | 'askPrice' | 'float' | 'paintSeed' | 'listedAgo' | 'isOnline' | 'imageUrl' | 'stickers'>[] = [
  { name: 'Sport Gloves | Crimson Kimono', weaponType: 'Sport Gloves', skinName: 'Crimson Kimono', wear: 'Field-Tested', isStatTrak: false, isSouvenir: false, rarity: 'extraordinary', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'Sport Gloves | Crimson Kimono', weaponType: 'Sport Gloves', skinName: 'Crimson Kimono', wear: 'Minimal Wear', isStatTrak: false, isSouvenir: false, rarity: 'extraordinary', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'M9 Bayonet | Doppler (Phase 4)', weaponType: 'M9 Bayonet', skinName: 'Doppler', wear: 'Factory New', isStatTrak: false, isSouvenir: false, rarity: 'covert', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'USP-S | Kill Confirmed', weaponType: 'USP-S', skinName: 'Kill Confirmed', wear: 'Well-Worn', isStatTrak: false, isSouvenir: false, rarity: 'covert', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'Desert Eagle | Golden Koi', weaponType: 'Desert Eagle', skinName: 'Golden Koi', wear: 'Factory New', isStatTrak: false, isSouvenir: false, rarity: 'restricted', stickerOverpay: 45.1, fadePercent: undefined },
  { name: 'MP5-SD | Phosphor', weaponType: 'MP5-SD', skinName: 'Phosphor', wear: 'Minimal Wear', isStatTrak: true, isSouvenir: false, rarity: 'mil-spec', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'SCAR-20 | Bloodsport', weaponType: 'SCAR-20', skinName: 'Bloodsport', wear: 'Field-Tested', isStatTrak: false, isSouvenir: false, rarity: 'classified', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'USP-S | Lead Conduit', weaponType: 'USP-S', skinName: 'Lead Conduit', wear: 'Factory New', isStatTrak: false, isSouvenir: false, rarity: 'mil-spec', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'Butterfly Knife | Case Hardened', weaponType: 'Butterfly Knife', skinName: 'Case Hardened', wear: 'Well-Worn', isStatTrak: false, isSouvenir: false, rarity: 'covert', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'M4A1-S | Golden Coil', weaponType: 'M4A1-S', skinName: 'Golden Coil', wear: 'Well-Worn', isStatTrak: false, isSouvenir: false, rarity: 'classified', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'AK-47 | Inheritance', weaponType: 'AK-47', skinName: 'Inheritance', wear: 'Minimal Wear', isStatTrak: false, isSouvenir: false, rarity: 'covert', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'M4A4 | Hellish', weaponType: 'M4A4', skinName: 'Hellish', wear: 'Well-Worn', isStatTrak: false, isSouvenir: false, rarity: 'restricted', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'FAMAS | Roll Cage', weaponType: 'FAMAS', skinName: 'Roll Cage', wear: 'Field-Tested', isStatTrak: false, isSouvenir: false, rarity: 'mil-spec', stickerOverpay: 38.1, fadePercent: undefined },
  { name: 'MP7 | Fade', weaponType: 'MP7', skinName: 'Fade', wear: 'Factory New', isStatTrak: false, isSouvenir: false, rarity: 'restricted', fadePercent: 93.1, stickerOverpay: undefined },
  { name: 'Driver Gloves | Imperial Plaid', weaponType: 'Driver Gloves', skinName: 'Imperial Plaid', wear: 'Minimal Wear', isStatTrak: false, isSouvenir: false, rarity: 'extraordinary', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'Bowie Knife | Ultraviolet', weaponType: 'Bowie Knife', skinName: 'Ultraviolet', wear: 'Field-Tested', isStatTrak: true, isSouvenir: false, rarity: 'covert', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'USP-S | Royal Guard', weaponType: 'USP-S', skinName: 'Royal Guard', wear: 'Factory New', isStatTrak: false, isSouvenir: false, rarity: 'classified', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'AWP | Asiimov', weaponType: 'AWP', skinName: 'Asiimov', wear: 'Field-Tested', isStatTrak: false, isSouvenir: false, rarity: 'covert', stickerOverpay: 22.4, fadePercent: undefined },
  { name: 'AK-47 | Aquamarine Revenge', weaponType: 'AK-47', skinName: 'Aquamarine Revenge', wear: 'Field-Tested', isStatTrak: false, isSouvenir: false, rarity: 'classified', stickerOverpay: undefined, fadePercent: undefined },
  { name: 'Karambit | Fade', weaponType: 'Karambit', skinName: 'Fade', wear: 'Factory New', isStatTrak: false, isSouvenir: false, rarity: 'covert', fadePercent: 98, stickerOverpay: undefined },
  { name: 'Glock-18 | Fade', weaponType: 'Glock-18', skinName: 'Fade', wear: 'Factory New', isStatTrak: false, isSouvenir: false, rarity: 'restricted', fadePercent: 95, stickerOverpay: undefined },
  { name: 'AK-47 | Fire Serpent', weaponType: 'AK-47', skinName: 'Fire Serpent', wear: 'Field-Tested', isStatTrak: false, isSouvenir: false, rarity: 'covert', stickerOverpay: undefined, fadePercent: undefined },
];

const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const noStickerTypes = new Set(['Sport Gloves', 'Driver Gloves', 'Hand Wraps', 'Moto Gloves', 'Specialist Gloves', 'Hydra Gloves', 'Broken Fang Gloves', 'Karambit', 'M9 Bayonet', 'Butterfly Knife', 'Bowie Knife', 'Falchion Knife', 'Flip Knife', 'Gut Knife', 'Huntsman Knife', 'Navaja Knife', 'Nomad Knife', 'Paracord Knife', 'Shadow Daggers', 'Skeleton Knife', 'Stiletto Knife', 'Survival Knife', 'Talon Knife', 'Ursus Knife', 'Classic Knife', 'Kukri Knife']);

export const generateMonitorItems = (count: number = 20): MonitorItem[] => {
  return Array.from({ length: count }, (_, i) => {
    const base = skinPool[i % skinPool.length];
    const price = randomFloat(5, 3000);
    const change = randomFloat(-50, 700);
    const changePercent = (change / price) * 100;
    const float = randomFloat(0.001, 0.99);
    const canHaveStickers = !noStickerTypes.has(base.weaponType);
    
    return {
      ...base,
      id: `item-${Date.now()}-${i}`,
      price: Math.round(price * 100) / 100,
      priceChange: Math.round(change * 100) / 100,
      priceChangePercent: Math.round(changePercent * 10) / 10,
      bidPrice: Math.round((price * randomFloat(0.7, 0.95)) * 100) / 100,
      askPrice: Math.round((price * randomFloat(1.01, 1.15)) * 100) / 100,
      float,
      paintSeed: randomInt(1, 999),
      listedAgo: `${randomInt(0, 5)} minutes ago`,
      isOnline: Math.random() > 0.15,
      imageUrl: makeSkinSvg(base.weaponType, base.skinName, skinHues[base.name] ?? 180),
      stickers: canHaveStickers ? generateStickers() : undefined,
      charm: canHaveStickers ? generateCharm() : undefined,
    };
  });
};
