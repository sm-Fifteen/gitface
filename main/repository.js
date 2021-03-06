const fs = require('fs');
const Promise = require('promise')
const NodeGit = require("nodegit");
const _ = require("lodash");

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
	var parentCommits = _.map(commitObject.parents(), function(parentOid) {
		return parentOid.tostrS();
	});

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
		if (refObject.shorthand() === "HEAD") return refObject.target().tostrS();
		return refObject.shorthand();
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
					sRef['_tracking'] = trackedRef.shorthand();
				}).catch(function(e) {
					// Branch doesn't track any remote branch, safe to dismiss.
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

Repository.prototype.getCommitDistance = function(localCommitId, upstreamCommitId) {
	var dirPromise = this.getDirectory();

	localCommitId = NodeGit.Oid.fromString(localCommitId);
	upstreamCommitId = NodeGit.Oid.fromString(upstreamCommitId);

	return dirPromise.then(NodeGit.Repository.open).then(function(repoObject) {
		return NodeGit.Graph.aheadBehind(repoObject, localCommitId, upstreamCommitId)
	})
}

Repository.prototype.getCommitChain = function(firstCommitsIds, rangeLimit) {
	var dirPromise = this.getDirectory();

	return dirPromise.then(NodeGit.Repository.open).then(function(repoObject) {
		var revWalk = NodeGit.Revwalk.create(repoObject);

		var nthGenAncestorPromises = [];

		console.log(firstCommitsIds)

		// Sets commit as starting point for revWalk
		firstCommitsIds.forEach(function(commitId) {
			revWalk.push(commitId);

			var nthGenAncestorPromise = NodeGit.Commit.lookup(repoObject, commitId).then(function(firstCommitObject) {
				return firstCommitObject.nthGenAncestor(rangeLimit)
			})
			nthGenAncestorPromises.push(nthGenAncestorPromise);
		})

		revWalk.sorting(NodeGit.Revwalk.SORT.TOPOLOGICAL | NodeGit.Revwalk.SORT.TIME);

		return Promise.all(nthGenAncestorPromises).then(function(limitCommits) {
			var revWalkPromise = revWalk.getCommitsUntil(function(currentCommit) {
				// Stop when we reach any commit's 20th parent.
				return !_.some(limitCommits, function(limitCommit) {
					return limitCommit.id().equal(currentCommit.id());
				})
			});

			return revWalkPromise;
		}).catch(function() {
			// At least one commit has less than `rangeLimit` ancestors
			var revWalkPromise = revWalk.getCommitsUntil(function(currentCommit) {
				// Stop when we reach the last commit (i.e : Get all remaining commits)
				return currentCommit.parentcount() !== 0;
			});

			return revWalkPromise;
		}).then(function(commitList) {
			var serializedCommitDict = {};

			for (commitObject of commitList) {
				var sCommit = Repository.serializeCommit(commitObject);
				serializedCommitDict[sCommit.hash] = sCommit;
			}

			return serializedCommitDict;
		});
	})
}

module.exports = Repository;
