// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

require('angular');
require('angular-ui-bootstrap');
const _ =  require('lodash');

var gitface = angular.module('gitface', ['ui.bootstrap']);

gitface.constant('ipc', require('electron').ipcRenderer);

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
	}
}]);

gitface.controller('repoSelectorCtrl', ["$scope", "ipc", function($scope, ipc) {
	$scope.openDirectoryPicker = function() {
		ipc.send('open-repo-selector');
	}

	ipc.on('cd-inside-repo', function (event, newPath) {
		console.log("Now in this repo : " + newPath);
	})

	ipc.on('cd-inside-directory', function (event, newPath) {
		console.log("Now in this directory : " + newPath);
	})
}]);

const path = require('path');
const url = require('url');
const {BrowserWindow} = require('electron').remote;
