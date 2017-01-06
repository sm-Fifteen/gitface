const Promise = require('promise');

module.exports = function(gitface) {
	gitface.factory('repoService', ['$rootScope', 'ipc', function($rootScope, ipc) {
		var repoService = (function() {
			that = this;

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
			})

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
