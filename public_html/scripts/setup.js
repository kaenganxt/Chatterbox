/* global localforage, dataCache, CryptoJS, relay, wsId */

function mainStart() {
    loadScript("postload/main.html", function (html) {
        $("main").append(html);
        $("title").html("Chatterbox");
        $("<link/>", {rel: "stylesheet", type: "text/css", href: "style/jq.css"
            }).appendTo("head");
        if ($(document).height() < 600 || $(document).width() < 800) {
            $("<link/>", {rel: "stylesheet", type: "text/css",
                href: "style/mobile.css"}).appendTo("head");
        }
        //Check if user wants that:
        var setLastOnline = function () {
            spreadRelay({"action": "lastOnline", "user": dataCache["user"],
                "timestamp": Math.round(new Date().getTime() / 1000),
                "id": wsId});
        };
        setInterval(setLastOnline, 1000 * 60 * 2);
        setLastOnline();
        if ('ontouchstart' in window || 'onmsgesturechange' in window) {
            loadScript("libs/jq.touch-punch.js", function () {
                loadScript("scripts/system.js");
            });
        } else {
            loadScript("scripts/system.js");
        }
    }, false);
}

function mainSetup(status) {
    $("title").html("Chatterbox configuration");
    if (status === "firstStartup") {
        setupPage = 0;
        $("#setupScreen").show();
    } else {
        localforage.getItem("setupPosition").then(function (pos) {
            if (!pos) {
                mainSetup("firstStartup");
                return;
            }
            $(".screen[data-id=" + pos + "]").show();
        });
    }
}

function setPersonalData() {
    var enc = CryptoJS.AES.encrypt(JSON.stringify(dataCache["decoded"]), dataCache['userPw']) +
            "";
    var hash = CryptoJS.SHA3(enc) + "";
    if (dataCache["hash"] === hash)
        return;
    relay.sendObj({"action": "userLoc", "username": dataCache['user'],
        "cbId": "setPersonalData"});
    relay.registerListener("setPersonalData", function (msg) {
        var info = JSON.parse(msg);
        if (info.action === "getUserInfo" && info.cbId === "setPersonalData") {
            if (info.status !== "ok") {
                console.error("Relay does not know who we are?");
                //TODO: Error handling
                return;
            }
            var count = 0;
            var callback = {
                haveOne: function (rtcConn) {
                    count++;
                    if (typeof dataCache["hashedPw"] === "undefined") {
                        getSalt(rtcConn, dataCache["user"], function (salt) {
                            var pw = generateHash(dataCache["userPw"], salt);
                            rtcConn.sendObj({"action": "updateuser",
                                "user": dataCache['user'], "pwHash": pw,
                                "data": enc});
                            dataCache["hashedPw"] = pw;
                        });
                    } else {
                        rtcConn.sendObj({"action": "updateuser",
                            "user": dataCache['user'],
                            "pwHash": dataCache["hashedPw"], "data": enc});
                    }
                },
                done: function () {
                    if (count === 0) {
                        console.warn("Could not change personal data. No storagers available");
                        alert("Your changed data could not be saved! There are no storage handlers available. Please try again later!");
                        //TODO: Store data temporarily in local store if the user wants to
                        return;
                    }
                    spreadRelay({"action": "updateHash",
                        "user": dataCache['user'], "hash": hash});
                    dataCache["hash"] = hash;
                }
            };
            new StoragerConnect("setPersonalData", info.stores, callback, true).start();
        }
    });
}

var setupPage;
function setupHandlers() {
    $(".screenButtonContinue").click(function () {
        $(".screen[data-id=" + setupPage + "]").hide();
        setupPage++;
        $(".screen[data-id=" + setupPage + "]").show();
        if (setupPage === 1) {
            localforage.setItem("lastStatus", "configure");
        }
        localforage.setItem("setupPosition", setupPage);
    });
    $("#setupButtonSkip, #setupButtonFinish").click(function () {
        localforage.setItem("lastStatus", "setupDone");
        localforage.removeItem("setupPosition");
        dataCache["decoded"].setup = true;
        setPersonalData();
        $(".screen").hide();
        mainStart();
    });
}

$("#login, #loadingModal, #loadingOverlay, #connectingPopup").hide();
if (typeof dataCache["decoded"].setup === "undefined") {
    localforage.getItem("lastStatus").then(function (status) {
        if (status === "firstStartup" || status === "configure" || status ===
                "no") {
            if (status === "no") {
                status = "firstStartup";
            }
            loadScript("postload/setupPages.html", function (html) {
                $("main").append(html);
                setupHandlers();
                mainSetup(status);
            }, false);
        } else {
            dataCache["decoded"].setup = true;
            localforage.setItem("lastStatus", "setupDone");
            localforage.removeItem("setupPosition");
            setPersonalData();
            mainStart();
        }
    });
} else {
    mainStart();
}
