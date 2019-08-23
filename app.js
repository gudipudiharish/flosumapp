var express = require('express');
var port = process.env.PORT || 3000;
var app = express();
var jsforce = require('jsforce');
var fs = require('fs');
var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
var AdmZip = require('adm-zip');
var parser = require('json-parser');
var JSZip2 = require('jszip');
var JSZip = require('./jszip');
var forAll = require('./forAll');
var bitbucket = require('./bitbucket');
var gitlab = require('./gitlab');
var git = require('./git');
var synccc = false;
const util = require('util');
var https = require('http');
var sync;
var firstReq;
var allItems = {
	histories: [],
	components: [],
	data: {},
	attachments: [],
	firstReq: {}
};

var preparedData;
var reposByBranchId;
var getRecordTypeIdbyName;
var gitOrgSettings;
var localFilesMap = new Map();
var returnGitFilesMap = new Map();

class Items {
	constructor() {
		this.histories = [];
		this.components = [];
		this.data = {};
		this.attachments = [];
		this.firstReq = {};
		this.sync = '';
	}
}
var branchMap = new Map();
var itemsCount;
var timer = 0;
var bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '10mb', extended: true }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
var accesTok;
var instanceUrl;
var sf = require('node-salesforce');

var nodemailer = require('nodemailer');
var xoauth2 = require('xoauth2');
var events = require('events');
var check = 1;
var events = new events.EventEmitter();

var conn = new sf.Connection({
	// you can change loginUrl to connect to sandbox or prerelease env.
	//loginUrl : 'https://test.salesforce.com'
	loginUrl: 'https://' + process.env.env + '.salesforce.com'
});

setInterval(function() {
	forAll.httpGet('https://' + process.env.name + '.herokuapp.com', '');
}, 300000);

String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.split(search).join(replacement);
};

app.get('/', function(req, res) {
	res.send('refresh heroku');
});

app.post('/synccc', function(req, res) {
	synccc = false;
	res.send(synccc);
});

