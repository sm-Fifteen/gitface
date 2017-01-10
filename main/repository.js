const fs = require('fs');
const Promise = require('promise')
const NodeGit = require("nodegit");

// Notes about references :
// Check the manpage for git-rev-parse
// 'HEAD' : Current commit of the working tree
// Depending on the current state of the repo, there may also be 'FETCH_HEAD', 'ORIG_HEAD', 'MERGE_HEAD' or 'CHERRY_PICK_HEAD'
// <sha1> : Commit hash
// <refname> : [[refs/]heads/]master
// <refname>@{ordinal} : Points to a certain commit in reference to <refname>
// @{ordinal} : Points to a certain commit in reference to HEAD
// @ : Points to HEAD
// <ref>^<n> : nth parent of commit (on a merge, we count both parents as ^<x> and ^<x+1>)
// <ref>^^ : Equivalent to <ref>^1^1 or <ref>~2
// <ref>~<n> : nth generation parent of commit (only the "first parent" line is accounted fore in a merge)

// Ordinals
// <branchname>@{upstream}/{u} : Remote head for that branch (pulling location)
// <branchname>@{push} : Remote head for that branch (pushing location)
//


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

Repository.prototype.getHead = function() {
	var dirPromise = this.getDirectory();

	return dirPromise.then(NodeGit.Repository.open).then(function(repoObject) {
		return repoObject.head();
	})
}

Repository.prototype.getCommitChain = function(firstCommit, rangeLimit) {
	var dirPromise = this.getDirectory();

	return dirPromise.then(NodeGit.Repository.open).then(function(repoObject) {
		var revWalk = NodeGit.Revwalk.create(repoObject);
		// Sets commit as starting point for revWalk
		revWalk.pushRef(firstCommit);
		// Hides nth generation parent of firstCommit and its ancestors
		revWalk.hideRef(firstCommit + "~" + rangeLimit); // FIXME : Unsafe?
		console.log("Ready to walk");
		return revWalk.getCommits();
	}).then(function(commitList) {
		var serializedCommitList = [];
		for (commitObject of commitList) {
			var nParents = commitObject.parentcount();
			// Git normally labels its parents so that commit^0 is the commit itself
			// Libgit considers parent 0 to be the first parent instead.
			var parentCommits = [];

			// TODO : Replace this bit with .parents() is possible, couldn't get it to work.
			for (var i = 0; i < nParents; i++) {
				parentCommits.push(commitObject.parentId(i).tostrS());
			}

			var sCommit = {
				hash: commitObject.id(),
				parents: parentCommits,
				author: {
					name: commitObject.author().name(),
					email: commitObject.author().email(),
				},
				committer: {
					name: commitObject.committer().name(),
					email: commitObject.committer().email(),
				},
				date: commitObject.date(),
				message: commitObject.message(),
			}

			serializedCommitList.push(sCommit);
		}
		return serializedCommitList;
	})
}

module.exports = Repository;
