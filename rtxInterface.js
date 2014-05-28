/**
 * Created with JetBrains PhpStorm.
 * User: Administrador
 * Date: 18/12/13
 * Time: 14:02
 * To change this template use File | Settings | File Templates.
 */



"use strict";


// requires
var printf = require("printf");
var ffi = require('ffi');
var ref = require('ref');
var Struct = require('ref-struct');
var ArrayType = require('ref-array');

// defines
var kPipeBufferLength = 10000000;
var kMaxPipeCount=100;
var kNameLength=80;
var O_RDONLY=0x00;
var O_WRONLY=0x01;
var PAGE_NOACCESS=0x01;
var PAGE_READONLY=0x02;
var PAGE_READWRITE=0x04;


var tvoid = ref.types.void; // we don't know what the layout of "sqlite3" looks like
var ptvoid = ref.refType(tvoid);
var pptvoid = ref.refType(ptvoid);
var word = ref.types.uint32;
var pword = ref.refType('uint32');


// MAPEO DE LA DLL
var rtxLib = ffi.Library('RtxBcb', {
    "RtCreateSharedMemory": [ ptvoid , [  'int', 'int', 'int', 'string', pptvoid ] ],
    "RtCreateEvent": [ ptvoid , [  ptvoid, 'int', 'string' ] ],
    "RtPulseEvent": [ 'int' , [  ptvoid ] ],
    "RtResetEvent": [ 'int' , [  ptvoid ] ],
    "RtWaitForSingleObject": [ 'int' , [  ptvoid, 'int' ] ]
});



/////////////////////////////////////////////////////////////////////////////////////
// CHUNKS
/////////////////////////////////////////////////////////////////////////////////////


var kIncrCapacidad=4096;
var RtxChunk=function(){
    this.tipo=0;
    this.longitud=0;
    this.capacidad=0;
    this.posLectura=0;
    this.posLectura=0;
    this.incrementoBuffer=kIncrCapacidad;
    this.buffer=[];
    return this;
};


RtxChunk.prototype.ChunkClear=function ()
{
    this.buffer=[];
    this.tipo=0;
    this.longitud=0;
    this.capacidad=0;
    this.posLectura=0;
};

RtxChunk.prototype.ChunkInit=function()
{
    this.buffer=[];
    this.incrementoBuffer=kIncrCapacidad;
    this.ChunkClear();
};

/////////////////////////////////////////////////////////////////////////////////////
// PIPES
/////////////////////////////////////////////////////////////////////////////////////

/*
var NewPipeSharedMem = Struct();
NewPipeSharedMem.defineProperty('gLeidos', 'int');
NewPipeSharedMem.defineProperty('gEscritos', 'int');
NewPipeSharedMem.defineProperty('buffer', ArrayType('byte', kPipeBufferLength));
var pNewPipeSharedMem = ref.refType(NewPipeSharedMem);

var NewPipe=function()
{
    this.nombre=new ArrayType('byte', kPipeBufferLength);
    this.hanMem=null;
    this.hanWrite=null;
    this.hanRead=null;
    this.cola= ref.refType(PipeSharedMem);
    return this;
};
*/


var PipeBuffer = Struct();
PipeBuffer.defineProperty('gLeidos', 'int64');
PipeBuffer.defineProperty('gEscritos', 'int64');
PipeBuffer.defineProperty('punLectura', 'int');
PipeBuffer.defineProperty('punEscritura', 'int');
PipeBuffer.defineProperty('buffer', ArrayType('char', kPipeBufferLength));
var sizeofPipeBuffer=10000024;

var pPipeSharedMem = ref.refType(PipeBuffer);

var Pipe=function()
{
    this.nombre=new ArrayType('char', kNameLength);
    this.hanMem=null;
    this.hanEve=null;
    this.buffer= ref.refType(PipeSharedMem);
    return this;
};




var g_rtPipes=new ArrayType(Pipe, kMaxPipeCount);
var g_rtPipeHandles=new ArrayType('int',kMaxPipeCount);
var g_rtPipeCount  = -1;    // NUMERO DE PIPES ABIERTOS
var g_rtPipeNext = 0;      // NEXT HANDLE EN LA LLAMADA NEWHANDLE( )
var g_usedFifos=0;


