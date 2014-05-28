/**
 * Created with JetBrains PhpStorm.
 * User: Administrador
 * Date: 17/12/13
 * Time: 14:50
 * To change this template use File | Settings | File Templates.
 */


"use strict";

var printf = require("printf");
var ffi = require('ffi');
var ref = require('ref');
var Struct = require('ref-struct');
var ArrayType = require('ref-array');

var STRING_LENGTH = 12;
var MAX_ATR_LEN=56;                              /** max ATR length */
var MAX_ID_LEN=8                                /** max device ID length */
var S4_SUCCESS=0;                              /** success*/
var S4_USER_PIN=161;                            /** user pin **/

var word = ref.types.uint32
var pword = ref.refType('uint32');


var DONGLE_CONTEXT = Struct();
DONGLE_CONTEXT.defineProperty('dwIndex', 'uint32');
DONGLE_CONTEXT.defineProperty('dwVersion', 'uint32');
DONGLE_CONTEXT.defineProperty('hLock', 'uint32');
DONGLE_CONTEXT.defineProperty('reserve', ArrayType('byte', STRING_LENGTH));
DONGLE_CONTEXT.defineProperty('bAtr', ArrayType('byte', MAX_ATR_LEN));
DONGLE_CONTEXT.defineProperty('bID', ArrayType('byte', MAX_ID_LEN));
DONGLE_CONTEXT.defineProperty('dwAtrLen', 'uint32');


// typedefs
var pDONGLE_CONTEXT = ref.refType(DONGLE_CONTEXT);

var enkyLib = ffi.Library('dongle', {
        "S4Enum": [ word , [  pDONGLE_CONTEXT, pword ] ],
        "S4Open": [ word , [  pDONGLE_CONTEXT ] ],
        "S4Close": [ word , [  pDONGLE_CONTEXT ] ],
        "S4ChangeDir": [ word , [  pDONGLE_CONTEXT,  "string" ] ],
        "S4VerifyPin": [ word , [  pDONGLE_CONTEXT, "string", word, word ] ],
        "S4Execute": [ word , [  pDONGLE_CONTEXT, "string", 'void *', word, 'void *', word, pword ] ]
});


//var enkyClass = module.exports = function ()
function enkyClass()
{
    var yo=this;
    this.Failed=false;
    this.LicenseID=this.dongle_id();
    this.checkKey=setInterval(this.dongle_exits, 5000, yo);

}

enkyClass.prototype.dongle_exits=function(dongle){

    var yo=dongle;

    var ctx= ref.refType(DONGLE_CONTEXT);
    var pctx = [];
    var psize = ref.alloc('uint32');
    var ret = 0;

    enkyLib.S4Enum(null, psize);
    var size = psize.deref();
    if (size == undefined || size==0)
    {
        console.log("XL not found!");
        yo.Failed=true;
        return false;
    }

    var myKey=-1;
    var numKeys=enkyLib.S4Enum(null, psize);
    for(var ii=0; ii<numKeys;ii++)
    {
        pctx[ii] = ref.alloc(DONGLE_CONTEXT);
        if (pctx[ii] == undefined)
        {
            console.log("Not enough memory!");
            yo.Failed=true;
            return false;
        }

        ret = enkyLib.S4Enum(pctx[ii], psize);
        if (ret != S4_SUCCESS)
        {
            console.log("Enumerate XL error!");
            yo.Failed=true;
            return false;
        }

        var ctx2=pctx[ii].deref();
        if (ret != S4_SUCCESS)
        {
            console.log("Open XL failed!");
            yo.Failed=true;
            return false;
        }

        // Averiguamos cual es nuestra llave
        var res="";
        for(var i=0;i<8;i++)
            res+=printf("%c",ctx2.bID[i]);
        // comparo la licencia...
        if(res==yo.LicenseID)
        {
            myKey=i;
            yo.Failed=false;
            console.log("ENKY key found!");
            return;
        }

    }

    if(yo.LicenseID!=-1 && myKey<0)
    {
        console.log("Cant find key");
        yo.Failed=true;
        return;
    }
};

