const WebSocket = require('ws');
const uuid = require('uuid/v4');
const socketIdMap = new Map();
const userIdMap = new Map();
const wss = new WebSocket.Server({
    port: 8000
});
const request = require("request");


wss.on('connection', function connection(ws) {
    // Create uuid for client on connect
    // On close
    ws.on('close', function (code, reason) {
        console.log('close '+ ws.uuid)
        socketIdMap.forEach((value,key)=>{
            if(key != ws.uuid){
                value.send(JSON.stringify({action:"OFFLINE",result:{status_code:"1",user:{user_id:userIdMap.get(ws.uuid),key:ws.uuid}}}));
            }
        });
        socketIdMap.delete(ws.uuid)
        userIdMap.delete(ws.uuid)
        ws.close();
    });
    ws.on('message', function incoming(message) {
        try {
            let data = JSON.parse(message)
            // Khi người dùng gửi tin nhắn
            if (data["action"].toString().toLowerCase() === "sendmessage") {
                try{
                    socketIdMap.get(data['towsid']).send(JSON.stringify({action:"SENDMESSAGE",result:{status_code:"1",content : data['content']}}));
                }catch(err){
                    
                }
            }
            // Người dùng lấy tất cả danh sách bạn bè
            if (data["action"].toString().toLowerCase() === "getsimplefriendlist") {
                var arr = Array.from(userIdMap.entries())
                var jsonObject = []
                // arr.forEach((value)=>{
                //     if(userIdMap.get(ws.uuid)!== value[1]){
                //         jsonObject.push({key:value[0],user_id:value[1]})
                //     }
                // })
                
                arr.forEach(value=>{//Lấy giá trị ngoài trừ chính socket hiện tại
                    if(value[0] != ws.uuid){
                        jsonObject.push({key:value[0],user_id:value[1]})
                    }
                })
                if (socketIdMap.has(ws.uuid)) {
                    ws.send(JSON.stringify({
                        action: "GETSIMPLEFRIENDLIST",
                        result: {
                            clients:jsonObject,
                            status_code : "1"
                        }
                    }));
                } else {
                    ws.send(JSON.stringify({action:"GETSIMPLEFRIENDLIST",result:{status_code:"-1",message:"Không tồn tại kết nối "}}));
                    ws.close();
                }
            }
            // On user connect to websocket
            if (data["action"].toString().toLowerCase() === "connect") {
                let token = data["token"]
                if (token !== "") {
                    request({
                        url: "http://jassis-server.southeastasia.cloudapp.azure.com:3000/token/checktoken",
                        body: {
                            token: token
                        },
                        method: 'POST',
                        json: true
                    }, function (err, response) { // Response decode
                        if (err) console.log(err);
                        if (response.statusCode === 200) {
                            if (socketIdMap.has(ws.uuid)) {
                                ws.CONNECTING = true
                            } else {
                                ws.uuid = uuid();
                                socketIdMap.set(ws.uuid, ws);
                                userIdMap.set(ws.uuid, response.body.id)
                            }
                            ws.send(JSON.stringify({
                                action: "CONNECT",
                                result: {
                                    status_code: 1,
                                    message: "success",
                                    ws_id: ws.uuid
                                }
                            }))
                        } else {
                            // Khi token sai
                            ws.send(JSON.stringify({action:"CONNECT",result:{status_code:"-1",message:"Token sai cmnr"}}));
                            ws.close();
                        }
                        socketIdMap.forEach((value,key)=>{
                            if(key != ws.uuid){
                                value.send(JSON.stringify({action:"ONLINE",result:{status_code:"1",user:{user_id:data['user_id'],key:ws.uuid}}}))
                            }
                        })
                    });
                } else {
                    // Khi token rỗng
                    ws.send(JSON.stringify({action:"CONNECT",result:{status_code:"-1",message:"Token không được rỗng"}}))
                    ws.close();
                }
            }
        } catch (err) {
            ws.send(err);
            console.log("Have error in this message")
        }
    });
});
