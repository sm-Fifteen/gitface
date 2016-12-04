// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

require('angular');
require('angular-ui-bootstrap');
const _ =  require('lodash');

var gitface = angular.module('gitface', ['ui.bootstrap']);

gitface.constant('ipc', require('ipc-promise'));

gitface.controller('mainUiCtrl', ["$scope", "$uibModal", function($scope, $uibModal){
	$scope.nodeVersion = process.versions.node;
	$scope.chromeVersion = process.versions.chrome;
	$scope.electronVersion = process.versions.electron;

	$scope.openRepoSelector = function() {
		var repoSelector = $uibModal.open({
			templateUrl: 'selectRepo.html',
			controller: 'repoSelectorCtrl',
			controllerAs: '$ctrl',
			size: 'lg',
		});
		
		repoSelector.result.then(function(newPath) {
			reactToCD(newPath);
		});
	}
	
	function reactToCD(newPath) {
		$scope.cwd = newPath;
	}
}]);

gitface.controller('repoSelectorCtrl', ["$scope", "ipc", "$uibModalInstance", function($scope, ipc, $uibModalInstance) {
	$scope.openDirectoryPicker = function() {
		ipc.send('open-directory-picker').then(function(newPath) {
			return ipc.send('change-directory', newPath);
		}).then(function(newPath){
			console.log("Changed directory : " + newPath);
			$uibModalInstance.close(newPath);
		});
	}
}]);

const path = require('path');
const url = require('url');
const {BrowserWindow} = require('electron').remote;
