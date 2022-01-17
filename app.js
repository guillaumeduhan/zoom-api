require("dotenv").config()
const express = require('express')
const app = express()
const fs = require('fs');
const cors = require('cors')
const axios = require('axios')
const schedule = require('node-schedule');
const bodyParser = require('body-parser')
const crypto = require('crypto')

const PORT = process.env.PORT || 4200
let redirect_uri = process.env.NODE_ENV === 'production' ? 'https://zoom.koachub.app/callback' : 'http://localhost:4200/callback'
let zoomUrl = 'https://api.zoom.us/v2/users/'

const headers = {
  Authorization: 'Basic ' + Buffer.from(process.env.ZOOM_CLIENT_ID + ':' + process.env.ZOOM_SECRET).toString('base64'),
  'Content-type': "application/x-www-form-urlencoded"
}

app.use(bodyParser.json(), cors())
app.options('*', cors());
app.use(express.json());

/**
 * Routes
 */

app.get('/', function (req, res) {
  let rawdata = fs.readFileSync('tokens.json');
  let tokensSaved = JSON.parse(rawdata);
  // res.json(tokensSaved)
  res.send({
    status: 200,
    message: 'Tokens generated.'
  })
})

app.post('/signature', (req, res) => {
  const timestamp = new Date().getTime() - 30000
  const msg = Buffer.from(process.env.ZOOM_JWT_API_KEY + req.body.meetingNumber + timestamp + req.body.role).toString('base64')
  const hash = crypto.createHmac('sha256', process.env.ZOOM_JWT_API_SECRET).update(msg).digest('base64')
  const signature = Buffer.from(`${process.env.ZOOM_JWT_API_KEY}.${req.body.meetingNumber}.${timestamp}.${req.body.role}.${hash}`).toString('base64')

  res.json({
    signature: signature
  })
})

app.get('/callback', async (req, res) => {
  await askToken(req.query.code)
    .then(() => {
      res.send({
        status: 200,
        message: 'Tokens generated.'
      })
      res.send(200)
    })
    .catch((err) => {
      res.send({
        status: 400,
        message: 'Error on callback',
        error: err
      })
      res.send(400)
    })
})

app.post('/createMeeting', async (req, res) => {
  let rawdata = await fs.readFileSync('tokens.json');
  if (!rawdata) {
    res.send({
      status: 400,
      message: 'Cannot get authentication tokens.'
    })
  }
  let tokensSaved = JSON.parse(rawdata);

  await axios.post(`${zoomUrl}me/meetings`, req.body, {
    headers: {
      Authorization: 'Bearer ' + tokensSaved.access_token
    }
  })
    .then((response) => {
      console.log("🟢 Meeting created!");
      res.send({
        status: 200,
        message: 'Meeting successfully created.',
        meeting: response.data
      })
    })
    .catch((err) => {
      console.log(err)
      res.send({
        status: 400,
        message: 'Error while creating meeting.'
      })
    })
})

/**
 * Functions
 */

const writeTokens = (res) => {
  const { access_token, refresh_token } = res
  let tokens = {}
  tokens.access_token = access_token
  tokens.refresh_token = refresh_token
  let data = JSON.stringify(tokens);

  fs.writeFile('tokens.json', data, (err) => {
    if (err) throw err;
    console.log("🟢 Token updated!");
  })
}

const askToken = async (code) => {
  await axios.post('https://zoom.us/oauth/token', {}, {
    headers,
    params: {
      grant_type: "authorization_code",
      code,
      redirect_uri,
    }
  })
    .then((response) => {
      writeTokens(response.data)
    })
    .catch((err) => {
      console.log(err)
    })
}

const refresh = async () => {
  let rawdata = fs.readFileSync('tokens.json');
  let tokensSaved = JSON.parse(rawdata);
  await axios.post('https://zoom.us/oauth/token', {}, {
    headers,
    params: {
      grant_type: "refresh_token",
      refresh_token: tokensSaved.refresh_token
    }
  })
    .then((response) => {
      writeTokens(response.data)
    })
    .catch((err) => {
      console.log(err)
    })
}

const job = schedule.scheduleJob('0 1 * * * *', function () {
  /**
   * Refresh our token every hour
   */
  refresh()
});

app.listen(PORT)