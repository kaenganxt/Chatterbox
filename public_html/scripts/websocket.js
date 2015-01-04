var afterConnect;
var ws;
var wsHandlers = new Object();

function initWS(callback)
{
    // openLoading();
    afterConnect = callback;
    $.ajax({
        url: "http://" + host + ":8888/id",
        success: function (id)
        {
            doWS(id);
        },
        error: function ()
        {
            $("#connectingWindow>*").hide();
            $("#connectingWindow").append("<h3 style='color:red;'>Error: Service not available!</h3><div>Try again later!</div>");
        }
    });
}
function doWS(id)
{
    if (ws !== null)
    {
        ws = null;
        hasWebSocket = false;
    }
    ws = new WebSocket("ws://" + host + ":8888/ws?Id=" + id);
    ws.onopen = function () {
        console.log("WS Connected!");
        hasWebSocket = true;
        if (typeof afterConnect === "function")
        {
            afterConnect();
            afterConnect = null;
        }
    };
    ws.onmessage = function (evt) {
        $.each(wsHandlers, function () {
            this(evt.data);
        });
    };
    ws.onclose = function () {
        console.log("Ws closed.");
        hasWebSocket = false;
        setTimeout(initWS, 1000);
    };
}