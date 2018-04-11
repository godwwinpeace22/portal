const mongoose = require('mongoose');
const Schema = mongoose.Schema
module.exports = mongoose.model('Member', new Schema({
    _id:{type:Schema.Types.ObjectId},
    name:String,
    parish:String,
    email:String,
    imgSrc:String,
    zone:String,
    area:String,
    interest:String,
    userRef:{type:Schema.Types.ObjectId, ref:'User'},
    regNo:String,
}));