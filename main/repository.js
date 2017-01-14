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

Repository.serializeReference = function(reference) {
	var sRef = {
		fullRef : reference.toString(),
		name: reference.shorthand(),
		id: reference.target().tostrS(),
	}

	// Same sames as the sub-directories in the git directory
	if(reference.isBranch()) {
		sRef.refType = "heads";
	} else if (reference.isRemote()) {
		sRef.refType = "remotes";
	} else if (reference.isTag()) {
		sRef.refType = "tags";
	}

	return sRef
}

Repository.serializeCommit = function(commitObject) {
	var nParents = commitObject.parentcount();
	// Git normally labels its parents so that commit^0 is the commit itself
	// Libgit considers parent 0 to be the first parent instead.
	var parentCommits = [];

	// TODO : Replace this bit with .parents() is possible, couldn't get it to work.
	for (var i = 0; i < nParents; i++) {
		parentCommits.push(commitObject.parentId(i).tostrS());
	}

	var sCommit = {
		hash: commitObject.id().tostrS(),
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

	return sCommit;
}

Repository.prototype.getHead = function() {
	var dirPromise = this.getDirectory();

	return dirPromise.then(NodeGit.Repository.open).then(function(repoObject) {
		return repoObject.head();
	}).then(function(refObject){
		return Repository.serializeReference(refObject);
	})
}

Repository.prototype.getReferences = function() {
	var dirPromise = this.getDirectory();

	return dirPromise.then(NodeGit.Repository.open).then(function(repoObject) {
		return repoObject.getReferences(NodeGit.Reference.TYPE.LISTALL);
	}).then(function(refs) {
		var serializedRefs = {};
		var trackedPromises = [];

		refs.forEach(function(ref) {
			var sRef = Repository.serializeReference(ref);

			if(!sRef.refType) {
				// Not a type we handle yet, continue
				return;
			} else if (typeof serializedRefs[sRef.refType] !== "object") {
				serializedRefs[sRef.refType] = {};
			}

			if(ref.isBranch()) {
				trackedPromises.push(NodeGit.Branch.upstream(ref).then(function(trackedRef) {
					sRef['tracking'] = trackedRef.shorthand();
				}));
			}

			serializedRefs[sRef.refType][sRef.name] = sRef;
		});

		return Promise.all(trackedPromises).then(function() {
			// Once all the promises for the head refs have resolved, the list is complete.
			return serializedRefs;
		});
	})
}

Repository.prototype.getCommitChain = function(firstCommitId, rangeLimit, includeFirst) {
	var dirPromise = this.getDirectory();

	return dirPromise.then(NodeGit.Repository.open).then(function(repoObject) {
		var revWalk = NodeGit.Revwalk.create(repoObject);

		return NodeGit.Commit.lookup(repoObject, firstCommitId).then(function(commitObject) {
			return commitObject.nthGenAncestor(rangeLimit);
		}).then(function(limitCommit) {
			// Sets commit as starting point for revWalk
			revWalk.push(firstCommitId);
			return revWalk.getCommitsUntil(function(currentCommit) {
				// True until currentCommit matches limitCommit
				return !(limitCommit.id().equal(currentCommit.id()));
			});
		}).then(function(commitList) {
			var serializedCommitList = [];

			for (commitObject of commitList) {
				serializedCommitList.push(Repository.serializeCommit(commitObject));
			}

			if(includeFirst) {
				// Return promise with list
				return repoObject.getCommit(firstCommitId).then(function (firstCommitObject) {
					serializedCommitList.unshift(Repository.serializeCommit(firstCommitObject));
					return serializedCommitList;
				})
			} else {
				// Autobox list in promise
				return serializedCommitList;
			}
		});
	})
}

module.exports = Repository;
