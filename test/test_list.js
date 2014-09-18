var
	LockServer = require('../lib/lockserver').Client,
	lockserver = new LockServer({host: "127.0.0.1", DEBUG: true});

lockserver.lock(["stuff1","stuff2"],function(unlock,err){
	if ( err ) return;
	console.log("I am running 1");
	setTimeout(function(){
		unlock();
	}, 5000);
});
lockserver.lock(["stuff2","stuff1","stuff3"],function(unlock,err){
	if ( err ) return;
	console.log("I am running 2");
	setTimeout(function(){
		unlock();
	}, 2000);
});
lockserver.lock(["stuff3"],function(unlock,err){
	if ( err ) return;
	console.log("I am running 3");
	process.exit(0);
});
