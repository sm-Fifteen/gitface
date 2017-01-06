// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

require('angular');
require('angular-ui-bootstrap');
const _ = require('lodash');
require('angular-ivh-treeview/dist/ivh-treeview.js');

var gitface = angular.module('gitface', ['ui.bootstrap', 'ivh.treeview']);

require('./ng-services/repo-service.js')(gitface);

gitface.constant('ipc', require('electron').ipcRenderer);

gitface.controller('mainUiCtrl', ["$scope", "repoService", "$uibModal", function($scope, repoService, $uibModal){
	$scope.openRepoSelector = function() {
		var repoSelector = $uibModal.open({
			templateUrl: 'selectRepo.html',
			controller: 'repoSelectorCtrl',
			controllerAs: '$ctrl',
			size: 'lg',
		});
	}

	repoService.events.changeDirectory.subscribe($scope, function(ev, newDirectory) {
		$scope.cwd = newDirectory;
	});

	$scope.testStatus = function() {
		//ipc.git.status().then(function(statusJson){
		//	console.log(statusJson);
		//});
	}
}]);

gitface.controller('repoSelectorCtrl', ["$scope", "repoService", "$uibModalInstance", function($scope, repoService, $uibModalInstance) {
	$scope.openDirectoryPicker = function() {
		repoService.openDirectoryPicker()
				.then($uibModalInstance.close);
	}

	$scope.cloneUrl = "";
}]);

gitface.controller('FileChangesCtrl', ["$scope", function($scope){
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
