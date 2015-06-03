/* global dataCache, CryptoJS */

var windows = new Object();
var windowsByName = new Object();
var windowCount = 0;
var isSmall = ($(document).width() < 850 || $(document).height() < 450);
getWindow("dataOverview", 400, 400, "Transferred data packets", "<div id='dataPacketsList'></div>", {save: true});
getWindow("clientOverview", 400, 400, "Connected clients", "<div id='clientList'></div>", {save: true});
setInterval(saveWindows, 60000);
$("#chatterboxWindows").on("click", ".dataPacket", function() {
    $(this).toggleClass("dataPacketOpen");
}).on("click", ".cbWindowClose", function() {
    windows[$(this).attr('data-window')].hide();
});
var chats = new Object();
function chatWindow(clientId, rtcConn) {
    var client = parseInt(clientId);
    chats[client] = this;
    getWindow("chat" + client, 250, 300, "Chat with client #" + client, "<div class='chatWindow' data-chat='" + client + "'></div><div class='chatInput'>\n\
              <form action='#' data-id='" + client + "'><input type='text' placeholder='Chat message' /></form></div>");
    rtcConn.registerListener("chat" + clientId, function(msg) {
        msg = JSON.parse(msg);
        if (msg.action === "chatMessage" && msg.id === client) {
            $(".chatWindow[data-chat='" + client + "']").append("<br /><span class='chatMsg chatPartner'>" + msg.message + "</span>");
        }
    });
    getWindow("chat" + client).show();
}

function cbWindow(name, width, height, title, content, config) {
    var name = name;
    if (name in window.windowsByName) {
        console.warn("Overriding " + name + " in windowsByName");
    }
    window.windowsByName[name] = this;
    windowCount++;
    var id = windowCount;
    windows[id] = this;
    var width = width;
    var height = height;
    var title = title;
    var save = (typeof config.save === "undefined" ? false : config.save);
    var allowFullscreen = (typeof config.fullscreen === "undefined" ? true : config.fullscreen);
    var allowResize = (typeof config.resize === "undefined" ? true : config.resize);
    var fullscreen = false;
    var zindex = Object.keys(windows).length + 4;
    var obj = this;
    $("#chatterboxWindows").append("\
<div class='cbWindow' data-id='" + id + "' data-zindex='" + zindex + "' style='z-index:" + zindex + ";width:" + width + "px;height:" + height + "px;display:none;'>\n\
    <div class='cbWindowHeader'>\n\
        " + title + "\n\
        <span class='cbWindowHeaderIcons'>\n\
            <img src='imgs/close.png' alt='Close' class='cbWindowClose' data-window='" + id + "' />\n\
        </span>\n\
    </div>\n\
    <div class='cbWindowBody' style='height:" + (height - 50) + "px;'>\n\
        " + content + "\n\
    </div>\n\
</div>");
    var object = $(".cbWindow[data-id='" + id + "']");
    if (isSmall) {
        object.css("top", 0).css("left", 0);
    }
    object.draggable({containment: "#chatterboxMain", scroll: false, handle: ".cbWindowHeader", cancel: ".cbWindowHeaderIcons", snap: ".cbWindow, #chatterboxMain"});
    if (allowResize) {
        object.resizable({containment: "#chatterboxMain", minHeight: 100, minWidth: 250, resize: function(event, ui) {
                ui.element.children(".cbWindowBody").css("height", ui.size.height - 50);
            }});
    }
    //Begin methods
    this.getElement = function() {
        return object.children(".cbWindowBody");
    };
    this.setFullscreen = function() {

    };
    this.show = function() {
        object.show();
    };
    this.hide = function() {
        object.hide();
    };
    this.isOpen = function() {
        return object.css("display") !== "none";
    };
    this.getName = function() {
        return name;
    };
    this.setPosition = function(top, left) {
        object.css("top", top).css("left", left);
    };
    this.isSaveable = function() {
        return save;
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
