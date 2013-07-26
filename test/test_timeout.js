var
	LockServer = require('../lib/lockserver').Client,
	lockserver = new LockServer({host: "127.0.0.1", DEBUG: true});

lockserver.lock("stuff",function(unlock,err){
	if ( err ) {
		console.log("Error locking or waiting for lock 1: ",err);
		return;
	}

	console.log("I am running #1");
	setTimeout(function(){
		unlock();
	}, 5000);

});
lockserver.lock("stuff",{ timeout: 1000 },function(unlock,err){
	if ( err ) {
		console.log("Error locking or waiting for lock 2: ",err);
		process.exit(0);
		return;
	}

	console.log("I am running #2");
	unlock();
	process.exit(0);

});
