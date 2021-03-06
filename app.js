"use strict";

//////////////////////////////////////////////////////////
// Leo las opciones y genero la instancia del interfaz
var config=require("./config.json");
function checkConfig(config, machineConfig){
    {
        // comprobamos cosas
        if(config.initialOptions==undefined)
        {
            console.log("Not initial Options defined...");
            return false;
        }
        if(config.initialOptions.interfaceType==undefined ||
           config.initialOptions.interfaceName==undefined ||
           config.initialOptions.webPort==undefined)
        {
            console.log("Needed initialOptions: { interfaceType:'',interfaceName:'',webPort:'' } please check config.json");
            return false;
        }
        // buscamos la configuracion de la maquina que nos han dicho.
        var maqConfig=config[config.initialOptions.interfaceName];
        if(maqConfig==undefined)
        {
            console.log("Not found config for " + config.initialOptions.interfaceName);
            return false;
        }
        if(maqConfig.interfaceType==config.initialOptions.interfaceType)
        {
            console.log("Machine " + config.initialOptions.interfaceName + " config is not configured like " + config.initialOptions.interfaceType);
            return false;
        }
        if(maqConfig.interfaceFile==undefined)
        {
            console.log("Needed interfaceFile at " + config.initialOptions.interfaceName + " config");
            return false;
        }
        if(maqConfig.machineHost==undefined)
        {
            console.log("Needed machineHost at " + config.initialOptions.interfaceName + " config");
            return false;
        }

        machineConfig=maqConfig;
        return true;
    }
}

var machineConfig={};
if(checkConfig(config,machineConfig)==false)
    return;

// intentamos cargar el interface
var interfaceGen=require(machineConfig.interfaceFile);
if(interfaceGen==undefined || interfaceGen.generatorFunc==undefined){
    console.log("please check " + machineConfig.interfaceFile + "file if exists and have generatorFunc inside");
    return false;
}
// instanciamos el interfaz (nos devolvera un objeto interfaz con punteros a las funciones internas)
var interfaceInstance=interfaceGen.generatorFunc(machineConfig);
if(interfaceInstance==undefined) {
    console.log("Generator Instance of " + machineConfig.interfaceFile + "failed");
    return false;
}

// toodo esta ok, con lo que intentamos abrir el interfaz
if(interfaceInstance.open)
    interfaceInstance.open();
interfaceInstance.interval=setInterval(function() { interfaceInstance.iteraAutomata(); },1000);


/////////////////////////////////////////////
// Me creo el resto de cosas
var http = require('http');
var nodestatic = require('node-static');
var when = require("when");
var staticServer = new nodestatic.Server("./");
var querystring=require('querystring');
var requestCounter=0;

function sendJSONResponse(res,result){
	var headers={};
	headers['Access-Control-Allow-Origin'] = '*';
	headers['Access-Control-Allow-Headers'] = 'X-Requested-With';
	headers['Content-type']='text/json';

    // compruebo si hay error
    var resvalue=200;
    if(result.error!=undefined)
        resvalue=400;
    if(result.resvalue!=undefined)
        resvalue=result.resvalue;

	res.writeHead(resvalue, headers);
	result.requestCounter=requestCounter;
	result.maxQueueSize=texInterface.maxTSize;
	var str=JSON.stringify(result,null,2);
	res.write(str);
	res.end();
}

