var express = require('express')

var shared = require('./shared'),
    db = shared.db,
    log = shared.log('www.js')


var app = module.exports = express.createServer(
    express.static(__dirname + '/../public/', { maxAge: 14*24*60*60*1000 })
)
Error.stackTraceLimit = 100
app.configure('development', function(){
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }))
})

app.configure('production', function(){
    app.use(express.errorHandler())
})

app.get('/', function(req,res) {
    db.packages.find({git:{$exists:true}}).toArray(function(err,packages) {
        db.gits.find().toArray(function(err,gits) {
            var gitInfos = {}
            gits.forEach(function(git) {
                gitInfos[git.url] = git.info
            })

            var tagMap = {}
            var tags = []


            packages.forEach(function(pack) {
                if (pack.git && gitInfos[pack.git.url]) {
                    pack.gitfo = gitInfos[pack.git.url]
                    pack.gitfo.score = Math.max(0,pack.gitfo.watchers - 1) + pack.gitfo.forks * 5
                }
                pack.tags = pack.info.keywords
                if (pack.tags) {
                    if (!pack.tags.forEach) {
                        if (/,/.test(pack.tags)) {
                            pack.tags = pack.tags.split(/\s*,\s*/)
                        } else {
                            pack.tags = pack.tags.split(/\s+/)
                        }
                    }
                    if (!pack.tags.some(function(tag){return tag == pack.name})) {
                        pack.tags.push(pack.name)
                    }
                } else {
                    pack.tags = [pack.name]
                }
                pack.tags.forEach(function(tag) {
                    tag = tag.toLowerCase()
                    if (!tagMap[tag]) {
                        tags.push({
                            name: tag,
                            packages: tagMap[tag] = [pack]
                        })
                    } else {
                        tagMap[tag].push(pack)
                    }
                })

            })
            function sortScore(a,b) {
                if (a.gitfo && b.gitfo) {
                    return b.gitfo.score - a.gitfo.score
                }
                if (a.gitfo) return -1
                if (b.gitfo) return 1
                return 0
            }
            packages.sort(sortScore)


            tags.sort(function(a,b) {
                if (a.name<b.name) return -1
                if (a.name>b.name) return 1
                return 0
            })

            var deathMatches = []

            tags.forEach(function (tag) {
                if (tag.packages.length > 1) {
                    tag.packages.sort(sortScore)
                    deathMatches.push({
                        name: tag.name,
                        entries: tag.packages
                    })
                }
            })

            res.render('index.jade', {
                layout:false,
                title: 'main',
                packages:packages,
                deathMatches:deathMatches,
                stats: {
                    packages: packages.length,
                    git: packages.length,
                    gitreal: packages.length
                }
            })
        })
    })

})