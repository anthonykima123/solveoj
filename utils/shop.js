const BANNERS = [
  { id: 'banner_dawn',     name: '여명',       price: 200,  rarity: 'common',    css: 'linear-gradient(135deg, #f97316 0%, #fbbf24 100%)' },
  { id: 'banner_ocean',    name: '심해',       price: 200,  rarity: 'common',    css: 'linear-gradient(135deg, #0ea5e9 0%, #1d4ed8 100%)' },
  { id: 'banner_forest',   name: '초원',       price: 200,  rarity: 'common',    css: 'linear-gradient(135deg, #22c55e 0%, #166534 100%)' },
  { id: 'banner_ash',      name: '잿빛',       price: 200,  rarity: 'common',    css: 'linear-gradient(135deg, #64748b 0%, #1e293b 100%)' },
  { id: 'banner_cherry',   name: '벚꽃',       price: 500,  rarity: 'rare',      css: 'linear-gradient(135deg, #fda4af 0%, #ec4899 60%, #be185d 100%)' },
  { id: 'banner_dusk',     name: '황혼',       price: 500,  rarity: 'rare',      css: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f97316 100%)' },
  { id: 'banner_aurora',   name: '오로라',     price: 800,  rarity: 'rare',      css: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 40%, #0ea5e9 100%)' },
  { id: 'banner_gold',     name: '황금',       price: 1000, rarity: 'epic',      css: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 50%, #b45309 100%)' },
  { id: 'banner_platinum', name: '플래티넘',   price: 1500, rarity: 'epic',      css: 'linear-gradient(135deg, #5eead4 0%, #14b8a6 50%, #0f766e 100%)' },
  { id: 'banner_night',    name: '밤하늘',     price: 1500, rarity: 'epic',      css: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #334155 100%)' },
  { id: 'banner_galaxy',   name: '은하수',     price: 3000, rarity: 'legendary', css: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 30%, #7c3aed 60%, #a855f7 80%, #ec4899 100%)' },
  { id: 'banner_ruby',     name: '루비',       price: 5000, rarity: 'legendary', css: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #f87171 100%)' },
  { id: 'banner_diamond',  name: '다이아몬드', price: 5000, rarity: 'legendary', css: 'linear-gradient(135deg, #bfdbfe 0%, #38bdf8 40%, #0284c7 70%, #1e40af 100%)' },
];

// 난이도별 코인 보상 (첫 AC 기준)
const COIN_PER_DIFFICULTY = {
  Bronze: 5, Silver: 15, Gold: 30, Platinum: 60, Diamond: 100, Ruby: 150
};

// 대회 순위별 코인 보상
const CONTEST_PRIZES = { 1: 500, 2: 300, 3: 150 };

const RARITY_LABEL = { common: '일반', rare: '희귀', epic: '에픽', legendary: '전설' };
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

function getBannerById(id) { return BANNERS.find(b => b.id === id) || null; }

module.exports = { BANNERS, COIN_PER_DIFFICULTY, CONTEST_PRIZES, RARITY_LABEL, RARITY_ORDER, getBannerById };
