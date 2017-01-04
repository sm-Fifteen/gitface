module.exports = function(gitface) {
	gitface.factory('repoService', ['$rootScope', function($rootScope) {
		var repoService = (function() {
			var ipc = require('../renderer-ipc-calls.js');

			function openDirectoryPicker() {
				ipc.openDirectoryPicker()
					.then(ipc.changeDirectory)
			}

			// subscribe and notify based on this :
			// http://www.codelord.net/2015/05/04/angularjs-notifying-about-changes-from-services-to-controllers/
			function NgEvent(eventKey) {
				function subscribe(scope, callback) {
					var handler = $rootScope.$on(eventKey, callback);
					scope.$on('$destroy', handler);
				}

				function notify(args) {
					args.unshift(eventKey)
					$rootScope.$emit.apply(this, args);
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
