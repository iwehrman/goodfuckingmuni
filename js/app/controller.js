/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var view = require("app/view"),
        places = require("app/places");
        
    function addPlace() {
        var deferred = $.Deferred(),
            name = window.prompt("Place name: ", "");
        
        if (name) {
            places.addPlace(name).done(function (place) {
                deferred.resolve(place);
            }).fail(function (err) {
                deferred.reject(err);
            });
        } else {
            deferred.reject();
        }
        
        return deferred.promise();
    }
    
    function removePlace(placeId) {
        var place = places.getPlace(placeId);
        
        if (window.confirm("Remove place '" + place.title + "'?")) {
            places.removePlace(place);
            return true;
        }

        return false;
    }
    
    function addStop(placeId, routeTag, dirTag, stopTag) {
        var place = places.getPlace(placeId);
        place.addStop(routeTag, dirTag, stopTag);
    }
    
    function loadPage(page) {
        var args = Array.prototype.slice.call(arguments, 0),
            params = args.length > 1 ? args.slice(1) : [],
            stateObj = {};
        
        switch (page) {
        case "places":
            view.showPlaces();
            break;
        case "addPlace":
            addPlace().done(function (place) {
                stateObj.place = place.id;
                history.pushState(stateObj, null, "#p=" + place.id);
                view.showPlace(place.id);
            });
            break;
        case "removePlace":
            params[0] = parseInt(params[0], 10);
            if (removePlace(params[0])) {
                history.pushState(stateObj, null, "");
                view.showPlaces();
            }
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
            addStop.apply(null, params);
            stateObj.place = params[0];
            history.pushState(stateObj, null, "#p=" + params[0]);
            view.showPlace(params[0]);
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
