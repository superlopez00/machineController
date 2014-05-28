/* Codificador/decodificador en base64
 * @class
 */

var SBase64 = {
 
	// private property
	_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789*-_",
 
	// public method for encoding
    /**
     * Codifica en base64 un string
     * @param input
     * @return {String}
     */
	encode : function (input) {
		var output = "";
		var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		var i = 0;
 
		input = SUTF8.encode(input);
 
		while (i < input.length) {
 
			chr1 = input.charCodeAt(i++);
			chr2 = input.charCodeAt(i++);
			chr3 = input.charCodeAt(i++);
 
			enc1 = chr1 >> 2;
			enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			enc4 = chr3 & 63;
 
			if (isNaN(chr2)) {
				enc3 = enc4 = 64;
			} else if (isNaN(chr3)) {
				enc4 = 64;
			}
 
			output = output +
			this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
			this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
 
		}
 
		return output;
	},
 
	// public method for decoding
    /**
     * Decodifica en Base64 un string
     * @param input
     * @return {String}
     */
	decode : function (input) {
		var output = "";
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0;
 
		input = input.replace(/[^A-Za-z0-9\*\-\_]/g, "");
 
		while (i < input.length) {
 
			enc1 = this._keyStr.indexOf(input.charAt(i++));
			enc2 = this._keyStr.indexOf(input.charAt(i++));
			enc3 = this._keyStr.indexOf(input.charAt(i++));
			enc4 = this._keyStr.indexOf(input.charAt(i++));
 
			chr1 = (enc1 << 2) | (enc2 >> 4);
			chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			chr3 = ((enc3 & 3) << 6) | enc4;
 
			output = output + String.fromCharCode(chr1);
 
			if (enc3 != 64) {
				output = output + String.fromCharCode(chr2);
			}
			if (enc4 != 64) {
				output = output + String.fromCharCode(chr3);
			}
 
		}
		output = SUTF8.decode(output);
 
		return output;
 
	},


    // public method for decoding
    /**
     * Decodifica en Base64 un string
     * @param input
     * @return {String}
     */
    decodeToByteArray : function (input) {
        var output = [];
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\*\-\_]/g, "");

        while (i < input.length) {

            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
            output.push(chr1);
            if (enc3!=64)
                output.push(chr2);
            if (enc4 != 64)
                output.push(chr3);


        }
        return output;

    },

    encodeByteArray:function(input){
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        while (i < input.length) {

            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output +
                this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
                this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

        }

        return output;

    },

    _Rixits :
//   0       8       16      24      32      40      48      56     63
//   v       v       v       v       v       v       v       v      v
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    // You have the freedom, here, to choose the glyphs you want for
    // representing your base-64 numbers. The ASCII encoding guys usually
    // choose a set of glyphs beginning with ABCD..., but, looking at
    // your update #2, I deduce that you want glyphs beginning with
    // 0123..., which is a fine choice and aligns the first ten numbers
    // in base 64 with the first ten numbers in decimal.

    // This cannot handle negative numbers and only works on the
    //     integer part, discarding the fractional part.
    // Doing better means deciding on whether you're just representing
    // the subset of javascript numbers of twos-complement 32-bit integers
    // or going with base-64 representations for the bit pattern of the
    // underlying IEEE floating-point number, or representing the mantissae
    // and exponents separately, or some other possibility. For now, bail

    /**
     * Convierte un número a Base62 de forma que la conversion cumpla el orden lexicografico, debido
     * al orden de los Rixits
     * @function
     * @param number
     * @return {String}
     */
    fromNumber : function(number) {
        if (isNaN(Number(number)) || number === null ||
            number === Number.POSITIVE_INFINITY)
            throw "The input is not valid";
        if (number < 0)
            throw "Can't represent negative numbers now";

        var rixit; // like 'digit', only in some non-decimal radix
        var residual = Math.floor(number);
        var result = '';
        while (true) {
            rixit = residual % 62
            // console.log("rixit : " + rixit);
            // console.log("result before : " + result);
            result = this._Rixits.charAt(rixit) + result;
            // console.log("result after : " + result);
            // console.log("residual before : " + residual);
            residual = Math.floor(residual / 62);
            // console.log("residual after : " + residual);

            if (residual == 0)
                break;
        }
        return result;
    },
    /**
     * Dada una cadena en base62, la convierte a un numero
     * @param rixits
     * @return {Number}
     */
    toNumber : function(rixits) {
        var result = 0;
        // console.log("rixits : " + rixits);
        // console.log("rixits.split('') : " + rixits.split(''));
        rixits = rixits.split('');
        for (e in rixits) {
            // console.log("_Rixits.indexOf(" + rixits[e] + ") : " +
            // this._Rixits.indexOf(rixits[e]));
            // console.log("result before : " + result);
            result = (result * 62) + this._Rixits.indexOf(rixits[e]);
            // console.log("result after : " + result);
        }
        return result;
    }

}


