/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "app/geolocation"], function ($, geolocation) {
    "use strict";
    
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
    
    Place.prototype.removeStop = function (index) {
        this.stops.splice(index, 1);
        savePlace(this);
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
            }
        });
        return _place;
    }
    
    function getAllPlaces(lat, lon) {
        return allPlaces.slice(0);
    }
    
    function addPlace(title, position) {
        var deferred = $.Deferred(),
            geopromise,
            place;
        
        if (position) {
            geopromise = $.Deferred().resolve(position);
        } else {
            geopromise = geolocation.getLocation();
        }
        
        geopromise.done(function (location) {
            place = new Place(placeCounter++, title, location.lat, location.lon, []);
            allPlaces.push(place);
            savePlace(place);
            savePlaces();
            deferred.resolve(place);
        }).fail(deferred.reject.bind(deferred));

        return deferred.promise();
    }
    
    function removePlace(place) {
        var index = allPlaces.indexOf(place);
        if (index > 0) {
            allPlaces.splice(index, 1);
            savePlaces();
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