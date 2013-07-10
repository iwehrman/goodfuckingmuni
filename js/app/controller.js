/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var view = require("app/view");
        
    function loadPage(page) {
        var args = Array.prototype.slice.call(arguments, 0),
            params = args.length > 1 ? args.slice(1) : [],
            stateObj = {};
        
        switch (page) {
        case "places":
            view.showPlaces.apply(null, params);
            break;
        case "addPlace":
            params[0] = parseInt(params[0], 10);
            stateObj.place = params[0];
            history.pushState(stateObj, null, "#p=" + params[0]);
            view.addPlace.apply(null, params);
            break;
        case "place":
            params[0] = parseInt(params[0], 10);
            stateObj.place = params[0];
            history.pushState(stateObj, null, "#p=" + params[0]);
            view.showPlace.apply(null, params);
            break;
        case "routes":
            params[0] = parseInt(params[0], 10);
            stateObj.place = params[0];
            history.pushState(stateObj, null, "#p=" + params[0] + "&o=add");
            view.showRoutes.apply(null, params);
            break;
        case "directions":
            params[0] = parseInt(params[0], 10);
            stateObj.place = params[0];
            stateObj.route = params[1];
            history.pushState(stateObj, null, "#p=" + params[0] + "&o=add&r=" + params[1]);
            view.showDirections.apply(null, params);
            break;
        case "stops":
            params[0] = parseInt(params[0], 10);
            stateObj.place = params[0];
            stateObj.route = params[1];
            stateObj.dir = params[2];
            history.pushState(stateObj, null, "#p=" + params[0] + "&o=add&r=" + params[1] + "&d=" + params[2]);
            view.showStops.apply(null, params);
            break;
        case "addStop":
            params[0] = parseInt(params[0], 10);
            view.addStop.apply(null, params);
            stateObj.place = params[0];
            history.pushState(stateObj, null, "#p=" + params[0]);
            view.showPlaces(params);
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