/*//LZW Compression/Decompression for Strings
var LZW = {
        compress: function (uncompressed) {
            "use strict";
            // Build the dictionary.
            var i,
                dictionary = {},
                c,
                wc,
                w = "",
                result = [],
                dictSize = 256;
            for (i = 0; i < 256; i += 1) {
                dictionary[String.fromCharCode(i)] = i;
            }

            for (i = 0; i < uncompressed.length; i += 1) {
                c = uncompressed.charAt(i);
                wc = w + c;
                //Do not use dictionary[wc] because javascript arrays
                //will return values for array['pop'], array['push'] etc
                // if (dictionary[wc]) {
                if (dictionary.hasOwnProperty(wc)) {
                    w = wc;
                } else {
                    result.push(dictionary[w]);
                    // Add wc to the dictionary.
                    dictionary[wc] = dictSize++;
                    w = String(c);
                }
            }

            // Output the code for w.
            if (w !== "") {
                result.push(dictionary[w]);
            }
            return result;
        },


        decompress: function (compressed) {
            "use strict";
            // Build the dictionary.
            var i,
                dictionary = [],
                w,
                result,
                k,
                entry = "",
                dictSize = 256;
            for (i = 0; i < 256; i += 1) {
                dictionary[i] = String.fromCharCode(i);
            }

            w = String.fromCharCode(compressed[0]);
            result = w;
            for (i = 1; i < compressed.length; i += 1) {
                k = compressed[i];
                if (dictionary[k]) {
                    entry = dictionary[k];
                } else {
                    if (k === dictSize) {
                        entry = w + w.charAt(0);
                    } else {
                        return null;
                    }
                }

                result += entry;

                // Add w+entry[0] to the dictionary.
                dictionary[dictSize++] = w + entry.charAt(0);

                w = entry;
            }
            return result;
        }
    } // For Test Purposes
    */
/*    comp = LZW.compress("TOBEORNOTTOBEORTOBEORNOT"),
    decomp = LZW.decompress(comp);
document.write(comp + '<br>' + decomp);^*/

/**
 * Crea un clon de un objeto. Funciona con arrays.
 * @param right
 * @constructor
 */
function SClone(obj) {
    if (obj === undefined)
        return undefined;
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    var temp = obj.constructor(); // give temp the original obj's constructor
    for (var key in obj) {
        temp[key] = SClone(obj[key]);
    }

    return temp;
}


/**
 * Extiende una clase copiandolo todo, pero de forma que si a la izquierda tenemos un miembro que es una clase, no
 * la cambiará a otra cosa, sino que rellenará los miembros internos. REaliza un "merge"
 * @param left
 * @param right
 * @return {*}
 * @function
 */
function SExtend(left,right,notCopyEmpty){
    if (!right)
        return left;
    for (var key in right){

        switch(typeof(right[key])){
            case 'string':
                if (notCopyEmpty){
                    if (right[key].length>0){
                        left[key]=right[key];
                    }
                }
                else
                    left[key]=right[key];
                break;
            case 'boolean':
            case 'number':
                left[key]=right[key];
                break;
            case 'undefined':
            case 'null':
                if (!notCopyEmpty){
                    left[key]=right[key];
                }
                break;
            case 'object':
                if(right[key]!=null){
                    if (right[key] instanceof Array){
                        left[key]=new Array();
                        for (var i=0; i<right[key].length; i++){
                            left[key][i]=SClone(right[key][i]);
                        }
                    }
                    else{
                        if (left[key]==undefined){
                            left[key]={};
                        }
                        SExtend(left[key],right[key]);
                    }
                }
                break;
            case 'function':
                left[key]=right[key];
//                alert('SExtend: cannot have objects with functions on right side');
                break;
        }
    }
    return left;
}

