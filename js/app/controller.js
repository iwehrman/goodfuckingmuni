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
    
    function getStateFromHash() {
        var hash = window.location.hash,
            params;
        
        if (hash) {
            params = hash.substring(1).split("&").reduce(function (obj, eq) {
                var terms = eq.split("="),
                    key = terms[0],
                    val = terms[1];
                    
                obj[key] = val;
                return obj;
            }, {});
        } else {
            params = {};
        }
        
        if (params.place !== undefined) {
            var placeId = util.castInt(params.place);
            params.place = places.getPlace(placeId);
        } else if (params.lat && params.lon && params.title) {
            var lat = parseFloat(params.lat, 10),
                lon = parseFloat(params.lon, 10),
                title = decodeURIComponent(params.title);
            
            params.place = {
                lat: lat,
                lon: lon,
                title: title
            };
            
            delete params.lat;
            delete params.lon;
            delete params.title;
        }
        
        return params;
    }
    
    function loadPageFromState(state) {
        switch (state.page) {
        case "places":
            switch (state.op) {
            case "add":
                view.showSearch();
                break;
            case "remove":
                places.removePlace(state.place);
                location.hash = "#page=places";
                break;
            case "departures":
                view.showPlaces(true);
                break;
            default:
                view.showAllJourneys(true);
            }
            break;
        case "place":
            switch (state.op) {
            case "add":
                state.place.addStop(state.route, state.direction, state.stop);
                location.hash = "#page=place&place=" + state.place.id;
                break;
            case "remove":
                state.place.removeStop(state.stop);
                location.hash = "#page=place&place=" + state.place.id;
                break;
            case "departures":
                view.showPlace(state.place);
                break;
            default:
                view.showJourneys(state.place);
            }
            break;
        case "predictions":
            view.showPredictions(state.place, state.route, state.stop, state.op);
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
        default:
            view.showAllJourneys(false);
        }
    }
    
    function loadPageFromHash() {
        var state = getStateFromHash();
        loadPageFromState(state);
    }
    
    window.onhashchange = loadPageFromHash;
    
    exports.loadPageFromHash = loadPageFromHash;
});
