var
	LockServer = require('../lib/lockserver').Client,
	lockserver = new LockServer({host: "127.0.0.1", DEBUG: true});

lockserver.lock(["1"],function(unlock,err){
	if ( err ) return;
	console.log("I am running 1");
	setTimeout(function(){
		unlock();
	}, 10000);
});


setTimeout(function(){

	lockserver.lock(["2","1"],function(unlock,err){
		if ( err ) return;
		console.log("I am running 3");
		return unlock();
	});


	lockserver.lock(["1","2"],function(unlock,err){
		if ( err ) return;
		console.log("I am running 2");
		setTimeout(function(){
			unlock();
		}, 2000);
	});



}, 1000);
