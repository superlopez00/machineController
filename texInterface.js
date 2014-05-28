"use strict";

var printf = require("printf");
var when = require("when");
//var when2 = require("when");
var utils = require("./utils.js");
var fs = require('fs');
var ftp = require('ftp');

var ftpResultMsg="ftp not connected";

var ftpReady=false;
var globalRequests=0;

var myFTP=new ftp();
myFTP.on('ready', function(err) { console.log("ftpReady "); ftpResultMsg="ftpReady";
    ftpReady=true;

/*    myFTP.put("C:\\gcodeGrande.iso", "G:\\pff.iso", function(err) {
        console.log(err.msg);
        //if (err) throw err;
         });*/

});
myFTP.on('connect', function(err) { console.log("ftpConnecting ");  ftpReady=false;});
myFTP.on('close', function(err) { if(err && err.msg) console.log("ftpClosed: " + err.msg);
                                  else console.log("ftpClosed!"); ftpReady=false;});
myFTP.on('end', function(err) { if(err && err.msg) console.log("ftpEnd " + err.msg);
                                else console.log("ftpEnd!"); ftpReady=false;});
myFTP.on('data', function(chunk) { if(chunk && chunk.length) console.log("ftpData: " + chunk.length); });
myFTP.on('error', function(err) { if(err && err.msg) console.log("ftpError: " + err.msg);
                                  else console.log("ftpError!");  ftpReady=false;});
myFTP.on('timeout', function() { console.log("ftpTimeout"); myFTP.abort(); ftpReady=false;});
myFTP.on('finish', function() { console.log("finish"); });

//myFTP.connect( {host: "192.168.0.200", user: "Tex_Super_User", password: "0546" } );


////////////////////////
// creo el directorio temp para guardar los temporales...
var pathTemp=require('path').dirname(require.main.filename)+"\\temp";
fs.exists(pathTemp, function (exists) {
    if(exists==false)
        fs.mkdir(pathTemp);
    else
    {
        fs.readdir(pathTemp, function(err, files) {
            if (err) {
                console.log(JSON.stringify(err));
            } else {
                for (var i=0;i<files.length;i++)
                {
                    var filePath = pathTemp + "\\" + files[i];
                    var stats=fs.statSync(filePath);
                    if (stats.isFile())
                        fs.unlinkSync(filePath);
                }
            }
        });
    }
});
///////////////////////


// aqui creo el objeto jobInfo
function JobInfo(){
    this.jobName="";
    this.jobParams={};
    this.internalJobName="";
    this.created="";
    this.fileMilling=0;
    this.filesSended=0;
    this.filesToSend=0;
    this.curLine=0;
    this.status='none';
    return this;
}

function TexJobInfo(){
    this.fileMilling=0;
    this.filesToMill=0;
    this.curLine=0;
    this.curProgName="";
    return this;
}

function texInterface(){
	this.status="start";
	this.connStatus='closed';
	this.transQueue=[];
	this.maxTSize=0;
    //////////////////////////////
    this.initOptions={};
    //////////////////////////////
    this.interval=0;
	this.manualInterval=undefined;
    this.globals={};
    this.transmissionInfo={};
    this.globals.nrequest=0;
    this.jobQueue=[];
    this.curJob=new JobInfo();
    this.texCurJob=new TexJobInfo();
    ///////////////////////////////
    this.popJobWhenMilling=false;
    this.sendindStatus="none";
    this.currentJobName="";
    this.filesSended=0;
    this.filesToSend=0;
    this.ftpCurProgress=0;
    this.curCommand="";
}


/**
options:{
	host: // host al que conectarse. Direccion ip o nombre
	port: // puerto. Por defecto el 6000
	ftpPort: // puerto del ftp
	ftpUser: // usuario del ftp
	ftpPass: // password del ftp
	}
*/
texInterface.prototype.open=function(options,callback){
	console.log("TexOptions ",options);
	if (!options)
		options={};
	console.log("opening interface");
	this.options=options;
	this.host=options.host||"192.168.0.200";
	this.port=options.port||6000;
	this.ftpUser="Tex_Super_User";
    this.ftpPass="0546";
	this.startConnection();


};


texInterface.prototype.checkConnection=function(){
	var yo=this;
	switch(yo.connStatus){
        case 'closed':
            yo.connStatus='connecting';
			setTimeout(function(){yo.startConnection()},0);
            return false;
		case 'connecting':
            return false;
        case 'waitAck':
            return false;
        case 'ready':
            return true;
        case 'error':
            return false;
	}
    // solo true si esta ready
    return true;
};


texInterface.prototype.closeConnection=function(){
    var yo=this;
    console.log('Closing tex conexions');

    yo.popJobWhenMilling=false;

	if(yo.interval!=undefined)
		clearInterval(yo.interval);
	if(yo.manualInterval!=undefined)
		clearInterval(yo.manualInterval);
    yo.tcpClient.end();
    if(myFTP.connectStatus()=='open')
        myFTP.abort();
    myFTP.end();
    yo.tcpClient.destroy();
}

texInterface.prototype.startConnection=function(){
	var net = require('net');

	var HOST = this.host;
	var PORT = this.port;
	
	var yo=this;
    yo.status="start";
    yo.connStatus="connecting";

	var client = new net.Socket();
    client.setTimeout(2000);
    console.log('Connecting to tex...');
	client.connect(PORT, HOST, function() {
		console.log('CONNECTED TO: ' + HOST + ':' + PORT);
		yo.connStatus="waitAck";
		client.write('15','hex');
        yo.curCommand="waitAck";
    });

	// Add a 'data' event handler for the client socket
	// data is what the server sent to this socket
	client.on('data', function(data) {
		switch(yo.connStatus){
            case 'waitAck':
                // si estoy a la espera de recibir ack pero no lo recibo...
				if (data.length!=1 || data.readUInt8(0)!=6){
					client.destroy();
					yo.connStatus="closed";
                    yo.curCommand="waitAck";
				}else
				{
					yo.connStatus="ready";
                    yo.status="ready";
                    yo.texStatus="ok";
                    yo.texLastMsg="";
                    console.log("tex ready");
                    yo.curCommand="ready";
					console.log("connecting to ftp with host: "+yo.host);
                    myFTP.connect( {host: yo.host, user: yo.ftpUser, password: yo.ftpPass } );
                    // Aqui pongo los comandos de depuracion para comprobar que van
				}
				break;
			case 'ready':
				if (yo.transQueue.length>0){
					var peticion=yo.transQueue[0];
					if (peticion.callback)
						peticion.callback(data);
					yo.transQueue=yo.transQueue.splice(1);
					yo.sendNow();
				}
				break;
			
		}
		// Close the client socket completely
//
		
	});

	// Add a 'close' event handler for the client socket
	client.on('close', function() {
	// Enviar error en el callback de error. esto tenemos que verlo
		console.log('Closed: Connection closed');
		yo.transQueue=[];
		yo.connStatus='closed';
        yo.status="closed";
        yo.curCommand="";
        if(myFTP.connectStatus()=='open')
            myFTP.abort();
        myFTP.end();
        client.destroy();
        //yo.checkConnection();
	});
	client.on('error',function(){
		console.log("Connection error");
		yo.transQueue=[];
		yo.connStatus='error';
        yo.status="error";
		//yo.checkConnection();
	});

    client.on('timeout',function(){
        console.log("CurCommand: " + yo.curCommand + " - ConnStatus:" + yo.connStatus);

        console.log('Tex Socket Timeout');
        // comento esto porque da problemas
        /*yo.transQueue=[];
        yo.connStatus='closed';
        yo.status="closed";
        yo.curCommand="";
        if(myFTP.connectStatus()=='open')
            myFTP.abort();
        myFTP.end();
        client.destroy();*/
    });

	this.tcpClient=client;
};


/*texInterface.prototype.clearJobs=function(callback){
    var yo=this;
    yo.jobQueue=[];

    var result={};
    result.msg="ClearJob Queue OK";
    callback(result);
};*/

texInterface.prototype.clearJobs=function(callback){
    var yo=this;
    yo.jobQueue=[];

    yo.curJob=new JobInfo();
    yo.setVar('V',"980",100);

    var result={};
    result.msg="ClearJob Queue OK";
    callback(result);
};


