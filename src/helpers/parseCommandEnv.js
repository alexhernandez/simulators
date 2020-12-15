const parseCommandEnv = (cmd) => {
  const result = cmd.split(' ')[0].split('.');
  return result[result.length -1 ];
};

module.exports = parseCommandEnv;