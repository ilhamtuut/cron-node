const cron = require('node-cron');
const mysql = require('mysql');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "elzio"
});

con.connect(function(err) {
	if (err) throw err;
	console.log('Connected db');
});

cron.schedule('*/5 * * * *', function() {
	console.log('Running task every second');
  	sendToken();
});

async function sendToken() {
	var today =  dateNow();
	con.query("SELECT * FROM transactions WHERE status=0 AND description='Withdraw' ORDER BY id ASC LIMIT 1", function (err, result, fields) {
		if (err) throw err;
		result.forEach(function(row) {
			var id = row.id;
			var user_id = row.user_id;
			var balance_id = row.balance_id;
			var amount = row.receive * 1000000000000000000;
			var toAddress = row.destination;
			con.query("SELECT * FROM wallet_balances WHERE id=" + balance_id + "", function (err, result, fields) {
				if (err) throw err;
				result.forEach(function(row) {
					var wallet_id = row.wallet_id;
					con.query("SELECT * FROM wallets WHERE user_id=" + user_id + " AND currency_id=" + wallet_id + "", function (err, result, fields) {
						if (err) throw err;
						result.forEach(function(row) {
							var currency_id = row.currency_id;
							con.query("SELECT * FROM currencies WHERE id=" + currency_id + "", function (err, result, fields) {
								if (err) throw err;
								result.forEach(function(row) {
									if(row.type == 'token' && row.source == 'tronscan'){
										const TronWeb = require('tronweb')
										const HttpProvider = TronWeb.providers.HttpProvider;
										const fullNode = new HttpProvider("https://api.trongrid.io");
										const solidityNode = new HttpProvider("https://api.trongrid.io");
										const eventServer = new HttpProvider("https://api.trongrid.io");
										const privateKey = "18B33EB66247F0E4C5EAAA135B8DDBF41F8C1657BD1540494C52081525E2D04C";
										const tronWeb = new TronWeb(fullNode,solidityNode,eventServer,privateKey);
										const trc20ContractAddress = row.smart_contract;
										amount = tronWeb.toBigNumber(amount).toString(10);
										sendElzioToken();
										async function sendElzioToken() {
											try {
												let contract = await tronWeb.contract().at(trc20ContractAddress);
												//Use send to execute a non-pure or modify smart contract method on a given smart contract that modify or change values on the blockchain.
												// These methods consume resources(bandwidth and energy) to perform as the changes need to be broadcasted out to the network.
												console.log('amount :' + amount);
												console.log('toAddress :' + toAddress);
												console.log('smart_contract :' + trc20ContractAddress);

												const trf = await contract.transfer(
													toAddress, //address _to
													amount   //amount
												).send().then(output => {
													console.log('- Output:', output, '\n');
												});
												console.log('result: ', trf);
												if(trf != undefined && trf){
													var txid = NULL;
													var data_json = JSON.stringify(trf);
													con.query("UPDATE transactions SET txid='"+ txid +"', data_json='"+data_json+"', status=1 where id="+id+"", function (err, result, fields) {
														if (err) throw err;
														console.log(result.affectedRows + " record(s) updated");
													});
												}
											} catch(error) {
												console.error("trigger smart contract error",error)
											}
										}
									}
								});
							});
						});
					});
				});
			});
		});
	});

	con.query("INSERT log_crons SET activity='Log Send Elzio Token', created_at='"+today+"', updated_at='"+today+"'", function (err, result, fields) {
		if (err) throw err;
		console.log(result.affectedRows + " record(s) inserted");
	});
}

function dateNow() {
	var d = new Date();
	var dd = d.getDate();
	var mm = d.getMonth()+1; 
	var yyyy = d.getFullYear();
	var h = addZero(d.getHours());
	var m = addZero(d.getMinutes());
	var s = addZero(d.getSeconds());
	return yyyy+"-"+mm+"-"+dd +" "+h + ":" + m + ":" + s;
}

function addZero(i) {
	if (i < 10) {
		i = "0" + i;
	}
	return i;
}