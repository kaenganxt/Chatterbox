var wsHost = "localhost";
var wsPort = 8888;
var stunConfig = {
    'iceServers': [
        {
            url: 'turn:5.231.50.161:3478',
            credential: 'passwort', //I don't care. Anyone can see it anyway....
            username: 'chatterboxAccount'
        }
    ]
};
var lfConfig = {
    name: "Chatterbox",
    storeName: "chatterbox",
    description: "The chatterbox local data."
};
