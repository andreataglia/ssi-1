var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
const ngrok = require('ngrok')
const bodyParser = require('body-parser')

var ejs = require('ejs')

var open = require('open');

app.use(express.static(__dirname + 'views'));


import {
  Credentials
} from 'uport-credentials'

const decodeJWT = require('did-jwt').decodeJWT
const transports = require('uport-transports').transport
const message = require('uport-transports').message.util
// const helper = require('../itut/helper.js')
// const itut = require('../itut/core.js')

console.log('loading server...')

const Time30Days = () => Math.floor(new Date().getTime() / 1000) + 1 * 24 * 60 * 60
let endpoint = 'localhost'

app.use(bodyParser.json({
  type: '*/*'
}))

//Setting up EJS view Engine and where to get the views from
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static('views'))

// const credentials = itut.setUpCredentials('did:ethr:0xbc3ae59bc76f894822622cdef7a2018dbe353840', '74894f8853f90e6e3d6dfdd343eb0eb70cca06e552ed8af80adadcc573b35da3')

const credentials = new Credentials({
  did: 'did:ethr:0xbc3ae59bc76f894822622cdef7a2018dbe353840',
  privateKey: '74894f8853f90e6e3d6dfdd343eb0eb70cca06e552ed8af80adadcc573b35da3'
})

var currentConnections = {};

app.get('/', (req, res) => {
  res.render('home', {})
})

app.post('/login', (req, res) => {
  const jwt = req.body.access_token
  const socketid = req.query['socketid']
  console.log('someone logged in...')

  // if (jwt != null) {
  //   itut.authenticateDisclosureResponse(jwt).then(creds => {
  //     helper.messageLogger(itut.decodeJWT(jwt), 'Shared VC from a User')
  //     const did = creds.did
  //     var vcs = [{
  //         sub: did,
  //         exp: Time30Days(),
  //         claim: [{
  //           'Name': 'Andrea'
  //         }]
  //       },
  //       {
  //         sub: did,
  //         exp: Time30Days(),
  //         claim: [{
  //           'Surname': 'Taglia'
  //         }]
  //       }
  //     ]
  //
  //     // itut.createVP(vcs).then(obj => {
  //     itut.createVerification({
  //       sub: did,
  //       exp: Time30Days(),
  //       claim: [{
  //         'Surname': 'Taglia'
  //       }]}).then(obj => {
  //       currentConnections[socketid].socket.emit('emitVC', {
  //         qr: obj.qr,
  //         uri: obj.uri
  //       })
  //     })
  //
  //   });
  //

  if (jwt != null) {
    credentials.authenticateDisclosureResponse(jwt).then(creds => {
      console.log('in...')
      // messageLogger(decodeJWT(jwt), 'Shared VC from a User')
      const did = creds.did
      credentials.createVerification({
        sub: did,
        exp: Time30Days(),
        claim: {
          'EID': {
            'Name': 'Andrea',
            'Surname': 'Taglia',
            'NHID': '0123456789'
          }
        }
      }).then(att => {
        var uri = message.paramsToQueryString(message.messageToURI(att), {
          callback_type: 'post'
        })
        // uri = utils.concatDeepUri(uri)
        const qr = transports.ui.getImageDataURI(uri)
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


//Socket Events
io.on('connection', function(socket) {
  console.log('a user connected: ' + socket.id);
  currentConnections[socket.id] = {
    socket: socket
  };
  credentials.createDisclosureRequest({
    requested: ["name"],
    notifications: false,
    callbackUrl: endpoint + '/login?socketid=' + socket.id
  }).then(requestToken => {
    var uri = message.paramsToQueryString(message.messageToURI(requestToken), {
      callback_type: 'post'
    })
    // uri = utils.concatDeepUri(uri)
    const qr = transports.ui.getImageDataURI(uri)
    // messageLogger(requestToken, "Request Token")
    socket.emit('emitDidVC', {
      qr: qr,
      uri: uri
    })
  })

  // const callbackUrl = endpoint + '/login?socketid=' + socket.id
  // itut.createDisclosureRequest(callbackUrl, []).then(res => {
  //   helper.messageLogger(res.requestToken, "Request Token")
  //   socket.emit('emitDidVC', {
  //     qr: res.qr,
  //     uri: res.uri
  //   })
  // })

  socket.on('disconnect', function() {
    console.log(socket.id + ' disconnected...')
    delete currentConnections[socket.id];
  })
});


http.listen(8088, () => {
  console.log('ready!!!')
  ngrok.connect(8088).then(ngrokUrl => {
    endpoint = ngrokUrl
    console.log(`E-ID Provider running, open at ${endpoint}`)
    open(endpoint, {
      app: 'chrome'
    })
  });
})