const mongoose = require('mongoose');
const Schema = mongoose.Schema;
module.exports = mongoose.model('Unhashpin', new Schema({
    pin:Array,
    dateCreated:Date
}))