texInterface.prototype.getFtpStatus=function(){
    var ftpStatus={};
    ftpStatus.connectStatus=myFTP.connectStatus();
    ftpStatus.ftpCurProgress=this.ftpCurProgress;
    ftpStatus.ftpResultMsg=ftpResultMsg;
    return ftpStatus;
};

/*texInterface.prototype.iteraAutomata=function(){
    // miro las globals...
    var yo=this;

    // compruebo conexion con tex
    if(yo.checkConnection()==false)
    {
        yo.globals={};
        yo.globals.gstatus="error";
        return;
    }

    // el tex esta conectado.. pido las globals...
    yo.getTexGlobals();

    // si el ftp no esta conectado... reconecto.
    if(myFTP.connectStatus()=='closed')
    {
        console.log("trying conecting with FTP...");
        ftpResultMsg="trying conecting with FTP...";
        myFTP.connect( {host: yo.host, user: yo.ftpUser, password: yo.ftpPass } );
        return;
    }
    // y me espero a que finalize
    else if (myFTP.connectStatus()=='opening')
    {
        console.log("opening ftp...");
        ftpResultMsg="opening Ftp...";
        return;
    }

    // compruebo si las globals son validas o han cambiado
    if(globalRequests<yo.globals.nrequest)
        globalRequests=yo.globals.nrequest;
    else return;
    if(yo.globals.gstatus!='ok')
        return;

    // esta perfecto pues a procesar el status...
    var v980=100;
    switch(yo.status)
    {
        case "closing":
            console.log("closing!!");
            yo.jobQueue=[];
            yo.closeConnection();
            break;


        case "ready":

            v980=parseInt(yo.globals.v980);

            if(v980==100 && yo.jobQueue.length>0 && ftpReady==true)  // 20131009: solo entramos en envio si el ftp esta ready
            {
                yo.curJob=new JobInfo();
                yo.status="sendingFile";
                yo.sendindStatus="waitingReadyToSend";
                console.log("change to sending file");
            }

            // 20131009: si v980 no es 100 y tengo cosas para fresar y el ftp esta ready
            // pongo el mensaje
            if(yo.initOptions.texOptimize==true)
            {
                if(v980!=100 && yo.jobQueue.length>0 && ftpReady==true)
                {
                    ftpResultMsg="Machine working or still not finish current jog. Please wait and send again!";
                    // borramos el job y cerramos el chirinquito
                    yo.status="closing";
                    break;
                }
            }

            if(yo.popJobWhenMilling==true && v980>0 && v980<100)
            {
                if(yo.jobQueue.length>0)
                {
                    yo.curJob=yo.jobQueue[0];
                    yo.curJob.status="milling";
                    yo.jobQueue.shift();
                    console.log("pop job");
                }
                yo.popJobWhenMilling=false;
            }

            if(v980>0 && v980<100)
                yo.curJob.fileMilling=v980;
            else if (v980==100)
                yo.curJob=new JobInfo();

            break;
        case "sendingFile":
            switch(yo.sendindStatus)
            {
                case "waitingReadyToSend":
                {
                    v980=parseInt(yo.globals.v980);
                    if(v980==100 && yo.jobQueue.length>0)
                    {
                        yo.currentJobName="file"+yo.jobQueue[0].created;
                        yo.jobQueue[0].status="sending";
                        yo.sendindStatus="startSending";
                        yo.filesSended=0;
                        yo.filesToSend=yo.jobQueue[0].filesToSend;
                        console.log("start sending");
                    }
                }
                    break;

                case "startSending":
                {
                    var fname=pathTemp+"\\"+yo.currentJobName+printf("_%d.iso",yo.filesSended+1);
                    var rname=printf("G:\\iso%d.iso",yo.filesSended+1);

                    console.log("sending "+ rname);
                    myFTP.on('progress',function(progress) {
                        yo.ftpCurProgress=progress;
                    });
                    yo.ftpCurProgress=0;
                    myFTP.put(fname, rname,function(err) {
                        // Ha fallado el envio del fichero
                        if (err)
                        {
                            ftpResultMsg=err.msg;
                            console.log(err.msg);
                            yo.jobQueue=[];
                            yo.curJob=new JobInfo();
                            yo.filesToSend=0;
                            yo.filesSended=0;
                            yo.ftpCurProgress=0;
                            yo.setVar('V',"980",100);
                        }
                        else
                        {
                            ftpResultMsg="sent " + fname;
                            yo.sendindStatus="sent";
                            console.log("sent!");
                            yo.ftpCurProgress=100;
                        }
                    });
                    yo.sendindStatus="sending";

                }
                    break;

                case "sending":
                    break;

                case "sent_wait_V980":
                    v980=parseInt(yo.globals.v980);
                    if(v980!=100)
                    {
                        // ya hemos terminado... volvemos al ready
                        if(yo.filesSended>=yo.filesToSend)
                        {
                            console.log("no more to send...again to ready!");
                            yo.sendindStatus="none";
                            yo.status="ready";
                            yo.filesToSend=0;

                            // 20131009: borramos la cola y cerramos el chirinquito.
                            if(yo.initOptions.texOptimize==true)
                            {
                                yo.curJob=yo.jobQueue[0];
                                yo.curJob.status="milling";
                                yo.status="closing";
                            }
                        }
                        else
                        {
                            yo.sendindStatus="startSending";
                        }
                    }

                    break;
                case "sent":
                    // notifico el envio completado al tex...
                    if(yo.jobQueue.length>0)
                        yo.jobQueue[0].filesSended++;
                    yo.filesSended++;
                    yo.setVar('V',"981",yo.filesSended);
                    console.log("sended!!");

                    // es el primero que ha enviado.. con lo que marco ok en el tex y la variable para desencolar
                    v980=parseInt(yo.globals.v980);
                    if(v980==100)
                    {
                        yo.setVar('V',"980",0);
                        yo.popJobWhenMilling=true;
                        if(yo.jobQueue.length>0)
                            yo.jobQueue[0].status="readyToMill";
                        console.log("its the first!");

                    }
                    // 20131010:
                    yo.sendindStatus="sent_wait_V980";

                    // ya hemos terminado... volvemos al ready
                    break;
            }
            break;
    }
};
*/
texInterface.prototype.iteraAutomata=function(){
    // miro las globals...
    var yo=this;

    // compruebo conexion con tex
    if(yo.checkConnection()==false)
    {
        yo.globals={};
        yo.globals.gstatus="error";
        return;
    }

    // el tex esta conectado.. pido las globals...
    yo.getTexGlobals();

    // si el ftp no esta conectado... reconecto.
    if(myFTP.connectStatus()=='closed')
    {
        console.log("trying conecting with FTP...");
        ftpResultMsg="trying conecting with FTP...";
        myFTP.connect( {host: yo.host, user: yo.ftpUser, password: yo.ftpPass } );
        return;
    }
    // y me espero a que finalize
    else if (myFTP.connectStatus()=='opening')
    {
        console.log("opening ftp...");
        ftpResultMsg="opening Ftp...";
        return;
    }

    // compruebo si las globals son validas o han cambiado
    if(globalRequests<yo.globals.nrequest)
        globalRequests=yo.globals.nrequest;
    else return;
    if(yo.globals.gstatus!='ok')
        return;

    // esta perfecto pues a procesar el status...
    var v980=100;
    switch(yo.status)
    {
        case "closing":
            console.log("closing!!");
            yo.jobQueue=[];
            yo.closeConnection();
            break;


        case "ready":

            v980=parseInt(yo.globals.v980);

            if(v980>0 && v980<100)
                yo.curJob.fileMilling=v980;
            else if (v980==100)
                yo.curJob=new JobInfo();

            break;
    }
};


var firstTimeGlobals=true;

