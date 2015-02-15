var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
var IceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
var sids = 0;
var conns = new Object();
conns["client"] = new Object();
conns["relay"] = new Object();
conns["storager"] = new Object();
var sidConns = new Object();
function RTCConnection(connectId) {
    var pc;
    var dcs = new Array();
    var dcCount = 0;
    var afterConnect;
    var hasConn = false;
    var listeners = new Object();
    var connAbort;
    var iceState = "none";
    var type;
    var id;
    var connId;
    var beginner;
    var connecting = false;
    var sendQueue = new Array();
    if (typeof connectId === "undefined" || connectId === null) {
        connId = sids;
        sids++;
    } else {
        connId = connectId;
    }
    sidConns[connId] = this;
    var rtc = sidConns[connId];

    this.start = function(lid, ltype) {
        if (lid === null || ltype === null) {
            console.error("RTCConnection.start() called without giving all parameters (id, type)");
            return;
        }
        if (!(ltype === "relay" || ltype === "storager" || ltype === "client")) {
            console.error("RTCConnection.start() called with unknown type");
            return;
        }
        connecting = true;
        beginner = false;
        type = ltype;
        id = lid;
        afterConnect = function() {};
        connAbort = function() {};
        pc = new PeerConnection(stunConfig);
        rtc.pcHandlers();
        rtc.wsHandler();
        conns[type][id] = rtc;
    };
    this.init = function(ltype, lid, callback, failCallback, idBlacklist) {
        if (!hasWebSocket) {
            initWS(function() { rtc.init(ltype, lid, callback, failCallback, idBlacklist); });
            return;
        }
        if (ltype === null || !(ltype === "relay" || ltype === "storager" || ltype === "client")) {
            console.error("RTCConnection.init() called with unknown type");
            return;
        }
        if (lid === null) {
            if (type !== "relay") {
                console.error("Random connections are only possible for relays!");
                return;
            }
            id = -1;
        }
        if (typeof callback !== "function") {
            console.warn("RTCConnection constructed without specifying a callback. This is not recommended as you can't get sure the connection is already complete!");
            callback = function() {};
        }
        connecting = true;
        beginner = true;
        type = ltype;
        id = lid;
        afterConnect = callback;
        if (typeof failCallback !== "function") {
            failCallback = function() {};
        }
        if (typeof idBlacklist !== "object") {
            idBlacklist = [];
        }
        connAbort = failCallback;
        rtc.wsHandler();
        var newSid = {"action": "new", "id": connId};
        window.send(newSid);
        if (id === -1) {
            var obj = {"action": "reserve", "type": "relay", "sid": connId, "not": idBlacklist};
            window.send(obj);
            return;
        } else {
            var obj = {"action": "reserve", "type": type, "id": id, "sid": connId};
            window.send(obj);
            conns[type][id] = rtc;
        }
    };
    this.wsHandler = function() {
        window.wsHandlers["rtc-" + type + "-" + connId] = function(msg) {
            if (!hasConn) {
                var data = JSON.parse(msg);
                if (data.action === "reserve" && data.sid === connId) {
                    if (data.status === "no" || data.status === "error") {
                        connecting = false;
                        connAbort();
                        rtc.clearVars();
                    } else if (data.status === "ok") {
                        if (id === -1) {
                            id = data.id;
                            conns["relay"][data.id] = rtc;
                        }
                        rtc.buildPeerConn();
                    }
                }
                if (typeof rtc.getPc() === "undefined" || rtc.getPc() === null) return;
                if (data.action === "answerDesc" && data.sid === connId) {
                    rtc.getPc().setRemoteDescription(new SessionDescription(data.answer), function() {}, rtc.offerFail);
                } else if (data.action === "candidate" && data.sid === connId) {
                    if (typeof data.candidate === "undefined" || data.candidate === null) {
                        return;
                    }
                    rtc.getPc().addIceCandidate(new IceCandidate(data.candidate), function() {}, function() {});
                } else if (data.sid === connId && data.action === "description") {
                    rtc.getPc().setRemoteDescription(new SessionDescription(data.offer), function() {
                        rtc.getPc().createAnswer(function(answer) {
                           rtc.getPc().setLocalDescription(answer, function() {
                                var answerobj = new Object();
                                answerobj.forwardAction = "answerDesc";
                                answerobj.action = "forward";
                                answerobj.sid = connId;
                                answerobj.answer = answer;
                                window.send(answerobj);
                            }, rtc.offerFail);
                        }, rtc.offerFail);
                    }, rtc.offerFail);
                } else if (data.action === "connClose" && data.sid === connId) {
                    rtc.clearVars();
                    connAbort();
                }
            }
        };
    };
    this.pcHandlers = function() {
        pc.onicecandidate = function(ev) {
            if (rtc.getPc() === null) {
                return;
            }
            var obj = {"action": "forward", "sid": connId, "forwardAction": "candidate", "candidate": ev.candidate};
            window.send(obj);
        };
        pc.onclosedconnection = function() {
            rtc.clearVars();
        };
        pc.ondatachannel = function(dc) {
            dcs[dcCount] = dc.channel;
            rtc.regDCListeners(dc.channel);
            dcCount++;
        };
        pc.oniceconnectionstatechange = function(ev) {
            iceState = ev.target.iceConnectionState;
            if (iceState === "failed" && rtc.getPc() !== null) {
                rtc.clearVars();
                connAbort();
            }
        };
    };
    this.buildPeerConn = function() {
        pc = new PeerConnection(stunConfig);
        rtc.pcHandlers();
        var dc = rtc.getPc().createDataChannel(type + "-" + id);
        dcs[dcCount] = dc;
        dcCount++;
        rtc.regDCListeners(dc);
        pc.createOffer(function(localOffer) {
            rtc.getPc().setLocalDescription(localOffer, function() {
                window.send({"action": "forward", "sid": connId, "forwardAction": "description", "offer": localOffer});
            }, rtc.offerFail);
        }, rtc.offerFail);
    };
    this.offerFail = function() {
        rtc.clearVars();
        connAbort();
    };
    this.getPc = function() {
        return pc;
    };
    this.isBeginner = function() {
        return beginner;
    };
    this.getId = function() {
        return id;
    };
    this.getType = function() {
        return type;
    };
    this.clearVars = function() {
        pc = null;
        dcs = new Array();
        dcCount = 0;
        hasConn = false;
        connecting = false;
    };
    this.close = function() {
        if (!hasConn) return;
        $.each(dcs, function(dc) {
            dc.close();
        });
        pc.close();
        rtc.clearVars();
    };
    this.regDCListeners = function(dc) {
        dc.onclose = function() {
            rtc.clearVars();
            connAbort();
        };
        dc.onmessage = function(ev) {
            if (!(ev.data instanceof Blob)) {
                switch (ev.data) {
                    case "opened":
                        dc.send("hello");
                        window.ws.send("clearStatus");
                        connecting = false;
                    case "hello":
                        hasConn = true;
                        console.log("New rtc connection is ready!");
                        connecting = false;
                        afterConnect();
                        $.each(sendQueue, function() {
                            rtc.send(this);
                        });
                        sendQueue = new Array();
                        return;
                }
            }
            if (window.handler["hasListeners"]) {
                $.each(listeners, function() {
                    this(ev.data);
                });
            } else {
                pcMessage(sidConns[connId], dc, JSON.parse(ev.data));
            }
        };
        dc.onopen = function() {
            if (!rtc.isBeginner()) {
                dc.send("opened");
            }
        };
    };
    this.send = function(msg, dcId) {
        if (!hasConn) {
            if (connecting) {
                sendQueue.push(msg);
            } else {
                console.error("Tried to send message without having connection!");
            }
            return;
        }
        if (typeof dcId === "undefined" || dcId === null) {
            dcId = 0;
        }
        dcs[dcId].send(msg);
    };
    this.sendObj = function(obj, dcId) {
        rtc.send(JSON.stringify(obj), dcId);
    };
    this.registerListener = function(name, listener) {
        if (typeof listener !== "function") {
            console.warn("Tried to register a listener, but was not a function!");
            return;
        }
        listeners[name] = listener;
    };
    this.newDataChannel = function() {

    };
}
//Other stuff
wsHandlers["rtcConns"] = function(msg) {
    var data = JSON.parse(msg);
    if (data.action === "new") {
        if (typeof conns[data.type][data.id] !== "undefined") {
            return;
        }
        var sid = sids;
        new RTCConnection(sid).start(data.id, data.type, sid);
        sids++;
        var send1 = new Object();
        send1.action = "new";
        send1.id = sid;
        window.send(send1);
        var send = new Object();
        send.action = "reserved";
        send.sid = sid;
        window.send(send);
    }
};

