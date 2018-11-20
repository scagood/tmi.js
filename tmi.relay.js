const WebSocket = require('ws');

const request = require('request');

const options = require('./relay.json');

const clients = new WebSocket.Server({port: options.port || 80});

const twitchURL = 'ws://irc-ws.chat.twitch.tv:80/';

const log = options.log || false;
const proxy = options.proxy || false;
const relay = options.relay || false;
const mainHost = options.host || 'unknown.host';

const bots = options.bots || {};

const _relay = {
    name: 'justinfan' + Math.floor(Math.random() * 999999),
    host: mainHost,
    auth: 'blah',
    users: true
};

// 'bots' defaults
if (typeof bots._default === 'string' && typeof bots[bots._default] !== 'undefined') {
    bots._default = bots[bots._default];
}
if (typeof bots._default === 'undefined') {
    if (Object.keys(bots).length === 0) {
        bots._default = _relay;
    } else {
        bots._default = bots[Object.keys(bots)[0]];
    }
}
bots._relay = _relay;

const jtvRegex = /^justinfan\d{1,6}$/ig;
const nickRegex = /^[a-z0-9]\w*$/ig;

function rateLimit(limitCount, limitInterval, fn) {
    const fifo = [];

    // Count starts at limit
    // each call of `fn` decrements the count
    // it is incremented after limitInterval
    let count = limitCount;

    function next(args) {
        setTimeout(() => {
            if (fifo.length > 0) {
                next();
            } else {
                count += 1;
            }
        }, limitInterval);

        const call = fifo.shift();

        // If there is no next item in the queue
        // and we were called with args, trigger function immediately
        if (!call && args) {
            fn.apply(args[0], args[1]);
            return;
        }

        fn.apply(call[0], call[1]);
    }

    return function (...args) {
        const ctx = this;
        if (count <= 0) {
            fifo.push([ctx, args]);
            return;
        }

        count -= 1;
        next([ctx, args]);
    };
}
function connectionLog(type, ...args) {
    console.log(type, ...args);
}
function getAddress(client) {
    let address = client.upgradeReq.headers['x-forwarded-for'];

    if (typeof address !== 'undefined') {
        address = address.split(',').shift();
    }
    if (typeof address === 'undefined') {
        address = client.upgradeReq.headers['client-id'];
    }

    if (typeof address === 'undefined') {
        address = client.upgradeReq.connection.remoteAddress;
    }
    return address;
}
function confirmUser(PASS, NICK, callback) {
    try {
        request('https://api.twitch.tv/kraken/?oauth_token=' + PASS, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                const json = JSON.parse(body);
                if (json.token.valid === true && json.token.user_name === NICK) {
                    callback(true);
                } else {
                    callback(false);
                }
            } else {
                callback(false);
            }
        });
    } catch (error) {
        callback(false);
    }
}
function connBot(client, botNick) {
    // Connect to twitch
    const twitch = new WebSocket(twitchURL);
    const address = getAddress(client);
    let pass = false;
    let nick = false;
    let count = 0;
    const toWrite = [];
    let through = false;
    let connected = true;

    const bot = bots[botNick];

    const readonly = jtvRegex.exec(bot.name) !== null;

    // Default bot options
    bot.host = bot.host || (bot.name + '.bot.' + mainHost);
    bot.cmds = bot.cmds || [];
    bot.users = bot.users || [];

    const twitchSend = rateLimit(20, 30 * 1000, msg => {
        if (log) {
            console.log('t->', msg);
        }
        try {
            twitch.send(msg);
        } catch (error) {
            console.error(error);
        }
    });

    function toTwitch(raw) {
        twitchSend(raw);
    }
    function toClient(raw) {
        if (connected) {
            if (log) {
                console.log('c->', raw);
            }
            try {
                client.send(raw);
            } catch (error) {
                console.error(error);
            }
        }
    }

    // Immediately send and RNICK command for 'Relay Nickname'
    toClient(':' + bot.host + ' BOTNICK ' + bot.name);

    const clientCommands = {};
    clientCommands.PASS = message => {
        pass = message.split(':')[1];
    };
    clientCommands.NICK = message => {
        nick = message.split(' ')[1];
        confirmUser(pass, nick, success => {
            if (success === false) {
                toClient(`:${bot.host} ERROR ${bot.name} :Please check your username, oauth and scopes`);
                connectionLog('Bot - Fail:', nick, address);
                client.close();
                twitch.close();

                return;
            }

            if (bot.users === true || bot.users.indexOf(nick) !== -1) {
                connectionLog('Bot - Pass:', nick, address);

                toTwitch('PASS ' + (bot.auth[5] === ':' ? bot.auth : ('oauth:' + bot.auth)));
                toTwitch('NICK ' + bot.name);

                through = true;

                toWrite.forEach(toTwitch);
                return;
            }

            connectionLog('Bot - Auth:', nick, address);
            toClient(`:${bot.host} ERROR ${bot.name} :'${nick}' is not allowed to use '${bot.name}'`);
            client.close();
            twitch.close();
        });
    };
    clientCommands.JOIN = message => {
        const [command, target] = message.split(' ');
        if (target !== '#' + nick) {
            return toClient(`:${bot.host} ERROR ${bot.name} :You can only ${command} your own channel`);
        }

        (through ? toTwitch : toWrite.push)(message);
    };
    clientCommands.PART = clientCommands.JOIN;
    clientCommands.PRIVMSG = message => {
        if (readonly) {
            return toClient(`:${bot.host} ERROR ${bot.name} :You're in read only mode`);
        }

        let [, target, command] = message.split(' ');
        if (target !== '#' + nick) {
            return toClient(`:${bot.host} ERROR ${bot.name} :You can only PRIVMSG your own channel`);
        }

        // If it's not a command
        if (['.', '/'].includes(command[1]) === false) {
            return (through ? toTwitch : toWrite.push)(message);
        }

        command = command.slice(2).toLowerCase();

        // Help command
        if (command === 'help') {
            const commands = ['help', bot.cmds]
                .map(cmd => `'/${cmd}'`)
                .join(', ');

            return toClient(`:${bot.host} ERROR ${bot.name} :Commands that ${bot.name} allows: ${commands}`);
        }

        // Allowed command
        if (bot.cmds.includes(command)) {
            return (through ? toTwitch : toWrite.push)(message);
        }

        // Unknown command
        toClient(`:${bot.host} ERROR ${bot.name} :That command '/${command}' is not allowed!`);
    };
    clientCommands.CAP = message => (through ? toTwitch : toWrite.push)(message);
    clientCommands.PING = clientCommands.CAP;
    clientCommands.PONG = clientCommands.CAP;

    function serverIn(message) {
        if (log) {
            console.log('<-t', message);
        }

        if (message.split(':')[1].split(' ')[1] !== 'WHISPER') {
            toClient(message);
        }
    }
    function clientIn(message) {
        if (log) {
            console.log('<-c', message);
        }
        const [command] = message.split(' ');
        if (
            (count === 0 && command !== 'PASS') ||
            (count === 1 && command !== 'NICK')
        ) {
            toClient(':' + bot.host + ' ERROR ' + bot.name + ' :Send PASS first then NICK second, nothing before!');
            connectionLog('Bot - Order:', nick, pass, address);
            client.close();
            twitch.close();
        } else if (typeof clientCommands[command] === 'function') {
            clientCommands[command](message);
        } else {
            toClient(`:${bot.host} ERROR ${bot.name} :'${bot.name}' doesn't know the command '${command}'!`);
            if (log) {
                console.log(`Unknown command: '${command}'`);
            }
        }

        count++;
    }

    // Ingest messages and split into lines
    twitch.on('message', msgs => {
        let a;
        msgs = msgs.replace('\r', '').split('\n');
        for (a = 0; a < msgs.length; a++) {
            if (msgs[a].trim() !== '') {
                serverIn(msgs[a].trim());
            }
        }
    });
    client.on('message', msgs => {
        let a;
        msgs = msgs.replace('\r', '').split('\n');
        for (a = 0; a < msgs.length; a++) {
            if (msgs[a].trim() !== '') {
                clientIn(msgs[a].trim());
            }
        }
    });

    // Close both sockets on one closing.
    client.on('close', () => {
        twitch.close();
        connected = false;
    });
    twitch.on('close', () => {
        client.close();
        connected = false;
    });
}
function connRaw(client) {
    const address = getAddress(client);
    const upstream = new WebSocket(twitchURL);
    let piped = false;
    const blockage = [];
    const upstreamSend = rateLimit(20, 30 * 1000, msg => {
        upstream.send(msg);
    });

    function pushUpstream(raw) {
        upstreamSend(raw);
    }
    function toServer(raw) {
        if (raw === true) {
            piped = true;
            for (let a = 0; a < blockage.length; a++) {
                pushUpstream(blockage[a]);
            }
        } else if (piped) {
            pushUpstream(raw);
        } else {
            blockage[blockage.length] = raw;
        }
    }

    upstream.on('open', () => {
        connectionLog('Raw - Open:', address);
        toServer(true);
        upstream.on('message', raw => {
            client.send(raw);
        });
    });

    upstream.on('error', e => {
        connectionLog('Raw - Error:', address);
        client.send(e.toString());
        client.close();
    });

    client.on('message', toServer);

    // Close both streams
    client.on('close', () => {
        upstream.close();
    });
    upstream.on('close', () => {
        client.close();
    });
}
function connClass(client) {
    const url = client.upgradeReq.url.slice(1);
    if (url === '~proxy') {
        if (proxy === true) {
            // Proxy mode is enabled
            connRaw(client, twitchURL);
        } else {
            // Proxy mode is disabled
            connectionLog('Proxy - Fail:', getAddress(client));
            client.send(':proxy.' + mainHost + ' ERROR client :Raw proxying is disabled');
            client.close();
        }
    } else if (url === '~relay') {
        if (relay === true) {
            // Relay mode is enabled
            connBot(client, '_relay');
        } else {
            // Relay mode is disabled
            connectionLog('Relay - Fail:', getAddress(client));
            client.send(':relay.' + mainHost + ' ERROR client :Raw relaying is disabled');
            client.close();
        }
    } else if (url === '') {
        // Intercede via default bot
        connBot(client, '_default');
    } else if (nickRegex.exec(url)) {
        // Intercede via given bot name

        if (Object.keys(bots).indexOf(url) > -1) {
            // Given bot is known
            connBot(client, url);
        } else {
            // Unknown bot
            connectionLog('Bot - Unknown:', getAddress(client));
            client.send(':bots.' + mainHost + ' ERROR client :Unknown bot requested: \'' + url + '\'');
            client.close();
        }
    } else {
    // Unknown request
        connectionLog('Unknown:', getAddress(client));
        client.send(':bots.' + mainHost + ' ERROR client :Unknown request: \'' + url + '\'');
        client.close();
    }
}
clients.on('connection', connClass);
