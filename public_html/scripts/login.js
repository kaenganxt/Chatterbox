var host = wsHost;
var dataCache = new Array();
var loginWaitingFor = "";
var relayBlacklist = new Array();
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
        if (loginWaitingFor !== "") {
            return;
        }
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
        dataCache['registerPw'] = data.usrPw;
        var afterRelayConn = function () {
            popupWindow("Registering...", "Checking username...");
            relay.registerListener("userInfo", onUserInfo);
            relay.sendObj(register);
            loginWaitingFor = "register";
        };
        if (hasRelayConn)
        {
            afterRelayConn();
        }
        else if (hasWebSocket)
        {
            popupWindow("Registering...", "Connecting to relay...");
            makeRelayConn(afterRelayConn);
        }
        else
        {
            popupWindow("Registering...", "Connecting to websocket...");
            initWS(function() {
                makeRelayConn(afterRelayConn);
            });
        }
        dataCache['register'] = newData;
    });
    $("#loginForm").bind("submit", function (e) {
        e.preventDefault();
        if (loginWaitingFor !== "") {
            return;
        }
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
        var afterRelayConn = function () {
            popupWindow("Login...", "Getting userinfo...");
            relay.registerListener("userInfo", onUserInfo);
            relay.sendObj(login);
            loginWaitingFor = "login";
        };
        if (hasRelayConn)
        {
            afterRelayConn();
        }
        else if (hasWebSocket)
        {
            popupWindow("Login...", "Connecting to relay...");
            makeRelayConn(afterRelayConn);
        }
        else
        {
            popupWindow("Login...", "Connecting to websocket...");
            initWS(function() {
                makeRelayConn(afterRelayConn);
            });
        }
        dataCache['loginPw'] = usrPw;
        dataCache['login'] = login;
    });
}
function onUserInfo(info) {
    var data = JSON.parse(info);
    if (data.action === "getUserInfo")
    {
        if (loginWaitingFor === "login")
        {
            if (data.status === "requestOther")
            {
                relay.clearVars();
                popupWindow("Login...", "Connecting to an other relay...");
                makeRelayConn(function() {
                    window.relay.registerListener("userInfo", onUserInfo);
                    var loginCopy = dataCache['login'];
                    window.relay.sendObj(loginCopy);
                }, relay.getId());
            }
            else if (data.status === "notKnown")
            {
                popupWindow("You are not registered in this network! If you are, and this message is wrong, please contact us!", "", true, false);
                loginWaitingFor = "";
            }
            else
            {
                dataCache['login'].storagers = new Array();
                $.each(data.stores, function () {
                    dataCache['login'].storagers.push(this);
                });
                dataCache['login'].hash = data.hash;
                loginWaitingFor = "storageLogin";
                var stConnect = function() {
                    popupWindow("Login...", "Connecting to storager...");
                    var callback = {
                        connected: function(pc) {
                            popupWindow("Login...", "Getting login information...");
                            loginHasStore();
                        },
                        check: function() {
                            return confirm("There's currently no storage handler with your data available. Do you want to try it again regulary?");
                        },
                        notAvailable: function() {
                            popupWindow("No storage handler with your data available!<br />Please try again later", "", true, false);
                        }
                    };
                    new StoragerConnect("personal", dataCache['login'].storagers, callback).start();
                };
                if (typeof storagers === "undefined") {
                    popupWindow("Login...", "Loading storager script...");
                    loadScript("scripts/storagers.js", stConnect);
                } else if ("personal" in storagers) {
                    popupWindow("Login...", "Getting login information...");
                    loginHasStore();
                } else {
                    stConnect();
                }
            }
        }
        else if (loginWaitingFor === "register")
        {
            if (data.status !== "notKnown")
            {
                popupWindow("This username already exists!", "Please choose another one.", true, false);
                loginWaitingFor = "";
                $("#registerUsername").val("");
            }
            else
            {
                var data = {"action": "getlist", "type": "storager", "count": 10};
                window.send(data);
                popupWindow("Registering...", "Getting storager list...");
            }
        }
    }
}
function loginHandler(data)
{
    var dataO = JSON.parse(data);
    if (dataO.action === "login")
    {
        if (dataO.status === "notKnown")
        {
            storageBlacklistAdd(storagers["personal"].getId());
            storagers["personal"].getPeerConn().close();
            storagers["personal"].start();
        }
        else if (dataO.status === "pwWrong")
        {
            popupWindow("The password is wrong", "", true, false);
        }
        else if (dataCache['login'].hash === CryptoJS.SHA3(dataO.data) + "")
        {
            popupWindow("Login successful!", "Starting chatterbox...");
            cbStartup(dataO.data, dataCache['loginPw']);
        }
        else
        {
            if (confirm("The hash of your data does not match the saved hash. This means the storager has probably modified your data. Do you want to continue and review your data? If you press cancel, we will search a new storage handler."))
            {
                console.log("TODO: Data review (Ln: 250 login.js)");
            }
            else
            {
                console.log("TODO: Get a new storager connection (Ln: 250 login.js)");
            }
        }
    }
}
wsHandlers["login"] = wsHandler;
function wsHandler(msg) {
    if (loginWaitingFor !== "register") {
        return;
    }
    var data = JSON.parse(msg);
    if (data.action === "getlist") {
        $("#connectingPopup").show();
        if (data.status === "error")
        {
            popupWindow("Currently are no storage handlers available.", "Please try again later.", true, false);
        }
        else
        {
            dataCache["registerIds"] = data.ids;
            dataCache["registerCount"] = 0;
            var callback = {
                haveOne: function(id) {
                    registerToStorager(id);
                    dataCache["registerCount"]++;
                },
                done: function() {
                    if (dataCache["registerCount"] === 0) {
                        popupWindow("Error: Could not connect to storager!", "Please try again later.", true, false);
                    } else {
                        popupWindow("Registration complete!", "Starting chatterbox...");
                        localforage.setItem("lastStatus", "firstStartup");
                        cbStartup(dataCache['register'].encoded, dataCache['registerPw']);
                    }
                    loginWaitingFor = "";
                }
            };
            var registerFunc = function() {
                popupWindow("Registering...", "Connecting to storagers...");
                new StoragerConnect("register", data.ids, callback, true).start();
            };
            if (typeof storagers === "undefined") {
                popupWindow("Registering...", "Loading storager script...");
                loadScript("scripts/storagers.js", registerFunc);
            } else {
                registerFunc();
            }
        }
    }
}
function loginHasStore()
{
    var login = new Object();
    login.action = "login";
    login.username = dataCache['login'].username;
    login.pwHash = CryptoJS.SHA3(dataCache['loginPw']) + "";
    var peerconn = storagers["personal"].getPeerConn();
    peerconn.sendObj(login);
    peerconn.registerListener("loginHandler", loginHandler);
}
var registeredToRelay = false;
function registerToRelay(id)
{
    var obj = new Object();
    obj.action = "register";
    obj.user = dataCache['register'].usrName;
    var storagers = new Array();
    storagers.push(id);
    obj.storagers = storagers;
    obj.hash = CryptoJS.SHA3(dataCache['register'].encoded) + "";
    relay.sendObj(obj);
    registeredToRelay = true;
}
function updateRegisterRelay(id)
{
    var obj = new Object();
    obj.action = "addStore";
    obj.user = dataCache['register'].usrName;
    obj.storager = id;
    relay.sendObj(obj);
}
function registerToStorager(id)
{
    var data = dataCache['register'];
    storagerConns[id].sendObj(data);
    if (!registeredToRelay)
    {
        if (hasRelayConn)
        {
            registerToRelay(id);
        }
        else
        {
            makeRelayConn(function () {
                registerToRelay(id);
            });
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
            makeRelayConn(function () {
                updateRegisterRelay(id);
            });
        }
    }
}