function getHelp(callback)
{
    var result={HELP:{}, SETOUTPUT:{}, SETOVERFEED:{}, SETMANUALMODE:{}, GETVARS:{}, GETVAR:{}, SETVAR:{}, GETGLOBALS:{},
        CLEARJOBS:{}, KBHIT:{}, JOGMENOS:{}, JOGMAS:{}};
    result.HELP.description="Show this help";
    result.HELP.example="HELP";
    result.SETOUTPUT.description="Set an output value (0,1). value={1: ON; 0: OFF}";
    result.SETOUTPUT.example="cmd=SETOUTPUT&output=36&value=1";
    result.SETOVERFEED.description="Set the overfeed value. value=integer";
    result.SETOVERFEED.example="cmd=SETOVERFEED&value=120";
    result.SETMANUALMODE.description="Set the CNC in manual/automatic mode for enable manual movements. value={1: enable manual mode if its possible; 0: disable manual mode if its possible}";
    result.SETMANUALMODE.examples="cmd=SETMANUALMODE&value=1";
    result.GETVARS.description="Get an array of vars from TEX. type={F,f,S,s,R,r,W,w,V,v,D,d}; from=integer; to=integer. For obtain variables for CNC we use Capital Letters, for PLC lower letters";
    result.GETVARS.examples="cmd=GETVARS&type=V&from=965&to=999";
    result.GETVAR.description="Get value from specific variable from TEX. type={F,f,S,s,R,r,W,w,V,v,D,d}; number=integer; For obtain variables for CNC we use Capital Letters, for PLC lower letters";
    result.GETVAR.examples="cmd=GETVAR&type=V&number=980";
    result.GETEDITOR.description="Get the PLC EDITOR from TEX";
    result.GETEDITOR.examples="cmd=GETPLCEDITOR&editorType=P";
    result.SETVAR.description="Set value from specific variable from TEX. type={F,f,S,s,R,r,W,w,V,v,D,d}; number=integer; value=integer; For set variables for CNC we use Capital Letters, for PLC lower letters";
    result.SETVAR.examples="cmd=SETVAR&type=V&number=981&value=55";
    result.GETGLOBALS.description="Get global cooked info from TEX and web interface server";
    result.GETGLOBALS.examples="cmd=GETGLOBALS";
    result.CLEARJOBS.description="Clear waiting jobs queue from web server, dont clear TEX uploaded JOB";
    result.CLEARJOBS.examples="cmd=CLEARJOBS";
    result.KBHIT.description="Used to send a key code into TEX, for models without keyboard and PLC code prepared for that";
    result.KBHIT.examples="cmd=KBHIT&value=esc";
    result.JOGMAS.description="Send JOG command to the desire axis... for 'positive' movements";
    result.JOGMAS.examples="cmd=JOGMAS&axis=2";
    result.JOGMENOS.description="Send JOG command to the desire axis... for 'negative' movements";
    result.JOGMENOS.examples="cmd=JOGMENOS&axis=2";
    result.MOVEAXIS.description="Send MOVE command to the desire axis always in abs...";
    result.MOVEAXIS.examples="cmd=MOVEAXIS&axis=0&pos=234";
    result.GETSETTINGS.description="Return SETTINGS from settingsFile.json (where are inputs and outputs alias and values...";
    result.GETSETTINGS.examples="cmd=GETSETTINGS";
    callback(result);
}



function getGlobals(callback)
{
    var result = texInterface.globals;
	result.initOptions=texInterface.options;
    // anyado informacion que siempre tiene que estar...
    // los jobs...

    var ftpStatus=texInterface.getFtpStatus();
    result.ftpCurProgress=ftpStatus.ftpCurProgress;
    result.ftpConnectStatus=ftpStatus.connectStatus;
    result.ftpResultMsg=ftpStatus.ftpResultMsg;

    result.transmissionInfo=texInterface.transmissionInfo;

    var now = new Date;
    result.time=now.getTime();
    result.connStatus=texInterface.connStatus;
    result.internalStatus=texInterface.status;

    result.curJob=texInterface.texCurJob;
    result.jobQueue=texInterface.jobQueue;
    callback(result);
}

