'use strict';
const url = require('url');
const http = require('http');
const https = require('https');
const PDFParser = require("pdf2json");
const util = require('util');
const fileType = require('file-type');
const pdfjsLib = require('pdfjs-dist');
global.DOMParser = require('../domparsermock.js').DOMParserMock;

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
    const request = lib.get(urlObj, (response) => {
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
		//nativeImageDecoderSupport
		pdfjsLib.getDocument({
			data: fileBuffer,
			nativeImageDecoderSupport: pdfjsLib.NativeImageDecoding.NONE
		}).then(function (doc) {
			//console.log(doc.transport);
  	var numPages = doc.numPages;
  	console.log('# Document Loaded');
  	console.log('Number of Pages: ' + numPages);
  	console.log();

		//get metadata
		doc.getMetadata().then(function (data) {
	    console.log('# Metadata Is Loaded');
	    console.log('## All DATA');
	    console.log(JSON.stringify(data, null, 2));
	    console.log();
	    if (data.metadata) {
	      console.log('## Metadata');
	      console.log(JSON.stringify(data.metadata.metadata, null, 2));
	      console.log();
	    }
		});
		doc.getStats().then(function (data) {
	    console.log('# Stats are Loaded');
	    console.log('## Info');
	    console.log(JSON.stringify(data, null, 2));
	    console.log();
		});
		doc.getPageLabels().then(function (data) {
			console.log('# Page Labels Loaded');
			console.log('## Info');
			console.log(JSON.stringify(data, null, 2));
			console.log();
		});
		doc.getDestinations().then(function (data) {
			console.log('# Destinations Loaded');
			console.log('## Info');
			console.log(JSON.stringify(data, null, 2));
			console.log();
		});
		doc.getAttachments().then(function (data) {
			console.log('# Attachements Loaded');
			console.log('## Info');
			console.log(JSON.stringify(data, null, 2));
			console.log();
		});
		doc.getJavaScript().then(function (data) {
			console.log('# JavaScript Loaded');
			console.log('## Info');
			console.log(JSON.stringify(data, null, 2));
			console.log();
		});
		doc.getOutline().then(function (data) {
	    console.log('# Outline Loaded');
	    console.log('## Info');
	    console.log(JSON.stringify(data, null, 2));
	    console.log();
		});

		//get page text
		for (let i = 1; i <= numPages; i++){
			doc.getPage(i).then(function (page) {
				//console.log(page);
				page.getOperatorList().then(function (ops) {
					for (let key in ops){
						//console.log('OPKEY', key);
					}
					//console.log("OPERATORS", ops.fnArray, pdfjsLib.OPS);
					let opers = [];
    			for (let x=0; x < ops.fnArray.length; x++) {
        		if (ops.fnArray[x] == pdfjsLib.OPS.paintJpegXObject) {
							//console.log('IS paintJpegXObject');
							//console.log('ARGS',ops.argsArray[x])
							opers.push(ops.argsArray[x][0])
        		}
						//console.log(opers);
						//opers.map(function (a) { page.get(a) });
    			}
				});
				console.log('# Page ' + i);
				var viewport = page.getViewport(1.0 /* scale */);
				console.log('Size: ' + viewport.width + 'x' + viewport.height, viewport);
				console.log();
				return page.getTextContent({normalizeWhitespace: true}).then(function (content) {
					// Content contains lots of information about the text layout and
					// styles, but we need only strings at the moment
					var strings = content.items.map(function (item) {
						return item.str;
					});
					console.log('## Text Content');
					console.log(strings.join(' '));
					//console.log(JSON.stringify(content.styles, null, 2));
					//for (let key in content){
						//console.log('text key: ', key);
					//}
				}).then(function () {
					console.log();
				});
			});
		}
	});




		let pdfParser = new PDFParser(this,1);

		pdfParser.on("pdfParser_dataError", errData => {
			let dataErr = new Error("PDF Parsing error: " + errData.parserError);
			dataErr.code = 422;
			reject(dataErr);
		});

		pdfParser.on("pdfParser_dataReady", pdfData => {
			//console.log(pdfData.formImage.Pages[0]);
			//console.log(pdfData.formImage.Pages[0], pdfData.formImage.Pages[0].Texts[0].R);
			for (let i in pdfData.formImage.Pages[0].Texts){

				//console.log(pdfData.formImage.Pages[0].Texts[i].R);
			}
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
