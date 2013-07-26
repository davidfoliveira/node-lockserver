# lockserver: A service for managing access to distributed and shared resources

`lockserver` is a node.js easy-to-use centralized locking server for helping distributed application managing access to shared resources.

# Installing

	npm install lockserver

# Running lock server

Running lockserver daemon:

	node node_modules/lockserver/bin/lockd.js

# Using on clients

Simple use:

	var
	   LockServer = require('../lib/lockserver').Client,
	   lockserver = new LockServer({host: "127.0.0.1"});

	lockserver.lock("stuff",function(unlock,err){
	   if ( err ) return;
	   console.log("I am running 1");
	   setTimeout(function(){
	      unlock();
	   }, 5000);
	});
	lockserver.lock("stuff",function(unlock,err){
	   if ( err ) return;
	   console.log("I am running 2");
	   unlock();
	   process.exit(0);
	});
