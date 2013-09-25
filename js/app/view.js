/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console, google */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        Q = require("q"),
        mustache = require("mustache"),
        geo = require("app/geolocation"),
        places = require("app/places"),
        routes = require("app/routes"),
        preds = require("app/predictions"),
        journeys = require("app/journeys"),
        page = require("app/page"),
        list = require("app/list"),
        util = require("app/util");
    
    var _distanceHtml = require("text!html/distance.html"),
        _predictionsHtml = require("text!html/predictions.html"),
        _titleHtml = require("text!html/title.html"),
        searchHtml = require("text!html/search.html");
    
    var distanceTemplate = mustache.compile(_distanceHtml),
        predictionsTemplate = mustache.compile(_predictionsHtml),
        titleTemplate = mustache.compile(_titleHtml);
    
    var RECENT_PLACE_TIMEOUT = 1000 * 60 * 10, // 10 minutes
        RECENT_PLACE_KEY = "org.wehrman.muni.view.recent_place";
    
    var recentPlace = null,
        recentPlaceTimer = null;
    
    function getRecentPlace() {
        return recentPlace;
    }
    
    function setRecentPlace(place, timeout) {
        var placeObj = {
            place: place.id,
            time: Date.now()
        };
        
        localStorage.setItem(RECENT_PLACE_KEY, JSON.stringify(placeObj));
        recentPlace = place;
        
        if (recentPlaceTimer) {
            clearTimeout(recentPlaceTimer);
        }
        
        recentPlaceTimer = setTimeout(function () {
            recentPlace = null;
            recentPlaceTimer = null;
        }, timeout || RECENT_PLACE_TIMEOUT);
    }

    function loadRecentPlace() {
        var placeObjJson = localStorage.getItem(RECENT_PLACE_KEY);
        if (placeObjJson) {
            try {
                var placeObj = JSON.parse(placeObjJson),
                    timeLeft = Date.now() - placeObj.time;
                
                if (timeLeft < RECENT_PLACE_TIMEOUT) {
                    var place = places.getPlace(placeObj.place);
                    setRecentPlace(place, timeLeft);
                }
            } catch (err) {
                localStorage.removeItem(RECENT_PLACE_KEY);
            }
        }
    }
    
    function showPredictions(place, routeTag, stopTag, entryOp) {
        
        function getParameters(route) {
            var stop = route.stops[stopTag],
                title = stop.title,
                options = {
                    emptyMessage: "No predictions found.",
                    backHref: "#page=place&" +
                                (place.id !== undefined ? "place=" + place.id :
                                "lat=" + place.lat + "&lon=" + place.lon +
                                "&title=" + encodeURIComponent(place.title)),
                    getLeft: function (prediction) {
                        return predictionsTemplate({predictions: prediction});
                    },
                    refresh: function (force, $container) {
                        return preds.getPredictions(routeTag, stopTag, force).then(function (newPredictions) {
                            var $entries = $container.find(".entry");
                            if ($entries.length === newPredictions.length) {
                                $entries.each(function (index, entry) {
                                    $(entry).find(".entry__minutes").each(function (_index, minutes) {
                                        $(minutes).text(newPredictions[index].minutes);
                                    });
                                });
                            } else {
                                Q.nextTick(function () {
                                    var listPromise = Q.when(newPredictions);
                                    list.showList(title, listPromise, options);
                                });
                                throw new Error("Reload");
                            }
                        });
                    }
                };
            return [title, options];
        }
        
        routes.getRoute(routeTag)
            .then(getParameters)
            .spread(function (title, options) {
                var listPromise = preds.getPredictions(routeTag, stopTag);
                
                list.showList(title, listPromise, options);
            })
            .done();
    }
    
    function showJourneys(place) {
        var options = {
                emptyMessage: "No routes found.",
                backHref: place.id !== undefined ? "#page=places" : "#page=places&op=add",
                getEntryHref: function (journey) {
                    var stop = journey.departure,
                        direction = stop._direction,
                        route = direction._route,
                        placeFrag = place.id !== undefined ? "place=" + place.id :
                                "lat=" + place.lat + "&lon=" + place.lon + "&title=" +
                                encodeURIComponent(place.title);
                
                    return "#page=predictions&route=" + route.tag +
                        "&direction=" + direction.tag +
                        "&stop=" + stop.tag + "&" + placeFrag;
                },
                getTags: function (journey) {
                    var stop = journey.departure,
                        direction = stop._direction,
                        route = direction._route;
                
                    return [{tag: "place", value: place.id},
                            {tag: "route", value: route.tag},
                            {tag: "direction", value: direction.tag},
                            {tag: "stop", value: stop.tag}];
                },
                getLeft: function (journey) {
                    var departure = journey.departure,
                        arrival = journey.arrival,
                        direction = arrival._direction,
                        route = direction._route,
                        title = route.getTitleWithColor(),
                        subtitles = [direction.title, "@ " + departure.title, "↪ " + arrival.title];
                    
                    return titleTemplate({title: title, subtitles: subtitles});
                },
                getRight: function (journey) {
                    var departurePred = journey.departurePrediction,
                        arrivalPred = journey.feasibleArrivalPrediction,
                        finalPred = journey.finalPrediction,
                        title = predictionsTemplate({predictions: departurePred}),
                        arrivalSubtitle = "↪ " + predictionsTemplate({predictions: arrivalPred}),
                        finalSubtitle = "... " + predictionsTemplate({predictions: finalPred}),
                        subtitles = [arrivalSubtitle, finalSubtitle],
                        titleHtml = titleTemplate({title: title, subtitles: subtitles});
    
                    return titleHtml;
                },
                refresh: function (force, $container) {
                    function getJourneysAtPlace(position) {
                        var journeysPromise = journeys.getExplodedJourneys(position, place, force);
                        return Q.all([position, journeysPromise]);
                    }
                    
                    function refreshJourneysAtPosition(position, journeys) {
                        var meters = geo.distance(position, place),
                            miles = geo.kilometersToMiles(meters),
                            distance = distanceTemplate({miles: miles}),
                            title = place.title + " -" + distance,
                            $entries = $container.find(".entry");

                        function getReloadError() {
                            var reloadError = new Error("Reload");
                            reloadError.title = title;
                            reloadError.journeys = journeys;
                            return reloadError;
                        }
                        
                        if (journeys.length === 0 && $entries.length === 1 &&
                                $entries.first().data("empty")) {
                            return;
                        } else if ($entries.length !== journeys.length) {
                            throw getReloadError();
                        } else {
                            $entries.each(function (index, entry) {
                                var journey = journeys[index],
                                    stop = journey.departure,
                                    direction = stop._direction,
                                    route = direction._route,
                                    $entry = $(entry),
                                    routeTag = $entry.attr("data-route"),
                                    dirTag = $entry.attr("data-direction"),
                                    stopTag = $entry.attr("data-stop");
                                
                                if (routeTag !== route.tag ||
                                        dirTag !== direction.tag ||
                                        stopTag !== stop.tag) {
                                    throw getReloadError();
                                } else {
                                    var departurePrediction = journey.departurePrediction,
                                        arrivalPrediction = journey.feasibleArrivalPrediction,
                                        finalPrediction = journey.finalPrediction,
                                        $departurePred = $entry.find(".entry__title .entry__minutes"),
                                        $arrivalPreds = $entry.find(".entry__subtitle .entry__minutes"),
                                        $arrivalPred = $arrivalPreds.eq(0),
                                        $finalPred = $arrivalPreds.eq(1);
                                    
                                    $departurePred.text(departurePrediction.minutes);
                                    $arrivalPred.text(arrivalPrediction.minutes);
                                    $finalPred.text(finalPrediction.minutes);
                                }
                            });
                        }
                    }
                    
                    function reloadJourneys(err) {
                        list.showList(err.title, Q.when(err.journeys), options);
                    }
                    
                    var refreshPromise = geo.getLocation()
                        .then(getJourneysAtPlace)
                        .spread(refreshJourneysAtPosition)
                        .fail(reloadJourneys);
                    
                    return refreshPromise;
                }
            };
        
        geo.getLocation().then(function (position) {
            var meters = geo.distance(position, place),
                miles = geo.kilometersToMiles(meters),
                distance = distanceTemplate({miles: miles}),
                title = place.title + " -" + distance,
                listPromise = journeys.getExplodedJourneys(position, place);
            
            setRecentPlace(place);
            list.showList(title, listPromise, options);
        }).done();
    }
    
    function showAllJourneys(showAll) {
        var placeList = places.getAllPlaces(),
            options = {
                emptyMessage: "No places.",
                addHref: "#page=places&op=add",
                getEntryHref: function (journeyObj) {
                    var place = journeyObj.place;
                    
                    return "#page=place&place=" + place.id;
                },
                getTags: function (journeyObj) {
                    var place = journeyObj.place,
                        journey = journeyObj.journey;
                    
                    if (journey) {
                        var stop = journey.departure,
                            direction = stop._direction,
                            route = direction._route;
                    
                        return [{tag: "place", value: place.id},
                                {tag: "route", value: route.tag},
                                {tag: "direction", value: direction.tag},
                                {tag: "stop", value: stop.tag}];
                    } else {
                        return [{tag: "place", value: place.id}];
                    }
                },
                getLeft: function (journeyObj) {
                    var place = journeyObj.place,
                        title = place.title,
                        subtitles;
                    
                    if (journeyObj.journey) {
                        var journey = journeyObj.journey,
                            departure = journey.departure,
                            direction = departure._direction,
                            route = direction._route;
                        
                        subtitles = [route.getTitleWithColor() + " - " + direction.name, "@ " + departure.title];
                    } else {
                        title = "<span class='entry__empty'>" + title + "</span>";
                        subtitles = [];
                    }
                    
                    return titleTemplate({title: title, subtitles: subtitles});
                },
                getRight: function (journeyObj) {
                    var place = journeyObj.place,
                        title,
                        subtitles;
                    
                    if (journeyObj.journey) {
                        var journey = journeyObj.journey,
                            departurePred = journey.departurePredictions[0],
                            finalPred = journey.finalPrediction,
                            arrivalPred = journey.feasibleArrivalPredictions[0],
                            arrivalSubtitle = "↪ " + predictionsTemplate({predictions: arrivalPred}),
                            finalSubtitle = "... " + predictionsTemplate({predictions: finalPred});
                        
                        title = predictionsTemplate({predictions: departurePred});
                        subtitles = [arrivalSubtitle, finalSubtitle];
                    } else {
                        title = null;
                        subtitles = null;
                    }
                    
                    return titleTemplate({title: title, subtitles: subtitles});
                },
                getRemoveHref: function (journeyObj) {
                    var place = journeyObj.place;
                    
                    return "#page=places&op=remove&place=" + place.id;
                },
                confirmRemove: function (journeyObj) {
                    var place = journeyObj.place;
                    
                    return window.confirm("Remove place " + place.title + "?");
                },
                refresh: function (force, $container) {
                    var $entries = $container.find(".entry");
                    
                    function getBestJourneysForPosition(position) {
                        if ($entries.length === 1 && $entries.first().data("empty")) {
                            throw new Error("No refresh");
                        } else {
                            return journeys.getBestJourneys(position, placeList, force);
                        }
                    }
                    
                    function refreshWithBestJourneysList(bestJourneysList) {
                        function getRefreshError() {
                            var refreshError = new Error("Refresh");
                            refreshError.bestJourneysList = bestJourneysList;
                            return refreshError;
                        }
                        
                        if ($entries.length === bestJourneysList.length) {
                            $entries.each(function (index, entry) {
                                var journeyObj = bestJourneysList[index],
                                    journey = journeyObj.journey,
                                    place = journeyObj.place,
                                    $entry = $(entry),
                                    placeId = $entry.data("place"),
                                    routeTag = $entry.attr("data-route"),
                                    dirTag = $entry.attr("data-direction"),
                                    stopTag = $entry.attr("data-stop");
                                
                                if (placeId !== place.id) {
                                    throw getRefreshError();
                                }
                                
                                if (journey) {
                                    var departure = journey.departure,
                                        direction = departure._direction,
                                        route = direction._route;
                                    
                                    if (route.tag !== routeTag ||
                                            direction.tag !== dirTag ||
                                            departure.tag !== stopTag) {
                                        throw getRefreshError();
                                    }
                                } else {
                                    if (routeTag || dirTag || stopTag) {
                                        throw getRefreshError();
                                    }
                                }
                                
                                if (journey) {
                                    var departurePrediction = journey.departurePredictions[0],
                                        arrivalPrediction = journey.feasibleArrivalPredictions[0],
                                        finalPrediction = journey.finalPrediction,
                                        $departurePred = $entry.find(".entry__title .entry__minutes"),
                                        $arrivalPreds = $entry.find(".entry__subtitle .entry__minutes"),
                                        $arrivalPred = $arrivalPreds.eq(0),
                                        $finalPred = $arrivalPreds.eq(1);
                                    
                                    $departurePred.text(departurePrediction.minutes);
                                    $arrivalPred.text(arrivalPrediction.minutes);
                                    $finalPred.text(finalPrediction.minutes);
                                }
                            });
                        } else {
                            throw getRefreshError();
                        }
                    }
                    
                    function maybeReload(err) {
                        if (err.message === "Refresh") {
                            Q.nextTick(function () {
                                list.showList("Places", Q.when(err.bestJourneysList), options);
                            });
                        }
                        throw err;
                    }
                    
                    return geo.getLocation()
                        .then(getBestJourneysForPosition)
                        .then(refreshWithBestJourneysList)
                        .fail(maybeReload);
                }
            };
        
        var listPromise = geo.getLocation().then(function (position) {
            if (!showAll && placeList.length >= 1) {
                var recentPlace = getRecentPlace();
                if (placeList.some(function (p) { return p === recentPlace; })) {
                    showJourneys(recentPlace);
                    throw new Error("Redirect");
                }
            }
            
            return journeys.getBestJourneys(position, placeList);
        });
        
        list.showList("Places", listPromise, options);
    }
    
    function showSearch() {
        var GMAPS_SERVER = "https://maps.googleapis.com/maps/api/js",
            GMAPS_PROPS = {
                key: "AIzaSyDFwHG4xaTRwELJ5hk033t1cFoed7EyAy0",
                v: "3.exp",
                sensor: true,
                libraries: "places"
            },
            GMAPS_URL = util.makeURL(GMAPS_SERVER, GMAPS_PROPS);
        
        var SF_LAT_SOUTH = 37.604942,
            SF_LAT_NORTH = 37.813911,
            SF_LON_WEST = -122.521322,
            SF_LON_EAST = -122.352528,
            SF_COUNTRY = "us";
        
        require(["rasync!" + GMAPS_URL], function () {
            var $container = $(searchHtml),
                $searchResults = $container.find(".search__results"),
                $searchControls = $container.find(".search__controls"),
                $searchMap = $container.find(".search__map"),
                $search = $container.find(".search__input"),
                $title = $container.find(".search__title"),
                $add = $container.find(".search__add"),
                $quick = $container.find(".search__quick"),
                swPos = new google.maps.LatLng(SF_LAT_SOUTH, SF_LON_WEST),
                nePos = new google.maps.LatLng(SF_LAT_NORTH, SF_LON_EAST),
                bounds = new google.maps.LatLngBounds(swPos, nePos),
                componentRestrictions = {country: SF_COUNTRY},
                settings = {
                    types: [],
                    bounds: bounds,
                    componentRestrictions: componentRestrictions
                },
                autocompleteService = new google.maps.places.AutocompleteService(),
                placesService = new google.maps.places.PlacesService($searchMap[0]),
                position = null;

            function handlePlaceDetails(result, status) {
                if (status === "OK") {
                    if (result) {
                        position = {
                            lat: result.geometry.location.lat(),
                            lon: result.geometry.location.lng()
                        };
                        $quick.removeAttr("disabled");
                        $add.removeAttr("disabled");
                    }
                }
            }
            
            function handleResultClick(event) {
                var $target = $(event.target),
                    reference = $target.data("reference"),
                    text = $target.text(),
                    title = text.substring(0, text.indexOf(","));

                if (reference) {
                    $search.val(text);
                    $title.val(title);
                    $searchResults.hide();
                    $searchControls.fadeIn();
                    $title.focus();
    
                    placesService.getDetails({
                        reference: reference
                    }, handlePlaceDetails);
                }
            }
            
            function hightlightEntryName(entry) {
                var index = 0,
                    description = "";
                
                entry.matched_substrings.forEach(function (match) {
                    description += entry.description.substring(index, match.offset);
                    index = match.offset;
                    
                    var part = entry.description.substring(index, index + match.length);
                    
                    description += "<b>" + part + "</b>";
                    index += match.length;
                });
                
                description += entry.description.substring(index);
                
                return description;
            }
            
            function handleAutocompleteResults(results, status) {
                if (status === "OK") {
                    var $entries = $("ul");
                    $entries.empty();
                    if (results) {
                        results.forEach(function (entry) {
                            var description = hightlightEntryName(entry),
                                $anchor = $("<a>")
                                    .append(description)
                                    .data("reference", entry.reference)
                                    .on("click", handleResultClick),
                                $entry = $("<li class='topcoat-list__item'>")
                                    .append($anchor);
                            
                            $entries.append($entry);
                        });
                    }
    
                    $("body").animate({scrollTop: $search.parent().offset().top});
                }
            }
            
            function handleAddPlace(event) {
                var title = $title.val();
                    
                places.addPlace(title, position).done(function (place) {
                    location.hash = "#page=place&place=" + place.id;
                });
            }
            
            function handleQuickRoute() {
                var title = $title.val();
                location.hash = "#page=place&lat=" + position.lat + "&lon=" +
                    position.lon + "&title=" + encodeURIComponent(title);
            }
            
            $search.on("keyup paste", function () {
                var input = $search.val(),
                    offset = $search[0].selectionEnd;

                $searchControls.hide();
                if ($searchResults.css("display") === "none") {
                    $searchResults.fadeIn();
                }
                
                if (input && input.length > 0) {
                    autocompleteService.getPlacePredictions({
                        input: input,
                        offset: offset,
                        types: [],
                        bounds: bounds,
                        componentRestrictions: componentRestrictions
                    }, handleAutocompleteResults);
                }
            });
            
            $add.on("click", handleAddPlace)
                .on("keydown", function (event) {
                    switch (event.keyCode) {
                    case 13: // enter
                    case 14: // return
                    case 32: // space
                        handleAddPlace(event);
                        break;
                    }
                });
            $title.on("keydown", function (event) {
                switch (event.keyCode) {
                case 13: // enter
                case 14: // return
                    handleAddPlace(event);
                    break;
                }
            });
            
            $quick.on("click", handleQuickRoute)
                .on("keydown", function (event) {
                    switch (event.keyCode) {
                    case 13: // enter
                    case 14: // return
                        handleQuickRoute(event);
                        break;
                    }
                });
            
            var options = {
                backHref: "#page=places"
            };
            
            var deferred = Q.defer(),
                loadPromise = deferred.promise;
            
            deferred.resolve();
            page.showPage("Add Place", $container, loadPromise, options);
        });
    }
    
    loadRecentPlace();
    
    exports.showSearch = showSearch;
    exports.showJourneys = showJourneys;
    exports.showAllJourneys = showAllJourneys;
    exports.showPredictions = showPredictions;
    exports.refreshPage = page.refreshPage;
});
