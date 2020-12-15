// iOS CLI
//
const prompts = require("prompts");
const chalk = require('chalk');
const ora = require('ora');
const { exec, execSync } = require("child_process");
const saveCommand = require('../helpers/saveCommand');
const execCommand = require('../utils/execCommand');

// CONSTANTS
const ERROR_BINARY_NOT_FOUND = 'ERROR_BINARY_NOT_FOUND';
const ERROR_FETCHING_DEVICES = 'ERROR_FETCHING_DEVICES';
const ERROR_DEVICES_UNAVAILABLE = 'ERROR_DEVICES_UNAVAILABLE';
const ERROR_RUN_SIMULATOR = 'ERROR_RUN_SIMULATOR';
const ERROR_BUILD_FAILED = 'ERROR_BUILD_FAILED';

// CONFIG
const iosPlatform = { title: "iOS", value: "ios" };

const iosBuildOptions = [
  { title: "DEV-Debug 'debug tools'", value: { env: "dev", debug: true, variant: 'devDebug' }},
  { title: "DEV-Release 'standalone'", value: { env: "dev", debug: false, variant: 'devRelease' }},
  { title: "STAGE-Debug 'debug tools'", value: { env: "stage", debug: true, variant: 'stageDebug' }},
  { title: "STAGE-Release 'standalone'", value: { env: "stage", debug: false, variant: 'stageRelease' }},
  { title: "PROD-Debug 'debug tools'", value: { env: "prod", debug: true, variant: 'prodDebug' }},
  { title: "PROD-Release 'standalone'", value: { env: "prod", debug: false, variant: 'prodRelease' }},
  { title: "Master-Release-Debug 'debug tools'", value: { env: "release", debug: true, variant: 'masterDebug' }},
  { title: "Master-Release 'standalone'", value: { env: "release", debug: false, variant: 'masterRelease' }},
];

// UTIL
const parseBufferToString = (result) => result.toString().replace('\n','').trim();
const handleError = (error, message = '') => ({ type: error, hasError: true, message });

// IOS
const formatIOSDevices = (devices) => {
  try {
    if (typeof devices === 'string') {
      const list = devices.split('\n')
      if (list && Array.isArray(list)) {
        const _devices = []
        list.forEach(item => {
          if (item && typeof item === 'string') {
            const iosDevice = item.split(' (');
            if (iosDevice && Array.isArray(iosDevice) && iosDevice[0]) {
              const iosDeviceCheck = item.split(' ');
              if (iosDeviceCheck[0] === 'iPhone') {
                _devices.push({
                  title: `${item}`,
                  value: `${iosDevice[0]}`
                })
              }
            }
          }
        })
        return _devices;
      }
    }

    return [];
  } catch (error) {
    console.log(`🚫 formatIOSDevices  error: {error}`);
  }
}

const fetchIOSDevices = async () => {
  let devices = null;
  let errorBag = {};
  let emulatorPath = null;

  try {
    emulatorPath = parseBufferToString(execSync(`which instruments`));
  } catch (err) {
    errorBag = handleError(ERROR_BINARY_NOT_FOUND);
  }

  if (emulatorPath) {
    try {
      const { stdout } = await execCommand(`${emulatorPath} -s devices | grep "iPhone"`);
      if(stdout){
        devices = formatIOSDevices(stdout);
      }
    } catch (err) {
      errorBag = handleError(ERROR_FETCHING_DEVICES);
    }
  }

  return { errorBag, devices };
};

const selectIOSDevicePrompt = async (devices) => {
  const iosResponse = await prompts([
    {
      type: "select",
      name: "ios_sim",
      message: "Select iOS device",
      choices: [
        ...devices
      ],
      initial: 0
    }
  ]);
  const { ios_sim } = iosResponse || {};
  return ios_sim
};

const selectIOSDevice = async () => {
  let selection;
  let spinner;

  try {
    spinner = ora({ text: 'Fetch iOS Devices', spinner: 'bouncingBar', color: 'green' });
    spinner.start();
    
    const { errorBag, devices } = await fetchIOSDevices();
    if (errorBag.hasError) throw errorBag;
    if (devices.length === 0) throw handleError(ERROR_DEVICES_UNAVAILABLE);
    
    spinner.succeed();
    
    selection = await selectIOSDevicePrompt(devices);
  } catch (err) {
    spinner.fail();
  }

  return selection;
};

const runIOSCommand = async (command) => {
  return execCommand(command);
};

const runIOSBuild = async ({ env, debug, device }) => {
  let spinner;
  const _debugKey = debug ? 'debug' : 'standalone'
  const key = `${device}-${env}-${_debugKey}`;
  const configuration = debug ? '' : '--configuration Release'
  const command = `ENVFILE=.env.${env} react-native run-ios --scheme ${env} --simulator="${device}" ${configuration}`

  try {
    spinner = ora({ text: `Building iOS ${chalk.green(device)} (${chalk.yellow(env)})`, spinner: 'bouncingBar', color: 'green' })
    spinner.start();

    await saveCommand({ key, command, os: iosPlatform.value, device });
    const { error } = await runIOSCommand(command) || {}
    if(error){
      spinner.fail();
      console.log('🚫 runIOSBuild error', error)
      return;
    }
    spinner.succeed();

    ora({ text: 'iOS Simulator Active 🚀', spinner: 'bouncingBar', color: 'green' }).succeed();
  } catch (error) {
    spinner.fail();
    console.log('🚫 runIOSBuild error', error)
  }
}


const runIOSPrompt = async ({ env, debug }) => {
  try {
    const device = await selectIOSDevice();
    if (!device) return;

    await runIOSBuild({ env, debug, device })

  } catch (err) {
    console.log('🚫 runIOSPrompt error', err);
  }
}

module.exports = {
  iosPlatform,
  iosBuildOptions,
  runIOSCommand,
  runIOSBuild,
  runIOSPrompt,
};