'use strict';
const url = require('url');
const http = require('http');
const https = require('https');
const fs = require('fs');
let	PDFParser = require("pdf2json"),
	util = require('util'),
	fileType = require('file-type');

exports.scanUrl = function(args, res, next) {

	getBufferFromUrl(args.url.value).then((pdfContent) => {

		//console.log(util.inspect(pdfContent, {showHidden: false, depth: null}))
		args.upfile = {
			originalValue: {
				originalname: "this.pdf"
			},
			value: {
				buffer: pdfContent
			}
		};
		this.scanFile(args, res, next);
	}, (err) => {throw err}).catch((err) => console.log(err));
}

exports.scanFile = function(args, res, next) {
  /**
   * Submit a file for checking
   *
   *
   * upfile File The file to scan
   * returns inline_response_200
   **/
  var examples = {};
  examples['application/json'] = {
  "filename" : "aeiou",
  "hasText" : true
};

	//console.log(util.inspect(args.upfile, {showHidden: false, depth: null}))

    let pdfParser = new PDFParser(this,1);

    pdfParser.on("pdfParser_dataError", errData => {
    	console.error(errData.parserError);
  		res.writeHead(422, {'statusMessage': "PDF Parsing error: " + errData.parserError},{'Content-Type': 'application/json'})
  		res.end();
    });

    pdfParser.on("pdfParser_dataReady", pdfData => {

    	var filename = args.upfile.originalValue.originalname;
    	var hasText = false;
    	var pages = pdfData.formImage.Pages.length;

    	// Check for text
    	var pdftext = pdfParser.getRawTextContent();
    	pdftext = pdftext.replace(/\r\n----------------Page \(\d+\) Break----------------\r\n/g, '');
    	hasText = pdftext.length > 0 ? true : false;

    	//console.log(util.inspect(pdfData, {showHidden: false, depth: null}))

		var output = {};

		output['application/json'] = {
		  "filename" : filename,
		  "hasText" : hasText,
		  "pages": pages,
		  "id":  args.id ? args.id.value : ""
		};

		 res.setHeader('Content-Type', 'application/json');
		 res.end(JSON.stringify(output || {}, null, 2));

    });

	// Check to make sure this is a PDF file (by MIME type)
	var mimetype = fileType(args.upfile.value.buffer).mime;
	if (mimetype != "application/pdf") {
			console.log("Not a pdf");
	  		res.writeHead(422,{'Content-Type': 'application/json'})
  			res.end(JSON.stringify({'statusMessage': "Can't analyze this file type: " + mimetype}));
  	} else {
  		// This should be a PDF, analyze it
		pdfParser.parseBuffer(args.upfile.value.buffer);
	}

}

/**
 * Promisized HTTP GET call
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
			/*var file = fs.createWriteStream("file.pdf");
			response.pipe(file);
			response.on('end', () => {
				fs.readFile("./file.pdf", function(err, linkString){
					//console.log(err);
					for (var key in linkString){
						//console.log('bOBJ key: ', key);
					}
					resolve(linkString);
				});
			});*/
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