texInterface.prototype.getTexGlobals=function(){
    // Aqui iremos solicitando datos...
    var yo=this;
    var aux;

    var nextGlobals={ };
    nextGlobals.nrequest=yo.globals.nrequest;

    var promises=[];
    promises.push(yo.getMachineParameter(0,0));
    promises.push(yo.getSysVar('S',"0272"));
    promises.push(yo.getSysVar('S',"0004"));
    promises.push(yo.getSysVar('S',"0005"));
    promises.push(yo.getSysVar('S',"0013"));
    promises.push(yo.getSysVar('S',"0336"));
	
	if(!firstTimeGlobals)
	{
		if(yo.globals.cncManualMode==false)
		{
			promises.push(yo.getVar("V","980"));
			promises.push(yo.getVar("V","981"));
			promises.push(yo.getSInfo(10));
			promises.push(yo.getInfoVar('I',105));
		}
	}
	else
	{
		firstTimeGlobals=false;
	}
	
    promises.push(yo.getLastError());
    promises.push(yo.getInputs());
    promises.push(yo.getOutputs());
    promises.push(yo.getOverFeed());
    promises.push(yo.getStatusAxis());
	if(yo.globals && yo.globals.axisNames && yo.globals.axisNames.length>0)
		promises.push(yo.getPosVeloAxis(yo.globals.axisNames));
    promises.push(yo.getJogVeloAxis());



    // cuando todas las promesas se resuelvan entonces asignare las globals...
    when.all(promises).then(function(results){
        for(var i=0;i<results.length;i++)
        {
            if(results[i]!=undefined)
            {
                switch(results[i].what){
                    case "getMachineParameter_0_0":
                        if(results[i].value)
                            nextGlobals.axisNames=results[i].value;
                        break;
                    case "getSInfo10":
                        if(results[i].value)
                            nextGlobals.curProgName=results[i].value;
                        break;
                    case "getSysVarS0004":
                        if( (results[i].value & 0x10) !=0 )
                            nextGlobals.cncEmergency=true;
                        else
                            nextGlobals.cncEmergency=false;
                        break;
                    case "getSysVarS0005":
                        if( (results[i].value & 0x20) !=0 )
                            nextGlobals.cncInError=true;
                        else nextGlobals.cncInError=false;
                        break;
                    case "getSysVarS0013":
                        if( (results[i].value & 0x2000) !=0 )
                            nextGlobals.cncRunning=true;
                        else nextGlobals.cncRunning=false;
                        break;
                    case "getSysVarS0336":
                        if(results[i].value)
                            nextGlobals.cncErrorMsg=results[i].value;
                        break;
                    case "getSysVarS0272":
                        nextGlobals.cncManualMode=false;
                        if(results[i].value)
                        {
                            switch(results[i].value)
                            {
                                case "1": nextGlobals.cncStatus="1 - CNC Stop"; break;
                                case "2": nextGlobals.cncStatus="2 - CNC Confirm"; break;
                                case "3": nextGlobals.cncStatus="3 - CNC Exec"; break;
                                case "4": nextGlobals.cncStatus="4 - CNC Hold"; break;
                                case "10": nextGlobals.cncStatus="10 - CNC Compiling"; break;
                                case "15": nextGlobals.cncStatus="15 - CNC Manual Mode"; nextGlobals.cncManualMode=true; break;
                            }
                        }

                        break;
                    case "getLastError":
                        if(results[i].value)
                            nextGlobals.cncErrorMsg=results[i].value;
                        break;
                    case "getOverFeed":
                        if(results[i].value)
                            nextGlobals.cncOverFeed=results[i].value;
                        break;
                    case "getInputs":
                        if(results[i].value)
                            nextGlobals.cncInputs=results[i].value;
                        break;
                    case "getOutputs":
                        if(results[i].value)
                            nextGlobals.cncOutputs=results[i].value;
                        break;
                    case "getVarV980":
                        if(results[i].value)
                        {
                            nextGlobals.nrequest++;
                            nextGlobals.v980=results[i].value;
                            var v980=parseInt(nextGlobals.v980);
                            if(v980==100)
                                nextGlobals.jobStatus="ready to receive files";
                            else if(v980==0)
                                nextGlobals.jobStatus="ready to mill files";
                            else if(v980>0)
                                nextGlobals.jobStatus="milling files";
                        }
                        break;
                    case "getVarV981":
                        if(results[i].value)
                            nextGlobals.v981=results[i].value;
                        break;
                    case "getInfoVarI105":
                        if(results[i].value)
                            nextGlobals.curIsoLine=results[i].value;
                        break;
                    case "getStatusAxis":
                        if(results[i].value)
                            nextGlobals.statusAxis=results[i].value;
                        break;
                    case "getPosVeloAxis":
                        if(results[i].posAxis)
                            nextGlobals.posAxis=results[i].posAxis;
                        if(results[i].veloAxis)
                            nextGlobals.veloAxis=results[i].veloAxis;
                        break;
                    case "getJogVeloAxis":
                        if(results[i].jogVeloAxis)
                            nextGlobals.jogVeloAxis=results[i].jogVeloAxis;
                        break;
                }
            }
        }
        nextGlobals.gstatus="ok";
        yo.globals=nextGlobals;

        if(nextGlobals.cncManualMode==true && yo.manualInterval==undefined)
		{
			yo.manualInterval=setInterval(function(){yo.processManual();},1000);
		}
		if(nextGlobals.cncManualMode==false && yo.manualInterval!=undefined)
		{
			clearInterval(yo.manualInterval);
			yo.manualInterval=undefined;
		}

        yo.texCurJob.fileMilling=nextGlobals.v980;
        yo.texCurJob.filesToMill=nextGlobals.v981;
        yo.texCurJob.curLine=nextGlobals.curIsoLine;
        if(nextGlobals.v980>0 && nextGlobals.v980<100)
            yo.texCurJob.curProgName=nextGlobals.curProgName;
        else yo.texCurJob.curProgName="";


    },function(results){
        nextGlobals.gstatus="error";
        nextGlobals.results=results;
        yo.globals=nextGlobals;
    });
};


texInterface.prototype.sendNowDelayed=function(){
	if (this.connStatus!='ready'){
		return;
	}
	if (this.transQueue.length==0){ // no tiene sentido
		return;
	}
	var o=this.transQueue[0];
	this.tcpClient.write(o.buffer);
};

texInterface.prototype.sendNow=function(){
/*	
	Ejemplo de funcion Retrasada en javascript
	var self=this;
	setTimeout(function(){self.sendNowDelayed()},1000);*/
    var yo=this;

	if (this.connStatus!='ready'){
        this.texLastMsg="sendNow: not ready";
		return;
	}
	if (this.transQueue.length==0){ // no tiene sentido
		return;
	}
	var o=this.transQueue[0];
	this.tcpClient.write(o.buffer);

};

texInterface.prototype.sendCommand=function(buffer,callback,error){
	this.transQueue.push({buffer:buffer,callback:callback,error:error});
	if (this.transQueue.length>this.maxTSize){
		this.maxTSize=this.transQueue.length;
	}
	if (this.transQueue.length==1){
		this.sendNow();
	}
};

function addStringToArray(str,b){
	for (var i=0; i<str.length; i++){
		b.push(str.charCodeAt(i));
	}
}

texInterface.prototype.getFrameStart=function(numBytes){
	var b=[];
	addStringToArray("TexCom01",b);
	b.push(0);
	b.push(numBytes);
	return b;
};

texInterface.prototype.setOutput=function(output,value,callback){
    var yo=this;
	if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='setOutput: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
	}
	else
	{	
		var str;
		value=''+value;
		if(value=='1')
			str=printf("KSO%04d",output);
		else
			str=printf("KRO%04d",output);

		var b=yo.getFrameStart(str.length);
		addStringToArray(str,b);
		var buffer=new Buffer(b);

		yo.sendCommand(buffer,function(){
            yo.texStatus='ok';
            yo.texLastMsg="";
            if(callback)
                callback(yo.texLastMsg);
		},function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="setOutput: could not send command";
            if(callback)
                callback(yo.texLastMsg);
		});
	}
};

/*
texInterface.prototype.kbHit=function(value,callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texLastMsg='kbHit: NotConnectedWithTex';
        callback(yo.texLastMsg);
    }
    else
    {
        var str="CP+";

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                yo.texStatus="commandError";
                yo.texLastMsg="kbHit:"+checkData.errormsg;
            }
            else
            {
                yo.texStatus='ok';
                yo.texLastMsg="kbHit sent";
            }
            callback(yo.texLastMsg);
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="kbHit: could not send command";
            callback(yo.texLastMsg);
        });
    }
};*/

