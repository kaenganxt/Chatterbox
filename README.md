Chatterbox
==========

A decentralized network completely running in the browser

The goal is to create a decentralized social network which runs completely in the browser with WebRTC.
To connect the browsers, a WebSocket-Server is needed.

### Setup own network
To set up your own network you need the following:
* A webserver hosting all the files in the public_html folder
* The following libraries in the libs folder: jquery(jq.js, http://jquery.com/), jquery UI(jq.ui.js, http://jqueryui.com/), localForage(localForage.js, https://github.com/mozilla/localForage/)
* In the config.js you can set the following settings:
  - wsHost: Websocket host
  - wsPort: Websocket port
  - stunConfig: A config object for the RTCPeerConnection as specified here: https://developer.mozilla.org/en-US/docs/Web/API/RTCConfiguration
  - lfConfig: A config object for the localforage instance as specified here: http://mozilla.github.io/localForage/#config
* Setup the tornado web(socket)server (https://github.com/tornadoweb/tornado) with the server.py file (it will run on port 8888)
* Change line 18 in the python script to your address of the webpage (with "http://" or "https://", without "/" at the end) [Currently not needed/used!!]
* Have a relay (/relay.html) and a storage handler (/storage.html) open when trying to login/register

### Contributing
You can contribute doing the following stuff:
* Security improvements: Security is a very important part of the project
* User interface: Currently the user interface is not very interesting
* Error handling: The network has to react to several possible situations
* Feel free to ask if you want to do something else

### Relays & storage handlers
When the network is complete, i need people who want to host some relay and storage handlers. 
When we are that far, everyone can help chatterbox to become the social network for your privacy!

Currently you can find an online version of the network here: http://www.chatter-box.net/

### Current state
The following works:
- [X] Login and registration with relay and storage client
- [X] Some error handling
- [X] Username and Password hashing
- [X] Personal data encryption
- [X] Data distribution over the network
- [X] Login error handling

The following is to do:
- [ ] The social network itself
- [ ] A configuration manager
- [ ] A nice user interface
- [ ] Friend system
