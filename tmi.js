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

        tags.is = type => hasBadge(tags.badges, type);

        if (tags.slow) {
            tags.slow = parseInt(tags.slow, 10);
        }
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

            listeners.forEach(ear => {
                ear(...args);
            });
        }

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

        ws.addEventListener('open', () => {
            // Web Socket is connected, send data using send()
            ws.send('PASS ' + auth);
            ws.send('NICK ' + nick);

            // Request all capibilities
            ws.send('CAP LS');

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

    if (this.constructor.name === 'Window') {
        window.tmi = TwitchMessageInterface;
    } else {
        module.exports = TwitchMessageInterface;
    }
})();