texInterface.prototype.checkDataResponse=function(data){
    // data es un buffer...
    var result={};
    result.res=false;
    result.errormsg="ok";

	if(!data) // data undefined
	{
		result.errormsg="Response data undefined";
		return result;
	}
	if(data.length==0) // data sin datos
	{
        result.errormsg="Response data empty";
		return result;
	}
    var str=data.toString();
	if(!str.match(/TexCom01/g)) // no me viene el tex
	{
        result.errormsg="Response data wrong format";
		return result;
	}
    str=str.substring(10);
    if(str.length<3)
    {
        // probablemente tengo un ack o un nack

        result.errormsg="ok";
        result.res=true;
        return result;
    }
	if(str[0]=='?' && str[1]=='?') // tengo un error
	{
		switch(str[2])
		{
        case '0':
            result.errormsg="stexInterface:response: il primo carattere del comando non appartiene a nessun gruppo riconosciuto";
            break;
        case '1':
            result.errormsg="stexInterface:response: la combinazione dei tre caratteri del comando non � riconosciuta";
            break;
        case '2':
            result.errormsg="stexInterface:response: i valori inseriti nella zona dati sono errati";
            break;
        case '3':
            result.errormsg="stexInterface:response: la frame trasmessa � corretta ma la configurazione del Power non ne permette " +
                    "l�esecuzione (ad esempio si fa  riferimento ad  un  asse non  montato, ad  una  pagina di " +
                    "parametrica non esistente, �.stc)";
            break;
        case '4':
            result.errormsg="stexInterface:response: la frame trasmessa � corretta ma il Power si trova in uno stato in cui non ne � " +
                    "permessa l�esecuzione";
            break;
        case '5':
            result.errormsg="stexInterface:response: la frame trasmessa � corretta, il Power ha tentato di eseguire quanto comandato ma " +
                    "non � riuscito a portarlo a termine";
            break;
        }		
		return result;
	}
	result.errormsg="ok";
    result.res=true;
	return result;
};


texInterface.prototype.getJogVeloAxis=function(){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getJogVeloAxis";

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getJogVeloAxis: NotConnectedWithTex";
		yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var promises=[];

//        for(var i=0;i<yo.globals.axisNames.length;i++)
		if(yo.globals && yo.globals.axisNames)
		{
			for(var i=0;i<yo.globals.axisNames.length-1;i++)
//        for(var i=0;i<4;i++)
				promises.push(yo.getMachineParameter(i+1,3));
		}

        // compruebo si todas las peticiones!!
        when.all(promises).then(function(results){
			yo.curCommand=result.what;
            var ok=true;
            var jogVeloAxis=[];
            for(var i=0;i<results.length;i++)
            {
                // error...
                if(results[i] && results[i].value)
                    jogVeloAxis.push(results[i].value);
                else
                    ok=false;
            }
            // si error
            result.jogVeloAxis=jogVeloAxis;
            if(!ok)
            {
                result.res="failed";
                result.msg="failed when obtain jogVelo from Tex";
                deferred.reject(result);
            }
            else
            {
                result.res="ok";
                result.msg="";
                deferred.resolve(result);
            }
        });
    }
    return deferred.promise;
};


texInterface.prototype.getStatusAxis=function(){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getStatusAxis";

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getStatusAxis: NotConnectedWithTex";
        deferred.reject(result);
    }
    else
    {
        var str;
        str="SQ/";
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        this.sendCommand(buffer,function(data){
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getStatusAxis:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                // Aqui obtengo el estado de los ejes...
                var str=data.toString();
                str=str.substring(10);
                if(!str.match(/A--/g))
                {
                    result.res="commandError";
                    result.msg="getStatusAxis: wrong response command";
                    deferred.reject(result);
                    return;
                }
                str=str.substring(3);
                var status="";
                var l=str.length;
                var i=0;
                var cc=0;
                var axisStatus=[];
                while(i<l)
                {
                    if(str[i]!=' ' && str[i]!='*')
                        status+=str[i];
                    cc++;
                    i++;
                    if(cc==20)
                    {
                        if(status.length!=0)
                            axisStatus.push(status);
                        cc=0;
                        status="";
                    }
                }

                result.res="ok";
                result.msg="";
                result.value=axisStatus;
                deferred.resolve(result);
            }
        },function(){
            result.res="connectionError";
            result.msg="getStatusAxis: could not send command";
            deferred.reject(result);
        });
    }
    return deferred.promise;
};

texInterface.prototype.getMachineParameter=function(pagina, parNumber){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getMachineParameter_"+pagina+"_"+parNumber;

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getMachineParameter: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
	else
	{	
		var str;
		str=printf("Rx+%d,%d",pagina, parNumber);
		var b=yo.getFrameStart(str.length);
		addStringToArray(str,b);
		var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
			// aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getMachineParams:"+checkData.errormsg;
                deferred.reject(result);
            }
			else
			{
                var str=data.toString();
				str=str.substring(10);
				var ls=str.split(",");
				if(ls.length>5)
				{
                    result.value=ls[5].trim();
                    result.value2=ls[4].trim();
				}
                result.res="ok";
                result.msg="";
                deferred.resolve(result);
			}
        },function(){
            yo.curCommand=result.what;
            result.res="connectionError";
            result.msg="getMachineParams: could not send command";
            deferred.reject(result);
		});
	}
    return deferred.promise;
};

texInterface.prototype.setMachineParameter=function(pagina, parNumber, value, callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='setMachineParameter: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
    }
    else
    {
        var str;
        var pag=parseInt(pagina)+1;
        str=printf("EX-%d,%d,%s",pag,parNumber,value);
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                yo.texLastMsg="setMachineParameter:"+checkData.errormsg;
                if(callback)
                    callback(yo.texLastMsg);
            }
            else
            {
                yo.texStatus='ok';
                yo.texLastMsg="";

                if(callback)
                    callback("setMachineParameter: " + pagina + "," + parNumber + "=" + value + " OK");
            }
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="setMachineParameter: could not send command";
            if(callback)
                callback(yo.texLastMsg);
        });
    }
};

texInterface.prototype.compilePLC=function(callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='getEditor: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
    }

    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="compilePLC";

    console.log("compilePLC...");

    var str;
    str=printf("CP-");

    var b=yo.getFrameStart(str.length);
    addStringToArray(str,b);
    var buffer=new Buffer(b);

    yo.sendCommand(buffer,function(data){
        // aqui obtengo el resultado... en data
        var checkData=yo.checkDataResponse(data);
        yo.curCommand="compilePLC";
        if(checkData.res==false)
        {
            result.res="commandError";
            result.msg="compilePLC:"+checkData.errormsg;
            console.log(result.msg);
            if(callback) {
                callback({result:"error", error:result.msg});
                return;
            }
        }
        // me da el ack...
        else
        {
            callback({result:"ok", data:""});
            return;
        }
    },function(){
        result.res="conectionError";
        result.msg="compilePLC: could not send command";
        console.log(result.msg);
        yo.curCommand=result.what;
        yo.status=backStatus;
        if(callback)
        {
            callback({result:"error", error:result.msg});
            return;
        }
    });

}

texInterface.prototype.getEditor=function(type, callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='getEditor: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
    }

    var plcPackets=[];
    var index=0;
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getEditor";
    console.log("getEditor");

    function getEditorPacket(type, index, callback) {

        console.log("getEditorPacket: " + index);
        var str;
        str=printf("R%c-%04d",type,index);
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                var str=data.toString();
                result.res="commandError";
                result.msg="getEditorPacket:"+checkData.errormsg;
                console.log(result.msg);
                if(callback) {
                    callback({result:"error", error:result.msg});
                    return;
                }
            }
            else
            {
                var str=data.toString();
                str=str.substring(10);
                var toNextPacket=true;
                if(type=='m') {
                    if(!str.match(/^Em-/))
                        toNextPacket=false;
                }
                else if(!str.match(/^E--/))
                    toNextPacket=false;

                if(!toNextPacket) // compuebo errores y final de packets...
                {
                    if(str.match(/^F--/)) {
                        if(callback)
                        {
                            var editor=plcPackets.join("");
                            callback({result:"ok", data:editor});
                            return;
                        }
                    }
                    result.res="commandError";
                    result.msg="getEditorPacket: wrong response command";
                    console.log(result.msg);

                    if(callback)
                    {
                        callback({result:"error", error:result.msg});
                        return;
                    }
                }
                else
                {
                    // me salto TexCom01xxE--XXXX donde xx es tam y XXXX es el valor de la variable consultada
                    str=str.substring(7);
                    plcPackets[index]=str;

                    index++;
                    getEditorPacket(type, index, callback);
                }
            }
            yo.curCommand=result.what;
        },function(){
            result.res="conectionError";
            result.msg="getEditorPacket: could not send command";
            console.log(result.msg);
            yo.curCommand=result.what;
            if(callback)
            {
                callback({result:"error", error:result.msg});
                return;
            }
        });
    }

    getEditorPacket(type, index, callback);

};

