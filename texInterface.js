

// Inicialmente me creo una funcion autollamante con su ambito interno y tal..., ya se pasara a factory para el tema del middleware
// devuelvo un interfaz publico y listo

function generatorFunc(machineConfig) {

    // requires genericos a utilizar
    var printf = require("printf");
    var when = require("when");
    var utils = require("./utils.js");

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


    // creo el directorio temp para guardar los archivos temporales...
    {
        var fs = require('fs');
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
    }

    // Cosas del FTP... me creo el ftp y le enchufo los eventos.
    {
        var ftpResultMsg="ftp not connected";
        var ftpReady=false;
        var ftp = require('ftp');
        var myFTP=new ftp();
        myFTP.on('ready', function(err) {
            console.log("ftpReady ");
            ftpResultMsg="ftpReady";
            ftpReady=true;
        });
        myFTP.on('connect', function(err) {
            console.log("ftpConnecting ");
            ftpResultMsg="ftpConnecting...";
            ftpReady=false;
        });
        myFTP.on('close', function(err) {
            if(err && err.msg){
                console.log("ftpClosed: " + err.msg);
                ftpResultMsg="ftpClosed: " + err.msg;
            }
            else {
                console.log("ftpClosed!");
                ftpResultMsg="ftpClosed!";
            }
            ftpReady=false;
        });
        myFTP.on('end', function(err) {
            if(err && err.msg) {
                console.log("ftpEnd " + err.msg);
                ftpResultMsg="ftpEnd " + err.msg;
            }
            else {
                ftpResultMsg="ftpEnd!";
                console.log("ftpEnd!");
            }
            ftpReady=false;
        });
        myFTP.on('data', function(chunk) {
            if(chunk && chunk.length)
                console.log("ftpData: " + chunk.length);
        });
        myFTP.on('error', function(err) {
            if(err && err.msg) {
                console.log("ftpError: " + err.msg);
                ftpResultMsg="ftpError " + err.msg;
            }
            else {
                ftpResultMsg="ftpError!";
                console.log("ftpError!");
            }
            ftpReady=false;
        });
        myFTP.on('timeout', function() {
            console.log("ftpTimeout");
            ftpResultMsg="ftpTimeout!  Aborted transmision";
            myFTP.abort();
            ftpReady=false;
        });
        myFTP.on('finish', function() {
            ftpResultMsg="Finish transmision";
            console.log("finish");
        });
    }

    // modelo de datos y variables globales
    {
        var globalRequests=0;
        var firstTimeGlobals=true;
        var texData={
            machineConfig:machineConfig,
            status:"start",
            connStatus:'closed',
            transQueue:[],
            maxTSize:0,
            //////////////////////////////
            initOptions:{},
            //////////////////////////////
            interval:0,
            manualInterval:undefined,
            globals:{nrequest:0},
            transmissionInfo:{},
            jobQueue:[],
            curJob:new JobInfo(),
            texCurJob:new TexJobInfo(),
            ///////////////////////////////
            popJobWhenMilling:false,
            sendindStatus:"none",
            currentJobName:"",
            filesSended:0,
            filesToSend:0,
            ftpCurProgress:0,
            curCommand:""
        };
    }

    // funciones helper...
    {
        function addStringToArray(str,b){
            for (var i=0; i<str.length; i++){
                b.push(str.charCodeAt(i));
            }
        }

        function getFrameStart(numBytes){
            var b=[];
            addStringToArray("TexCom01",b);
            b.push(0);
            b.push(numBytes);
            return b;
        }
    }

    // funciones internas
    {


        function LoadGCode(content_B, qjobName, qjobParams, callback){
            // de momento esta funcion no tendra promesas
            var result={};

            // ya estoy enviando un archivo... no puedo enviar otro
            if(texData.sendindStatus=="sending") {
                result.resvalue=400;
                result.msg='LoadGCode: cant send another file while sending is in progress!';
                console.log(result.msg);
                if(callback)
                    callback(result);
                return;
            }


            // control de errores
            var v980=99;
            if(texData.globals.v980==undefined)
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
                v980=parseInt(texData.globals.v980);
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
            // el ftp no esta ready
            if(ftpReady==false)
            {
                result.resvalue=400;
                result.msg='LoadGCode: ftp connection not ready. Try again in few seconds.';
                console.log(result.msg);
                if(callback)
                    callback(result);
                return;
            }

            if (texData.connStatus!='ready' && texData.connStatus!='connecting' && texData.connStatus!='waitAck'){
                result.resvalue=400;
                result.res="commandError";
                result.msg='LoadGCode: NotConnectedWithTex';
                texData.texLastMsg='LoadGCode: NotConnectedWithTex';
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
                ParteGCode(gcode, function(res, filesToSend,timeStamp) {
                    // se ha partido ok
                    if(res==true)
                    {
                        var ss="file"+timeStamp+printf("_%d.iso",filesToSend);
                        var jobName=ss;
                        var jobParams="12345";
                        if(qjobName) jobName=qjobName;
                        if(qjobParams) jobParams=qjobParams;

                        // el FTP no esta ready..
                        if(ftpReady==false)
                        {
                            result.resvalue=400;
                            result.msg='LoadGCode: ftp connection not ready. Try again in few seconds.';
                            console.log(result.msg);
                            if(callback)
                                callback(result);
                            return;
                        }

                        // gr
                        var fname=pathTemp+"\\"+ss;
                        var rname="G:\\iso1.iso";
                        ftpResultMsg="sending " + fname;
                        console.log("sending "+ rname);
                        myFTP.on('progress',function(progress) {
                            texData.ftpCurProgress=progress;
                            ftpResultMsg="sending " + texData.ftpCurProgress + " " + fname;
                        });
                        texData.ftpCurProgress=0;
                        myFTP.put(fname, rname,function(err) {
                            // Ha fallado el envio del fichero
                            if (err)
                            {
                                ftpResultMsg=err.msg;
                                console.log(err.msg);
                                texData.ftpCurProgress=0;
                                texData.setVar('V',"980",100);
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
                                texData.ftpCurProgress=100;
                                result.resvalue=200;
                                result.msg='LoadGCode: OK.';
                                console.log(result.msg);
                                texData.sendindStatus="ready"

                                // Anyado el trabajo
                                var j=new JobInfo();
                                j.jobName=jobName;
                                j.jobParams=jobParams;
                                j.internalJobName=ss;
                                j.created=timeStamp;
                                j.filesSended=0;
                                j.filesToSend=filesToSend;
                                j.status="ready to mill";
                                texData.curJob=j;

                                texData.setVar('V',"980",0);
                                texData.setVar('V',"981",1);
                                if(callback)
                                    callback(result);
                                return;
                            }
                        });
                        texData.sendindStatus="sending";

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



        function ParteGCode(gcode, callback) {
            var partes=1;
            console.log("ParteGCode");

            // Obtengo el timeStamp para grabar los archivos a disco...
            var dateTime = new Date;
            var timeStamp=printf("%02d%02d%02d",dateTime.getHours(),dateTime.getMinutes(),dateTime.getSeconds());

            // 20131010: permito la grabacion de solo un fichero, sin partir, en funcion de los params
            var fname=pathTemp+"\\file"+timeStamp+printf("_%d.iso",partes);
            var sToWrite=gcode;
            sToWrite+="\nM70";

            var promises=[];
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
        }

        function iteraAutomata() {
            // miro las globals...
            // compruebo conexion con tex
            if(checkConnection()==false)
            {
                texData.globals={};
                texData.globals.gstatus="error";
                return;
            }

            // el tex esta conectado.. pido las globals...
            getTexGlobals();

            // si el ftp no esta conectado... reconecto.
            if(myFTP.connectStatus()=='closed')
            {
                console.log("trying conecting with FTP...");
                ftpResultMsg="trying conecting with FTP...";
                myFTP.connect( {host: texData.host, user: texData.ftpUser, password: texData.ftpPass } );
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
            if(globalRequests<texData.globals.nrequest)
                globalRequests=texData.globals.nrequest;
            else
                return;
            if(texData.globals.gstatus!='ok')
                return;

            // esta perfecto pues a procesar el status...
            var v980=100;
            switch(texData.status)
            {
                case "closing":
                    console.log("closing!!");
                    texData.jobQueue=[];
                    closeConnection();
                    break;


                case "ready":

                    v980=parseInt(texData.globals.v980);

                    if(v980>0 && v980<100)
                        texData.curJob.fileMilling=v980;
                    else if (v980==100)
                        texData.curJob=new JobInfo();

                    break;
            }
        }

        function setOutput(output,value,callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='setOutput: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
            }
            else
            {
                var str;
                value=''+value;
                if(value=='1')
                    str=printf("KSO%04d",output);
                else
                    str=printf("KRO%04d",output);

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(){
                    texData.texStatus='ok';
                    texData.texLastMsg="";
                    if(callback)
                        callback(texData.texLastMsg);
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="setOutput: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        }


        /*function kbHit(value,callback){
            if (texData.connStatus!='ready'){
                texData.texLastMsg='kbHit: NotConnectedWithTex';
                if(callback)
                    callback(texData.texLastMsg);
            }
            else
            {
                var str="CP+";

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        texData.texStatus="commandError";
                        texData.texLastMsg="kbHit:"+checkData.errormsg;
                    }
                    else
                    {
                        texData.texStatus='ok';
                        texData.texLastMsg="kbHit sent";
                    }
                    if(callback)
                        callback(texData.texLastMsg);
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="kbHit: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        }*/


        function getJogVeloAxis(){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getJogVeloAxis";

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getJogVeloAxis: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var promises=[];

                if(texData.globals && texData.globals.axisNames)
                {
                    for(var i=0;i<texData.globals.axisNames.length-1;i++)
                        promises.push(getMachineParameter(i+1,3));
                }

                // compruebo si todas las peticiones!!
                when.all(promises).then(function(results){
                    texData.curCommand=result.what;
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
        }


        function getStatusAxis(){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getStatusAxis";

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getStatusAxis: NotConnectedWithTex";
                deferred.reject(result);
            }
            else
            {
                var str;
                str="SQ/";
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    var checkData=checkDataResponse(data);
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
                        if(!str.match(/^A--/g))
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

        function getMachineParameter(pagina, parNumber){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getMachineParameter_"+pagina+"_"+parNumber;

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getMachineParameter: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str;
                str=printf("Rx+%d,%d",pagina, parNumber);
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
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
                    texData.curCommand=result.what;
                    result.res="connectionError";
                    result.msg="getMachineParams: could not send command";
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        };

        function setMachineParameter(pagina, parNumber, value, callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='setMachineParameter: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
            }
            else
            {
                var str;
                var pag=parseInt(pagina)+1;
                str=printf("EX-%d,%d,%s",pag,parNumber,value);
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        texData.texLastMsg="setMachineParameter:"+checkData.errormsg;
                        if(callback)
                            callback(texData.texLastMsg);
                    }
                    else
                    {
                        texData.texStatus='ok';
                        texData.texLastMsg="";

                        if(callback)
                            callback("setMachineParameter: " + pagina + "," + parNumber + "=" + value + " OK");
                    }
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="setMachineParameter: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        };


        function getVar(varType, number){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getVar"+varType+number;

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getVar: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str;
                str=printf("J%cC%s",varType,number);
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
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
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        };


        function getInfoVar(varType, number){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getInfoVar"+varType+number;

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getInfoVar: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
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
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        result.res="commandError";
                        result.msg="getInfoVar:"+checkData.errormsg;
                        deferred.reject(result);
                    }
                    else
                    {
                        var str=data.toString();
                        if(!str.match(/^E--/g))
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
                    texData.curCommand=result.what;
                },function(){
                    result.res="conectionError";
                    result.msg="getInfoVar: could not send command";
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        };


        function getSysVar(varType, number){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getSysVar"+varType+number;

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getSysVar: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str;
                str=printf("J%c-%s",varType,number);
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
                    if(checkData.res==false)
                    {
                        result.res="commandError";
                        result.msg="getSysVar:"+checkData.errormsg;
                        deferred.reject(result);
                    }
                    else
                    {
                        var str=data.toString();
                        if(!str.match(/^JS-/g))
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
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        };

        function getSInfo(number){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getSInfo"+number;

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getSInfo: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str;
                str=printf("SZS%04d0",number);
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
                    if(checkData.res==false)
                    {
                        result.res="commandError";
                        result.msg="getSysVar:"+checkData.errormsg;
                        deferred.reject(result);
                    }
                    else
                    {
                        var str=data.toString();
                        if(!str.match(/^E--/g))
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
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        };


        function getLastError(){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getLastError";

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getLastError: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str="SE+";
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
                    if(checkData.res==false)
                    {
                        result.res="commandError";
                        result.msg="getLastError:"+checkData.errormsg;
                        deferred.reject(result);
                    }
                    else
                    {
                        var str=data.toString();
                        if(!str.match(/^EE-/g))
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
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        };

        function getOverFeed(){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getOverFeed";

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getOverFeed: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str;
                str=printf("OR-0");

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
                    if(checkData.res==false)
                    {
                        result.res="commandError";
                        result.msg="getOverFeed:"+checkData.errormsg;
                        deferred.reject(result);
                    }
                    else
                    {
                        var str=data.toString();
                        if(!str.match(/^O--/g))
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
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        }

        function setOverFeed(value,callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='setOverFeed: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
            }
            else
            {
                var str;
                str=printf("OT-%d",value);

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                        texData.texLastMsg="setOverFeed:"+checkData.errormsg;
                    else
                    {
                        texData.set='ok';
                        texData.texLastMsg="setOverFeed OK";
                    }
                    if(callback)
                        callback(texData.texLastMsg);
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="setOverFeed: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        }

        function setJogVelo(axis, value,callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='setJogVelo: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
            }
            else
            {
                // pagina 1-4 y numero variable 3 para la velocidad del jog
                texData.setMachineParameter(axis,3,value,callback);
                texData.setMachineParameter(axis,19,value,callback);
                texData.saveParamsInEPROM(callback);
            }
        }

        function jogAxis(axis,dir,callback){
            if (texData.connStatus!='ready'){
                texData.texStatus="jogAxis: NotConnectedWithTex";
                if(callback)
                    callback(texData.texLastMsg);
            }
            else
            {

                var str="M"+texData.globals.axisNames[axis]+dir;

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                        texData.texLastMsg="jogAxis:"+checkData.errormsg;
                    else
                        texData.texLastMsg="jogAxis:ok";

                    if(callback)
                        callback(texData.texLastMsg);
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="jogAxis: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        }

        function stopCNC(callback){
            if (texData.connStatus!='ready'){
                texData.texStatus="stopCNC: NotConnectedWithTex";
                if(callback)
                    callback(texData.texLastMsg);
            }
            else
            {
                var str="mW-";
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);

                    if(checkData.res==false)
                    {
                        texData.texLastMsg="stopCNC: "+checkData.errormsg;
                        if(callback)
                            callback(texData.texLastMsg);

                    }
                    else
                    {
                        texData.texLastMsg="stopCNC:ok";
                        if(callback)
                            callback(texData.texLastMsg);

                    }
                },function(){
                    console.log("stopCNC Error contection");
                    texData.texStatus='connectionError';
                    texData.texLastMsg="stopCNC: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        };

        function processManual(callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg="processManual: NotConnectedWithTex";
                if(callback)
                    callback(texData.texLastMsg);
            }
            else
            {
                var str;
                str=printf("mw-");

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        texData.texLastMsg="processManual:"+checkData.errormsg;
                    }
                    else
                    {
                        texData.texStatus='ok';
                        texData.texLastMsg="processManual OK";
                    }
                    if(callback)
                        callback(texData.texLastMsg);
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="processManual: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        };

        function moveAxis(axis,pos,callback){
            if (texData.connStatus!='ready'){
                texData.texStatus="moveAxis: NotConnectedWithTex";
                if(callback)
                    callback(texData.texLastMsg);
            }
            else
            {
                var str;
                if(texData.globals && texData.globals.axisNames && texData.globals.axisNames.length>axis)
                    axis=texData.globals.axisNames[axis];
                else
                {
                    texData.texLastMsg="moveAxis: not found " + axis + " axis at system";
                    console.log(texData.texLastMsg);
                    if(callback)
                        callback(texData.texLastMsg);
                    return;
                }
                str=printf("mg-%c%.2f",axis,pos);

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        texData.texLastMsg="moveAxis:"+checkData.errormsg;
                    }
                    else
                    {
                        texData.texStatus='ok';
                        texData.texLastMsg="moveAxis OK";
                    }
                    if(callback)
                        callback(texData.texLastMsg);
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="moveAxis: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        };

        function setVar(varType, number, value, callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='setVar: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
            }
            else
            {
                var str;
                str=printf("J%cc%s,%s",varType,number,value);
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        texData.texLastMsg="setVar:"+checkData.errormsg;
                        if(callback)
                            callback(texData.texLastMsg);
                    }
                    else
                    {
                        texData.texStatus='ok';
                        texData.texLastMsg="";

                        if(callback)
                            callback("SetVar: " + varType + number + "=" + value + " OK");
                    }
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="setVar: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        };

        function getVariables(type, from, to,callback){
            if (texData.connStatus!='ready'){
                texData.texStatus="NotConnectedWithTex";
                if(callback)
                    callback(texData.texLastMsg);
            }
            else
            {
                var ifrom, ito;
                ifrom=parseInt(from);
                ito=parseInt(to);

                if(ifrom>ito) {
                    var iaux=ito; ito=ifrom; ifrom=iaux;
                }

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

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        texData.texStatus='error';
                        texData.texLastMsg="getVariables:"+checkData.errormsg;
                        if(callback)
                            callback(texData.texLastMsg);
                    }
                    else
                    {
                        // Aqui obtengo el estado de los ejes...
                        var str=data.toString();
                        var values;
                        str=str.substring(10);

                        if(!str.match(patt))
                        {
                            texData.texStatus='commandError';
                            texData.texLastMsg="getVariables: wrong response command";
                            if(callback)
                                callback(texData.texLastMsg);
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
                            if(callback)
                                callback(variables);
                        }
                    }
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="getVariables: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        };

        function setCncManual(value,callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='setCncManual: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
            }
            else
            {
                var str;
                if(value=="true" || value=="1")
                    str="mc-";
                else str="md-";

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        texData.texStatus='error';
                        texData.texLastMsg="setCncManual:"+checkData.errormsg;
                        if(callback)
                            callback(texData.texLastMsg);
                    }
                    else
                    {
                        texData.texStatus='ok';
                        texData.texLastMsg="setCncManual ok";
                        if(callback)
                            callback(texData.texLastMsg);
                    }
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="setCncManual: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        }


        function getPosVeloAxis(axisNames){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getPosVeloAxis";

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getPosVeloAxis: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str;
                str=printf("SQ-%s",axisNames);
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
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
                    if(!str.match(/^M--/g))
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
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        };



        function saveParamsInEPROM(callback){
            if (texData.connStatus!='ready'){
                texData.texStatus="saveParamsInEPROM: NotConnectedWithTex";
            }
            else
            {
                var str;
                str=printf("EX+");

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                        texData.texLastMsg="saveParamsInEPROM:"+checkData.errormsg;
                    else
                    {
                        texData.texStatus='ok';
                        texData.texLastMsg="saveParamsInEPROM OK";
                    }
                    if(callback)
                        callback(texData.texLastMsg);
                },function(){
                    texData.texStatus='connectionError';
                    texData.texLastMsg="saveParamsInEPROM: could not send command";
                    if(callback)
                        callback(texData.texLastMsg);
                });
            }
        }

        function checkDataResponse(data){
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
        }

        function sendNow(){
            if (texData.connStatus!='ready'){
                texData.texLastMsg="sendNow: not ready";
                return;
            }
            if (texData.transQueue.length==0){ // no tiene sentido
                return;
            }
            var o=texData.transQueue[0];
            texData.tcpClient.write(o.buffer);

        }

        function sendCommand(buffer,callback,error){
            texData.transQueue.push({buffer:buffer,callback:callback,error:error});
            if (texData.transQueue.length>texData.maxTSize){
                texData.maxTSize=texData.transQueue.length;
            }
            if (texData.transQueue.length==1){
                sendNow();
            }
        }

        function checkConnection(){
            switch(texData.connStatus){
                case 'closed':
                    texData.connStatus='connecting';
                    setTimeout( function() { startConnection() },0);
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
        }

        function closeConnection(){
            console.log('Closing tex conexions');

            texData.popJobWhenMilling=false;
            if(texData.interval!=undefined)
                clearInterval(texData.interval);
            if(texData.manualInterval!=undefined)
                clearInterval(texData.manualInterval);
            texData.tcpClient.end();
            texData.tcpClient.destroy();

            if(myFTP.connectStatus()=='open')
                myFTP.abort();
            myFTP.end();
        }

        function startConnection(){
            var net = require('net');

            // creo la conexion con el TEX a traves de un Socket TCP
            var HOST = texData.host;
            var PORT = texData.port;
            texData.status="start";
            texData.connStatus="connecting";

            var client = new net.Socket();
            // Add a 'data' event handler for the client socket, data is what the server sent to this socket
            client.on('data', function(data) {
                switch(texData.connStatus){
                    case 'waitAck':
                        // si estoy a la espera de recibir ack pero no lo recibo...
                        if (data.length!=1 || data.readUInt8(0)!=6){
                            client.destroy();
                            texData.connStatus="closed";
                            texData.curCommand="waitAck";
                        }
                        else {
                            texData.connStatus="ready";
                            texData.status="ready";
                            texData.texStatus="ok";
                            texData.texLastMsg="";
                            texData.curCommand="ready";

                            console.log("tex ready");
                            console.log("connecting to ftp with host: "+texData.host);

                            myFTP.connect( {host: texData.host, user: texData.ftpUser, password: texData.ftpPass } );
                            // Aqui pongo los comandos de depuracion para comprobar que van
                        }
                        break;
                    case 'ready':
                        if (texData.transQueue.length>0){
                            var peticion=texData.transQueue[0];
                            if (peticion.callback)
                                peticion.callback(data);
                            texData.transQueue=texData.transQueue.splice(1);
                            sendNow();
                        }
                        break;

                }
            });
            // Add a 'close' event handler for the client socket
            client.on('close', function() {
                // Enviar error en el callback de error. esto tenemos que verlo
                console.log('Closed: Connection closed');
                texData.transQueue=[];
                texData.connStatus='closed';
                texData.status="closed";
                texData.curCommand="";

                if(myFTP.connectStatus()=='open')
                    myFTP.abort();
                myFTP.end();
                client.destroy();
            });
            client.on('error',function(){
                console.log("Connection error");
                texData.transQueue=[];
                texData.connStatus='error';
                texData.status="error";
            });
            client.on('timeout',function(){
                console.log("CurCommand: " + texData.curCommand + " - ConnStatus:" + texData.connStatus);
                console.log('Tex Socket Timeout');
                // comento esto porque da problemas
                /*texData.transQueue=[];
                 texData.connStatus='closed';
                 texData.status="closed";
                 texData.curCommand="";
                 if(myFTP.connectStatus()=='open')
                 myFTP.abort();
                 myFTP.end();
                 client.destroy();*/
            });

            client.setTimeout(3000);
            console.log('Connecting to tex...');
            client.connect(PORT, HOST, function() {
                console.log('CONNECTED TO: ' + HOST + ':' + PORT);
                texData.connStatus="waitAck";
                client.write('15','hex');
                texData.curCommand="waitAck";
            });

            texData.tcpClient=client;
        }

        // Le pide las outputs al TEX y devuelve una promesa
        function getOutputs(){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getOutputs";

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getOutputs: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str;
                str=printf("KXO");
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
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
                        if(!str.match(/^KXO/g))
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
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        }

        // Le pide las inputs al TEX y devuelve una promesa
        function getInputs(){
            var deferred=when.defer();
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="getInputs";

            if (texData.connStatus!='ready'){
                result.res="connectionError";
                result.msg="getInputs: NotConnectedWithTex";
                texData.curCommand=result.what;
                deferred.reject(result);
            }
            else
            {
                var str;
                str=printf("KXI");
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    var checkData=checkDataResponse(data);
                    texData.curCommand=result.what;
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
                        if(!str.match(/^KXI/g))
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
                    texData.curCommand=result.what;
                    deferred.reject(result);
                });
            }
            return deferred.promise;
        }
    }

    // funciones exportadas
    {
        function getFtpStatus(){
            var ftpStatus={};
            ftpStatus.connectStatus=myFTP.connectStatus();
            ftpStatus.ftpCurProgress=texData.ftpCurProgress;
            ftpStatus.ftpResultMsg=ftpResultMsg;
            return ftpStatus;
        }

        function open(){
            console.log("Open: Machine config ",texData.machineConfig);
            console.log("opening interface");

            texData.host=texData.machineConfig.machineHost||"192.168.0.200";
            texData.port=texData.machineConfig.machinePort||6000;
            texData.ftpUser=texData.machineConfig.ftpUser;
            texData.ftpPass=texData.machineConfig.ftpPass;

            startConnection();
        }

        function close() {
            console.log("closing interface");
            closeConnection();
        }

        function clearJobs(callback){
            texData.jobQueue=[];
            texData.curJob=new JobInfo();
            texData.setVar('V',"980",100);

            var result={};
            result.msg="ClearJob Queue OK";
            callback(result);
        }


        function compilePLC(callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='compilePLC: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
            }

            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="compilePLC";

            console.log("compilePLC...");

            var str;
            str=printf("CP-");

            var b=getFrameStart(str.length);
            addStringToArray(str,b);
            var buffer=new Buffer(b);

            sendCommand(buffer,function(data){
                // aqui obtengo el resultado... en data
                var checkData=checkDataResponse(data);
                texData.curCommand="compilePLC";
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
                texData.curCommand=result.what;
                texData.status=backStatus;
                if(callback)
                {
                    callback({result:"error", error:result.msg});
                    return;
                }
            });

        }

        function getEditor(type, callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='getEditor: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
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
                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
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
                    texData.curCommand=result.what;
                },function(){
                    result.res="conectionError";
                    result.msg="getEditorPacket: could not send command";
                    console.log(result.msg);
                    texData.curCommand=result.what;
                    if(callback)
                    {
                        callback({result:"error", error:result.msg});
                        return;
                    }
                });
            }

            getEditorPacket(type, index, callback);

        };

        function setEditor(type, contentEditor, callback){
            if (texData.connStatus!='ready'){
                texData.texStatus='NotConnectedWithTex';
                texData.texLastMsg='setEditor: NotConnectedWithTex';
                if(callback)
                    callback(texData.texStatus);
            }

            var index=0;
            var result={ what:undefined, res:undefined, msg:undefined };
            result.what="setEditor";
            console.log("setEditor");
            var totalBytesToSend=contentEditor.length;
            var totalBytesSent=0;

            if(texData.status=='bussy') {
                if(callback)
                {
                    callback({result:"error", error:"texInterface is bussy with another task... wait until ready"});
                    return;
                }
            }
            var backStatus=texData.status;
            texData.status="bussy";
            texData.transmissionInfo={curPacket:index, totalBytesToSend:totalBytesToSend, totalBytesToSent:totalBytesSent};

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

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        result.res="commandError";
                        result.msg="setEditorPacket:"+checkData.errormsg;
                        console.log(result.msg);
                        texData.status=backStatus;
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
                            texData.status=backStatus;
                            if(callback)
                                callback({result:"ok", data:undefined});
                            return;
                        }
                        else{
                            texData.transmissionInfo={curPacket:index, totalBytesToSend:totalBytesToSend, totalBytesToSent:totalBytesSent};

                            index++;
                            setEditorPacket(type, contentEditor, index, callback);
                        }
                    }
                    texData.curCommand=result.what;
                },function(){
                    result.res="conectionError";
                    result.msg="setEditorPacket: could not send command";
                    console.log(result.msg);
                    texData.status=backStatus;
                    texData.curCommand=result.what;
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

                var b=getFrameStart(str.length);
                addStringToArray(str,b);
                var buffer=new Buffer(b);

                sendCommand(buffer,function(data){
                    // aqui obtengo el resultado... en data
                    var checkData=checkDataResponse(data);
                    if(checkData.res==false)
                    {
                        result.res="commandError";
                        result.msg="prepareToSetEditor:"+checkData.errormsg;
                        texData.status=backStatus;
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
                    texData.curCommand=result.what;
                },function(){
                    result.res="conectionError";
                    result.msg="prepareToSetEditor: could not send command";
                    console.log(result.msg);
                    texData.curCommand=result.what;
                    texData.status=backStatus;
                    if(callback)
                    {
                        callback({result:"error", error:result.msg});
                        return;
                    }
                });

            }

            prepareToSetEditor(type, contentEditor, index, callback);
        }



    }



    // cosas para exportar
    {
        var interfaz={
            open:open,
            close:close,
            reconnect: reconnect,
            //////////////////////////
            getFtpStatus: getFtpStatus,
            clearJobs: clearJobs
        };

        return interfaz;
    }

};

module.exports = {generatorFunc: generatorFunc};





texInterface.prototype.getTexGlobals=function(){
    // Aqui iremos solicitando datos...
    var yo=this;
    var aux;

    var nextGlobals={ };
    nextGlobals.nrequest=texData.globals.nrequest;

    var promises=[];
    promises.push(texData.getMachineParameter(0,0));
    promises.push(texData.getSysVar('S',"0272"));
    promises.push(texData.getSysVar('S',"0004"));
    promises.push(texData.getSysVar('S',"0005"));
    promises.push(texData.getSysVar('S',"0013"));
    promises.push(texData.getSysVar('S',"0336"));
	
	if(!firstTimeGlobals)
	{
		if(texData.globals.cncManualMode==false)
		{
			promises.push(texData.getVar("V","980"));
			promises.push(texData.getVar("V","981"));
			promises.push(texData.getSInfo(10));
			promises.push(texData.getInfoVar('I',105));
		}
	}
	else
	{
		firstTimeGlobals=false;
	}
	
    promises.push(texData.getLastError());
    promises.push(texData.getInputs());
    promises.push(texData.getOutputs());
    promises.push(texData.getOverFeed());
    promises.push(texData.getStatusAxis());
	if(texData.globals && texData.globals.axisNames && texData.globals.axisNames.length>0)
		promises.push(texData.getPosVeloAxis(texData.globals.axisNames));
    promises.push(texData.getJogVeloAxis());



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
        texData.globals=nextGlobals;

        if(nextGlobals.cncManualMode==true && texData.manualInterval==undefined)
		{
			texData.manualInterval=setInterval(function(){texData.processManual();},1000);
		}
		if(nextGlobals.cncManualMode==false && texData.manualInterval!=undefined)
		{
			clearInterval(texData.manualInterval);
			texData.manualInterval=undefined;
		}

        texData.texCurJob.fileMilling=nextGlobals.v980;
        texData.texCurJob.filesToMill=nextGlobals.v981;
        texData.texCurJob.curLine=nextGlobals.curIsoLine;
        if(nextGlobals.v980>0 && nextGlobals.v980<100)
            texData.texCurJob.curProgName=nextGlobals.curProgName;
        else texData.texCurJob.curProgName="";


    },function(results){
        nextGlobals.gstatus="error";
        nextGlobals.results=results;
        texData.globals=nextGlobals;
    });
};