/**
 * Funcion que obtiene un parametro directamente de la url
 * @see utils.getURLParam
 * @param name
 * @return {*}
 */
function getURLParam(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.href);
    if (results == null)
        return undefined;
    else
        return results[1];
}

/**
 * Función helper para generar url tokens desde la consola de javascript
 * @param params {orderId:string,userId:string,authKey:string}
 */
function generaURLToken(params){
    return "data="+SBase64.encode(SJSON.stringify(params));
}

/**
 * Obtiene los datos del campo "data" de URL como un objeto JSON
 * Para ello, decodifica el base64, posteriormente hace un parse de JSON
 * Con esta función obtendremos el ID del pedido, el usuario y los datos que se consideren
 * necesarios para ser usados por la pagina web. Recordemos que no queremos tener sesiones de PHP, sino que la
 * pagina funcione de forma stateless desde el punto de vista del servidor
 */
function getURLData(){
    var data=getURLParam("data");
    var result={};
    if (data){
        var decoded=SBase64.decode(data);
        result=SJSON.parse(decoded)||{};
    }
    result.developMode=getURLParam("developMode");
    if (result.developMode!=1 && result.developMode!=true && result.developMode!="true"){
        result.developMode=false;
    }
    else
        result.developMode=true;
    return result;
}

/**
 * Traduce la pagina entera usando el diccionario que se le pasa en translations.
 * El diccionario es un mapa asociativo string-string.
 * Para ello recorre el DOM buscando los nodos de tipo text.
 * Si es la primera vez que se traduce, al parentElement del textNode, se le pone
 * el texto original antes de traducir en el atributo "translation". De esta forma, se puede traducir
 * varias veces, ya que si el padre tiene el atributo "translation" se usa ese, y si no, se usa el contenido
 * del textNode
 *
 * Uso: translatePage(document.body, dictionary)
 * @param element
 * @param translations
 */
function translatePage(element,translations){
    if (element.nodeType==3){
        var src;
        var elTr=element.parentNode.getAttribute("translation");
        if (elTr){
            src=elTr;
        }
        else{
            src=element.data;
            element.parentNode.setAttribute("translation",src);
        }
        if (translations[src]){
            element.data=translations[src];
        }
    }
    for (var i in element.childNodes){
        translatePage(element.childNodes[i],translations);
    }
}

/*
 * Dado un objeto con hijos que tienen childOrder puesto, devuelve un array de keys ordenados por ese childOrder.
 * @param obj
 */
function getSortedKeys(obj, prefix) {
    /**
     * Metodo utilizado para ordenar un array de cosas que contienen childOrder. Compara y devuelve -1,0 o 1
     * @param a un elemento
     * @param b otro elemento
     * @private
     */
    function sortFunctionChildOrder (a,b) {
        var va,vb;
        try {
            va=a.childOrder;
            vb=b.childOrder;
        }
        catch(err){
            return 0;
        }
        if(va<vb)
            return -1;
        if(va==vb)
            return 0;
        else return 1;
    };

    var parts;
    if(prefix!=undefined)
         parts=prefix.split('.');
    else parts = {length:0};

    var myArray = new Array();
    for (var va in obj) {
        if(va[0]=='_')
            continue;
        var leaf = obj[va];
        if(!(leaf instanceof Object))
            continue;
        for(var i=0;i<parts.length;i++){
            if(leaf[parts[i]]==undefined)
                return undefined;
            leaf = leaf[parts[i]];
        }

        var value;
        if(leaf.childOrder instanceof Object)
             value = leaf.childOrder._value;
        else value = leaf.childOrder;

        myArray.push({key:va, childOrder:value});
    }
    myArray.sort(sortFunctionChildOrder);

    var keys= new Array();
    for(var i=0;i<myArray.length;i++)
        keys.push(myArray[i].key);
    return keys;
};