var hasRelayConn = false;
var hasWebSocket = false;
var relay;

function makeRelayConn(callback) {
    if (typeof RTCConnection === "undefined") {
        loadScript("scripts/rtcConns.js", function() { makeRelayConn(callback); });
        return;
    }
    relay = new RTCConnection();
    relay.init("relay", -1, function() { hasRelayConn = true; callback(); }, relayConnFail);
}
function relayConnFail() {
    relay = null;
    makeRelayConn(relayReconnected);
    hasRelayConn = false;
    //TODO: React to possible situations
}
function relayReconnected() {
    console.log("Connection rebuilt!");
}
//TODO: Some disconnect mechanism

$(document).ready(function () {
    $("body").on("click", ".closeLoadingPopup", function () {
        $("#connectingPopup").hide();
        loginWaitingFor = "";
    });
});
function closePopupWindow()
{
    return "<input type='button' value='Close' class='closeLoadingPopup' style='float:right;margin-right:5em;'/>";
}
function popupWindow(header, text, closeButton, loadingWheel) {
    if (typeof closeButton === "undefined" || closeButton === null) closeButton = false;
    if (typeof loadingWheel === "undefined" || loadingWheel === null) loadingWheel = true;
    $("#connectingWindow").html("");
    if (loadingWheel) {
        $("#connectingWindow").html('<img src="imgs/load.GIF" alt="Loading..."/>');
    }
    $("#connectingWindow").append("<h3>"+header+"</h3><div>"+text+"</div>");
    if (closeButton) {
        $("#connectingWindow").append(closePopupWindow());
    }
    $("#connectingPopup").show();
}

function cbStartup(data, pw)
{
    try {
        dataCache['decoded'] = CryptoJS.AES.decrypt(data, pw).toString(CryptoJS.enc.Utf8);
    } catch(ex) {
        console.error("Data could not be decoded!");
        popupWindow("Data decoding failed!", "Please try again or contact an administrator.", true, false);
        return;
    }
    loadScript("scripts/main.js");
}
