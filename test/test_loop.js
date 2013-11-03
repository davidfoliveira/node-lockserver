var
	LockServer = require('../lib/lockserver').Client,
	lockserver = new LockServer({host: "127.0.0.1", DEBUG: true}),
	locks = 0;

function zlock(){

	if ( locks++ < 50000 ) {
		lockserver.lock("stuff",function(unlock){
			console.log("I am running");
			unlock();
			return setImmediate(zlock);
		});
	}
	else
		process.exit(0);
}

zlock();