texInterface.prototype.setEditor=function(type, contentEditor, callback){

    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='setEditor: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
    }


    var index=0;
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="setEditor";
    console.log("setEditor");
    var totalBytesToSend=contentEditor.length;
    var totalBytesSent=0;

    if(yo.status=='bussy') {
        if(callback)
        {
            callback({result:"error", error:"texInterface is bussy with another task... wait until ready"});
            return;
        }
    }
    var backStatus=yo.status;
    yo.status="bussy";
    yo.transmissionInfo={curPacket:index, totalBytesToSend:totalBytesToSend, totalBytesToSent:totalBytesSent};

    // cada contentPacket sera de 90 maximo (aunque se permiten 100)
    // si es 0 entonces mando un paquete de F-- (fin)
    function setEditorPacket(type, contentEditor, index, callback) {

        var contentPacket=contentEditor.substr(0,99);

        var str;
        var end=false;
        str=printf("E%c-%04d",type,index);
        if(contentPacket.length<=0){
            str="F--";
            end=true;
        }
        else
        {
            str+=contentPacket;
            contentEditor=contentEditor.substr(contentPacket.length);
        }
        totalBytesSent=totalBytesToSend-contentEditor.length;

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="setEditorPacket:"+checkData.errormsg;
                console.log(result.msg);
                yo.status=backStatus;
                if(callback) {
                    callback({result:"error", error:result.msg});
                    return;
                }
            }
            // me da el ack...
            else
            {
                if(end) {
                    console.log("setEditorPacket: FINISH!")
                    yo.status=backStatus;
                    if(callback)
                        callback({result:"ok", data:undefined});
                    return;
                }
                else{
                    yo.transmissionInfo={curPacket:index, totalBytesToSend:totalBytesToSend, totalBytesToSent:totalBytesSent};

                    index++;
                    setEditorPacket(type, contentEditor, index, callback);
                }
            }
            yo.curCommand=result.what;
        },function(){
            result.res="conectionError";
            result.msg="setEditorPacket: could not send command";
            console.log(result.msg);
            yo.status=backStatus;
            yo.curCommand=result.what;
            if(callback)
            {
                callback({result:"error", error:result.msg});
                return;
            }
        });
    }


    function prepareToSetEditor(type, contentEditor, index, callback) {
        console.log("prepareToSetEditor: ");

        var str;
        str=printf("T%c-%d",type,contentEditor.length);

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="prepareToSetEditor:"+checkData.errormsg;
                yo.status=backStatus;
                console.log(result.msg);
                if(callback) {
                    callback({result:"error", error:result.msg});
                    return;
                }
            }
            // me da el ack...
            else
            {
                setEditorPacket(type, contentEditor, index, callback);
            }
            yo.curCommand=result.what;
        },function(){
            result.res="conectionError";
            result.msg="prepareToSetEditor: could not send command";
            console.log(result.msg);
            yo.curCommand=result.what;
            yo.status=backStatus;
            if(callback)
            {
                callback({result:"error", error:result.msg});
                return;
            }
        });

    }

    prepareToSetEditor(type, contentEditor, index, callback);
};



texInterface.prototype.getVar=function(varType, number){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getVar"+varType+number;

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getVar: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var str;
        str=printf("J%cC%s",varType,number);
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
			yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getVar:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                var str=data.toString();
                str=str.substring(10);
                // buco la ,
                var n=str.search(",");
                if(n==-1)
                {
                    result.res="commandError";
                    result.msg="getVar: wrong command response";
                    deferred.reject(result);
                }
                else
                {
                    n++;
                    if(str.length>=n)
                    {
                        result.value=str.substring(n);
                    }

                    result.res="ok";
                    result.msg="";
                    deferred.resolve(result);
                }
            }
        },function(){
            result.res="connectionError";
            result.msg="getVar: could not send command";
            yo.curCommand=result.what;
            deferred.reject(result);
        });
    }
    return deferred.promise;
};


texInterface.prototype.getInfoVar=function(varType, number){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getInfoVar"+varType+number;

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getInfoVar: NotConnectedWithTex";
        deferred.reject(result);
        yo.curCommand=result.what;
    }
    else
    {
        var type=0;
        switch(varType)
        {
            case 'I': type=0; break;
            case 'F': type=1; break;
            case 'D': type=2; break;
            case 'S': type=3; break;
        }

        var str;
        str=printf("SZW%04d%03d000",number, type);
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getInfoVar:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                var str=data.toString();
                if(!str.match(/E--/g))
                {
                    result.res="commandError";
                    result.msg="getInfoVar: wrong response command";
                    deferred.reject(result);
                }
                else
                {
                    // me salto TexCom01xxE--XXXX donde xx es tam y XXXX es el valor de la variable consultada
                    str=str.substring(17);
                    result.value=str.trim();
                    result.res="ok";
                    result.msg="";
                    deferred.resolve(result);
                }
            }
            yo.curCommand=result.what;
        },function(){
            result.res="conectionError";
            result.msg="getInfoVar: could not send command";
            deferred.reject(result);
            yo.curCommand=result.what;
        });
    }
    return deferred.promise;
};


texInterface.prototype.getSysVar=function(varType, number){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getSysVar"+varType+number;

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getSysVar: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var str;
        str=printf("J%c-%s",varType,number);
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
			yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getSysVar:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                var str=data.toString();
                if(!str.match(/JS-/g))
                {
                    result.res="commandError";
                    result.msg="getSysVar: wrong response command";
                    deferred.reject(result);
                }
                else
                {
                    str=str.substring(17);
                    result.value=str.trim();
                    result.msg="";
                    result.res="ok";
                    deferred.resolve(result);
                }
            }
        },function(){
            result.res="connectionError";
            result.msg="getSysVar: could not send command";
            yo.curCommand=result.what;
            deferred.reject(result);
        });
    }
    return deferred.promise;
};

texInterface.prototype.getSInfo=function(number){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getSInfo"+number;

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getSInfo: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var str;
        str=printf("SZS%04d0",number);
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
			yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getSysVar:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                var str=data.toString();
                if(!str.match(/E--/g))
                {
                    result.res="commandError";
                    result.msg="getSInfo: wrong response command";
                    deferred.reject(result);
                }
                else
                {
                    str=str.substring(17);
                    result.value=str.trim();
                    result.msg="";
                    result.res="ok";
                    deferred.resolve(result);
                }
            }
        },function(){
            result.res="connectionError";
            result.msg="getSysVar: could not send command";
            yo.curCommand=result.what;
            deferred.reject(result);
        });
    }
    return deferred.promise;
};


texInterface.prototype.getLastError=function(){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getLastError";

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getLastError: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var str="SE+";
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getLastError:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                var str=data.toString();
                if(!str.match(/EE-/g))
                {
                    result.res="commandError";
                    result.msg="getLastError: wrong response command";
                    deferred.reject(result);
                }
                else
                {
                    str=str.substring(13);
                    result.value=str;
                    result.res="ok";
                    result.msg="";
                    deferred.resolve(result);
                }
            }
        },function(){
            result.res="connectionError";
            result.msg="getLastError: could not send command";
            yo.curCommand=result.what;
            deferred.reject(result);
        });
    }
    return deferred.promise;
};

texInterface.prototype.getOverFeed=function(){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getOverFeed";

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getOverFeed: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var str;
        str=printf("OR-0");

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getOverFeed:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                var str=data.toString();
                if(!str.match(/O--/g))
                {
                    result.res="commandError";
                    result.msg="getOverFeed: wrong response command";
                    deferred.reject(result);
                }
                else
                {
                    str=str.substring(13);
                    result.value=str;
                    result.res="ok";
                    result.msg="";
                    deferred.resolve(result);
                }
            }
        },function(){
            result.res="connectionError";
            result.msg="getOverFeed: could not send command";
            yo.curCommand=result.what;
            deferred.reject(result);
        });
    }
    return deferred.promise;
};

