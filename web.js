var express = require("express"),
    knox    = require('knox');
    gm      = require('gm').subClass({ imageMagick: true }),
    http    = require('http');

// TODO: Change this to the default image extention on S3
var DEFAULT_EXTENTION = 'jpg';

// Set up Express
var app = express();
app.use(express.logger());

// Setup Knox
var imageBucket = knox.createClient({
    key: process.env.AWS_ACCESS_KEY_ID,
    secret: process.env.AWS_SECRET_ACCESS_KEY,
    bucket: 'cute_kittens'
});

var getOriginalImageFromS3 = function(params, cb) {
    imageBucket.getFile(params.filePath + '.' + DEFAULT_EXTENTION, function(err, res) {
        if(err) {
            throw(err);
        }

        cb(res);
    }).on('error', function(err) {
        throw(err);
    }).end();
};

// Where the magic happens
// Using the streaming response of the original file it manipulates the stream
// in place and pipes the results to the response stream
var pipeGmToResponse = function(response, imgStream, params) {
    var imgWriter = gm(imgStream, 'img.' + DEFAULT_EXTENTION);

    if (params.size) {
        var dementions = params.size.split('x');
        imgWriter.resize(dementions[0], dementions[1]);
    }

    imgWriter.stream(params.format)
             .pipe(response);
};

// Returns passably converted converted shirt images
//
// For just the original image:
// /images/:file_path.:format -> images/v5/cat_pic.png
//
// For resized images:
// /images/:widthx:height/:file_path.:format -> /images/150x100/cats/cheshire.jpg
//
// Will 404 if can't find the original image to reformat
app.get(/\/images\/(?:(\d+x\d+)\/)?([^.]+).(\w+)/, function(request, response) {
    request.params.size       = request.params[0];
    request.params.filePath   = request.params[1]
    request.params.format     = request.params[2];

    getOriginalImageFromS3(request.params, function(imgStream) {
        if(imgStream.statusCode == 200) {
            pipeGmToResponse(response, imgStream, request.params);
        } else {
            // TODO: Generate image from scratch here?
            response.status(404).send('Not Found');
        }
    });
});

var port = process.env.PORT || 5000;

// Start the server
app.listen(port, function() {
      console.log("Listening on " + port);
});
