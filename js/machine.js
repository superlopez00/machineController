

    if (typeof console == "undefined") {
        this.console = {log: function() {}};
    }

/*
    USAREMOS MVC:
        MODELO: En el modelo pondremos todos los datos necesarios, en este caso las globals... y cosas como ventana activa y demas...
        VISTA: La vista se encargará de leer el modelo y actualizar si toca los datos que vemos
        CONTROLADOR: será el encargado de recibir los eventos desde la pagina, mandar las ordenes oportunas a la maquina y actualizar el modelo.
                    Luego si procede entonces lanzará la llamada de Update a la vista.

 */

var cncMachineModel={
    blockJog: 0,
    globals: [],
	settings: {settingsOk:false},
    callbacks:[],
    subscribeView:function(view,callback){
        this.callbacks.push({view:view,callback:callback});
    },
    setISOFile:function(isoText){
        this.isoText=isoText;
        this.notifyChanges();
    },

    setGlobals:function(globals){
        this.globals=globals;
        this.notifyChanges();
    },

    notifyChanges:function(){
        for (var i=0; i<this.callbacks.length; i++){
            this.callbacks[i].callback.call(this.callbacks[i].view);
        }
    }
};

function checkByte(sbytes,iNumber){
	var iarray=sbytes.split(',');
	// cara array son 8 inputs...
	var index=Math.floor(iNumber/8);
	var bit=iNumber%8;
	if(iarray.length<=index)
		return false;
	var val=iarray[index];
	var bitVal=Math.pow(2,bit);
	if((bitVal&val)!=0)
		return true;
	return false;
}