texInterface.prototype.setOverFeed=function(value,callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='setOverFeed: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
    }
    else
    {
        var str;
        str=printf("OT-%d",value);

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
                yo.texLastMsg="setOverFeed:"+checkData.errormsg;
            else
            {
                yo.set='ok';
                yo.texLastMsg="setOverFeed OK";
            }
            if(callback)
                callback(yo.texLastMsg);
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="setOverFeed: could not send command";
            if(callback)
                callback(yo.texLastMsg);
        });
    }
};


texInterface.prototype.saveParamsInEPROM=function(callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus="saveParamsInEPROM: NotConnectedWithTex";
    }
    else
    {
        var str;
        str=printf("EX+");

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
                yo.texLastMsg="saveParamsInEPROM:"+checkData.errormsg;
            else
            {
                yo.texStatus='ok';
                yo.texLastMsg="saveParamsInEPROM OK";
            }
            callback(yo.texLastMsg);
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="saveParamsInEPROM: could not send command";
            callback(yo.texLastMsg);
        });
    }
};


texInterface.prototype.setJogVelo=function(axis, value,callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='setJogVelo: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
    }
    else
    {
        // pagina 1-4 y numero variable 3 para la velocidad del jog
        yo.setMachineParameter(axis,3,value,callback);
        yo.setMachineParameter(axis,19,value,callback);
        yo.saveParamsInEPROM(callback);
    }
};

texInterface.prototype.jogAxis=function(axis,dir,callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus="jogAxis: NotConnectedWithTex";
        callback(yo.texLastMsg);
    }
    else
    {

        var str="M"+yo.globals.axisNames[axis]+dir;

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
                yo.texLastMsg="jogAxis:"+checkData.errormsg;
            else
                yo.texLastMsg="jogAxis:ok";

            callback(yo.texLastMsg);
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="jogAxis: could not send command";
            callback(yo.texLastMsg);
        });
    }
};

texInterface.prototype.stopCNC=function(callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus="stopCNC: NotConnectedWithTex";
		if(callback)
			callback(yo.texLastMsg);
    }
    else
    {

//        var str="CS-";
        var str="mW-";
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
			
            if(checkData.res==false)
			{
                yo.texLastMsg="stopCNC: "+checkData.errormsg;
				if(callback)
					callback(yo.texLastMsg);

			}
            else
			{
				
                /*var str2="CK-";
                var b2=yo.getFrameStart(str2.length);
                addStringToArray(str2,b2);
                var buffer2=new Buffer(b2);

                yo.sendCommand(buffer2,function(data){
                    // aqui obtengo el resultado... en data
					console.log("second STOP");
                    var checkData=yo.checkDataResponse(data);
                    if(checkData.res==false)
					{
                        yo.texLastMsg="stopCNC:"+checkData.errormsg;
						console.log("second STOP ERROR");
					}
                    else
					{
                        console.log("second STOP OK");
					}

                    console.log(yo.texLastMsg);
					if(callback)
						callback(yo.texLastMsg);

                },function(){
                    yo.texStatus='connectionError';
                    yo.texLastMsg="stopCNC: could not send command";
                    if(callback)
						callback(yo.texLastMsg);
                });*/
				
                yo.texLastMsg="stopCNC:ok";
                if(callback)
					callback(yo.texLastMsg);

			}

            /*if(checkData.res==false)
                yo.texLastMsg="stopCNC:"+checkData.errormsg;
            else
            {
                var str2="CK-";
                var b2=yo.getFrameStart(str2.length);
                addStringToArray(str2,b2);
                var buffer2=new Buffer(b2);

                yo.sendCommand(buffer2,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=yo.checkDataResponse(data);
                    if(checkData.res==false)
                        yo.texLastMsg="stopCNC:"+checkData.errormsg;
                    else
                        callback(yo.texLastMsg);

                    console.log(yo.texLastMsg);

                },function(){
                    yo.texStatus='connectionError';
                    yo.texLastMsg="jogAxis: could not send command";
                    callback(yo.texLastMsg);
                });
            }*/
        },function(){
			console.log("stopCNC Error contection");
            yo.texStatus='connectionError';
            yo.texLastMsg="stopCNC: could not send command";
            if(callback)
				callback(yo.texLastMsg);
        });
    }
};

texInterface.prototype.processManual=function(callback){
    var yo=this;
    if (yo.connStatus!='ready'){
		yo.texStatus='NotConnectedWithTex';
		yo.texLastMsg="processManual: NotConnectedWithTex";
		if(callback)
			callback(yo.texLastMsg);
    }
    else
    {
        var str;
        str=printf("mw-");

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
			{
                yo.texLastMsg="processManual:"+checkData.errormsg;
			}
            else
            {
                yo.texStatus='ok';
                yo.texLastMsg="processManual OK";
            }
            if(callback)
				callback(yo.texLastMsg);
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="processManual: could not send command";
			if(callback)
				callback(yo.texLastMsg);
        });
    }
};

texInterface.prototype.moveAxis=function(axis,pos,callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus="moveAxis: NotConnectedWithTex";
		if(callback)
			callback(yo.texLastMsg);
    }
    else
    {
        var str;
		
		if(yo.globals && yo.globals.axisNames && yo.globals.axisNames.length>axis)
			axis=yo.globals.axisNames[axis];
		else
		{
            yo.texLastMsg="moveAxis: not found " + axis + " axis at system";
			console.log(yo.texLastMsg);
			if(callback)
				callback(yo.texLastMsg);
			return;
		}
		str=printf("mg-%c%.2f",axis,pos);

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
			{
                yo.texLastMsg="moveAxis:"+checkData.errormsg;
			}
            else
            {
                yo.texStatus='ok';
                yo.texLastMsg="moveAxis OK";
            }
			if(callback)
				callback(yo.texLastMsg);
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="moveAxis: could not send command";
			if(callback)
				callback(yo.texLastMsg);
        });
    }
};

texInterface.prototype.setVar=function(varType, number, value, callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='setVar: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
    }
    else
    {
        var str;
        str=printf("J%cc%s,%s",varType,number,value);
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                yo.texLastMsg="setVar:"+checkData.errormsg;
                if(callback)
                    callback(yo.texLastMsg);
            }
            else
            {
                yo.texStatus='ok';
                yo.texLastMsg="";

                if(callback)
                    callback("SetVar: " + varType + number + "=" + value + " OK");
            }
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="setVar: could not send command";
            if(callback)
                callback(yo.texLastMsg);
        });
    }
};

texInterface.prototype.getVariables=function(type, from, to,callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus="NotConnectedWithTex";
        callback(yo.texLastMsg);
    }
    else
    {
        var ifrom, ito;
        ifrom=parseInt(from);
        ito=parseInt(to);

        if(ifrom>ito) { var iaux=ito; ito=ifrom; ifrom=iaux; }

        var error=false;
        var str='J'+type+'A';
        var patt=new RegExp("J"+type+"A", "g");
        switch(type)
        {
            case 'V':
            case 'v':
            case 'W':
            case 'w':
            case 'D':
            case 'd':
                break;
            case 'S':
            case 's':
                ifrom=0; ito=63;
                break;
            case 'R':
            case 'r':
            case 'F':
            case 'f':
                ifrom=Math.floor(ifrom/16);
                ito=Math.floor(ito/16);
                break;

            default:
                callback("incorrect type: "+ type)
                return;
        }
        str+=printf("%d,%d",ifrom,ito);

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                yo.texStatus='error';
                yo.texLastMsg="getVariables:"+checkData.errormsg;
                callback(yo.texLastMsg);
            }
            else
            {
                // Aqui obtengo el estado de los ejes...
                var str=data.toString();
                var values;
                str=str.substring(10);

                if(!str.match(patt))
                {
                    yo.texStatus='commandError';
                    yo.texLastMsg="getVariables: wrong response command";
                    callback(yo.texLastMsg);
                }
                else
                {
                    str=str.substring(3);
                    values=str.split(",");
                    str="";
                    var aux;
                    var variables=[];
                    for(var i=0;i<values.length;i++)
                    {
                        if(type=='S' || type=='R' || type=='F' ||
                            type=='s' || type=='r' || type=='f')
                            aux=type+printf("%d=%s (16 bits)",(ifrom+i)*16,values[i]);
                        else
                            aux=type+printf("%d=%s",ifrom+i,values[i]);
                        variables.push(aux);
                    }
                    callback(variables);
                }
            }
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="getVariables: could not send command";
            callback(yo.texLastMsg);
        });
    }
};