app.post('/dataForUpdateBitbucket', function(req, res) {
	console.log(typeof req.body.bitCred);
	var org = JSON.parse(req.body.bitCred).flosum_git__Git_Organization__c;
	var username = JSON.parse(req.body.bitCred).flosum_git__Git_User_Name__c;
	var password = JSON.parse(req.body.bitCred).flosum_git__Git_Password__c;
	var records = [];
	var changedRecords;
	var itemsMap = new Map();
	var instance = 'AND flosum_git__bitbucketSync__c = true';
	console.log('username', username);
	console.log('password', password);
	var branches = new Set();
	console.log('dataForUpdateBitbucket');
	conn.login(process.env.username, process.env.password, function(err, userInfo) {
		if (err) {
			console.log(err);
			synccc = false;
			return;
		}
		conn.query(
			'SELECT COUNT() FROM flosum_git__History_Git__c WHERE flosum_git__isLastVersion__c = true AND flosum_git__bitbucketSync__c = true',
			function(err, result) {
				if (err) {
					console.log('err', err);
				}
				else {
					console.log('result', result.totalSize);
					forAll
						.getFilesForCompare(records, 0, result.totalSize, conn, instance)
						.then(() => {
							console.log('records.length', records.length);
							console.log('END');
						})
						.then(() => {
							console.log('records', records.length);
							records = records.filter(function(item) {
								if (item.flosum_git__Bitbucket__c != null) {
									branches.add(item.flosum_git__Branch_Id__c);
									return item;
								}
							});
							console.log('branches', branches);
							conn.sobject('Flosum__Branch__c').retrieve(Array.from(branches), function(err, accounts) {
								if (err) {
									synccc = false;
									return console.error(err);
								}
								console.log('Flosum__Branch__c', accounts.length);
								records.forEach(function(item, index, array) {
									accounts.forEach(function(acc, i, ar) {
										if (
											item.flosum_git__Branch_Id__c === acc.Id ||
											acc.Id.includes(item.flosum_git__Branch_Id__c)
										) {
											item.Flosum__Branch_Name__c = acc.Flosum__Branch_Name__c;
										}
									});
								});

								var recordsWithResp = [];
								//console.log('records',JSON.stringify(records));
								setTimeout(function() {
									bitbucket
										.getBitbucketFiles2(records, username, password, org)
										.then((values) => {
											values.forEach(function(val, index, array) {
												let sfResp = JSON.parse(records[index].flosum_git__Bitbucket__c);
												val = JSON.parse(val);
												//     console.log('val',val);
												//    console.log('sfResp.commit.hash',sfResp.commit.hash );
												if (sfResp.commit != undefined) {
													if (sfResp.commit.hash != val.values[0].commit.hash) {
														console.log(
															'Hash',
															records[index].Id,
															sfResp.commit.hash,
															val.values[0].commit.hash
														);
														records[index].BitResp = val.values[0];
													}
												}
											});
										})
										.then(() => {
											changedRecords = records.filter(function(item) {
												if (item.BitResp != null || item.BitResp != undefined) {
													return item;
												}
											});
										})
										.then(() => {
											console.log('changedRecords', changedRecords.length);
											changedRecords.forEach(function(record, index, array) {
												if (itemsMap.get(record.flosum_git__Component__c) === undefined) {
													itemsMap.set(record.flosum_git__Component__c, [
														record
													]);
												}
												else {
													let arr = itemsMap.get(record.flosum_git__Component__c);
													arr.push(record);
													itemsMap.set(record.flosum_git__Component__c, arr);
												}

												if (index === changedRecords.length - 1) {
													records.forEach(function(rec, recIndex, recArray) {
														if (itemsMap.get(rec.flosum_git__Component__c) != undefined) {
															let exist = false;
															let arr = itemsMap.get(rec.flosum_git__Component__c);
															arr.forEach(function(arRecord, arIndex, arrArray) {
																if (
																	arRecord.flosum_git__Path__c ===
																	rec.flosum_git__Path__c
																) {
																	exist = true;
																}
															});
															if (!exist) {
																arr.push(rec);
																itemsMap.set(rec.flosum_git__Component__c, arr);
															}
														}
													});
												}
											});
										})
										.then(() => {
											var itemsList = [];
											itemsMap.forEach(function(values, key) {
												values.forEach(function(item, index, array) {
													//itemsList.push(item);
													if (item.BitResp === undefined) {
														itemsList.push(
															parser.parse(item.flosum_git__Bitbucket__c).links.self.href
														);
													}
													else {
														itemsList.push(item.BitResp.links.self.href);
													}
												});
											});
											let contents = [];
											let auth = 'Basic ';
											let tok = username + ':' + password;
											tok = Buffer.from(tok).toString('base64');
											auth = auth + tok;
											itemsList.forEach(function(o, i, a) {
												contents.push(forAll.httpGet(o, auth));
												if (i === itemsList.length - 1) {
													Promise.all(contents)
														.then((contentValues) => {
															var index = 0;
															itemsMap.forEach(function(values, key) {
																values.forEach(function(item, index, array) {
																	item.content = contentValues[index];
																	index++;
																});
															});
														})
														.then(() => {
															let GitHistoryArr = [];
															itemsMap.forEach(function(value, key) {
																let GitHistoryArrTEst = [];
																let zip = new JSZip();
																let type;
																let version;
																let component;
																let name = [];
																let CRC32;
																let history;
																value.forEach(function(o, index, array) {
																	history = {};
																	let content = o.content.replaceAll(/\n$/, '');
																	let localName = '';
																	version = o.flosum_git__Component_Version__c + 1;
																	type = o.flosum_git__Component_type__c;
																	component = o.flosum_git__Component__c;
																	history.flosum_git__Path__c = o.flosum_git__Path__c;
																	history.flosum_git__Component__c = component;
																	if (o.BitResp != undefined) {
																		history.flosum_git__Bitbucket__c = JSON.stringify(
																			o.BitResp
																		);
																	}
																	else {
																		history.flosum_git__Bitbucket__c = JSON.stringify(
																			o.flosum_git__Bitbucket__c
																		);
																	}

																	history.flosum_git__Branch_Id__c =
																		o.flosum_git__Branch_Id__c;
																	GitHistoryArrTEst.push(history);
																	o.name = o.flosum_git__Path__c.split(
																		'app/main/default/'
																	)[1];

																	if (type === 'CustomObject') {
																		let arr = o.name.split('/');
																		localName = arr[0] + '/' + arr[2];
																		name.push(localName);
																	}
																	else if (
																		type === 'CustomField' ||
																		type === 'ListView' ||
																		type === 'WebLink' ||
																		type === 'FieldSet' ||
																		type === 'BusinessProcess' ||
																		type === 'CompactLayout' ||
																		type === 'SharingReason' ||
																		type === 'ValidationRule' ||
																		type === 'RecordType'
																	) {
																		let arr = o.name.split('/');
																		let name1 = arr[0] + '/' + arr[3];
																		localName = name1.split('.')[0] + '.object';
																		name.push(name1.split('.')[0] + '.object');
																	}
																	else {
																		localName = o.name;
																		name.push(localName);
																	}
																	zip.file(
																		localName,
																		Buffer.from(content, 'ascii').toString('ascii')
																	);
																});
																zip
																	.generateAsync({ type: 'base64' })
																	.then(function(base64) {
																		var normalZip = new JSZip2();
																		var tempZip = new JSZip2(base64, {
																			base64: true
																		});
																		if (
																			(type === 'CustomObject' ||
																				value.length === 1) &&
																			type != 'AuraDefinitionBundle'
																		) {
																			var zipData = tempZip.files[
																				name[0]
																			].asBinary();
																			CRC32 = normalZip.crc32(zipData, 32);
																		}
																		else if (
																			(type === 'ApexClass' ||
																				value.length === 2) &&
																			type != 'AuraDefinitionBundle'
																		) {
																			var zipData = tempZip.files[

																					name[0].includes('.xml') ? name[1] :
																					name[0]
																			].asBinary();
																			var metaXMLData = tempZip.files[

																					name[0].includes('.xml') ? name[0] :
																					name[1]
																			].asBinary();
																			CRC32 =
																				normalZip.crc32(zipData, 32) +
																				' ' +
																				normalZip.crc32(metaXMLData, 32);
																		}
																		else if (
																			type === 'AuraDefinitionBundle' ||
																			value.length > 2
																		) {
																			let mapCrc32 = {};
																			name.forEach(function(
																				object,
																				index,
																				array
																			) {
																				var zipData = tempZip.files[
																					object
																				].asBinary();
																				let crc = normalZip.crc32(zipData, 32);
																				mapCrc32[object] = crc;
																			});
																			// mapCrc32 = {'aura/Test.cmp' : 12345634242, 'aura/Test.js' : 123456322334}; //fileName and crc code like above
																			var keys = Object.keys(mapCrc32).sort();
																			if (keys.length > 0)
																				CRC32 = mapCrc32[keys[0]];
																			for (var i = 1; i < keys.length; i++) {
																				CRC32 = Math.round(
																					(mapCrc32[keys[i]] + CRC32) / 2
																				);
																			}
																		}

																		let comhis = {
																			Flosum__Component__c: component,
																			Flosum__Version__c: version,
																			Flosum__CRC32__c: CRC32
																		};
																		conn
																			.sobject('Flosum__Component_History__c')
																			.create(comhis, function(err, history) {
																				if (!err) {
																					conn.sobject('Attachment').create({
																						ParentId: history.id,
																						Name: type,
																						Body: base64,
																						ContentType: 'application/zip'
																					}, function(
																						err,
																						uploadedAttachment
																					) {
																						if (!err) {
																							GitHistoryArrTEst.forEach(
																								function(
																									objMap,
																									index,
																									array
																								) {
																									objMap.flosum_git__Attachment_Id__c =
																										uploadedAttachment.id;
																									objMap.flosum_git__Component_History__c =
																										history.id;
																									objMap.flosum_git__Component_type__c = type;
																								}
																							);
																							conn
																								.sobject(
																									'Flosum__Component__c'
																								)
																								.update(
																									{
																										Id: component,
																										Flosum__Version__c: version,
																										Flosum__CRC32__c: CRC32
																									},
																									function(err, ret) {
																										if (
																											err ||
																											!ret.success
																										) {
																											return console.error(
																												err,
																												ret
																											);
																										}
																										// ...
																									}
																								);
																							conn
																								.sobject(
																									'flosum_git__History_Git__c'
																								)
																								.create(
																									GitHistoryArrTEst,
																									function(err, up) {
																										console.log(
																											'TEST222'
																										);
																										if (!err) {
																											console.log(
																												'UPPPP',
																												up
																											);
																										}
																										else {
																											console.log(
																												err
																											);
																											synccc = false;
																										}
																									}
																								);
																						}
																						else {
																							console.log(err);
																							synccc = false;
																						}
																					});
																				}
																				else {
																					console.log('err', err);
																					synccc = false;
																				}
																			});
																	});
															});
														});
												}
											});
										})
										.catch((err) => {
											if (err) console.log(err);
											synccc = false;
										});
								}, 100);
							});
						})
						.catch((err) => {
							if (err) {
								console.log('err', err);
							}
						});
				}
			}
		);
	});
});

