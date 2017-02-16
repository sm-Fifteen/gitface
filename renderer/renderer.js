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
			templateUrl: 'views/select-repo.html',
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

gitface.controller('CommitListCtrl', ["$scope", "repoService", function($scope, repoService) {
	$scope.refs = [];
	$scope.commitChains = {};

	repoService.events.updateRefs.subscribe($scope, function(ev, headRef) {
		$scope.refs = [];
		$scope.refs.push(headRef);

		var trackedRemote = headRef.tracking;
		if (trackedRemote !== undefined) {
			$scope.refs.push(trackedRemote);
		}

		// Just so we have something to start our chains with
		repoService.getSomeCommits(_.map($scope.refs, "id"));
	})

	repoService.events.updateCommitList.subscribe($scope, function(ev) {
		$scope.refs.forEach(function(refObject) {
			// TODO : Optimize *later*, we only have to update the tail
			var commitChain = repoService.buildCommitChain(refObject);
			$scope.commitChains[refObject.name] = commitChain;
		})

		if($scope.refs.length === 2) {
			repoService.getCommitDistance($scope.refs[0].id, $scope.refs[1].id).then(function(aheadBehind){
				$scope.aheadCommitGens = $scope.commitChains[$scope.refs[0].name].slice(0, aheadBehind.ahead);
				$scope.behindCommitGens = $scope.commitChains[$scope.refs[1].name].slice(0, aheadBehind.behind);
				$scope.sharedCommitGens = $scope.commitChains[$scope.refs[0].name].slice(aheadBehind.ahead);
				$scope.$apply();
			})
		} else {
			$scope.sharedCommitGens = $scope.commitChains[$scope.refs[0].name];

			$scope.$apply();
		}
	});
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
