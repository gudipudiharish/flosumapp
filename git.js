var jsforce = require('jsforce');
var fs = require('fs');
var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
var AdmZip = require('adm-zip');
var parser = require('json-parser');
var JSZip2 = require('jszip');
var JSZip = require('./jszip');
var forAll = require('./forAll');
var sf = require('node-salesforce');
const util = require('util');
var conn = new sf.Connection({
	// you can change loginUrl to connect to sandbox or prerelease env.
	loginUrl: 'https://' + process.env.env + '.salesforce.com'
	//loginUrl : 'https://test.salesforce.com'
});
module.exports = {
	testFun: function (returnGitFilesMap, localFilesMap) {
		return new Promise(function (resolve, reject) {
			/*	console.log('returnGitFilesMap', returnGitFilesMap);
					console.log('branchIds', branchIds);
					console.log('localFilesMap', localFilesMap);*/

			console.log('localFilesMap.get("a011i0000097T7XAAU").length', localFilesMap.get('a011i0000097T7XAAU').length);
			console.log('returnGitFilesMap.get("a011i0000097T7XAAU").length', returnGitFilesMap.get('a011i0000097T7XAAU').length);
			var names = new Set();
			var a = [];
			var changedObjectsMap = new Map();
			var newObjectsOnGit = [];
			//console.log('TEST0');
			Array.from(localFilesMap.keys()).forEach(function (obj, index, array) {
				console.log('TEST');
				/*        console.log('obj',obj);
						console.log('returnGitFilesMap',returnGitFilesMap.get(obj));*/
				if (returnGitFilesMap.get(obj) != undefined) {
					returnGitFilesMap.get(obj).forEach(function (gitFile, fileIndex, fileArray) {
						//console.log('gitFile index',fileIndex);
						if (localFilesMap.get(obj) != undefined) {
							localFilesMap.get(obj).forEach(function (localFile, localInde, localArray) {
								//console.log('localFile',localFile);
								if (gitFile.name === localFile.flosum_git__Path__c) {
									//console.log('TEST5');
									names.add(gitFile.name);
									a.push(gitFile.name);
									if (gitFile.resp != localFile.flosum_git__Attachment_SHA__c) {
										//    console.log('TEST6');
										if (changedObjectsMap.has(localFile.flosum_git__Component__c)) {
											let tempList = changedObjectsMap.get(localFile.flosum_git__Component__c);
											tempList.push({ localFile: localFile, gitFile: gitFile });
											changedObjectsMap.set(localFile.flosum_git__Component__c, tempList);
											//	returnGitFilesMap.get(obj).splice(fileIndex,1);
										}
										else {
											changedObjectsMap.set(localFile.flosum_git__Component__c, [
												{ localFile: localFile, gitFile: gitFile }
											]);
											//returnGitFilesMap.get(obj).splice(fileIndex,1);
										}
									} else {
										//	returnGitFilesMap.get(obj).splice(fileIndex,1);
									}
								} else {
									//console.log('gitFile.name == localFile.flosum_git__Path__c',gitFile.name, localFile.flosum_git__Path__c);
									if (localFilesMap.get(obj).length - 1 === localInde) {
										if (returnGitFilesMap.get(obj).length - 1 === fileIndex) {
											if (index === Array.from(localFilesMap.keys()).length - 1) {
												//	console.log('names.length',Array.from(names).length);
												//	console.log('names.length',a.length);
												//	console.log('names',a);
												returnGitFilesMap.get(obj).forEach(function (oo, ii, aa) {
													if (!a.includes(oo.name)) {
														console.log('oo.name = ', oo.name);
														newObjectsOnGit.push(oo);
													}
												})
												resolve([
													changedObjectsMap,
													newObjectsOnGit
												]);
											}
										}
									}
								}
							});
						}

					});
				}

				/*	console.log('localFilesMap.get("a011i0000097T7XAAU").length', localFilesMap.get('a011i0000097T7XAAU').length);
				console.log('returnGitFilesMap.get("a011i0000097T7XAAU").length', returnGitFilesMap.get('a011i0000097T7XAAU').length);
				console.log('returnGitFilesMap.get("a011i0000097T7XAAU")', returnGitFilesMap.get('a011i0000097T7XAAU'));*/
				/* returnGitFilesMap.get(obj).forEach(function(gitFile,fileIndex,fileArray){
								   let exist = false;
								   localFilesMap.get(obj).forEach(function(localFile, localInde, localArray) {
									   if(localFile.flosum_git__Path__c === gitFile.name){
										   exist = true;
									   }
									   if(localFilesMap.get(obj).length-1  === localInde){
										   if(!exist){
											   newObjectsOnGit.push(gitFile);
										   }
									   }
								   })
							   	
							   }); */

				// returnGitFilesMap.get(obj).forEach(function(gitFile, fileIndex, fileArray) {
				// 	console.log('fileIndex = ',fileIndex);
				// })
			});



		});
	},
	getBlobs: function (shaArray, org, auth) {
		var blobArray = [];
		let repo;
		shaArray.forEach(function (item, index, array) {
			if (item.mode === 'new') {
				repo = JSON.parse(item.localFile).repo;
			} else {
				repo = item.localFile.flosum_git__Repository__c;
			}
			blobArray.push(
				forAll.httpGet(
					'https://api.github.com/repos/' + org + '/' + repo + '/git/blobs/' + item.gitFile.resp,
					auth
				)
			);
		});
		return Promise.all(blobArray);
	},
	gitCommit: function (req, re, firstReq) {
		console.log('GITHUB');
		var branches;
		var repos = new Set();
		var promises = [];
		var branchId;
		var mapNameToBody = [];
		var time;
		var componentsWithAtt = [];
		var re;
		var conn = new jsforce.Connection(
			{
				// you can change loginUrl to connect to sandbox or prerelease env.
				//loginUrl : 'https://test.salesforce.com'
				loginUrl: 'https://' + process.env.env + '.salesforce.com'
			}
		);
		conn.login(process.env.username, process.env.password, function (err, userInfo) {
			accesTok = conn.accessToken;
			instanceUrl = conn.instanceUrl;
			/////////////////////////////////////////////////////////////////////////////////////////////////////instanceUrl
			//conn.login('bohdan@dosiak-company.com', 'Dosiak123', function(err, userInfo) {
			//  conn.login('ibegei@forceoft.com.git', 'Veryeasy4473', function(err, userInfo) {
			if (err) {
				synccc = false;
				return console.error(err);
			}
			// Now you can get the access token and instance URL information.
			// Save them to establish connection next time.
			console.log(conn.accessToken);
			console.log(conn.instanceUrl);
			// logged in user property
			console.log('User ID: ' + userInfo.id);
			console.log('Org ID: ' + userInfo.organizationId);
			branchId = firstReq.branchId;
			let branch = {
				branchId: branchId
			};
			forAll
				.empty()
				.then(() => {
					try {
						String.prototype.splice = function (idx, rem, str) {
							return this.slice(0, idx) + str + this.slice(idx + Math.abs(rem));
						};

						//var object = parser.parse(resp);///////////////////////////////////////////////////objj
						//re = JSON.parse(object);

						var components = re.components;
						var histories = re.histories;
						var attachments = re.attachments;
						/*	console.log('components.length', components.length);
							console.log('histories.length', histories.length);
							console.log('attachments.length', attachments.length);*/

						var componentsKeys = Object.keys(components);
						var historiesKeys = Object.keys(histories);
						for (let key of componentsKeys) {
							let obj = {};
							obj.component = components[key];
							for (let hisKey of historiesKeys) {
								if (histories[hisKey].Flosum__Component__c == obj.component.Id) {
									obj.history = histories[hisKey];
									for (let att of attachments) {
										if (att.ParentId == obj.history.Id) {
											obj.attachment = att;
										}
									}
								}
							}
							componentsWithAtt.push(obj);
						}

						time = 200 * componentsWithAtt.length;
						console.log('componentsWithAtt', componentsWithAtt.length);
						componentsWithAtt.forEach(function (item, index, array) {
							if (item.attachment === undefined || item.attachment.Body === undefined) {
								console.log('NULL BODY');
							}
							else {
								///////////////////////////////////
								forAll.zipParsing(item, 'base64', mapNameToBody, index).then(i => {
									//console.log('index = ',i);
									if (i === componentsWithAtt.length - 1) {


										var branch = re.data.branch.Flosum__Branch_Name__c;
										var repository = re.data.branch.Flosum__Repository__r.Name;  //logic for - edited by dos
										/*var temp = re.data.branch.Flosum__Repository__r.Name;
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
										});*/
										var responceFromBranch;
										var branchResp;
										var branchTreeResp;
										var treeItemsResp;
										var namesWithBlobs = mapNameToBody;
										var organization = re.data.organization;
										var authHeader = re.data.auth;
										var shaToSave = {};

										forAll
											.httpGet(
												'https://api.github.com/repos/' +
												organization +
												'/' +
												repository +
												'/git/refs/heads/' +
												branch,
												authHeader
											)
											.then(function (data) {
												console.log(1);
												branchResp = JSON.parse(data);
												let url2 = branchResp.object.url;
												return forAll.httpGet(url2, authHeader);
											})
											.then(function (data2) {
												console.log(2);
												branchTreeResp = JSON.parse(data2);
												let url = branchTreeResp.tree.url;
												return forAll.httpGet(url, authHeader);
											})
											.then(function (data) {
												console.log(3);
												console.log('data', data);
												treeItemsResp = JSON.parse(data);
												var promises = [];
												var delayTimer = 0; //one hour == 3600000
												var delayIndex = 0;
												var allIndex = namesWithBlobs.length;
												console.log('contains all -->' + allIndex);
												var index = 1;
												var offset = 0;
												var laterMap = new Map();
												var countIndex = 0;
												var flag = false;
												var lastIter = 0;


												function thingIt() {
													return new Promise(function (resolve, reject) {
														let rate;
														let offsetArr = 0;
														let wait = false;
														forAll.httpCall('https://api.github.com/rate_limit', 'GET', '', authHeader).then(rateResp => {
															console.log('rateResp', rateResp);
															rate = rateResp.rate;
															console.log('rate.remaining', rate.remaining);
															console.log('typeof rate.remaining', typeof rate.remaining);
															console.log('namesWithBlobs.length', namesWithBlobs.length);
															console.log('(rate.remaining - namesWithBlobs.length)', rate.remaining - namesWithBlobs.length);
															if (rate.remaining - namesWithBlobs.length > 100) {
																offsetArr = namesWithBlobs.length - 1;
																console.log('>> 100');
																/*if((namesWithBlobs.length-1 - lastIter) > 100){
																	offsetArr = 100;
																}else{
																	offsetArr = (namesWithBlobs.length - lastIter);
																}*/

															} else {
																console.log('<< 100');
																if (rate.remaining - 100 > 0) {
																	offsetArr = rate.remaining - 100
																} else {
																	wait = true;
																}

															}

															console.log('LOOOPPP');
															console.log('namesWithBlobs.length', namesWithBlobs.length);
															console.log('promises.length', promises.length);
															if (namesWithBlobs.length === promises.length) {
																resolve();
																//return;
															} else {

																if (wait) {

																	var d = new Date();
																	var n = d.getTime();
																	var reset = rate.reset * 1000;
																	setTimeout(function () {
																		thingIt().then(() => {
																			resolve();
																		})
																	}, (reset - n) + 5000);


																} else {
																	console.log('>> 100 CREATE BLOB');
																	let tt = 200;
																	let cutArray = namesWithBlobs.slice(lastIter, lastIter + offsetArr);
																	cutArray.forEach(function (obj, index, collection) {
																		setTimeout(function () {
																			let body;
																			body = {
																				path: obj.key,
																				body: {
																					content: obj.value,
																					encoding: 'base64'
																				}
																			};

																			promises.push(
																				forAll.httpCall(
																					'https://api.github.com/repos/' +
																					organization +
																					'/' +
																					repository +
																					'/git/blobs',
																					'POST',
																					body,
																					authHeader
																				)
																			);
																		}, 1000 + tt);
																		tt += 400;
																	});
																	lastIter += offsetArr;
																	setTimeout(function () {
																		thingIt().then(() => {
																			resolve();
																		})
																	}, cutArray.length * 500);

																}
															}
														})
													})
												}



												thingIt().then(() => {
													console.log('PROMISES');
													Promise.all(promises)
														.then((values) => {
															console.log(4);
															var compon = [];
															let body = {};
															console.log(4.1);
															body.base_tree = treeItemsResp.sha;
															console.log(4.2);
															body.tree = [];
															values.forEach(function (value, index, array) {
																namesWithBlobs[index].gitResp = value;
																body.tree.push({
																	path: value.path,
																	mode: '100644',
																	type: 'blob',
																	sha: value.sha,
																	url: value.url
																});
																let path = value.path.split('.');
																if (shaToSave[path[0]] === undefined) {
																	shaToSave[path[0]] = [];
																	shaToSave[path[0]].push({
																		sha: value.sha,
																		url: value.url
																	});
																}
																else {
																	shaToSave[path[0]].push({
																		sha: value.sha,
																		url: value.url
																	});
																}
															});
															return forAll.httpCall(
																'https://api.github.com/repos/' +
																organization +
																'/' +
																repository +
																'/git/trees',
																'POST',
																body,
																authHeader
															);
														})
														.then((updateResp) => {
															console.log(5);
															let body = {
																message: branch,
																author: {
																	//edited by dos
																	//email: firstReq.useremail,
																	//name: firstReq.username //edited by dos //mb need to paste email from custom settings??                   <---------------------------------
																	email: firstReq.sfUser,
																	name: firstReq.sfUser
																}, //edited by dos
																parents: [
																	branchResp.object.sha
																],
																tree: updateResp.sha
															};
															//	console.log('body', body);
															return forAll.httpCall(
																'https://api.github.com/repos/' +
																organization +
																'/' +
																repository +
																'/git/commits',
																'POST',
																body,
																authHeader
															);
														})
														.then((commitResp) => {
															console.log(6);
															let body = {
																sha: commitResp.sha,
																force: true
															};
															return forAll.httpCall(
																'https://api.github.com/repos/' +
																organization +
																'/' +
																repository +
																'/git/refs/heads/' +
																branch,
																'PATCH',
																body,
																authHeader
															);
														})
														.then((updateResp) => {
															return forAll.httpGet(
																'https://api.github.com/repos/' +
																organization +
																'/' +
																repository +
																'/git/refs/heads/' +
																branch,
																authHeader
															);
														})
														.then((resp) => {
															conn.sobject("flosum_git__Branch_Git__c").find({
																'flosum_git__Git_Branch_Id__c': { $like: branchId }
															})
																.limit(1)
																.execute(function (err, sfRecords) {
																	if (err) {
																		console.log('err', err);
																	} else {
																		sfRecords[0].flosum_git__Github__c = resp;
																		conn.sobject("flosum_git__Branch_Git__c").update(
																			{ Id: sfRecords[0].Id, flosum_git__Github__c: sfRecords[0].flosum_git__Github__c },
																			function (err, rets) {
																				if (err) { return console.error(err); } else {
																					//	console.log(rets);
																				}

																			});
																	}
																});
															console.log(7);
															console.log('resp', resp);
															synccc = false;
														})
														.then(() => {
															console.log(88888888888);
															//console.log('namesWithBlobs', namesWithBlobs);
															namesWithBlobs.forEach(function (obj, index, array) {
																delete obj.value;
																if (obj.component.Flosum__Component_Type__c != undefined) {
																	(obj.component.componentType =
																		obj.component.Flosum__Component_Type__c),
																		delete obj.component.Flosum__Component_Type__c;
																}
																if (obj.component.Flosum__Component_Name__c != undefined) {
																	(obj.component.componentName =
																		obj.component.Flosum__Component_Name__c),
																		delete obj.component.Flosum__Component_Name__c;
																}
																if (obj.component.Flosum__File_Name__c != undefined) {
																	(obj.component.fileName =
																		obj.component.Flosum__File_Name__c),
																		delete obj.component.Flosum__File_Name__c;
																}
																if (obj.history.Flosum__Component__c != undefined) {
																	(obj.history.componentLookUp =
																		obj.history.Flosum__Component__c),
																		delete obj.history.Flosum__Component__c;
																}
															});
														})
														.then(() => {
															let namesWithBlobsLength = namesWithBlobs.length;
															var spitLength = 500;
															let iter = Math.ceil(namesWithBlobsLength / spitLength);
															console.log('saveResponce');
															for (let i = 0; i < iter; i++) {
																console.log('saveResponce2');
																let branch2 = {
																	branchId: branchId,
																	commitType: firstReq.commitType
																};
																let req = {
																	resp: JSON.stringify(
																		namesWithBlobs.slice(
																			i * spitLength,
																			i * spitLength + spitLength
																		)
																	),
																	branchId: JSON.stringify(branch2)
																};
																/////////////////////////////////////////////////////////
																forAll
																	.httpCallSF(
																		instanceUrl +
																		'/services/apexrest/flosum_git/saveResponce',
																		'POST',
																		req,
																		accesTok
																	)
																	.catch((err) => {
																		console.log(err);
																		synccc = false;
																	});
															}
														})
														.catch((err) => {
															synccc = false;
															console.log(err);
														});

												});
												/*namesWithBlobs.forEach(function(obj, index, collection) {
													if(index === 0 ){
														console.log('namesWithBlobs');
													}
													setTimeout(function() {
														let body;
														body = {
															path: obj.key,
															body: {
																content: obj.value,
																encoding: 'base64'
															}
														};
														
														promises.push(															
															forAll.httpCall(
																'https://api.github.com/repos/' + 
																	organization +
																	'/' +
																	repository +
																	'/git/blobs',
																'POST',
																body,
																authHeader
															)
														);

														if (promises.length === namesWithBlobs.length) {*/

												/*	}
													else {
														index++;
													}
												 }, 1000 + offset);
										
											

												 offset += 400;
											});*/
											})
											.catch((error) => {
												synccc = false;
												if (error.message === 'Not Found') {
													console.log(error);
												}
											});

									}

								});
							}

						});
					} catch (err) {
						synccc = false;
						console.error('err', err);
					}
				})/*
				.then(() => {
					//return null;
					console.log(time);
					setTimeout(function() {
						componentsWithAtt.forEach(function(item, index, array) {
							if (item.attachment === undefined || item.attachment.Body === undefined) {
								return;
							}
							else {
								forAll.zipFieldParsing(item, 'base64', mapNameToBody);
							}
						});
					}, time);
				})*/
				.then(() => {
					// setTimeout(function() {
					// 	var branch = re.data.branch.Flosum__Branch_Name__c;
					// 	var repository = re.data.branch.Flosum__Repository__r.Name;
					// 	var responceFromBranch;
					// 	var branchResp;
					// 	var branchTreeResp;
					// 	var treeItemsResp;
					// 	var namesWithBlobs = mapNameToBody;
					// 	var organization = re.data.organization;
					// 	var authHeader = re.data.auth;
					// 	var shaToSave = {};

					// 	forAll
					// 		.httpGet(
					// 			'https://api.github.com/repos/' +
					// 				organization +
					// 				'/' +
					// 				repository +
					// 				'/git/refs/heads/' +
					// 				branch,
					// 			authHeader
					// 		)
					// 		.then(function(data) {
					// 			console.log(1);
					// 			branchResp = JSON.parse(data);
					// 			let url2 = branchResp.object.url;
					// 			return forAll.httpGet(url2, authHeader);
					// 		})
					// 		.then(function(data2) {
					// 			console.log(2);
					// 			branchTreeResp = JSON.parse(data2);
					// 			let url = branchTreeResp.tree.url;
					// 			return forAll.httpGet(url, authHeader);
					// 		})
					// 		.then(function(data) {
					// 			console.log(3);
					// 			console.log('data',data);
					// 			treeItemsResp = JSON.parse(data);
					// 			var promises = [];
					// 			var index = 1;
					// 			var offset = 0;
					// 			console.log('namesWithBlobs.length',namesWithBlobs.length);
					// 			namesWithBlobs.forEach(function(obj, index, collection) {
					// 				if(index === 0 ){
					// 					console.log('namesWithBlobs');
					// 				}
					// 				setTimeout(function() {
					// 					let body;
					// 					body = {
					// 						path: obj.key,
					// 						body: {
					// 							content: obj.value,
					// 							encoding: 'base64'
					// 						}
					// 					};
					// 					promises.push(
					// 						forAll.httpCall(
					// 							'https://api.github.com/repos/' + 
					// 								organization +
					// 								'/' +
					// 								repository +
					// 								'/git/blobs',
					// 							'POST',
					// 							body,
					// 							authHeader
					// 						)
					// 					);
					// 					if (promises.length === namesWithBlobs.length) {
					// 						Promise.all(promises)
					// 							.then((values) => {
					// 								console.log(4);
					// 								var compon = [];
					// 								let body = {};
					// 								console.log(4.1);
					// 								body.base_tree = treeItemsResp.sha;
					// 								console.log(4.2);
					// 								body.tree = [];
					// 								values.forEach(function(value, index, array) {
					// 									namesWithBlobs[index].gitResp = value;
					// 									body.tree.push({
					// 										path: value.path,
					// 										mode: '100644',
					// 										type: 'blob',
					// 										sha: value.sha,
					// 										url: value.url
					// 									});
					// 									let path = value.path.split('.');
					// 									if (shaToSave[path[0]] === undefined) {
					// 										shaToSave[path[0]] = [];
					// 										shaToSave[path[0]].push({
					// 											sha: value.sha,
					// 											url: value.url
					// 										});
					// 									}
					// 									else {
					// 										shaToSave[path[0]].push({
					// 											sha: value.sha,
					// 											url: value.url
					// 										});
					// 									}
					// 								});
					// 								return forAll.httpCall(
					// 									'https://api.github.com/repos/' +
					// 										organization +
					// 										'/' +
					// 										repository +
					// 										'/git/trees',
					// 									'POST',
					// 									body,
					// 									authHeader
					// 								);
					// 							})
					// 							.then((updateResp) => {
					// 								console.log(5);
					// 								let body = {
					// 									message: branch,
					// 									author: {
					// 										//edited by dos
					// 										//email: firstReq.useremail,
					// 										//name: firstReq.username //edited by dos //mb need to paste email from custom settings??                   <---------------------------------
					// 										email: firstReq.sfUser,
					// 										name: firstReq.sfUser
					// 									}, //edited by dos
					// 									parents: [
					// 										branchResp.object.sha
					// 									],
					// 									tree: updateResp.sha
					// 								};
					// 							//	console.log('body', body);
					// 								return forAll.httpCall(
					// 									'https://api.github.com/repos/' +
					// 										organization +
					// 										'/' +
					// 										repository +
					// 										'/git/commits',
					// 									'POST',
					// 									body,
					// 									authHeader
					// 								);
					// 							})
					// 							.then((commitResp) => {
					// 								console.log(6);
					// 								let body = {
					// 									sha: commitResp.sha,
					// 									force: true
					// 								};
					// 								return forAll.httpCall(
					// 									'https://api.github.com/repos/' +
					// 										organization +
					// 										'/' +
					// 										repository +
					// 										'/git/refs/heads/' +
					// 										branch,
					// 									'PATCH',
					// 									body,
					// 									authHeader
					// 								);
					// 							})
					// 							.then((updateResp) => {
					// 								return forAll.httpGet(
					// 									'https://api.github.com/repos/' +
					// 										organization +
					// 										'/' +
					// 										repository +
					// 										'/git/refs/heads/' +
					// 										branch,
					// 									authHeader
					// 								);
					// 							})
					// 							.then((resp) => {
					// 								conn.sobject("flosum_git__Branch_Git__c").find({
					// 									'flosum_git__Git_Branch_Id__c' : {$like : branchId}
					// 								})
					// 								.limit(1)
					// 								.execute(function(err,sfRecords){
					// 									if(err){
					// 										console.log('err',err);
					// 									}else{     
					// 										sfRecords[0].flosum_git__Github__c = resp;
					// 										conn.sobject("flosum_git__Branch_Git__c").update(
					// 											{Id : sfRecords[0].Id,flosum_git__Github__c : sfRecords[0].flosum_git__Github__c},
					// 										function(err, rets) {
					// 											if (err) { return console.error(err); }else{
					// 											//	console.log(rets);
					// 											}

					// 										});
					// 									}
					// 								});
					// 								console.log(7);
					// 								console.log('resp', resp);
					// 								synccc = false;
					// 							})
					// 							.then(() => {
					// 								console.log(88888888888);
					// 								//console.log('namesWithBlobs', namesWithBlobs);
					// 								namesWithBlobs.forEach(function(obj, index, array) {
					// 									delete obj.value;
					// 									if (obj.component.Flosum__Component_Type__c != undefined) {
					// 										(obj.component.componentType =
					// 											obj.component.Flosum__Component_Type__c),
					// 											delete obj.component.Flosum__Component_Type__c;
					// 									}
					// 									if (obj.component.Flosum__Component_Name__c != undefined) {
					// 										(obj.component.componentName =
					// 											obj.component.Flosum__Component_Name__c),
					// 											delete obj.component.Flosum__Component_Name__c;
					// 									}
					// 									if (obj.component.Flosum__File_Name__c != undefined) {
					// 										(obj.component.fileName =
					// 											obj.component.Flosum__File_Name__c),
					// 											delete obj.component.Flosum__File_Name__c;
					// 									}
					// 									if (obj.history.Flosum__Component__c != undefined) {
					// 										(obj.history.componentLookUp =
					// 											obj.history.Flosum__Component__c),
					// 											delete obj.history.Flosum__Component__c;
					// 									}
					// 								});
					// 							})
					// 							.then(() => {
					// 								let namesWithBlobsLength = namesWithBlobs.length;
					// 								var spitLength = 500;
					// 								let iter = Math.ceil(namesWithBlobsLength / spitLength);
					// 								console.log('saveResponce');
					// 								for (let i = 0; i < iter; i++) {
					// 									console.log('saveResponce2');
					// 									let req = {
					// 										resp: JSON.stringify(
					// 											namesWithBlobs.slice(
					// 												i * spitLength,
					// 												i * spitLength + spitLength
					// 											)
					// 										),
					// 										branchId: branchId
					// 									};
					// 									/////////////////////////////////////////////////////////
					// 								/*	forAll
					// 										.httpCallSF(
					// 											instanceUrl +
					// 												'/services/apexrest/flosum_git/saveResponce',
					// 											'POST',
					// 											req,
					// 											accesTok
					// 										)
					// 										.catch((err) => {
					// 											console.log(err);
					// 											synccc = false;
					// 										});*/
					// 								}
					// 							})
					// 							.catch((err) => {
					// 								synccc = false;
					// 								console.log(err);
					// 							});
					// 					}
					// 					else {
					// 						index++;
					// 					}
					// 				}, 1000 + offset);
					// 				offset += 400;
					// 			});
					// 		})
					// 		.catch((error) => {
					// 			synccc = false;
					// 			if (error.message === 'Not Found') {
					// 				console.log(error);
					// 			}
					// 		});
					//}, time + 100);
					var INDEX = 0;
					var blobResp = [];
				})
				.catch((err) => {
					synccc = false;
					console.log(err);
				});
		});
	},
	callGit: function (repoName, shaDefault, auth, org) {
		return new Promise(function (resolve, reject) {
			//edited by dos
			var temp = repoName;
var tempOut;
tempOut = temp.replace(/[^a-zA-Z0-9]/g,'-');
var arr = [];
arr = tempOut.split('');
var out = '';
arr.forEach(function(element, index){
if(arr.length-1 == index){
  out += arr[index];
}else{
  if(arr[index]=='-' && arr[index+1]=='-'){
  }else{
    out += arr[index];
  }
}
});
			let xmlHttp = new XMLHttpRequest();
			console.log('url', 'https://api.github.com/repos/' + org + '/' + out + '/git/trees/' + shaDefault + '?recursive=1');
			xmlHttp.open(
				'GET',
				'https://api.github.com/repos/' + org + '/' + out + '/git/trees/' + shaDefault + '?recursive=1',
				true
			);
			xmlHttp.setRequestHeader('Content-Type', 'application/json');
			xmlHttp.setRequestHeader('Authorization', auth);
			xmlHttp.responseType = 'json';
			xmlHttp.onload = function () {
				if (xmlHttp.readyState === 4) {
					if (xmlHttp.status === 200 || xmlHttp.status === 201) {
						//return trees(body);
						resolve(module.exports.trees(xmlHttp.responseText));
					}
					else {
						reject(xmlHttp.responseText);
					}
				}
			};
			xmlHttp.send('');
		});
	},

	trees: function (body) {
		let responseMap = JSON.parse(body);
		let data = [];

		responseMap['tree'].forEach(function (it, index, arr) {
			data.push(it);
		});
		let all = new Map();
		let tempTestTree = [];
		data.forEach(function (item, index, array) {
			if (item['type'] == 'blob') {
				all.set(item['path'], item['sha']);
			}
		});
		return all;
	},
	getGitHubBranchObjects: function (branchId, repoName, shaDefault, auth, org, getRecordTypeIdbyName) {
		return new Promise(function (resolve, reject) {
			var temp = repoName;
var tempOut;
tempOut = temp.replace(/[^a-zA-Z0-9]/g,'-');
var arr = [];
arr = tempOut.split('');
var outRepoName = '';
arr.forEach(function(element, index){
if(arr.length-1 == index){
	outRepoName += arr[index];
}else{
  if(arr[index]=='-' && arr[index+1]=='-'){
  }else{
    outRepoName += arr[index];
  }
}
});
			console.log('getGitHubBranchObjects');
			console.log('repoName', outRepoName);
			console.log('auth', auth);
			console.log('org', org);
			let parsedResponce;
			let tempList = [];
			module.exports
				.callGit(outRepoName, shaDefault, auth, org)
				.then((res) => {
					parsedResponce = res;
				})
				.then(() => {
					parsedResponce.forEach(function (val, key) {
						// console.log('key',key);
						if (key.includes('/')) {
							// need to ignore readme file!
							tempList.push({
								recordType: getRecordTypeIdbyName,
								branchId: branchId,
								val: val,
								name: key,
								resp: parsedResponce.get(key)
							});
						}
						else {
							console.log('ERROR');
						}
					});
				})
				.then(() => {
					resolve(tempList);
				})
				.catch((err) => {
					if (err) {
						console.log('err', err);
					}
				});
		});

		/*for(String iter : parsedResponce.keySet()){
      if(iter.contains('/')){ // need to ignore readme file!
          tempList.add(new Githubobject(getRecordTypeIdbyName('Flosum__Component__c','Branch'), branchId, iter, parsedResponce.get(iter)));
      }
  }*/
	},

	createdFiles: function (returnGitFilesMap, localFilesMap, gitOrgSettings, conn, reposByBranchId, newObjectsOnGit, tokk, getRecordTypeIdbyName, organization) {
		let newObjectsOnGitMap = new Map();
		let sha = [];
		newObjectsOnGit.forEach(function (newF, newFIndex, newFArray) {
			sha.push({ gitFile: newF, localFile: reposByBranchId[newF.branchId], mode: 'new' });
		})
		console.log('createdFiles');
		module.exports
			.getBlobs(sha, gitOrgSettings.flosum_git__Git_Organization__c, tokk).then((resp) => {
				resp.forEach(function (respObj, respIndex, respArray) {
					newObjectsOnGit[respIndex].blob = JSON.parse(respObj).content;
					newObjectsOnGit[respIndex].componentName = newObjectsOnGit[respIndex].name.split('/')[4].split('.')[0];
					if (newObjectsOnGit[respIndex].name.split('/')[3] === 'objects') {
						switch (newObjectsOnGit[respIndex].name.split('/')[4]) {
							case 'fields':
								newObjectsOnGit[respIndex].componentType = 'CustomField';
								break;
							case 'webLinks':
								newObjectsOnGit[respIndex].componentType = 'WebLink';
								break;
							case 'listViews':
								newObjectsOnGit[respIndex].componentType = 'ListView';
								break;
							case 'fieldSets':
								newObjectsOnGit[respIndex].componentType = 'FieldSet';
								break;
							case 'businessProcesses':
								newObjectsOnGit[respIndex].componentType = 'BusinessProcess';
								break;
							case 'compactLayouts':
								newObjectsOnGit[respIndex].componentType = 'CompactLayout';
								break;
							case 'recordTypes':
								newObjectsOnGit[respIndex].componentType = 'RecordType';
								break;
							case 'sharingReasons':
								newObjectsOnGit[respIndex].componentType = 'SharingReason';
								break;
							case 'validationRules':
								newObjectsOnGit[respIndex].componentType = 'ValidationRule';
								break;
							default:
								newObjectsOnGit[respIndex].componentType = 'CustomObject';
						}
					} else if (newObjectsOnGit[respIndex].name.split('/')[3] === 'classes') {
						newObjectsOnGit[respIndex].componentType = 'ApexClass';
					} else if (newObjectsOnGit[respIndex].name.split('/')[3] === 'aura') {
						newObjectsOnGit[respIndex].componentType = 'AuraDefinition';
					} else if (newObjectsOnGit[respIndex].name.split('/')[3] === 'triggers') {
						newObjectsOnGit[respIndex].componentType = 'ApexTrigger';
					} else {
						console.log('ERRORTYPE', newObjectsOnGit[respIndex].name.split('/')[3]);
					}

					if (resp.length - 1 === respIndex) {
						newObjectsOnGit.forEach(function (item, index, array) {
							if (newObjectsOnGitMap.has(item.componentName + item.componentType)) {
								let arr = newObjectsOnGitMap.get(item.componentName + item.componentType);
								arr.push(item);
								newObjectsOnGitMap.set(item.componentName + item.componentType, arr);
							} else {
								newObjectsOnGitMap.set(item.componentName + item.componentType, [item]);
							}
							if (newObjectsOnGit.length - 1 === index) {
								console.log('newObjectsOnGitMap', newObjectsOnGitMap);
								var branchRepoMap = new Set();
								var conn = new jsforce.Connection(
									{
										// you can change loginUrl to connect to sandbox or prerelease env.
										//loginUrl : 'https://test.salesforce.com'
										loginUrl: 'https://' + process.env.env + '.salesforce.com'
									}
								);
								conn.login(process.env.username, process.env.password, function (err, userInfo) {
									accesTok = conn.accessToken;
									instanceUrl = conn.instanceUrl;
									//conn.login('ibegei@forceoft.com.git', 'Veryeasy4473', function(err, userInfo) {
									let GitHistoryArr = [];
									let changedObjectsMapIndex = -1;
									newObjectsOnGitMap.forEach(function (value, key) {
										changedObjectsMapIndex++;
										let GitHistoryArrTEst = [];
										let zip = new JSZip();
										let type;
										let version;
										let componentNew;
										let name = [];
										let CRC32;
										let history;
										value.forEach(function (o, index, array) {
											branchRepoMap.add(o.branchId);
											history = {};
											let content = o.blob.replaceAll(/\n$/, '');
											let localName = '';
											version = 1;
											type = o.componentType;

											//Flosum__Component__c

											componentNew = { branchId: o.branchId, name: o.componentName, compType: type };
											history.flosum_git__Path__c = o.name;
											history.flosum_git__Attachment_SHA__c = o.resp;
											//history.flosum_git__Component__c = component;
											history.flosum_git__Branch_Id__c = o.branchId;
											GitHistoryArrTEst.push(history);
											o.name = o.name.split('app/main/default/')[1];

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
												let arr = o.gitFile.name.split('/');
												let name1 = arr[0] + '/' + arr[3];
												localName = name1.split('.')[0] + '.object';
												name.push(name1.split('.')[0] + '.object');
											}
											else {
												localName = o.name;
												name.push(localName);
											}
											componentNew.fileName = localName;
											zip.file(localName, Buffer.from(content, 'base64').toString('ascii'));
										});
										zip.generateAsync({ type: 'base64' }).then(function (base64) {
											var normalZip = new JSZip2();
											var tempZip = new JSZip2(base64, { base64: true });
											if ((type === 'CustomObject' || value.length === 1) && type != 'AuraDefinitionBundle') {
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
												CRC32 = normalZip.crc32(zipData, 32) + ' ' + normalZip.crc32(metaXMLData, 32);
											}
											else if (type === 'AuraDefinitionBundle' || value.length > 2) {
												let mapCrc32 = {};
												name.forEach(function (object, index, array) {
													var zipData = tempZip.files[object].asBinary();
													let crc = normalZip.crc32(zipData, 32);
													mapCrc32[object] = crc;
												});
												// mapCrc32 = {'aura/Test.cmp' : 12345634242, 'aura/Test.js' : 123456322334}; //fileName and crc code like above
												var keys = Object.keys(mapCrc32).sort();
												if (keys.length > 0) CRC32 = mapCrc32[keys[0]];
												for (var i = 1; i < keys.length; i++) {
													CRC32 = Math.round((mapCrc32[keys[i]] + CRC32) / 2);
												}
											}
											componentNew.CRC32 = CRC32;
											componentNew.version = 1;
											console.log('getRecordTypeIdbyName', getRecordTypeIdbyName);

											forAll.httpCallSF(instanceUrl + '/services/apexrest/flosum_git/component', 'POST', componentNew, accesTok).then(ress => {
												let comp = JSON.parse(parser.parse(ress));
												console.log('componentResp', comp);
												if (comp.Id != null && comp.Id != undefined) {

													let comhis = {
														Flosum__Component__c: comp.Id,
														Flosum__Version__c: 1,
														Flosum__CRC32__c: CRC32
													};
													conn.sobject('Flosum__Component_History__c').create(comhis, function (err, history) {
														if (!err) {
															conn.sobject('Attachment').create({
																ParentId: history.id,
																Name: type,
																Body: base64,
																ContentType: 'application/zip'
															}, function (err, uploadedAttachment) {
																if (!err) {
																	GitHistoryArrTEst.forEach(function (objMap, index, array) {
																		objMap.flosum_git__Attachment_Id__c = uploadedAttachment.id;
																		objMap.flosum_git__Component_History__c = history.id;
																		objMap.flosum_git__Component_Version__c = 1;
																		objMap.flosum_git__Component_type__c = type;
																		objMap.flosum_git__UpsertField__c = objMap.flosum_git__Branch_Id__c + '/' + history.id + '/' + objMap.flosum_git__Path__c;
																	});
																	conn
																		.sobject('flosum_git__History_Git__c')
																		.create(GitHistoryArrTEst, function (err, up) {
																			console.log('TEST222');
																			if (!err) {
																				console.log('UPPPP', up);
																				console.log('branchRepoMap', branchRepoMap);
																				branchRepoMap.forEach(function (o, index, array) {
																					console.log('IDDDD', o);
																					forAll
																						.httpGet(
																							'https://api.github.com/repos/' +
																							organization +
																							'/' +
																							JSON.parse(reposByBranchId[o]).repo +
																							'/git/refs/heads/' +
																							JSON.parse(reposByBranchId[o]).branchName,
																							tokk
																						).then(resp => {
																							conn.sobject("flosum_git__Branch_Git__c").find({
																								'flosum_git__Git_Branch_Id__c': { $like: o }
																							})
																								.limit(1)
																								.execute(function (err, sfRecords) {
																									if (err) {
																										console.log('err', err);
																									} else {
																										sfRecords[0].flosum_git__Github__c = resp;
																										conn.sobject("flosum_git__Branch_Git__c").update(
																											{ Id: sfRecords[0].Id, flosum_git__Github__c: sfRecords[0].flosum_git__Github__c },
																											function (err, rets) {
																												if (err) { return console.error(err); } else {
																													console.log(rets);
																												}

																											});
																									}
																								});
																						}).catch(err => {
																							if (err) {
																								console.log('err', err);
																							}
																						});
																				});

																				console.log('ENDDDDDD');
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


												}

											}).catch(err => {
												if (err) {
													console.log('err', err);
												}
											});

											//var base64data = new Buffer(filedata).toString('base64');
										});
									});
								});


							}
						})
					}
				})
			});

	},

	newFiles: function (returnGitFilesMap, localFilesMap, gitOrgSettings, conn, reposByBranchId, getRecordTypeIdbyName) {
		var branchRepoMap = new Set();
		let count = 0;
		var resp = module.exports.testFun(returnGitFilesMap, localFilesMap).then((array) => {
			var changedObjectsMap = array[0];
			var newObjectsOnGit = array[1];
			//console.log('newObjectsOnGit',newObjectsOnGit);
			var sha = [];
			var organization = gitOrgSettings.flosum_git__Git_Organization__c;
			let tok = gitOrgSettings.flosum_git__Git_User_Name__c + ':' + gitOrgSettings.flosum_git__Git_Password__c;
			tok = Buffer.from(tok).toString('base64');
			var tokk = 'Basic ' + tok;
			//console.log('tokk',tokk);
			changedObjectsMap.forEach(function (branch, key) {
				branch.forEach(function (value, index, array) {
					let Id = value.localFile.Id;
					let history = value.localFile.flosum_git__Component_History__c;
					let branch = value.localFile.flosum_git__Branch_Id__c;
					let component = value.localFile.flosum_git__Component__c;

					localFilesMap.get(branch).forEach(function (localFile, index, array) {
						if (localFile.flosum_git__Component_History__c === history && localFile.Id != Id) {
							returnGitFilesMap.get(branch).forEach(function (gitFile, gitIndex, GitArray) {
								if (gitFile.name === localFile.flosum_git__Path__c) {
									changedObjectsMap.get(component).push({ localFile: localFile, gitFile: gitFile });
								}
							});
							//{ localFile : localFile , gitFile : gitFile}
						}
					});
				});
			});
			//console.log('changedObjectsMap', changedObjectsMap);
			module.exports.createdFiles(returnGitFilesMap, localFilesMap, gitOrgSettings, conn, reposByBranchId, newObjectsOnGit, tokk, getRecordTypeIdbyName, organization);
			changedObjectsMap.forEach(function (value, key) {
				value.forEach(function (obj, index, array) {
					sha.push(obj);
				});
				//sha.push(value.gitFile.sha);
			});


			module.exports
				.getBlobs(sha, gitOrgSettings.flosum_git__Git_Organization__c, tokk)
				.then((values) => {
					// console.log('getBlobs');
					changedObjectsMap.forEach(function (value, key) {
						value.forEach(function (file, fileIndex, fileArray) {
							if (file.gitFile.resp === JSON.parse(values[count]).sha) {
								file.blob = values[count];
								if (file.mode === 'new') {
									//console.log('FILEFILE',file);
								}
							}
							count++;
						});

						//sha.push(value.gitFile.sha);
					});
				})
				.then(() => {
					var conn = new jsforce.Connection(
						{
							// you can change loginUrl to connect to sandbox or prerelease env.
							//loginUrl : 'https://test.salesforce.com'
							loginUrl: 'https://' + process.env.env + '.salesforce.com'
						}
					);
					conn.login(process.env.username, process.env.password, function (err, userInfo) {
						accesTok = conn.accessToken;
						//conn.login('ibegei@forceoft.com.git', 'Veryeasy4473', function(err, userInfo) {
						let GitHistoryArr = [];
						let changedObjectsMapIndex = -1;
						changedObjectsMap.forEach(function (value, key) {
							changedObjectsMapIndex++;
							let GitHistoryArrTEst = [];
							let zip = new JSZip();
							let type;
							let version;
							let component;
							let name = [];
							let CRC32;
							let history;
							value.forEach(function (o, index, array) {
								branchRepoMap.add(o.localFile.flosum_git__Branch_Id__c);
								history = {};
								let content = JSON.parse(o.blob).content.replaceAll(/\n$/, '');
								let localName = '';
								version = o.localFile.flosum_git__Component_Version__c + 1;
								type = o.localFile.flosum_git__Component_type__c;
								component = o.localFile.flosum_git__Component__c;
								history.flosum_git__Path__c = o.gitFile.name;
								history.flosum_git__Attachment_SHA__c = o.gitFile.resp;
								history.flosum_git__Component__c = component;
								//history.flosum_git__Component_Version__c  = version;
								history.flosum_git__Branch_Id__c = o.localFile.flosum_git__Branch_Id__c;
								GitHistoryArrTEst.push(history);
								o.gitFile.name = o.gitFile.name.split('app/main/default/')[1];

								if (type === 'CustomObject') {
									let arr = o.gitFile.name.split('/');
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
									let arr = o.gitFile.name.split('/');
									let name1 = arr[0] + '/' + arr[3];
									localName = name1.split('.')[0] + '.object';
									name.push(name1.split('.')[0] + '.object');
								}
								else {
									localName = o.gitFile.name;
									name.push(localName);
								}

								zip.file(localName, Buffer.from(content, 'base64').toString('ascii'));
							});
							zip.generateAsync({ type: 'base64' }).then(function (base64) {
								var normalZip = new JSZip2();
								var tempZip = new JSZip2(base64, { base64: true });
								if ((type === 'CustomObject' || value.length === 1) && type != 'AuraDefinitionBundle') {
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
									CRC32 = normalZip.crc32(zipData, 32) + ' ' + normalZip.crc32(metaXMLData, 32);
								}
								else if (type === 'AuraDefinitionBundle' || value.length > 2) {
									let mapCrc32 = {};
									name.forEach(function (object, index, array) {
										var zipData = tempZip.files[object].asBinary();
										let crc = normalZip.crc32(zipData, 32);
										mapCrc32[object] = crc;
									});
									// mapCrc32 = {'aura/Test.cmp' : 12345634242, 'aura/Test.js' : 123456322334}; //fileName and crc code like above
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
								conn.sobject('Flosum__Component_History__c').create(comhis, function (err, history) {
									if (!err) {
										conn.sobject('Attachment').create({
											ParentId: history.id,
											Name: type,
											Body: base64,
											ContentType: 'application/zip'
										}, function (err, uploadedAttachment) {
											if (!err) {
												GitHistoryArrTEst.forEach(function (objMap, index, array) {
													objMap.flosum_git__Attachment_Id__c = uploadedAttachment.id;
													objMap.flosum_git__Component_History__c = history.id;
													objMap.flosum_git__Component_type__c = type;
													objMap.flosum_git__UpsertField__c = objMap.flosum_git__Branch_Id__c + '/' + history.id + '/' + objMap.flosum_git__Path__c;
												});
												conn.sobject('Flosum__Component__c').update({
													Id: component,
													Flosum__Version__c: version,
													Flosum__CRC32__c: CRC32
												}, function (err, ret) {
													if (err || !ret.success) {
														return console.error(err, ret);
													}
													// ...
												});
												conn
													.sobject('flosum_git__History_Git__c')
													.create(GitHistoryArrTEst, function (err, up) {
														console.log('TEST222');
														if (!err) {
															console.log('UPPPP', up);
															console.log('branchRepoMap', branchRepoMap);
															branchRepoMap.forEach(function (o, index, array) {
																console.log('IDDDD', o);
																forAll
																	.httpGet(
																		'https://api.github.com/repos/' +
																		organization +
																		'/' +
																		JSON.parse(reposByBranchId[o]).repo +
																		'/git/refs/heads/' +
																		JSON.parse(reposByBranchId[o]).branchName,
																		tokk
																	).then(resp => {
																		conn.sobject("flosum_git__Branch_Git__c").find({
																			'flosum_git__Git_Branch_Id__c': { $like: o }
																		})
																			.limit(1)
																			.execute(function (err, sfRecords) {
																				if (err) {
																					console.log('err', err);
																				} else {
																					sfRecords[0].flosum_git__Github__c = resp;
																					conn.sobject("flosum_git__Branch_Git__c").update(
																						{ Id: sfRecords[0].Id, flosum_git__Github__c: sfRecords[0].flosum_git__Github__c },
																						function (err, rets) {
																							if (err) { return console.error(err); } else {
																								console.log(rets);
																							}

																						});
																				}
																			});
																	}).catch(err => {
																		if (err) {
																			console.log('err', err);
																		}
																	});
															});

															console.log('ENDDDDDD');
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

								//var base64data = new Buffer(filedata).toString('base64');
							});
						});
					});
				})
				.then(() => {

				})
				.catch((err) => {
					if (err) {
						console.log('err', err);
					}
				});
			//res.send('RESPONSE');
		});
	}

	/*,

getAllFilesFromBranch: function(branches){

  
  List<flosum_git__History_Git__c> relatedAttachements = new List<flosum_git__History_Git__c>([SELECT Id, Name, flosum_git__Component_History__c, flosum_git__Component__c, flosum_git__Attachment_SHA__c, flosum_git__Path__c,
                                                                                               flosum_git__Attachment_Id__c, flosum_git__Branch_Id__c, flosum_git__Component_type__c,
                                                                                               flosum_git__Component_Version__c,flosum_git__Repository__c,flosum_git__isLastVersion__c
                                                                                               FROM flosum_git__History_Git__c
                                                                                               WHERE flosum_git__Branch_Id__c IN : branches
                                                                                               AND flosum_git__isLastVersion__c = TRUE]);
  
  Map<String, List<flosum_git__History_Git__c>> relatedObjectsByBranches = new Map<String, List<flosum_git__History_Git__c>>();
  for(flosum_git__History_Git__c gitHistory : relatedAttachements){
      if(relatedObjectsByBranches.containsKey(gitHistory.flosum_git__Branch_Id__c)){
          List<flosum_git__History_Git__c> tempList = relatedObjectsByBranches.get(gitHistory.flosum_git__Branch_Id__c);
          tempList.add(gitHistory);
          relatedObjectsByBranches.put(gitHistory.flosum_git__Branch_Id__c, tempList);
      }else{
          relatedObjectsByBranches.put(gitHistory.flosum_git__Branch_Id__c, new List<flosum_git__History_Git__c>{gitHistory});
      }
  }
  return relatedObjectsByBranches;
}*/
};
