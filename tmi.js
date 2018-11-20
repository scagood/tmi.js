(function () {
    const tagEscs = {
        ':': ';',
        s: ' ',
        '\\': '\\',
        r: '\r',
        n: '\n'
    };
    const regex = {
        tagEsc: /\\[:s\\rn]/g,
        tags: /^@[^\0\r\n ]*/,
        sourceParse: /:(?:([a-z0-9]\w{3,24})!)?(?:([a-z0-9]\w{3,24})@)?([\w.-]*)/i,
        source: /^:(?:(?=[^ ]).)*/,
        command: /^([a-z0-9]+(?:\s+\*\s+[a-z]+)?)/i,
        channel: /^#([^ \r\n]+)/,
        chatroom: /chatrooms:(\d+):((?:[a-z0-9]{4}-?){8})/i,
        message: /^\s*:?(.*)/,
        action: /\u0001ACTION (.*)\u0001/
    };

<<<<<<< HEAD
    function hasBadge(badges = [], type) {
        return Array.isArray(badges) &&
            badges.findIndex(
                badge => badge.startsWith(type + '-')
            ) !== -1;
    }
    function parseTags(tags) {
        // Convert tags to object
        tags = tags.split(';')
            .reduce((carry, tag) => {
                tag = tag.split('=');

                const key = tag.shift();
                const value = tag.join('=')
                    .replace(regex.tagEsc, ([char]) => tagEscs[char]);

                if (value) {
                    carry[key] = value;
                }

                return carry;
            }, {});

        // (moderator/1,staff/1,turbo/1)
        if (tags.badges) {
            tags.badges = tags.badges
                .replace(/\//g, '-')
                .split(',');
        }

        // (25:0-4,12-16/1902:6-10) Kappa Keepo Kappa
        if (tags.emotes) {
            tags.emotes = tags.emotes
                .split('/').map(emote => {
                    const [id, ...locs] = emote
                        .split(/[:,-]/)
                        .map(t => parseInt(t, 10));

                    const locations = locs.reduce((carry, current) => {
                        if (carry.length === 0 || carry[carry.length - 1].length > 1) {
                            carry.push([current]);
                        } else {
                            carry[carry.length - 1].push(current);
                        }
                        return carry;
                    }, []);

                    return {
                        id,
                        locations
                    };
                });
        }
=======
    // Tools
    function pad(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }
>>>>>>> origin/master

        tags.is = type => hasBadge(tags.badges, type);

        if (tags.slow) {
            tags.slow = parseInt(tags.slow, 10);
        }
<<<<<<< HEAD
        if (tags['emote-only']) {
            tags.emoteOnly = tags['emote-only'] === '1';
        }
        if (tags['followers-only']) {
            const fo = parseInt(tags['followers-only'], 10);

            switch (fo) {
                case -1:
                    tags.followersOnly = false;
                    break;
                case 0:
                    tags.followersOnly = true;
                    break;
                default:
                    tags.followersOnly = fo;
                    break;
            }
        }
        if (tags['subs-only']) {
            tags.subsOnly = tags['subs-only'] === '1';
        }
        if (tags.r9k) {
            tags.r9k = tags.r9k === '1';
        }

        // Remove deprecated
        delete tags.mod;
        delete tags.turbo;
        delete tags.subscriber;
        delete tags['user-type'];

        return tags;
=======
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
>>>>>>> origin/master
    }
    function parseMessage(message) {
        const output = {
            raw: message
        };

        if (message[0] === '@') {
            const [rawTags] = message.match(regex.tags);
            const tags = parseTags(rawTags.substring(1));
            for (const tag in tags) {
                if (Object.prototype.hasOwnProperty.call(tags, tag)) {
                    output[tag] = tags[tag];
                }
            }
            message = message.substring(rawTags.length).trim();
        }

<<<<<<< HEAD
        if (message[0] === ':') {
            [output.source] = message.match(regex.source);
            // :tmi.twitch.tv
            // :<nick>!<user>@<host>
            [, output.nick, output.user, output.host] = output.source
                .match(regex.sourceParse);

            message = message.substring(output.source.length).trim();
        }

        [, output.command] = message.match(regex.command);

        message = message.substring(output.command.length).trim();

        if (regex.channel.test(message)) {
            [, output.chatroom] = message.match(regex.channel);
            message = message.substring(output.chatroom.length + 1);

            if (regex.chatroom.test(output.chatroom)) {
                [, output.channel, output.chatroom] = output.chatroom.match(regex.chatroom);
            } else {
                output.channel = output.chatroom;
            }
        }

        message = message.replace(regex.message, '$1');

        if (regex.action.test(message)) {
            [, output.message] = message.match(regex.action);
            output.action = true;
        } else {
            output.message = message;
        }

        return output;
    }

    function TwitchMessageInterface(nick, auth, options) {
        'use strict';

        const that = this;

        auth = auth[5] === ':' ? auth : 'oauth:' + auth;
        options = typeof options === 'object' ? options : {};

        // Can Websockets work
        if (!('WebSocket' in window)) {
            // The browser doesn't support WebSocket
            throw new Error('Web Sockets Unsupported');
        }

        // Events
        const triggers = {};
        function on(event, callback) {
            if (typeof event !== 'string') {
                throw new TypeError('"event" must be a string');
            }
            if (typeof event !== 'function') {
                throw new TypeError('"callback" must be a function');
            }
            if (!triggers[event]) {
                triggers[event] = [];
            }
            triggers[event].push(callback);
        }
        function off(event, callback) {
            if (typeof event !== 'string') {
                throw new TypeError('"event" must be a string');
            }
            if (['function', 'undefined'].includes(typeof callback)) {
                throw new TypeError('"callback" must be a function or undefined');
            }
            if (Array.isArray(triggers[event])) {
                const index = triggers[event]
                    .findIndex(cb => cb === callback);

                triggers.splice(index, 1);
            }
        }
        function fire(event, ...args) {
            const listeners = triggers[event] || [];
=======
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
>>>>>>> origin/master

            listeners.forEach(ear => {
                ear(...args);
            });
        }

<<<<<<< HEAD
        // Initial Connection
        const relay = typeof options.relay === 'string' ? options.relay : undefined;
        const url = 'wss://irc-ws.chat.twitch.tv/';
        const ws = new WebSocket(relay || url);

        function log(level, ...args) {
            if (options.debug && options.debug >= level) {
                console.log(...args);
            }
        }
        (proxied => {
            ws.send = function (...args) {
                log(2, ...args);
                return proxied.apply(ws, args);
            };
        })(ws.send);

        const h = channel => channel[0] === '#' ? channel : ('#' + channel);

        // Main join, part & messaging functions
        const join = function (channel) {
            ws.send('JOIN ' + h(channel));

            const callbacks = [];

            return {
                on: (event, callback) => {
                    callbacks.push({
                        name: event,
                        call: callback
                    });
                    return on(event + h(channel), callback);
                },
                off: (event, callback) => {
                    const index = callbacks.findIndex(
                        ({name, call}) => (call === callback && name === event)
                    );
                    callbacks.splice(index, 1);

                    return off(event + h(channel), callback);
                },
                send: msg => sendMsg(channel, msg),
                part: () => {
                    callbacks.forEach(({name, call}) => {
                        off(name + h(channel), call);
                    });
                    return part(channel);
=======
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
>>>>>>> origin/master
                }
            };
        };
        const part = channel => ws.send('PART ' + h(channel));
        const sendMsg = (channel, msg) => ws.send(
            'PRIVMSG ' + h(channel) + ' :' + msg
        );
        const sendWhisper = (user, msg) => ws.send(
            'PRIVMSG #jtv :/w ' + user.trim() + ' ' + msg
        );

        const commands = {};

        commands.JOIN = message => {
            log(1, 'User joined:', message.chatroom, message.user);
            fire('join', message.chatroom, message.user);
            fire('join#' + message.chatroom, message.user);
            if (that.connected.indexOf(message.chatroom) === -1) {
                that.connected.push(message.chatroom);
            }
            return message;
        };
        commands.PART = message => {
            log(1, 'User left:', message.chatroom, message.user);
            fire('part', message.chatroom, message.user);
            fire('part#' + message.chatroom, message.user);

            const index = that.connected.indexOf(message.chatroom);
            that.connected.splice(index, 1);
            return message;
        };
        commands['CAP * LS'] = message => {
            message.capibilities = message.message.split(' ');
            log(1, 'Available Capabilities:', message.capibilities);

<<<<<<< HEAD
            ws.send('CAP REQ :' + message.message);

            return message;
        };
        commands['CAP * NAK'] = message => {
            log(1, 'Denied Capabilities:', message.message);
            return message;
        };
        commands['CAP * ACK'] = message => {
            log(1, 'Accepted Capabilities:', message.message);
            return message;
        };
        commands.MODE = message => {
            message.user = message.message.trim().split(' ')[1];
            message.message = message.message.trim().split(' ')[0];

            log(1, 'Mode:', message.chatroom, message.user, message.message);
            fire('mode', message.chatroom, message.user, message.message);
            fire('mode#' + message.chatroom, message.user, message.message);
            return message;
        };
        commands.ROOMSTATE = message => {
            log(1, 'roomstate:', message.chatroom, message);
            fire('roomstate', message.chatroom, message);
            fire('roomstate#' + message.chatroom, message);
            return message;
        };
        commands.USERSTATE = message => {
            log(1, 'userstate:', message.chatroom, message);
            fire('userstate', message.chatroom, message);
            fire('userstate#' + message.chatroom, message);
            return message;
        };
        commands.PRIVMSG = message => {
            if (message.action) {
                log(1, 'action', message.chatroom, message.user, ':' + message.message);
                fire('action', message.chatroom, message.user, message.message, message);
                fire('action#' + message.chatroom, message.user, message.message, message);
            } else {
                log(1, 'message', message.chatroom, message.user, ':' + message.message);
                fire('message', message.chatroom, message.user, message.message, message);
                fire('message#' + message.chatroom, message.user, message.message, message);
            }
            return message;
        };
        commands.CLEARCHAT = message => {
            if (message.message) {
                // User timed out
                if (message['ban-duration']) {
                    log(1, 'Timed:', message.chatroom, ':' + message.message, '-', message['ban-duration']);
                    fire('usertimed', message.chatroom, message.message, message['ban-duration'], message);
                    fire('usertimed#' + message.chatroom, message.message, message['ban-duration'], message);
                } else {
                    log(1, 'Banned:', message.chatroom, ':' + message.message);
                    fire('userban', message.chatroom, message.message, message);
                    fire('userban#' + message.chatroom, message.message, message);
=======
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
>>>>>>> origin/master
                }
            } else {
                log(1, 'clearchat', message.chatroom);
                fire('clearchat', message.chatroom);
                fire('clearchat#' + message.chatroom);
            }
            return message;
        };
        commands.WHISPER = message => {
            log(1, 'whisper', message.channel, message.user, ':' + message.message);
            fire('whisper', message.channel, message.user, message.message, message);
            return message;
        };
        commands.ERROR = message => {
            log(1, 'relayerror', message.channel, ':' + message.message);
            fire('relayerror', message.channel, message.message);
            return message;
        };
        commands.BOTNICK = message => {
            that.username = message.channel;
            log(1, 'botnick', message.channel);
            fire('botnick', message.channel);
            return message;
        };
        commands.NOTICE = message => {
            log(1, 'notice', message.chatroom, ':' + message.message);
            fire('notice', message.chatroom, message.message, message);
            fire('notice#' + message.chatroom, message.message, message);
            return message;
        };
        commands.PING = message => {
            ws.send('PONG :' + message.message);
            log(1, 'ping');
            return message;
        };

        function processMessage(message) {
            fire('raw', message.raw);

            const command = commands[message.command];
            if (typeof command === 'function') {
                message = command(message);
            } else if (/\d{0,3}/.test(message.command)) {
                // Welcome
                log(1, 'Welcome:', message.command, ':' + message.message);
                fire('welcome', message.command, message.message);
            } else {
                console.error('Unknown commands', message);
            }

            log(2, message);
            // Emits the 'all' event
            fire('all', message);
        }
<<<<<<< HEAD
=======
    };
    ws.onclose = () => fire("close");
>>>>>>> origin/master

        ws.addEventListener('open', () => {
            // Web Socket is connected, send data using send()
            ws.send('PASS ' + auth);
            ws.send('NICK ' + nick);

<<<<<<< HEAD
            // Request all capibilities
            ws.send('CAP LS');
=======
    this.raw = wsSend;
    this.send = send;
    this.whisper = whisperTo;
>>>>>>> origin/master

            if (Array.isArray(options.channels)) {
                options.channels.forEach(join);
            }
        });
        ws.addEventListener('message', event => {
            event.data.split('\n')
                .map(e => e.trim())
                .filter(e => e)
                .map(parseMessage)
                .forEach(processMessage);
        });
        ws.onclose = () => fire('close');

        this.username = nick;
        this.connected = [];

        this.raw = ws.send;
        this.send = sendMsg;
        this.whisper = sendWhisper;

        this.join = join;
        this.part = part;

        this.on = on;
        this.off = off;
        this.close = () => ws.close();
    }

<<<<<<< HEAD
    if (this.constructor.name === 'Window') {
        window.tmi = TwitchMessageInterface;
    } else {
        module.exports = TwitchMessageInterface;
    }
})();
=======
    this.on = on;
    this.close = () => ws.close();
};
>>>>>>> origin/master
