/* global dataCache, CryptoJS, windows, windowsByName, conns, wsId */

var isSmall = ($(document).width() < 850 || $(document).height() < 450);
var chats = new Object();

loadScript("scripts/window.js", init);
function init() {
    getWindow("dataOverview", 400, 400, "Transferred data packets", "<div id='dataPacketsList'></div>", {save: true});
    getWindow("clientOverview", 400, 400, "Connected clients", "<div id='clientList'></div>", {save: true});
    if (typeof dataCache["decoded"].windows !== "undefined") {
        $.each(dataCache["decoded"].windows, function(key, value) {
            if (key.substr(0, 4) === "chat") return;
            var win = getWindow(key);
            win.show();
            win.setPosition(value.top, value.left);
        });
    }
    refreshFooter();
    setInterval(saveWindows, 60000);
    $("#chatterboxWindows").on("click", ".dataPacket", function() {
        $(this).toggleClass("dataPacketOpen");
    });
}

function chatWindow(clientId, rtcConn, user) {
    var client = parseInt(clientId);
    var username = user;
    chats[client] = this;
    getWindow("chat" + client, 250, 300, "Chat with " + user, "<div class='chatWindow' data-chat='" + client + "'></div><div class='chatInput'>\n\
              <form action='#' data-id='" + client + "'><input type='text' placeholder='Chat message' /></form></div>");
    rtcConn.registerListener("chat" + clientId, function(msg) {
        msg = JSON.parse(msg);
        if (msg.action === "chatMessage" && msg.id === client) {
            $(".chatWindow[data-chat='" + client + "']").append("<br style='line-height:25px' /><span class='chatMsg chatPartner'>" + msg.message + "</span>");
        }
    });
    getWindow("chat" + client).show();

    this.getUser = function() {
        return username;
    };

    this.delete = function() {
        delete chats[client];
        getWindow("chat" + client).delete();
    };

    this.send = function(input) {
        conns["client"][client].sendObj({"action": "chatMessage", "id": wsId, "message": input.val()});
        $(".chatWindow[data-chat='" + client + "']").append("<br style='line-height:25px' /><span class='chatMsg chatMe'>" + input.val() + "</span>");
        input.val("");
    };
}

function getWindow(name, width, height, title, content, config) {
    if (name in windowsByName) {
        return windowsByName[name];
    }
    if (typeof width === "undefined" || width === null)
        width = 100;
    if (typeof height === "undefined" || height === null)
        height = 100;
    if (typeof title === "undefined" || title === null)
        title = "";
    if (typeof content === "undefined" || content === null)
        content = "";
    if (typeof config === "undefined" || config === null)
        config = new Object();
    return new cbWindow(name, width, height, title, content, config);
}

function saveWindows() {
    var windowData = new Object();
    $.each(windows, function() {
        var window = this;
        if (window.isOpen() && window.isSaveable()) {
            windowData[window.getName()] = window.getElement().parent().position();
        }
    });
    if (CryptoJS.SHA3(JSON.stringify(dataCache["decoded"].windows)) + "" === CryptoJS.SHA3(JSON.stringify(windowData)) + "") {
        return;
    }
    dataCache["decoded"].windows = windowData;
    setPersonalData();
}
