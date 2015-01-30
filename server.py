import tornado.ioloop
import tornado.web
import tornado.websocket
import json
import random

from tornado.options import define, options, parse_command_line

define("port", default=8888, help="run on the given port", type=int)

conns = dict()
connId = 0
allowedHost = "http://localhost:8383"
storagerByStr = dict()
    
def is_json(myjson):
  try:
    json_object = json.loads(myjson)
  except ValueError:
    return False
  return True  
  
def checkToken(token):
    if len(token) != 20:
        return False
    else:
        allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!*/-|"
        for char in token:
            if char not in allowed: 
                return False
        return True

def getRelays():
    id = 0
    answer = dict()
    for client in conns:
        client = conns[client]
        if client["type"] == "relay":
            answer[id] = client
            id += 1
    return answer

class socket(tornado.websocket.WebSocketHandler):
    def open(self, *args):
        global connId
        connType = self.get_argument("type")
        token = ""
        if connType == "storager":
            token = self.get_argument("token")
            if not checkToken(token):
                self.write_message(json.dumps({"action": "close", "type": "invalidToken"}))
                self.close()
                return
        connId += 1
        self.id = connId
        conns[connId] = {"id": connId, "token": token, "object": self, "sids": dict(), "type": connType, "nextSid": "none"}
        if connType == "storager":
            storagerByStr[token] = conns[connId]
    def on_message(self, message):
        if not is_json(message): return
        msg = json.loads(message)
        if "sid" in msg and not msg["sid"] in conns[self.id]["sids"]:
            return
        if msg["action"] == "new":
            conns[self.id]["sids"][msg["id"]] = {"id": self.id, "sid": msg["id"], "status": "none", "conn": "none"}
            return
        if msg["action"] == "clearStatus":
            sid = conns[self.id]["sids"][msg["id"]]
            if sid["conn"] != "none":
                del conns[sid["conn"]["id"]]["sids"][sid["conn"]["sid"]]
            del conns[self.id]["sids"][msg["id"]]
            return
        if msg["action"] == "forward":
            sid = conns[self.id]["sids"][msg["sid"]]
            if sid["conn"] == "none":
                self.write_message(json.dumps({"action": "forwardError", "sid": msg["sid"], "type": "noConn"}))
                return
            newSid = sid["conn"]["sid"]
            msg["sid"] = newSid
            msg["action"] = msg["forwardAction"]
            msg["forwardAction"] = "forwarded"
            conns[sid["conn"]["id"]]["object"].write_message(json.dumps(msg))
            return
        if msg["action"] == "reserve":
            sid = conns[self.id]["sids"][msg["sid"]]
            if sid["status"] != "none":
                self.write_message(json.dumps({"action":"reserve", "type": msg["type"], "status": "error", "sid": msg["sid"]}))
                return
            if msg["type"] == "relay" and not "id" in msg:
                count = 0
                relays = getRelays()
                checked = []
                while 1:
                    if count == len(relays):
                        break
                    id = random.randrange(len(relays))
                    if id in checked:
                        continue
                    checked.append(id)
                    relay = relays[id]
                    relay["object"].write_message(json.dumps({"action":"new", "type": conns[self.id]["type"], "id": self.id}))
                    relay["nextSid"] = {"conn": conns[self.id], "sid": msg["sid"]}
                    sid["status"] = "waiting"
                    sid["connId"] = relay["id"]
                    return
                if len(relays) > 0:
                    self.write_message(json.dumps({"action":"reserve", "type": msg["type"], "status": "busy", "sid": msg["sid"]}))
                else:
                    self.write_message(json.dumps({"action":"reserve", "type": msg["type"], "status": "no", "sid": msg["sid"]}))
                return
            else:
                if not "id" in msg:
                    self.write_message(json.dumps({"action":"reserve", "type": msg["type"], "status": "error", "sid": msg["sid"]}))
                    return
                returnInfo = -1
                if msg["type"] == "storager":
                    if msg["id"] in storagerByStr:
                        returnInfo = storagerByStr[msg["id"]]
                else:
                    for conn in conns:
                        if conn["type"] != msg["type"]:
                            continue
                        if conn["id"] != msg["id"]:
                            continue
                        returnInfo = conn
                if returnInfo == -1:
                    self.write_message(json.dumps({"action":"reserve", "type": msg["type"], "status": "no", "sid": msg["sid"]}))
                    return
                else:
                    returnInfo["object"].write_message(json.dumps({"action":"new", "type": conns[self.id]["type"], "id": self.id}))
                    returnInfo["nextSid"] = {"conn": conns[self.id], "sid": msg["sid"]}
                    sid["status"] = "waiting"
                    return
                    
        if msg["action"] == "reserved":
            sid = conns[self.id]["sids"][msg["sid"]]
            if sid["status"] != "none":
                # ??
                return
            if conns[self.id]["nextSid"] == "none":
                self.write_message(json.dumps({"action":"connClose", "sid": msg["sid"]}))
                return
            
            nextSid = conns[self.id]["nextSid"]
            otherSid = nextSid["conn"]["sids"][nextSid["sid"]]
            otherSid["status"] = "busy"
            otherSid["conn"] = sid
            sid["status"] = "busy"
            sid["conn"] = otherSid
            nextSid["conn"]["object"].write_message(json.dumps({"action":"reserve", "type": conns[self.id]["type"], "status": "ok", "sid": otherSid["sid"], "id": self.id}))
            conns[self.id]["nextSid"] = "none"
            return
        if msg["action"] == "getlist":
            list = []
            count = 0
            for client in conns:
                client = conns[client]
                if client["type"] == msg["type"]:
                    if client["type"] == "storager":
                        list.append(client["token"])
                    else:
                        list.append(client["id"])
                    count += 1
                    if count == msg["count"]:
                        break
            
            status = "ok"
            if count == 0:
                status = "error"
            self.write_message(json.dumps({"action": "getlist", "status": status, "ids": list}))
        if msg["action"] == "status":
            for client in conns:
                client = conns[client]
                if client["type"] != msg["type"]:
                    continue
                if msg["type"] == "storager":
                    if msg["id"] != client["token"]:
                        continue
                else:
                    if msg["id"] != client["id"]:
                        continue
                self.write_message(json.dumps({"action": "status", "type": msg["type"], "classId": msg["classId"], "status": "available", "id": msg["id"]}))
                return
            self.write_message(json.dumps({"action": "status", "type": msg["type"], "classId": msg["classId"], "status": "notfound"}))
    
    def on_close(self):
        obj = conns[self.id]
        for sid in obj["sids"]:
            sid = obj["sids"][sid]
            if sid["status"] == "busy":
                conns[sid["conn"]["id"]]["object"].write_message(json.dumps({"action":"connClose", "type": obj["type"], "id": obj["id"], "sid": sid["conn"]["sid"]}))
            elif sid["status"] == "waiting":
                conns[sid["connId"]]["nextSid"] = "none"
            if sid["conn"] == "none":
                continue
            del conns[sid["conn"]["id"]]["sids"][sid["conn"]["sid"]]
            
        if conns[self.id]["type"] == "storager":
            del storagerByStr[conns[self.id]["token"]]
        del conns[self.id]
     
  
class WebSocketHandler(tornado.websocket.WebSocketHandler):

    def check_origin(self, origin):
        return True

app = tornado.web.Application([
    (r'/socket', socket)
])
if __name__ == '__main__':
    parse_command_line()
    app.listen(options.port)
    tornado.ioloop.IOLoop.instance().start()
