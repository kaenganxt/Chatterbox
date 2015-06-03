/* global dataCache, getWindow, conns, dataLog, wsId, chats */
var ownId;
loadScript("scripts/windows.js", function() {
    refreshFooter();
    if (dataCache["decoded"].windows !== "undefined") {
        $.each(dataCache["decoded"].windows, function(key, value) {
            if (key.substr(0, 4) === "chat")
                return;
            var win = getWindow(key);
            win.show();
            win.setPosition(value.top, value.left);
        });
    }
});
setInterval(refreshFooter, 6000);
$("#footerForkMe").click(function() {
    window.open("https://github.com/kaenganxt/Chatterbox");
});
$("#footerSentDataElement").click(function() {
    getWindow("dataOverview").show();
});

$("#chatOwnId").html(wsId);
$("#chatConnectForm").submit(function(e) {
    e.preventDefault();
    var value = $("#chatField").val();
    if (value === "")
        return;
    for (var i = 0; i < value.length; i++) {
        if ((value.charAt(i) < '0') || (value.charAt(i) > '9')) {
            alert("Please type a number!");
            return;
        }
    }
    if (value in chats) {
        getWindow("chat" + value).show();
        return;
    }
    var conn;
    if (value in conns["client"]) {
        conn = conns["client"][value];
        conn.sendObj({"action": "chatinit", "me": wsId});
    } else {
        conn = new RTCConnection();
        conn.init("client", value, function() {
            conn.sendObj({"action": "chatinit", "me": wsId});
        }, function() {
            alert("Could not connect to requested chat partner!");
        });
    }
    conn.registerListener("chatConnect", function(msg) {
        msg = JSON.parse(msg);
        if (msg.action === "chatConnect") {
            console.log("new chatwindow");
            new chatWindow(value, conn);
        }
    });
});
$("#chatterboxWindows").on("submit", ".chatInput>form", function(e) {
    e.preventDefault();
    var input = $(this).children("input");
    if (input.val() === "")
        return;
    var id = $(this).attr("data-id");
    if (id in conns["client"]) {
        conns["client"][id].sendObj({"action": "chatMessage", "id": wsId, "message": input.val()});
        $(".chatWindow[data-chat='" + id + "']").append("<br /><span class='chatMsg chatMe'>" + input.val() + "</span>");
        input.val("");
    } else {
        alert("Connection not found?");
    }
});
function registerChatConn(conn, chatPartner) {
    conn.sendObj({"action": "chatConnect"});
    new chatWindow(chatPartner, conn);
}

function refreshFooter() {
    var count = 0;
    $.each(conns, function() {
        count += Object.keys(this).length;
    });
    $("#footerConnected").html(count);
    $("#footerSentData").html(parseInt($("#footerSentData").html()) + dataLog.length);
    $.each(dataLog, function() {
        var data = this;
        var arrow = (data.type === "out" ? "Out" : "In");
        $("#dataPacketsList").append("<div class='dataPacket'>" + arrow + "<br />" + data.data + "</div>");
    });
    dataLog = new Array();
}

