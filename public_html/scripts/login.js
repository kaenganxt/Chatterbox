var host = wsHost;
var config = {
    'iceServers': [
        {
            url: 'turn:5.231.50.161:3478',
            credential: 'passwort',
            username: 'chatterboxAccount'
        }
    ]
};
var storagerTask = "none";
var registerIdsCache;
var cachedPw;
function loginFormHandlers(showWhat)
{
    $("#loadingModal").hide();
    $(".md-overlay").hide();
    $("#registerUsername, #registerEmail, #registerPassword, #registerPassword2").focus(function () {
        $("#loginForm").hide();
        $("#registerForm fieldset:last-of-type").fadeIn();
    });
    $("#backToLogin").click(function () {
        $("#registerForm fieldset:last-of-type").hide();
        $("#loginForm").fadeIn();
    });
    if (showWhat === "register") {
        $("#loginForm").hide();
        $("#registerForm fieldset:last-of-type").show();
    }
    $("#registerForm").bind("submit", function (e) {
        e.preventDefault();
        var data = new Object();
        data.usrName = $("#registerUsername").val();
        data.usrEmail = $("#registerEmail").val();
        data.usrPw = $("#registerPassword").val();
        data.usrPw2 = $("#registerPassword2").val();
        data.usrFName = $("#registerFirstName").val();
        data.usrLName = $("#registerLastName").val();
        data.usrGender = $("#registerGender").val();
        data.usrBDay = $("#registerBirthday").val();
        if (data.usrName === "" || data.usrEmail === "" || data.usrPw === "" || data.usrPw2 === "")
        {
            alert("Fill out all the form fields!");
            return;
        }
        if (data.usrPw !== data.usrPw2)
        {
            alert("The passwords don't match!");
            return;
        }
        var newData = new Object();
        newData.usrName = CryptoJS.SHA3(data.usrName) + "";
        newData.pw = CryptoJS.SHA3(data.usrPw) + "";
        newData.encoded = "" + CryptoJS.AES.encrypt(JSON.stringify(data), data.usrPw);
        newData.action = "register";
        var register = new Object();
        register.action = "userLoc";
        register.username = CryptoJS.SHA3(data.usrName) + "";
        storagerTask = "register";
        openLoading();
        cachedPw = data.usrPw;
        if (hasRelayConn)
        {
            waitingStatus = "userInfoRegister";
            dc.send(JSON.stringify(register));
            waitingData = newData;
        }
        else if (hasWebSocket)
        {
            relayReconnect();
            afterRelayConnect = function () {
                dc.send(JSON.stringify(register));
                waitingStatus = "userInfoRegister";
            };
            waitingData = newData;
        }
        else
        {
            initWS(initWebRTC);
            afterRelayConnect = function () {
                dc.send(JSON.stringify(register));
                waitingStatus = "userInfoRegister";
            };
            waitingData = newData;
        }
    });
    $("#loginForm").bind("submit", function (e) {
        e.preventDefault();
        var usrName = $("#loginUsername").val();
        var usrPw = $("#loginPassword").val();
        if (usrName === "" || usrPw === "")
        {
            alert("You need a username and a password to log in!");
            return;
        }
        var login = new Object();
        login.action = "userLoc";
        login.username = CryptoJS.SHA3(usrName) + "";
        storagerTask = "login";
        openLoading();
        if (hasRelayConn)
        {
            waitingStatus = "userInfoLogin";
            dc.send(JSON.stringify(login));
            login.pw = usrPw;
            waitingData = login;
        }
        else if (hasWebSocket)
        {
            relayReconnect();
            var loginCopy = login;
            afterRelayConnect = function () {
                dc.send(JSON.stringify(loginCopy));
                waitingStatus = "userInfoLogin";
            };
            login.pw = usrPw;
            waitingData = login;
        }
        else
        {
            openLoading();
            initWS(initWebRTC);
            var loginCopy = login;
            afterRelayConnect = function () {
                dc.send(JSON.stringify(loginCopy));
                waitingStatus = "userInfoLogin";
            };
            login.pw = usrPw;
            waitingData = login;
        }
    });
}
function loginHandler(data)
{
    var dataO = JSON.parse(data);
    if (dataO.action === "login")
    {
        if (dataO.status === "notKnown")
        {
            storageBlacklistAdd(personalDataStore);
            storagerDcs[personalDataStore].close();
            storagerPcs[personalDataStore].close();
            personalDataStore = undefined;
            getWorkingStorager(storagerCache["personal"], function(id) { newStorager(id, "login", storagerCache['personal']); }, "login");
        }
        else if (dataO.status === "pwWrong")
        {
            $("#connectingWindow>*").remove();
            $("#connectingWindow").append("<h3>Das Passwort stimmt nicht überein!</h3>" + closePopupWindow());
        }
        else if (dataHash === CryptoJS.SHA3(dataO.data) + "")
        {
            cbStartup(dataO.data, waitingData.pw);
        }
        else
        {
            if (confirm("The hash of your data does not match the saved hash. This means, the storager has probably modified your data. Do you want to continue and review your data? If you press cancel, we will search a new storage handler..."))
            {
                console.log("TODO: Data review (Ln: 160 login.js)");
            }
            else
            {
                console.log("TODO: Get a new storager connection (Ln: 164 login.js)");
            }
        }
    }
}
function resendRegisterInfo()
{
    var register = new Object();
    register.action = "userLoc";
    register.username = waitingData.usrName;
    dc.send(JSON.stringify(register));
    waitingStatus = "userInfoRegister";
}
function loginHasStore()
{
    var dataCache = waitingData;
    var login = new Object();
    login.action = "login";
    login.username = dataCache.username;
    login.pwHash = CryptoJS.SHA3(dataCache.pw) + "";
    storagerDcs[personalDataStore].send(JSON.stringify(login));
    pcEvents[personalDataStore]["loginHandler"] = loginHandler;
}
var registeredToRelay = false;
function registerToRelay(id)
{
    var obj = new Object();
    obj.action = "register";
    obj.user = waitingData.usrName;
    var storagers = new Array();
    storagers.push(id);
    obj.storagers = storagers;
    obj.hash = CryptoJS.SHA3(waitingData.encoded) + "";
    dc.send(JSON.stringify(obj));
    registeredToRelay = true;
}
function updateRegisterRelay(id)
{
    var obj = new Object();
    obj.action = "addStore";
    obj.user = waitingData.usrName;
    obj.storager = id;
    dc.send(JSON.stringify(obj));
}
function registerToStorager(id)
{
    var data = waitingData;
    storagerDcs[id].send(JSON.stringify(data));
    if (!registeredToRelay)
    {
        if (hasRelayConn)
        {
            registerToRelay(id);
        }
        else
        {
            afterRelayConnect = function () {
                registerToRelay(id);
            };
            pc = null;
            relayReconnect();
        }
    }
    else
    {
        if (hasRelayConn)
        {
            updateRegisterRelay(id);
        }
        else
        {
            afterRelayConnect = function () {
                updateRegisterRelay(id);
            };
            pc = null;
            relayReconnect();
        }
    }
    nextRegisterClient();
}
function nextRegisterClient()
{
    if (registerIdsCache.length === 0)
    {
        localforage.setItem("lastStatus", "firstStartup");
        cbStartup(waitingData.encoded, cachedPw);
        return;
    }
    var id = registerIdsCache.pop();
    console.log("Registering to:" + id);
    if (typeof storagerIds !== "undefined" && storagerIds !== null && $.inArray(id, storagerIds) !== -1)
    {
        registerToStorager(id);
    }
    if (typeof storagerPcs === "undefined" || storagerPcs === null)
    {
        var ida = new Array(-1, id);
        loadScript("scripts/storagers.js", function() {
            getWorkingStorager(ida, function(idd) { newStorager(idd, "register", ida); }, "register");
        });
    }
    else
    {
        var ida = new Array(-1, id);
        getWorkingStorager(ida, function(idd) { newStorager(idd, "register", ida); }, "register");
    }
}



