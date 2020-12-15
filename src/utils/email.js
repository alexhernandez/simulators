const nodemailer = require('nodemailer');

const send = (mailOptions) => {
  return new Promise(async (resolve, reject) => {
    const { GMAIL_ADDRESS, GMAIL_OAUTH_CLIENT_ID, GMAIL_OAUTH_CLIENT_SECRET, GMAIL_OAUTH_REFRESH_TOKEN, GMAIL_OAUTH_ACCESS_TOKEN } = require('../../config') || {};
    try {
      var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: GMAIL_ADDRESS,
          clientId: GMAIL_OAUTH_CLIENT_ID,
          clientSecret: GMAIL_OAUTH_CLIENT_SECRET,
          refreshToken: GMAIL_OAUTH_REFRESH_TOKEN,
          accessToken: GMAIL_OAUTH_ACCESS_TOKEN,
        },
      });

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log('Email error: ', error)
          console.log('Email info: ', info)
          resolve({ error: true })
        } else {
          resolve({ error: false })
        }
      });
    } catch (error) {
      console.trace('email.send() error: ', error)
    }
  })
}

module.exports = {
  send: send
}