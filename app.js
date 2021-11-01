require("dotenv").config()

const express = require("express")
const app = express()
const cors = require("cors")
app.use(express.json())
app.use(
  cors({
    origin: "http://localhost:3000",
  })
)

const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY)

app.get('/', (req, res) => {
  res.send({ hello: 'world' })
})

app.post('/create-payment-intent', async (req, res) => {
  let { payment_method_types = ['card'], currency = 'eur', amount = 1000 } = req.body
  if (!amount || amount < 500) {
    amount = 500
  }
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'eur',
      payment_method_types,
      currency
    })
    res.json({
      clientSecret: paymentIntent.client_secret
    })
  } catch (e) {
    res.status(400).json({
      error: {
        message: e.message
      }
    })
  }
})

app.listen(3000)
