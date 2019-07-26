var jsforce = require('jsforce');
var fs = require('fs');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var AdmZip = require('adm-zip');
var parser = require('json-parser');
var JSZip2 = require('jszip');
var JSZip = require('./jszip');

module.exports = {
    getFilesForCompare : function(records,offset,count,conn, instance){
        console.log('getFilesForCompare');
        return  new Promise(function(resolve, reject) {
          conn.query("SELECT flosum_git__Component_History__c, flosum_git__Component__c,flosum_git__GitLab__c, flosum_git__Repository__c, flosum_git__Attachment_SHA__c, flosum_git__Attachment_Id__c, flosum_git__Branch_Id__c, flosum_git__isLastVersion__c, flosum_git__History_Git_External_Id__c, flosum_git__Component_type__c, flosum_git__Path__c, flosum_git__Component_Version__c, flosum_git__UpsertField__c, flosum_git__Bitbucket__c, flosum_git__Bitbucket_responce__c, Id, Name FROM flosum_git__History_Git__c WHERE flosum_git__isLastVersion__c = true "+instance+" LIMIT 1000 OFFSET "+offset, function(err, result) {
            if(err){
              reject(err);
            }else{
              if(offset>count){
                resolve(); 
              }else{
                records.push(...result.records);
                console.log('PUSHED');
                offset += 1000;
                module.exports.getFilesForCompare(records,offset,count,conn,instance).then( () => {
                  resolve(); 
                });
              }         
            }
          });
        });
        
      },
      getFilesForCompareWithBranch : function(records,offset,count,conn,flosumBrIds,localFilesMap){     
        console.log('getFilesForCompare');
        console.log('flosumBrIds',flosumBrIds);
        return  new Promise(function(resolve, reject) {
          conn.sobject("flosum_git__History_Git__c").find({
            'flosum_git__Branch_Id__c' : {$in : flosumBrIds}
          }).where("flosum_git__isLastVersion__c = true")
          .limit(250)
          .offset(offset)
          .execute(function(err,sfRecords){
            if(err){
              reject(err);
            }else{              
              /*console.log('sfRecords.length = ',sfRecords.length);
              console.log('sfRecords = ',sfRecords);*/
              sfRecords.forEach(function(obj,index,array){
                if(obj.Id === 'a0Z1i000003jn2ZEAQ'){
                 // console.log(obj);
                }
              })
                records.push(...sfRecords);
                sfRecords.forEach(function(object,index,array){
                  if(localFilesMap.has(object.flosum_git__Branch_Id__c)){
                    let tempList = localFilesMap.get(object.flosum_git__Branch_Id__c);
                    tempList.push(object);
                    localFilesMap.set(object.flosum_git__Branch_Id__c, tempList);
                }else{
                    localFilesMap.set(object.flosum_git__Branch_Id__c,[object]);
                }
                });
                console.log('PUSHED');
                if(offset>count){
                  resolve();
                }else{
                  offset += 250;
                module.exports.getFilesForCompareWithBranch(records,offset,count,conn,flosumBrIds,localFilesMap).then( () => {
                  resolve(); 
                });
              }
            }
          });
        });
        
      },
      httpCallSF: function(urlreq,method,body,authHeader) {
        return  new Promise(function(resolve, reject) {
          
            let xmlHttp = new XMLHttpRequest();
            let url = urlreq;
            xmlHttp.open( method , url, true );
            xmlHttp.setRequestHeader('Content-Type', 'application/json');
            xmlHttp.setRequestHeader('Authorization', 'Bearer '+authHeader);
            xmlHttp.responseType = 'json';
            xmlHttp.onload = function() { 
                if (xmlHttp.readyState === 4) {
                    if (xmlHttp.status === 200 || xmlHttp.status === 201) {                              
                      resolve(xmlHttp.responseText);
                    }else{
                        reject(xmlHttp.responseText);
                    }
                }
            };
            if(body.body != undefined){
                xmlHttp.send( JSON.stringify(body.body) );
            }else{
                xmlHttp.send( JSON.stringify(body) );
            }
        });
    },
    empty: function() {
        return  new Promise(function(resolve, reject) {
                      resolve();
        });
      },
      zipParsing: function(item,format,mapNameToBody,index ){
        return  new Promise(function(resolve, reject) {
          
          var zipp = new JSZip();
          zipp.loadAsync(item.attachment.Body.substring(1, item.attachment.Body.length-1), { base64: true }).then(function (zip) {
            let i = 0;
          zip.forEach(function (relativePath, file) {
              if(item.component.Flosum__Component_Type__c != 'CustomField' && item.component.Flosum__Component_Type__c != 'WebLink' && item.component.Flosum__Component_Type__c != 'ListView' && item.component.Flosum__Component_Type__c != 'FieldSet' && item.component.Flosum__Component_Type__c != 'BusinessProcess' && item.component.Flosum__Component_Type__c != 'CompactLayout' && item.component.Flosum__Component_Type__c != 'SharingReason' && item.component.Flosum__Component_Type__c != 'ValidationRule' && item.component.Flosum__Component_Type__c != 'RecordType'){
                  if(item.component.Flosum__Component_Type__c != 'CustomObject'){
                      zip.file(relativePath).async(format).then(function (data) {                            
                          mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                          //component.set("v.objectMap", mapNameToBody);
                          if(Object.keys(zip.files).length-1 === i){
                            resolve(index);
                          }else{
                            i++;
                          }
                          
                      })
                  }else{
                    
                    if(zip.file(relativePath) === null){
                      console.log('relativePath',relativePath);
                    }
                      zip.file(relativePath).async(format).then(function (data) {                            
                       let folder = relativePath.split('/')[1].split('.')[0] + '/';
                       relativePath = relativePath.splice(8,0,folder);
                          mapNameToBody.push({value: data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                          //component.set("v.objectMap", mapNameToBody); //add  11.04
                          if(Object.keys(zip.files).length-1 === i){
                            resolve(index);
                          }else{
                            i++;
                          }
                      }).catch( err => {
                        if(err){
                          console.log('err',err);
                        }
                      });
        
                  }
              }else if(item.component.Flosum__Component_Type__c === 'CustomField' || item.component.Flosum__Component_Type__c === 'WebLink' || item.component.Flosum__Component_Type__c === 'ListView' || item.component.Flosum__Component_Type__c === 'FieldSet'|| item.component.Flosum__Component_Type__c === 'BusinessProcess'|| item.component.Flosum__Component_Type__c === 'CompactLayout'|| item.component.Flosum__Component_Type__c === 'SharingReason'|| item.component.Flosum__Component_Type__c === 'ValidationRule' || item.component.Flosum__Component_Type__c === 'RecordType'){
                zip.file(relativePath).async(format).then(function (data) {                            
                  
                    if(item.component.Flosum__Component_Type__c === 'CustomField'){
                      relativePath = relativePath.split('.')[0] + '/fields/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.field-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }else if(item.component.Flosum__Component_Type__c === 'WebLink'){
                      relativePath = relativePath.split('.')[0] + '/webLinks/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.webLinks-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }else if(item.component.Flosum__Component_Type__c === 'ListView'){
                      relativePath = relativePath.split('.')[0] + '/listViews/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.listView-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }else if(item.component.Flosum__Component_Type__c === 'FieldSet'){
                      relativePath = relativePath.split('.')[0] + '/fieldSets/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.fieldSets-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }else if(item.component.Flosum__Component_Type__c === 'BusinessProcess'){
                      relativePath = relativePath.split('.')[0] + '/businessProcesses/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.businessProcesses-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }else if(item.component.Flosum__Component_Type__c === 'CompactLayout'){
                      relativePath = relativePath.split('.')[0] + '/compactLayouts/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.compactLayouts-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }else if(item.component.Flosum__Component_Type__c === 'RecordType'){
                      relativePath = relativePath.split('.')[0] + '/recordTypes/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.recordTypes-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }else if(item.component.Flosum__Component_Type__c === 'SharingReason'){
                      relativePath = relativePath.split('.')[0] + '/sharingReasons/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.sharingReasons-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }else if(item.component.Flosum__Component_Type__c === 'ValidationRule'){
                      relativePath = relativePath.split('.')[0] + '/validationRules/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.validationRules-meta.xml';
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                    }
  
                });
        }
          });
          
        }, function (e) {          
          var zipp = new JSZip();                        
          zipp.loadAsync(item.attachment.Body.substring(1, item.attachment.Body.length-1), { base64: true }).then(function (zip) {
            let i = 0;
              zip.forEach(function (relativePath, file) {
                  zip.file(relativePath).async(format).then(function (data) {
                      mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                      if(Object.keys(zip.files).length-1 === i){
                        resolve(index);
                      }else{
                        i++;
                      }
                  });
                  
              });
          });
        });

        });          
        },
         zipFieldParsing: function(item, format,mapNameToBody){
  
            var zipp = new JSZip();
            zipp.loadAsync(item.attachment.Body.substring(1, item.attachment.Body.length-1), { base64: true }).then(function (zip) {
            zip.forEach(function (relativePath, file) { 
                if(item.component.Flosum__Component_Type__c === 'CustomField' || item.component.Flosum__Component_Type__c === 'WebLink' || item.component.Flosum__Component_Type__c === 'ListView' || item.component.Flosum__Component_Type__c === 'FieldSet'|| item.component.Flosum__Component_Type__c === 'BusinessProcess'|| item.component.Flosum__Component_Type__c === 'CompactLayout'|| item.component.Flosum__Component_Type__c === 'SharingReason'|| item.component.Flosum__Component_Type__c === 'ValidationRule' || item.component.Flosum__Component_Type__c === 'RecordType'){
                        zip.file(relativePath).async(format).then(function (data) {                            
                          
                            if(item.component.Flosum__Component_Type__c === 'CustomField'){
                              relativePath = relativePath.split('.')[0] + '/fields/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.field-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }else if(item.component.Flosum__Component_Type__c === 'WebLink'){
                              relativePath = relativePath.split('.')[0] + '/webLinks/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.webLinks-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }else if(item.component.Flosum__Component_Type__c === 'ListView'){
                              relativePath = relativePath.split('.')[0] + '/listViews/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.listView-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }else if(item.component.Flosum__Component_Type__c === 'FieldSet'){
                              relativePath = relativePath.split('.')[0] + '/fieldSets/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.fieldSets-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }else if(item.component.Flosum__Component_Type__c === 'BusinessProcess'){
                              relativePath = relativePath.split('.')[0] + '/businessProcesses/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.businessProcesses-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }else if(item.component.Flosum__Component_Type__c === 'CompactLayout'){
                              relativePath = relativePath.split('.')[0] + '/compactLayouts/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.compactLayouts-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }else if(item.component.Flosum__Component_Type__c === 'RecordType'){
                              relativePath = relativePath.split('.')[0] + '/recordTypes/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.recordTypes-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }else if(item.component.Flosum__Component_Type__c === 'SharingReason'){
                              relativePath = relativePath.split('.')[0] + '/sharingReasons/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.sharingReasons-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }else if(item.component.Flosum__Component_Type__c === 'ValidationRule'){
                              relativePath = relativePath.split('.')[0] + '/validationRules/' + item.component.Flosum__Component_Name__c.split('.')[1] + '.validationRules-meta.xml';
                              mapNameToBody.push({value:data, key:'app/main/default/'+ relativePath, type: item.component.Flosum__Component_Type__c, name: item.component.Flosum__Component_Name__c, component : item.component , history : item.history, attachment : item.attachment.Id }); // add 11.04
                            }
          
                        });
                }
                
            });          
          }, function (e) {
            // static resource unzip
            
          });
          },
          httpGet: function(urlreq,authHeader) {
            //console.log('urlreq',urlreq);
            //console.log('authHeader',authHeader);
            return  new Promise(function(resolve, reject) {
                let xmlHttp = new XMLHttpRequest();
                let url = urlreq;
                xmlHttp.open( "GET", url, true );
                xmlHttp.setRequestHeader('Content-Type', 'application/json');
                xmlHttp.setRequestHeader('Authorization', authHeader);
                xmlHttp.responseType = 'json';
                xmlHttp.onload = function() { 
                  //console.log('xmlHttp.status',xmlHttp.status);
                 // console.log('xmlHttp.status',xmlHttp.readyState);
                    if (xmlHttp.readyState === 4) {
                        if (xmlHttp.status === 200) {
                          //console.log('JSON.parse(JSON.stringify(xmlHttp.responseText))',JSON.parse(JSON.stringify(xmlHttp.responseText)));
                            resolve(JSON.parse(JSON.stringify(xmlHttp.responseText)));
                        }else{
                          //console.log('urlreq',urlreq);
                          //console.log('JSON.parse(JSON.stringify(xmlHttp.responseText))',JSON.parse(JSON.stringify(xmlHttp.responseText)));
                            reject(JSON.parse(JSON.stringify(xmlHttp.responseText)));
                        }
                    }
                };
                xmlHttp.send( null );
            });
          },
          httpCall:function(urlreq,method,body,authHeader) {
            return  new Promise(function(resolve, reject) {
                let xmlHttp = new XMLHttpRequest();
                let url = urlreq;
                xmlHttp.open( method , url, true );
                xmlHttp.setRequestHeader('Content-Type', 'application/json');
                xmlHttp.setRequestHeader('Authorization', authHeader);
                xmlHttp.responseType = 'json';
                xmlHttp.onload = function() { 
                    if (xmlHttp.readyState === 4) {
                        if (xmlHttp.status === 200 || xmlHttp.status === 201) {                              
                            let response = JSON.parse(xmlHttp.responseText);
                            response.path = body.path;
                            resolve(response);
                        }else{
                            reject(JSON.parse(JSON.stringify(xmlHttp.responseText)));
                        }
                    }
                };
                if(body.body != undefined){
                    xmlHttp.send( JSON.stringify(body.body) );
                }else{
                    xmlHttp.send( JSON.stringify(body) );
                }
            });
          }
  };