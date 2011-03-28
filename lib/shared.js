var Mongolian = require('mongolian')

var db = (new Mongolian).db('nithub')
var log = require('log4js')()

exports.db = {
    general: db.collection('general'),
    packages: db.collection('packages'),
    gits: db.collection('gits')
}
exports.log = function(name) {
    return log.getLogger(name)
}
