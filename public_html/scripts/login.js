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
            openLoading();
            makeRelayConn(afterRelayConn);
        }
        else
        {
            openLoading();
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
            openLoading();
            makeRelayConn(afterRelayConn);
        }
        else
        {
            openLoading();
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
                makeRelayConn(function() {
                    window.relay.registerListener("userInfo", onUserInfo);
                    var loginCopy = dataCache['login'];
                    window.relay.sendObj(loginCopy);
                }, relay.getId());
            }
            else if (data.status === "notKnown")
            {
                $("#connectingPopup").fadeOut();
                alert("You are not registered in this network! If you are, and this message is wrong, please contact us!");
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
                    var callback = {
                        connected: function(pc) {
                            loginHasStore();
                        },
                        check: function() {
                            return confirm("There's currently no storage handler with your data available. Do you want to try it again regulary?");
                        },
                        notAvailable: function() {
                            $("#connectingWindow>div").html("No storage handler with your data available!<br />Please try again later"+closePopupWindow());
                        }
                    };
                    new StoragerConnect("personal", dataCache['login'].storagers, callback).start();
                };
                if (typeof storagers === "undefined") {
                    loadScript("scripts/storagers.js", stConnect);
                } else if ("personal" in storagers) {
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
                alert("This username already exists! Please choose another one.");
                loginWaitingFor = "";
                $("#registerUsername").val("");
                $("#connectingPopup").hide();
            }
            else
            {
                var data = {"action": "getlist", "type": "storager", "count": 10};
                window.send(data);
                $("#connectingWindow>h3").html("Performing Registration...");
                $("#connectingWindow>div").html("Getting available storage handlers...");
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
            $("#connectingWindow>*").remove();
            $("#connectingWindow").append("<h3>The password is wrong!</h3>" + closePopupWindow());
        }
        else if (dataCache['login'].hash === CryptoJS.SHA3(dataO.data) + "")
        {
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
            loginWaitingFor = "";
            $("#connectingWindow").html("");
            $("#connectingWindow").append("<h3><span style='color:red'>Error: </span>Currently are no storage handlers available. Please try again later.</h3>" + closePopupWindow());
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

                    } else {
                        localforage.setItem("lastStatus", "firstStartup");
                        cbStartup(dataCache['register'].encoded, dataCache['registerPw']);

                    }
                    loginWaitingFor = "";
                }
            };
            var registerFunc = function() {
                new StoragerConnect("register", data.ids, callback, true).start();
            };
            if (typeof storagers === "undefined") {
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
        dataCache['decoded'] = CryptoJS.AES.decrypt(data, pw).toString(CryptoJS.enc.Utf8);
    } catch(ex) {
        console.error("Data could not be decoded!");
        return;
    }
    loadScript("scripts/main.js");
}
