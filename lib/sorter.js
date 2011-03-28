var fs = require("fs")
var sprintf = require('sprintf').sprintf


fs.readFile(__dirname+"/npmdump.json", function (err, data) {
    if (err) throw err
    var packages = JSON.parse(data)

    fs.readFile("../output.json", function (err, data) {
        if (err) throw err
        var objects = JSON.parse(data)

        var tagMap = {}
        var tags = []

        objects.forEach(function(pack) {
            pack.score = (pack.watchers-1) + (pack.forks-1) * 5
            pack.tags = packages[pack.name].keywords

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


        function show(fieldName) {
            objects.sort(function(a,b) {
                return b[fieldName] - a[fieldName]
            })
            console.log("Top 50 githubbed npm modules by "+fieldName+":")
            objects.slice(0,50).forEach(function(pack, index) {
                console.log(sprintf("%-3s %-50s %5d %s - %s", index+1+".", pack.name, pack[fieldName], fieldName, pack.url))
            })
            console.log()
        }
        show("watchers")
        show("forks")
        show("score")

        tags.sort(function(a,b) {
            if (a.name<b.name) return -1
            if (a.name>b.name) return 1
            return 0
        })

        tags.forEach(function (tag) {
            if (tag.packages.length > 1) {
                var vs = tag.packages.map(function(p){return p.name}).join("  VS  ")
                tag.packages.sort(function(a,b) {
                    return b.score - a.score
                })
                var winner = tag.packages[0]
                console.log(tag.name+" KEYWORD DEATHMATCH")
                tag.packages.slice(0,5).forEach(function(pack, index) {
                    console.log(sprintf("   %-3s %-50s %5d %s - %s", index+1+".", pack.name, pack.score, "score", pack.url))
                })
                console.log()
            }
        })

    })

})