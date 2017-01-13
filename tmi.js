var twitchIRC = function (nick, auth, options) {
    "use strict";
    auth = auth[5] === ":" ? auth : "oauth:" + auth;
    options = options || [];

    var log = options.debug || false,
        relay = options.relay || false,
        channels = options.channels || [],
        triggers = {},
        ws;
    var that = this;

    // Can Websockets work
    if (!("WebSocket" in window)) {
        // The browser doesn't support WebSocket
        throw {
            name: "Web Sockets Unsupported",
            message: "Your browser does not support web sockets! Please update your browser!"
        };
    }

    // Tools
    function is_array(array) {
        // Check the array is an object
        return typeof array === "object";
    }
    function indexOf(array, find) {
        var i;
        // Confirm that the array exists and it is an array
        if (array === "undefined" || !is_array(array)) {
            return false;
        }
        // Search the array
        for (i = 0; i < array.length; i++) {
            // If it is what you are looking for return the position
            if (array[i] === find) {
                return i;
            }
        }
        // If it is not found return -1
        return -1;
    }
    function pad(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }

    // Events
    function on (event, callback) {
        if (!triggers[event]) {
            triggers[event] = [];
        }
        triggers[event].push(callback);
    }
    function fire (event, params) {
        var i;
        if (triggers[event]) {
            for (i in triggers[event]) {
                triggers[event][i].apply(null, Array.prototype.slice.call(arguments, 1));
            }
        }
    }

    if (typeof relay === "string") {
        ws = new WebSocket(relay);
    } else {
        ws = new WebSocket("ws://irc-ws.chat.twitch.tv/");
    }

    function twLog(level, param1) {
        if (log == level) {
            console.log.apply(null, [].slice.call(arguments, 1));
        }
    }
    function wsSend(raw) {
        ws.send(raw);
        twLog(2, raw)
    }

    // Main join, part & messaging functions
    function join (channel) {
        // Remove trailing spaces
        channel = channel.trim();

        // Add the '#' if in infront of channel
        if (channel.substr(0, 1) !== "#") {
            channel = "#" + channel;
        }

        // Send the command
        wsSend("JOIN " + channel);
    }
    function part (channel) {
        // Remove trailing spaces
        channel = channel.trim();

        // Add the '#' if in infront of channel
        if (channel.substr(0, 1) !== "#") {
            channel = "#" + channel;
        }

        // Send the command
        wsSend("PART " + channel);
    }
    function send (channel, message) {
        // Remove trailing spaces
        channel = channel.trim();

        // Add the '#' if in infront of channel
        if (channel.substr(0, 1) !== "#") {
            channel = "#" + channel;
        }

        // Send the command
        wsSend("PRIVMSG " + channel + " :" +message);
    }
    function whisperTo (user, message) {
        // Remove trailing spaces
        user = user.trim();

        // Send the command
        wsSend("PRIVMSG #jtv :/w " + user + " " + message);
    }

    // On connection log in
    ws.onopen = function () {
        var i;
        // Web Socket is connected, send data using send()
        wsSend('PASS ' + auth);
        wsSend('NICK ' + nick);

        // Request all capibilities
        wsSend('CAP LS');

        // Join initial channels
        for (i in channels) {
            // Check the channel is not lost
            if (channels.hasOwnProperty(i)) {
                // Join the channel
                join(channels[i]);
            }
        }
    };
    ws.onmessage = function (evt) {
        // Collect the message from the event
        var messages = evt.data,
            // Split the message to single lines
            messages = messages.trim().split("\n"),
            // Declare the rest of the used variables
            i, e, array, message, tags, emote, emotes, emotesArray;

        // Loop through all possible lines
        for (i in messages) {
            // Check the line is still there
            if ({}.hasOwnProperty.call(messages, i)) {
                // Emit the "raw" event
                fire("raw", messages[i].trim());

                // Split the line down into tags, host, command, channel & message
                array = /(?:@([^ ]*) )?:([a-zA-z0-9!@_.]+) ([A-Z0-9]+) ([^ \r\n]+)(?:(?: :)?(.*))?/g.exec(messages[i].trim());

                // If the regex worked
                if (array !== null) {
                    // Construct the 'constants' in a message
                    message = {
                        'host': array[2],
                        'command': array[3],
                        'channel': array[4],
                        'raw': messages[i].trim()
                    };

                    // If there is a message put it in the array
                    if (typeof array[5] !== "undefined") {
                        if (/\u0001ACTION (.*)\u0001/.test(array[5])) {
                            message.action = true;
                            message.message = /\u0001ACTION (.*)\u0001/.exec(array[5])[1];
                        } else {
                            message.action = false;
                            message.message = array[5];
                        }
                    }

                    // If the message has tags
                    if (typeof array[1] !== "undefined") {
                        // Create a place to store the tags
                        tags = {};
                        // Split the tags into individual tags
                        array[1] = array[1].split(";");

                        // Go through every tag
                        for (i in array[1]) {
                            // Check that the tag is there
                            if (array[1].hasOwnProperty(i)) {
                                // Open the tag's key and value
                                array[1][i] = array[1][i].split("=");

                                // Assign the value to the correct key and add to tags array
                                tags[array[1][i][0]] = array[1][i][1];
                            }
                        }

                        // Add tags to the message array
                        message.tags = tags;

                        if (typeof tags.badges !== "undefined" && tags.badges !== "") {
                            tags.badgesArray = tags.badges.split("/").join("-").split(",");
                        }

                        // If emotes were used
                        if (typeof tags.emotes !== "undefined" && tags.emotes != "") {
                            // Parse emotes
                            emotes = tags.emotes.split("/");
                            emotesArray = [];
                            e = 0;
                            // Go through every emote
                            for (i in emotes) {
                                // Check that the tag is there
                                if (emotes.hasOwnProperty(i)) {
                                    emote = emotes[i].split(":");
                                    emote[1] = emote[1].split(",");

                                    for (i in emote[1]) {
                                        if (emote[1].hasOwnProperty(i)) {
                                            emote[1][i] = emote[1][i].split("-");

                                            emote[1][i][0] = parseInt(emote[1][i][0], 10);
                                            emote[1][i][1] = parseInt(emote[1][i][1], 10);
                                            e++;
                                        }
                                    }
                                    emotesArray[emotesArray.length] = {
                                        "name": message.message.substring(emote[1][0][0], emote[1][0][1]+1),
                                        "location": emote[1],
                                        "emoteId":emote[0]
                                    }
                                }
                            }
                            message.tags.emotesArray = emotesArray;
                            message.tags.emotesArray["count"] = e;
                        }
                    }

                    message.time = new Date().getTime();

                    // Pull usernames from host
                    if (/(?:(.+)!\1@\1\.)tmi.twitch.tv/.test(message.host)) {
                        message.user = /(?:(.+)!\1@\1\.)tmi.twitch.tv/.exec(message.host)[1];
                    }
                } else {
                    // Check to see if is a PING
                    if (messages[i].trim() === "PING :tmi.twitch.tv") {
                        // Respond to PING
                        wsSend("PONG :tmi.twitch.tv");
                        // Give a nicer message
                        message = {
                            "command": "PING",
                            "message": "tmi.twitch.tv"
                        };
                    } else {
                        message = messages[i];
                    }

                }

                // Emit the "join" event
                if (message.command === "JOIN") {
                    delete message.action;
                    twLog(1, "User joined:", message.channel, message.user);
                    fire("join", message.channel, message.user);
                    if (that.connected.indexOf(message.channel) == -1)
                        that.connected.push(message.channel);
                }
                // Emit the "part" event
                else if (message.command === "PART") {
                    delete message.action;
                    twLog(1, "User left:", message.channel, message.user);
                    fire("part", message.channel, message.user);
                    that.connected.splice(that.connected.indexOf(message.channel), 1);
                }
                // Deal with Capabilities
                else if (message.command === "CAP") {
                    delete message.action;
                    delete message.channel;
                    message.command += " * " + message.message.split(":")[0].trim(" ");
                    message.message = message.message.split(":")[1];
                    message.capibilities = message.message.split(" ");

                    if (message.command === "CAP * LS") {
                        wsSend('CAP REQ :' + message.message);
                        twLog(1, "Available Capabilities:", message.message);
                    } else if (message.command === "CAP * NAK") {
                        twLog(1, "Denied Capabilities:", message.message);
                    } else if (message.command === "CAP * ACK") {
                        twLog(1, "Accepted Capabilities:", message.message);
                    }
                }
                // Mode responce
                else if (message.command === "MODE") {
                    delete message.action;
                    message.user = message.message.trim().split(" ")[1];
                    message.message = message.message.trim().split(" ")[0];

                    twLog(1, "Mode:", message.channel, message.user, message.message);
                    fire("mode", message.channel, message.user, message.message);
                }
                // Emit the "roomstate" event
                else if (message.command === "ROOMSTATE" && message.channel !== true) {
                    delete message.action;
                    twLog(1, "roomstate:", message.channel, message.tags);
                    fire("roomstate", message.channel, message.tags);
                }
                // Emit the "userstate" event
                else if (message.command === "USERSTATE" && message.channel !== true) {
                    delete message.action;
                    twLog(1, "userstate:", message.channel, message.tags);
                    fire("userstate", message.channel, message.tags);
                }
                // Emit the "message" event
                else if (message.command === "PRIVMSG" && message.action !== true) {
                    delete message.action;
                    twLog(1, "message", message.channel, message.user, ":"+message.message);
                    fire("message", message.channel, message.user, message.message, message.tags);
                }
                // Emit the "clearchat" events
                else if (message.command === "CLEARCHAT") {
                    if (message.message) {
                        // User timed out
                        if (message.tags["ban-duration"]) {
                            twLog(1, "Timed:", message.channel, ":"+message.message, "-", message.tags["ban-duration"]);
                            fire("usertimed", message.channel, message.message, message.tags["ban-duration"], message.tags);
                        }
                        // User banned
                        else {
                            twLog(1, "Banned:", message.channel, ":"+message.message);
                            fire("userban", message.channel, message.message, message.tags);
                        }
                    } else {
                        twLog(1, "clearchat", message.channel);
                        fire("clearchat", message.channel);
                    }
                }
                // Emit the "action" event
                else if (message.command === "PRIVMSG" && message.action === true) {
                    twLog(1, "action", message.channel, message.user, ":"+message.message);
                    fire("action", message.channel, message.user, message.message, message.tags);
                }
                // Emit the "whisper" event
                else if (message.command === "WHISPER") {
                    delete message.action;
                    twLog(1, "whisper", message.channel, message.user, ":"+message.message);
                    fire("whisper", message.channel, message.user, message.message, message.tags);
                }
                // Emit the "relay error" event
                else if (message.command === "ERROR") {
                    delete message.action;
                    twLog(1, "relayerror", message.channel, ":"+message.message);
                    fire("relayerror", message.channel, message.message);
                }
                // Emit the "bots nick" event
                else if (message.command === "BOTNICK") {
                    that.username = message.channel;
                    twLog(1, "botnick", message.channel);
                    fire("botnick", message.channel);
                }
                // Emit the "notice" event
                else if (message.command === "NOTICE") {
                    delete message.action;
                    twLog(1, "notice", message.channel, ":"+message.message);
                    fire("notice", message.channel, message.message, message.tags);
                }
                // Emit the "welcome" event
                else if (message.command === pad(parseInt(message.command, 10), 3)) {
                    delete message.action;
                    twLog(1, "Welcome:", message.command, ":"+message.message);
                    fire("welcome", message.command, message.message);
                }

                twLog(2, message);
                // Emits the 'all' event
                fire("all", message);
            }
        }
    };
    ws.onclose = function () {
        fire("close");
    };

    this.username = nick;
    this.connected = [];

    this.sendRaw = wsSend;
    this.send = send;
    this.whisper = whisperTo;

    this.join = join;
    this.part = part;

    this.on = on;
    this.close = () =>{
        ws.close();
    };
};
