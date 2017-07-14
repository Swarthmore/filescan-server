'use strict';
const url = require('url');
const http = require('http');
const https = require('https');
const util = require('util');
const fileType = require('file-type');
const pdfjsLib = require('pdfjs-dist');
global.DOMParser = require('../domparsermock.js').DOMParserMock;

exports.scanUrl = function(args, res, next) {
	const fileUrl = args.url.value;
	const fileName = fileUrl.replace(/^.+\/([^\/\?]+)(\?.*)?$/, "$1");
	const scanId = args.id ? args.id.value : "";
	const maxPages = (args.maxPages.value||null);
	getBufferFromUrl(fileUrl)
		.then((pdfBuffer) => testPDFBuffer(pdfBuffer, maxPages), (err) => {throw err})
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
	const maxPages = (args.maxPages.value||null);
	let pdfBuffer = args.upfile.value.buffer;
 	testPDFBuffer(pdfBuffer, maxPages).then((results) => {
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
      response.on('end', () => {
				let pdfBuffer = Buffer.concat(body);
				resolve(pdfBuffer);
			});
    })
    // handle connection errors of the request
    request.on('error', (err) => reject(err))
  })
}

/**
 * Run PDF tests on a given file Buffer
 */
const testPDFBuffer = function(fileBuffer, maxPages) {
	return new Promise((resolve, reject) => {
		//Do the language test first
		let testResults = {};
		let langMatch = fileBuffer.toString('utf8', 0, 1024).match(/lang\(([a-z\-]+?)\)/mi);
		let langCode = (langMatch == null) ? false : langMatch[1];
		testResults.language = langCode;

		//nativeImageDecoderSupport
		pdfjsLib.getDocument({
			data: fileBuffer,
			nativeImageDecoderSupport: pdfjsLib.NativeImageDecoding.NONE
		}).then((doc)  => {
  		testResults.numPages = doc.numPages;
			let pendingTests = [];
			pendingTests.push(getMetaData(doc));
			pendingTests.push(getJavaScript(doc));
			pendingTests.push(getOutline(doc));
			pendingTests.push(getAttachments(doc));
			pendingTests.push(getPageInfo(doc, maxPages));
			Promise.all(pendingTests).then((allData) => {
				allData.forEach(function(data){
					let key;
					for (key in data){
						testResults[key] = data[key];
					}
				});
				resolve(testResults);
			});
		});
	});
}

/**
 * return the parsed metadata.
 * parse the title and hasForm flag into separate elements.
 */
const getMetaData = function(doc){
	return new Promise((resolve, reject) => {
		doc.getMetadata().then((data) => {
			let noMeta = {
			 metaData : {},
			 hasForm: false,
			 hasTitle: false
		 	};
			if ('info' in data) {
				let hasForm = ('IsAcroFormPresent' in data.info) ? data.info.IsAcroFormPresent : false;
				let hasTitle = ('Title' in data.info) ? ((data.info.Title.length) ? data.info.Title : false) : false;
				resolve ({
					metaData : data.info,
					hasForm: hasForm,
					title: hasTitle
				});
			} else {
				resolve (noMeta);
			}
		}, (err) => {
			resolve (noMeta);
		});
	});
}

/**
 * extract any JavaScript and return true if any exists, false otherwise
 */
const getJavaScript = function(doc){
 	return new Promise((resolve, reject) => {
	 	doc.getJavaScript().then(function (data) {
		 	resolve({hasJavaScript: (data.length) ? true : false});
	 	}, (err) => resolve({hasJavaScript: false}));
	});
}

/**
 * see if the document conatains an Outline
 */
const getOutline = function(doc){
 	return new Promise((resolve, reject) => {
	 	doc.getOutline().then(function (data) {
			let response = { hasOutline: (data !== null) };
			if (response.hasOutline){
				response.outlineTitles = data.map(function(sec){
					return sec.title;
				});
			}
		 	resolve(response);
	 	}, (err) => resolve({hasOutline: false}));
	});
}

/**
 * see if the document conatains an Outline
 */
const getAttachments = function(doc){
 	return new Promise((resolve, reject) => {
	 	doc.getAttachments().then(function (data) {
			let response = { hasAttachements: (data !== null) };
			//TODO get attachment info
		 	resolve(response);
	 	}, (err) => resolve({hasAttachements: false}));
	});
}

/**
 * return the page content
 */
const getPageContent = function(page){
	return new Promise((resolve, reject) => {
		page.getTextContent({normalizeWhitespace: true}).then(function (content) {
			// Content contains lots of information about the text layout and
			// styles, but we need only strings at the moment
			var strings = content.items.map(function (item) {
				let trimmedText = item.str.replace(/(^\s+|\s+$)/gm, "");
				return trimmedText;
			}).filter(function (str){
				return (str.length);
			});
			resolve({pageText: strings.join(' ')});
		},(err) => resolve({pageText: ""}));
	});
}

/*
 * Get information for each page
 */
const getPageInfo = function(doc, maxPages) {
	return new Promise((resolve, reject) => {
		if (maxPages == null || maxPages > doc.numPages){
			maxPages = doc.numPages;
		}
		let pageInfo = [];
		//get page text
		for (let i = 1; i <= maxPages ; i++){
			pageInfo.push(getSinglePageInfo(doc, i));
		}
		Promise.all(pageInfo).then((allData) => {
			let pageResults = {
				hasText: false
			};
			for (let p in allData){
				if ("pageText" in allData[p] && allData[p].pageText.length){
					pageResults.hasText = true;
					break;
				}
			}
			pageResults.pageInfo = allData;
			pageResults.numPagesChecked = maxPages;
			resolve(pageResults);
		});
	});
}

/**
 * get the info for a single page
 */
const getSinglePageInfo = function(doc, index){
	return new Promise((resolve, reject) => {
		doc.getPage(index).then((page) => getPageContent(page),(err) => resolve({pageNum: index})).then((pageContent) => {
			pageContent.pageNum = index;
			resolve(pageContent)
		}, (err) => resolve({pageNum: index}));
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
