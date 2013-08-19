"use strict";

var
	events		= require('events'),
	util		= require('util'),
	net		= require('net'),
	Stream		= require('./stream').Stream,

	CON_RETRYTIME	= 2000,
	DEBUG		= true;


function Client(opts) {

	// Options

	if ( opts == null )
		opts = {};
	else if ( typeof(opts) == "string" )
		opts = { host: opts };

	// Variable properties

	this.host			= opts.host		|| "127.0.0.1";
	this.port			= opts.port		|| 1922;
	this.MAXRETRIES			= opts.MAXRETRIES	|| null;

	// Fixed properties

	this.connected			= false;
	this.retries			= 0;
	this.stream			= null;
	this.sentSomething		= false;

	this.waitingConnect		= [];

	// Data

	this.requests			= {};

	// Methods

	this.lock			= _lock;
	this.ifLock			= _ifLock;
	this._unlock			= _unlock;
	this._requestNewID		= _requestNewID;

	this._clientConnect		= _clientConnect;
	this._clientWaitConnection	= _clientWaitConnection;
	this._clientOnMessage		= _clientOnMessage;
	this._clientOnError		= _clientOnError;
	this._clientOnDisconnect	= _clientOnDisconnect;
	this._send			= _send;
	this._command			= _command;

	// Debug

	DEBUG = opts.DEBUG || false;

	// Connect please!

	this._clientConnect();

}
util.inherits(Client, events.EventEmitter);


// Push data

function _lock(name,opts,handler) {

	var
		self = this;

	if ( typeof(name) != "string" || !name )
		throw new Exception("Invalid lock name");
	if ( typeof(opts) == "function" ) {
		handler = opts;
		opts = { };
	}
	if ( !opts.timeout )
		opts.timeout = 30000;

	// Register lock locally

	var
		id = self._requestNewID();

	_debug("[client] Locking resource "+name+" (got it #"+id+")...");

	self.requests[id] = { name: name, opts: opts, handler: handler };

	// Wait for connection and send it

	return self._clientWaitConnection(function(err){
		if ( err )
			return handler(err,null);

		_debug("[client] Sending lock request #"+id+" on resource "+name);
		return self._command("lock",{name: name, id: id, timeout: opts.timeout, iflock: opts.iflock });
	});

}

function _ifLock(name,opts,lockedHandler,handler) {

	var
		self = this,
		args = Array.prototype.slice.call(arguments, 0, 4);

	name		= args.shift();
	handler		= args.pop();
	lockedHandler	= args.pop();
	opts		= args.shift();
	if ( opts == null )
		opts = {};

	opts.iflock = true;
	opts.ifLockHandler = lockedHandler;

	return self.lock(name,opts,handler);

}

function _unlock(id,handler) {

	var
		self = this,
		req = self.requests[id];

	_debug("[client] Sending unlock request #"+id+" on resource "+req.name);

	if ( handler )
		req.unlockHandler = handler;

	return self._command("unlock",{id: id});

}


// Generate data package ID

function _requestNewID() {

	var
		d = new Date(),
		id;

	do {
		id = "r"+d.getTime().toString() + "." + Math.floor(Math.random()*1001);
	} while ( this.requests[id] != null );

	return id;

}

// Connect

function _clientConnect() {

	var
		self = this;

	this.connected = false;
	self.s = net.connect({host: self.host, port: self.port}, function(){
		_debug("[client] Connected to lockserver");
		self.connected = true;
		self.retries = 0;
		self.stream = new Stream("string",self.s);
		self.stream.on('message',function(m){ self._clientOnMessage(m)   });
		self.stream.on('error',function(err){ self._clientOnError(err)   });
		self.stream.on('close',function(){    self._clientOnDisconnect() });
		self.stream.on('end',function(){      self._clientOnDisconnect() });
		self.emit('connect',null);
	});
	self.s.on('connect',function(){
		while ( self.waitingConnect.length > 0 ) {
			var
				handler = self.waitingConnect.shift();

			handler();
		}
	});
	self.s.on('error',function(err){
		_debug("Connecting error: ",err);
		if ( err.code ) {
			if ( err.code == "ECONNREFUSED" ) {
				_debug("Could not connect to manager. Retrying (#"+self.retries+") in "+CON_RETRYTIME+"ms...");

				self.retries++;
				if ( self.MAXRETRIES == null || self.retries <= self.MAXRETRIES ) {
					return setTimeout(function(){
						return self._clientConnect();
					}, CON_RETRYTIME);
				}
				else {
					_debug("Reached connection retry limit ("+self.MAXRETRIES+"). Giving up...");
					self.emit('connect',err);
				}
			}
		}
		else {
			_debug("[client] No error code, ignoring by logging: "+err.toString());
		}
	})

}

