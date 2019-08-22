var jsforce = require('jsforce');
var fs = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var AdmZip = require('adm-zip');
var parser = require('json-parser');
var JSZip2 = require('jszip');
var JSZip = require('./jszip');
var forAll = require('./forAll');
module.exports = {
    GitLabCommit: function(req,re,firstReq){
        console.log('GITLAB');
        console.log('TEST');
        console.log('firstReq ---> '+firstReq)
       // console.log('req.body.sync',req.body.sync);
        var branches;
        var repos = new Set();
        var promises = [];
        var mapNameToBody = [];
        var time;
        var branchId;
        var componentsWithAtt = [];
        var re;
        var getCreds;
        var conn = new jsforce.Connection({
          // you can change loginUrl to connect to sandbox or prerelease env.
          loginUrl : 'https://'+ process.env.env +'.salesforce.com'
        });
      
        //conn.login('ibegei@forceoft.com.git', 'Veryeasy4473', function(err, userInfo) {
          conn.login(process.env.username, process.env.password, function(err, userInfo) {
            accesTok = conn.accessToken;
            instanceUrl =  conn.instanceUrl;
          var projId;
          var token;
          var branchname;
          var pat;
          var patuse;
          var labCommitMessage;
          branchId = req.body.branchId;
          if (err) {
            synccc = false;
             return console.error(err);
             }
          // Now you can get the access token and instance URL information.
          // Save them to establish connection next time.
          console.log(conn.accessToken);
        
          console.log(conn.instanceUrl);
          // logged in user property
          console.log("User ID: " + userInfo.id);
          console.log("Org ID: " + userInfo.organizationId);
          branchId = firstReq.branchId;
          let branch2 = {
            branchId: req.body.branchId,
            commitType: firstReq.commitType
          };
  
          let branch = {
            branchId: JSON.stringify(branch2)
          };
  
    //      console.log('branchNAME---->  '+req.body);
          forAll.httpCallSF(instanceUrl+'/services/apexrest/flosum_git/gitLab','POST',branch,accesTok).then(resp => {
   //   console.log('****resp ----> '+resp);
          getCreds = parser.parse(resp);
          console.log(getCreds);
          token = JSON.parse(getCreds).token;
          projId = JSON.parse(getCreds).projectId;
          branchname = JSON.parse(getCreds).branchName;
          pat = JSON.parse(getCreds).pat;
          patuse = JSON.parse(getCreds).patuse;
          labCommitMessage = JSON.parse(getCreds).commitMessage;
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
              //console.log('re.data',re.data);
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
      ///////////////////////////////////
      //forAll.zipParsing(item,'base64',mapNameToBody );
      forAll.zipParsing(item, 'base64', mapNameToBody,index).then( i => {
        //console.log('index = ',i);
        if(i === componentsWithAtt.length-1){
          module.exports.commitToGitlab(projId,branchname,mapNameToBody,token,branchId,firstReq,pat,patuse,labCommitMessage);
        }
      });
              }


              
        });
      
              
              
            } catch(err) {
              synccc = false;
              console.error('err',err);
            }
           
          })/*.then( () => {
            setTimeout(function(){
      
              componentsWithAtt.forEach(function (item, index, array) {
                  if(item.attachment === undefined || item.attachment.Body === undefined){
                    return;
                  } else{
                    forAll.zipFieldParsing(item,'base64',mapNameToBody );
                  }      
        });
              
            },time);
          }).then( () => {
      
            setTimeout(function(){
              module.exports.commitToGitlab(projId,branchname,mapNameToBody,token,branchId,firstReq);
            },time + 500 );
      
      
          } );*//////////////////////////
      
        });
        
      
      },      
