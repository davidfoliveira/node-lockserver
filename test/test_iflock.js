var
	LockServer = require('../lib/lockserver').Client,
	lockserver = new LockServer({host: "127.0.0.1", DEBUG: true});

lockserver.lock("stuff",function(unlock){

        console.log("I am running");
        setTimeout(function(){
                unlock();
                process.exit(0);
        }, 3000);

});
lockserver.ifLock("stuff",
	function(){
		console.log("IS LOCKED");
	},
	function(unlock){
		console.log("I am running");
		unlock();
		process.exit(0);
	}
);
