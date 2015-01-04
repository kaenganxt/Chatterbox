console.log("Using " + localforage.driver());
localforage.config({
    name: "Chatterbox",
    storeName: "chatterbox",
    description: "The chatterbox local data."
});
var whatToShow;
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
    if (isNew === null)
        whatToShow = "login";
    else
        whatToShow = "register";
    nextScript = "login";
    loadScripts();
}