function processRequest(res, query)
{
    if(!query.cmd)
        console.log("processRequest: not cmd in query");
    else
    {
        switch(query.cmd){
            case 'NAME': sendJSONResponse(res,{name:config.machineName});
                break;
            case 'GETSETTINGS': sendJSONResponse(res,{settings:settings});
                break;
            case 'HELP':
                getHelp(function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'GETEDITOR':
                if(!query.editorType)
                {
                    var result={};
                    result.error="GETEDITOR: value editorType not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.getEditor(query.editorType, function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'SETEDITOR':
                if(!query.editorType)
                {
                    var result={};
                    result.error="SETEDITOR: value editorType not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                if(!query.contentEditor || query.contentEditor.length==0)
                {
                    var result={};
                    result.error="SETEDITOR: contentEditor key not present or empty";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.setEditor(query.editorType, query.contentEditor, function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'KBHIT':
                if(!query.value)
                 {
                     var result={};
                    result.error="KBHIT: value key not present in query";
                    sendJSONResponse(res,result);
                    break;
                 }
                 texInterface.kbHit(query.value,function(result){
                    sendJSONResponse(res,result);
                 });
                break;
            case 'SETOUTPUT':
                if(!query.output || !query.value)
                {
                    var result={};
                    result.error="SETOVERFEED: output key or value key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.setOutput(query.output,query.value,function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'SETOVERFEED':
                if(!query.value)
                {
                    var result={};
                    result.error="SETOVERFEED: value key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.setOverFeed(query.value,function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'MOVEAXIS':
                if(!query.axis || !query.pos)
                {
                    var result={};
                    result.error="MOVEAXIS: axis key or pos key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.moveAxis(query.axis,query.pos,function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'SETMANUALMODE':
                if(!query.value)
                {
                    var result={};
                    result.error="SETMANUALMODE: value key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.setCncManual(query.value,function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'JOGMAS':
                if(!query.axis)
                {
                    var result={};
                    result.error="JOGMAS: axis key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.jogAxis(query.axis, "+",function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'STOPCNC':
                texInterface.stopCNC(function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'JOGMENOS':
                if(!query.axis)
                {
                    var result={};
                    result.error="JOGMENOS: axis key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.jogAxis(query.axis,"-", function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'SETJOGVELO':
                if(!query.axis)
                {
                    var result={};
                    result.error="SETJOGVELO: axis key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                if(!query.value)
                {
                    var result={};
                    result.error="SETJOGVELO: value key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.setJogVelo(query.axis,query.value, function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'JOGSTOP':
                if(!query.axis)
                {
                    var result={};
                    result.error="JOGSTOP: axis key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.jogAxis(query.axis, "0",function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'GETVARS':
                if(!query.type)
                {
                    var result={};
                    result.error="GETVARS: type key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                if(!query.from)
                {
                    var result={};
                    result.error="GETVARS: from key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                if(!query.to)
                {
                    var result={};
                    result.error="GETVARS: to key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.getVariables(query.type, query.from, query.to ,function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'GETVAR':
                if(!query.type)
                {
                    var result={};
                    result.error="GETVAR: type key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                if(!query.number)
                {
                    var result={};
                    result.error="GETVAR: number key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.getVariables(query.type, query.number, query.number ,function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'SETVAR':
                if(!query.type)
                {
                    var result={};
                    result.error="SETVAR: type key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                if(!query.number)
                {
                    var result={};
                    result.error="SETVAR: number key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                if(!query.value)
                {
                    var result={};
                    result.error="SETVAR: value key not present in query";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.setVar(query.type, query.number, query.value,function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'GETGLOBALS':
                getGlobals(function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'COMPILEPLC':
                console.log('COMPILEPLC');
                texInterface.compilePLC(function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'GETTRANSMISSIONINFO':
                console.log(texInterface.transmissionInfo);
                sendJSONResponse(res,{transmissionInfo:texInterface.transmissionInfo});
                break;
            case 'CLEARJOBS':
                console.log('CLEAR JOBS');
                texInterface.clearJobs(function(result){
                    sendJSONResponse(res,result);
                });
                break;
            case 'LOADGCODE':
                // 20131009: ahora solo conectamos y abrimos cuando nos manden un archivo
                if(texInterface.initOptions.texOptimize==true)
                {
                    texInterface.open(texOpts);
                    texInterface.interval=setInterval(function() {texInterface.iteraAutomata();},1000);
                }

                if(!query.content_B || query.content_B.length==0)
                {
                    var result={};
                    result.error="LOADGCODE: content_B key not present or empty";
                    sendJSONResponse(res,result);
                    break;
                }
                texInterface.LoadGCode(query.content_B,query.jobName, query.jobParams,function(result){
                    sendJSONResponse(res,result);
                });
                break;
            default:
                var result={};
                result.error=query.cmd + " unknown command";
                sendJSONResponse(res,result);
                break;
        }
    }
}




var server = http.createServer(
    function (req, res)
    {
        var url = require('url').parse(req.url);

        var pathfile = url.pathname;
        var queryData="";

        // tengo un post.
        if(req.method == 'POST') {
            req.on('data', function(data) { queryData += data; });
            req.on('end', function() {
                var query = JSON.parse(queryData);
                processRequest(res, query);
            });
        }
        else if(req.method == 'GET') {
            if (pathfile!='/request') {
                staticServer.serve(req, res);
            }
            else {
                requestCounter++;
                var query=querystring.parse(url.query);
                processRequest(res, query);
            }
        }
    }
);

server.listen(config.initialOptions.webPort);


