/* global ws, localforage, popupWindow */

var storagerConnects = 0;
var storagers = new Object();
var storageBlacklist = new Array();
var storagerConns = new Object();

function StoragerConnect(name, ids, callback, makeAllArg) {
    var name = name;
    var ids = ids;
    var callback = callback;
    var state = "none";
    var id = storagerConnects;
    var workingId;
    var checked = 0;
    var peerConn;
    var makeAll = (makeAllArg === null ? false : makeAllArg);
    storagerConnects++;
    storagers[name] = this;
    var thiss = storagers[name];
    this.getPeerConn = function() {
        return peerConn;
    };
    this.getState = function() {
        return state;
    };
    this.getId = function() {
        return workingId;
    };
    this.restart = function() {
        state = "none";
        workingId = undefined;
        peerConn = undefined;
        this.start();
    };
    this.start = function() {
        if (window.storageBlacklist.length === 0) {
            setTimeout(thiss.start, 10);
            return;
        }
        if (state === "done") return;
        checked = 0;
        $.each(ids, function() {
            if (state === "done") {
                return;
            }
            if (state !== "checkingRegular") {
                state = "checking";
                thiss.wsHandler();
            }
            if (window.storageBlacklistIs((this | 0)))
            {
                checked++;
                if (checked === ids.length) {
                    thiss.after();
                }
                return;
            }
            if (this in storagerConns) {
                if (makeAll) {
                    callback.haveOne(storagerConns[this]);
                    checked++;
                    if (checked === ids.length) {
                        callback.done();
                    }
                    return;
                } else {
                    workingId = this;
                    callback.connected(storagerConns[this]);
                    state = "done";
                    peerConn = storagerConns[this];
                    return;
                }
            }
            var checkId = new Object();
            checkId.action = "status";
            checkId.type = "storager";
            checkId.classId = id;
            checkId.id = this;
            window.send(checkId);
        });
    };
    this.connect = function(id) {
        if (ws === null) {
            initWS(function() { thiss.connect(id); });
            return;
        }
        peerConn = new RTCConnection();
        storagerConns[id] = peerConn;
        peerConn.init("storager", id, function() {
            checked++;
            if (makeAll) {
                callback.haveOne(id);
                if (checked === ids.length) {
                    callback.done();
                    state = "done";
                }
                return;
            }
            callback.connected(peerConn);
            state = "done";
        }, function() { thiss.error(id); });
    };
    this.error = function(storeId) {
        delete storagerConns[storeId];
        checked++;
        if (!makeAll) {
            thiss.start();
        }
    };
    this.wsHandler = function() {
        window.wsHandlers["storager-" + id] = function(msg) {
            if (state === "checking" || state === "checkingRegular") {
                var data = JSON.parse(msg);
                if (data.action === "status" && data.type === "storager" && data.classId === id) {
                    if (data.status === "available") {
                        if (!makeAll) {
                            state = "connecting";
                            workingId = data.id;
                        }
                        thiss.connect(data.id);
                        return;
                    }
                    checked++;
                    if (checked === ids.length) {
                        thiss.after();
                    }
                }
            }
        };
    };

    this.after = function() {
        if (makeAll) {
            callback.done();
            state = "done";
            return;
        }
        if (state === "checkingRegular") {
            thiss.retryLater();
            return;
        }
        if (typeof callback.check !== "function" || callback.check()) {
            state = "checkingRegular";
            thiss.retryLater();
            return;
        }
        callback.notAvailable();
    };

    this.retryLater = function() {
        if (name === "personal" && typeof popupWindow === "function") {
            popupWindow("Waiting", "Waiting for the next try to connect...");
        }
        setTimeout(function() {
            if (name === "personal" && typeof popupWindow === "function") {
                popupWindow("Retrying...", "Retrying storager connection...");
            }
            thiss.start();
        }, 1500);
    };
}

function storageBlacklistAdd(id)
{
    storageBlacklist.push(id);
    localforage.setItem("storage_blacklist", JSON.stringify(storageBlacklist));
}
function storageBlacklistIs(id)
{
    return ($.inArray(id, storageBlacklist) !== -1);
}
function storageBlSetup()
{
    localforage.getItem("storage_blacklist").then(function (data) {

        if (data)
        {
            storageBlacklist = JSON.parse(data);
            storageBlacklist[0] = -1;
        }
        else
        {
            storageBlacklist[0] = -1;
            localforage.setItem("storage_blacklist", JSON.stringify(storageBlacklist));
        }
    });
}
storageBlSetup();
