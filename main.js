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

var currentDirectory = undefined;

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
    var dirPromise = getDirectory(pathToRepo);
    dirPromise.catch(abortOperation);

    return dirPromise.then(NodeGit.Repository.open).then(function(repoObject){
		currentDirectory = repoObject.path();

		return true;
	}).catch(function(errorMessage) {
        currentDirectory = repoObject.path();

		return false;
	});
})

ipc.on('get-repo-path', function() {
	return Promise.resolve(currentDirectory);
})

ipc.on('git-status', function() {
	return getDirectory().then(NodeGit.Repository.open).then(function(repoObject) {
	    return repoObject.getStatus();
    }).then(serializeStatus);
})

function getDirectory(path) {
	// Most of the time, there won't be a path, we just take the one we know.
    if(!path) path = currentDirectory;

    var fsStat = Promise.denodeify(require('fs').stat);

    if(path) {
        return fsStat(path).then(function(stats){
            if (stats.isDirectory()) {
                // TODO : Keep a file node instead of a path and resolve that into a path?
                return path;
            } else {
                throw "'" + path + "' is not a valid directory";
            }
        });
    } else {
        return Promise.reject("Current directory is still unset");
    }
}

function serializeStatus(statusList) {
	var statusMap = [];
	statusList.forEach(function(statusFile) {
		statusMap.push({
			path: statusFile.path(),
			name: path.basename(statusFile.path()),
			status: statusFile.status(),
		});
	});
	return statusMap;
}

function abortOperation(errorMessage) {
    dialog.showErrorBox('Error while opening repository', errorMessage);
}

// TmpRepoObject.isInit()
// .getStatus
