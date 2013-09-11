/*global requirejs */

// Place third party dependencies in the lib folder
//
// Configure loading modules from the lib directory,
// except 'app' ones, 
requirejs.config({
    "baseUrl": "js/components",
    "paths": {
        "app": "../app",
        "data": "../../data",
        "html": "../../html",
        "text": "requirejs-text/text",
        "rasync": "requirejs-plugins/src/async",
        "jquery": "jquery/jquery.min",
        "jquery.event.move": "jquery.event.move/js/jquery.event.move",
        "jquery.event.swipe": "jquery.event.swipe/js/jquery.event.swipe",
        "async": "async/lib/async",
        "mustache": "mustache/mustache"
    }
});

// Load the main app module to start the app
requirejs(["app/main"]);