function spreadRelayMsg(obj, ids) {
    if (ids.length <= 5) {
        obj.spread = [];
        $.each(ids, function() {
            var id = this;
            if (id in conns["relay"]) {
                conns["relay"][id].sendObj(obj);
            } else {
                var aRelay = new RTCConnection();
                aRelay.init("relay", id, function() {
                    aRelay.sendObj(obj);
                });
            }
        });
        return;
    }
    var connectTo = new Array();
    var spreadData = new Array();
    var eachCount = (ids.length - 5) / 5;
    var count = (eachCount > Math.floor(eachCount)) ? Math.floor(eachCount) + 1 : eachCount;
    if (count < 1) count = 1;
    $.each(ids, function(key1, value) {
        if (connectTo.length < 5) {
            connectTo.push(value);
            spreadData[connectTo.indexOf(value)] = new Array();
            return;
        }
        var found = false;
        $.each(connectTo, function(key) {
            if (found) return;
            if (spreadData[key].length >= count) return;
            spreadData[key].push(value);
            found = true;
        });
        if (!found) {
            spreadData[0].push(value);
        }
    });
    $.each(connectTo, function(key, value) {
        obj.spread = spreadData[key];
        if (value in conns["relay"]) {
            conns["relay"][value].sendObj(obj);
        } else {
            var relay = new RTCConnection();
            relay.init("relay", value, function() {
                relay.sendObj(obj);
            });
        }
    });
}