module.exports = function(electron, app, mainWindow) {
	const Promise = require('promise')
	const ipc = require('electron').ipcMain
	const dialog = electron.dialog;
	const fs = require('fs');
	const NodeGit = require("nodegit");
	const Repository = require("./repository.js")

	var repo = undefined;

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
			ev.sender.send('changed-directory', repoData);
		});
	})

	ipc.on('get-files', function(ev) {

	})

	ipc.on('get-ref-data', function(ev) {
		// refData should mirror the git dir hierarchy
		var refData = {}

		Promise.all([
			repo.getHead().then(function(head) {
				refData['HEAD'] = head;
			}),
			repo.getReferences().then(function(refs) {
				refData['refs'] = refs;
			})
		]).then(function(){
			ev.sender.send('reply-ref-data', refData)
		})
	})

	// First commit should be the last commit we know, so we get the current head at least once,
	// then the renderer should query for the last commit we sent it.
	ipc.on('get-commit-chain', function(ev, firstCommit, rangeLimit, includeFirst) {
		console.log("Got message")
		repo.getCommitChain(firstCommit, rangeLimit, includeFirst).then(function(serializedCommitList){
			ev.sender.send('reply-commit-chain', serializedCommitList)
		}).catch(function(e){
			console.error(e);
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
