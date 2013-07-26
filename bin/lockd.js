#!/usr/bin/env node

var
	Server = require('../lib/lockserver').Server,
	server = new Server({});

server.start();
