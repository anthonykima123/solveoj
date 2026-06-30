const express = require('express');
const { db } = require('../database');
const { requireLogin } = require('../middleware/auth');
const { BANNERS, getBannerById } = require('../utils/shop');
const router = express.Router();

router.get('/shop', (req, res) => {
  const user = req.session.user ? db.getUserById(req.session.user.id) : null;
  const inventory = user ? (user.banner_inventory || []) : [];
  const coins = user ? (user.coins || 0) : 0;
  const equipped = user ? (user.equipped_banner || null) : null;
  res.render('shop', { BANNERS, inventory, coins, equipped, query: req.query });
});

router.post('/shop/buy/:id', requireLogin, (req, res) => {
  const itemId = req.params.id;
  const item = getBannerById(itemId);
  if (!item) return res.redirect('/shop?err=notfound');
  const userId = req.session.user.id;
  if (db.hasBannerItem(userId, itemId)) return res.redirect('/shop?err=owned');
  if (!db.deductCoins(userId, item.price)) return res.redirect('/shop?err=nocoins');
  db.grantBannerItem(userId, itemId);
  res.redirect('/shop?bought=' + encodeURIComponent(item.name));
});

router.post('/shop/equip/:id', requireLogin, (req, res) => {
  const itemId = req.params.id;
  const userId = req.session.user.id;
  if (itemId === 'none') {
    db.equipBanner(userId, null);
    return res.redirect('/shop?unequipped=1');
  }
  if (!db.hasBannerItem(userId, itemId)) return res.redirect('/shop?err=notowned');
  db.equipBanner(userId, itemId);
  res.redirect('/shop?equipped=1');
});

module.exports = router;