texInterface.prototype.setCncManual=function(value,callback){
    var yo=this;
    if (yo.connStatus!='ready'){
        yo.texStatus='NotConnectedWithTex';
        yo.texLastMsg='setCncManual: NotConnectedWithTex';
        if(callback)
            callback(yo.texStatus);
    }
    else
    {
        var str;
        if(value=="true" || value=="1")
            str="mc-";
        else str="md-";

        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        yo.sendCommand(buffer,function(data){
            // aqui obtengo el resultado... en data
            var checkData=yo.checkDataResponse(data);
            if(checkData.res==false)
            {
                yo.texStatus='error';
                yo.texLastMsg="setCncManual:"+checkData.errormsg;
                if(callback)
                    callback(yo.texLastMsg);
            }
            else
            {
                yo.texStatus='ok';
                yo.texLastMsg="setCncManual ok";
                callback(yo.texLastMsg);
            }
        },function(){
            yo.texStatus='connectionError';
            yo.texLastMsg="setCncManual: could not send command";
            if(callback)
                callback(yo.texLastMsg);
        });
    }
};


texInterface.prototype.getPosVeloAxis=function(axisNames){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getPosVeloAxis";

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getPosVeloAxis: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var str;
        str=printf("SQ-%s",axisNames);
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        this.sendCommand(buffer,function(data){
            var checkData=yo.checkDataResponse(data);
			yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getPosVeloAxis:"+checkData.errormsg;
                deferred.reject(result);
                return;
            }

            // Aqui obtengo el estado de los ejes...
            var str=data.toString();
            str=str.substring(10);
            if(!str.match(/M--/g))
            {
                result.res="commandError";
                result.msg="getPosVeloAxis: wrong response command";
                deferred.reject(result);
                return;
            }
            str=str.substring(3);
            var pos="";
            var velo="";
            var l=str.length;
            var i=0;
            var cc=0;
            var axisPos=[];
            var axisVelo=[];
            while(i<l)
            {
                if(cc<10 && str[i]!=' ' && str[i]!='*')
                    pos+=str[i];
                else if(cc>=10 && str[i]!=' ' && str[i]!='*')
                    velo+=str[i];
                cc++;
                i++;
                if(cc==20)
                {
                    if(pos.length!=0)
                        axisPos.push(pos);
                    if(velo.length!=0)
                        axisVelo.push(velo);
                    cc=0;
                    pos="";
                    velo=""
                }
            }

            result.res="ok";
            result.msg="";
            result.posAxis=axisPos;
            result.veloAxis=axisVelo;
            deferred.resolve(result);
        },function(){
            result.res="conectionError";
            result.msg="getPosVeloAxis: could not send command";
            yo.curCommand=result.what;
            deferred.reject(result);
        });
    }
    return deferred.promise;
};

texInterface.prototype.getInputs=function(){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getInputs";

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getInputs: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var str;
        str=printf("KXI");
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        this.sendCommand(buffer,function(data){
            var checkData=yo.checkDataResponse(data);
			yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getInputs:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                // Aqui obtengo el estado de los ejes...
                var str=data.toString();
                str=str.substring(10);
                if(!str.match(/KXI/g))
                {
                    result.res="commandError";
                    result.msg="getInputs: wrong response command";
                    deferred.reject(result);
                }
                else
                {
                    str=str.substring(3);
                    var l=str.length;
                    var i=0;
                    var aux;
                    var inputs="";
                    while(i<l)
                    {
                        aux=printf("%d,",data.readUInt8(13+i));
                        inputs+=aux;
                        i++;
                    }
                    result.res="ok";
                    result.msg="";
                    result.value=inputs;
                    deferred.resolve(result);
                }
            }
        },function(){
            result.res="connectionError";
            result.msg="getInputs: could not send command";
			yo.curCommand=result.what;
			deferred.reject(result);
        });
    }
    return deferred.promise;
};

texInterface.prototype.getOutputs=function(){
    var yo=this;
    var deferred=when.defer();
    var result={ what:undefined, res:undefined, msg:undefined };
    result.what="getOutputs";

    if (yo.connStatus!='ready'){
        result.res="connectionError";
        result.msg="getOutputs: NotConnectedWithTex";
        yo.curCommand=result.what;
        deferred.reject(result);
    }
    else
    {
        var str;
        str=printf("KXO");
        var b=yo.getFrameStart(str.length);
        addStringToArray(str,b);
        var buffer=new Buffer(b);

        this.sendCommand(buffer,function(data){
            var checkData=yo.checkDataResponse(data);
			yo.curCommand=result.what;
            if(checkData.res==false)
            {
                result.res="commandError";
                result.msg="getOutputs:"+checkData.errormsg;
                deferred.reject(result);
            }
            else
            {
                // Aqui obtengo el estado de los ejes...
                var str=data.toString();
                str=str.substring(10);
                if(!str.match(/KXO/g))
                {
                    result.res="commandError";
                    result.msg="getOutputs: wrong response command";
                    deferred.reject(result);
                }
                else
                {
                    str=str.substring(3);
                    var l=str.length;
                    var i=0;
                    var aux;
                    var outputs="";
                    while(i<l)
                    {
                        aux=printf("%d,",data.readUInt8(13+i));
                        outputs+=aux;
                        i++;
                    }
                    result.res="ok";
                    result.msg="";
                    result.value=outputs;
                    deferred.resolve(result);
                }
            }
        },function(){
            result.res="connectionError";
            result.msg="getOutputs: could not send command";
			yo.curCommand=result.what;
            deferred.reject(result);
        });
    }
    return deferred.promise;
};

//////////////////////////////////////////////////////

/*texInterface.prototype.LoadGCode=function(content_B,qjobName,qjobParams,callback){
    // de momento esta funcion no tendra promesas
    var yo=this;
    var result={};

    // control de errores
    var v980=-1;
    if(yo.globals.v980==undefined)
    {
        result.resvalue=400;
        result.msg='LoadGCode: cant check globals.v980 param from tex';
        console.log(result.msg);
        callback(result);
    }
    else
    {
        v980=parseInt(yo.globals.v980);
        // la maquina esta en marcha o tiene algo para fresar.
        if(v980>0 && v980<100)
        {
            result.resvalue=400;
            result.msg='LoadGCode: machine is working. Wait until finish current jog to send a new one';
            console.log(result.msg);
            callback(result);
        }
    }
    if(ftpReady==false)
    {
        result.resvalue=400;
        result.msg='LoadGCode: ftp connection not ready. Try again in few seconds.';
        console.log(result.msg);
        callback(result);
    }


    if (yo.connStatus!='ready' && yo.connStatus!='connecting' && yo.connStatus!='waitAck'){
        result.resvalue=400;
        result.res="commandError";
        result.msg='LoadGCode: NotConnectedWithTex';
        yo.texLastMsg='LoadGCode: NotConnectedWithTex';
        callback(result);
    }
    else
    {
        var filename="dummy";
        var gcode=utils.SBase64.decode(content_B);
        if(gcode==undefined || gcode.length==0)
        {
            result.resvalue=400;
            result.res="commandError";
            result.msg='LoadGCode: wrong content_B value';
            callback(result);
            return;
        }

        // parto el gcode en cachos, grabo a disco y cambio de estado.
        var res=yo.ParteGCode(gcode, function(res, filesToSend,timeStamp) {
            // se ha partido ok
            if(res==true)
            {
                var ss="file"+timeStamp+printf("_%d.iso",filesToSend);
                var jobName=ss;
                var jobParams="12345";
                if(qjobName) jobName=qjobName;
                if(qjobParams) jobParams=qjobParams;

                // Anyado el trabajo
                var j=new JobInfo();
                j.jobName=jobName;
                j.jobParams=jobParams;
                j.internalJobName=ss;
                j.created=timeStamp;
                j.filesSended=0;
                j.filesToSend=filesToSend;
                j.status="queued";
                yo.jobQueue.push(j);

                callback("LoadGCode ok");
            }
            else
            {
                callback("cant split received buffer");
            }
        });
    }
};*/