app.post('/dataForUpdateGitLab', function(req, res) {
	console.log(typeof req.body.gitLab);
	var org = JSON.parse(req.body.gitLab).flosum_git__Git_Organization__c;
	var username = JSON.parse(req.body.gitLab).flosum_git__Git_User_Name__c;
	var password = JSON.parse(req.body.gitLab).flosum_git__Git_Password__c;
	var records = [];
	var repoRecords = [];
	var changedRecords;
	var repoChangedRecords;
	var itemsMap = new Map();
	var repoItemsMap = new Map();
	var branchWithProjId = new Map();
	var repoWithProjId = new Map();
	var componentsId = new Set();
	var repoComponentsId = new Set();
	let newMap = new Map();
	let repoNewMap = new Map();
	var instance = 'AND flosum_git__gitlabSync__c = true';
	console.log('username', username);
	console.log('password', password);
	var branches = new Set();
	var repos = new Set();
	console.log('dataForUpdateGitLab');

	conn.login(process.env.username, process.env.password, function(err, userInfo) {
		accesTok = conn.accessToken;
		instanceUrl = conn.instanceUrl;
		if (err) {
			console.log(err);
			synccc = false;
			return;
		}
		conn.query('SELECT COUNT() FROM flosum_git__History_Git__c WHERE flosum_git__isLastVersion__c = true '+instance, function(
			err,
			result
		) {
			if (err) {
				console.log('err', err);
			}
			else {
				console.log('result', result.totalSize);
				forAll
					.getFilesForCompare(repoRecords, 0, result.totalSize, conn, instance)
					.then(() => {
						console.log('records.length', repoRecords.length);
						console.log('END');
					})
					.then(() => {
						repoRecords = repoRecords.filter(function(item) {
							if (item.flosum_git__GitLab__c != null) {
								if(item.flosum_git__Branch_Id__c){
									if(!item.flosum_git__Repository_Id__c){
										branches.add(item.flosum_git__Branch_Id__c);
										return item;
									}
								}else if(item.flosum_git__Repository_Id__c){
									console.log('item.flosum_git__Repository__c',item.flosum_git__Repository_Id__c);
									repos.add(item.flosum_git__Repository_Id__c);
									return item;
								}								
							}
						});
						Array.from(branches).forEach(function(branch, brIndex, brArray) {
							let branch2 = {
								branchId: branch,
								commitType: 'branch'
							};
			
							let branch222 = {
								branchId: JSON.stringify(branch2)
							};
							forAll
								.httpCallSF(
									instanceUrl + '/services/apexrest/flosum_git/gitLab',
									'POST',
									branch222,
									accesTok
								)
								.then((resp) => {
									let proj = parser.parse(resp);
									proj = JSON.parse(proj);
									proj.branchId = branch;
									branchWithProjId.set(branch, proj);
							//		console.log('branchWithProjId',branchWithProjId);
								});
						});

//console.log('repos',Array.from(repos));
            console.log('repos.length',Array.from(repos).length);
            if(Array.from(repos).length != 0){
              console.log('REEEEEEEEEEEEPPPPPPPPPPPPOOOOOOOOOOOOO');
              Array.from(repos).forEach(function(repo, repIndex, repArray) {
                let branch2 = {
                  branchId: repo,
                  commitType: 'repo'
                };
        
                let branch222 = {
                  branchId: JSON.stringify(branch2)
                };
                forAll
                  .httpCallSF(
                    instanceUrl + '/services/apexrest/flosum_git/gitLab',
                    'POST',
                    branch222,
                    accesTok
                  )
                  .then((resp) => {
                    let proj = parser.parse(resp);
                    proj = JSON.parse(proj);
                    proj.branchId = repo;
                    repoWithProjId.set(repo, proj);
                    console.log('repoWithProjId',repoWithProjId);
                  });
              });
              
            conn.sobject('Flosum__Repository__c').retrieve(Array.from(repos), function(err, accounts) {
              if (err) {
                synccc = false;
                return console.error(err);
              }
              repoRecords.forEach(function(item, index, array) {
                accounts.forEach(function(acc, i, ar) {
                  if (
                    item.flosum_git__Repository_Id__c === acc.Id ||
                    acc.Id.includes(item.flosum_git__Repository_Id__c)
                  ) {
					  console.log('itemREPO',item);
                    item.Flosum__Branch_Name__c = 'master';
                  }
                });
              });
              var recordsWithResp = [];
              setTimeout(function() {
				var contents = [];
				console.log('repoRecords.length',repoRecords.length);
				console.log('repoRecords',repoRecords);
                repoRecords.forEach(function(obj, index, array) {
                  if(obj.flosum_git__Repository_Id__c){                    
                  let brId = obj.flosum_git__Repository_Id__c;
                  let branchName = 'master';
                  let path = obj.flosum_git__Path__c;
                  path = path.replaceAll('/', '%2F');
                  path = path.replaceAll('.', '%2E');
                  
                  if(repoWithProjId.size != 0){
                    //console.log('branchWithProjId.get(brId).projectId',repoWithProjId);
                  contents.push(
                    forAll.httpGet(
                      'https://gitlab.com/api/v4/projects/' +
                      repoWithProjId.get(brId).projectId +
                        '/repository/files/' +
                        path +
                        '?ref=' +
                        branchName,null,
                        repoWithProjId.get(brId).pat,true
                    )
                  );
                  if (index === repoRecords.length - 1) {
                    Promise.all(contents)
                      .then((values) => {
                        //console.log('values',values);
                        values.forEach(function(val, index, array) {
                          let sfResp = JSON.parse(repoRecords[index].flosum_git__GitLab__c);
                          if (sfResp.content_sha256 != JSON.parse(val).content_sha256) {
                            let resp = JSON.parse(val);
                            delete resp.content;
                            repoRecords[index].flosum_git__GitLab__c = resp;
                            repoComponentsId.add(repoRecords[index].flosum_git__Component__c);
                          }
                        });
                      })
                      .then(() => {
                        repoChangedRecords = repoRecords.filter(function(item) {
                          if (
                            item.flosum_git__GitLab__c != null ||
                            item.flosum_git__GitLab__c != undefined
                          ) {
                            return item;
                          }
                        });
                      }).then(() => {
                        repoChangedRecords.forEach(function(record, index, array) {
                          if (repoItemsMap.get(record.flosum_git__Component__c) === undefined) {
                            repoItemsMap.set(record.flosum_git__Component__c, [
                              record
                            ]);
                          }
                          else {
                            let arr = repoItemsMap.get(record.flosum_git__Component__c);
                            arr.push(record);
                            repoItemsMap.set(record.flosum_git__Component__c, arr);
                          }
                        });
                      })
                      .then(() => {
                        Array.from(repoComponentsId).forEach(function(o, i, a) {
							repoNewMap.set(o, repoItemsMap.get(o));
                        });
                      })
                      .then(() => {
                        //console.log('itemsMap',itemsMap);
                        let length = 0;
                        repoNewMap.forEach(function(values, key) {
                          values.forEach(function(item, index, array) {
                            length += 1;
                          });
                        });
                        console.log('length',length);
                        var itemsList = [];
                        let ii = 0;
						console.log(691);
						console.log('repoWithProjId',repoWithProjId);
						console.log('repoNewMap',repoNewMap);
                        repoNewMap.forEach(function(values, key) {
                          values.forEach(function(item, index, array) {
                            let brId = item.flosum_git__Repository_Id__c;
                            let branchName = 'master';
                            let path = item.flosum_git__Path__c;
                            path = path.replaceAll('/', '%2F');
                            path = path.replaceAll('.', '%2E');                          
                            itemsList.push(
                              forAll.httpGet(
                                'https://gitlab.com/api/v4/projects/' +
                                repoWithProjId.get(brId).projectId +
                                  '/repository/files/' +
                                  path +
                                  '?ref=' +
                                  branchName,null,
                                  repoWithProjId.get(brId).pat,true
                              )
                            );
                            ii++;
                            if (ii === length) {
                              Promise.all(itemsList).then((contentValues) => {
                                var index = 0;
                                repoNewMap.forEach(function(values, key) {
                                  values.forEach(function(item, index, array) {
                                    item.flosum_git__GitLab__c =
                                      contentValues[index];
                                    index++;
                                  });
                                });
                              });
                            }
                          });
                        });
                      })
                      .then(() => {
                        setTimeout(function() {
                          let GitHistoryArr = [];
                          repoNewMap.forEach(function(value, key) {
                            let GitHistoryArrTEst = [];
                            let zip = new JSZip();
                            let type;
                            let version;
                            let component;
                            let name = [];
                            let CRC32;
let history;
                            value.forEach(function(o, index, array) {
                              history = {};
                              let content = JSON.parse(
                                o.flosum_git__GitLab__c
                              ).content.replaceAll(/\n$/, '');
                              let localName = '';
                              version = o.flosum_git__Component_Version__c + 1;
                              type = o.flosum_git__Component_type__c;
                              component = o.flosum_git__Component__c;
                              history.flosum_git__Path__c = o.flosum_git__Path__c;
                              history.flosum_git__Component__c = component;
                              history.flosum_git__GitLab__c = o.flosum_git__GitLab__c;
                              history.flosum_git__Repository_Id__c =
                                o.flosum_git__Repository_Id__c;
                              GitHistoryArrTEst.push(history);
                              o.name = o.flosum_git__Path__c.split(
                                'app/main/default/'
                              )[1];

                              if (type === 'CustomObject') {
                                let arr = o.name.split('/');
                                localName = arr[0] + '/' + arr[2];
                                name.push(localName);
                              }
                              else if (
                                type === 'CustomField' ||
                                type === 'ListView' ||
                                type === 'WebLink' ||
                                type === 'FieldSet' ||
                                type === 'BusinessProcess' ||
                                type === 'CompactLayout' ||
                                type === 'SharingReason' ||
                                type === 'ValidationRule' ||
                                type === 'RecordType'
                              ) {
                                let arr = o.name.split('/');
                                let name1 = arr[0] + '/' + arr[3];
                                localName = name1.split('.')[0] + '.object';
                                name.push(name1.split('.')[0] + '.object');
                              }
                              else {
                                localName = o.name;
                                name.push(localName);
                              }
                              zip.file(
                                localName,
                                Buffer.from(content, 'base64').toString('ascii')
                              );
                            });
                            zip.generateAsync({ type: 'base64' }).then(function(base64) {
                              var normalZip = new JSZip2();
                              var tempZip = new JSZip2(base64, { base64: true });
                              if (
                                (type === 'CustomObject' || value.length === 1) &&
                                type != 'AuraDefinitionBundle'
                              ) {
                                var zipData = tempZip.files[name[0]].asBinary();
                                CRC32 = normalZip.crc32(zipData, 32);
                              }
                              else if (
                                (type === 'ApexClass' || value.length === 2) &&
                                type != 'AuraDefinitionBundle'
                              ) {
                                var zipData = tempZip.files[

                                    name[0].includes('.xml') ? name[1] :
                                    name[0]
                                ].asBinary();
                                var metaXMLData = tempZip.files[name[0].includes('.xml') ? name[0] :name[1]].asBinary();
                                CRC32 =
                                  normalZip.crc32(zipData, 32) +
                                  ' ' +
                                  normalZip.crc32(metaXMLData, 32);
                              }
                              else if (
                                type === 'AuraDefinitionBundle' ||
                                value.length > 2
                              ) {
                                let mapCrc32 = {};
                                name.forEach(function(object, index, array) {
                                  var zipData = tempZip.files[object].asBinary();
                                  let crc = normalZip.crc32(zipData, 32);
                                  mapCrc32[object] = crc;
                                });
                                var keys = Object.keys(mapCrc32).sort();
                                if (keys.length > 0) CRC32 = mapCrc32[keys[0]];
                                for (var i = 1; i < keys.length; i++) {
                                  CRC32 = Math.round((mapCrc32[keys[i]] + CRC32) / 2);
                                }
                              }

                              let comhis = {
                                Flosum__Component__c: component,
                                Flosum__Version__c: version,
                                Flosum__CRC32__c: CRC32
                              };
                              conn
                                .sobject('Flosum__Component_History__c')
                                .create(comhis, function(err, history) {
                                  if (!err) {
                                    conn.sobject('Attachment').create({
                                      ParentId: history.id,
                                      Name: type,
                                      Body: base64,
                                      ContentType: 'application/zip'
                                    }, function(err, uploadedAttachment) {
                                      if (!err) {
                                        GitHistoryArrTEst.forEach(function(
                                          objMap,
                                          index,
                                          array
                                        ) {
                                          objMap.flosum_git__Attachment_Id__c =
                                            uploadedAttachment.id;
                                          objMap.flosum_git__Component_History__c =
                                            history.id;
                                          objMap.flosum_git__Component_type__c = type;
                                        });
                                        conn
                                          .sobject('Flosum__Component__c')
                                          .update(
                                            {
                                              Id: component,
                                              Flosum__Version__c: version,
                                              Flosum__CRC32__c: CRC32
                                            },
                                            function(err, ret) {
                                              if (err || !ret.success) {
                                                return console.error(
                                                  err,
                                                  ret
                                                );
                                              }
                                              // ...
                                            }
                                          );
                                        conn
                                          .sobject('flosum_git__History_Git__c')
                                          .create(GitHistoryArrTEst, function(
                                            err,
                                            up
                                          ) {
                                            console.log('TEST222');
                                            if (!err) {
                                              console.log('UPPPP', up);
                                            }
                                            else {
                                              console.log(err);
                                              synccc = false;
                                            }
                                          });
                                      }
                                      else {
                                        console.log(err);
                                        synccc = false;
                                      }
                                    });
                                  }
                                  else {
                                    console.log('err', err);
                                    synccc = false;
                                  }
                                });
                            });
                          });
                        }, 10000);
                      })
                      .catch((err) => {
                        if (err) console.log(err);
                        synccc = false;
                      });
                  }
                  }
                  }
                });                
              }, 10000);
            });

            }
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


						/*console.log(946);
						console.log('branches',branches);
						conn.sobject('Flosum__Branch__c').retrieve(Array.from(branches), function(err, accounts) {
							console.log(948);
							if (err) {
								console.log(951);
								synccc = false;
								return console.error(err);
							}
							console.log(955);
							records.forEach(function(item, index, array) {
								accounts.forEach(function(acc, i, ar) {
									if (
										item.flosum_git__Branch_Id__c === acc.Id ||
										acc.Id.includes(item.flosum_git__Branch_Id__c)
									) {
										item.Flosum__Branch_Name__c = acc.Flosum__Branch_Name__c;
									}
								});
							});
							var recordsWithResp = [];
							setTimeout(function() {
								var contents = [];
								console.log(967);
								records.forEach(function(obj, index, array) {
									let brId = obj.flosum_git__Branch_Id__c;
									let branchName = obj.Flosum__Branch_Name__c;
									let path = obj.flosum_git__Path__c;
									path = path.replaceAll('/', '%2F');
									path = path.replaceAll('.', '%2E');
								//	console.log('branchWithProjId.get(brId).projectId',branchWithProjId.get(brId).projectId);
									contents.push(
										forAll.httpGet(
											'https://gitlab.com/api/v4/projects/' +
												branchWithProjId.get(brId).projectId +
												'/repository/files/' +
												path +
												'?ref=' +
												branchName,null,
											branchWithProjId.get(brId).pat,true
										)
									);
									console.log(986);
									if (index === records.length - 1) {
										Promise.all(contents)
											.then((values) => {
												//console.log('values',values);
												values.forEach(function(val, index, array) {
													let sfResp = JSON.parse(records[index].flosum_git__GitLab__c);
													if (sfResp.content_sha256 != JSON.parse(val).content_sha256) {
														let resp = JSON.parse(val);
														delete resp.content;
														records[index].flosum_git__GitLab__c = resp;
														componentsId.add(records[index].flosum_git__Component__c);
													}
												});
											})
											.then(() => {
												changedRecords = records.filter(function(item) {
													if (
														item.flosum_git__GitLab__c != null ||
														item.flosum_git__GitLab__c != undefined
													) {
														return item;
													}
												});
											})
											.then(() => {
												changedRecords.forEach(function(record, index, array) {
													if (itemsMap.get(record.flosum_git__Component__c) === undefined) {
														itemsMap.set(record.flosum_git__Component__c, [
															record
														]);
													}
													else {
														let arr = itemsMap.get(record.flosum_git__Component__c);
														arr.push(record);
														itemsMap.set(record.flosum_git__Component__c, arr);
													}
												});
											})
											.then(() => {
												Array.from(componentsId).forEach(function(o, i, a) {
													newMap.set(o, itemsMap.get(o));
												});
											})
											.then(() => {
												//console.log('itemsMap',itemsMap);
												let length = 0;
												newMap.forEach(function(values, key) {
													values.forEach(function(item, index, array) {
														length += 1;
													});
												});
												console.log('length',length);
												var itemsList = [];
												let ii = 0;
												console.log(1041);
												newMap.forEach(function(values, key) {
													values.forEach(function(item, index, array) {
														let brId = item.flosum_git__Branch_Id__c;
														let branchName = item.Flosum__Branch_Name__c;
														let path = item.flosum_git__Path__c;
														path = path.replaceAll('/', '%2F');
														path = path.replaceAll('.', '%2E');
														console.log('https://gitlab.com/api/v4/projects/' +
														branchWithProjId.get(brId).projectId +
														'/repository/files/' +
														path +
														'?ref=' +
														branchName);
														itemsList.push(
															forAll.httpGet(
																'https://gitlab.com/api/v4/projects/' +
																	branchWithProjId.get(brId).projectId +
																	'/repository/files/' +
																	path +
																	'?ref=' +
																	branchName,null,
																branchWithProjId.get(brId).pat,true
															)
														);
														ii++;
														if (ii === length) {
															Promise.all(itemsList).then((contentValues) => {
																var index = 0;
																newMap.forEach(function(values, key) {
																	values.forEach(function(item, index, array) {
																		item.flosum_git__GitLab__c =
																			contentValues[index];
																		index++;
																	});
																});
															});
														}
													});
												});
											})
											.then(() => {
												setTimeout(function() {
													let GitHistoryArr = [];
													newMap.forEach(function(value, key) {
														let GitHistoryArrTEst = [];
														let zip = new JSZip();
														let type;
														let version;
														let component;
														let name = [];
														let CRC32;
														let history;
														value.forEach(function(o, index, array) {
															history = {};
															let content = JSON.parse(
																o.flosum_git__GitLab__c
															).content.replaceAll(/\n$/, '');
															let localName = '';
															version = o.flosum_git__Component_Version__c + 1;
															type = o.flosum_git__Component_type__c;
															component = o.flosum_git__Component__c;
															history.flosum_git__Path__c = o.flosum_git__Path__c;
															history.flosum_git__Component__c = component;
															history.flosum_git__GitLab__c = o.flosum_git__GitLab__c;
															history.flosum_git__Branch_Id__c =
																o.flosum_git__Branch_Id__c;
															GitHistoryArrTEst.push(history);
															o.name = o.flosum_git__Path__c.split(
																'app/main/default/'
															)[1];

															if (type === 'CustomObject') {
																let arr = o.name.split('/');
																localName = arr[0] + '/' + arr[2];
																name.push(localName);
															}
															else if (
																type === 'CustomField' ||
																type === 'ListView' ||
																type === 'WebLink' ||
																type === 'FieldSet' ||
																type === 'BusinessProcess' ||
																type === 'CompactLayout' ||
																type === 'SharingReason' ||
																type === 'ValidationRule' ||
																type === 'RecordType'
															) {
																let arr = o.name.split('/');
																let name1 = arr[0] + '/' + arr[3];
																localName = name1.split('.')[0] + '.object';
																name.push(name1.split('.')[0] + '.object');
															}
															else {
																localName = o.name;
																name.push(localName);
															}
															zip.file(
																localName,
																Buffer.from(content, 'base64').toString('ascii')
															);
														});
														zip.generateAsync({ type: 'base64' }).then(function(base64) {
															var normalZip = new JSZip2();
															var tempZip = new JSZip2(base64, { base64: true });
															if (
																(type === 'CustomObject' || value.length === 1) &&
																type != 'AuraDefinitionBundle'
															) {
																var zipData = tempZip.files[name[0]].asBinary();
																CRC32 = normalZip.crc32(zipData, 32);
															}
															else if (
																(type === 'ApexClass' || value.length === 2) &&
																type != 'AuraDefinitionBundle'
															) {
																var zipData = tempZip.files[

																		name[0].includes('.xml') ? name[1] :
																		name[0]
																].asBinary();
																var metaXMLData = tempZip.files[

																		name[0].includes('.xml') ? name[0] :
																		name[1]
																].asBinary();
																CRC32 =
																	normalZip.crc32(zipData, 32) +
																	' ' +
																	normalZip.crc32(metaXMLData, 32);
															}
															else if (
																type === 'AuraDefinitionBundle' ||
																value.length > 2
															) {
																let mapCrc32 = {};
																name.forEach(function(object, index, array) {
																	var zipData = tempZip.files[object].asBinary();
																	let crc = normalZip.crc32(zipData, 32);
																	mapCrc32[object] = crc;
																});
																var keys = Object.keys(mapCrc32).sort();
																if (keys.length > 0) CRC32 = mapCrc32[keys[0]];
																for (var i = 1; i < keys.length; i++) {
																	CRC32 = Math.round((mapCrc32[keys[i]] + CRC32) / 2);
																}
															}

															let comhis = {
																Flosum__Component__c: component,
																Flosum__Version__c: version,
																Flosum__CRC32__c: CRC32
															};
															console.log(1194);
															conn
																.sobject('Flosum__Component_History__c')
																.create(comhis, function(err, history) {
																	console.log(1198);
																	if (!err) {
																		conn.sobject('Attachment').create({
																			ParentId: history.id,
																			Name: type,
																			Body: base64,
																			ContentType: 'application/zip'
																		}, function(err, uploadedAttachment) {
																			if (!err) {
																				GitHistoryArrTEst.forEach(function(
																					objMap,
																					index,
																					array
																				) {
																					objMap.flosum_git__Attachment_Id__c =
																						uploadedAttachment.id;
																					objMap.flosum_git__Component_History__c =
																						history.id;
																					objMap.flosum_git__Component_type__c = type;
																				});
																				conn
																					.sobject('Flosum__Component__c')
																					.update(
																						{
																							Id: component,
																							Flosum__Version__c: version,
																							Flosum__CRC32__c: CRC32
																						},
																						function(err, ret) {
																							if (err || !ret.success) {
																								return console.error(
																									err,
																									ret
																								);
																							}
																							// ...
																						}
																					);
																				conn
																					.sobject(
																						'flosum_git__History_Git__c'
																					)
																					.create(GitHistoryArrTEst, function(
																						err,
																						up
																					) {
																						console.log('TEST222');
																						if (!err) {
																							console.log('UPPPP', up);
																						}
																						else {
																							console.log(err);
																							synccc = false;
																						}
																					});
																			}
																			else {
																				console.log(err);
																				synccc = false;
																			}
																		});
																	}
																	else {
																		console.log('err', err);
																		synccc = false;
																	}
																});
														});
													});
												}, 10000);
											})
											.catch((err) => {
												if (err) console.log(err);
												synccc = false;
											});
									}
								});								
							}, 10000);
						});*/
					});
			}
		});
	});
});

