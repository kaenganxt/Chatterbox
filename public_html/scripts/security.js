/* global CryptoJS */

function generateHash(string, salt) {
    var text = string + salt;
    for (var i = 0; i < 10000; i++) {
        text = CryptoJS.SHA3(text + "");
    }
    return text +  "";
}

function generateRandString() {
    var chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!*/-|";
    var string = "";
    for (var i = 0; i < 20; i++) {
        string += chars[Math.floor(Math.random()*chars.length)];
    }
    return string;
}

function newHash(str) {
    var salt = generateRandString();
    var hash = generateHash(str, salt);
    return {salt: salt, hash: hash};
}