// Wait for connection

function _clientWaitConnection(handler) {

	if ( this.connected )
		return handler();

	return this.waitingConnect.push(handler);

}

// On message

function _clientOnMessage(msg) {

	var
		self = this,
		m;

	try {
		m = JSON.parse(msg.toString('utf8'));
	}
	catch(ex) {
		_debug("[client] Is comrade manager drunk or what? Got invalid JSON. Ignoring message: ",ex);
		return;
	}

	// Answer to my requests

	if ( m.command == "answer" ) {
		if ( m.to == "lock" ) {
			if ( m.error ) {
				_debug("[client] Server told that lock request failed because: ",m.error);
				return m.id ? self.requests[m.id].handler(function(){},m.error) : null;
			}

			if ( m.id == null || !self.requests[m.id] ) {
				_debug("[client] Answer to lock without id?? Ignoring...");
				return;
			}

			var
				req = self.requests[m.id];

			// Is locked ?

			if ( m.islocked && req.opts.iflock ) {
				_debug("[client] Server told that resource '"+req.name+"' (request #"+m.id+") is locked. waiting...");
				return req.opts.ifLockHandler();
			}

			// Is ok ?

			if ( !m.ok ) {
				_debug("[client] Server told about request #"+m.id+" that is not ok.. don't know what to do.");
				return;
			}

			_debug("[client] Server told that request #"+m.id+" is authorized to run!");

			return req.handler(function(handler){
				return self._unlock(m.id,handler);
			},null);

		}
		else if ( m.to == "unlock" ) {
			if ( m.error || !m.ok ) {
				_debug("[client] Server told that unlock was not ok.. Don't know what to do. Error: ",m.error);
			}
			if ( m.id == null || !self.requests[m.id] ) {
				_debug("[client] Answer to an unlock without id?? Ignoring...");
				return;
			}

			var
				unlockHandler = self.requests[m.id].unlockHandler;

			delete self.requests[m.id];
			return unlockHandler ? unlockHandler(m.error,null) : null;
		}
		return self._send({error: { code: "EUNKNANS", description: "Answer to an unknown command", command: m.to } });
	}

	_debug("[client] Error:\t",{ code: "EUNKNCMD", description: "Unknown command", command: m.command });
//	return self._send({error: { code: "EUNKNCMD", description: "Unknown command", command: m.command } });

}



// Client error

function _clientOnError() { }

// On disconnect

function _clientOnDisconnect() {

	if ( !this.connected )
		return;

	_debug("Connection reset by server");
	this.connected = false;

	return this._clientConnect();

}



// Tell things to a manager

function _send(obj,handler) {
	if ( !this.connected )
		return;
	return this.stream.sendMessage(JSON.stringify(obj),handler);
}
function _command(command,args,handler) {
	var
		o = args || { };

	o.command = command;
	this._send(o,handler);
}

// Debug

function _debug() {

	if ( !DEBUG )
		return;

	var
		args = [_nsec([])];

	for ( var x = 0 ; x < arguments.length ; x++ )
		args.push(arguments[x]);

	console.log.apply(null,args);

}

function _nsec(start) {

	var
		diff = process.hrtime(start);

	return (diff[0] * 1e9 + diff[1]) / 1000000;

}


// Myself exported

module.exports = Client;
