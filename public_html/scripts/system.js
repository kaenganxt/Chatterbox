/* global dataCache, getWindow, conns, dataLog, wsId, chats, relay, CryptoJS */
loadScript("scripts/windows.js");
setInterval(refreshFooter, 6000);
$("#footerForkMe").click(function() {
    window.open("https://github.com/kaenganxt/Chatterbox");
});

$("#footerSentDataElement").click(function() {
    getWindow("dataOverview").show();
});

dataCache["resolvedUsers"] = new Object();
$("#chatConnectForm").submit(function(e) {
    e.preventDefault();
    var val = $("#chatField").val();
    if (val === "") return;
    resolveUsername(val).then(function(id) {
        if (id in chats) {
            getWindow("chat" + id).show();
            return;
        } else {
            chatConnect(id, val).catch(function() {
                alert("Could not connect to requested chat partner!");
            });
        }
    }, function() {
        alert("The requested chat partner is currently offline!");
    });
});

function resolveUsername(username) {
    return new Promise(function(resolve, reject) {
        var value = CryptoJS.SHA3(username) + "";
        if (typeof dataCache["resolvedUsers"][value] !== "undefined") {
            var id = dataCache["resolvedUsers"][value];
            resolve(id);
            return;
        }
        relay.sendObj({action: "isOnline", user: value, cbId: "chat"});
        relay.registerListener("chatUserResolve", function (data) {
            data = JSON.parse(data);
            if (data.action === "isOnline" && data.cbId === "chat") {
                if (data.status !== "online") {
                    reject();
                    return;
                }
                var lId = data.lastid;
                dataCache["resolvedUsers"][data.user] = lId;
                resolve(lId);
            }
        });
    });
}

function chatConnect(id, user) {
    return new Promise(function(resolve, reject) {
        var conn;
        if (id === -1) {
            delete dataCache["resolvedUsers"][CryptoJS.SHA3(user) + ""];
            resolveUsername(user).then(function(uId) {
                chatConnect(uId, user).then(resolve, reject);
            }, reject);
            return;
        } else if (id in conns["client"]) {
            conn = conns["client"][id];
            conn.sendObj({"action": "chatinit", "me": wsId, "myName": dataCache["username"]});
        } else {
            conn = new RTCConnection();
            conn.init("client", id, function() {
                conn.sendObj({"action": "chatinit", "me": wsId, "myName": dataCache["username"]});
            }, function() {
                reject();
            });
        }
        conn.registerListener("chatConnect", function(msg) {
            msg = JSON.parse(msg);
            if (msg.action === "chatConnect") {
                new chatWindow(id, conn, user);
                resolve(id);
            }
        });
    });
}

$("#chatterboxWindows").on("submit", ".chatInput>form", function(e) {
    e.preventDefault();
    var input = $(this).children("input");
    if (input.val() === "")
        return;
    var id = $(this).attr("data-id");
    if (id in conns["client"]) {
        chats[id].send(input);
    } else {
        $(".chatWindow[data-chat='" + id + "']").append("<br />Reconnect...");
        chatConnect(-1, chats[id].getUser()).then(function(newId) {
            chats[id].delete();
            chats[newId].send(input);
        }, function() {
            $(".chatWindow[data-chat='" + id + "']").append("<br />Failed!");
        });
    }
});
function registerChatConn(conn, chatPartner) {
    conn.sendObj({"action": "chatConnect"});
    new chatWindow(chatPartner.id, conn, chatPartner.name);
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

