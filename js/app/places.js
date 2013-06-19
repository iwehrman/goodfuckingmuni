/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, console */

define(["jquery", "app/storage"], function ($, storage) {
    "use strict";
    
    var PLACES_KEY = "org.wehrman.goodfuckingmuni.places";
    var allPlaces,
        placeCounter = 0;
    
    function placeKey(id) {
        return PLACES_KEY + "." + id;
    }
    
    function Place(id, title, lat, lon, stops) {
        this.id = id;
        this.title = title;
        this.lat = lat;
        this.lon = lon;
        this.stops = stops;
    }
    
    Place.prototype.addStop = function (routeTag, stopTag, index) {
        
    };
    
    Place.prototype.removeStop = function (index) {
        
    };
    
    Place.prototype.getStops = function (routeTag) {
        
    };
    
    Place.prototype.stringify = function () {
        
    };
    
    function getAllPlaces() {
        return allPlaces.slice(0);
    }
    
    function addPlace(title, position) {
        
    }
    
    function removePlace(id) {
        
    }
    
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
                
                allPlaces.push(place);
            }
        });
    }
    
    function savePlaces() {
        localStorage.setItem(PLACES_KEY, allPlaces.map(function (place) {
            return place.id;
        }));
    }
    
    loadPlaces();
    
    return {
        getAllPlaces: getAllPlaces,
        addPlace: addPlace,
        removePlace: removePlace
    };
});