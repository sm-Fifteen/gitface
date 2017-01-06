module.exports = function(electron, app, mainWindow) {
	const Promise = require('promise')
	const ipc = require('electron').ipcMain
	const dialog = electron.dialog;
	const fs = require('fs');
	const NodeGit = require("nodegit");
	const Repository = require("./repository.js")

	let repo = undefined;

	ipc.on('open-directory-picker', function(ev) {
		var filePaths = dialog.showOpenDialog(mainWindow, {
			defaultPath: (repo || {}).path || "",
			properties: ["openDirectory", "createDirectory"],
		})

		if(!filePaths) {
			 ev.returnValue = undefined;
		} else {
			 ev.returnValue = filePaths[0];
		}
	});

	ipc.on('change-directory', function(ev, path) {
		repo = new Repository(path);

		repo.testRepo().then(function(repoData) {
			ev.sender.send('changed-directory', repoData)
		});
	})

	ipc.on('git-status', function(ev) {
		return repo.getDirectory().then(NodeGit.Repository.open).then(function(repoObject) {
		    return repoObject.getStatus();
	    }).then(serializeStatus);
	})

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
}
