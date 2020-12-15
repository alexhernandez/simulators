const chalk = require('chalk');
const { exec } = require("child_process");
const util = require('util');
const execCommand = (command, displayError = true) => {
  return new Promise(async (resolve, reject) => {
    try {
      const execPromise = util.promisify(exec);
      const { stdout, error } = await execPromise(command, { cwd: process.cwd() })
      if (stdout) {
        return resolve({ stdout, error: false })
      }
      if (error) {
        if (displayError) {
          console.log(chalk.red(error));
        }
        return resolve({ error: true, errorMessage: error })
      }
      if(!error){
        return resolve({ rrror: false })
      }
    } catch (error) {
      if (displayError) {
        console.log('catch: ', chalk.red(error));
      }
      return resolve({ error: true })
    }
  })
}

module.exports = execCommand;