enkyClass.prototype.dongle_id=function(){
    var yo=this;

    var pctx= ref.refType(DONGLE_CONTEXT);

    var psize = ref.alloc('uint32');
    var ret = 0;
    var len=8;

    enkyLib.S4Enum(null, psize);
    var size = psize.deref();
    if (size == undefined || size==0)
    {
        console.log("XL not found!");
        yo.Failed=true;
        return false;
    }

    pctx = ref.alloc(DONGLE_CONTEXT);
    if (pctx == undefined)
    {
        console.log("Not enough memory!");
        yo.Failed=true;
        return false;
    }

    ret = enkyLib.S4Enum(pctx, psize);
    if (ret != S4_SUCCESS)
    {
        console.log("Enumerate XL error!");
        yo.Failed=true;
        return false;
    }

    ret = enkyLib.S4Open(pctx);
    var ctx2=pctx.deref();
    if (ret != S4_SUCCESS)
    {
        console.log("Open XL failed!");
        yo.Failed=true;
        return false;
    }

    var res="";
    for(var i=0;i<len;i++)
    {
        res+=printf("%c",ctx2.bID[i]);
        /*tt=ctx2.bID[i];
        a = parseInt(tt);
        a *= Math.pow(16,8-i-1);
        res += a; */
    }
    yo.LicenseID=res;

    console.log("ENKYID: 0x" + res);
    return res;
};


enkyClass.prototype.call_dongle=function(fid, buff, len){
    // buff tiene que ser un Buffer(len)

    if(Buffer.isBuffer(buff)==false)
    {
        /*var semilla=41684.570312;
        var b = new Buffer(len);
        b.writeFloatLE(semilla, 0)
        var b2 = new Buffer(buff);*/

        console.log("buff is not a buffer");
        return;
    }
    if(buff.length!=len)
    {
        console.log("buff has not the correct length");
        return;
    }

    var yo=this;
    if(yo.Failed)
        return;

    var ctx= ref.refType(DONGLE_CONTEXT);
    var pctx = [];
    var psize = ref.alloc('uint32');
    var ret = 0;

    enkyLib.S4Enum(null, psize);
    var size = psize.deref();
    if (size == undefined || size==0)
    {
        console.log("XL not found!");
        yo.Failed=true;
        return false;
    }

    var myKey=-1;
    var numKeys=enkyLib.S4Enum(null, psize);
    for(var ii=0; ii<numKeys;ii++)
    {
        pctx[ii] = ref.alloc(DONGLE_CONTEXT);
        if (pctx[ii] == undefined)
        {
            console.log("Not enough memory!");
            yo.Failed=true;
            return false;
        }

        ret = enkyLib.S4Enum(pctx[ii], psize);
        if (ret != S4_SUCCESS)
        {
            console.log("Enumerate XL error!");
            //free(pctx);
            yo.Failed=true;
            return false;
        }

        var ctx2=pctx[ii].deref();
        if (ret != S4_SUCCESS)
        {
            console.log("Open XL failed!");
            yo.Failed=true;
            return false;
        }

        // Averiguamos cual es nuestra llave
        var res="";
        for(var i=0;i<8;i++)
            res+=printf("%c",ctx2.bID[i]);
        // comparo la licencia...
        if(res==yo.LicenseID)
        {
            myKey=i;
            break;
        }

    }

    if(yo.LicenseID!=-1 && myKey<0)
    {
        yo.Failed=true;
        return;
    }
    else if(myKey<0)
        myKey=0;


    ret = enkyLib.S4Open(pctx[myKey]);
    ctx=pctx[myKey];
    if (ret != S4_SUCCESS)
    {
        console.log("Open XL failed!");
        yo.Failed=true;
        return false;
    }


    ret = enkyLib.S4ChangeDir(pctx[myKey], "\\");
    if (ret != S4_SUCCESS)
    {
        console.log("No root directory found!");
        enkyLib.S4Close(pctx[myKey]);
        yo.Failed=true;
        return;
    }

    ret = enkyLib.S4VerifyPin(pctx[myKey], "12345678", 8, S4_USER_PIN);
    if (ret != S4_SUCCESS)
    {
        console.log("Verify User PIN failed!");
        enkyLib.S4Close(pctx[myKey]);
        yo.Failed=true;
        return;
    }

    ret = enkyLib.S4Execute(pctx[myKey], fid, buff, len, buff, len, psize);
    if (ret != S4_SUCCESS)
    {
        //printf("Execute XL exe failed!\n");
        enkyLib.S4Close(pctx[myKey]);
        //Failed=true;
        return;
    }

    enkyLib.S4Close(pctx[myKey]);

};

function create(argv){
    var enkyKey=new enkyClass();
    return enkyKey;
}

module.exports.create=create;


/* usage
1. Get ID
var id=enkyKey.dongle_id();

2. Call program to get coefs...
var len=16;
var semilla=41684.570312;
var buff = new Buffer(len);
buff.writeFloatLE(semilla, 0)

enkyKey.call_dongle("d001", buff, len);

var coefs=[];
var c;
for(var i=0;i<4;i++)
{
    c=buff.readFloatLE(4*i);
    coefs.push(c);
}
*/