function getElementsByClassName(root,className,elements){
    if (!root)
        return;
    var elClass=root.className;
    if (elClass && elClass.indexOf(className)!=-1){
        elements.push(root);
    }
    for (var i=0; i<root.children.length; i++){
        getElementsByClassName(root.children[i],className,elements);
    }
}

function addClass( classname, element ) {
    var cn = element.className;
    //test for existance
    if( cn.indexOf( classname ) != -1 ) {
        return;
    }
    //add a space if the element already has class
    if( cn != '' ) {
        classname = ' '+classname;
    }
    element.className = cn+classname;
}

function removeClass( classname, element ) {
    var cn = element.className;
    var rxp = new RegExp( "\\s?\\b"+classname+"\\b", "g" );
    cn = cn.replace( rxp, '' );
    element.className = cn;
}

String.prototype.normalize_space = function() {
// Replace repeated spaces, newlines and tabs with a single space
    return this.replace(/^\s*|\s(?=\s)|\s*$/g, "");
}
/**
 * Esta función codifica un objeto javascript en formato php, para poder
 * incluirse en un php-.
 *
 * @example
 * a={a:[3,4,5],b:{c:3}}
 * encodeAsPHPArray(a) --> array("a"=>array(3,4,5),"b"=>array("c"=>3))
 * @param obj
 * @returns {*}
 */
function encodeAsPHPArray(obj,options){
    if (obj==undefined || obj==null)
        return "NULL";
    var str="";
    var format=false;
    if (options && options.format){
        format=true;
    }
    switch(typeof(obj)){
        case 'object':
            str="array(";
            if (format){
                str+="\n";
            }
            if (obj instanceof Array){
                for (var i=0; i<obj.length; i++){
                    if (i!=0)
                        str+=',';
                    str+=encodeAsPHPArray(obj[i],options);
                }

            }
            else
            {
                var first=true;
                for (var key in obj){
                    if (first){
                        first=false;
                    }
                    else{
                        str+=",";
                    }
                    str+='"'+key+'"=>'+encodeAsPHPArray(obj[key],options);
                }
            }
            str+=")";
            break;
        case 'string':
        case 'number':
        case 'boolean':
            return JSON.stringify(obj);
    }
    return str;
}

/**
 * Realiza una sustitución
 * @param left
 * @param right
 */
function SExtendReplace(left,right,keyToFilter){
    if (!right)
        return left;
    for (var key in right){
        if (key=="_replacements")
            continue;
        switch(typeof(right[key])){
            case 'string':
                left[key]=right[key];
            case 'boolean':
            case 'number':
                left[key]=right[key];
                break;
            case 'undefined':
            case 'null':
                left[key]=right[key];
                break;
            case 'object':
                if (right[key] instanceof Array){
                    left[key]=new Array();
                    for (var i=0; i<right[key].length; i++){
                        left[key][i]=SClone(right[key][i]);
                    }
                }
                else{
                    if (left[key]==undefined){
                        left[key]={};
                    }
                    SExtendReplace(left[key],right[key],keyToFilter);
                }
                break;
            case 'function':
                left[key]=right[key];
//                alert('SExtend: cannot have objects with functions on right side');
                break;
        }
    }
    if (keyToFilter && typeof(right)=="object"){
        if (right._replacements){
            var found=false;
            var index;
            for (var i=0; i<right._replacements.length && !found; i++){
                var replacement=right._replacements[i];
                index=replacement.keys.indexOf(keyToFilter);
                if (index!=-1){
                    found=true;
                    SExtendReplace(left,replacement.data);
                }
            }
            left._replacements=SClone(right._replacements);
        }
    }
    return left;
}


