var ws;
var wsHandlers = new Object();
var wsToken;
var connecting = false;
var wsCallback;

function initWS(callback)
{
    if (typeof canConnect !== "undefined" && canConnect === false) {
        setTimeout(function() { initWS(callback); }, 10);
        return;
    }
    if (connecting) {
        wsCallback = function() {wsCallback(); callback();};
        return;
    }
    wsCallback = callback;
    if (ws !== null)
    {
        ws = null;
        hasWebSocket = false;
    }
    var connecting = true;
    var token = wsToken;
    var tokenStr = token === null ? "" : "&token="+token;
    ws = new WebSocket("ws://" + wsHost + ":" + wsPort + "/socket?type="+handler["type"] + tokenStr);
    ws.onopen = function () {
        console.log("WS Connected!");
        hasWebSocket = true;
        connecting = false;
        if (typeof callback === "function")
        {
            wsCallback();
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
        setTimeout(initWS, 1000);
    };
}
function send(msg)
{
    if (ws !== null)
    {
        ws.send(JSON.stringify(msg));
    }
}
