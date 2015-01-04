
var storagerIds = new Array();
var storagerPcs = new Array();
var storagerDcs = new Array();
var personalDataStore;
var currentConnectingId;
var currentConnectingType;
var currentConnectingData;
var pcEvents = new Array();
var storagerCache = new Object();

var offerCache;

var newStoragerCache = new Object();

function newStoragerMsgHandler(rawData)
{
    var id = newStoragerCache.id;
    task = newStoragerCache.task;
    storagers = newStoragerCache.storagers;
    console.log("newStorager...");
    console.log(waitingStatus);
    console.log(rawData);
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
            getWorkingStorager(storagers, newStorager, task, storagers);
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
            if (task === "login")
            {
                currentConnectingType = "personalData";
                currentConnectingData = "login";
            }
            else if (task === "register")
            {
                currentConnectingType = "personalData";
                currentConnectingData = "register";
            }
            else
            {
                currentConnectingType = "unknown";
                currentConnectingData = "unknown";
            }
            pCC = new PeerConnection(config);
            pCC.onclosedconnection = function () {
                console.log("onclosed");
                storagerPcs[id] = null;
                storagerDcs[id] = null;
            };
            storagerPcs[id] = pCC;
            dCC = pCC.createDataChannel("client");
            dCC.onclose = function () {
                console.log("onclose");
                console.log("Data channel closed.");
                storagerPcs[id].close();
                storagerPcs[id] = null;
                storagerDcs[id] = null;
            };
            pcEvents[id] = new Object();
            dCC.onmessage = function (e) {
                console.log("onmessage");
                $.each(pcEvents[id], function () {
                    this(e.data);
                });
            };
            console.log("döa");
            storagerDcs[id] = dCC;
            console.log("äad");
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
    }
}
function registerHasSt()
{
    pcEvents[currentConnectingId]["hasConn"] = function (raw) {
        if (raw === "opened")
        {
            storagerIds[currentConnectingId] = currentConnectingId;
            console.log(currentConnectingId);
            storagerDcs[currentConnectingId].send("hello");
            ws.send("clearStatus");
            console.log("We connected to a storage handler.");
            waitingStatus = "no";
            currentConnectingId = null;
            if (currentConnectingData === "login")
            {
                loginHasStore();
            }
            else if (currentConnectingData === "register")
            {
                registerToStorager(currentConnectingId);
            }
            currentConnectingType = null;
            currentConnectingData = null;
            offerCache = null;
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
            newStorager(id, task);
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
    offerCache = localOffer;
    storagerPcs[currentConnectingId].setLocalDescription(localOffer, stSendOffer, stPcFail);
}
function stSendOffer()
{
    var offer = new Object();
    offer.action = "startConn";
    offer.offer = offerCache;
    send(offer);
}
function stPcFail(code)
{
    console.error("Could not connect to storage handler: " + code);
    waitingStatus = "no";
    $("#connectingWindow>*").hide();
    $("#connectingWindow").append("<h3 style='color:red'>Failed to connect to storage handler</h3><div>Please try again or contact us for support.</div>");
}


var regularTry = false;

function getWorkingStorager(ids, callback, cbparam1, cbparam2)
{
    if (storageBlacklist.length === 0)
    {
        setTimeout(function () {
            getWorkingStorager(ids, callback, cbparam1, cbparam2);
        }, 10);
        return;
    }
    storagerTask = cbparam1;
    if (storagerTask === "login" || storagerTask === "register")
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

    busyAvailable = false;
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
                    if (storagerTask === "login" || storagerTask === "register")
                    {
                        personalDataStore = data.id;
                    }
                    if (cbparam1 === null)
                    {
                        callback(data.id);
                    }
                    else if (cbparam2 === null)
                    {
                        callback(data.id, cbparam1);
                    }
                    else
                    {
                        callback(data.id, cbparam1, cbparam2);
                    }
                    return;
                }
                else if (data.status === "busy")
                {
                    busyAvailable = true;
                }
                checkedCount++;
                if (checkedCount === ids.length)
                {
                    if (storagerTask === "register")
                    {
                        nextRegisterClient();
                        return;
                    }
                    if (busyAvailable)
                    {
                        $("#loadingStoragerInfo").remove();
                        $("#connectingWindow>div").append("<span id='loadingStoragerInfo'><br />All the handlers with/for your data are busy at the moment. <br />Please wait...</span>");
                        setTimeout(function () {
                            getWorkingStorager(ids, callback, cbparam1, cbparam2);
                        }, 500);
                        return;
                    }
                    if (regularTry)
                    {
                        setTimeout(function () {
                            getWorkingStorager(ids, callback, cbparam1, cbparam2);
                        }, 1500);
                        return;
                    }
                    $("#loadingStoragerInfo").remove();
                    if (confirm("Your storage handlers are not available. Do you want to try it again regulary?"))
                    {
                        $("#connectingWindow>div").html("");
                        $("#connectingWindow>div").append("<span id='loadingStoragerInfo'>No handlers with your data are available at the moment. <br />Please wait...</span>");
                        setTimeout(function () {
                            getWorkingStorager(ids, callback, cbparam1, cbparam2);
                        }, 1500);
                        regularTry = true;
                        return;
                    }
                    $("#connectingWindow>*").hide();
                    $("#connectingWindow").append("<span id='loadingStoragerInfo'><h3 style='color:red;'>Error: Storage client not available!</h3><div>Try again later. Maybe get a coffee?</div></span>");
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
    return false; //Debugging...
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