const { app, BrowserWindow, session, dialog } = require('electron')
const path = require('path')
const dns = require('dns');
const netList = require('network-list');
const testPort = require('is-port-reachable');
const ipcMain = require('electron').ipcMain;
const storage = require('electron-json-storage');
const process = require('process');
const socket = require('socket.io');
const querystring = require('querystring');
const fetch = require('node-fetch');
const isDev = require('electron-is-dev');
const { autoUpdater } = require("electron-updater")

const urls = [
	"https://app.evoluaeducacao.com.br/Login"
]

var win = undefined;
var localServers = [];

var currentUser = undefined;
var userLogList = [];

var iframeId = -1;

var currentUserId = undefined;

const createWindow = () => {
	setTimeout(function () {
		win = new BrowserWindow({
			center: true,
			resizable: true,
			fullscreen: true,
			frame: false,
			kiosk: true,
			icon: path.join(__dirname, "/build/resources/images/icon128.png"),
			webPreferences: {
				allowRunningInsecureContent: true,
				nodeIntegration: false,
				nodeIntegrationInSubFrames: true,
				show: false,
				plugins: true,
				preload: path.join(__dirname, "content.js")
			}
		});
		win.maximize();
		// win.webContents.openDevTools();

		console.log(urls[0]);
		win.loadURL(urls[0]);

		win.once('ready-to-show', () => {
			win.show()
		});

		win.on('closed', () => {
			win = null;
		});

		setupListeners();
	}, 0);

	getUserLogListFromLocalStorage();
}

const getUserLogListFromLocalStorage = () => {

	/// retrieve user logs from storage
	storage.get('UserLogs', (error, result) => {
		console.log(result);
		/// if user logs is not empty
		if (result.list) {
			console.log("userLogList retrieved");
			userLogList = result.list;
			console.log(userLogList);
		} else {
			console.log("userLogList is empty");
			userLogList = [];
		}
	});

}

const setupListeners = () => {

	win.webContents.on('did-finish-load', () => {
		// win.webContents.send('bloco-id-update', "test");
	});

	win.webContents.on('new-window', (event, url) => {
		event.preventDefault();
		// win.loadURL(url)
	})

	ipcMain.on('user-login', (event, user) => {
		if (user === undefined || Object.keys(user).length === 0 && user.constructor === Object) {
			return false;
		}

		/// update current
		currentUser = user;
		currentUser.b = "1";

		let foundLog = false;
		/// find it in log list
		for (var i = userLogList.length - 1; i >= 0; i--) {
			if (userLogList[i].t === currentUser.t
				&& userLogList[i].c === currentUser.c
				&& userLogList[i].d === currentUser.d
				&& userLogList[i].a === currentUser.a) {
				foundLog = true;

				/// if found blocoId is greater than current blocoId
				if (Number(userLogList[i].b) >= Number(currentUser.b)) {
					currentUser.b = String(userLogList[i].b);
				}
			}
		}

		if (foundLog === false) {
			logUser(currentUser);
		}

		return true;
	});

	ipcMain.on('set-iframe-id', (event) => {
		console.log("Setting iframeId");
		iframeId = event.frameId;
		console.log("iframeId = " + iframeId);
	});

	ipcMain.on('set-current-user', (event, user) => {
		currentUser = updateUser(user);
		console.log(currentUser);
	});

	ipcMain.on('get-current-user', (event) => {
		console.log("get-current-user");

		win.webContents.sendToFrame(event.frameId, 'set-current-user', currentUser);
		console.log(currentUser);
	});

	var reloadFix = false;
	ipcMain.on('startup-get-user', (event) => {
		console.log("startup-get-user");

		win.webContents.sendToFrame(iframeId, 'startup-scripts-iframe', { user: currentUser, reloadFix: reloadFix });

		reloadFix = true;
		console.log(currentUser);
	});
}