/*texInterface.prototype.ParteGCode=function(gcode, callback)
{
    var yo=this;
    var partes=1;

    console.log("ParteGCode");

    // Obtengo el timeStamp para grabar los archivos a disco...
    var dateTime = new Date;
    var timeStamp=printf("%02d%02d%02d",dateTime.getHours(),dateTime.getMinutes(),dateTime.getSeconds());

    var salir=false;
    var str=gcode;
    var toWrite=0;
    var n=0;
    var sToWrite="";
    var fname="";

    var promises=[];

    // 20131010: permito la grabacion de solo un fichero, sin partir, en funcion de los params
    if(yo.initOptions.splitGCode==false)
    {
        fname=pathTemp+"\\file"+timeStamp+printf("_%d.iso",partes);
        sToWrite=gcode;
        sToWrite+="\nM70";
        promises.push(fs.writeFile(fname, sToWrite));
    }
    else
    {
        do
        {
            fname=pathTemp+"\\file"+timeStamp+printf("_%d.iso",partes);

            sToWrite=str;
            n=str.search("(EndSection)");
            if(n!=-1)
            {
                n--;
                toWrite=n;
                sToWrite=str.substring(0,toWrite);
                str=str.substring(toWrite+13);
                partes++;
            }
            else
            {
                toWrite=str.length;
                sToWrite+="\nM70";
                salir=true;
            }

            promises.push(fs.writeFile(fname, sToWrite));

        }while(salir==false);
    }

    // compruebo si todas las escrituras han sido correctas !!
    when.all(promises).then(function(results){
        var ok=true;
        for(var i=0;i<results.length;i++)
        {
            // error...
            if(results[i]!=undefined)
                ok=false;
        }
        callback(ok,partes,timeStamp);
    });
};
*/



texInterface.prototype.LoadGCode=function(content_B,qjobName,qjobParams,callback){
    // de momento esta funcion no tendra promesas
    var yo=this;
    var result={};

    // ya estoy enviando un archivo... no puedo enviar otro
    if(yo.sendindStatus=="sending") {
        result.resvalue=400;
        result.msg='LoadGCode: cant send another file while sending is in progress!';
        console.log(result.msg);
        if(callback)
            callback(result);
        return;
    }


    // control de errores
    var v980=99;
    if(yo.globals.v980==undefined)
    {
        result.resvalue=400;
        result.msg='LoadGCode: cant check globals.v980 param from tex';
        console.log(result.msg);
        if(callback)
            callback(result);
        return;
    }
    else
    {
        v980=parseInt(yo.globals.v980);
        // la maquina esta en marcha o tiene algo para fresar.
        if(v980>0 && v980<100)
        {
            result.resvalue=400;
            result.msg='LoadGCode: machine is working. Wait until finish current jog to send a new one';
            console.log(result.msg);
            if(callback)
                callback(result);
            return;
        }
    }
    if(ftpReady==false)
    {
        result.resvalue=400;
        result.msg='LoadGCode: ftp connection not ready. Try again in few seconds.';
        console.log(result.msg);
        if(callback)
            callback(result);
        return;
    }

    if (yo.connStatus!='ready' && yo.connStatus!='connecting' && yo.connStatus!='waitAck'){
        result.resvalue=400;
        result.res="commandError";
        result.msg='LoadGCode: NotConnectedWithTex';
        yo.texLastMsg='LoadGCode: NotConnectedWithTex';
        if(callback)
            callback(result);
        return;
    }
    else
    {
        var filename="dummy";
        var gcode=utils.SBase64.decode(content_B);
        if(gcode==undefined || gcode.length==0)
        {
            result.resvalue=400;
            result.res="commandError";
            result.msg='LoadGCode: wrong content_B value';
            if(callback)
                callback(result);
            return;
        }

        // parto el gcode en cachos, grabo a disco y cambio de estado.
        var res=yo.ParteGCode(gcode, function(res, filesToSend,timeStamp) {
            // se ha partido ok
            if(res==true)
            {
                var ss="file"+timeStamp+printf("_%d.iso",filesToSend);
                var jobName=ss;
                var jobParams="12345";
                if(qjobName) jobName=qjobName;
                if(qjobParams) jobParams=qjobParams;

                // Y lo envio...
                if(ftpReady==false)
                {
                    result.resvalue=400;
                    result.msg='LoadGCode: ftp connection not ready. Try again in few seconds.';
                    console.log(result.msg);
                    if(callback)
                        callback(result);
                    return;
                }

                var fname=pathTemp+"\\"+ss;
                var rname="G:\\iso1.iso";
                ftpResultMsg="sending " + fname;
                console.log("sending "+ rname);
                myFTP.on('progress',function(progress) {
                    yo.ftpCurProgress=progress;
                    ftpResultMsg="sending " + yo.ftpCurProgress + " " + fname;
                });
                yo.ftpCurProgress=0;
                myFTP.put(fname, rname,function(err) {
                    // Ha fallado el envio del fichero
                    if (err)
                    {
                        ftpResultMsg=err.msg;
                        console.log(err.msg);
                        yo.ftpCurProgress=0;
                        yo.setVar('V',"980",100);
                        result.resvalue=400;
                        result.msg='LoadGCode: FTP upload to tex failed. Clear Jobs and wait few seconds to send again';
                        console.log(result.msg);
                        if(callback)
                            callback(result);
                        return;
                    }
                    else
                    {
                        ftpResultMsg="sent " + fname;
                        console.log("sent!");
                        yo.ftpCurProgress=100;
                        result.resvalue=200;
                        result.msg='LoadGCode: OK.';
                        console.log(result.msg);
                        yo.sendindStatus="ready"

                        // Anyado el trabajo
                        var j=new JobInfo();
                        j.jobName=jobName;
                        j.jobParams=jobParams;
                        j.internalJobName=ss;
                        j.created=timeStamp;
                        j.filesSended=0;
                        j.filesToSend=filesToSend;
                        j.status="ready to mill";
                        yo.curJob=j;

                        yo.setVar('V',"980",0);
						yo.setVar('V',"981",1);
                        if(callback)
                            callback(result);
                        return;
                    }
                });
                yo.sendindStatus="sending";

            }
            else
            {
                result.resvalue=400;
                result.msg='LoadGCode: cant save local file before to send';
                console.log(result.msg);
                if(callback)
                    callback(result);
                return;
            }
        });
    }
};



texInterface.prototype.ParteGCode=function(gcode, callback)
{
    var yo=this;
    var partes=1;

    console.log("ParteGCode");

    // Obtengo el timeStamp para grabar los archivos a disco...
    var dateTime = new Date;
    var timeStamp=printf("%02d%02d%02d",dateTime.getHours(),dateTime.getMinutes(),dateTime.getSeconds());

    var salir=false;
    var str=gcode;
    var toWrite=0;
    var n=0;
    var sToWrite="";
    var fname="";

    var promises=[];

    // 20131010: permito la grabacion de solo un fichero, sin partir, en funcion de los params
    fname=pathTemp+"\\file"+timeStamp+printf("_%d.iso",partes);
    sToWrite=gcode;
    sToWrite+="\nM70";
    promises.push(fs.writeFile(fname, sToWrite));

    // compruebo si todas las escrituras han sido correctas !!
    when.all(promises).then(function(results){
        var ok=true;
        for(var i=0;i<results.length;i++)
        {
            // error...
            if(results[i]!=undefined)
                ok=false;
        }
        if(callback)
            callback(ok,partes,timeStamp);
    });
};

//////////////////////////////////////////////////////






function create(argv){
	var ti=new texInterface();

    ti.initOptions.splitGCode=false;
    if(argv.s)
        ti.initOptions.splitGCode=argv.s;

    ti.initOptions.texOptimize=false;
    if(argv.t)
        ti.initOptions.texOptimize=argv.t;

	return ti;
}


module.exports.create=create;