app.post('/dataForUpdate', function(req, res) {
	if (req.body.mode === 'update') {
		console.log('UPDATE----------------------');
		console.log('req.body.preparedData.length', req.body.preparedData.length);
		req.body.preparedData.forEach(function(data, dataIndex, dataArray) {
			if (localFilesMap.has(data.flosum_git__Branch_Id__c)) {
				let arr = localFilesMap.get(data.flosum_git__Branch_Id__c);
				arr.push(data);
				localFilesMap.set(data.flosum_git__Branch_Id__c, arr);
			}
			else {
				localFilesMap.set(data.flosum_git__Branch_Id__c, [
					data
				]);
			}
		});
		reposByBranchId = req.body.reposByBranchId;
		getRecordTypeIdbyName = req.body.getRecordTypeIdbyName;
		gitOrgSettings = req.body.gitOrgSettings;
		// let records = [];
		// let localFilesMap = new Map();
		// let returnGitFilesMap = new Map();
		//   console.log('req.body.preparedData',preparedData.length);
		//   console.log('req.body.reposByBranchId',reposByBranchId);
		//   console.log('req.body.getRecordTypeIdbyName',getRecordTypeIdbyName);
		//   console.log('gitOrgSettings',gitOrgSettings);
	}
	else {
		console.log(
			'FINISH------------------------------------------------------------------------------------------------------------------------------------------------'
		);
//		console.log('Object.keys(localFilesMap)', localFilesMap.keys());
		console.log('localFilesMap.has("a011i0000097T7XAAU")', localFilesMap.has('a011i0000097T7XAAU'));
		const badArr = [];
		const uniqueArray = localFilesMap.get('a011i0000097T7XAAU').filter((thing, index) => {
			/*if(thing.flosum_git__Path__c === 'app/main/default/classes/XMLparse.cls'){
        console.log('ERR = ', thing);
      }*/
			if (
				index ===
				localFilesMap.get('a011i0000097T7XAAU').findIndex((obj) => {
					return obj.Id === thing.Id;
				})
			) {
				return true;
			}
			else {
				badArr.push(thing);
				return false;
			}
		});
		console.log('uniqueArray', uniqueArray.length);
		console.log('badArr.length', badArr.length);
//		console.log('badArr', badArr);
		console.log('ALLELL');
		let allGitObjects = [];
		let ind = -1;
		let keys = Object.keys(reposByBranchId).length;
	//	console.log('keys', keys);
	//	console.log('reposByBranchId', reposByBranchId);
		Object.keys(reposByBranchId).forEach(function(key, item) {
	//		console.log('reposByBranchId[key]', reposByBranchId[key]);
			let tok = gitOrgSettings.flosum_git__Git_User_Name__c + ':' + gitOrgSettings.flosum_git__Git_Password__c;
			tok = Buffer.from(tok).toString('base64');
			var tokk = 'Basic ' + tok;
			git
				.getGitHubBranchObjects(
					key,
					JSON.parse(reposByBranchId[key]).repo,
					JSON.parse(reposByBranchId[key]).sha,
					tokk,
					gitOrgSettings.flosum_git__Git_Organization__c,
					getRecordTypeIdbyName
				)
				.then((respGit) => {
					allGitObjects.push({ values: respGit, branchId: key });
					ind++;
				})
				.then(() => {
					if (ind === keys - 1) {
						allGitObjects.forEach(function(gitObj, gitIndex, gitArr) {
							if (returnGitFilesMap.has(gitObj.branchId)) {
								console.log('TESTTEST - YES');
								let tempList = returnGitFilesMap.get(gitObj.branchId);
								tempList.push(...gitObj.values);
								returnGitFilesMap.set(gitObj.branchId, tempList);
								if (allGitObjects.length - 1 === gitIndex) {
									git.newFiles(
										returnGitFilesMap,
										localFilesMap,
										gitOrgSettings,
										conn,
										reposByBranchId,
										getRecordTypeIdbyName
									);
									//   conn.login(process.env.username, process.env.password, function(err, userInfo) {
									//     let results = 0;

									//     forAll.getFilesForCompareWithBranch(records,0,countHist,conn,flosumBrIds,localFilesMap).then( () => {
									//       throw Exception();
									//       git.newFiles(returnGitFilesMap,flosumBrIds,localFilesMap,gitOrgSettings,conn,reposByBranchId);
									//     });
									// });
								}
							}
							else {
								console.log('TESTTEST - No');
								returnGitFilesMap.set(gitObj.branchId, gitObj.values);
								if (allGitObjects.length - 1 === gitIndex) {
									git.newFiles(
										returnGitFilesMap,
										localFilesMap,
										gitOrgSettings,
										conn,
										reposByBranchId,
										getRecordTypeIdbyName
									);
									/*conn.login(process.env.username, process.env.password, function(err, userInfo) {
                let results = 0;
             //   console.log('flosumBrIds',flosumBrIds);
             console.log('Object.keys(localFilesMap)',Object.keys(localFilesMap));
                forAll.getFilesForCompareWithBranch(records,0,countHist,conn,flosumBrIds,localFilesMap).then( () => {
                  git.newFiles(returnGitFilesMap,flosumBrIds,localFilesMap,gitOrgSettings,conn,reposByBranchId);
                });            
            });*/
								}
							}
						});
					}
				});
		});

		/*setTimeout(function(){
  allGitObjects.forEach(function(gitObj,gitIndex,gitArr){
    console.log('gitObj',gitObj);
    if(returnGitFilesMap.has(gitObj.branchId)){
      let tempList = returnGitFilesMap.get(gitObj.branchId);
      tempList.push(gitObj);
      returnGitFilesMap.set(gitObj.branchId, tempList);
  }else{
      returnGitFilesMap.set(gitObj.branchId,[gitObj]);
  }
  });
},10000);
*/
	}
});