function RtPipeNextHandle(handle)
{
    if (handle < kMaxPipeCount - 1)
        return handle + 1;
    else
        return 0;
};

function RtPipeNewHandle()
{
    //--- SIEMPRE EMPEZAMOS POR DONDE NOS HABIAMOS QUEDADO ---//
    var han = g_rtPipeNext;
    do
    {
        if (g_rtPipes[han].hanMem == null)
        {
            //--- GUARDAMOS EL SITIO DONDE NOS HEMOS QUEDADO ---//
            g_rtPipeNext = RtPipeNextHandle(g_rtPipeNext);
            return han;
        }
        han = RtPipeNextHandle(han);
    } while (han != g_rtPipeNext);
    //--- EL BUCLE TERMINA CUANDO LLEGAMOS A DONDE HABIAMOS EMPEZADO ---//
    return -1; // Y POR TANTO NO QUEDAN HUECOS LIBRES
};

function RtPipeInit()

{
    for (var i = 0; i < kMaxPipeCount; i++)
    {
        g_rtPipes[i].hanMem = null;
        g_rtPipes[i].hanEve = null;
    }
};


function  RtPipeAvail(handle) // devuelve si hay cosas en la cola
{
    var pipe=g_rtPipes[handle].buffer;
    if(pipe!=null)
    return (pipe.qEscritos-pipe.qLeidos);
}



//-------------------------------//
//---       HRtPipeWrite      ---//
//-------------------------------//
function RtPipeWriteChunk(handle, ch)
{
    RtPipeWrite(handle, ch.tipo, 4);
    RtPipeWrite(handle, ch.longitud, 4);
    RtPipeWrite(handle, ch.buffer, ch.longitud);
    return 1;
}

function RtPipeWrite(handle, buffer, size)
{

    //--- FALTA COMPROBAR SI SIZE ES MAYOR QUE LA COLA      ---//
    //--- FALTA COMPROBAR SI MACHACAMOS DATOS AUN NO LEIDOS ---//

    //--- REFERENCIAMOS A LA ESTRUCTURA CORRELACIONADA CON EL HANDLE ---//
    var pipe     = g_rtPipes[handle].buffer;
    if(pipe==undefined)
        return 0;

    var restante = kPipeBufferLength - (pipe.punEscritura);

    //--- SI QUEDA BASTANTE SITIO COPIAMOS TODO, SI NO LO PARTIMOS ---//
    if (restante >= size)
    {

        memcpy((pipe.buffer) + (pipe.punEscritura), buffer, size);
        pipe.punEscritura += size;
    }
    else
    {
        memcpy((pipe.buffer) + (pipe.punEscritura), buffer, restante);
        memcpy(pipe.buffer, buffer + restante, size - restante);
        pipe.punEscritura = size - restante;
    }

    pipe.qEscritos += size;
    RtPulseEvent(g_rtPipes[handle].hanEve); // SI HAY ALGUIEN ESPERANDO LO DESPERTAMOS
    return 1;
}



//-------------------------------//
//---       HRtPipeRead       ---//
//-------------------------------//

function RtPipeReadChunk(handle, ch, timeout)
{

    if (!RtPipeRead(handle, ch.tipo, 4, timeout))
        return 0;
    if (!RtPipeRead(handle, ch.longitud, 4, timeout))
        return 0;
    RTXChunkSetSize(ch, ch->longitud);
    if (!RtPipeRead(handle, ch.buffer, ch.longitud, timeout))
        return 0;
    ch.posLectura=0;
    return 1;
}

function RtPipeRead (handle, buffer, size, timeout)
{
    var dif;

    //--- REFERENCIAMOS A LA ESTRUCTURA CORRELACIONADA CON EL HANDLE ---//
    var pipe = g_rtPipes[handle].buffer;
    if(pipe==undefined)
        return;

    while (size > 0)
    {
        dif = (pipe.qEscritos) - (pipe.qLeidos);

        if (dif > 0)
        {
            if (dif < size) // HAY QUE LEER MAS VECES
            {
                RtPipeLeeCircular(pipe, buffer, dif);
                size -= dif;
            }
            else // SE LEE LO QUE QUEDA DE GOLPE
            {
                RtPipeLeeCircular(pipe, buffer, size);
                return 1;
            }
        }
        if (timeout==0 || timeout==-1)
            timeout=INFINITE;
        if (RtWaitForSingleObject(g_rtPipes[handle].hanEve, timeout)!=WAIT_OBJECT_0)
            return 0;
    }

    return 1;
}

