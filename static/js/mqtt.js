var mqtt;
var reconnectTimeout = 2000;
var port = 443;

function onConnect() {
    notifyMQTTConnected(mqtt);
}

function onFailure() {
    console.log("connection attemp to " + host + " " + port + " failed!");
    setTimeout(MQTTconnect, reconnectTimeout);
}

function onConnectionLost() {
    console.log("connection to " + host + " " + port + " is lost!");
    setTimeout(MQTTconnect, reconnectTimeout);
}

function onMessageArrived(msg) {
    // console.log(`onMessageArrived(${msg.destinationName}) ... ${msg.payloadString}`);
    notifyMQTTMsgReceived(msg);
    //updateDataTable(msg);
}

function MQTTconnect() {
    console.log("connecting to " + host + " " + port);
    mqtt = new Paho.MQTT.Client(host, port, Math.random().toString());
    var options = {
        timeout: 3,
        onSuccess: onConnect,
        userName: "cts",
        password: "systems",
        useSSL: true,
        onFailure: onFailure,
    };

    mqtt.onMessageArrived = onMessageArrived;
    mqtt.onConnectionLost = onConnectionLost;
    mqtt.connect(options);
}