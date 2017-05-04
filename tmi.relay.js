var WebSocket = require('ws'),
    request = require("request"),
    options = require("./relay.json"),
    clients = new WebSocket.Server({ port: options.port || 80 });
    
var twitchURL = 'ws://irc-ws.chat.twitch.tv:80/';

var log = options.log || false;
var proxy = options.proxy || false;
var relay = options.relay || false;
var mainHost = options.host || "unknown.host";

var bots = options.bots || {};

var _relay = {
    name: "justinfan" + Math.floor(Math.random()*999999),
    host: mainHost,
    auth: "blah",
    users: true
};

// 'bots' defaults
if (typeof bots._default === "string" && typeof bots[bots._default] !== "undefined") {
    bots._default = bots[bots._default];
}
if (typeof bots._default === "undefined") {
    if (Object.keys(bots).length !== 0) {
        bots._default = bots[Object.keys(bots)[0]];
    } else {
        bots._default = _relay;
    }
}
bots._relay = _relay;

var jtvRegex = /^justinfan[0-9]{1,6}$/ig
var nickRegex = /^[a-z0-9][a-z0-9_]*$/ig;

function rateLimit(limitCount, limitInterval, fn) {
    var fifo = [];

    // count starts at limit
    // each call of `fn` decrements the count
    // it is incremented after limitInterval
    var count = limitCount;

    function call_next(args) {
        setTimeout(function() {
            if (fifo.length > 0) {
                call_next();
            }
            else {
                count = count + 1;
            }
        }, limitInterval);

        var call_args = fifo.shift();

        // if there is no next item in the queue
        // and we were called with args, trigger function immediately
        if (!call_args && args) {
            fn.apply(args[0], args[1]);
            return;
        }

        fn.apply(call_args[0], call_args[1]);
    }

    return function rate_limited_function() {
        var ctx = this;
        var args = Array.prototype.slice.call(arguments);
        if (count <= 0) {
            fifo.push([ctx, args]);
            return;
        }

        count = count - 1;
        call_next([ctx, args]);
    };
}
function connectionLog(type, vars) {
    console.log.apply(null, arguments)
}
function getAddress(client) {
    var address = client.upgradeReq.headers["x-forwarded-for"];
    
    if (typeof address !== "undefined") {
        address = address.split(",")[0];
    }
    if (typeof address === "undefined") {
        address = client.upgradeReq.headers["client-id"];
    }
    
    if (typeof address === "undefined") {
        address = client.upgradeReq.connection.remoteAddress;
    }
    return address;
}
function confirmUser(PASS, NICK, callback) {
    try {
        request("https://api.twitch.tv/kraken/?oauth_token=" + PASS, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                var json = JSON.parse(body);
                if (json.token.valid === true && json.token.user_name == NICK) {
                    callback(true);
                } else {
                    callback(false);
                }
            } else {
                callback(false);
            }
        });
    } catch (err) {
        callback(false);
    }
}
function connBot(client, botNick) {
    // Connect to twitch
    var twitch = new WebSocket(twitchURL);
    var address = getAddress(client);
    var pass = false;
    var nick = false;
    var count = 0;
    var toWrite = [];
    var through = false;
    var connected = true;
    
    var bot = bots[botNick];
    
    var readonly = jtvRegex.exec(bot.name) !== null;
    
    // Default bot options
    bot.host = bot.host || (bot.name + ".bot." + mainHost);
    bot.cmds = bot.cmds || [];
    bot.users = bot.users || [];
    
    
    var twitchSend = rateLimit(20, 30 * 1000, msg => {
        if (log) console.log("t->", msg);
        try {
            twitch.send(msg);
        } catch (err) {
            console.log(err)
        }
    });
    
    
    function toTwitch(raw) {
        twitchSend(raw);
    }
    function toClient(raw) {
        if (connected) {
            if (log) console.log("c->", raw);
            try {
                client.send(raw);
            } catch (err) {
                console.log(err)
            }
        }
    }
    
    // Immediately send and RNICK command for 'Relay Nickname'
    toClient(":" + bot.host + " BOTNICK " + bot.name);
    
    function serverIn(message) {
        if (log) console.log("<-t", message);
        
        if (message.split(":")[1].split(" ")[1] !== "WHISPER") {
            toClient(message)
        }
    }
    function clientIn(message) {
        if (log) console.log("<-c", message);
        var e = message.split(" ");
        if (
            (count === 0 && e[0] !== "PASS") || 
            (count === 1 && e[0] !== "NICK") || 
            (count > 1 && (pass === false || nick === false))
        ) {
            toClient(":" + bot.host + " ERROR " + bot.name + " :Send PASS first then NICK second, nothing before!");
            connectionLog("Bot - Order:", nick, pass, address);
            client.close();
            twitch.close();
        } else {
            switch (e[0]) {
                case "PASS":
                    e = message.split(":");
                    pass = e[1];
                    break;
                case "NICK":
                    nick = e[1];
                    confirmUser(pass, nick, function (i) {
                        if (i === true) {
                            if (bot.users === true || bot.users.indexOf(nick) !== -1) {
                                connectionLog("Bot - Pass:", nick, pass, address)
                                
                                toTwitch("PASS " + (bot.auth[5] === ":" ? bot.auth : ("oauth:" + bot.auth)));
                                toTwitch("NICK " + bot.name);
                                
                                through = true;
                                
                                for (var a in toWrite) {
                                    toTwitch(toWrite[a]);
                                }
                            } else {
                                connectionLog("Bot - Auth:", nick, pass, address);
                                toClient(":" + bot.host + " ERROR " + bot.name + " :'" + nick + "' is not allowed to use " + bot.name);
                                client.close();
                                twitch.close();
                            }
                        } else {
                            toClient(":" + bot.host + " ERROR " + bot.name + " :Please check your username, oauth and scopes");
                            connectionLog("Bot - Fail:", nick, pass, address);
                            client.close();
                            twitch.close();
                        }
                    })
                    break;
                case "PART":
                case "JOIN":
                    if (e[1] != "#"+nick) {
                        toClient(":" + bot.host + " ERROR " + bot.name + " :You can only " + e[0].toLowerCase() + " your own channel!");
                    } else {
                        if (through === false) {
                            toWrite[toWrite.length] = message;
                        } else {
                            toTwitch(message);
                        }
                    }
                    break;
                case "PRIVMSG":
                    if (readonly) {
                        toClient(":" + bot.host + " ERROR " + bot.name + " :You're in read only mode!");
                        break;
                    }
                
                    if (e[1] != "#"+nick) {
                        toClient(":" + bot.host + " ERROR " + bot.name + " :You can only message your own channel!");
                    } else if (e[2][1] === "/" || e[2][1] === ".") {
                        // Allowed command
                        if (bot.cmds.indexOf(e[2].slice(2).toLowerCase()) !== -1) {
                            if (through === false) {
                                toWrite[toWrite.length] = message;
                            } else {
                                toTwitch(message);
                            }
                        }
                        // Help command
                        else if (e[2].slice(2).toLowerCase() === "help") {
                            toClient(":" + bot.host + " NOTICE " + bot.name + " :Commands that " + bot.name + " allows: '/help', '/" + bot.cmds.join("' /'") + "'!");
                        }
                        // Unknown command
                        else {
                            toClient(":" + bot.host + " ERROR " + bot.name + " :That command '" + e[2].slice(1) + "' is not allowed!");
                        }
                    } else {
                        if (through === false) {
                            toWrite[toWrite.length] = message;
                        } else {
                            toTwitch(message);
                        }
                    }
                    break;
                case "PING":
                case "PONG":
                case "CAP":
                    if (through === false) {
                        toWrite[toWrite.length] = message;
                    } else {
                        toTwitch(message);
                    }
                    break;
                default:
                    toClient(":" + bot.host + " ERROR " + bot.name + " :" + bot.name + " doesn't know the command '" + e[0] + "'!");
                    if (log) console.log("Unknown command: '" + e[0] + "'");
                    break;
            }
        }
        
        count++;
    }
    
    // Ingest messages and split into lines
    twitch.on('message', msgs => {
        var a;
        msgs = msgs.replace("\r", "").split("\n");
        for (a = 0; a < msgs.length; a++) {
            if (msgs[a].trim() !== "")
                serverIn(msgs[a].trim());
        }
    });
    client.on('message', msgs => {
        var a;
        msgs = msgs.replace("\r", "").split("\n");
        for (a = 0; a < msgs.length; a++) {
            if (msgs[a].trim() !== "")
                clientIn(msgs[a].trim());
        }
    });
    
    // Close both sockets on one closing.
    client.on("close", function () {
        twitch.close();
        connected = false;
    });
    twitch.on("close", function () {
        client.close();
        connected = false;
    });
    
}
function connRaw (client) {
    var address = getAddress(client)
    var upstream = new WebSocket(twitchURL)
    var piped = false;
    var blockage = [];
    var upstreamSend = rateLimit(20, 30 * 1000, msg => {
        upstream.send(msg);
    });
    
    function pushUpstream(raw) {
        upstreamSend(raw);
    }
    function toServer(raw) {
        if (raw === true) {
            piped = true;
            for (a = 0; a < blockage.length; a++) {
                pushUpstream(blockage[a]);
            }
        } else if (!piped) {
            blockage[blockage.length] = raw;
        } else {
            pushUpstream(raw);
        }
    }
    
    upstream.on("open", () => {
        connectionLog("Raw - Open:", address);
        toServer(true);
        upstream.on('message', raw => {
            client.send(raw);
        });
    });
    
    upstream.on("error", (e) => {
        connectionLog("Raw - Error:", address);
        client.send(e.toString());
        client.close();
    });
    
    client.on('message', toServer);
    
    // Close both streams
    client.on("close", () => {
        upstream.close();
    });
    upstream.on("close", () => {
        client.close();
    });
}
function connClass (client) {
    var url = client.upgradeReq.url.slice(1);
    var isBotName;
    
    // Reset regex state
    nickRegex.lastIndex = 0;
    isBotName = Boolean(nickRegex.exec(url));
    
    // Proxy connection
    if (url === "~proxy") {
        // Proxy mode is allowed
        if (proxy === true) {
            connRaw(client, twitchURL);
        }
        // Proxy mode is allowed
        else {
            connectionLog("Proxy - Fail:", getAddress(client))
            client.send(":proxy." + mainHost + " ERROR client :Raw proxying is disabled");
            client.close();
        }
    }
    
    // Relay connection
    else if (url === "~relay") {
        // Relay mode is allowed
        if (relay === true) {
            connBot(client, "_relay");
        }
        // Relay mode is allowed
        else {
            connectionLog("Relay - Fail:", getAddress(client))
            client.send(":relay." + mainHost + " ERROR client :Raw relaying is disabled");
            client.close();
        }
    }
    
    // Intercede via default bot
    else if (url === "") {
        connBot(client, "_default");
    }
    
    // Intercede via given bot name
    else if (isBotName === true) {
        // given bot is known
        if (Object.keys(bots).indexOf(url) !== -1) {
            connBot(client, url);
        }
        
        // Unknown bot
        else {
            connectionLog("Bot - Unknown:", getAddress(client))
            client.send(":bots." + mainHost + " ERROR client :Unknown bot requested: '" + url + "'");
            client.close();
        }
    }
    
    // Unknown request
    else {
        connectionLog("Unknown:", getAddress(client))
        client.send(":bots." + mainHost + " ERROR client :Unknown request: '" + url + "'");
        client.close();
    }
}
clients.on('connection', connClass);