//Relay section
var pc = null;
var dc = null;
var offer = null;
var waitingStatus = "no";
var waitingData = new Object();
var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
var IceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
var afterRelayConnect = null;
var hasRelayConn = false;
var hasWebSocket = false;
var currentRelayId = null;
var forceOtherRelay = false;
var storagers = new Array();
var dataHash = null;

function relayReconnect()
{
    if (pc === null)
    {
        dc = null;
        pc = null;
        if (ws === null || ws.readyState === 3)
        {
            ws = null;
            setTimeout(initWebRTC, 500);
        }
        else
        {
            initWebRTC();
        }
    }
    else
    {
        console.log("WTF!?");
    }
}

function relayWSHandler(json)
{
    if (json === "relayConnClose")
    {
        pc = null;
        relayReconnect();
        return;
    }
    if (waitingStatus === "search")
    {
        var data = JSON.parse(json);
        if (data.action === "no")
        {
            $("#connectingWindow>*").hide();
            $("#connectingWindow").append("<h3 style='color:red;'>Error: No services available!</h3><div>Try again later!</div>" + closePopupWindow());
        }
        else if (data.action === "busy")
        {
            $("#connectingWindow>div").html("Please wait, the system is busy at the moment...");
            var data = new Object();
            data.other = forceOtherRelay;
            data.action = "search";
            if (data.other)
                data.not = currentRelayId;
            setTimeout(function () {
                send(data);
            }, 500);
            console.log("busy...");
        }
        else if (data.action === "connect")
        {
            currentRelayId = data.relay;
            waitingStatus = "relayRTCConnect";
            forceOtherRelay = false;
            doWebRTCConnect();
        }
    }
    else if (waitingStatus === "relayRTCConnect")
    {
        var data = JSON.parse(json);
        if (data.action === "answerDesc")
        {
            pc.setRemoteDescription(new SessionDescription(data.answer), finished, offerFail);
        }
        else if (data.action === "candidate") {
            pc.addIceCandidate(new IceCandidate(data.candidate), iceSuccess, iceFail);
        }
    }
    else
    {
        var data = JSON.parse(json);
        if (data.action === "registerClientIds")
        {
            if (data.status === "error")
            {
                waitingStatus = "no";
                $("#connectingWindow").html("");
                $("#connectingWindow").append("<h3><span style='color:red'>Error: </span>Currently are no storage handlers available. Please try again later.</h3>" + closePopupWindow());
            }
            else
            {
                registerIdsCache = data.ids;
                console.log("Found to the following storage handlers: ");
                console.log(registerIdsCache);
                if (hasRelayConn)
                {
                    nextRegisterClient();
                }
                else
                {
                    pc = null;
                    afterRelayConnect = resendRegisterInfo;
                    relayReconnect();
                }

            }
        }
    }
}
function initWebRTC()
{
    var data = new Object();
    data.action = "search";
    data.other = forceOtherRelay;
    if (data.other)
        data.not = currentRelayId;
    waitingStatus = "search";
    send(data);
    wsHandlers["relayWSHandler"] = relayWSHandler;
}
function iceSuccess() {
    console.log("Successfully added an ice candidate");
}
function iceFail() {
    console.warn("Adding an ice candidate failed!");
}
function finished() {
    console.log("Connection creation finished!");
}
function doWebRTCConnect()
{
    pc = new PeerConnection(config);
    pc.onicecandidate = function (e) {
        var object = new Object();
        object.action = "candidate";
        object.candidate = e.candidate;
        ws.send(JSON.stringify(object));
    };
    pc.onconnection = function () {
        console.log("Connected!");
    };
    pc.onclosedconnection = function () {
        console.log("Conn Closed!");
        pc = null;
        hasRelayConn = false;
    };
    dc = pc.createDataChannel("client-relay");
    dc.onclose = function ()
    {
        console.warn("Relay connection closed. Trying to reconnect...");
        pc = null;
        hasRelayConn = false;
        relayReconnect();
    };
    dc.onmessage = function (evt)
    {
        if (evt.data instanceof Blob)
        {
            console.log("Received a blob!");
        }
        else if (evt.data === "opened")
        {
            dc.send("hello");
            ws.send("clearStatus");
            console.log("Connection is ready to be used! We will now gather some data from the relay!");
            hasRelayConn = true;
            waitingStatus = "no";
            if (typeof afterRelayConnect === "function")
            {
                afterRelayConnect();
            }
        }
        else
        {
            var data = JSON.parse(evt.data);
            if (data.action === "getUserInfo")
            {
                if (waitingStatus === "userInfoLogin")
                {
                    if (data.status === "requestOther")
                    {
                        forceOtherRelay = true;
                        pc = null;
                        relayReconnect();
                    }
                    else if (data.status === "notKnown")
                    {
                        $("#connectingPopup").fadeOut();
                        alert("You are not registered in this network! If you are, and this message is wrong, please contact us!");
                    }
                    else
                    {
                        $.each(data.stores, function () {
                            storagers.push(this);
                        });
                        dataHash = data.hash;
                        if (typeof personalDataStore === "undefined" || personalDataStore === null)
                        {
                            if (typeof storagerPcs === "undefined")
                            {
                                waitingStatus = "connectStorageForLogin";
                                $("#connectingWindow>div").html("Found your data!<br />Will now connect...");
                                loadScript("scripts/storagers.js", function() {
                                    getWorkingStorager(storagers, function(id) { newStorager(id, "login", storagers); }, "login");
                                });
                            }
                            else
                            {
                                getWorkingStorager(storagers, function(id) { newStorager(id, "login", storagers); }, "login");
                            }
                        }
                        else
                        {
                            loginHasStore();
                        }
                    }
                }
                else if (waitingStatus === "userInfoRegister")
                {
                    if (data.status !== "notKnown")
                    {
                        alert("This username already exists! Please choose another one.");
                        waitingStatus = "no";
                        $("#registerUsername").val("");
                        $("#connectingPopup").hide();
                    }
                    else
                    {
                        var data = new Object();
                        data.action = "reserveRegisterClients";
                        $("#connectingWindow>h3").html("Performing Registration...");
                        $("#connectingWindow>div").html("Getting available storage handlers...");
                        send(data);
                    }
                }
            }

        }
    };
    pc.createOffer(offerStep, offerFail);
}
function offerStep(locOffer)
{
    offer = locOffer;
    pc.setLocalDescription(offer, offerStep2, offerFail);
}
function offerStep2()
{
    var init = new Object();
    init.action = "startConn";
    init.offer = offer;
    send(init);
}
function offerFail(code)
{
    console.error("Failed to establish RTC: " + code);
}
function send(msg)
{
    if (ws !== null)
    {
        ws.send(JSON.stringify(msg));
    }
}
function disconnect()
{
    if (dc !== null)
    {
        dc.send("bye");
        dc = null;
    }
    if (pc !== null)
    {
        pc.close();
        pc = null;
    }
}

$(document).ready(function () {
    $("body").on("click", ".closeLoadingPopup", function () {
        $("#connectingPopup").hide();
    });
});
function openLoading()
{
    $("#connectingWindow").html('<img src="imgs/load.GIF" alt="Loading..."/><h3>Getting connection...</h3><div>This may take a short while...</div>').parent().show();
}
function closePopupWindow()
{
    return "<input type='button' value='Close' class='closeLoadingPopup' style='float:right;margin-right:5em;'/>";
}

function cbStartup(data, pw)
{
    $("#connectingWindow>*").html("");
    $("#connectingWindow").append("<h2>Startup...</h2><div>Login successfull! Now starting chatterbox...</div>");
    try {
        decodedData = CryptoJS.AES.decrypt(data, pw).toString(CryptoJS.enc.Utf8); //Entschlüsseln
    } catch(ex) {
        console.warn("Data could not be decoded!");
        return;
    }
    loadScript("scripts/main.js");
}
var decodedData;