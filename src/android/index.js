// ANDROID CLI
//
const prompts = require("prompts");
const chalk = require('chalk');
const ora = require('ora');
const util = require('util');
const { exec, execSync, spawn } = require("child_process");
const saveCommand = require('../helpers/saveCommand');
const execCommand = require('../utils/execCommand');
const execPromise = util.promisify(exec);

// CONSTANTS
const ERROR_BINARY_NOT_FOUND = 'ERROR_BINARY_NOT_FOUND';
const ERROR_FETCHING_DEVICES = 'ERROR_FETCHING_DEVICES';
const ERROR_DEVICES_UNAVAILABLE = 'ERROR_DEVICES_UNAVAILABLE';
const ERROR_SHARED_AVD_DEVICE_INSTANCES = 'ERROR_SHARED_AVD_DEVICE_INSTANCES';
const ERROR_RUN_EMULATOR = 'ERROR_RUN_EMULATOR';
const ERROR_BUILD_FAILED = 'ERROR_BUILD_FAILED';

// CONFIG
const androidPlatform = { title: "Android", value: "android" };

const androidBuildOptions = [
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
const parseBufferToArray = (result) => result.toString().replace(/\n/g,' ').trim().split(' ');
const handleError = (error, message = '') => ({ type: error, hasError: true, message });

// ANDROID
const formatAndroidDeviceName = (name) => name.replace(/_/g, ' ');

const formatAndroidDevices = (devices) => devices.map(item => ({
  title: formatAndroidDeviceName(item),
  value: item,
}));

const fetchAndroidDevices = async () => {
  let devices = null;
  let errorBag = {};
  let emulatorPath = null;

  try {
    emulatorPath = parseBufferToString(execSync(`which emulator`));
  } catch (err) {
    errorBag = handleError(ERROR_BINARY_NOT_FOUND);
  }

  if (emulatorPath) {
    try {
      const { stdout } = await execCommand(`${emulatorPath} -list-avds`);
      devices = formatAndroidDevices(parseBufferToArray(stdout));
    } catch (err) {
      errorBag = handleError(ERROR_FETCHING_DEVICES);
    }
  }

  return { errorBag, devices };
};

const selectAndroidDevicePrompt = async (devices) => {
  const androidResponse = await prompts([
    {
      type: "select",
      name: "android_sim",
      message: "Select Android Device",
      choices: [
        ...devices
      ],
      initial: 0
    }
  ]);

  const { android_sim } = androidResponse || {};
  return android_sim
};

const selectAndroidDevice = async () => {
  let selection;
  let spinner;

  try {
    spinner = ora({ text: 'Fetch Android Devices', spinner: 'bouncingBar', color: 'green' });
    spinner.start();
    
    const { errorBag, devices } = await fetchAndroidDevices();
    if (errorBag.hasError) throw errorBag;
    if (devices.length === 0) throw handleError(ERROR_DEVICES_UNAVAILABLE);
    
    spinner.succeed();
    
    selection = await selectAndroidDevicePrompt(devices);
  } catch (err) {
    spinner.fail();
  }

  return selection;
};

const bootEmulator = (emulatorPath, device) => {
  return new Promise((resolve, reject) => {
    const emulatorCmd = `${emulatorPath} -avd ${device} -verbose -no-boot-anim -accel auto -gpu auto -netdelay none -netspeed full`;
    const emulator = spawn(emulatorCmd, { shell: true });
    const successMsg = 'boot completed';
    const successAltMsg = 'Adb connected';
    const errorMsg = 'ERROR: Booting Emulator';
    const errorMultiInstanceMsg = 'ERROR: Running multiple emulators with the same AVD';

    emulator.stdout.on('data', (stream) => {
      const data = parseBufferToString(stream);

      if (data.includes(errorMultiInstanceMsg)){
        resolve(handleError(ERROR_SHARED_AVD_DEVICE_INSTANCES, errorMultiInstanceMsg));
      } else if (data.includes(successMsg) || data.includes(successAltMsg)) {
        resolve({ hasError: false });
      }
    });

    emulator.stderr.on('data', (stream) => {
      resolve(handleError('ERROR_BOOT', errorMsg));
    });

    emulator.stderr.on('error', (stream) => {
      resolve(handleError('ERROR_BOOT', errorMsg));
    });

  });
};

const runAndroidApp = async (env) => {
  try {
    const activity = 'MainActivity';
    const pkgName = 'example'
    const packages = await execPromise(`adb shell pm list packages | grep ${pkgName}`);
    
    if (!packages.stderr) {
      const pkgs = parseBufferToArray(packages.stdout);
      let pkg = '';
      let pkgMain = '';
      
      for (let i = 0; i < pkgs.length; i++) {
        if (pkgs[i].includes(env)) {
          pkg = pkgs[i].replace('package:', '');
          pkgMain = pkg.replace(`.${env}`, '');
          break;
        }
      }

      await execPromise(`adb shell am start -n ${pkg}/${pkgMain}.${activity}`);
    }

  } catch (err) {
    console.log('🚫 runAndroidApp error', err);
  }
};

const runAndroidEmulator = async (device) => {
  let errorBag = {};
  let emulatorPath = null;
  let spinner;

  try {
    emulatorPath = parseBufferToString(execSync(`which emulator`));
  } catch (err) {
    errorBag = handleError(ERROR_BINARY_NOT_FOUND);
  }

  if (emulatorPath) {
    try {
      spinner = ora({ text: 'Boot Android Device', spinner: 'bouncingBar', color: 'green' });
      spinner.start();
      
      // KILL ALL CURRENT EMULATORS. ONLY ONE ALLOWED BY ANDROID
      await execPromise(`adb devices | grep emulator | cut -f1 | while read line; do adb -s $line emu kill; done`);
      
      // BOOT EMULATOR
      const { type, message, hasError } = await bootEmulator(emulatorPath, device);

      if (!hasError) {
        spinner.succeed();
      } else {
        spinner.fail(`Boot Android Device (${message})`);
        errorBag = handleError(type);
      }

    } catch(err) {
      spinner.fail();
      errorBag = handleError(ERROR_RUN_EMULATOR, err);
    }
  }

  return { errorBag };
};

const runAndroidCommand = async (command) => {
  return execCommand(command);
};

const runAndroidBuild = async ({ env, debug, variant, device }) => {
  let spinner;
  const _debugKey = debug ? 'debug' : 'standalone';
  const key = `${formatAndroidDeviceName(device)}-${env}-${_debugKey}`;
  const envfile = env ? `.env.${env}` : `.env`;
  const command = `ENVFILE=${envfile} react-native run-android --variant=${variant}`;

  try {
    spinner = ora({ text: `Building Android ${chalk.green(device)} (${chalk.yellow(env)})`, spinner: 'bouncingBar', color: 'green' });
    spinner.start();

    await saveCommand({ key, command, os: androidPlatform.value, device });
    const { error } = await runAndroidCommand(command) || {}

    if (!error) {
      spinner.succeed();
      ora({ text: 'Android Simulator Active 🚀', spinner: 'bouncingBar', color: 'green' }).succeed();
    } else {
      spinner.fail();
      console.log('🚫 runAndroidBuild error', error)
    }
    
  } catch (err) {
    spinner.fail();
    console.log('🚫 runAndroidBuild error', err);
  }
}

const runAndroidPrompt = async ({ env, debug, variant }) => {
  try {
    const device = await selectAndroidDevice();
    if (!device) return;

    const { errorBag } = await runAndroidEmulator(device);
    if (errorBag.hasError) throw errorBag;
    await runAndroidBuild({ env, debug, variant, device });
    await runAndroidApp(env);

  } catch (err) {
    console.log('🚫 runAndroidPrompt error', err);
  }
}

module.exports = {
  androidPlatform,
  androidBuildOptions,
  runAndroidEmulator,
  runAndroidApp,
  runAndroidCommand,
  runAndroidBuild,
  runAndroidPrompt,
};