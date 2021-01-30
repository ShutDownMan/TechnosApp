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

const setupRequestListener = () => {
	// Modify the requesst for all requests to the following urls.
	const filter = {
		urls: ['*://*/*']
	}

	/// add listener to requests
	session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
		// console.log("Request to: " + details.url);

		if (details.url.toLowerCase().indexOf("evolua") !== -1 && details.url.toLowerCase().indexOf("logo") !== -1 && details.url.indexOf(".png") !== -1 && details.url.indexOf("technos") === -1) {
			callback({ cancel: false, redirectURL: "https://technos-cursos.s3-sa-east-1.amazonaws.com/technos_logo.png" });
			return;
		}

		// if (details.url.indexOf("cdn77.org") !== -1) {
		// 	if (details.url.indexOf("https://") !== -1) {
		// 		console.log("Downgraded: " + details.url);
		// 		callback({ cancel: false, redirectURL: details.url.replace("https://", "http://") });
		// 		return;
		// 	}
		// }

		callback({ cancel: false });
		return;
	});

}

var foundUpdate = false;
var willUpdate = 0;
const autoUpdateSetup = () => {

	autoUpdater.on('update-available', () => {
		foundUpdate = true;
	});

	autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
		const dialogOpts = {
			type: 'info',
			buttons: ['Atualizar Depois', 'Reiniciar Aplicação'],
			title: 'Application Update',
			message: process.platform === 'win32' ? releaseNotes : releaseName,
			detail: 'Uma nova versão está disponível. Reinicie a aplicação para atualizar.'
		};

		if(willUpdate === 0) {
			dialog.showMessageBox(dialogOpts).then((returnValue) => {
				willUpdate = returnValue.response;
				if (willUpdate === 1) autoUpdater.quitAndInstall();
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
			setupRequestListener();
		});
	}

}
main();