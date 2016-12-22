// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

require('angular');
require('angular-ui-bootstrap');
const _ = require('lodash');
require('angular-ivh-treeview/dist/ivh-treeview.js');

var gitface = angular.module('gitface', ['ui.bootstrap', 'ivh.treeview']);

gitface.constant('ipc', require('./renderer-ipc-calls.js'));

gitface.controller('mainUiCtrl', ["$scope", "ipc", "$uibModal", function($scope, ipc, $uibModal){
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

	$scope.testStatus = function() {
		ipc.git.status().then(function(statusJson){
			console.log(statusJson);
		});
	}

	function reactToCD(newPath) {
		ipc.getRepoPath().then(function(pathDict) {
			$scope.cwd = pathDict;
		});
	}
}]);

gitface.controller('repoSelectorCtrl', ["$scope", "ipc", "$uibModalInstance", function($scope, ipc, $uibModalInstance) {
	$scope.openDirectoryPicker = function() {
		ipc.openDirectoryPicker()
				.then(ipc.changeDirectory)
				.then($uibModalInstance.close);
	}

	$scope.cloneUrl = "";
}]);

gitface.controller('FileChangesCtrl', ["$scope", "ipc", function($scope, ipc){
	$scope.unstagedChanges = [{
		label: 'repo',
		value: '',
		children: [{
			label: 'SomeFile.txt',
			value: 'SomeDir/SomeFile.txt'
		},{
			label: 'EmptyDir',
			value: 'SomeDir/EmptyDir',
			children: []
		}]
	}];
}]);

gitface.config(function(ivhTreeviewOptionsProvider) {
	ivhTreeviewOptionsProvider.set({
        twistieCollapsedTpl: '<span class="glyphicon glyphicon-chevron-right"></span>',
        twistieExpandedTpl: '<span class="glyphicon glyphicon-chevron-down"></span>',
        twistieLeafTpl: '&#9679;'
	});
})

const path = require('path');
const url = require('url');
const {BrowserWindow} = require('electron').remote;
