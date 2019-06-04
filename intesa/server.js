var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const ngrok = require('ngrok')
const bodyParser = require('body-parser')
const {
  isDevEnv,
  port,
  callback_endpoint
} = require('../poc_config/config.js')

var ejs = require('ejs')
var open = require('open');

app.use(express.static(__dirname + 'views'));


import {
  Credentials
} from 'uport-credentials'

const decodeJWT = require('did-jwt').decodeJWT
const transports = require('uport-transports').transport
const message = require('uport-transports').message.util
const helper = require('../itut/helper.js')
// const itut = require('../itut/core.js')

console.log('loading server...')

const Time30Days = () => Math.floor(new Date().getTime() / 1000) + 1 * 24 * 60 * 60
let endpoint = callback_endpoint + ':' + port

app.use(bodyParser.json({
  type: '*/*'
}))

//Setting up EJS view Engine and where to get the views from
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static('views'))


app.get('/', (req, res) => {
  res.send('Choose: <a href="/onlineBanking">/onlineBanking</a> /amazon /vcreader')
})


// SPID
const credentials0 = new Credentials({
  did: 'did:ethr:0xeee6f3258a5c92e4a6153a27e251312fe95a19ae',
  privateKey: 'a1c2779e0e3476ac51183ff5d3f7b6045cc28d615ed21d15b7707c22e0f8174c'
})
app.get('/onlineBanking', (req, res) => {
  res.render('onlineBanking/index', {})
})
app.post('/onlineBankingLogin', (req, res) => {
  const jwt = req.body.access_token
  const socketid = req.query['socketid']
  console.log('someone logged in...')

  if (jwt != null) {
    credentials0.authenticateDisclosureResponse(jwt).then(creds => {
      const did = creds.did
      credentials0.createVerification({
        sub: did,
        exp: Time30Days(),
        claim: {
          "@context": "https://schema.org",
          "@type": "Person",
          "name": "E-ID",
          "givenName": "Matteo",
          "familyName": "Sinico",
          "gender": "male"
        }
      }).then(att => {
        var uri = message.paramsToQueryString(message.messageToURI(att), {
          callback_type: 'post'
        })
        const qr = transports.ui.getImageDataURI(uri)
        uri = helper.concatDeepUri(uri)
        // messageLogger(att, 'Encoded VC Sent to User (Signed JWT)')
        // messageLogger(decodeJWT(att), 'Decoded VC Payload of Above')
        currentConnections[socketid].socket.emit('emitVC', {
          qr: qr,
          uri: uri
        })
      })
    })
  }
});


// Amazon
const credentials1 = new Credentials({
  did: 'did:ethr:0xeee6f3258a5c92e4a6153a27e251312fe95a19ae',
  privateKey: 'a1c2779e0e3476ac51183ff5d3f7b6045cc28d615ed21d15b7707c22e0f8174c'
})
app.get('/amazon', (req, res) => {
  res.render('amazon/index', {})
})


// VC Reader
const credentials2 = new Credentials({
  did: 'did:ethr:0xbc3ae59bc76f894822622cdef7a2018dbe353840',
  privateKey: '74894f8853f90e6e3d6dfdd343eb0eb70cca06e552ed8af80adadcc573b35da3'
})
app.get('/vcreader', (req, res) => {
  res.render('vcreader/vcreader', {})
})
app.post('/vcreader', (req, res) => {
  const jwt = req.body.access_token
  const socketid = req.query['socketid']
  console.log('someone sent a vc')
  if (jwt != null) {
    credentials1.authenticateDisclosureResponse(jwt).then(creds => {
      let objectToSend = {
        sender: creds.did,
        vcs: []
      }
      creds = creds.verified
      for (var i = 0; i < creds.length; i++) {
        let ent = tcm.searchEntity(creds[i].iss)
        let selfStated = (ent != null ? false : true)
        if (selfStated) {
          ent = creds[i].ent
        }
        objectToSend.vcs.push({
          iat: creds[i].iat,
          sub: creds[i].sub,
          credentialSubject: creds[i].claim,
          exp: creds[i].exp,
          iss: creds[i].iss,
          ent: {
            ent: ent,
            selfStated: selfStated
          }
        })
      }

      console.log(objectToSend)

      currentConnections[socketid].socket.emit('emitVC', objectToSend)
    })
  }
});


///////////////////////////////////////////////////////////////////////////////////
////////////////////////////// Socket Events
///////////////////////////////////////////////////////////////////////////////////

var currentConnections = {};
io.on('connection', function(socket) {
  console.log('a user connected: ' + socket.id);
  currentConnections[socket.id] = {
    socket: socket
  };


  ///////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////// SPID ///////////////////////////////////////////////
  credentials0.createDisclosureRequest({
    // requested: ["name"],
    notifications: false,
    callbackUrl: endpoint + '/onlineBankingLogin?socketid=' + socket.id
  }).then(requestToken => {
    var uri = message.paramsToQueryString(message.messageToURI(requestToken), {
      callback_type: 'post'
    })
    const qr = transports.ui.getImageDataURI(uri)
    uri = helper.concatDeepUri(uri)
    // messageLogger(requestToken, "Request Token")
    socket.emit('emitDidVC', {
      qr: qr,
      uri: uri
    })
  })

  ///////////////////////////////////////////////////////////////////////////////////
  ///////////////////////////// VC Reader ///////////////////////////////////////////
  credentials1.createDisclosureRequest({
    verified: ["/*"],
    notifications: false,
    callbackUrl: endpoint + '/vcreader?socketid=' + socket.id
  }).then(requestToken => {
    var uri = message.paramsToQueryString(message.messageToURI(requestToken), {
      callback_type: 'post'
    })
    const qr = transports.ui.getImageDataURI(uri)
    uri = helper.concatDeepUri(uri)
    // messageLogger(requestToken, "Request Token")
    socket.emit('emitQR', {
      qr: qr,
      uri: uri
    })
  })
  let tcl = require('./tcl.json')
  var tcm = require('../itut/tcm.js')
  tcm.setTcl(tcl)
  socket.emit('tcl', tcl)


  socket.on('disconnect', function() {
    console.log(socket.id + ' disconnected...')
    delete currentConnections[socket.id];
  })
});


http.listen(port, () => {
  console.log(`http listening on port: ${port}`)
  if (isDevEnv) {
    ngrok.connect(port).then(ngrokUrl => {
      endpoint = ngrokUrl
      console.log(`E-ID Provider running, open at ${endpoint}`)
      open(endpoint, {
        app: 'chrome'
      })
    });
  }
})
