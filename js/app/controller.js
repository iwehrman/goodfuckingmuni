/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var view = require("app/view");
    
    function loadPage(page) {
        var args = Array.prototype.slice.call(arguments, 0),
            params = args.length > 1 ? args.slice(1) : [];
        
        switch (page) {
        case "places":
            view.showPlaces.apply(null, params);
            break;
        case "place":
            view.showPlace.apply(null, params);
            break;
        case "predictions":
            view.showPredictions.apply(null, params);
            break;
        default:
            break;
        }
    }
    
    return {
        loadPage: loadPage
    };
});