/**
 * Realiza un filtrado de un objeto, y devuelve un nuevo objeto con todas las partes filtradas.
 * El filtrado se realiza mediante la sustitución de partes del objeto por otras.
 * Ejemplo:
 *@example
 * Objeto:
 *
 * a:{
 *  _options:{op1:{text:"ieOp1"},op2:{text:"ieOp2"}},
 *  _replacements:[
 *      {keys:["PPR","VX"],
    *    data:{
    *       _options:{op1:{text:"ieOp1Replaced"}}
    *    }
    *   },
    *  {keys:["VEL"],
    *   data:{
    *       _options:{op2:{text:"ieOp2Replaced"},op3:{text:"ieOp3"}}
    *   }
    *  }
 *  ]
 *}
 *
 * En el caso de arriba, si hacemos
 * b=filterObject(a,"PPR"),
 * obtendremos
 * b:{
 *  _options:{op1:{text:"ieOp1"},op2:{text:"ieOp2Replaced"}}
 * }
 *
 * y si hacemos
 * b=filerObject(a,"VEL"),
 * obtendremos
 * b:{
 * _options:{op1:{text:"ieOp1"},op2:{text:"ieOp2Replaced},op3:{text:"ieOp3"}}
 *
 * @param object
 * @param key
 */
function filterObject(object,key){
    var left={};
    SExtendReplace(left,object,key);
    return left;
}

/**
 * Dado un objeto de tipo stringpool:
 * "cosa.tele" = 10; "cosa.casa" = "si";
 * Genera un objeto tipoArbol:
 * {cosa:{tele:{_value:10},casa:{_value:"si"} } }
 * Tambien funciona con arrays
 * @param sp
 * @param obj
 */
function stringPoolToObject(sp) {
    var obj={};
    for(var key in sp){
        var value=sp[key];
        var branch = mvc.branchFromString(key,value);
        SExtend(obj,branch);
    }
    return obj;
}

function C3_JSONtoObject(obj) {
    if(obj instanceof Array) {
        var newobj=new Array(obj.length);
        for(var i=0;i<obj.length;i++) {
            newobj[i] = C3_JSONtoObject(obj[i]);
        }
        return newobj;
    }
    else if(obj instanceof Object) {
        var newobj={};

        for(var key in obj) {
            if(key=="attributes")
                newobj[key]=stringPoolToObject(obj[key]);
            else newobj[key] = C3_JSONtoObject(obj[key]);
        }
        return newobj;
    }
    else {
        return obj;
    }
}

function genTabs(tabLevel) {
    var res="";
    for(var i=0;i<tabLevel;i++)
        res += '\t';
    return res;
}


/**
 * Parte recursiva de objectToXML_C3_attributes
 * @param object
 * @param fullkey
 * @param tabLevel
 */
function objectToXML_C3_attributes_recur(attributes, fullkey, tabLevel) {
    var res="";
    var myFullkey=fullkey;
    if(myFullkey)
         myFullkey+='.';
    else myFullkey='';
    for(var key in attributes){
        var child=attributes[key];
        var myKey=myFullkey+key;
        if(key=='_value' && child!=undefined)
            res += genTabs(tabLevel)+'<attr name="'+fullkey+'" value="'+child+'"/>\n';
        else if(child instanceof Object){
            res +=objectToXML_C3_attributes_recur(child, myKey, tabLevel);
        }
    }
    return res;
}

/**
 * Vuelca los atributos de un objeto tipo C3 a un XML.
 * @param object
 * @param fullkey
 * @param tabLevel
 */
function objectToXML_C3_attributes(attributes, tabLevel) {
    var res=genTabs(tabLevel)+'<attributes>\n';

    res += objectToXML_C3_attributes_recur(attributes, undefined, tabLevel+1);

    res += genTabs(tabLevel)+'</attributes>\n';
    return res;
}

/**
 * Vuelca un objeto de tipo section a un XML.
 * @param object
 * @param tabLevel
 * @returns {*}
 * @private
 */
function _objectToXML_C3_section(object, tabLevel) {
    var res = genTabs(tabLevel)+'<section name="'+object.name+'" version="'+object.version+'">\n';

    if(object.attributes)
        res += objectToXML_C3_attributes(object.attributes,tabLevel+1);

    var keys = getSortedKeys(object,'attributes');
    if(keys!=undefined) {
        for(var i=0;i<keys.length;i++) {
            var key=keys[i];
            var child=object[key];
            if(key[0]=='_' || key=='attributes' || !(child instanceof Object))
                continue;
            if(child instanceof Object) {
                var childRes=_objectToXML_C3_section(child, tabLevel+1);
                if(childRes!==false)
                    res += childRes;
            }
        }
    }
    res +=genTabs(tabLevel)+'</section>\n';
    return res;
}

