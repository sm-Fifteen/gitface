const Promise = require('promise');

module.exports = function(gitface) {
	gitface.factory('repoService', ['$rootScope', 'ipc', function($rootScope, ipc) {
		console.info("Here's an instance of the IPC for testing purposes : ")
		document.ipcRenderer = ipc;
		console.log(document.ipcRenderer);

		ipc.on('debug', function(ev, arg) {
			console.log(arg);
		})

		var repoService = (function() {
			this.repoData = undefined;
			this.commits = {};
			var that = this;

			function openDirectoryPicker() {
				return new Promise(function(resolve, reject) {
					var selectedPath = ipc.sendSync('open-directory-picker');

					if(selectedPath) {
						resolve(selectedPath);
						ipc.send('change-directory', selectedPath);
					} else {
						reject();
					}
				});
			}

			ipc.on('changed-directory', function(ev, repoData) {
				that.repoData = repoData;
				events.changeDirectory.notify(repoData.dirPath);

				if(repoData.isRepo) {
					ipc.send('get-ref-data');
				}
			})

			ipc.on('reply-ref-data', function(ev, refData) {
				console.log(refData);
				ipc.send('get-commit-chain', refData.HEAD.id, 20)
			});

			ipc.on('reply-commit-chain', function(ev, commitChain) {
				console.log(commitChain);
			});

			// subscribe and notify based on this :
			// http://www.codelord.net/2015/05/04/angularjs-notifying-about-changes-from-services-to-controllers/
			function NgEvent(eventKey) {
				this.subscribe = function(scope, callback) {
					var handler = $rootScope.$on(eventKey, callback);
					scope.$on('$destroy', handler);
				}

				this.notify = function() {
					var args = Array.from(arguments);
					args.unshift(eventKey);
					$rootScope.$emit.apply($rootScope, args);
				}
			}

			var events = {
				changeDirectory: new NgEvent('change-directory'),
			}

			return {
				openDirectoryPicker: openDirectoryPicker,
				events: events,
			}
		})();

		return repoService;
	}]);
}
