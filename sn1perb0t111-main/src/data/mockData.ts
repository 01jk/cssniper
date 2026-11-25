// Mock data for CS2 Skin Sniper Bot

export interface LogEntry {
  id: string;
  timestamp: Date;
  itemName: string;
  float: number;
  price: number;
  result: 'ignored' | 'bought' | 'failed';
  reason?: string;
}

export interface BotStatus {
  isRunning: boolean;
  pid: number;
  uptime: number; // seconds
  startedAt: Date | null;
}

export interface Metrics {
  balance: number;
  itemsSniped24h: number;
  avgSpeedMs: number;
  profitToday: number;
  profitWeek: number;
}

export interface ProfitDataPoint {
  date: string;
  profit: number;
  items: number;
}

export const mockBotStatus: BotStatus = {
  isRunning: true,
  pid: 48291,
  uptime: 14523,
  startedAt: new Date(Date.now() - 14523000),
};

export const mockMetrics: Metrics = {
  balance: 2847.52,
  itemsSniped24h: 12,
  avgSpeedMs: 47,
  profitToday: 156.84,
  profitWeek: 892.45,
};

export const mockLogEntries: LogEntry[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 120000),
    itemName: 'AK-47 | Case Hardened',
    float: 0.0821,
    price: 1245.00,
    result: 'bought',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 180000),
    itemName: 'AWP | Dragon Lore',
    float: 0.0312,
    price: 8750.00,
    result: 'failed',
    reason: 'Insufficient balance',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 240000),
    itemName: 'M4A4 | Howl',
    float: 0.1523,
    price: 3200.00,
    result: 'ignored',
    reason: 'Float too high',
  },
  {
    id: '4',
    timestamp: new Date(Date.now() - 300000),
    itemName: 'Karambit | Fade',
    float: 0.0089,
    price: 1890.00,
    result: 'bought',
  },
  {
    id: '5',
    timestamp: new Date(Date.now() - 420000),
    itemName: 'Glock-18 | Fade',
    float: 0.0234,
    price: 845.00,
    result: 'bought',
  },
  {
    id: '6',
    timestamp: new Date(Date.now() - 540000),
    itemName: 'AK-47 | Fire Serpent',
    float: 0.0891,
    price: 1120.00,
    result: 'ignored',
    reason: 'Price above threshold',
  },
  {
    id: '7',
    timestamp: new Date(Date.now() - 660000),
    itemName: 'Desert Eagle | Blaze',
    float: 0.0045,
    price: 420.00,
    result: 'bought',
  },
  {
    id: '8',
    timestamp: new Date(Date.now() - 780000),
    itemName: 'M4A1-S | Knight',
    float: 0.0102,
    price: 1580.00,
    result: 'failed',
    reason: 'Already sold',
  },
  {
    id: '9',
    timestamp: new Date(Date.now() - 900000),
    itemName: 'USP-S | Kill Confirmed',
    float: 0.0678,
    price: 185.00,
    result: 'bought',
  },
  {
    id: '10',
    timestamp: new Date(Date.now() - 1020000),
    itemName: 'Butterfly Knife | Doppler',
    float: 0.0321,
    price: 2100.00,
    result: 'ignored',
    reason: 'Phase mismatch',
  },
];

export const mockProfitData: ProfitDataPoint[] = [
  { date: '01/13', profit: 120, items: 3 },
  { date: '01/14', profit: 85, items: 2 },
  { date: '01/15', profit: 210, items: 5 },
  { date: '01/16', profit: -45, items: 1 },
  { date: '01/17', profit: 180, items: 4 },
  { date: '01/18', profit: 156, items: 3 },
  { date: '01/19', profit: 186, items: 6 },
];

export const mockCS2Items = [
  { name: 'AK-47 | Case Hardened', image: '/placeholder.svg', rarity: 'classified' },
  { name: 'AWP | Dragon Lore', image: '/placeholder.svg', rarity: 'covert' },
  { name: 'M4A4 | Howl', image: '/placeholder.svg', rarity: 'contraband' },
  { name: 'Karambit | Fade', image: '/placeholder.svg', rarity: 'covert' },
  { name: 'Glock-18 | Fade', image: '/placeholder.svg', rarity: 'restricted' },
  { name: 'AK-47 | Fire Serpent', image: '/placeholder.svg', rarity: 'covert' },
  { name: 'Desert Eagle | Blaze', image: '/placeholder.svg', rarity: 'restricted' },
  { name: 'M4A1-S | Knight', image: '/placeholder.svg', rarity: 'classified' },
  { name: 'USP-S | Kill Confirmed', image: '/placeholder.svg', rarity: 'covert' },
  { name: 'Butterfly Knife | Doppler', image: '/placeholder.svg', rarity: 'covert' },
];

// Helper functions
export const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

export const getFloatWear = (float: number): { label: string; color: string } => {
  if (float < 0.07) return { label: 'FN', color: 'text-green-400 bg-green-400/20' };
  if (float < 0.15) return { label: 'MW', color: 'text-lime-400 bg-lime-400/20' };
  if (float < 0.38) return { label: 'FT', color: 'text-yellow-400 bg-yellow-400/20' };
  if (float < 0.45) return { label: 'WW', color: 'text-orange-400 bg-orange-400/20' };
  return { label: 'BS', color: 'text-red-400 bg-red-400/20' };
};

export const getResultStyle = (result: LogEntry['result']): { label: string; color: string } => {
  switch (result) {
    case 'bought':
      return { label: 'Bought', color: 'text-accent bg-accent/20 border-accent/50' };
    case 'failed':
      return { label: 'Failed', color: 'text-destructive bg-destructive/20 border-destructive/50' };
    case 'ignored':
      return { label: 'Ignored', color: 'text-muted-foreground bg-muted border-border' };
  }
};
