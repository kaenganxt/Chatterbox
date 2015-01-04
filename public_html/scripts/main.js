function mainStart()
{

}
function mainSetup()
{
    $("<div class='screen' id='setupScreen'><h2>Welcome to the chatterbox network</h2>\
       <h3>Here you can configure your chatterbox experience and set your information.</h3>\
       <div class='screenInfoBox' id='setupInfoBox1'>It may take some time until your registration data<br />\
       has spread through the network. Because of that, it is recomended that you configure<br />\
       your settings like you want it to be. After that, the whole network should have got<br />\
       your data and you can start using chatterbox.<div class='screenButtonSet' data-for='setupInfoBox1'>\
       <input type='button' value='Continue' class='screenButtonContinue' />&nbsp;&nbsp;&nbsp;\
       <input type='button' value='Skip' id='setupButtonSkip' /></div></div>\
       </div>").appendTo("#mainElement");


}
localforage.getItem("lastStatus").then(function (status)
{
    $("<div id='mainElement'><!-- The main chatterbox network elements --></div>").appendTo("body");
    $("#login, #loadingModal, #loadingOverlay").hide();
    if (status === "no")
    {
        mainSetup();
    }
    else
    {
        mainStart();
    }
});