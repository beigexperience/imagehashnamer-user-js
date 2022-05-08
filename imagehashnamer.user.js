// ==UserScript==
// @name        Image hash namer -- change this name??
// @namespace   Shiggy
// @match       https://boards.4chan.org/*
// @match       https://boards.4channel.org/*
// @grant       GM.registerMenuCommand
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM.unregisterMenuCommand
// @run-at      document-idle
// @version     0.1
// @author      -
// @description Name images by hash on mongolian basket weaving forums.
// ==/UserScript==


//@todo: reimplement timing
//@todo: implement config menu
//@todo: consider 4chanX
//@todo: consider built in extension

//             -        https://github.com/4chan/4chan-API
//             -        https://github.com/MaresOnMyFace/PPfilter - Userscript for filtering images on 4chan /mlp/ by data-md5. Works on any board, just adjust the url.


// hash_algo_source  = 0 // just use 4chan's data-md5 attribute on images
// hash_algo_source  = ?1 // make a request to the readonly 4chan json api -- don't.
// hash_algo_source  = ?2  // use crypto-md5
// hash_algo_source  = ?3  // use crypto-sha1
// hash_algo_source  = ?4  // use custom callback  with init


// config.hash_storage_method_used
// ------------------------------
// hash_storage_method_to_be = 0
// hash_storage_method_used = 0 all hashes in a single object as GM value
// hash_storage_method = ?1 each hash as individual object as GM value
// hash_storage_method = ?2 each hash as localStorage object
// hash_storage_method = ?3 use indexedDB
// hash_storage_total_count
// hash_storage_

function humandecimal(x, precision = 3) {
	return Number(x.toFixed(precision).replace(/\.?0*$/, ''));
}

function NOW_AS_UNIXTIMESTAMP() {
	return new Date().valueOf();
}

