/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        async = require("async"),
        mustache = require("mustache"),
        routes = require("app/routes"),
        preds = require("app/predictions"),
        places = require("app/places"),
        geo = require("app/geolocation"),
        list = require("app/list");

    var NEARBY_IN_KM = 0.5;
    
    var _distanceHtml = require("text!html/distance.html"),
        _predictionsHtml = require("text!html/predictions.html"),
        _titleHtml = require("text!html/title.html");

    var distanceTemplate = mustache.compile(_distanceHtml),
        predictionsTemplate = mustache.compile(_predictionsHtml),
        titleTemplate = mustache.compile(_titleHtml);

    var $body = $("body"),
        $content = $body.find(".content");
    
    function showPredictions(placeId, routeTag, stopTag) {
        routes.getRoute(routeTag).done(function (route) {
            preds.getPredictions(routeTag, stopTag).done(function (predictions) {
                
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
                    title = stop.title;
                
                var options = {
                    backHref: "#page=place&place=" + placeId,
                    getHighlight: function (prediction) { return false; },
                    getLeft: function (prediction) {
                        return predictionsTemplate({predictions: prediction});
                    },
                    refresh: refreshPredictions
                };
                
                list.showList(title, predictions, options);
            }).fail(function (err) {
                console.error("[showPredictions] failed to get predictions: " + err);
            });
        }).fail(function (err) {
            console.error("[showPredictions] failed to get route: " + err);
        });
    }
    
    function showStops(placeId, routeTag, dirTag, scroll) {
        var locationPromise = geo.getLocation(),
            place = places.getPlace(placeId);
    
        routes.getRoute(routeTag).done(function (route) {
            locationPromise.done(function (position) {
                var direction = route.directions[dirTag],
                    title = route.title + ": " + direction.name,
                    closestStop = direction.getClosestStop(position);
                
                var options = {
                    backHref: "#page=directions&place=" + placeId + "&route=" + routeTag,
                    getHighlight: function (stop, index) {
                        return stop === closestStop;
                    },
                    getEntryHref: function (stop) {
                        return "#page=place&op=add&place=" + placeId +
                            "&route=" + routeTag + "&direction=" + dirTag +
                            "&stop=" + stop.tag;
                    },
                    getLeft: function (stop) {
                        return stop.title;
                    },
                    getRight: function (stop) {
                        return stop.isApproaching(place) ? "&ensp;&rarr;" : "&larr;&ensp;";
                    },
                    scroll: scroll
                };
                
                list.showList(title, direction.stops, options);
            });
        }).fail(function (err) {
            console.error("[showStops] failed to get route: " + err);
        });
    }
    
    function showDirections(placeId, routeTag) {
        var locationPromise = geo.getLocation(),
            place = places.getPlace(placeId);
        
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

            locationPromise.done(function (position) {
                var options = {
                    backHref: "#page=routes&place=" + placeId,
                    getEntryHref: function (direction) {
                        var routeTag = route.tag;
                        return "#page=stops&place=" + placeId +
                            "&route=" + routeTag + "&direction=" + direction.tag;
                    },
                    getLeft: function (direction) {
                        var title = direction.title,
                            departure = direction.getClosestApproachingStop(place, position),
                            subtitle = departure ? departure.title : "",
                            subtitles = [subtitle];
                        
                        return titleTemplate({title: title, subtitles: subtitles});
                    },
                    getRight: function (direction) {
                        var stop = direction.getClosestStop(place),
                            kilometers = direction.journeyLength(place, position),
                            miles = geo.kilometersToMiles(kilometers),
                            title = distanceTemplate({miles: miles}),
                            subtitles = [stop.title],
                            titleHtml = titleTemplate({title: title, subtitles: subtitles});
                            
                        return titleHtml;
                    }
                };
                
                list.showList(route.title, directions, options);
            });
        }).fail(function (err) {
            console.error("[showDirections] failed to get route: " + err);
        });
    }
    
    function showRoutes(placeId) {
        routes.getRoutes().done(function (routes) {
            var options = {
                backHref: "#page=place&place=" + placeId,
                getEntryHref: function (route) {
                    var routeTag = route.tag;
                    return "#page=directions&place=" + placeId +
                        "&route=" + routeTag;
                },
                getLeft: function (route) {
                    return route.title;
                }
            };
        
            list.showList("Routes", routes, options);
        }).fail(function (err) {
            console.error("[showRoutes] failed to get routes: " + err);
        });
    }
    
    function showPlace(placeId) {
        var place = places.getPlace(placeId),
            predictionsPromise = preds.getPredictionsForMultiStops(place.stops),
            title = place.title,
            routeObjMap = {};

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
                
                routeObjs.forEach(function (routeObj, index) {
                    var routeTag = routeObj.route.tag,
                        stopTag = routeObj.stopTag;
                    
                    routeObj.predictions = predictionObjs[routeTag][stopTag];
                });
                
                routeObjs.sort(predictionComparator);
                
                var options = {
                    backHref: "#page=places",
                    addHref: "#page=routes&place=" + placeId,
                    getEntryHref: function (routeObj) {
                        var routeTag = routeObj.route.tag,
                            stopTag = routeObj.stopTag;
                        
                        return "#page=predictions&place=" + placeId +
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

                        return "#page=place&op=remove&place=" + placeId +
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
                
                list.showList(title, routeObjs, options);
            }).fail(function (err) {
                console.error("[showPlace] failed to get predictions: " + err);
            });
        });
    }
    
    function showPlaces(showAll) {
        var placeList = places.getAllPlaces();
        
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
        
        geo.sortByCurrentLocation(placeList).done(function (position) {
            if (!showAll && placeList.length >= 1 &&
                    geo.distance(position, placeList[0]) < NEARBY_IN_KM &&
                    (placeList.length < 2 ||
                        geo.distance(position, placeList[1]) >= NEARBY_IN_KM)) {
                return showPlace(placeList[0].id);
            }

            var options = {
                addHref: "#page=places&op=add",
                getEntryHref: function (place) {
                    return "#page=place&place=" + place.id;
                },
                getLeft: function (place) {
                    return titleTemplate(place);
                },
                getRight: function (place) {
                    var meters = geo.distance(position, place),
                        miles = geo.kilometersToMiles(meters),
                        distance = distanceTemplate({miles: miles});
                    return titleTemplate({title: distance});
                },
                getRemoveHref: function (place) {
                    return "#page=places&op=remove&place=" + place.id;
                },
                confirmRemove: function (place) {
                    return window.confirm("Remove place " + place.title + "?");
                },
                refresh: preloadPredictions
            };
            
            list.showList("Places", placeList, options);
            
            // warm up cache
            preloadRoutes();
            preloadPredictions();
        }).fail(function (err) {
            console.error("[showPlaces] failed to geolocate: " + err);
        });
    }
    
    function showJourneys(placeId) {
        var locationPromise = geo.getLocation(),
            place = places.getPlace(placeId);
        
        routes.getRoutes().done(function (routeList) {
            locationPromise.done(function (position) {
                async.map(routeList, function (routeObj, callback) {
                    routes.getRoute(routeObj.tag).done(function (route) {
                        callback(null, route);
                    }).fail(function (err) {
                        callback(err);
                    });
                }, function (err, allRoutes) {
                    if (err) {
                        console.error("[showBestStops] failed to get routes: " + err);
                        return;
                    }
                    
                    var journeys = [];
                    allRoutes.map(function (route) {
                        var directions = [],
                            bestJourney = null,
                            dirTag;
            
                        for (dirTag in route.directions) {
                            if (route.directions.hasOwnProperty(dirTag)) {
                                directions.push(route.directions[dirTag]);
                            }
                        }
                        
                        directions.forEach(function (direction) {
                            var journey = direction.getJourney(place, position);
                            
                            if (journey && (!bestJourney || journey.totalLength < bestJourney.totalLength)) {
                                if (journey.arrival !== journey.departure) {
                                    bestJourney = journey;
                                }
                            }
                        });
                        
                        if (bestJourney) {
                            journeys.push(bestJourney);
                        }
                    });
                    
                    journeys.sort(function (journey1, journey2) {
                        var length1 = journey1.walkingLength,
                            length2 = journey2.walkingLength;
                        
                        return length1 - length2;
                    });
                    
                    var options = {
                        backHref: "#page=places",
                        getEntryHref: function (journey) {
                            var stop = journey.departure,
                                direction = stop._direction,
                                route = direction._route;
                            
                            return "#page=predictions&place=" + placeId +
                                "&route=" + route.tag + "&direction=" + direction.tag +
                                "&stop=" + stop.tag;
                        },
                        getLeft: function (journey) {
                            var stop = journey.departure,
                                direction = stop._direction,
                                route = direction._route,
                                title = route.title,
                                subtitles = [direction.title, stop.title];
                            
                            return titleTemplate({title: title, subtitles: subtitles});
                        },
                        getRight: function (journey) {
                            var stop = journey.arrival,
                                direction = stop._direction,
                                journeyMiles = geo.kilometersToMiles(journey.totalLength),
                                walkingMiles = geo.kilometersToMiles(journey.walkingLength),
                                title = distanceTemplate({miles: journeyMiles}),
                                subtitles = [distanceTemplate({miles: walkingMiles}), stop.title],
                                titleHtml = titleTemplate({title: title, subtitles: subtitles});
                                
                            return titleHtml;
                        }
                    };
                    
                    list.showList(place.title, journeys, options);

                });
            });
        });
        
    }

    exports.showJourneys = showJourneys;
    exports.showPlaces = showPlaces;
    exports.showPlace = showPlace;
    exports.showRoutes = showRoutes;
    exports.showDirections = showDirections;
    exports.showStops = showStops;
    exports.showPredictions = showPredictions;
    exports.refreshList = list.refreshList;
});
