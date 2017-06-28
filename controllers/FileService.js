'use strict';
const url = require('url');
const http = require('http');
const https = require('https');
const PDFParser = require("pdf2json");
const util = require('util');
const fileType = require('file-type');

exports.scanUrl = function(args, res, next) {
	const fileUrl = args.url.value;
	const fileName = fileUrl.replace(/^.+\/([^\/\?]+)(\?.*)?$/, "$1");
	const scanId = args.id ? args.id.value : "";
	getBufferFromUrl(fileUrl)
		.then((pdfBuffer) => testPDFBuffer(pdfBuffer), (err) => {throw err})
		.then((results) => {
			results.filename = fileName;
			results.id = scanId;
			sendAPIResponse(res, results);
		}, (err) => {throw err}).catch((err) => sendAPIResponse(res, "", err));
}

exports.scanFile = function(args, res, next) {
  /**
   * Submit a file for checking
   *
   *
   * upfile File The file to scan
   * returns inline_response_200
   **/
 	const fileName = args.upfile.originalValue.originalname;
 	const scanId = args.id ? args.id.value : "";
	let pdfBuffer = args.upfile.value.buffer;
 	testPDFBuffer(pdfBuffer).then((results) => {
 			results.filename = fileName;
 			results.id = scanId;
 			sendAPIResponse(res, results);
 		}, (err) => {throw err}).catch((err) => sendAPIResponse(res, "", err));
}

/**
 * Promisized HTTP GET call that returns a Buffer
 */
const getBufferFromUrl = function(reqUrl) {
  // return new pending promise
  return new Promise((resolve, reject) => {
    // select http or https module, depending on reqested reqUrl
    const lib = reqUrl.startsWith('https') ? https : http
    const urlObj = url.parse(reqUrl);
    const options = {
      host: urlObj.host,
      path: urlObj.path,
      query: urlObj.query,
    }
    const request = lib.get(options, (response) => {
      // handle http errors
      if (response.statusCode < 200 || response.statusCode > 299) {
         reject(new Error('Failed to load page, status code: ' + response.statusCode + ' - ' + reqUrl));
      }
      // temporary data holder
      const body = [];
      // on every content chunk, push it to the data array
      response.on('data', (chunk) => body.push(chunk));
      // we are done, resolve promise with those joined chunks
      response.on('end', () => resolve(Buffer.concat(body)));
    })
    // handle connection errors of the request
    request.on('error', (err) => reject(err))
  })
}

/**
 * Run PDF tests on a given file Buffer
 */
const testPDFBuffer = function(fileBuffer) {
	return new Promise((resolve, reject) => {
		let pdfParser = new PDFParser(this,1);

		pdfParser.on("pdfParser_dataError", errData => {
			let dataErr = new Error("PDF Parsing error: " + errData.parserError);
			dataErr.code = 422;
			reject(dataErr);
		});

		pdfParser.on("pdfParser_dataReady", pdfData => {
			var hasText = false;
			var pages = pdfData.formImage.Pages.length;

			// Check for text
			var pdftext = pdfParser.getRawTextContent();
			pdftext = pdftext.replace(/\r\n----------------Page \(\d+\) Break----------------\r\n/g, '');
			hasText = pdftext.length > 0 ? true : false;

			//console.log(util.inspect(pdfData, {showHidden: false, depth: null}))
			resolve({
				hasText: hasText,
				pages: pages
			});
		});

		// Check to make sure this is a PDF file (by MIME type)
		var mimetype = fileType(fileBuffer).mime;
		if (mimetype != "application/pdf") {
			let notPDF = new Error("Can't analyze this file type: " + mimetype);
			notPDF.code = 422;
			reject(notPDF);
		} else {
			// This should be a PDF, analyze it
			pdfParser.parseBuffer(fileBuffer);
		}
	});
}

/*
 * generic API response wrapper
 */
const sendAPIResponse = function(res, data, err) {
  let contentType = "application/json";
	let wrappedData = {
		'application/json': data
	};
  let responseData = JSON.stringify(wrappedData);
  res.statusCode = 200;

  if (err){
		//send error to the console
		console.error(err);
    res.statusCode = (err.code||'400');
    contentType = "application/json";
    let errMsg = {statusMessage: err.message};
    if (data.length){ //in case there is data to pass along
      errMsg.data = data;
    }
    responseData = JSON.stringify(errMsg);
  }
  res.setHeader('Content-Type', contentType);
  res.end(responseData);
}
