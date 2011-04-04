var fs = require('fs'),
    http = require('http'),
    util = require('util'),
    sprintf = require('sprintf').sprintf

var shared = require('./shared'),
    log = shared.log('scanner.js'),
    db = shared.db

function inspectorBlack(o) {
    return util.inspect(o, false, 4, true);
}

function handleError(err) {
    if (err) {
        log.error(new Error(err).stack)
        return true
    }
    return false
}

function updateNPM() {
    db.general.findOne(function(err, root) {
        if (handleError(err)) return
        if (!root) root = {}
        downloadPackageJson(root, function(err, potentiallyNewJson) {
            if (handleError(err)) return
            if (potentiallyNewJson) {
                log.info("Got new registry, updating...")
                var json = JSON.parse(potentiallyNewJson)
                for (var name in json) {
                    var pack = {
                        name: name,
                        lastModified: new Date,
                        info: json[name]
                    }
                    db.packages.upsert({name:name}, pack)
                }
                db.general.save(root)
                process.nextTick(processPackages)
            } else {
                processPackages()
            }
        })
    })
}

updateNPM()

var updateNPMTimeout = null, processTimeout = null

function processPackages() {
    log.info("Processing packages...")
    db.packages.find({ git:{ $exists:false } }).forEach(function(pack) {
        var gitFo = getGitHubInfo(pack.info)
        if (gitFo) {
            pack.git = gitFo
            db.gits.upsert(gitFo, { $set:gitFo })
        }
        db.packages.save(pack)
    }, function(err) {
        if (handleError(err)) return
        log.info("Done.")
        processGits()
    })
}

function processGits() {
    function processGit(cursor) {
        cursor.next(function(err,gitfo) {
            if (err) throw new Error(err)

            if (gitfo) {
                getHttp("github.com",80,"/api/v2/json/repos/show/"+gitfo.user+"/"+gitfo.name, function(err, json) {
                    if (err) {
                        log.error("Github error: "+gitfo.url+' --- '+err)
                        gitfo.error = err
                    } else if (json) {
                        var info = JSON.parse(json)
                        if (info.repository) {
                            info = info.repository
                        } else {
                            log.error("unexpected json: "+inspectorBlack(info))
                        }
                        gitfo.info = info
                        log.debug(gitfo.url+" --- "+info.watchers+" watchers --- "+info.forks + " forks")
                    }
                    gitfo.lastChecked = new Date
                    db.gits.save(gitfo)
                    setTimeout(function() { processGit(cursor) }, 1000)
                })
            } else {
                log.info("gitscan --- Done.")
                if (!processTimeout) {
                    processTimeout = setTimeout(function() {
                        log.info("gitscan --- Checking for updated git repositories...")
                        processGit(db.gits.find().sort({lastChecked:-1}))
                        processTimeout = null
                    },5*60*1000)
                }
                clearTimeout(updateNPMTimeout)
                updateNPMTimeout = setTimeout(updateNPM, 60*1000)
            }
        })
    }
    log.info("gitscan --- Checking for new git repositories...")
    processGit(db.gits.find({ lastChecked:{ $exists:false }}))
}

function downloadPackageJson(root, callback) {
    log.info("Checking registry.npmjs.org...")
    var request = http.request({
        host:'registry.npmjs.org',
        port:80,
        path:'/'
    }, function(res) {
        switch (res.statusCode) {
            case 304: // not modified
                callback(null, null)
                break
            case 200: // ok!
                root.etag = res.headers.etag
                var data = ''
                res.on('data', function(chunk) {
                    data += chunk
                })
                res.on('end', function() {
                    callback(null, data)
                })
                break
            default: // wahhh
                callback(new Error("Status code "+res.statusCode))
                break
        }
    })
    request.on('error', function() {
        log.info()
    })

    // Set headers
    request.setHeader('User-Agent', 'nithub/1.0')
    if (root.etag) {
        request.setHeader('If-None-Match', root.etag)
    }
    // Make the request
    request.end()
}

var packageJsonFile = __dirname+'/npmdump2.json'

function getHttp(host,port,path, callback) {
    http.get({
        host:host,
        port:port,
        path:path
    }, function(res) {
        if (res.statusCode != 200) {
            callback(new Error("Status code "+res.statusCode+"\n"+data))
        } else {
            var data = ''
            res.on('data', function(chunk) {
                data += chunk
            })
            res.on('end', function() {
                callback(null, data)
            })
        }
    }).on('error', callback)
}

var gitUrlMatcher = /github\.com(?:\/|:)([^/]+)\/([^/"]+)(.git)?/i

function getGitHubInfo(pack) {
    var githubUser = null
    var githubName = null
    var gitUrl = null

    function checkForGitUrl(url) {
        var match = gitUrlMatcher.exec(url)
        if (match) {
            gitUrl = match[0].replace(/\.git$/,'')
            githubUser = match[1]
            githubName = match[2].replace(/\.git$/,'')
        }
    }

    if (pack.repository && pack.repository.url) {
        checkForGitUrl(pack.repository.url)
    } else {
        checkForGitUrl(pack.repository)
    }
    if (!githubUser) {
        checkForGitUrl(JSON.stringify(pack))
    }
    return gitUrl && {
        user: githubUser,
        name: githubName,
        url: gitUrl
    }
}