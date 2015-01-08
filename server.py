import tornado.ioloop
import tornado.web
import tornado.websocket
import json

from tornado.options import define, options, parse_command_line

define("port", default=8888, help="run on the given port", type=int)

# we gonna store clients in dictionary..
clients = dict()
id = 0
storagers = dict()
relays = dict()
rlId = 0
storagerCount = 0
allowedHost = "http://localhost:8383"
storagerByStr = dict()
      
    
def is_json(myjson):
  try:
    json_object = json.loads(myjson)
  except ValueError:
    return False
  return True  
  
def checkToken(token):
    if not(len(token) == 20):
        return False
    else:
        allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!?#+*/-+|%&"
        for char in token:
            if char not in allowed: return False
        return True
  
class IdHandler(tornado.web.RequestHandler):
    @tornado.web.asynchronous
    def get(self):
        global id
        id += 1
        self.write(str(id))
        self.set_header("Access-Control-Allow-Origin", allowedHost)
        self.finish()
     

class relayHandler(tornado.web.RequestHandler):
    @tornado.web.asynchronous
    def get(self):
        global rlId
        print("A new relay handler client connected!")
        rlId += 1
        self.write(str(rlId))
        self.set_header("Access-Control-Allow-Origin", allowedHost)
        self.finish()
        

class storageSocket(tornado.websocket.WebSocketHandler):
    def open(self, *args):
        global storagerCount
        print("Storage web socket opened!")
        token = self.get_argument("Id")
        if not(checkToken(token)):
            self.write_message(json.dumps({"action": "close", "type": "invalidToken"}))
            self.close()
            return
        storagerCount += 1
        self.id = storagerCount
        storagers[self.id] = {"id": self.id, "strId": token, "object": self, "status": "none", "client": "none", "reserved": "none"}
        storagerByStr[token] = self.id
        
    def on_message(self, message):
        if message == "clearStatus":
            storager = storagers[self.id]
            storager["status"] = "none"
            if storager["client"] != "none":
                storager["client"]["status"] = "none"
                storager["client"]["conn"] = "none"
            storager["client"] = "none"
            return
            
        if storagers[self.id]["status"] == "busy-connecting":
            storagers[self.id]["client"]["object"].write_message(message)
        
    def on_close(self):
        if self.id in storagers:
            print("Storager socket closed!")
            if storagers[self.id]["status"] == "busy-connecting":
                client = storagers[self.id]["client"]
                client["status"] = "none"
                client["conn"] = "none"
                client["object"].write_message("storagerConnClose")
                
            if storagers[self.id]["status"] == "reserved":
                clients[storagers[self.id]["reserved"]]["reserved"].remove(self.id)
                
            del storagerByStr[storagers[self.id]['strId']]
            del storagers[self.id]
            
    def check_origin(self, origin):
        return True
  
  
class relaySocket(tornado.websocket.WebSocketHandler):
    def open(self, *args):
        print("Relay web socket opened!")
        self.id = self.get_argument("Id")
        self.stream.set_nodelay(True)
        relays[self.id] = {"id": self.id, "object": self, "status": "none", "client":"none"}
        
    def on_message(self, message):
        global unconfirmedCount
        if message == "clearStatus":
            relay = relays[self.id]
            relay["status"] = "none"
            if relay["client"] != "none":
                relay["client"]["status"] = "none"
                relay["client"]["conn"] = "none"
            relay["client"] = "none"
            return
            
        if is_json(message):
            msg = json.loads(message)
            
        if relays[self.id]["status"] == "busy-connecting":
            relays[self.id]["client"]["object"].write_message(message)
        
    def on_close(self):
        if self.id in relays:
            print("Relay socket closed!")
            if relays[self.id]["status"] == "busy-connecting":
                client = relays[self.id]["client"]
                client["status"] = "none"
                client["conn"] = "none"
                client["object"].write_message("relayConnClose")
            del relays[self.id]
            
    def check_origin(self, origin):
        return True
     
