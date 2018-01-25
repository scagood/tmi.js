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
        const listeners = triggers[event] || [];
        
        listeners.forEach(ear => {
            ear.apply(
                null,
                ([]).slice.call(
                    arguments, 1
                )
            )
        });
    }

    if (typeof relay === "string") {
        ws = new WebSocket(relay);
    } else {
        ws = new WebSocket(
            (options.protocol || (
                options.secure ? 'wss' : 'ws'
            )) + "://irc-ws.chat.twitch.tv/"
        );
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

    const channelHash = channel => {
        channel = channel.trim();
        return (
            channel[0] !== "#" ?
            '#' : ''
        ) + channel;
    };
    
    // Main join, part & messaging functions
    function join (channel) {
        // Send the command
        wsSend("JOIN " + channelHash(channel));
    }
    function part (channel) {
        // Send the command
        wsSend("PART " + channelHash(channel));
    }
    function send (channel, message) {
        // Send the command
        wsSend("PRIVMSG " + channelHash(channel) + " :" +message);
    }
    function whisperTo (user, message) {
        // Send the command
        wsSend("PRIVMSG #jtv :/w " + user.trim() + " " + message);
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
    
    function parseTags(tags) {
        // Convert tags to object
        const output = {};
        
        tags = tags.split(";")
            .map(tag => tag.split('='))
            .map(tag => ({k: tag.shift(), v: tag.join('=')}))
            .filter(tag => tag.v.length > 0)
            .reduce((o, t) => (o[t.k] = t.v) && o, {});
        
        output.tags = tags;

        if (tags.badges) {
            output.badges = tags.badges
                .replace(/\//g, '-').split(",");
        }

        if (tags.emotes) {
            output.emotes = tags.emotes
                .split("/")
                .map(emote => emote.split(':'))
                .map(emote => ({
                    id: emote.shift(),
                    locs: emote.join(':').split(',')
                    .map(loc => loc.split('-'))
                }))
                .reduce((o, t) => (o[t.id] = t.locs) && o, {});
        }
        
        output.userType = {
            mod: tags.mod === '1',
            sub: tags.subscriber === '1',
            turbo: tags.turbo === '1',
            
            global: tags['user-type'] === 'global_mod',
            admin: tags['user-type'] === 'admin',
            staff: tags['user-type'] === 'staff'
        };
        
            
        if (tags['slow']) output.slow = parseInt(tags['slow'], 10);
        if (tags['subs-only']) output.subsOnly = tags['subs-only'] === '1';
        if (tags['r9k']) output.r9k = tags['r9k'] === '1';
        
        return Object.assign({}, tags, output);
    }
    ws.onmessage = function (evt) {
        // Collect the message from the event
        var messages = evt.data,
            // Split the message to single lines
            messages = messages.trim().split("\n"),
            // Declare the rest of the used variables
            i, e, array, message, emote, emotes, emotesArray;

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
                        message.tags = parseTags(array[1]);
                    }

                    message.time = new Date().getTime();

                    // Pull usernames from host
                    if (/(?:(.+)!\1@\1\.)tmi.twitch.tv/.test(message.host)) {
                        message.user = /(?:(.+)!\1@\1\.)tmi.twitch.tv/.exec(message.host)[1];
                    }
                }
                
                // Check to see if is a PING
                else if (messages[i].trim() === "PING :tmi.twitch.tv") {
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
    ws.onclose = () => fire("close");

    this.username = nick;
    this.connected = [];

    this.raw = wsSend;
    this.send = send;
    this.whisper = whisperTo;

    this.join = join;
    this.part = part;

    this.on = on;
    this.close = () => ws.close();
};