app.post('/showLength', function(req, res) {
	var id = req.body.branchId;
	console.log();
});

app.post('/commit', function(req, res) {
  console.log('synccc', synccc);

	// if(req.body.sync != undefined){
	// }

	if (req.body.mode === 'update') {
    console.log('update------------------------------------------------------------------------');
    //console.log('req.body.data.branch.Id',req.body.data.repo.Id);
		//console.log('branchMap', branchMap);
    console.log('req',req.body.commitType);
		if (req.body.commitType === 'branch') {
			if (branchMap.has(req.body.data.branch.Id)) {
				var components = req.body.components;
				var histories = req.body.histories;
				var attachments = parser.parse(req.body.attachments);
				branchMap.get(req.body.data.branch.Id).attachments.push(...attachments);
				var componentsKeys = Object.keys(components);
				var historiesKeys = Object.keys(histories);
				branchMap.get(req.body.data.branch.Id).data = req.body.data;
				for (let key of componentsKeys) {
					branchMap.get(req.body.data.branch.Id).components[key] = components[key];
				}

				for (let hisKey of historiesKeys) {
					branchMap.get(req.body.data.branch.Id).histories[hisKey] = histories[hisKey];
				}
			//	console.log(
				//	'Object.values(branchMap.get(req.body.data.branch.Id).components).length',
				//	Object.values(branchMap.get(req.body.data.branch.Id).components).length
			//	);
			}
			else {
				console.log('NOT FOUND IN MAP');
			}
		}
		else if (req.body.commitType === 'repo') {

      if (branchMap.has(req.body.data.repo.Id)) {
				var components = req.body.components;
				var histories = req.body.histories;
				var attachments = parser.parse(req.body.attachments);
				branchMap.get(req.body.data.repo.Id).attachments.push(...attachments);
				var componentsKeys = Object.keys(components);
				var historiesKeys = Object.keys(histories);
				branchMap.get(req.body.data.repo.Id).data = req.body.data;
				for (let key of componentsKeys) {
					branchMap.get(req.body.data.repo.Id).components[key] = components[key];
				}

				for (let hisKey of historiesKeys) {
					branchMap.get(req.body.data.repo.Id).histories[hisKey] = histories[hisKey];
				}
				console.log(
					'Object.values(branchMap.get(req.body.data.branch.Id).components).length',
					Object.values(branchMap.get(req.body.data.repo.Id).components).length
				);
			}
			else {
				console.log('NOT FOUND IN MAP');
			}


		}
	}
	else if (req.body.mode === 'callService') {
		console.log('req',req.body);
		console.log('----------callService---------------');
		if (!branchMap.has(req.body.branchId)) {
			var newCommit = new Items();
			newCommit.sync = req.body.sync;
			newCommit.firstReq = req.body;
			console.log('this is first req', newCommit.firstReq);
			branchMap.set(req.body.branchId, newCommit);
			console.log('callService------------------------------------------------------------------------');
			conn.login(process.env.username, process.env.password, function(err, userInfo) {
				if (err) {
					console.log('err', err);
				}
				accesTok = conn.accessToken;
				instanceUrl = conn.instanceUrl;
				console.log('instanceUrl', instanceUrl);
				console.log('accesTok', accesTok);
				let branch2 = {
					branchId: req.body.branchId,
					commitType: req.body.commitType
				};

				let branch = {
					branchId: JSON.stringify(branch2)
				};

				forAll
					.httpCallSF(instanceUrl + '/services/apexrest/flosum_git/branches', 'POST', branch, accesTok)
					.then((ress) => {
						console.log('r', ress);
					})
					.catch((err) => {
						if (err) {
							console.log('err', err);
						}
					});
				return;
			});
			console.log('----------first---------------');
		}
		else {
			console.log('----------error---------------(not really)');
			res.send('exist');
		}
	}
	else {
		console.log(
			'FINISH------------------------------------------------------------------------------------------------------------------------------------------------'
		);
		if (req.body.commitType === 'branch') {
			var temp = branchMap.get(req.body.branchId).data.branch.Flosum__Repository__r.Name;
			var tempOut;
			tempOut = temp.replace(/[^a-zA-Z0-9]/g, '-');
			var arr = [];
			arr = tempOut.split('');
			var repository = '';
			arr.forEach(function(element, index) {
				if (arr.length - 1 == index) {
					repository += arr[index];
				}
				else {
					if (arr[index] == '-' && arr[index + 1] == '-') {
					}
					else {
						repository += arr[index];
					}
				}
			});
			// branchMap.get(req.body.branchId).data.branch.Flosum__Repository__r.Name = repository;
			console.log(
				'branchMap.get(req.body.branchId).data.branch.Flosum__Repository__r.Name',
				branchMap.get(req.body.branchId).data.branch.Flosum__Repository__r.Name
			);
			setTimeout(function() {
				if (branchMap.get(req.body.branchId).sync === 'GitHub') {
					fs.appendFile('mynewfile1.txt', JSON.stringify(branchMap.get(req.body.branchId)), function(err) {
						if (err) throw err;
						console.log('Saved!');
					});
					git.gitCommit(req, branchMap.get(req.body.branchId), branchMap.get(req.body.branchId).firstReq);
					branchMap.delete(req.body.branchId);
				}
				else if (branchMap.get(req.body.branchId).sync === 'GitLab') {
					setTimeout(function() {
						gitlab.GitLabCommit(
							req,
							branchMap.get(req.body.branchId),
							branchMap.get(req.body.branchId).firstReq
						);
						branchMap.delete(req.body.branchId);
					}, 10000);
				}
				else if (branchMap.get(req.body.branchId).sync === 'BitBucket') {
					setTimeout(function() {
						bitbucket.bitbucketPrepareCommit(
							req,
							branchMap.get(req.body.branchId),
							branchMap.get(req.body.branchId).firstReq
						);
						branchMap.delete(req.body.branchId);
					}, 10000);
				}
			}, 5000);
		}
		else if (req.body.commitType === 'repo') {
      console.log('REPO REPO REPO');
      
      var temp = branchMap.get(req.body.branchId).data.repo.Name;
			var tempOut;
			tempOut = temp.replace(/[^a-zA-Z0-9]/g, '-');
			var arr = [];
			arr = tempOut.split('');
			var repository = '';
			arr.forEach(function(element, index) {
				if (arr.length - 1 == index) {
					repository += arr[index];
				}
				else {
					if (arr[index] == '-' && arr[index + 1] == '-') {
					}
					else {
						repository += arr[index];
					}
				}
			});
			branchMap.get(req.body.branchId).data.repo.Name = repository;
		//	console.log(
		//		'branchMap.get(req.body.branchId).data.branch.Flosum__Repository__r.Name',
		//		branchMap.get(req.body.branchId)
		//	);
			setTimeout(function() {
				if (branchMap.get(req.body.branchId).sync === 'GitHub') {
					git.gitCommit(req, branchMap.get(req.body.branchId), branchMap.get(req.body.branchId).firstReq);
					branchMap.delete(req.body.branchId);
				}
				else if (branchMap.get(req.body.branchId).sync === 'GitLab') {
					setTimeout(function() {
						gitlab.GitLabCommit(
							req,
							branchMap.get(req.body.branchId),
							branchMap.get(req.body.branchId).firstReq
						);
					//	console.log('branchMap.get(req.body.branchId),',branchMap.get(req.body.branchId));
						branchMap.delete(req.body.branchId);
					}, 10000);
				}
				else if (branchMap.get(req.body.branchId).sync === 'BitBucket') {
					setTimeout(function() {
						bitbucket.bitbucketPrepareCommit(
							req,
							branchMap.get(req.body.branchId),
							branchMap.get(req.body.branchId).firstReq
						);
						branchMap.delete(req.body.branchId);
					}, 10000);
				}
			}, 5000);

		}
	}
});

app.listen(port, function() {
	console.log(`Example app listening on port !`);
});