commitToGitlab: function(projId, branchName, objects, token,branchId,firstReq,pat,patuse, labCommitMessage) {
  /*
  console.log(pat, patuse);
   // console.log('mapNameToBody',objects);
    console.log('In commitToGtilab');
    var xmlHttp = new XMLHttpRequest();
    var url;
    console.log('projId',projId);
    if(patuse){
      url = 'https://gitlab.com/api/v4/projects/' + projId + '/repository/branches?per_page=100';
      xmlHttp.open("GET", url, true);
      xmlHttp.setRequestHeader('PRIVATE-TOKEN', pat);
    }else{
     url = 'https://gitlab.com/api/v4/projects/' + projId + '/repository/branches?per_page=100&access_token=' + token;
     xmlHttp.open("GET", url, true);
    }

    console.log('projId2',projId);
      
    var pages = 2;
      var elementsResp = 0;
      xmlHttp.responseType = 'json';
      xmlHttp.onload = function () {
        if (xmlHttp.readyState === 4) {
          if (xmlHttp.status === 200) {
            console.log('200',projId);
            console.log('xmlHttp.responseText',xmlHttp.responseText);
            var tempArr = JSON.parse(xmlHttp.responseText);
            var tmp = [];
            tempArr.forEach(function (element) {
              tmp.push(element.name);
              elementsResp++;
            });
            if(elementsResp ==100){
              elementsResp =0;

            }
            console.log('tempArr',tempArr);
          var bool = false;
            for(var i = 0; i < tempArr.length; i++) {
              if(firstReq.commitType === 'branch'){
                if (tempArr[i].name == branchName) {
                  console.log('bodyForUpdate');
                  module.exports.checkComponentsIfExist(projId, branchName, objects, token,branchId,firstReq,pat,patuse,labCommitMessage);
                if(i==100){
                  bool = true;
                }
                 
                }
              }else if(firstReq.commitType === 'repo'){
                if (tempArr[i].name == 'master') {
                  console.log('bodyForUpdate');
                  module.exports.checkComponentsIfExist(projId, 'master', objects, token,branchId,firstReq,pat,patuse,labCommitMessage);
                  if(i==100){
                    bool = true;
                  }
                }
              }
              
            }
            
          } else if (xmlHttp.status === 400 || xmlHttp.status === 404) {
            console.log('ERROR');
          }
        }
      };
      xmlHttp.send(null);
  
   */ 


if(firstReq.commitType === 'branch'){
    console.log('firstReq.commitType ----->',firstReq.commitType);
    var pathes = [];
    module.exports.checkComponentsIfExist(projId, branchName, objects, token,branchId,firstReq,pat,patuse,labCommitMessage,false,pathes,1);
}else if(firstReq.commitType === 'repo'){
  console.log('firstReq.commitType ----->',firstReq.commitType);
  var pathes = [];
    module.exports.checkComponentsIfExist(projId, 'master', objects, token,branchId,firstReq,pat,patuse,labCommitMessage,false,pathes,1); 
}
},

  bodyForUpdate: function(projId, branchName, objects, tok,branchId,firstReq,pat,patuse, labCommitMessage, pathes) {
    console.log('In bodyForUpdate');
   // console.log('pathes',pathes);
    var today = new Date();
    var message = branchName+' '+dateTime;
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime = date+' '+time;
  if(labCommitMessage != null && labCommitMessage!='null'){ 
      message = labCommitMessage;
  }else{
    message = branchName+' '+dateTime;
  }
  
    var sendBody = {
      //dont forget to change it
      start_branch: branchName,
     // start_branch: 'master',
      branch: branchName,
      force: true,
      author_name: firstReq.sfUser,
      author_email: firstReq.sfUser,
      commit_message: branchName+' '+dateTime,
      actions: []
    };
    console.log(firstReq.sfUser);
  //  console.log(firstReq.sfUser);
    function removeDuplicates(originalArray, prop) {
      var newArray = [];
      var lookupObject = {};
  
      for (var i in originalArray) {
  
        lookupObject[originalArray[i][prop]] = originalArray[i];
      }
  
      for (i in lookupObject) {
        newArray.push(lookupObject[i]);
      }
      return newArray;
    }
    var actions='';

    var uniqueArray = removeDuplicates(objects, "key");
    uniqueArray.forEach(element => {
      // console.log('pathes.length',pathes.length);
      if(pathes.length ==0){
        actions = 'create';
      }else{
      //  console.log('element.key', element.key);
        // console.log('pathes.includes => ',pathes.includes(element.key));
        // console.log('pathes ',pathes);
        if(pathes.includes(element.key.toString())){
        //  console.log('includes',element.key.toString());
          actions = 'update';
          // console.log('actions', actions);
        }else{
          actions = 'create';
        }
        console.log('actions------------------->      ', actions);
      }
      //console.log(element.key);
 
      if (element.type === 'CustomObject') {
        sendBody.actions.push(
          {
            action: actions, //create
            file_path: element.key,
            content: element.value,
            encoding: 'base64'
          }
        );
      } else {
        sendBody.actions.push(
          {
            action: actions, //create
            file_path: element.key,
            content: element.value,
            encoding: 'base64'
          }
        );
      }

    });
    if(firstReq.commitType === 'branch'){
      module.exports.sendFiles(projId, sendBody, tok,uniqueArray,branchName,branchId,pat,patuse,firstReq); //////////////cal method sendfiles
    }else if(firstReq.commitType === 'repo'){
      module.exports.sendFiles(projId, sendBody, tok,uniqueArray,'master',branchId,pat,patuse,firstReq); //////////////cal method sendfiles
    }
    
  
  },
  
   sendFiles:function (projId, sendBody, tok,uniqueArray,branchName,branchId,pat,patuse,firstReq) {
    console.log('In sendFiles');
    var xmlHttp = new XMLHttpRequest();
    var url;
    if(patuse){
      url = 'https://gitlab.com/api/v4/projects/' + projId + '/repository/commits';
      xmlHttp.open("POST", url, true);
      xmlHttp.setRequestHeader('PRIVATE-TOKEN', pat);
      console.log('1');
    }else{
      console.log('2');
      url = 'https://gitlab.com/api/v4/projects/' + projId + '/repository/commits?access_token=' + tok;
      xmlHttp.open("POST", url, true);
      console.log('3');
    }
    console.log('4');
    
    xmlHttp.setRequestHeader('Content-Type', 'application/json');
    xmlHttp.responseType = 'json';
    xmlHttp.onload = function () {
  
      if (xmlHttp.readyState === 4) {
       
        if (xmlHttp.status === 200 || xmlHttp.status === 201) {
          synccc = false;
          module.exports.fileHistoryGitLab(uniqueArray,tok,branchName,projId,branchId,pat,patuse);
  console.log('*****PUSHED*****');

  var conn = new jsforce.Connection({
    // you can change loginUrl to connect to sandbox or prerelease env.
    loginUrl : 'https://'+ process.env.env +'.salesforce.com'
  });

  if(firstReq.runMerge){
  //conn.login('ibegei@forceoft.com.git', 'Veryeasy4473', function(err, userInfo) {
    conn.login(process.env.username, process.env.password, function(err, userInfo) {
      accesTok = conn.accessToken;
      instanceUrl =  conn.instanceUrl;
      conn.sobject("flosum_git__Branch_Git__c").find({
        'flosum_git__Git_Branch_Id__c': { $like: branchId }
      })
        .limit(1)
        .execute(function (err, sfRecords) {
          if (err) {
            console.log('err', err);
          } else {
            //sfRecords[0].flosum_git__oldMergeBranch__c = JSON.stringify(firstReq.oldMergeBranch);
            //sfRecords[0].flosum_git__mergeBranch__c = JSON.stringify(firstReq.mergeBranch);
            
              conn.sobject("flosum_git__Branch_Git__c").update(
                { Id: sfRecords[0].Id, flosum_git__run_merge__c: Date.now() },
                function (err, rets) {
                  if (err) { return console.error(err); } else {
                    console.log(rets);
                  }
                });
            
          }
        });
    });
  }
      }else{
        console.log('ELSE 200');
        console.log('xmlHttp.responseText',xmlHttp.responseText);
      }
    }else{
      console.log('ELSE 4');
    }
  }
    var parsed = JSON.stringify(sendBody);
    //console.log('parsed',parsed);
    xmlHttp.send(parsed);
  },
  
  
   fileHistoryGitLab:function(mapNameToBody,tok,branchName,projId,branchId,pat,patuse){
    
    //console.log('uniqueArray',mapNameToBody);
    console.log('patuse',patuse);
    console.log('tok',tok);
    console.log('pat',pat);
  var contents = [];
  mapNameToBody.forEach(function(obj,index,array){
    console.log('branchName',branchName);
      let path = obj.key;
      //console.log('path',path);
      path = path.replaceAll('%','%25');
      path = path.replaceAll('/','%2F');
      path = path.replaceAll('.','%2E');
      path = path.replaceAll(' ','%20');
      
      
      //console.log('path',path);
      //httpGet('https://gitlab.com/api/v4/projects/'+ projId +'/repository/files/'+ path +'?ref='+branchName,tok);
      
        contents.push(forAll.httpGet('https://gitlab.com/api/v4/projects/'+ projId +'/repository/files/'+ path +'?ref='+branchName,tok,pat,patuse));
      
      
      if(index === mapNameToBody.length -1){
       // console.log('INDEX');
        Promise.all(contents).then( values => {
          
          values.forEach(function(item,index,array){
         //   console.log('VALUES');
            let ii =JSON.parse(item);
            delete ii.content;
               let path = ii.file_path;
               mapNameToBody.forEach(function(mapObj,mapIndex,mapArray){
                  if(mapObj.key === path){
                    mapObj.gitlab = ii;
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
           
          });
        }).then( () => {
          let namesWithBlobsLength = mapNameToBody.length;
          var spitLength = 500;
          let iter = Math.ceil(namesWithBlobsLength / spitLength);
          console.log('saveResponce');
          //console.log('mapNameToBody', mapNameToBody);
          for(let i=0;i<iter;i++){
            console.log('saveResponce2 - Final Save');
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
      }
    });
  },

  checkComponentsIfExist:function(projId, branchName, objects, tok,branchId,firstReq,pat,patuse, labCommitMessage,go,pathes,page){
    if(go){
      module.exports.bodyForUpdate(projId, branchName, objects, tok,branchId,firstReq,pat,patuse, labCommitMessage, pathes);
    }else{
      
    var responce;
    console.log('In checkComponentsIfExist');
    console.log('projId --> ',projId);
    console.log('branchName -->', branchName);
    var xmlHttp = new XMLHttpRequest();
    var url;
    if(patuse){
        url = `https://gitlab.com/api/v4/projects/${projId}/repository/tree?ref=${branchName}&recursive=true&per_page=100&page=${page}`;
      xmlHttp.open("GET", url, true);
      xmlHttp.setRequestHeader('PRIVATE-TOKEN', pat);
      console.log('PRIVATE-TOKEN');
    }else{
      console.log('access_token');
      url = `https://gitlab.com/api/v4/projects/${projId}/repository/tree?access_token=${tok}&ref=${branchName}&recursive=true&per_page=100&page=${page}`;
      //url = 'https://gitlab.com/api/v4/projects/' + projId + '/repository/tree?access_token=' + tok+'&ref='+branchName+'&recursive=true&per_page=100';
      xmlHttp.open("GET", url, true);
      
    }
    console.log('4');
    
    xmlHttp.setRequestHeader('Content-Type', 'application/json');
    xmlHttp.responseType = 'json';
    xmlHttp.onload = function () {
  
     
       
        if (xmlHttp.status === 200 || xmlHttp.status === 201) {
          responce = JSON.parse(xmlHttp.responseText);
         // console.log('xmlHttp.responseText',responce);
          responce.forEach(element => {
            if(element.type =='blob' || element.mode =='100644'){
          //  console.log('element.path', element.path);
            if(element.path.toString() != 'README.md'){
              pathes.push(element.path.toString());
            }            
            }
          });
          if(responce.length === 100){
            module.exports.checkComponentsIfExist(projId, branchName, objects, tok,branchId,firstReq,pat,patuse,labCommitMessage,false,pathes,page+1);
          }else{
            module.exports.checkComponentsIfExist(projId, branchName, objects, tok,branchId,firstReq,pat,patuse,labCommitMessage,true,pathes,page+1);
          }
         // console.log('pathes',pathes);
          //pathes.shift(); 
          //console.log('pathes',pathes);
       //   console.log('pathes',pathes);
         // synccc = false;
        //  module.exports.fileHistoryGitLab(uniqueArray,tok,branchName,projId,branchId);
  //console.log('*****PUSHED*****');

      }else{
        console.log('xmlHttp.responseText',xmlHttp.responseText);
      }
  }
    xmlHttp.send();
  }
    }
  
        
};