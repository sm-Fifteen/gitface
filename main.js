const electron = require('electron')
// Module to control application life.
const app = electron.app
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

const path = require('path')
const url = require('url')
const Promise = require('promise')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 800, height: 600})

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


const ipc = require('ipc-promise');
const dialog = require('electron').dialog;
const fs = require('fs');
const NodeGit = require("nodegit");

var currentDirectory = ".";
var currentRepo;

ipc.on('open-directory-picker', function(ev) {
	return new Promise(function (fulfill, reject){
		var filePaths = dialog.showOpenDialog(mainWindow, {
			defaultPath: currentDirectory,
			properties: ["openDirectory", "createDirectory"],
		})

		if(!filePaths) {
			reject();
		} else {
			fulfill(filePaths[0]);
		}
	});
});

ipc.on('change-directory', function(pathToRepo) {
	return safelyOpenRepo(pathToRepo).then(function(repoObject){
		currentRepo = repoObject;
		currentDirectory = pathToRepo;

		return currentDirectory;
	}, function(errorMessage) {
		dialog.showErrorBox('Error while opening repository', errorMessage);
		// Nothing else
	})
})

ipc.on('get-repo-path', function() {
	return Promise.resolve({
		cwd: currentDirectory,
		gitPath: (currentRepo) ? currentRepo.path() : undefined,
	})
})

function safelyOpenRepo(pathToRepo) {
	// Libgit2 doesn't provide error objects on its public API.
	// We need our own logic to safely open and clone repos

	var fsStat = Promise.denodeify(require('fs').stat);

	return fsStat(pathToRepo).then(function(stats){
		if (stats.isDirectory()) {
			return pathToRepo;
		} else {
			throw "Path is not a valid directory";
		}
	}).then(function(pathToRepo) {
		return NodeGit.Repository.open(pathToRepo);
	}).then(function (repoObject) {
		return repoObject;
	}, function(error){
		return; // No parameter, not a repo
	});
}