var cncMachineController={
    timerJogMas: 0,
    timerJogMenos: 0,
    timerBlockJog: 0,


    loadGCode: function(data){

        var self=this;

        console.log("encoding");
        var gcode=utils.SBase64.encode(data);
        gcode="cmd=LOADGCODE&jobName=userJob&jobParams=12345&content_B="+gcode;
        console.log("encoded");
        var surl="/request?"

        $.ajax({
            data:  gcode,
            url:   surl,
            type:  'POST',
            timeout: 100000,
            success:  function(data,textStatus){

                console.log(textStatus);

/*                var responseData =self.ajaxOKCallback(data,textStatus,thisParams);

                if (responseData.returnMsg) {
                    var msg = mvc.newMsg(responseData.returnMsg);
                    if (msg) {
                        if (msg.params && responseData.response)
                            SExtend(msg.params,responseData.response);
                        mvc.sendMsg(msg);
                    }
                }

                if (responseData.returnMsg == "msg.serverError" || responseData.returnMsg == "msg.noAuth" ||  responseData.isError)
                    d.reject(responseData);
                else
                    d.resolve(responseData);*/
            },
            error:    function(data,textStatus){
                console.log(textStatus);

                /*
                var responseErrorData =self.ajaxFailCallback(data,textStatus,thisParams);

                if (responseErrorData.returnMsg) {
                    var msg = mvc.newMsg(responseErrorData.returnMsg);
                    if (msg) {
                        if (msg.params && responseErrorData.response)
                            SExtend(msg.params,responseErrorData.response);
                        mvc.sendMsg(msg);
                    }
                }

                if (responseErrorData.isError)
                    d.reject(responseErrorData);
                else
                    d.resolve(responseErrorData);*/
            }

        });
    },
	getSettings:function(){
		var self=this;
		$.ajax({
			url:'/request?cmd=GETSETTINGS',
			success:function(data){
				console.log("getSettings: OK");
                cncMachineModel.settings=data.settings;
				console.log(cncMachineModel.settings);
			},
			error:function(status,text){
				console.log("getSettings: ERROR");
                cncMachineModel.settings={settingsOk:false};
			}
		});
	},

	init:function(){
		setTimeout(cncMachineController.requestGlobals,200);
	},
	requestGlobals:function(){
		var self=this;

		// Pido las settings al servidor.
		if(cncMachineModel.settings.settingsOk==false && cncMachineController.getSettings)
			cncMachineController.getSettings();
		
		
		$.ajax({
			url:'/request?cmd=GETGLOBALS',
			success:function(data){
                cncMachineModel.globalRequest="ok";
				cncMachineModel.setGlobals(data);
				setTimeout(cncMachineController.requestGlobals,200);
			},
			error:function(status,text){
                cncMachineModel.globalRequest="error";
				//self.showError(status,text);
			}
		});
	},
	openISOFile:function(){
		// 
		var evt = document.createEvent("MouseEvents");
		evt.initEvent("click", true, false);
	},
    changeCncMode:function(value){

        var surl="/request?cmd=SETMANUALMODE&value=";
        if(value=="cncManual")
            surl+="true";
        else if(value=="cncAutomatic")
            surl+="false";
        else return;

        console.log(surl);
        $.ajax({
            url:surl,
            success:function(data){
                console.log(data);
                //cncMachineModel.setStatus("move ok");
            },
            error:function(status,text){
                //self.showError(status,text);
            }
        });
    },
    jogMenos:function(index){
        var self=this;
        self.timerJogMenos=setInterval(function(){self.jogMenosTimer(index)},100);
        self.timerBlockJog=setTimeout(function(){cncMachineModel.blockJog=1;},1000);
        console.log("jogMenos"+index);
    },
    jogMenosTimer:function(index){

        var self=this;
        if(cncMachineModel.blockJog==0)
        {
            $.ajax({
                url:'/request?cmd=JOGMENOS&axis='+index,
                success:function(data){
                    //cncMachineModel.setStatus("move ok");
                },
                error:function(status,text){
                    //self.showError(status,text);
                }
            });
        }
        //console.log("jogMenosTimer"+index);
    },
    jogMas:function(index){
        var self=this;
        self.timerJogMas=setInterval(function(){self.jogMasTimer(index)},100);
        self.timerBlockJog=setTimeout(function(){cncMachineModel.blockJog=1;},1000);
        console.log("jogMas"+index);
    },
    jogMasTimer:function(index){
        var self=this;
        if(cncMachineModel.blockJog==0)
        {
            $.ajax({
                url:'/request?cmd=JOGMAS&axis='+index,
                success:function(data){
                    //cncMachineModel.setStatus("move ok");
                },
                error:function(status,text){
                    //self.showError(status,text);
                }
            });
        }
        //console.log("jogMasTimer"+index);
    },
    setJogVelo:function(index, oldValue){

        var msg="Set New Jog Velo";
        var value=window.prompt(msg,oldValue);
        console.log("setJogVelo"+index+ " - oldValue: " + oldValue + " - newValue:"+ value);

        $.ajax({
            url:'/request?cmd=SETJOGVELO&axis='+index+'&value='+value,
            success:function(data){
                //cncMachineModel.setStatus("move ok");
            },
            error:function(status,text){
                //self.showError(status,text);
            }
        });


    },

    moveAbs:function(index,curPos){
        var self=this;
        var msg="Move to pos";
        var value=window.prompt(msg,curPos);
        console.log("moveAbs"+index+ " - curPos: " + curPos + " - newValue:"+ value);

		var params={axis:index, pos:value, speed:0};
		this.moveAxis(params);
    },

    stopCNC:function(index){
        var self=this;

        window.clearInterval(self.timerJogMas);
        window.clearInterval(self.timerJogMenos);
        window.clearTimeout(self.timerBlockJog);
        cncMachineModel.blockJog=0;

        // Mando un stop de todas las cosas !!
        if(index!=undefined)
        {
            $.ajax({
                url:'/request?cmd=JOGSTOP&axis='+index,
                success:function(data){
					console.log("MOVE OK: " + data);
                    //cncMachineModel.setStatus("move ok");
                },
                error:function(status,text){
					console.log("ERROR MOVE: " + data);
                    //self.showError(status,text);
                }
            });
        }

        $.ajax({
            url:'/request?cmd=STOPCNC',
            success:function(data){
                //cncMachineModel.setStatus("move ok");
            },
            error:function(status,text){
                //self.showError(status,text);
            }
        });



        console.log("stopCNC"+index);
    },
	setOverFeed:function(){
		// 
		var overFeed=document.getElementById("overFeed").value;
		$.ajax({
			url:'/request?cmd=SETOVERFEED&value='+overFeed,
			success:function(data){
                console.log(data);
				//cncMachineModel.setStatus("move ok");
			},
			error:function(status,text){
				//self.showError(status,text);
			}
		});
	},
	setOutput:function(index){
		// invierto la output...
		console.log("setoutput " + index);
		if(cncMachineModel.globals && cncMachineModel.globals["cncOutputs"])
		{
			var bvalue=checkByte(cncMachineModel.globals["cncOutputs"],index);
			console.log("setoutput bvalue:" + bvalue);

			var ivalue=0;
			if(bvalue==false) ivalue=1;
			if(bvalue==true) ivalue=0;
		
			$.ajax({
				url:'/request?cmd=SETOUTPUT&output='+index+'&value='+ivalue,
				success:function(data){
					console.log(data);
				},
				error:function(status,text){
					console.log("setOutput: fail");
				}
			});
		}
	},
    clearJobs:function(){
        var self=this;
        $.ajax({
            url:'/request?cmd=CLEARJOBS',
            success:function(data){
                //cncMachineModel.setStatus("move ok");
            },
            error:function(status,text){
                //self.showError(status,text);
            }
        });
    },
	homeAxis:function(axis){
		var self=this;
        var str="home"+axis;
        console.log(str);
		$.ajax({
			url:'/request?cmd=HOME&eje='+axis,
			success:function(data){
				//cncMachineModel.setStatus("move ok");
			},
			error:function(status,text){
				self.showError(status,text);
			}
		});
	},
	moveAxis:function(params){
		var self=this;
		if (!params)
			return;
		var speed=params.speed||0;
		var pos=params.pos||0;
		var axis=params.axis||0;
		$.ajax({
			url:'/request?cmd=MOVEAXIS&axis='+axis+'&pos='+pos,
			success:function(data){
				//cncMachineModel.setStatus("move ok");
			},
			error:function(status,text){
				//self.showError(status,text);
			}
		});
	},
	showError:function(status,text){
		alert("communication error connecting to machine. "+text);
	},
    getVar:function(){
        var self=this;
        var msg="GetVar:type(V,W),number";
        var value=window.prompt(msg);
        var lvalues=value.split(',');
        if(lvalues.length!=2)
            return;

        console.log("getVAR: " + lvalues);
        $.ajax({
            url:'/request?cmd=GETVAR&type='+lvalues[0]+'&number='+lvalues[1],
            success:function(data){
                console.log("GETVAR_OK: "+ data);
                //cncMachineModel.setStatus("move ok");
            },
            error:function(status,text){
                //self.showError(status,text);
                console.log("GETVAR_ERROR: "+ data);
            }
        });

    }

};