function RtPipeOpen(nombre, openMode){

    var pBuffer= ref.refType(PipeBuffer);
    var hanMem, hanEve;
    var handle, i;
    var pipe;
    var nombreTmp;

    //--- LA PRIMERA VEZ SE INICIALIZA EL ARRAY DE HANDLES ---//
    if (g_rtPipeCount < 0)
    {
        g_rtPipeCount = 0;
        RtPipeInit();
    }

    //--- BUSCAMOS EL NOMBRE DEL RECURSO, Y SI EXISTE LO DEVOLVEMOS ---//
    for (i = 0; i < g_rtPipeCount; i++)
        if (nombre==g_rtPipes[g_rtPipeHandles[i]].nombre)
            return g_rtPipeHandles[i];

    //--- OBTENEMOS UN NUEVO HANDLE DE PIPE ---//
    if ((handle = RtPipeNewHandle()) < 0)
        return -1;
    pipe = g_rtPipes[handle];

    //-----------------------------------------------------------------------------//
    //--- CREACION DE LOS OBJETOS DEL SISTEMA RTX                               ---//
    //--- ===================================================================== ---//
    //--- NOTAS SOBRE EVENTOS:                                                  ---//
    //--- EL PRIMER PARAMETRO (SEGURIDAD) NO SE USA EN RTX                      ---//
    //--- EL SEGUNDO A TRUE INDICA QUE EL EVENTO DEBE SER RESETEADO MANUALMENTE ---//
    //--- O DE LO CONTRARIO EL EVENTO CONTINUA EN ESTADO "SIGNALED"             ---//
    //--- EL TERCERO ES EL ESTADO INICIAL DEL EVENTO (SIGNALED O NO)            ---//
    //--- FINALMENTE EL NOMBRE SE USA TAMBIEN EN MUTEX, SEMAFOROS Y MEMORIA     ---//
    nombreTmp=nombre+"_eve";
    hanEve = rtxLib.RtCreateEvent(0,0,nombreTmp);

    nombreTmp=nombre+"_mem";
    hanMem = rtxLib.RtCreateSharedMemory(PAGE_READWRITE, 0, sizeofPipeBuffer , nombreTmp, pBuffer);

    if ((hanMem == null) || (hanEve == null))
    {
        alert("ERROR CREATING PIPE "+nombre);
        return -1;
    }

    //-----------------------------------------------------------------------------//
    //--- RELLENAMOS LOS PARAMETROS DEL PIPE ---//
    pipe.hanMem = hanMem;
    pipe.hanWrite = hanWrite;
    pipe.hanRead = hanRead;
    pipe.cola = pBuffer;
    pipe.nombre=nombre;
    //--- ANOTAMOS EL HANDLE PARA LAS BUSQUEDAS DE CADENAS ---//
    g_rtPipeHandles[g_rtPipeCount] = handle;
    g_rtPipeCount++;
    return handle;
}



/////////////////////////////////////////////////////////////
// CONTROLADOR-INTERFACE RTX
/////////////////////////////////////////////////////////////



function rtxClass()
{
    // mapeamos la dll

    this.m_rtxWrite=0;
    this.m_rtxRead=0;

    this.m_chW=new RtxChunk();
    this.m_chR=new RtxChunk();
}


rtxClass.prototype.init=function(){
    var yo=this;

    yo.m_rtxRead= RtPipeOpen("RtxPasarela_IN",O_RDONLY);
    yo.m_rtxWrite= RtPipeOpen("RtxPasarela_OUT",O_WRONLY);

    if (!RtStartPasarela(rtxVer,rtxSubVer))
    {
        alert("Cannot StartPasarela(init ShareMemory) Please check version");
        return;
    }

//    m_version=rtxVer;
//    m_subVersion=rtxSubVer;
    //
    while (RtPipeAvail(m_rtxRead))
        RtPipeReadChunk(m_rtxRead,m_chR,1000);

}


