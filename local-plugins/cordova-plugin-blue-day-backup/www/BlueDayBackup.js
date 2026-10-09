var exec = require('cordova/exec');

exports.save = function (contents, fileName, success, error) {
  exec(success, error, 'BlueDayBackup', 'save', [contents, fileName]);
};
