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
	}, 0);
}

const main = () => {
	if (!isDev) {
		autoUpdateSetup();
	}
	app.commandLine.appendSwitch('ignore-certificate-errors', 'true');
	app.commandLine.appendSwitch('allow-displaying-insecure-content', 'true');

	const gotTheLock = app.requestSingleInstanceLock();
	if (!gotTheLock) {
		app.quit();
	} else {
		app.on('second-instance', (event, commandLine, workingDirectory) => {
			// Someone tried to run a second instance, we should focus our window.
			if (win) {
				if (win.isMinimized()) win.restore();
				win.focus();
			}
		})

		app.on('ready', () => {
			createWindow();
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