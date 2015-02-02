var ws;
var wsHandlers = new Object();
var wsToken;
var connecting = false;
var wsCallback;
var hasWebSocket = false;
var wsQueue = new Array();

function initWS(callback)
{
    if (typeof canConnect !== "undefined" && canConnect === false) {
        setTimeout(function() { initWS(callback); }, 10);
        return;
    }
    if (connecting) {
        if (typeof callback === "function") {
            wsCallback = function() {wsCallback(); callback();};
        }
        return;
    }
    wsCallback = callback;
    if (ws !== null)
    {
        ws = null;
        hasWebSocket = false;
    }
    connecting = true;
    var token = wsToken;
    var tokenStr = (typeof token === "undefined" || token === null) ? "" : "&token="+token;
    ws = new WebSocket("ws://" + wsHost + ":" + wsPort + "/socket?type="+handler["type"] + tokenStr);
    ws.onopen = function () {
        console.log("WS Connected!");
        hasWebSocket = true;
        connecting = false;
        $.each(wsQueue, function() {
            send(this);
        });
        wsQueue = new Array();
        if (typeof callback === "function")
        {
            wsCallback();
            wsCallback = null;
        }
    };
    ws.onmessage = function (evt) {
        $.each(wsHandlers, function () {
            this(evt.data);
        });
    };
    ws.onclose = function () {
        connecting = false;
        hasWebSocket = false;
        setTimeout(function() {initWS(wsCallback);}, 1000);
    };
}
function send(msg)
{
    if (hasWebSocket === false || ws === null) {
        wsQueue.push(msg);
        return;
    }
    ws.send(JSON.stringify(msg));
}