/**
 * Convierte un objeto en arbol a un XML-C3 compatible con CodeBase2. El arbol debe estar organizado como lo estaria un
 * C3, es decir con objetos que contienen attributes y/o otros objetos de tipo C3.
 * @param object
 */
function objectToXML_C3(object) {
    var res='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<root>\n';

    var keys = getSortedKeys(object);
    for(var i=0;i<keys.length;i++) {
        var key=keys[i];
        if(key[0]=='_')
            continue;
        var child=object[key];
        if(!child)
            continue;
        res += _objectToXML_C3_section(child, 1);
    }
    res += '</root>';
    return res;
}

var SXML = {
    _parseXMLattrs_C3 : function(node) {
        var attrs = {};
        var ac=node.childNodes.length;
        for(var i=0;i<ac;i++) {
            if(node.childNodes[i].localName=='attr') {
                var atName=node.childNodes[i].attributes[0].nodeValue;
                var atValue=node.childNodes[i].attributes[1].nodeValue;
                if (atValue=="true") atValue = true;
                else if (atValue=="false") atValue = false;
                else if (atValue=="undefined") atValue = undefined;
                var branch = mvc.branchFromString(atName,atValue);
                SExtend(attrs,branch);
                //attrs[atName] = atValue;
            }
        }
        return attrs;
    },

    _parseXML_C3 : function(node) {
        var res = {};

        //atributos de la seccion
        var ac=node.attributes.length;
        for(var i=0;i<ac;i++) {
            var atName=node.attributes[i].localName;
            var atValue=node.attributes[i].nodeValue;
            res[atName]=atValue;
        }

        //secciones hijas
        var cc=node.childNodes.length;
        var childOrder=0;
        for(var i=0;i<cc;i++) {
            if(node.childNodes[i].localName=="section") {
                var name = node.childNodes[i].attributes[0].nodeValue;
                var aux = this._parseXML_C3(node.childNodes[i]);
                if(name=='operation'){
                    var opName = undefined;
                    if(aux.attributes['templateNameOp'])
                        opName = aux.attributes['templateNameOp']._value;
                    if(opName)
                         name=opName;
                    else name = aux.attributes['type']._value + aux.attributes['numOp']._value;
                    aux.attributes.childOrder = {'_value':childOrder};
                    childOrder++;
                }
                res[name] = aux;
            }
            if(node.childNodes[i].localName=="attributes") {
                res['attributes'] = this._parseXMLattrs_C3(node.childNodes[i]);
            }
        }
        return res;
    },

    XMLToC3_Object : function(xmlText){
        try{
            xmlTr = $.parseXML(xmlText);
            var rootNode = xmlTr.childNodes[0]; //root node

            var obj = this._parseXML_C3(rootNode);

            return obj;
        }
        catch(e){
            return undefined;
        }
    }
}
function strHasPrefix(str, prefix) {
    var len=prefix.length;
    if(str.length<len)
        return false;
    for(var i=0;i<len;i++) {
        if(str[i]!=prefix[i])
            return false;
    }
    return true;
}

/**
 * Sustituye el caracter charIn por charOut en la cadena str.
 * @param str
 * @param charIn
 * @param charOut
 */
function charSubst(str, charIn, charOut) {
    var res="";
    var l=str.length;
    var changed=0;
    var cc=charIn[0];
    for(var i=0;i<l;i++){
        if(str[i]==cc){
            res += charOut;
            changed++;
        }
        else res+=str[i];
    }
    return res;
}

