const prompts = require("prompts");
const ora = require('ora');
const chalk = require('chalk');
const sort = require('./src/utils/sort');
const path = require('path');
const { iosPlatform, iosBuildOptions, runIOSCommand, runIOSPrompt} = require('./src/ios')
const { androidPlatform, androidBuildOptions, runAndroidEmulator, runAndroidApp, runAndroidCommand, runAndroidPrompt} = require('./src/android')
const saveCommand = require('./src/helpers/saveCommand');
const clearCommands = require('./src/helpers/clearCommands');
const getPreviousCommands = require('./src/helpers/getPreviousCommands');
const parseCommandEnv = require('./src/helpers/parseCommandEnv');
const { exec } = require("child_process");
const util = require('util');
const execPromise = util.promisify(exec);

const createDeviceLogFile = async () => {
  const filepath = path.resolve(__dirname, 'logs/deviceList.txt');
  const cmd = `touch ${filepath}`;
  let result = false;

  try {
      await execPromise(cmd);
      result = true;
  } catch (err) {
      result = false;
      console.log('🚫', 'createDeviceLogFile', `${chalk.red(err.stderr || err)}`);
  }

  return result;
};

const OSPrompt = async () => {
  const response = await prompts([
    {
      type: "select",
      name: "os",
      message: "Select device type",
      choices: [ iosPlatform, androidPlatform ],
      initial: 0
    }
  ]);
  const { os } = response || {};
  return os
}

const deviceBuildPrompt = async ({ os }) => {
  const response = await prompts([
    {
      type: "select",
      name: "env",
      message: "Select build environment",
      choices: os === 'ios' ? iosBuildOptions : androidBuildOptions,
      initial: 0
    }
  ]);
  const { env } = response || {};
  return env
}

const formatPreviousCommands = async () => {
  const choices = [];
  const commands = await getPreviousCommands();
  if (commands && typeof commands === 'object') {
    const sortedCommands = sort.objectValues({ data: commands, key: 'timestamp' })
    sortedCommands.forEach(item => {
      const { key, command, os, device } = item || {}
      const value = {
        key,
        command,
        os,
        device,
      }
      choices.push({ title: key, value })
    })
  }
  return choices;
}

const initCommandPrompt = async (commands) => {
  let initial = commands.length > 0 ? 1 : 0;

  const choices = initial ? [
    { title: "New", value: "new" },
    ...commands,
    { title: "Clear All Commands", value: "clear" },
    { title: "Exit", value: "exit" },
  ] : [
    { title: "New Simulator", value: "new" },
    { title: "Exit", value: "exit" },
  ];

  const newResponse = await prompts([
    {
      type: "select",
      name: "new_prev",
      message: "Select command",
      choices,
      initial,
    }
  ]);
  const { new_prev } = newResponse || {};
  return new_prev;
}

const handleExitCommand = () => {
  console.log(chalk.bold.blue('\n\tBye ✌️\n'))
};

const handleClearCommand = async () => {
  let spinner;
  try {
    spinner = ora({ text: `Clear commands`, spinner: 'bouncingBar', color: 'green' })
    spinner.start()

    await clearCommands();

    spinner.succeed();
  } catch (err) {
    spinner.fail();
    console.log('🚫 handleClearCommand error', err);
  }
};

const handleNewCommand = async () => {
  const os = await OSPrompt();
  const { env, debug, variant } = await deviceBuildPrompt({ os }) || {};

  if (os === 'android') {
    await runAndroidPrompt({ env, debug, variant });
  } else {
    await runIOSPrompt({ env, debug });
  }
};

const handlePrevCommand = async (result) => {
  let spinner;
  const { key, command, os, device } = result || {}
  if(!key || !command) return;

  try {
    spinner = ora({ text: `Building ${key}`, spinner: 'bouncingBar', color: 'green' })
    let error = false;
    if (os === 'android') {
      const { errorBag } = await runAndroidEmulator(device);
      spinner.start();
      if (!errorBag.hasError) {
        ({error} = await runAndroidCommand(command) || {})
        await runAndroidApp(parseCommandEnv(command));
      } else {
        error = true;
      }
    } else {
      spinner.start();
      ({ error } = await runIOSCommand(command) || {})
    }

    if(!error){
      spinner.succeed();
      await saveCommand({ key, command, os, device });
      ora({ text: `${os} Simulator Active 🚀`, spinner: 'bouncingBar', color: 'green' }).succeed();
    } else {
      spinner.fail();
    }
  } catch (err) {
    spinner.fail();
    console.log('🚫 handlePrevCommand error', err);
  }
};

const Prompt = async () => {
  try {
    await createDeviceLogFile();
    const commands = await formatPreviousCommands();
    const result = await initCommandPrompt(commands);

    if (result === 'exit') {
      handleExitCommand();
    } else if (result === 'new') {
      handleNewCommand();
    } else if (result === 'clear') {
      handleClearCommand();
    } else if (result) {
      handlePrevCommand(result);
    }

  } catch (err) {
    console.log('🚫 error', err);
    console.log('🚫 Error: Try uninstalling the app...');
  }
}

Prompt();

module.exports = Prompt;