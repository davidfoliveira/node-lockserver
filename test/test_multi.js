var
	LockServer = require('../lib/lockserver').Client,
	lockserver = new LockServer({host: "127.0.0.1", DEBUG: true});

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
	process.exit(0);
});
