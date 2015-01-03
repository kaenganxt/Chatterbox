var host = wsHost;
var waitingForClient = null;
var waitingStatus = "no";
localforage.config({
                name: "Chatterbox",
                storeName: "chatterbox",
                description: "The chatterbox local data."
            });
var config = {
  'iceServers': [
    {
      url: 'turn:5.231.50.161:3478',
      credential: 'passwort', //I don't care. Anyone can see it anyway....
      username:'chatterboxAccount'
    }
  ]
};
initWS();
function initWS()
{
    if(handlerType === "storage")
    {
        localforage.getItem("storage_id").then(function(id) {
            if(!id)
            {
                initWebRTC(-1);
            }
            else
            {
                initWebRTC(id);
            }
        });
        
    }
    else
    {
        $.ajax({
            url: "http://"+host+":8888/relayBegin",
            success: function(id)
            {
                initWebRTC(id);
            }
        });
    }
}
var ws;
var pcs = new Array(0);
var dcs = new Array(0);
var num_dcs = new Array(0);
var connecting_pc = 0;
var PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
var IceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;

window.onbeforeunload = function() {
  $.each(dcs, function(key, value) {
     for(i = 0; i < num_dcs[key]; i++)
     {
         value[i].close();
     }
  });
};

function initWebRTC(id)
{
    ws = new WebSocket("ws://"+host+":8888/"+handlerType+"Socket?Id="+id);
    ws.onopen = function() {
        console.log("WS Connected!");
    };
    ws.onmessage = function(evt) {
        
        var data = JSON.parse(evt.data);
        if(data.action === null)
        {
            return;
        }
        
        if(data.action === "clientConnClose")
        {
            if(waitingStatus === "client")
            {
                waitingStatus = "no";
                waitingForClient = 0;
            }
            if(typeof dcs[data.id] !== "undefined")
            {
                for(var i = 0; i < num_dcs[data.id]; i++)
                {
                    dcs[data.id][i].close();
                    dcs[data.id][i] = null;
                }
                dcs[data.id] = null;
                num_dcs[data.id] = null;
            }
            if(typeof pcs[data.id] !== "undefined")
            {
                pcs[data.id].close();
                pcs[data.id] = null;
            }
            
        }
        else if(data.action === "newClient" && waitingStatus !== "client")
        {
            waitingForClient = data.clientId;
            waitingStatus = "client";
        }
        else if(data.action === "startConn" && waitingStatus === "client")
        {
            var pc = new PeerConnection(config);
            pcs[waitingForClient] = pc;
            dcs[waitingForClient] = new Array(0);
            num_dcs[waitingForClient] = 0;
            var dcId = waitingForClient;
            pc.onicecandidate = function(e) {
                var object = new Object();
                object.action = "candidate";
                object.candidate = e.candidate;
                send(object);
            };
            pc.ondatachannel = function(event)
            {
                dc = event.channel;
                dcs[waitingForClient][num_dcs[waitingForClient]] = dc;
                var dcSubId = num_dcs[dcId];
                num_dcs[waitingForClient]++;
                console.log("New Data Channel!");
                dc.onmessage = function(event)
                {
                    if(event.data instanceof Blob)
                    {
                        console.log("Received a blob");
                    }
                    else
                    {
                        if(event.data === "hello")
                        {
                            waitingForClient = 0;
                            waitingStatus = "no";
                            console.log("New connection is ready to be used!");
                        }
                        else
                        {
                            var data = JSON.parse(event.data);
                            pcMessage(data,dc);
                        }
                    }
                };
                dc.onopen = function()
                {
                    dc.send('opened');
                    console.log("RTC Connection Channel established!");
                };
                dc.onclose = function()
                {
                    console.log("RTC Connection Channel closed!");
                    dcs[dcId][dcSubId] = null;
                    num_dcs[dcId] = null;
                    pcs[dcId].close();
                    pcs[dcId] = null;
                };
            };
            pc.onconnection = function() {
                console.log("New RTC Connection!"); 
            };
            pc.onclosedconnection = function() {
                console.log("Conn Closed!");
            };
            pc.onerror = function(e) {
                console.log("Peer conn error: ");
                console.error(e);
            };
            pc.setRemoteDescription(new SessionDescription(data.offer), answerStep, answerFail);
        }
        else if (data.action === "candidate" && waitingStatus === "client") {
            pcs[waitingForClient].addIceCandidate(new IceCandidate(data.candidate), iceSuccess, iceFail);
        }
        else
        {
            wsMessage(data);
        }
    };
    ws.onclose = function()
    {
        console.log("Socket closed");
        document.getElementsByTagName("title")[0].innerHTML = "Reconnect...";
        window.location.reload();
    };
}
function iceSuccess() {
    console.log("Successfully added an ice candidate");
}
function iceFail() {
    console.warn("Adding an ice candidate failed!");
}
function answerStep()
{
    pcs[waitingForClient].createAnswer(answerStep2, answerFail);
}
var currAnswer;
function answerStep2(answer)
{
    currAnswer = answer;
    pcs[waitingForClient].setLocalDescription(answer, sendAnswer, answerFail);
}
function sendAnswer()
{
    var answer = new Object();
    answer.action = "answerDesc";
    answer.answer = currAnswer;
    send(answer);
}
function answerFail(code)
{
    console.error("Failed to establish RTC: "+code);
}
function send(msg)
{
    if(ws !== null)
    {
        ws.send(JSON.stringify(msg));
    }
}