// Aqui tendremos las views...
var cncMachineView={

    // para optimizar el update... solo si cambia
    soldcurjob: "" ,
    soldjqueue: "" ,
    oldoverfeed: "",
    oldcncManualMode:undefined,
    oldnAxis:"",

	init:function(){
		cncMachineModel.subscribeView(this,this.onUpdate);
	},
	onUpdate:function(){	

        // ponemos la informacion del ultimo error
        htmlElement=document.getElementById("machineName");
        if(htmlElement)
        {
            if(cncMachineModel && cncMachineModel.globals && cncMachineModel.globals.initOptions &&
                cncMachineModel.globals.initOptions.initOptions && cncMachineModel.globals.initOptions.initOptions.name)
                htmlElement.innerHTML=cncMachineModel.globals.initOptions.initOptions.name;
        }


        htmlElement=document.getElementById("cncLastError");
        if(htmlElement)
        {   htmlElement.value=cncMachineModel.globals["cncErrorMsg"];
            if(cncMachineModel.globalRequest!="ok") htmlElement.value="GLOBAL REQUEST ERROR";
        }
        // el estado del tex
        htmlElement=document.getElementById("cncStatus");
        if(htmlElement) htmlElement.value=cncMachineModel.globals["cncStatus"];

        htmlElement=document.getElementById("cncInputs");
        if(htmlElement) htmlElement.innerHTML=cncMachineModel.globals["cncInputs"];

        htmlElement=document.getElementById("cncOutputs");
        if(htmlElement) htmlElement.innerHTML=cncMachineModel.globals["cncOutputs"];

        // manual/automatico
        // manual/automatico
        var cncManualMode=cncMachineModel.globals["cncManualMode"];
        var enableManual=cncManualMode;
        var changedManualMode=false;
        if(cncManualMode!=undefined)
        {
            if(cncManualMode!=this.oldcncManualMode)
            {
                console.log(cncManualMode);
                console.log(this.oldcncManualMode);
                htmlElement=document.getElementById("cncAutomatic");
                if(htmlElement) htmlElement.checked=!cncManualMode;
                htmlElement=document.getElementById("cncManual");
                if(htmlElement) htmlElement.checked=cncManualMode;
                this.oldcncManualMode=cncManualMode;
                enableManual=cncManualMode;
                changedManualMode=true;
            }

        }

        // Actualizamos la info de los ejes y tal...
        // como es un rollazo ir actualizando siempre la pagina... vamos a optimizar bien la cosa...
        if(cncMachineModel.globals["axisNames"])
        {
            var strDisable="";
            if(enableManual)
                strDisable="disabled";
            var nAxis=cncMachineModel.globals["axisNames"].length;
            if(nAxis!=this.oldnAxis || changedManualMode==true)
            {
                console.log("change naxis");
                var axisHtml='';
                for(var i=0;i<nAxis;i++)
                {
                    axisHtml += '<div class="colscad-4 center">' +
                        '<h2>'+ cncMachineModel.globals["axisNames"][i] + '</h2>' +
                        '</div>' +
                        '<div class="colscad-4">' +
                        '<input type="text" id="posAxis' + i + '"class="inputform w80" readonly value="' + cncMachineModel.globals["posAxis"][i] + '"></input>' +
                        '<input type="button" class="center btn btn-teal" style="width:40%" id="setPosAxis' + i + '" value="' + cncMachineModel.globals["posAxis"][i] +'" onclick="cncMachineController.moveAbs('+i+', value);" ></input>' +
                        '</div>' +
                        '<div class="colscad-4">' +
                        '<input type="text" id="veloAxis' + i + '"class="inputform w80" readonly value="' + cncMachineModel.globals["veloAxis"][i] + '"></input>' +
                        '<input type="button" class="center btn btn-teal" style="width:40%" id="jogVeloAxis' + i + '" value="' + cncMachineModel.globals["jogVeloAxis"][i] + '" onclick="cncMachineController.setJogVelo('+i+',value);" ></input>' +
                        '</div>' +
                        '<div class="colscad-4 center">' +
                        '<button class="center btn btn-teal" style="width:45%" onmouseup="cncMachineController.stopCNC('+i+');" onmousedown="cncMachineController.jogMenos('+i+');" id="jogMenos' + i + '">JOG-</button>' +
                        '<button class="center btn btn-teal" style="width:45%" onmouseup="cncMachineController.stopCNC('+i+');" onmousedown="cncMachineController.jogMas('+i+');" id="jogMas' + i + '">JOG+</button>' +
                        '</div>' +
                        '<div class="clear"></div>';
                }
                this.oldnAxis=nAxis;

                $("#axisInfo").html(axisHtml);
                $("#axisInfo").trigger("create");
            }
            else
            {
                // solo actualizo las posiciones y velocidades
                for(var i=0;i<nAxis;i++)
                {
                    htmlElement=document.getElementById("posAxis"+i);
                    if(htmlElement) htmlElement.value=cncMachineModel.globals["posAxis"][i];
                    htmlElement=document.getElementById("setPosAxis"+i);
                    if(htmlElement) htmlElement.value=cncMachineModel.globals["posAxis"][i];
                    htmlElement=document.getElementById("veloAxis"+i);
                    if(htmlElement) htmlElement.value=cncMachineModel.globals["veloAxis"][i];
                    htmlElement=document.getElementById("jogVeloAxis"+i);
                    if(htmlElement) htmlElement.value=cncMachineModel.globals["jogVeloAxis"][i];
                }
            }

            // gestion del jog y el mover si estoy en manual o automatico
            for(var i=0;i<nAxis;i++)
            {
                htmlElement=document.getElementById("setPosAxis"+i);
                if(htmlElement ) htmlElement.disabled=!enableManual;
                htmlElement=document.getElementById("jogMenos"+i);
                if(htmlElement ) htmlElement.disabled=enableManual;
                htmlElement=document.getElementById("jogMas"+i);
                if(htmlElement ) htmlElement.disabled=enableManual;
            }
        }
		
		if(cncMachineModel.settings)
		{
			// mira la inputword/outputword y ve si esta el iNumber a true, devuelve true o false
			if(cncMachineModel.settings.inputs)
			{
				var innerHTML='';
				var gray="images/gray.png";
				var green="images/green.png"
				var src="";
				for(var i=0;i<cncMachineModel.settings.inputs.length;i++)
				{
					src=gray;
					if(checkByte(cncMachineModel.globals["cncInputs"],cncMachineModel.settings.inputs[i].index))
						src=green;
					innerHTML += '<div class="colscad-8 center"><img class="center" src="'+src+
					               '" id="'+cncMachineModel.settings.inputs[i].id+
								   '" width="32" height="32" alt="'+cncMachineModel.settings.inputs[i].id+
								   '"><label>'+cncMachineModel.settings.inputs[i].id+'</label></div>';
				}
                $("#cncInputs").html(innerHTML);

			}
			
			
			if(cncMachineModel.settings.outputs)
			{
				htmlElement=document.getElementById("cncOutputs");
				var innerHTML='';
				var gray="images/gray.png";
				var green="images/green.png"
				var src="";
				for(var i=0;i<cncMachineModel.settings.outputs.length;i++)
				{
					src=gray;
					if(checkByte(cncMachineModel.globals["cncOutputs"],cncMachineModel.settings.outputs[i].index))
						src=green;
					innerHTML += '<div class="colscad-8 center"><img class="center" src="'+src+
					               '" id="'+cncMachineModel.settings.outputs[i].id+
								   '" width="32" height="32" ondblclick="cncMachineController.setOutput('+cncMachineModel.settings.outputs[i].index+')" alt="'+cncMachineModel.settings.outputs[i].id+
								   '"><label>'+cncMachineModel.settings.outputs[i].id+'</label></div>';
				}
				$("#cncOutputs").html(innerHTML);

			}
		}

        var color;
        var connStatus=cncMachineModel.globals["connStatus"];

        switch(connStatus)
        {
            case 'ready':
                color='#00FF00';
                break;
            case 'waitAck':
                color='#FFFF00';
                break;
            default:
                color='#FF0000';
                break;
        }

        htmlElement=document.getElementById("texStatus");
        if(htmlElement)
        {
            htmlElement.style.color=color;
            htmlElement.value=cncMachineModel.globals["connStatus"];
        }

        var serverStatus=cncMachineModel.globals["internalStatus"];
        if(serverStatus!="ready" && serverStatus!="sendingFile")
            color="#FF0000";
        else color="#00FF00";

        htmlElement=document.getElementById("serverInternalStatus");
        if(htmlElement)
        {
            htmlElement.style.color=color;
            htmlElement.value=cncMachineModel.globals["internalStatus"];
        }

        var overfeed=cncMachineModel.globals["cncOverFeed"];
        if(overfeed!=undefined && overfeed!=this.oldoverfeed)
        {
    		htmlElement=document.getElementById("overFeed");
    		if(htmlElement) htmlElement.value=overfeed;
            this.oldoverfeed=overfeed;
        }
		htmlElement=document.getElementById("ftptransfered");
		if(htmlElement) htmlElement.innerHTML=cncMachineModel.globals["CNC_ftpTransfered"];

        <!-- chequeo de los flags de emergencia, en error y running -->
        htmlElement=document.getElementById("cncEmergency");
        if(htmlElement)
        {
            if(cncMachineModel.globals["cncEmergency"]==true)
                htmlElement.src="images/red.png";
            else
                htmlElement.src="images/gray.png";
        }
        htmlElement=document.getElementById("cncInError");
        if(htmlElement)
        {
            if(cncMachineModel.globals["cncInError"]==true)
                htmlElement.src="images/yellow.png";
            else
                htmlElement.src="images/gray.png";
        }
        htmlElement=document.getElementById("cncRunning");
        if(htmlElement)
        {
            if(cncMachineModel.globals["cncRunning"]==true)
                htmlElement.src="images/green.png";
            else
                htmlElement.src="images/gray.png";
        }
        htmlElement=document.getElementById("cncManualMode");
        if(htmlElement)
        {
            if(cncMachineModel.globals["cncManualMode"]==true)
                htmlElement.src="images/green.png";
            else
                htmlElement.src="images/gray.png";
        }
		
        htmlElement=document.getElementById("ftpConnectStatus");
        if(htmlElement && cncMachineModel.globals["ftpConnectStatus"])
        {
            var ftpConnectStatus=cncMachineModel.globals["ftpConnectStatus"];
            switch(ftpConnectStatus)
            {
                case 'open':
                    htmlElement.src="images/green.png";
                    color='#00FF00';
                    break;
                case 'opening':
                    htmlElement.src="images/yellow.png";
                    color='#FFFF00';
                    break;
                default:
                    htmlElement.src="images/red.png";
                    color='#FF0000';
                    break;
            }
        }

        htmlElement=document.getElementById("jobStatus");
        if(htmlElement && cncMachineModel.globals["jobStatus"])
            htmlElement.value=cncMachineModel.globals["jobStatus"];

        htmlElement=document.getElementById("ftpResultMsg");
        if(htmlElement && cncMachineModel.globals["ftpResultMsg"])
        {
            htmlElement.value=cncMachineModel.globals["ftpResultMsg"];
            htmlElement.style.color=color;
        }

        htmlElement=document.getElementById("ftpCurProgress");
        if(htmlElement && cncMachineModel.globals["ftpCurProgress"])
        {
            htmlElement.value=cncMachineModel.globals["ftpCurProgress"];
        }

        htmlElement=document.getElementById("curJob");
        if(htmlElement && cncMachineModel.globals["curJob"])
        {
            var obj=cncMachineModel.globals["curJob"];
            var scurjob=JSON.stringify(obj);

            if(scurjob!=this.soldcurjob)
            {
                var sres="";
                for (var i in obj)
                    sres += "<div align=left>"+ i + " = " + obj[i] + "<br></div>";
                htmlElement.innerHTML=sres;
                this.soldcurjob=scurjob;
            }
        }

        htmlElement=document.getElementById("jobQueue");
        if(htmlElement && cncMachineModel.globals["jobQueue"])
        {
            var jqueue=cncMachineModel.globals["jobQueue"];
            var sjqueue=JSON.stringify(jqueue);
            if(sjqueue!=this.soldjqueue)
            {
                var obj;
                var sresT="";
                // recorro los jobs...
                for (var i in jqueue)
                {
                    obj=jqueue[i];
                    var sres="";
                    for (var j in obj)
                        sres += "<div align=left>" + "job" + i + "." + j + " = " + obj[j] + "<br></div>";
                    sres+="<hr>";
                    sresT+=sres;
                }
                htmlElement.innerHTML=sresT;
                this.soldjqueue=sjqueue;
            }
        }
    }
};

