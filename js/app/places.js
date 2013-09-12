/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        Q = require("q"),
        geo = require("app/geolocation");
    
    var PLACES_KEY = "org.wehrman.goodfuckingmuni.places";
    var allPlaces = [],
        placeCounter = 0;
    
    function placeKey(id) {
        return PLACES_KEY + "." + id;
    }
    
    function savePlace(place) {
        var key = placeKey(place.id);
        localStorage.setItem(key, JSON.stringify(place));
    }

    function forgetPlace(place) {
        var key = placeKey(place.id);
        localStorage.removeItem(key);
    }
    
    function Place(id, title, lat, lon, stops) {
        this.id = id;
        this.title = title;
        this.lat = lat;
        this.lon = lon;
        this.stops = stops;
    }
    
    Place.prototype.addStop = function (routeTag, dirTag, stopTag, index) {
        if (index === undefined) {
            index = 0;
        }
        this.stops.splice(index, 0, {
            routeTag: routeTag,
            dirTag: dirTag,
            stopTag: stopTag
        });
        savePlace(this);
    };
    
    Place.prototype.removeStop = function (stopTag) {
        var stopIndex = -1;
        this.stops.some(function (stop, index) {
            if (stop.stopTag === stopTag) {
                stopIndex = index;
                return true;
            }
        });

        if (stopIndex > -1) {
            this.stops.splice(stopIndex, 1);
            savePlace(this);
        }
    };
    
    function loadPlaces() {
        var placesJSON = localStorage.getItem(PLACES_KEY),
            places = placesJSON ? JSON.parse(placesJSON) : [];
        
        places.forEach(function (placeId) {
            var placeJSON = localStorage.getItem(placeKey(placeId)),
                placeObj = placeJSON ? JSON.parse(placeJSON) : null;
            
            if (placeObj) {
                var id = parseInt(placeObj.id, 10),
                    title = placeObj.title,
                    lat = parseFloat(placeObj.lat),
                    lon = parseFloat(placeObj.lon),
                    stops = placeObj.stops,
                    place = new Place(id, title, lat, lon, stops);
                
                if (placeCounter <= id) {
                    placeCounter = id + 1;
                }
                
                allPlaces.push(place);
            }
        });
    }
    
    function savePlaces() {
        var ids = allPlaces.map(function (place) {
            return place.id;
        });
        
        localStorage.setItem(PLACES_KEY, JSON.stringify(ids));
    }
    
    function getPlace(id) {
        var _place = null;
        allPlaces.some(function (place) {
            if (place.id === id) {
                _place = place;
                return true;
            }
        });
        return _place;
    }
    
    function getAllPlaces(lat, lon) {
        return allPlaces.slice(0);
    }
    
    function addPlace(title, position) {
        function addPlaceWithLocation(location) {
            var place = new Place(placeCounter++, title, location.lat, location.lon, []);
            allPlaces.push(place);
            savePlace(place);
            savePlaces();
            return place;
        }
        
        if (position) {
            var place = addPlaceWithLocation(position);
            return Q.when(place);
        } else {
            return geo.getLocation().then(addPlaceWithLocation);
        }
    }
    
    function removePlace(place) {
        var index = allPlaces.indexOf(place);
        if (index > 0) {
            allPlaces.splice(index, 1);
            savePlaces();
            forgetPlace(place);
        }
    }
    
    loadPlaces();
    
    return {
        getPlace: getPlace,
        getAllPlaces: getAllPlaces,
        addPlace: addPlace,
        removePlace: removePlace
    };
});