const updateUser = (user) => {
	let foundLog = false;
	console.log("updateUser");

	/// find it in log list
	for (var i = userLogList.length - 1; i >= 0; i--) {
		if (userLogList[i].t === user.t
			&& userLogList[i].c === user.c
			&& userLogList[i].d === user.d
			&& userLogList[i].a === user.a) {

			userLogList.splice(i, 1);
		}
	}

	logUser(user);

	return user;
}

const logUserRemote = async (user) => {
	let url = "https://p4f4yiv2l0.execute-api.sa-east-1.amazonaws.com/prod/aluno";
	let data = {
		UserID: currentUserId.toString(),
		UserLog: user
	}
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
			// 'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: JSON.stringify(data) // body data type must match "Content-Type" header
	});

	return response.json();
}

const logUser = async (user) => {
	console.log("User has been logged!");
	console.log(user);

	if (user === undefined || Object.keys(user).length === 0 && user.constructor === Object) return;

	userLogList.push(user);

	/// update loglist locally
	storage.set('UserLogs', { list: userLogList }, (error) => {
		console.log("userLogList saved");
	});

	/// update loglist to server
	logUserRemote(user).then(data => console.log(data));

}

function updateUserLogs(user) {
	for (var i = userLogList.length - 1; i >= 0; i--) {
		if (userLogList[i].t === user.t
			&& userLogList[i].c === user.c
			&& userLogList[i].d === user.d
			&& userLogList[i].a === user.a) {

			userLogList.splice(i, 1);
		}
	}

	logUser(user);
}

function emptyUserlogList() {
	chrome.storage.sync.set({ UserLogs: [] }, function () {
		console.log("userLogList is now empty!");
	});
}

const updateLocalLogs = (userLogs) => {
	/*
		data.forEach((userLog) => {
			
		});
	*/
	userLogList = userLogs;
}

const loadUserLogs = async () => {
	fetch('https://p4f4yiv2l0.execute-api.sa-east-1.amazonaws.com/prod/aluno?userid=' + currentUserId)
		.then(response => response.json())
		.then(data => updateLocalLogs(data.UserLogs))
		.catch(err => console.log(err.toString()));
};

const setupRequestListener = () => {
	// Modify the requesst for all requests to the following urls.
	const filter = {
		urls: ['*://*/*']
	}

	/// add listener to requests
	session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
		// console.log("Request to: " + details.url);

		if (details.url.toLowerCase().indexOf("logo") !== -1 && details.url.indexOf(".png") !== -1 && details.url.indexOf("technos") === -1) {
			callback({ cancel: false, redirectURL: "https://technos-cursos.s3-sa-east-1.amazonaws.com/technos_logo.png" });
			return;
		}


		if (details.url.indexOf("/Login") !== -1) {
			/*
						if (details.url.indexOf("/Logout") !== -1) {
							console.log("Loggin out");
							setTimeout(() => { app.quit(); }, 100);
						}
			*/
			let formData = undefined;
			console.log("Request to: " + details.url);

			console.log(details.uploadData);

			if (details.uploadData !== undefined && details.uploadData.length >= 1) {
				formData = querystring.parse(details.uploadData[0].bytes.toString());

				console.log("formData:");
				console.log(formData);

				currentUserId = formData.Login;

				loadUserLogs();
			}

			console.log("currentUserId = " + currentUserId);


			callback({ cancel: false });
			return;
		}

		if (details.url.indexOf("aulainterativa") !== -1) {
			if (details.url.indexOf("https://") !== -1) {
				console.log("Downgraded: " + details.url);
				callback({ cancel: false, redirectURL: details.url.replace("https://", "http://") });
				return;
			}

			/// check if request is for a flash file
			if (details.url.indexOf(".swf") !== -1) {
				/// separate file name from url
				let flashFileName = details.url.substr(details.url.lastIndexOf('/') + 1).toUpperCase().trim();
				console.log(flashFileName);

				win.webContents.sendToFrame(iframeId, 'bloco-id-update', flashFileName);
			}
		}

		callback({ cancel: false });
		return;
	});

}

