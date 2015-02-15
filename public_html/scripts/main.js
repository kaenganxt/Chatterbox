function mainStart()
{

}
function mainSetup(status)
{
    if (status === "firstStartup") {
        $("<div class='screen' id='setupScreen'><h2>Welcome to the chatterbox network</h2>\
           <h3>Here you can configure your chatterbox experience and set your information.</h3>\
           <div class='screenInfoBox' id='setupInfoBox1'>It may take some time until your registration data<br />\
           has spread through the network. Because of that, it is recomended that you configure<br />\
           your settings like you want it to be. After that, the whole network should have got<br />\
           your data and you can start using chatterbox.<div class='screenButtonSet' data-for='setupInfoBox1'>\
           <input type='button' value='Continue' class='screenButtonContinue' />&nbsp;&nbsp;&nbsp;\
           <input type='button' value='Skip' id='setupButtonSkip' /></div></div>\
           </div>").appendTo("#mainElement");
        $("title").html("Chatterbox configuration");
    } else {
    }
}

function setPersonalData(data) {
    if (typeof data !== "Object") {
        console.warn("Type of data has to be Object!");
        return;
    }
    var enc = CryptoJS.AES.encrypt(JSON.stringify(data), dataCache['userPw']) + "";
    relay.sendObj({"action": "userLoc", "username": dataCache['user'], "cbId": "setPersonalData"});
    relay.registerListener("setPersonalData", function(msg) {
        var info = JSON.parse(msg);
        if (info.cbId === "setPersonalData") {
            if (info.status !== "ok") {
                console.error("Relay does not know who we are?");
                //TODO: Error handling
                return;
            }
            var count = 0;
            var callback = {
                haveOne: function(rtcConn) {
                    count++;
                    rtcConn.sendObj({"action": "updateuser", "user": dataCache['user'], "pwHash": CryptoJS.SHA3(dataCache['userPw']) + "", "data": enc});
                },
                done: function() {
                    if (count === 0) {
                        console.warn("Could not change personal data. No storagers available");
                        alert("Your changed data could not be saved! There are no storage handlers available. Please try again later!");
                        //TODO: Store data temporarily in local store if the user wants to
                        return;
                    }
                    spreadRelay({"action": "updateHash", "user": dataCache['user'], "hash": CryptoJS.SHA3(enc) + ""});
                }
            };
            new StoragerConnect("setPersonalData", info.stores, callback, true);
        }
    });
}

localforage.getItem("lastStatus").then(function (status)
{
    $("<div id='mainElement'><!-- The main chatterbox network elements --></div>").appendTo("body");
    $("#login, #loadingModal, #loadingOverlay").hide();
    if (status === "firstStartup" || status === "configure" || status === "no")
    {
        if (status === "no") {
            status = "firstStartup";
        }
        mainSetup(status);
    }
    else
    {
        mainStart();
    }
    $("#connectingPopup").hide();
});
