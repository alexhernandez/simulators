const https = require('https');

const get = (url) => {
  return new Promise(async (resolve, reject) => {
    try {
      const { HTTPS_COOKIES} = require('../../config') || {};
      var options = {
        'method': 'GET',
        'headers': {
          'Cookie': HTTPS_COOKIES
        }
      };
      https.get(url, options, (res) => {
        // console.log('statusCode:', res.statusCode);
        let body = '';
        res.on('data', data => {
          body += data
        })
        res.on('end', data => {
          let error = res.statusCode !== 200
          resolve({ data: body, error, statusCode: res.statusCode })
        })
      }).on('error', error => {
        reject({ error: true })
      })
    } catch (error) {
      reject({ error: true })
    }
  })
}

module.exports = {
  get: get
}