// Request to: https://1482274424.rsc.cdn77.org/cxm2/Aula02-SI-263b347e-7416-4913-83e9-3da6e5a06550/aulainterativa/index.html

const setupflashPlugin = () => {
	// Specify flash path
	let pluginName
	let pluginPath
	switch (process.platform) {
		case 'win32':
			pluginName = `\\build\\flash-files\\pepflashplayer_${process.arch}.dll`
			break
		case 'linux':
			app.commandLine.appendSwitch('no-sandbox')
			pluginName = '/build/flash-files/libpepflashplayer.so'
			break
	}
	if(!isDev) {
	    pluginPath = path.join(__dirname.replace('\\app.asar', ''), pluginName);
	} else {
		pluginPath = path.join(__dirname, pluginName);
	}

	console.log(pluginPath);
	app.commandLine.appendSwitch('ppapi-flash-path', pluginPath)
}

const updateDnsServers = () => {
	dns.setServers(localServers.concat(['8.8.8.8']));
	console.log(localServers.concat(['8.8.8.8']));
}

const testPortLocalServer = async (lanIP) => {

	/// send message to port 10531
	/// if open set as IP
	isReachable = await testPort(11531, { host: lanIP });

	// isReachable = await helloPort(lanIP, 11531);
	// console.log(isReachable);

	if (localServers.indexOf(lanIP) !== -1)
		return;

	if (isReachable) {
		localServers.push(lanIP);

		console.log(lanIP);

		updateDnsServers();
	}
}

const getLanIPs = async () => {
	netList.scanEach({}, async (err, obj) => {
		if (obj.alive === true) {
			/// console.log(obj);
			testPortLocalServer(obj.ip);
		}
	});
}

const setDnsServers = async () => {
	let localCacheServerIP = "";
	let lanIPS = [];

	/// scan network ips
	lanIPS = getLanIPs();
}

var willUpdate = 0;
var foundUpdate = false;
const autoUpdateSetup = () => {

	autoUpdater.on('update-available', () => {
		foundUpdate = true;
	});

	autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
		const dialogOpts = {
			type: 'info',
			buttons: ['Reiniciar Aplicação', 'Atualizar Depois'],
			title: 'Application Update',
			message: process.platform === 'win32' ? releaseNotes : releaseName,
			detail: 'Uma nova versão está disponível. Reinicie a aplicação para atualizar.'
		};

		if(willUpdate === 0) {
			dialog.showMessageBox(dialogOpts).then((returnValue) => {
				willUpdate = returnValue.response;
				if (willUpdate === 0) autoUpdater.quitAndInstall();
			});
		}
	});

	autoUpdater.on('error', message => {
		console.error('There was a problem updating the application');
		console.error(message);
	});

	autoUpdater.checkForUpdates();

	setInterval(() => {
		if(foundUpdate === false)
			autoUpdater.checkForUpdates();
	}, 60000)
}

const main = () => {
	if (!isDev) {
		autoUpdateSetup();
	}
	app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
	app.commandLine.appendSwitch('allow-displaying-insecure-content', 'true');
	setupflashPlugin();

	setDnsServers();

	setInterval(() => {
		setDnsServers();
	}, 5 * 60 * 1000);


	const gotTheLock = app.requestSingleInstanceLock()

	if (!gotTheLock) {
		app.quit();
	} else {
		app.on('second-instance', (event, commandLine, workingDirectory) => {
			// Someone tried to run a second instance, we should focus our window.
			if (win) {
				if (win.isMinimized()) win.restore()
				win.focus()
			}
		})

		app.on('ready', () => {
			createWindow()
			setupRequestListener()
		});
	}

}
main();

// (function () {
// 	let io;
// 	io = require('socket.io').listen(11531);
// 	io.sockets.on('connection', function (socket) {
// 		socket.on('hello', function (data) {
// 			process.stdout.write("hello: ");
// 		});

// 	});
// }).call(this);