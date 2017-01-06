const fs = require('fs');
const Promise = require('promise')
const NodeGit = require("nodegit");

function Repository(path) {
	// Only the path is stored. Everything else is transient.
	this.path = path;
}

Repository.prototype.getDirectory = function() {
	var fsStat = Promise.denodeify(require('fs').stat);
	var repo = this;

	if(this.path) {
		return fsStat(this.path).then(function(stats){
			if (stats.isDirectory()) {
				// TODO : Keep a file node instead of a path and resolve that into a path?
				return repo.path;
			} else {
				throw "'" + repo.path + "' is not a valid directory";
			}
		});
	} else {
		throw new Error("Repository object has an unset path");
	}
}

Repository.prototype.testRepo = function() {
	var repo = this;
	var dirPromise = repo.getDirectory();
	//dirPromise.catch(abortOperation);

	return dirPromise.then(NodeGit.Repository.open).then(function(repoObject){
		return {
			dirPath: repo.path,
			isRepo: true,
		};
	}).catch(function(errorMessage) {
		return {
			dirPath: repo.path,
			isRepo: false,
		};
	});
}

module.exports = Repository;
