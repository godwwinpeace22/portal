const mongoose = require('mongoose');
const Schema = mongoose.Schema;
module.exports = mongoose.model('Hashpin', new Schema({
    pin:Array,
    dateCreated:Date
}))