class WebSocketHandler(tornado.websocket.WebSocketHandler):
    def open(self, *args):
        print("Client web socket openened!")
        self.id = self.get_argument("Id")
        self.stream.set_nodelay(True)
        clients[self.id] = {"id": self.id, "object": self, "status": "none", "conn": "none", "reserved": "none"}

    def on_message(self, message):
        if message == "clearStatus":
            client = clients[self.id]
            client["status"] = "none"
            if client["conn"] != "none":
                client["conn"]["status"] = "none"
                client["conn"]["client"] = "none"
            client["conn"] = "none"
            
            return
            
        if clients[self.id]["status"] == "busy-connecting":
            clients[self.id]["conn"]["object"].write_message(message)
            return
            
        data = json.loads(message)
        if data["action"] == "search":
            for relayId in relays:
                relay = relays[relayId]
                if relay["status"] == "none":
                    if data["other"]:
                        if data["not"] == relay["id"]:
                            continue
                    relay["object"].write_message(json.dumps({"action": "newClient", "clientId":self.id}))
                    relay["status"] = "busy-connecting"
                    relay["client"] = clients[self.id]
                    clients[self.id]["conn"] = relay
                    self.write_message(json.dumps({"action": "connect", "relay": relay["id"]}))
                    clients[self.id]["status"] = "busy-connecting"
                    break
            else:
                if len(relays) > 0:
                    self.write_message(json.dumps({"action":"busy"}))
                else:
                    self.write_message(json.dumps({"action":"no"}))
                    
        elif data["action"] == "storagerStatus":
            if data["id"] in storagerByStr:
                storager = storagers[storagerByStr[data['id']]]
                if storager["status"] == "none" or (storager["status"] == "reserved" and storager["reserved"] == self.id):
                    self.write_message(json.dumps({"action":"storagerStatus", "status":"available", "id":data["id"]}))
                else:
                    self.write_message(json.dumps({"action":"storagerStatus", "status":"busy", "id":data["id"]}))
            else:
                self.write_message(json.dumps({"action":"storagerStatus", "status":"offline", "id":data["id"]}))
                
        elif data["action"] == "connectStorager":
            if data["id"] not in storagerByStr:
                self.write_message(json.dumps({"action":"connStorager", "status":"no"}))
            else:
                storager = storagers[storagerByStr[data["id"]]]
                if not(storager["status"] == "none") and not(storager["status"] == "reserved" and storager["reserved"] == self.id):
                    self.write_message(json.dumps({"action":"connStorager", "status":"busy"}))
                else:
                    storager["object"].write_message(json.dumps({"action":"newClient", "clientId":self.id}))
                    if storager["status"] == "reserved":
                        clients[self.id]["reserved"].remove(data["id"])
                        storager["reserved"] = "none"
                        
                    storager["status"] = "busy-connecting"
                    storager["client"] = clients[self.id]
                    clients[self.id]["conn"] = storager
                    self.write_message(json.dumps({"action":"connect","status":"ok"}))
                    clients[self.id]["status"] = "busy-connecting"

                    
        elif data["action"] == "reserveRegisterClients":
            currCount = 0
            foundStores = []
            if len(storagers) == 0:
                self.write_message(json.dumps({"action": "registerClientIds", "status": "error"}))
                return
                
            for storagerId in storagers:
                currCount += 1
                if currCount == 10:
                    break
                storager = storagers[storagerId]
                if storager["status"] == "none":
                    foundStores.append(storager["strId"])
                    storager["status"] = "reserved"
                    storager["reserved"] = self.id
            
            clients[self.id]["reserved"] = foundStores
            self.write_message(json.dumps({"action": "registerClientIds", "ids": foundStores}))

    def on_close(self):
        if self.id in clients:
            print("Web socket closed!")
            if clients[self.id]["status"] == "busy-connecting":
                conn = clients[self.id]["conn"]
                conn["object"].write_message(json.dumps({"action":"clientConnClose", "id":self.id}))
                conn["status"] = "none"
                conn["client"] = "none"
            
            if clients[self.id]["reserved"] != "none":
                for storagerId in clients[self.id]["reserved"]:
                    storager = storagers[storagerByStr[storagerId]]
                    storager["status"] = "none"
                    storager["reserved"] = "none"
            
            del clients[self.id]
            
            
    def check_origin(self, origin):
        return True

app = tornado.web.Application([
    (r'/id', IdHandler),
    (r'/ws', WebSocketHandler),
    (r'/storageSocket', storageSocket),
    (r'/relayBegin', relayHandler),
    (r'/relaySocket', relaySocket)
])
if __name__ == '__main__':
    parse_command_line()
    app.listen(options.port)
    tornado.ioloop.IOLoop.instance().start()
