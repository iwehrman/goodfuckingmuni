/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var view = require("app/view"),
        places = require("app/places"),
        util = require("app/util");
        
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
        places.removePlace(place);
    }
    
    function addStop(placeId, routeTag, dirTag, stopTag) {
        var place = places.getPlace(placeId);
        place.addStop(routeTag, dirTag, stopTag);
    }
    
    function removeStop(placeId, stopTag) {
        var place = places.getPlace(placeId);
        place.removeStop(stopTag);
    }
    
    function getStateFromHash() {
        var hash = window.location.hash,
            params;
        
        if (hash) {
            params = hash.substring(1).split("&").reduce(function (obj, eq) {
                var terms = eq.split("="),
                    key = terms[0],
                    val = terms[1],
                    castVal = key === "place" ? util.castInt(val) : val;
                    
                obj[key] = castVal;
                return obj;
            }, {});
        } else {
            params = {};
        }
        
        return params;
    }
    
    function getHashFromState(state) {
        var hash = "#",
            key;
        
        if (state.page) {
            hash += "page=" + state.page;
            
            for (key in state) {
                if (state.hasOwnProperty(key) && key !== "page") {
                    hash += "&" + key + "=" + state[key];
                }
            }
        }
        
        return hash;
    }
    
    function loadPageFromState(state) {
        switch (state.page) {
        case "places":
            switch (state.op) {
            case "add":
                view.showSearch();
                break;
            case "remove":
                removePlace(state.place);
                location.hash = "#page=places";
                break;
            case "arrivals":
                view.showPlaces(true, "arrivals");
                break;
            default:
                view.showPlaces(true);
            }
            break;
        case "place":
            switch (state.op) {
            case "add":
                addStop(state.place, state.route, state.direction, state.stop);
                location.hash = "#page=place&place=" + state.place;
                break;
            case "remove":
                removeStop(state.place, state.stop);
                location.hash = "#page=place&place=" + state.place;
                break;
            case "arrivals":
                view.showJourneys(state.place, state.lat, state.lon, decodeURIComponent(state.title));
                break;
            default:
                view.showPlace(state.place);
            }
            break;
        case "predictions":
            view.showPredictions(state.place, state.route, state.stop);
            break;
        case "routes":
            view.showRoutes(state.place);
            break;
        case "directions":
            view.showDirections(state.place, state.route);
            break;
        case "stops":
            view.showStops(state.place, state.route, state.direction, true);
            break;
        case "search":
            view.showSearch();
            break;
        default:
            view.showPlaces(false);
        }
    }
    
    function loadPageFromHash() {
        var state = getStateFromHash();
        loadPageFromState(state);
    }
    
    window.onhashchange = loadPageFromHash;
    
    exports.loadPageFromHash = loadPageFromHash;
});
