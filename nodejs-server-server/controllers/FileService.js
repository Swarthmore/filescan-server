'use strict';
let fs = require('fs'),
	PDFParser = require("pdf2json"),
	util = require('util');
        
        
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

	console.log(util.inspect(args.upfile, {showHidden: false, depth: null}))
	
    let pdfParser = new PDFParser(this,1);

    pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
    pdfParser.on("pdfParser_dataReady", pdfData => {
    	console.log(pdfParser.getRawTextContent());
    	console.log("Pages: " + pdfData.formImage.Pages.length);
    
    	console.log(util.inspect(pdfData, {showHidden: false, depth: null}))
        fs.writeFile("/Users/aruether/Downloads/F1040EZ.content.txt", pdfParser.getRawTextContent());
    });

    //pdfParser.loadPDF("/Users/aruether/Downloads/EvaluationKITAccessingSurveyResultsv3.0.pdf");
	pdfParser.parseBuffer(args.upfile.value.buffer);


  if (Object.keys(examples).length > 0) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(examples[Object.keys(examples)[0]] || {}, null, 2));
  } else {
    res.end();
  }
}

