var jsforce = require('jsforce');
var fs = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var AdmZip = require('adm-zip');
var parser = require('json-parser');
var JSZip2 = require('jszip');
var JSZip = require('./jszip');
var forAll = require('./forAll');
module.exports = {
    getBitbucketFiles2: function(array,username,userpass,userOrg){
        let auth = 'Basic ';
        let tok = username + ':' + userpass;  
        tok = Buffer.from(tok).toString('base64');
        auth = auth + tok;
        var filesResp = [];
        array.forEach(function(item,index,array){
          /*console.log('item.flosum_git__Path__c',item.flosum_git__Path__c);
          console.log('item.Flosum__Branch_Name__c',item.Flosum__Branch_Name__c);
          console.log('--------------------------------------------------',);*/
          /*if(item.Flosum__Branch_Name__c === undefined){
            console.log('item',item);
          }*/

          var temp = item.flosum_git__Repository__c;
    var tempOut;
    tempOut = temp.replace(/[^a-zA-Z0-9]/g, '-');
    var arr = [];
    arr = tempOut.split('');
    var repository = '';
    arr.forEach(function (element, index) {
      if (arr.length - 1 == index) {
        repository += arr[index];
      } else {
        if (arr[index] == '-' && arr[index + 1] == '-') {
        } else {
          repository += arr[index];
        }
      }
    });
   // branchMap.get(req.body.branchId).data.branch.Flosum__Repository__r.Name = repository;\
   var log = console.log;
    log('item.flosum_git__Repository__c',item.flosum_git__Repository__c);
          filesResp.push(forAll.httpGet('https://api.bitbucket.org/2.0/repositories/'+ userOrg +'/'+ repository +'/filehistory/'+ item.Flosum__Branch_Name__c +'/'+item.flosum_git__Path__c,auth));
        });
       return Promise.all(filesResp);  
      },
      getBitbucketFiles: function(mapNameToBody,username,userpass,userOrg, reponame, branchname){
        let auth = 'Basic ';
        let tok = username + ':' + userpass;  
        tok = Buffer.from(tok).toString('base64');
        auth = auth + tok;
        var filesResp = [];   
         var temp = reponame;
        var tempOut;
        tempOut = temp.replace(/[^a-zA-Z0-9]/g, '-');
        var arr = [];
        arr = tempOut.split('');
        var repository = '';
        arr.forEach(function (element, index) {
          if (arr.length - 1 == index) {
            repository += arr[index];
          } else {
            if (arr[index] == '-' && arr[index + 1] == '-') {
            } else {
              repository += arr[index];
            }
          }
        });
        mapNameToBody.forEach(function(item,index,array){
          filesResp.push(forAll.httpGet('https://api.bitbucket.org/2.0/repositories/'+ userOrg +'/'+ repository +'/filehistory/'+ branchname +'/'+item.key,auth));
        });
       return Promise.all(filesResp);  
      },
      getAllFilesInfo: function(bitbucket,mapNameToBody,username,userpass,userOrg, reponame, branchname,branchId){
        module.exports.getBitbucketFiles(mapNameToBody,username,userpass,userOrg, reponame, branchname).then(values => {
          values.forEach(function(item,index,array){
            let ii =JSON.parse(item);
            if(ii.values.length != 0){
               let path = ii.values[ii.values.length - 1].path;
               mapNameToBody.forEach(function(mapObj,mapIndex,mapArray){
                  if(mapObj.key === path){
                    mapObj.bitbucket = JSON.stringify(ii.values[ii.values.length - 1]);
                    mapObj.type_Z = mapObj.type;
                    delete mapObj.type;
                    delete mapObj.value;
                  }
                  if(mapObj.component.Flosum__Component_Type__c != undefined){
                    mapObj.component.componentType = mapObj.component.Flosum__Component_Type__c,
                    delete mapObj.component.Flosum__Component_Type__c;
                  }
                  if(mapObj.component.Flosum__Component_Name__c != undefined){
                    mapObj.component.componentName = mapObj.component.Flosum__Component_Name__c,
                    delete mapObj.component.Flosum__Component_Name__c;
                  }
                  if(mapObj.component.Flosum__File_Name__c != undefined){
                    mapObj.component.fileName = mapObj.component.Flosum__File_Name__c,
                    delete mapObj.component.Flosum__File_Name__c;
                  }
                  if(mapObj.history.Flosum__Component__c != undefined){
                    mapObj.history.componentLookUp = mapObj.history.Flosum__Component__c,
                  delete mapObj.history.Flosum__Component__c;
                  }
               });
    
            }        
          });
        }).then( () => {
          let namesWithBlobsLength = mapNameToBody.length;
          var spitLength = 500;
          let iter = Math.ceil(namesWithBlobsLength / spitLength);
          console.log('saveResponce');
          for(let i=0;i<iter;i++){
            console.log('saveResponce2');
            let req = {
              resp : JSON.stringify(mapNameToBody.slice(i*spitLength,i*spitLength+spitLength)),
              branchId : branchId
            };
            forAll.httpCallSF(instanceUrl+'/services/apexrest/flosum_git/saveResponce','POST',req,accesTok).catch( err => {
              console.log(err);
              synccc = false;
            });
          } 
          
        }).catch( err => {
          synccc = false;
          console.log(err);
        });
      },
      bitbucketPrepareCommit: function(req,re,firstReq){
        console.log('THIS IS A BITBUCKET');
          var mapNameToBody = [];
          var time;
          var componentsWithAtt = [];
          var re;
          var reponame;
            var branchname;
            var username;
            var userpass;
            var userOrg;
            var branchId = req.body.branchId;
          var conn = new jsforce.Connection({
            // you can change loginUrl to connect to sandbox or prerelease env.
             loginUrl : 'https://'+ process.env.env +'.salesforce.com'
          });
        
          //conn.login('ibegei@forceoft.com.git', 'Veryeasy4473', function(err, userInfo) {
            conn.login(process.env.username, process.env.password, function(err, userInfo) {
              accesTok = conn.accessToken;
              instanceUrl =  conn.instanceUrl;
            if (err) {
              synccc = false;
               return console.error(err); 
               }
            // Now you can get the access token and instance URL information.
            // Save them to establish connection next time.
          
            branchId = firstReq.branchId;
          let branch = {
            branchId : branchId
          };
          forAll.httpCallSF(instanceUrl+'/services/apexrest/flosum_git/bitbucket','POST',branch,accesTok).then(resp => {
              getCreds = parser.parse(resp);
            username = JSON.parse(getCreds).username; 
            reponame = JSON.parse(getCreds).reponame; 
            branchname = JSON.parse(getCreds).branchname; 
            userpass = JSON.parse(getCreds).userpass;
            userOrg = JSON.parse(getCreds).userOrg;
            return forAll.empty();
          }).then( () => {
            try {
      
              String.prototype.splice = function(idx, rem, str) {
                  return this.slice(0, idx) + str + this.slice(idx + Math.abs(rem));
              };
              
              
              //var object = parser.parse(resp);///////////////////////////////////////////////////objj
              //re = JSON.parse(object);
      
      
              var components = re.components;
              var histories = re.histories;
              console.log('re.data',re.data);
              var attachments = re.attachments;
      
              var componentsKeys = Object.keys(components);
              var historiesKeys = Object.keys(histories);
              for(let key of componentsKeys){
                  let obj = {};
                  obj.component = components[key];
                  for(let hisKey of historiesKeys){
                      if(histories[hisKey].Flosum__Component__c == obj.component.Id){
                          obj.history = histories[hisKey];
                          for(let att of attachments){
                              if(att.ParentId == obj.history.Id){
                                  obj.attachment = att;
                              }
                          }
                      }
                  }
                  componentsWithAtt.push(obj);   
              }
      
                time = 200 * componentsWithAtt.length;
                componentsWithAtt.forEach(function (item, index, array) {
                  if(item.attachment === undefined || item.attachment.Body === undefined){
                    return;
                  } else{
                    ////////////////
                    forAll.zipParsing(item,'string',mapNameToBody);
                  }
                    
          });
        
                
              } catch(err) {
                synccc = false;
                console.error('err',err);
              }
            }).then( () => {
        
              console.log('time',time);
              setTimeout(function(){
        
                componentsWithAtt.forEach(function (item, index, array) {
            
                    if(item.attachment === undefined || item.attachment.Body === undefined){
                      return;
                    } else{
                      forAll.zipFieldParsing(item,'string',mapNameToBody);
                    }           
          });
                
              },time);
            }).then( () => {
              
                  setTimeout(function(){
                    module.exports.bitbucketGetCreds(userOrg, reponame, branchname,mapNameToBody,username,userpass,'first',branchId,firstReq);
                  },100);
            //bitbucketCreateBranch(username, reponame, branchname, mapNameToBody,userpass, userOrg);
      
            } ).catch( err => {
              if(err){ 
                synccc = false;
                console.log(err);
              }
            });
        
          
        });
        },
        bitbucketGetCreds:function(userOrg, reponame, branchname, mapNameToBody, username,userpass,type,branchId,firstReq ){
            let tok = username + ':' + userpass;  
            tok = Buffer.from(tok).toString('base64');
            var xmlHttp = new XMLHttpRequest();
            var temp = reponame;
            var tempOut;
            tempOut = temp.replace(/[^a-zA-Z0-9]/g, '-');
            var arr = [];
            arr = tempOut.split('');
            var repository = '';
            arr.forEach(function (element, index) {
              if (arr.length - 1 == index) {
                repository += arr[index];
              } else {
                if (arr[index] == '-' && arr[index + 1] == '-') {
                } else {
                  repository += arr[index];
                }
              }
            });
            var url = 'https://api.bitbucket.org/2.0/repositories/'+userOrg+'/'+repository+'/refs/branches/'+branchname;
            var targetHash;
            var author;
            xmlHttp.open("GET", url, true);
            xmlHttp.setRequestHeader("Authorization", "Basic " + tok );
            xmlHttp.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
            xmlHttp.responseType = 'json';
           
            xmlHttp.onload = function () {
              if (xmlHttp.readyState === 4) {
                if (xmlHttp.status === 200 || xmlHttp.status === 201) {
            var parsed = JSON.parse(xmlHttp.responseText);
            targetHash = parsed.target.hash;
            if(type != null && type != undefined){
             // bitbucketCommit(userOrg, reponame, branchname, mapNameToBody, targetHash, tok,username,userpass,branchId);
             module.exports.identityUser(userOrg, reponame, branchname, mapNameToBody, targetHash, username,userpass,branchId,firstReq);
            }else{
              module.exports.getAllFilesInfo(parsed,mapNameToBody,username,userpass,userOrg, reponame, branchname,branchId);
            }    
                } else if (xmlHttp.status === 400 || xmlHttp.status === 404) {
                  console.log('xmlHttp.responseText',xmlHttp.responseText);
                }
              }
            };
            xmlHttp.send(null);
          
          },
          
          bitbucketCommit:function(userOrg, reponame, branchname, mapNameToBody, targetHash, tok,username,userpass,branchId, author){
            console.log('bitbucket author', author);
            var temp = reponame;
            var tempOut;
            tempOut = temp.replace(/[^a-zA-Z0-9]/g, '-');
            var arr = [];
            arr = tempOut.split('');
            var repository = '';
            arr.forEach(function (element, index) {
              if (arr.length - 1 == index) {
                repository += arr[index];
              } else {
                if (arr[index] == '-' && arr[index + 1] == '-') {
                } else {
                  repository += arr[index];
                }
              }
            });
            var today = new Date();
            var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
            var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
            var dateTime = date+' '+time;
            var message = branchname+' '+dateTime;
            var xmlHttp = new XMLHttpRequest();
            var boundary = branchname+branchname+branchname+branchname;
            var boundaryMiddle = '--' + boundary + '\r\n';
           
            var url = 'https://api.bitbucket.org/2.0/repositories/'+userOrg+'/'+repository+'/src/';
            xmlHttp.open("POST", url, true);
            xmlHttp.setRequestHeader("Authorization", "Basic " + tok );
            xmlHttp.setRequestHeader('Content-Type', 'multipart/form-data;  boundary='+boundary);
           var header;
           console.log('body');
           var body='';
           header ='Content-Type: multipart/form-data;  boundary='+boundary+'\r\n\r\n';
           body=body+ 
           
           '--' + boundary + '\r\n' +
           'Content-Disposition: form-data; name="message"\r\n\r\n' + 
           message+'\r\n'+
        
           '--' + boundary + '\r\n' +
           'Content-Disposition: form-data; name="author"\r\n\r\n' + 
           author+'\r\n'+
          
           '--' + boundary + '\r\n' +
           'Content-Disposition: form-data; name="branch"\r\n\r\n' + 
           branchname+'\r\n'+
          
           '--'+boundary+'--';
           
            mapNameToBody.forEach(function(value,key){
              let arr = value.key.split('/');
              let name = arr[arr.length-1];
            body+=
            '--' + boundary + '\r\n' +
            'Content-Disposition: form-data;  name="'+value.key+'"; filename="'+name+'"\r\n\r\n'+value.value+
            '--'+boundary+'--';
          
            }); 
            
          
            xmlHttp.onload = function () {
              console.log('ONLOAD');
              console.log('xmlHttp.status',xmlHttp.status); 
              if (xmlHttp.readyState === 4) {
           
                if (xmlHttp.status === 200 || xmlHttp.status === 201) {
                  console.log('good');
                  module.exports.bitbucketGetCreds(userOrg, repository, branchname,mapNameToBody,username,userpass,null,branchId);
                  synccc = false;
                } else if (xmlHttp.status === 400 || xmlHttp.status === 404 || xmlHttp.status === 500) {
                  console.log('NOT good');
                  console.log(xmlHttp.responseText);
                }
              }
            };
            xmlHttp.send(header+body);
          },
          identityUser: function(userOrg, reponame, branchname, mapNameToBody, targetHash, username,userpass,branchId,firstReq){ //need to recive username&pass or tok and userOrg
            let tok = username + ':' + userpass;  
            console.log('tok',tok);
            var temp = reponame;
            var tempOut;
            tempOut = temp.replace(/[^a-zA-Z0-9]/g, '-');
            var arr = [];
            arr = tempOut.split('');
            var repository = '';
            arr.forEach(function (element, index) {
              if (arr.length - 1 == index) {
                repository += arr[index];
              } else {
                if (arr[index] == '-' && arr[index + 1] == '-') {
                } else {
                  repository += arr[index];
                }
              }
            });
            tok = Buffer.from(tok).toString('base64');
            var xmlHttp = new XMLHttpRequest();
            var url = 'https://api.bitbucket.org/2.0/user';
           var author;
            xmlHttp.open("GET", url, true);
            xmlHttp.setRequestHeader("Authorization", "Basic " + tok );
            xmlHttp.responseType = 'json';
            xmlHttp.onload = function () {
              if (xmlHttp.readyState === 4) {
                if (xmlHttp.status === 200 || xmlHttp.status === 201) {
                  console.log('xmlHttp.responseText',xmlHttp.responseText);
            var parsed = JSON.parse(xmlHttp.responseText);
            author = firstReq.sfUser + '<'+firstReq.sfUser+'>';
            console.log('author',author);
            //here we go to commit with author  bitbucketCommit(userOrg, reponame, branchname, mapNameToBody, targetHash, tok,username,userpass,branchId, author);
            module.exports.bitbucketCommit(userOrg, reponame, branchname, mapNameToBody, targetHash, tok,username,userpass,branchId, author);
                } else if (xmlHttp.status === 400 || xmlHttp.status === 404) {
                  console.log('xmlHttp.responseText',xmlHttp.responseText);
                }
              }
            };
            xmlHttp.send(null);
          } 

  }; 