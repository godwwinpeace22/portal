const mongoose = require('mongoose');
const Schema = mongoose.Schema
module.exports = mongoose.model('User', new Schema({
    name:String,
    username:String,
    email:String,
    password:{type:String,bcrypt:true},
    memberRef:{type:Schema.Types.ObjectId, ref:'Member'},
    pin:String
}))