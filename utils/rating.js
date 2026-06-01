const DIFFICULTY_SCORES = {
  'Bronze 5': 1,  'Bronze 4': 2,  'Bronze 3': 4,   'Bronze 2': 8,   'Bronze 1': 16,
  'Silver 5': 32, 'Silver 4': 64, 'Silver 3': 96,  'Silver 2': 128, 'Silver 1': 160,
  'Gold 5': 200,  'Gold 4': 250,  'Gold 3': 300,   'Gold 2': 350,   'Gold 1': 400,
  'Platinum 5': 450, 'Platinum 4': 500, 'Platinum 3': 550, 'Platinum 2': 600, 'Platinum 1': 650,
  'Diamond 5': 700,  'Diamond 4': 750,  'Diamond 3': 800,  'Diamond 2': 850,  'Diamond 1': 900,
  'Ruby 5': 950, 'Ruby 4': 1000, 'Ruby 3': 1100, 'Ruby 2': 1200, 'Ruby 1': 1400,
};

const TIER_THRESHOLDS = [
  { min: 0,     tier: 'Unrated',    cls: 'unrated'    },
  { min: 1,     tier: 'Bronze 5',   cls: 'bronze'     },
  { min: 5,     tier: 'Bronze 4',   cls: 'bronze'     },
  { min: 15,    tier: 'Bronze 3',   cls: 'bronze'     },
  { min: 30,    tier: 'Bronze 2',   cls: 'bronze'     },
  { min: 50,    tier: 'Bronze 1',   cls: 'bronze'     },
  { min: 80,    tier: 'Silver 5',   cls: 'silver'     },
  { min: 130,   tier: 'Silver 4',   cls: 'silver'     },
  { min: 200,   tier: 'Silver 3',   cls: 'silver'     },
  { min: 300,   tier: 'Silver 2',   cls: 'silver'     },
  { min: 430,   tier: 'Silver 1',   cls: 'silver'     },
  { min: 600,   tier: 'Gold 5',     cls: 'gold'       },
  { min: 800,   tier: 'Gold 4',     cls: 'gold'       },
  { min: 1000,  tier: 'Gold 3',     cls: 'gold'       },
  { min: 1250,  tier: 'Gold 2',     cls: 'gold'       },
  { min: 1550,  tier: 'Gold 1',     cls: 'gold'       },
  { min: 1900,  tier: 'Platinum 5', cls: 'platinum'   },
  { min: 2300,  tier: 'Platinum 4', cls: 'platinum'   },
  { min: 2750,  tier: 'Platinum 3', cls: 'platinum'   },
  { min: 3250,  tier: 'Platinum 2', cls: 'platinum'   },
  { min: 3800,  tier: 'Platinum 1', cls: 'platinum'   },
  { min: 4400,  tier: 'Diamond 5',  cls: 'diamond'    },
  { min: 5100,  tier: 'Diamond 4',  cls: 'diamond'    },
  { min: 5900,  tier: 'Diamond 3',  cls: 'diamond'    },
  { min: 6800,  tier: 'Diamond 2',  cls: 'diamond'    },
  { min: 7800,  tier: 'Diamond 1',  cls: 'diamond'    },
  { min: 9000,  tier: 'Ruby 5',     cls: 'ruby'       },
  { min: 10500, tier: 'Ruby 4',     cls: 'ruby'       },
  { min: 12500, tier: 'Ruby 3',     cls: 'ruby'       },
  { min: 15000, tier: 'Ruby 2',     cls: 'ruby'       },
  { min: 17500, tier: 'Ruby 1',     cls: 'ruby'       },
];

function getTierInfo(rating) {
  let result = TIER_THRESHOLDS[0];
  for (const t of TIER_THRESHOLDS) {
    if (rating >= t.min) result = t;
    else break;
  }
  return result;
}

function getNextThreshold(rating) {
  for (const t of TIER_THRESHOLDS) {
    if (t.min > rating) return t.min;
  }
  return null;
}

function getDifficultyScore(difficulty) {
  return DIFFICULTY_SCORES[difficulty] || 0;
}

module.exports = { getTierInfo, getNextThreshold, getDifficultyScore, DIFFICULTY_SCORES, TIER_THRESHOLDS };
