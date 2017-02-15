const Promise = require('promise');
const _ = require('lodash');

module.exports = function(gitface) {
	gitface.factory('repoService', ['$rootScope', 'ipc', function($rootScope, ipc) {
		console.info("Here's an instance of the IPC for testing purposes : ")
		document.ipcRenderer = ipc;
		console.log(document.ipcRenderer);

		ipc.on('debug', function(ev, arg) {
			console.log(arg);
		})

		var repoService = (function() {
			this.repoData = initRepoData();
			var that = this;

			function initRepoData() {
				return {
					_HEAD: undefined,
					commits: {},
					refs: {},
					isRepo: undefined,
					dirPath: undefined,
					get HEAD() {
						if (this._HEAD === undefined) {
							return undefined;
						}

						var headRefObj = this.refs.heads[this._HEAD];

						if (headRefObj === undefined) {
							// TODO : Find a more robust way to resolve other refs in general, the HEAD can technically be anything.
							headRefObj = {
								fullRef: this._HEAD,
								id: this._HEAD,
								name: this._HEAD,
							}
						}

						return headRefObj;
					},
				};
			}

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

			function getSomeCommits(firstCommitsList) {
				ipc.send('get-commit-chain', firstCommitsList, 20);
			}

			function buildCommitChain(refObject) {
				var refHeadCommit = that.repoData.commits[refObject.id];
				if (refHeadCommit === undefined) {
					console.error("Undefined ref commit, shouldn't be happenning")
					console.error(that.repoData.commits);
					return [[]];
				}
				var commitChain = [[refHeadCommit]];
				extendCommitChain(commitChain);
				return commitChain;
			}

			function extendCommitChain(commitGens) {
				var lastGen = commitGens[commitGens.length - 1]; // peek

				while(lastGen.length) {
					var newGen = [];

					// We only need to check grand-parents on the first parent, this is a chain, not a tree.
					for (var idx = 0; idx < lastGen[0].parents.length; idx++) {
						var parentId = lastGen[0].parents[idx];
						var parentCommit = that.repoData.commits[parentId];

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

				return commitGens; // For good measure, even though we just modified the input.
			}

			ipc.on('changed-directory', function(ev, repoData) {
				that.repoData = initRepoData();
				_.assign(that.repoData, repoData);
				events.changeDirectory.notify([repoData.dirPath, repoData.isRepo]);

				if(repoData.isRepo) {
					ipc.send('get-ref-data');
				}
			})

			ipc.on('reply-ref-data', function(ev, refData) {
				for (var refName of Object.getOwnPropertyNames(refData.refs.heads)) {
					var refObject = refData.refs.heads[refName];
					Object.defineProperty(refObject, "tracking", {
						get: function() {
							if(this._tracking) {
								return refData.refs.remotes[this._tracking];
							}
						}
					})
				}

				that.repoData.refs = refData.refs;
				that.repoData._HEAD = refData.HEAD;

				events.updateRefs.notify(that.repoData.HEAD);
			});

			ipc.on('reply-commit-chain', function(ev, branchCommits) {
				console.log(that.repoData)

				_.assign(that.repoData.commits, branchCommits);

				events.updateCommitList.notify();
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
				updateRefs: new NgEvent('update-refs'),
				updateCommitList: new NgEvent('update-commit-list'),
			}

			return {
				openDirectoryPicker: openDirectoryPicker,
				getSomeCommits: getSomeCommits,
				buildCommitChain: buildCommitChain,
				extendCommitChain: extendCommitChain,
				events: events,
			}
		})();

		return repoService;
	}]);
}
