const { app, BrowserWindow, session } = require('electron')
const path = require('path')
const dns = require('dns');
const netList = require('network-list');
const testPort = require('is-port-reachable');
const ipcMain = require('electron').ipcMain;
const storage = require('electron-json-storage');
const process = require('process');

const urls = [
	"https://app.evoluaeducacao.com.br/Login"
]

var win = undefined;
var localServers = [];

var currentUser = undefined;
var userLogList = [];

var iframeId = -1;

const createWindow = () => {

	win = new BrowserWindow({
		center: true,
		resizable: true,
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

	getUserLogListFromLocalStorage();

	setupListeners();
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

	win.webContents.on('set-iframe-id', (event, iframeId) => {
		iframeId = iframeId;
	});

	ipcMain.on('set-current-user', (event, user) => {
		currentUser = updateUser(user);
		console.log(currentUser);
	});

	ipcMain.on('get-current-user', (event) => {
		console.log("get-current-user");

		win.webContents.send('set-current-user', currentUser);
		console.log(currentUser);
	});

	ipcMain.on('get-current-user-iframe', (event) => {
		console.log("get-current-user-iframe");
		console.log(event);

		win.webContents.sendToFrame(iframeId, 'set-current-user-iframe', currentUser);
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
			foundLog = true;

			/// if found blocoId is greater than current blocoId
			if (Number(userLogList[i].b) >= Number(user.b)) {
				user.b = String(userLogList[i].b);
			}
		}
	}

	if (foundLog === false) {
		logUser(user);
	}

	return user;
}

function logUser(user) {
	console.log("User has been logged!");
	console.log(user);

	if (user === undefined || Object.keys(user).length === 0 && user.constructor === Object) return;

	userLogList.push(user);

	storage.set('UserLogs', { list: userLogList }, (error) => {
		console.log("userLogList saved");
	});
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

const setupRequestListener = () => {
	// Modify the requesst for all requests to the following urls.
	const filter = {
		urls: ['*://*/*']
	}

	/// add listener to requests
	session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
		// console.log("Request to: " + details.url);

		if (details.url.indexOf("aulainterativa") === -1) {
			callback({ cancel: false });
			return;
		}

		/// check if request is for a flash file
		if (details.url.indexOf(".swf") !== -1) {
			/// separate file name from url
			let flashFileName = details.url.substr(details.url.lastIndexOf('/') + 1);
			console.log(flashFileName);

			win.webContents.sendToFrame(iframeId, 'bloco-id-update', flashFileName);
		}

		if (details.url.indexOf("https://") !== -1) {
			console.log("Downgraded: " + details.url);
			callback({ cancel: false, redirectURL: details.url.replace("https://", "http://") });
			return;
		}

		callback({ cancel: false });
		return;
	});
}

// Request to: https://1482274424.rsc.cdn77.org/cxm2/Aula02-SI-263b347e-7416-4913-83e9-3da6e5a06550/aulainterativa/index.html

const setupflashPlugin = () => {
	// Specify flash path
	let pluginName
	switch (process.platform) {
		case 'win32':
			pluginName = '\\flash-files\\pepflashplayer.dll'
			break
		case 'linux':
			app.commandLine.appendSwitch('no-sandbox')
			pluginName = '/flash-files/libpepflashplayer.so'
			break
	}
	console.log(path.join(__dirname, pluginName));
	app.commandLine.appendSwitch('ppapi-flash-path', path.join(__dirname, pluginName))
}

const updateDnsServers = () => {
	dns.setServers(localServers.concat(['8.8.8.8']));
	console.log(localServers.concat(['8.8.8.8']));
}

const testPortLocalServer = async (lanIP) => {

	/// send message to port 10531
	/// if open set as IP
	isReachable = await testPort(11531, { host: lanIP });

	console.log(isReachable);

	if (localServers.indexOf(lanIP) !== -1)
		return;

	if (isReachable) {
		localServers.push(lanIP);

		updateDnsServers();
	}
}

const getLanIPs = async () => {
	netList.scanEach({}, async (err, obj) => {
		if (obj.alive === true) {
			console.log(obj);
			testPortLocalServer(obj.ip);
		}
	});
}

(function () {
	var io;
	io = require('socket.io').listen(10531);
	io.sockets.on('connection', function (socket) {
		socket.on('hello', function (data) {
			process.stdout.write("hello: ");
		});

	});
}).call(this);

const setDnsServers = async () => {
	let localCacheServerIP = "";
	let lanIPS = [];

	/// scan network ips
	lanIPS = getLanIPs();
}

const main = () => {
	app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
	app.commandLine.appendSwitch('allow-displaying-insecure-content', 'true');
	setupflashPlugin();
	// setDnsServers();

	setInterval(() => {
		// setDnsServers();
	}, 5 * 60 * 1000);


	app.on('ready', () => {
		createWindow()
		setupRequestListener()
	});

}
main()

