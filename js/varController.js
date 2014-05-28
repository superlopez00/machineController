/**
 * Created with JetBrains PhpStorm.
 * User: Administrador
 * Date: 22/04/14
 * Time: 13:28
 * To change this template use File | Settings | File Templates.
 */



var angModule = angular.module("app",[]);

angModule.controller('varController',['$scope','$http',
    function($scope,$http){

        console.log("varController");
        $scope.globals=undefined;
        $scope.varType="W";
        $scope.varNumber="503";
        $scope.varValue="1234";
        $scope.Editor="";
        $scope.listEditor=[
            {id:"CNC",letter:"C"},
            {id:"PLC",letter:"P"},
            {id:"Permanent PLC",letter:"L"},
            {id:"BLOCK CNC",letter:"B"},
            {id:"Message",letter:"M"},
            {id:"Params",letter:"A"},
            {id:"Variable",letter:"S"},
            {id:"ISO",letter:"O"},
            {id:"Macro",letter:"a"},
            {id:"Compile Errors",letter:"m"}
        ];

        $scope.getVar=function() {
            var request='/request?cmd=GETVAR&type='+$scope.varType+'&number='+$scope.varNumber;
            $http.get(request).success(function(res,status,headers) {
                $scope.getResult=res;

            }).error(function() {
                    $scope.getResult="error calling "+request;
            });
        };

        $scope.compilePLC=function() {
            var request='/request?cmd=COMPILEPLC';
            $http.get(request).success(function(res,status,headers) {
                if(res.result=='ok')
                    $scope.getResult="COMPILE PLC: Get compile Error Editor to see result!!!!";
                else $scope.getResult="COMPILE PLC ERROR... SEE COMPILE ERROR EDITOR!!";
            }).error(function() {
                    $scope.getResult="error calling "+request;
                });
        };

        $scope.clearEditor=function() {
            $scope.editorMessage="Editor empty";
            $scope.Editor="";
        }

        $scope.getEditor=function(editor) {
            var packetIndex=0;
            $scope.editorMessage="Waiting Remote Editor Content...";
            $scope.Editor="";
            if(editor==undefined)
                return;
            if(editor.letter==undefined)
                return;

            var request='/request?cmd=GETEDITOR&editorType='+editor.letter;
            $http({method: 'GET', url: request}).
                success(function(data, status, headers, config) {
                    console.log("success getEditor: " + data);
                    if(data.result=='ok')
                    {
                        $scope.editorMessage="Editor Received OK.";
                        if(data.data!=undefined)
                        {
                            if(data.data.length==0)
                                $scope.editorMessage="Editor Received OK but without content !";
                            $scope.Editor=data.data;
                        }
                    }
                    else  $scope.editorMessage="ERROR GETTING EDITOR";
                    // this callback will be called asynchronously
                    // when the response is available
                }).
                error(function(data, status, headers, config) {
                    console.log("error getEditor: ");
                    $scope.editorMessage="ERROR GETTING EDITOR.. try again";
                });

            /*$http.get(request).success(function(res,status,headers) {
                console.log("success getEditor: " + res);
                if(res.result=='ok')
                {
                    $scope.editorMessage="Editor Received OK.";
                    if(res.data.length==0)
                        $scope.editorMessage="Editor Received OK but without content !";
                    $scope.Editor=res.data;
                }
                else  $scope.editorMessage="ERROR GETTING EDITOR";
            }).error(function() {
                console.log("error getEditor: ");
                $scope.editorMessage="ERROR GETTING EDITOR";
            });*/

        }

        $scope.setEditor=function(editor) {

            function updateStatus() {
                var request='/request?cmd=GETTRANSMISSIONINFO';
                $http.get(request).success(function(res,status,headers) {
                    if(res.transmissionInfo) {
                        $scope.editorMessage="CurPacket:"+res.transmissionInfo.curPacket + " - Bytes: "+ res.transmissionInfo.totalBytesToSent + "/"+res.transmissionInfo.totalBytesToSend;
                    }else
                        $scope.editorMessage="setting editor... please wait!"
                }).error(function() {
                    console.log("ERROR");
                });
            }

            var packetIndex=0;
            if(editor==undefined) {
                return;
            }
            if(editor.letter==undefined) {
                return;
            }

            var message="You are goint to SET "+editor.id+ " EDITOR...\nARE YOU SURE ??";
            if(window.confirm(message)==false)
                return;

            var data={ cmd : "SETEDITOR",
                editorType: editor.letter,
                contentEditor: $scope.Editor };
            var jsonData=JSON.stringify(data);

            $scope.editorMessage="Setting Remote Editor Content...";
            var updateStatusInterval=undefined;
            var request='/request?cmd=SETEDITOR&editorType='+editor.letter;
            $http({
                url: '/request',
                method: "POST",
                data: jsonData
                })
                .then(function(response) {
                    // success
                    if(updateStatusInterval)
                        clearInterval(updateStatusInterval);

                    if(response.data && response.data.result=='ok')
                        $scope.editorMessage="Setting Remote Editor Content OK!!";
                    else $scope.editorMessage="Setting Remote Editor Content Failed!!";
                },
                function(response) { // optional
                    $scope.editorMessage="Setting Remote Editor Content Failed!!";
                    if(updateStatusInterval)
                        clearInterval(updateStatusInterval);
                    // failed
                }
            );

            updateStatusInterval=setInterval(function(){updateStatus(); },80);

        }
}]);
