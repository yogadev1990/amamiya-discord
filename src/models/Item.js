const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    itemId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    description: { type: String },
    icon: { type: String },
    category: { type: String },
    price: { type: Number, default: 0 },
    isBuyable: { type: Boolean, default: true },
    rarity: { type: String, default: 'Common' }
});

module.exports = mongoose.model('Item', itemSchema);