(async () => {
	'use strict';
	const default_config = {
		config_is_default: true,
		verbose: true,
		timing: true,
		hash_storage_method_used: 0,
		hash_algo_source: 0,
		boards_to_monitor: {"ALL": true, "pol":true,"wsg": true, "qa":false }   // boards to monitor or "ALL" for every board, false to blacklist
	}

	function config_persist(config){
		GM_setValue('hfnc_config',config);
	}

	let config = GM_getValue('hfnc_config', default_config);
	if (config.config_is_default){
		config.config_is_default= false;
		config_persist(config);
	}
	let timing = {};
	if (config.timing) {
		timing = {
			db: performance.now(),
			total: performance.now()
		}
	} else {
		timing = {
			db: null,
			total: null,
		}
	}

	// hash record
	// [hashval] = { names:   //presorted
	//                [
	//                 {name:name1, counts:1},
	//                 {name:name2, counts:2},
	//                 {name:name3, counts:3},
	//                 ],
	//               names_detailed_records:{
	//                  name1: [{
	//                          time: NOW_AS_UNIXTIMESTAMP(),
	//                          board: "wsg",
	//                          threadid: "1234567",
	//                          postid: "1234567", // same as seenthread for OP
	//                          nameandtrip: "string" // if any or ""
	//                          },]
	//                 },
	//                 name2: {} // ....
	//              }
	let storage = {};


	let db_init = async (storage) => {
		throw new Error('Not implemented')
	}

	switch (config.hash_storage_method_used) {
		default:
		case 0:
			storage = {
				db: {},
				db_init: false,
				db_persist: function () {
					GM_setValue("hfnc_db", this.db);
				},
				hash_exists: function (hash) {					
					let exists =  (typeof this.db?.[hash] != "undefined");
					if (exists) {this.total_recognized++;}
					return exists;
				},
				gethash_obj: function (hash) {
					return this.db?.[hash];
				},
				removehash_obj: function (hash, beingpruned = true) {
					if (typeof this.db?.[hash] == "undefined") {
						console.error(`Hash ${hash} doesn't exist, so can't be removed`);
					} else {
						if (config.verbose) { console.info(`Hash ${hash}:${this.db?.[hash].names[0].name} ${beingpruned ? 'pruned' : 'deleted'}`); }
						delete this.db?.[hash];
						this.total_decrease();
						this.db_persist();
					}
				},
				sethash_obj: function (hash, obj_record) {
					if (typeof this.db?.[hash] == "undefined") {
						this.total_increase();
					}
					this.db[hash] = obj_record;
					this.db_persist();
				},
				updatehash_obj: function (hash, obj_record) {
					let hash_is_new_instead_of_update = false;
					Object.keys(obj_record.names_detailed_records).forEach(key => {
						//console.log(key, obj[key]);
						if (typeof this.db?.[hash] == "undefined") {
							this.db[hash] = obj_record;
							this.total_increase()
							hash_is_new_instead_of_update = true;
						}
						if (typeof this.db?.[hash]?.names_detailed_records?.[key] == "undefined") {
							this.db[hash].names_detailed_records[key] = obj_record.names_detailed_records[key];

						}

						this.db[hash].names_detailed_records[key] = this.db[hash].names_detailed_records[key].concat(obj_record.names_detailed_records[key]);

						let new_sorted_array = [];
						for (let names_el of this.db[hash].names.values()) {
							if (names_el.name == key) {
								names_el.counts = this.db[hash].names_detailed_records[key].length;
							}
							new_sorted_array.push(names_el);
						}
						new_sorted_array.sort((a, b) => (a.counts > b.counts) ? 1 : (a.counts === b.counts) ? ((a.name > b.name) ? 1 : -1) : -1)
						this.db[hash].names = new_sorted_array;
					});
					if (!hash_is_new_instead_of_update) { this.total_updated = this.total_updated + 1; }
					this.db_persist();
				},
				exportdb: function () { },
				importdb: function () { },
				destroy: function () { },
				total_updated: 0,
				total_pruned: 0,
				total_new_count: 0,
				total_recognized: 0,
				total_persist: function (new_total) {
					GM_setValue('hfnc_hash_storage_total_count', new_total);
				},
				total_get: function () {
					return GM_getValue('hfnc_hash_storage_total_count', 0);
				},
				total_increase: function (by = 1) {
					this.total_new_count = this.total_new_count + by;
					this.total_persist(this.total_get() + by);
				},
				total_decrease: function (by = -1) {
					this.total_pruned = this.total_pruned + by;
					this.total_persist(this.total_get() + by);
				},

			};
			db_init = async (storage) => {
				storage.db = GM_getValue('hfnc_db', {});
				storage.db_init = true;				
				return storage.db_init;				
			};

			break;
	}

	let current_board;
	switch(document.location.host){
			default:
			case "boards.4chan.org":
			case "boards.4channel.org":
				current_board = document.location.pathname.split('/')[1]
			break;
			
	}
	

	let continue_execution = (config.boards_to_monitor.ALL === true) || (config.boards_to_monitor?.[current_board] === true);
	if ( config.boards_to_monitor?.[current_board] == false){
		console.info(`hfnc - current board in blacklist`);	
		console.warn(`hfnc - bailing out`);
		return;
	}
		
	if (!continue_execution ){
		console.info(`hfnc - current board not in whitelist`);		
		console.warn(`hfnc - bailing out`);			
		return;
	}


	console.info(`hfnc - before db init`);	
	try {
		let db_init_ok  = await db_init(storage);
		if (!db_init_ok) { throw new Error("DB INIT FAILURE"); }
	} catch (error) {
		console.error(`hfnc - Could not initialize database!`)
		console.error(error);
		console.warn(`Config used:`);
		console.warn(config);
	}	
	
	if (config.timing) {
		timing.db = performance.now() - timing.db;
	}
	console.info(`hfnc - after db init`);


	let dewit = function () {
		storage.updatehash_obj("d+3E5/Pir6CowEJOlflI1Q==", {
			names: [
				{ name: "testname.jpg", counts: 2 },
				{ name: "xrzrsa645w.jpg", counts: 1 },

			],
			names_detailed_records: {
				"xrzrsa645w.jpg": [{
					time: "1651948314277",
					board: "pol",
					threadid: "376540557",
					postid: "376540557",
					nameandtrip: "Anonymous",
					country: "Switzerland"
				}],
				"testname.jpg": [{
					time: "1651948314277",
					board: "pol",
					threadid: "376540557",
					postid: "376540557",
					nameandtrip: "Anonymous",
					country: "Switzerland"
				}]
			}
		});
		try {
			// storage.removehash_obj("something else");
			// storage.removehash_obj("ad+3E5/Pir6CowEJOlflI1Q==");
			// storage.removehash_obj("d+3E5/Pir6CowEJOlflI1Q==");

		} catch (error) {
			console.warn("hash not removed");
		}
	}

	dewit();	

	if (config.timing) {
		timing.total = performance.now() - timing.total;
	}

	if (config.verbose) {
		console.group(`hfnc`);
		console.info(`hfnc - Hash file name counter - hfnc  has run`);

		console.info(`hfnc - New hashes: `, storage.total_new_count);
		console.info(`hfnc - Updated hashes: `, storage.total_updated);
		console.info(`hfnc - Pruned hashes: `, storage.total_pruned);
		console.info(`hfnc - Recognized: `, storage.total_recognized, ` out of `, storage.total_get(), ` known hashes.`);
		console.info(`hfnc - Executing script took `, humandecimal(timing.total), ` milliseconds`);
		console.info(`hfnc - Of which db init took `, humandecimal(timing.db), ` milliseconds`);
		console.groupEnd();
	}
	
})();