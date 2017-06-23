'use strict';
let	PDFParser = require("pdf2json"),
	util = require('util'),
	fileType = require('file-type');
        
        
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

