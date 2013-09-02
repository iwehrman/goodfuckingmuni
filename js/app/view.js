/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console, google */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        async = require("async"),
        mustache = require("mustache"),
        geo = require("app/geolocation"),
        places = require("app/places"),
        routes = require("app/routes"),
        preds = require("app/predictions"),
        journeys = require("app/journeys"),
        page = require("app/page"),
        list = require("app/list");
    
    var NEARBY_IN_KM = 0.5;
    
    var _distanceHtml = require("text!html/distance.html"),
        _predictionsHtml = require("text!html/predictions.html"),
        _titleHtml = require("text!html/title.html"),
        searchHtml = require("text!html/search.html");
    
    var distanceTemplate = mustache.compile(_distanceHtml),
        predictionsTemplate = mustache.compile(_predictionsHtml),
        titleTemplate = mustache.compile(_titleHtml);

    var $body = $("body"),
        $content = $body.find(".content");
    
    function showPredictions(place, routeTag, stopTag) {
        var deferred = $.Deferred(),
            listPromise = deferred.promise();
        
        routes.getRoute(routeTag).done(function (route) {
            function refreshPredictions(force) {
                preds.getPredictions(routeTag, stopTag, force).done(function (newPredictions) {
                    $content.find(".entry").each(function (index, entry) {
                        var $entry = $(entry);
                        
                        $entry.find(".entry__minutes").each(function (_index, minutes) {
                            if (index < newPredictions.length) {
                                $(minutes).text(newPredictions[index].minutes);
                                return true;
                            } else {
                                return false;
                            }
                        });
                    });
                });
            }
            
            var stop = route.stops[stopTag],
                title = stop.title,
                options = {
                    emptyMessage: "No predictions found.",
                    backHref: "#page=place&" + (place.id !== undefined ? "place=" + place.id :
                            "op=arrivals&lat=" + place.lat + "&lon=" + place.lon +
                            "&title=" + encodeURIComponent(place.title)),
                    getLeft: function (prediction) {
                        return predictionsTemplate({predictions: prediction});
                    },
                    refresh: refreshPredictions
                };

            list.showList(title, listPromise, options);
        
            preds.getPredictions(routeTag, stopTag).done(function (predictions) {
                deferred.resolve(predictions);
            }).fail(function (err) {
                deferred.reject(err);
            });
        
        }).fail(function (err) {
            console.error("[showPredictions] failed to get route: " + err);
            deferred.reject();
        });
    }
    
    function showStops(place, routeTag, dirTag, scroll) {
        var locationPromise = geo.getLocation(),
            deferred = $.Deferred(),
            listPromise = deferred.promise();
    
        routes.getRoute(routeTag).done(function (route) {
            var direction = route.directions[dirTag],
                title = route.title + ": " + direction.name,
                options = {
                    emptyMessage: "No stops found.",
                    backHref: "#page=directions&place=" + place.id + "&route=" + routeTag,
                    getHighlight: function (stopInfo, index) {
                        return stopInfo.isClosest;
                    },
                    getEntryHref: function (stopInfo) {
                        var stop = stopInfo.stop;
                        
                        return "#page=place&op=add&place=" + place.id +
                            "&route=" + routeTag + "&direction=" + dirTag +
                            "&stop=" + stop.tag;
                    },
                    getLeft: function (stopInfo) {
                        var stop = stopInfo.stop;
                        
                        return stop.title;
                    },
                    getRight: function (stopInfo) {
                        var stop = stopInfo.stop;
                        
                        return stop.isApproaching(place) ? "&ensp;&rarr;" : "&larr;&ensp;";
                    },
                    scroll: scroll
                };
            
            list.showList(title, listPromise, options);
    
            locationPromise.done(function (position) {
                var closestStop = direction.getClosestStop(position),
                    stopInfoList = direction.stops.map(function (stop) {
                        return {
                            stop: stop,
                            isClosest: stop === closestStop
                        };
                    });
                
                deferred.resolve(stopInfoList);
            }).fail(function (err) {
                deferred.reject(err);
            });
            
        }).fail(function (err) {
            console.error("[showStops] failed to get route: " + err);
            deferred.reject(err);
        });
    }
    
    function showDirections(place, routeTag) {
        var deferred = $.Deferred(),
            listPromise = deferred.promise();
        
        routes.getRoute(routeTag).done(function (route) {
            var directions = [],
                dirTag;

            for (dirTag in route.directions) {
                if (route.directions.hasOwnProperty(dirTag)) {
                    directions.push(route.directions[dirTag]);
                }
            }
            
            directions.sort(function (a, b) {
                return a.title > b.title;
            });

            deferred.resolve(directions);

            var options = {
                emptyMessage: "No directions found.",
                backHref: "#page=routes&place=" + place.id,
                getEntryHref: function (direction) {
                    var routeTag = route.tag;
                    return "#page=stops&place=" + place.id +
                        "&route=" + routeTag + "&direction=" + direction.tag;
                },
                getLeft: function (direction) {
                    var title = direction.title,
                        stop = direction.getClosestStop(place),
                        subtitles = [stop.title];
                    
                    return titleTemplate({title: title, subtitles: subtitles});
                },
                getRight: function (direction) {
                    var stop = direction.getClosestStop(place),
                        kilometers = stop.distanceFrom(place),
                        miles = geo.kilometersToMiles(kilometers),
                        title = distanceTemplate({miles: miles}),
                        titleHtml = titleTemplate({title: title});
                        
                    return titleHtml;
                }
            };
                
            list.showList(route.title, listPromise, options);

        }).fail(function (err) {
            console.error("[showDirections] failed to get route: " + err);
            deferred.reject(err);
        });
    }
    
    function showRoutes(place) {
        var options = {
            emptyMessage: "No routes found.",
            backHref: "#page=place&place=" + place.id,
            getEntryHref: function (route) {
                var routeTag = route.tag;
                return "#page=directions&place=" + place.id +
                    "&route=" + routeTag;
            },
            getLeft: function (route) {
                return route.title;
            }
        };
    
        list.showList("Routes", routes.getRoutes(), options);
    }
    
    function showPlace(place) {
        var predictionsPromise = preds.getPredictionsForMultiStops(place.stops),
            title = place.title,
            routeObjMap = {},
            deferred = $.Deferred(),
            listPromise = deferred.promise();
        
        function refreshPredictions(force) {
            function updateEntries(predictionObjects) {
                $content.find(".entry").each(function (index, entry) {
                    var $entry = $(entry),
                        data = entry.dataset,
                        routeTag = data.route,
                        stopTag = data.stop,
                        predictionRoute = predictionObjects[routeTag],
                        predictions;
                    
                    if (predictionRoute && predictionRoute[stopTag]) {
                        predictions = predictionRoute[stopTag];
                        $entry.find(".entry__right").animate({opacity: 1.0});
                        $entry.find(".entry__minutes").each(function (index, minutes) {
                            if (index < 3 && predictions.length > index) {
                                $(minutes).text(predictions[index].minutes);
                                return true;
                            } else {
                                return false;
                            }
                        });
                    } else {
                        $entry.find(".entry__right").animate({opacity: 0.5});
                    }
                });
            }
            
            preds.getPredictionsForMultiStops(place.stops, force)
                .progress(updateEntries)
                .done(updateEntries)
                .fail(updateEntries.bind(null, {}));
        }
        
        var options = {
            emptyMessage: "No routes found.",
            backHref: "#page=places",
            addHref: "#page=routes&place=" + place.id,
            getEntryHref: function (routeObj) {
                var routeTag = routeObj.route.tag,
                    stopTag = routeObj.stopTag;
                
                return "#page=predictions&place=" + place.id +
                    "&route=" + routeTag + "&stop=" + stopTag;
            },
            getTags: function (routeObj) {
                return [{tag: "route", value: routeObj.route.tag},
                        {tag: "dir", value: routeObj.dirTag},
                        {tag: "stop", value: routeObj.stopTag}];
            },
            getLeft: function (routeObj) {
                var route = routeObj.route,
                    routeTag = route.tag,
                    dirTag = routeObj.dirTag,
                    stopTag = routeObj.stopTag,
                    stop = route.stops[stopTag],
                    stopTitle = "@ " + stop.title,
                    routeTitle = route.getTitleWithColor(),
                    subtitles = [route.directions[dirTag].title, stopTitle];
                
                return titleTemplate({title: routeTitle, subtitles: subtitles});
            },
            getRight: function (routeObj) {
                var predictions = routeObj.predictions;
                
                if (predictions.length) {
                    var firstPrediction = predictions[0],
                        firstPredictionString = predictionsTemplate({
                            predictions: firstPrediction
                        }),
                        lastIndex = Math.min(3, predictions.length),
                        laterPredictions = predictions.slice(1, lastIndex),
                        laterPredictionsString = predictionsTemplate({
                            predictions: laterPredictions
                        });
                    return titleTemplate({
                        title: firstPredictionString,
                        subtitles: [laterPredictionsString]
                    });
                } else {
                    return titleTemplate();
                }
            },
            getRemoveHref: function (routeObj) {
                var route = routeObj.route,
                    routeTag = route.tag,
                    stopTag = routeObj.stopTag;

                return "#page=place&op=remove&place=" + place.id +
                    "&route=" + routeTag + "&stop=" + stopTag;
            },
            confirmRemove: function (routeObj) {
                var route = routeObj.route,
                    dirTag = routeObj.dirTag,
                    stopTag = routeObj.stopTag,
                    stop = route.stops[stopTag];

                return window.confirm("Remove stop " + stop.title + "?");
            },
            refresh: refreshPredictions
        };
        
        list.showList(title, listPromise, options);

        async.map(place.stops, function (stopObj, callback) {
            routes.getRoute(stopObj.routeTag).done(function (route) {
                routeObjMap[route.tag] = route;
                callback(null, {
                    route: route,
                    dirTag: stopObj.dirTag,
                    stopTag: stopObj.stopTag
                });
            }).fail(function (err) {
                callback(err);
            });
        }, function (err, routeObjs) {
            if (err) {
                console.error("[showPlace] failed to get routes: " + err);
                deferred.reject(err);
                return;
            }
            
            predictionsPromise.done(function (predictionObjs) {
                function predictionComparator(a, b) {
                    if (a.predictions.length === 0) {
                        if (b.predictions.length === 0) {
                            return 0;
                        } else {
                            return 1;
                        }
                    } else {
                        if (b.predictions.length === 0) {
                            return -1;
                        } else {
                            return a.predictions[0].seconds - b.predictions[0].seconds;
                        }
                    }
                }
                
                routeObjs.forEach(function (routeObj, index) {
                    var routeTag = routeObj.route.tag,
                        stopTag = routeObj.stopTag;
                    
                    routeObj.predictions = predictionObjs[routeTag][stopTag];
                });
                
                routeObjs.sort(predictionComparator);
                
                deferred.resolve(routeObjs);
            }).fail(function (err) {
                console.error("[showPlace] failed to get predictions: " + err);
                deferred.reject(err);
            });
        });
    }
    
    function showPlaces(showAll, entryOp) {
        var placeList = places.getAllPlaces(),
            deferred = $.Deferred(),
            listPromise = deferred.promise();
        
        function preloadRoutes() {
            var routeList = [];
            placeList.forEach(function (place) {
                place.stops.forEach(function (stopObj) {
                    routeList.push(stopObj.routeTag);
                });
            });
            routeList.forEach(function (routeTag) {
                routes.getRoute(routeTag);
            });
        }
        
        function preloadPredictions(force) {
            var stopObjs = [];
            
            placeList.forEach(function (place) {
                stopObjs = stopObjs.concat(place.stops);
            });
            preds.getPredictionsForMultiStops(stopObjs, force);
        }
        
        var options = {
            emptyMessage: "No places defined.",
            addHref: "#page=places&op=add",
            getEntryHref: function (placeInfo) {
                var place = placeInfo.place;
                
                return "#page=place&place=" + place.id + (entryOp ? "&op=" + entryOp : "");
            },
            getLeft: function (placeInfo) {
                var place = placeInfo.place;
                
                return titleTemplate(place);
            },
            getRight: function (placeInfo) {
                var place = placeInfo.place,
                    position = placeInfo.position,
                    meters = geo.distance(position, place),
                    miles = geo.kilometersToMiles(meters),
                    distance = distanceTemplate({miles: miles});
                return titleTemplate({title: distance});
            },
            getRemoveHref: function (placeInfo) {
                var place = placeInfo.place;
                
                return "#page=places&op=remove&place=" + place.id;
            },
            confirmRemove: function (placeInfo) {
                var place = placeInfo.place;
                
                return window.confirm("Remove place " + place.title + "?");
            },
            refresh: preloadPredictions
        };
        
        list.showList("Places", listPromise, options);
        
        geo.sortByCurrentLocation(placeList).done(function (position) {
            if (!showAll && placeList.length >= 1 &&
                    geo.distance(position, placeList[0]) < NEARBY_IN_KM &&
                    (placeList.length < 2 ||
                        geo.distance(position, placeList[1]) >= NEARBY_IN_KM)) {
                
                deferred.reject();
                return showPlace(placeList[0]);
            }
            
            var placeInfoList = placeList.map(function (place) {
                return {
                    place: place,
                    position: position
                };
            });
            
            deferred.resolve(placeInfoList);
            
            // warm up cache
            preloadRoutes();
            preloadPredictions();
        }).fail(function (err) {
            console.error("[showPlaces] failed to geolocate: " + err);
            deferred.reject(err);
        });
    }
    
    function showJourneys(place) {
        var locationPromise = geo.getLocation(),
            deferred = $.Deferred(),
            listPromise = deferred.promise(),
            options = {
                emptyMessage: "No routes found.",
                backHref: place.id !== undefined ? "#page=places&op=arrivals" : "#page=places&op=add",
                getEntryHref: function (journey) {
                    var stop = journey.departure,
                        direction = stop._direction,
                        route = direction._route,
                        placeFrag = place.id !== undefined ? "place=" + place.id :
                                "lat=" + place.lat + "&lon=" + place.lon + "&title=" +
                                encodeURIComponent(place.title);
                
                    return "#page=predictions&route=" + route.tag + "&direction=" + direction.tag +
                        "&stop=" + stop.tag + "&" + placeFrag;
                },
                getLeft: function (journey) {
                    var stop = journey.departure,
                        direction = stop._direction,
                        route = direction._route,
                        title = route.getTitleWithColor(),
                        subtitles = [direction.title, stop.title];
                    
                    return titleTemplate({title: title, subtitles: subtitles});
                },
                getRight: function (journey) {
                    var stop = journey.arrival,
                        pred = journey.departurePredictions[0],
                        title = predictionsTemplate({predictions: pred}),
                        subtitles = [stop.title],
                        titleHtml = titleTemplate({title: title, subtitles: subtitles});
    
                    return titleHtml;
                }
            };
        
        list.showList(place.title, listPromise, options);
        
        locationPromise.done(function (position) {
            journeys.getJourneys(position, place).done(function (journeys) {
                deferred.resolve(journeys);
            }).fail(function (err) {
                deferred.reject(err);
            });
        }).fail(function (err) {
            deferred.reject(err);
        });
    }

    function showSearch() {
        require(["rasync!https://maps.googleapis.com/maps/api/js?key=AIzaSyDFwHG4xaTRwELJ5hk033t1cFoed7EyAy0&v=3.exp&sensor=true&libraries=places"], function () {
            var $loadPromise = $.Deferred().resolve(),
                $container = $(searchHtml),
                $searchResults = $container.find(".search__results"),
                $searchControls = $container.find(".search__controls"),
                $searchMap = $container.find(".search__map"),
                $search = $container.find(".search__input"),
                $title = $container.find(".search__title"),
                $add = $container.find(".search__add"),
                $quick = $container.find(".search__quick"),
                swPos = new google.maps.LatLng(37.604942, -122.521322),
                nePos = new google.maps.LatLng(37.813911, -122.352528),
                bounds = new google.maps.LatLngBounds(swPos, nePos),
                componentRestrictions = {country: "us"},
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
                location.hash = "#page=place&op=arrivals&lat=" + position.lat + "&lon=" +
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
            
            page.showPage("Add Place", $container, $loadPromise, options);
        });
    }
    
    exports.showSearch = showSearch;
    exports.showJourneys = showJourneys;
    exports.showPlaces = showPlaces;
    exports.showPlace = showPlace;
    exports.showRoutes = showRoutes;
    exports.showDirections = showDirections;
    exports.showStops = showStops;
    exports.showPredictions = showPredictions;
    exports.refreshPage = page.refreshPage;
});
