require("dotenv").config()
const express = require('express')
const app = express()
const fs = require('fs');
const cors = require('cors')
const axios = require('axios')
const schedule = require('node-schedule');

const PORT = process.env.PORT || 4000
let redirect_uri = 'http://localhost:4000/callback'
let zoomUrl = 'https://api.zoom.us/v2/users/'

const headers = {
  Authorization: 'Basic ' + Buffer.from(process.env.ZOOM_CLIENT_ID + ':' + process.env.ZOOM_SECRET).toString('base64'),
  'Content-type': "application/x-www-form-urlencoded"
}

app.use(cors());
app.use(express.json());

/**
 * Routes
 */

app.get('/', function (req, res) {
  let rawdata = fs.readFileSync('tokens.json');
  let tokensSaved = JSON.parse(rawdata);
  res.json(tokensSaved)
})

app.get('/callback', async (req, res) => {
  await askToken(req.query.code);
  await res.json(200)
})

app.post('/createMeeting', async (req, res) => {
  let rawdata = await fs.readFileSync('tokens.json');
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