var SLZW = {
    // LZW-compress a string
    encode : function(sIn) {
        //Convertimos a UTF8 para que funcione correctamente.
        var s = SUTF8.encode(sIn);

        var dict = {};
        var data = (s + "").split("");
        var out = [];
        var currChar;
        var phrase = data[0];
        var code = 256;
        for (var i=1; i<data.length; i++) {
            currChar=data[i];
            if (dict[phrase + currChar] != null) {
                phrase += currChar;
            }
            else {
                out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
                dict[phrase + currChar] = code;
                code++;
                phrase=currChar;
            }
        }
        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
        for (var i=0; i<out.length; i++) {
            out[i] = String.fromCharCode(out[i]);
        }
        return out.join("");
    },

    // Decompress an LZW-encoded string
    decode : function(s) {
        var dict = {};
        var data = (s + "").split("");
        var currChar = data[0];
        var oldPhrase = currChar;
        var out = [currChar];
        var code = 256;
        var phrase;
        for (var i=1; i<data.length; i++) {
            var currCode = data[i].charCodeAt(0);
            if (currCode < 256) {
                phrase = data[i];
            }
            else {
                phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
            }
            out.push(phrase);
            currChar = phrase.charAt(0);
            dict[code] = oldPhrase + currChar;
            code++;
            oldPhrase = phrase;
        }

        out=out.join("");
        //convertimos a utf16 de
        var out16 = SUTF8.decode(out);
        return out16;
    }
}

var SUTF8 = {
    // private method for UTF-8 encoding
    encode : function (string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    },

    // private method for UTF-8 decoding
    decode : function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;

        while ( i < utftext.length ) {

            c = utftext.charCodeAt(i);

            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            }
            else if((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i+1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i+1);
                c3 = utftext.charCodeAt(i+2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }


        }
        return string;
    }
}

function stringToByteArray(str) {
    var bytes=[];
    for (var i = 0; i < str.length; ++i) {
        var code=str.charCodeAt(i);
        if(code<256)
            bytes.push(code);
        else {
            bytes.push((code>>8)&255);
            bytes.push((code)&255);
        }
    }
    return bytes;
}

function s_inArray(elem, array ) {
    return jQuery.inArray(elem,array);
}

/**
 * @class
 */
utils={
    /**
     * Codificador/decodificador de base64
     * @function
     * @name utils.Base64
     */
    SBase64:SBase64,
    /**
     * Funcion para extender propiedades
     * @function
     * @name utils.SExtend
     */
    SExtend:SExtend,
    /**
     * Funcion para obtener parametros de la URL
     * @function
     * @name utils.getURLParam
     */
    getURLParam:getURLParam,
    /**
     * Funcion para obtener el "token" del pedido a traves de la variable ?data=XXXXXX
     * @function
     * @see getURLData
     */
    getURLData:getURLData,
    /**
     * @function
     * @see generaURLToken
     */
    generaURLToken:generaURLToken,

    inArray:s_inArray,


    /**
     * Genera un clon del objeto que se le pasa por parametro
     * @function
     * @see SClone
     */
    SClone:SClone,

    
    getSortedKeys:getSortedKeys,
    encodeAsPHPArray:encodeAsPHPArray,
    /**
     * devuelve el objeto filtrado por una clave, segun los replacements
     * @function
     * @see filterObject
     */
    filterObject:filterObject,

    //Conversiones a/desde UTF8
    SUTF8:SUTF8,

    //Compresion y decompresion
    SLZW:SLZW
};

try{
    module.exports.dummy={};
}
catch(o){
    module={exports:{}};
}

try{
    console;
}
catch(o){
    console={log:function(what){}};
}

module.exports=utils;

try{
    /**
     * SJSON --> Clase a usar en vez de JSON para compatibilidad con IE. En otros navegadores SJSON=JSON
     * @type {*}
     */
    SJSON=JSON;
}
catch(o){
    SJSON={parse:jQuery.parseJSON,
           stringify:function stringify(obj) {
            var t = typeof (obj);
            if (t != "object" || obj === null) {
                // simple data type
                if (t == "string") obj = '"' + obj + '"';
                return String(obj);
            } else {
                // recurse array or object
                var n, v, json = [], arr = (obj && obj.constructor == Array);

                for (n in obj) {
                    v = obj[n];
                    t = typeof(v);
                    if (obj.hasOwnProperty(n)) {
                        if (t == "string") v = '"' + v + '"'; else if (t == "object" && v !== null) v = SJSON.stringify(v);
                        json.push((arr ? "" : '"' + n + '":') + String(v));
                    }
                }
                return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
            }
          }
    }

}
