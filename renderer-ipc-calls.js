const ipc = require('ipc-promise')

module.exports = {
	openDirectoryPicker: function() {
		return ipc.send('open-directory-picker');
	},
	changeDirectory: function(newPath) {
		return ipc.send('change-directory', newPath);
	},
	getRepoPath: function() {
		return ipc.send('get-repo-path');
	}
}
