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

			function getHeadRef() {
				return that.repoData.refs.heads[that.repoData.HEAD];
			}

			function getHeadId() {
				var headRef = getHeadRef();
				if (headRef === undefined) {
					// Most likely a commit id
					return that.repoData.HEAD;
				}
				return headRef.id;
			}

			ipc.on('changed-directory', function(ev, repoData) {
				that.repoData = repoData;
				events.changeDirectory.notify([repoData.dirPath, repoData.isRepo]);

				if(repoData.isRepo) {
					ipc.send('get-ref-data');
				}
			})

			ipc.on('reply-ref-data', function(ev, refData) {
				that.repoData.HEAD = refData.HEAD;
				that.repoData.refs = refData.refs;
				ipc.send('get-commit-chain', [getHeadId()], 20);
			});

			ipc.on('reply-commit-chain', function(ev, commitChain) {
				console.log(that.repoData.refs)
				if(!that.repoData.commits) {
					var headCommit = commitChain[getHeadId()];
					that.repoData.commits = [[headCommit]];
				}

				var commitGens = that.repoData.commits;

				var lastGen = commitGens[commitGens.length - 1]; // peek

				while(lastGen.length) {
					var newGen = [];

					// We only need to check grand-parents on the first parent, this is a chain, not a tree.
					for (var idx = 0; idx < lastGen[0].parents.length; idx++) {
						var parentId = lastGen[0].parents[idx];
						var parentCommit = commitChain[parentId];

						if(!parentCommit) {
							// If some other parents were available, we'll get them all next time.
							newGen = [];
							break;
						}

						newGen.push(parentCommit);
					}

					if (newGen.length) commitGens.push(newGen);
					lastGen = newGen;
				}

				events.updateCommitList.notify(commitGens);
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
				updateCommitList: new NgEvent('update-commit-list'),
			}

			return {
				openDirectoryPicker: openDirectoryPicker,
				events: events,
			}
		})();

		return repoService;
	}]);
}
