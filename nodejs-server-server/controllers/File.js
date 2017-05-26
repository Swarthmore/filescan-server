'use strict';

var url = require('url');

var File = require('./FileService');

module.exports.scanFile = function scanFile (req, res, next) {
  File.scanFile(req.swagger.params, res, next);
};
