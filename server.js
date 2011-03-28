require('./lib/scanner')

var log = require('./lib/shared').log('server.js')

var app = require('./lib/www')

app.listen(8000, function() {
    log.info("Started http://"+app.address().address+":"+app.address().port)
})