
var storagerIds = new Array();
var storagerPcs = new Array();
var storagerDcs = new Array();
var personalDataStore;
var currentConnectingId;
var connectingType;
var pcEvents = new Array();
var storagerCache = new Object();

var newStoragerCache = new Object();

function newStoragerMsgHandler(rawData)
{
    var id = newStoragerCache.id;
    var task = newStoragerCache.task;
    var storagers = newStoragerCache.storagers;
    if (waitingStatus === "connStorager")
    {
        $("#loadingNewStoragerInfo").remove();
        var data = JSON.parse(rawData);
        if (data.status === "no")
        {
            if (task === "register")
            {
                nextRegisterClient();
                return;
            }
            $("#connectingWindow>div").append("<span id='loadingNewStoragerInfo'>Whoops! This should not happen.<br /> Okay, searching new storage handler...</span>");
            getWorkingStorager(storagers, function(id) { newStorager(id, task, storagers); }, task);
        }
        else if (data.status === "busy")
        {
            $("#connectingWindow>div").append("<span id='loadingNewStoragerInfo'>This storage handler is busy.<br />Waiting...</span>");
            setTimeout(function () {
                newStorager(id, task, storagers);
            }, 500);
        }
        else if (data.status === "ok")
        {
            waitingStatus = "pendingStoragerConnect";
            currentConnectingId = id;
            console.log("data-status: ok");
            connectingType = task;
            var pCC = new PeerConnection(config);
            pCC.onclosedconnection = function () {
                console.log("onclosed");
                storagerPcs[id] = null;
                storagerDcs[id] = null;
            };
            pCC.onicecandidate = function(e) {
                var object = new Object();
                object.action = "candidate";
                object.candidate = e.candidate;
                send(object);
            };
            storagerPcs[id] = pCC;
            var dCC = pCC.createDataChannel("client-storager");
            dCC.onclose = function () {
                console.log("Data channel closed.");
                storagerPcs[id].close();
                storagerPcs[id] = null;
                storagerDcs[id] = null;
            };
            pcEvents[id] = new Object();
            dCC.onmessage = function (e) {
                $.each(pcEvents[id], function () {
                    this(e.data);
                });
            };
            storagerDcs[id] = dCC;
            pCC.createOffer(stOfferComplete, stPcFail);
        }
    }
    else if (waitingStatus === "pendingStoragerConnect")
    {
        var data = JSON.parse(rawData);
        if (data.action === "answerDesc")
        {
            storagerPcs[currentConnectingId].setRemoteDescription(new SessionDescription(data.answer), registerHasSt, stPcFail);
        }
        else if (data.action === "candidate") {
            storagerPcs[currentConnectingId].addIceCandidate(new IceCandidate(data.candidate), iceSuccess, iceFail);
        }
    }
}
function registerHasSt()
{
    pcEvents[currentConnectingId]["hasConn"] = function (raw) {
        if (raw === "opened")
        {
            storagerIds[currentConnectingId] = currentConnectingId;
            storagerDcs[currentConnectingId].send("hello");
            ws.send("clearStatus");
            console.log("We connected to a storage handler.");
            waitingStatus = "no";
            if (connectingType === "login")
            {
                loginHasStore();
            }
            else if (connectingType === "register")
            {
                registerToStorager(currentConnectingId);
            }
            currentConnectingId = null;
            connectingType = null;
            newStoragerCache = new Object();
        }
    };
}
function newStorager(id, task, storagers)
{
    $("#connectingWindow>div").html("Found an available storage handler.<br />Now trying to connect...");
    if (ws === null)
    {
        initWS(function () {
            newStorager(id, task, storagers);
        });
        return;
    }
    var data = new Object();
    data.action = "connectStorager";
    data.id = id;
    waitingStatus = "connStorager";
    send(data);
    newStoragerCache.id = id;
    newStoragerCache.task = task;
    newStoragerCache.storagers = storagers;
    wsHandlers["storagerMsgHandler"] = newStoragerMsgHandler;
}

function stOfferComplete(localOffer)
{
    storagerPcs[currentConnectingId].setLocalDescription(localOffer, function() { stSendOffer(localOffer); }, stPcFail);
}
function stSendOffer(stOffer)
{
    var offerobj = new Object();
    offerobj.action = "startConn";
    offerobj.offer = stOffer;
    send(offerobj);
}
function stPcFail(code)
{
    console.error("Could not connect to storage handler: " + code);
    waitingStatus = "no";
    $("#connectingWindow>*").hide();
    $("#connectingWindow").append("<h3 style='color:red'>Failed to connect to storage handler</h3><div>Please try again or contact us for support.</div>");
}

var regularTry = false;

function getWorkingStorager(ids, callback, action)
{
    if (storageBlacklist.length === 0)
    {
        setTimeout(function () {
            getWorkingStorager(ids, callback, action);
        }, 10);
        return;
    }
    if (action === "login" || action === "register")
    {
        storagerCache["personal"] = ids;
    }
    checkedCount = 0;
    $.each(ids, function () {
        if (storageBlacklistIs((this | 0)))
        {
            checkedCount++;
            return;
        }
        var checkId = new Object();
        checkId.action = "storagerStatus";
        checkId.id = this;
        send(checkId);
    });
    waitingStatus = "checkStorager";

    var busyAvailable = false;
    wsHandlers["checkStorager"] = function (e) {
        if (waitingStatus === "checkStorager")
        {
            var data = JSON.parse(e);
            if (data.action === "storagerStatus")
            {
                if (data.status === "available")
                {
                    $("#loadingStoragerInfo").remove();
                    regularTry = false;
                    waitingStatus = "no";
                    if (action === "login" || action === "register")
                    {
                        personalDataStore = data.id;
                    }
                    callback(data.id);
                    return;
                }
                else if (data.status === "busy")
                {
                    busyAvailable = true;
                }
                checkedCount++;
                if (checkedCount === ids.length)
                {
                    if (action === "register")
                    {
                        nextRegisterClient();
                        return;
                    }
                    if (busyAvailable)
                    {
                        $("#loadingStoragerInfo").remove();
                        $("#connectingWindow>div").append("<span id='loadingStoragerInfo'><br />All the handlers with/for your data are busy at the moment. <br />Please wait...</span>");
                        setTimeout(function () {
                            getWorkingStorager(ids, callback, action);
                        }, 500);
                        return;
                    }
                    if (regularTry)
                    {
                        setTimeout(function () {
                            getWorkingStorager(ids, callback, action);
                        }, 1500);
                        return;
                    }
                    $("#loadingStoragerInfo").remove();
                    if (confirm("Your storage handlers are not available. Do you want to try it again regulary?"))
                    {
                        $("#connectingWindow>div").html("");
                        $("#connectingWindow>div").append("<span id='loadingStoragerInfo'>No handlers with your data are available at the moment. <br />Please wait...</span>");
                        setTimeout(function () {
                            getWorkingStorager(ids, callback, action);
                        }, 1500);
                        regularTry = true;
                        return;
                    }
                    $("#connectingWindow>*").hide();
                    $("#connectingWindow").append("<span id='loadingStoragerInfo'><h3 style='color:red;'>Error: Storage client not available!</h3><div>Try again later. Maybe get a coffee?</div></span>"+closePopupWindow());
                }
            }
        }
    };
}

function storageBlacklistAdd(id)
{
    storageBlacklist.push(id);
    localforage.setItem("storage_blacklist", JSON.stringify(storageBlacklist));
}
function storageBlacklistIs(id)
{
    return false; //TODO: Remove debugging stuff
    return ($.inArray(id, storageBlacklist) !== -1);
}
var storageBlacklist = new Array();

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