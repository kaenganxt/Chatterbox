console.log("Using " + localforage.driver());
localforage.config({
    name: "Chatterbox",
    storeName: "chatterbox",
    description: "The chatterbox local data."
});
localforage.getItem("lastseen").then(function (lastseen) {
    if (!lastseen)
    {
        console.log("You are new, i think.");
        newUser();
        return;
    }
    localforage.getItem("lastStatus").then(function (laststatus) {
        if (!laststatus)
        {
            localforage.setItem("lastStatus", "no");
            login("new");
            laststatus = "no";
        }
        else if (laststatus === "no")
        {
            login("new");
        }
        else
        {
            login();
        }
    });
    console.log("Last seen: " + lastseen);
});
function newUser()
{
    localforage.setItem("lastseen", new Date().getTime());
    localforage.setItem("lastStatus", "no");
    login("new");
}
function login(isNew)
{
    var whatToShow = "login";
    if (isNew === "new")
        whatToShow = "register";
    $("#loadingModal>div>h3").html("Loading login...");
    $("#loadingModal>div>div").html("Loading web socket scripts...");
    loadScript("scripts/websocket.js", function() {
        $("#loadingModal>div>div").html("Loading login scripts...");
        loadScript("scripts/login.js", function() {
            $("#loadingModal>div>div").html("Loading form...");
            loadScript("postload/login.html", function(html) {
                $("body").append(html);
                loginFormHandlers(whatToShow);
            }, false);
        });
    });
}