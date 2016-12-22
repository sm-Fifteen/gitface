module.exports = function(electron, app, mainWindow) {
	const Promise = require('promise')
	const ipc = require('ipc-promise');
	const dialog = electron.dialog;
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
}
