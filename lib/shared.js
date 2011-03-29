var Mongolian = require('mongolian')

var db = new Mongolian({ keepAlive:15000 }).db('nithub')
var log = require('log4js')()

exports.db = {
    general: db.collection('general'),
    packages: db.collection('packages'),
    gits: db.collection('gits')
}
exports.log = function(name) {
    return log.getLogger(name)
}
