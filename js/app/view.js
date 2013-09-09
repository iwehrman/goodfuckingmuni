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
    
    var RECENT_PLACE_TIMEOUT = 1000 * 60 * 10, // 10 minutes
        RECENT_PLACE_KEY = "org.wehrman.muni.view.recent_place";
    
    var firstLoad = true,
        recentPlace = null,
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
        var deferred = $.Deferred(),
            listPromise = deferred.promise();
        
        routes.getRoute(routeTag).done(function (route) {
            var stop = route.stops[stopTag],
                title = stop.title,
                options = {
                    emptyMessage: "No predictions found.",
                    backHref: "#page=place&" + (place.id !== undefined ? "place=" + place.id +
                                                (entryOp === "arrivals" ? "&op=arrivals" : "") :
                            "op=arrivals&lat=" + place.lat + "&lon=" + place.lon +
                            "&title=" + encodeURIComponent(place.title)),
                    getLeft: function (prediction) {
                        return predictionsTemplate({predictions: prediction});
                    },
                    refresh: function (force, $container) {
                        var deferred = $.Deferred();
                        
                        preds.getPredictions(routeTag, stopTag, force).done(function (newPredictions) {
                            var $entries = $container.find(".entry");
                            if ($entries.length === newPredictions.length) {
                                $entries.each(function (index, entry) {
                                    $(entry).find(".entry__minutes").each(function (_index, minutes) {
                                        $(minutes).text(newPredictions[index].minutes);
                                    });
                                });
                                deferred.resolve();
                            } else {
                                var listPromise = $.Deferred().resolve(newPredictions).promise();
                                list.showList(title, listPromise, options);
                                deferred.reject();
                            }
                        }).fail(function () {
                            deferred.resolve();
                        });
                        
                        return deferred.promise();
                    }
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
    
        list.showList("Routes", routes.getRouteList(), options);
    }
    
    function showPlace(place) {
        var predictionsPromise = preds.getPredictionsForMultiStops(place.stops),
            title = place.title,
            routeObjMap = {},
            deferred = $.Deferred(),
            listPromise = deferred.promise();
        
        function refreshPredictions(force, $container) {
            var deferred = $.Deferred();
            
            function updateEntries(predictionObjects) {
                $container.find(".entry").each(function (index, entry) {
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
                
                return deferred.promise();
            }
            
            preds.getPredictionsForMultiStops(place.stops, force)
                .progress(updateEntries)
                .done(updateEntries)
                .fail(updateEntries.bind(null, {}));
            
            return deferred.promise();
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
        
        setRecentPlace(place);
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
    
    function showJourneys(place) {
        var locationPromise = geo.getLocation(),
            deferred = $.Deferred(),
            listPromise = deferred.promise(),
            options = {
                emptyMessage: "No routes found.",
                backHref: place.id !== undefined ? "#page=places&op=arrivals&first=0" : "#page=places&op=add",
                getEntryHref: function (journey) {
                    var stop = journey.departure,
                        direction = stop._direction,
                        route = direction._route,
                        placeFrag = place.id !== undefined ? "place=" + place.id :
                                "lat=" + place.lat + "&lon=" + place.lon + "&title=" +
                                encodeURIComponent(place.title);
                
                    return "#page=predictions&route=" + route.tag + "&direction=" + direction.tag +
                        "&stop=" + stop.tag + "&" + placeFrag + "&op=arrivals";
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
                    var departurePred = journey.departurePredictions[0],
                        arrivalPred = journey.feasibleArrivalPredictions[0],
                        title = predictionsTemplate({predictions: departurePred}),
                        subtitles = ["↪" + predictionsTemplate({predictions: arrivalPred})],
                        titleHtml = titleTemplate({title: title, subtitles: subtitles});
    
                    return titleHtml;
                },
                refresh: function (force, $container) {
                    var deferred = $.Deferred();
                    
                    geo.getLocation().done(function (position) {
                        var meters = geo.distance(position, place),
                            miles = geo.kilometersToMiles(meters),
                            distance = distanceTemplate({miles: miles}),
                            title = place.title + " -" + distance;
                        
                        journeys.getJourneys(position, place, force).done(function (journeys) {
                            var $entries = $container.find(".entry");
                            if ($entries.length !== journeys.length) {
                                deferred.reject();
                                list.showList(title, $.Deferred().resolve(journeys), options);
                            } else {
                                try {
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
                                            throw "Refresh";
                                        } else {
                                            var departurePrediction = journey.departurePredictions[0],
                                                arrivalPrediction = journey.feasibleArrivalPredictions[0],
                                                $departurePred = $entry.find(".entry__title .entry__minutes"),
                                                $arrivalPred = $entry.find(".entry__subtitle .entry__minutes");
                                            
                                            $departurePred.text(departurePrediction.minutes);
                                            $arrivalPred.text(arrivalPrediction.minutes);
                                        }
                                    });
                                    deferred.resolve();
                                } catch (err) {
                                    deferred.reject();
                                    list.showList(title, $.Deferred().resolve(journeys), options);
                                }
                            }
                            
                        }).fail(function () {
                            deferred.resolve();
                        });
                    }).fail(function () {
                        deferred.resolve();
                    });
                    
                    return deferred.promise();
                }
            };
        
        locationPromise.done(function (position) {
            var meters = geo.distance(position, place),
                miles = geo.kilometersToMiles(meters),
                distance = distanceTemplate({miles: miles}),
                title = place.title + " -" + distance;
            
            setRecentPlace(place);
            list.showList(title, listPromise, options);
            
            journeys.getJourneys(position, place).done(function (journeys) {
                deferred.resolve(journeys);
            }).fail(function (err) {
                deferred.reject(err);
            });
        }).fail(function (err) {
            deferred.reject(err);
        });
    }
    
    function showAllJourneys(showAll) {
        var placeList = places.getAllPlaces(),
            deferred = $.Deferred(),
            listPromise = deferred.promise();
        
        function getBestJourneys(position, force) {
            var deferred = $.Deferred();
            
            async.map(placeList, function (place, callback) {
                journeys.getJourneys(position, place, force).done(function (journeys) {
                    callback(null, {
                        place: place,
                        journeys: journeys
                    });
                }).fail(function (err) {
                    callback(err);
                });
            }, function (err, journeyObjs) {
                if (err) {
                    deferred.reject(err);
                } else {
                    var bestJourneyList = journeyObjs
                        .map(function (journeyObj) {
                            var bestJourneyObj = {
                                position: position,
                                place: journeyObj.place
                            };
                            
                            if (journeyObj.journeys.length > 0) {
                                bestJourneyObj.journey = journeyObj.journeys[0];
                            }
                            
                            return bestJourneyObj;
                        })
                        .sort(function (journeyObj1, journeyObj2) {
                            if (journeyObj1.journey) {
                                return journeyObj2.journey ? 0 : -1;
                            } else {
                                return journeyObj2.journey ? 1 : 0;
                            }
                        });
    
                    deferred.resolve(bestJourneyList);
                }
            });
            
            return deferred.promise();
        }
        
        var options = {
            emptyMessage: "No places found.",
            addHref: "#page=places&op=add",
            getEntryHref: function (journeyObj) {
                var place = journeyObj.place;
                
                return "#page=place&place=" + place.id + "&op=arrivals";
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
                        arrivalPred = journey.feasibleArrivalPredictions[0];

                    title = predictionsTemplate({predictions: departurePred});
                    subtitles = ["↪ " + predictionsTemplate({predictions: arrivalPred})];
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
                var deferred = $.Deferred();
                
                geo.getLocation()
                    .then(function (position) { return getBestJourneys(position, force); })
                    .then(function (bestJourneysList) {
                        var $entries = $container.find(".entry");
                        if ($entries.length === bestJourneysList.length) {
                            try {
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
                                        throw "Refresh";
                                    }
                                    
                                    if (journey) {
                                        var departure = journey.departure,
                                            direction = departure._direction,
                                            route = direction._route;
                                        
                                        if (route.tag !== routeTag ||
                                                direction.tag !== dirTag ||
                                                departure.tag !== stopTag) {
                                            throw "Refresh";
                                        }
                                    } else {
                                        if (routeTag || dirTag || stopTag) {
                                            throw "Refresh";
                                        }
                                    }
                                    
                                    if (journey) {
                                        var departurePrediction = journey.departurePredictions[0],
                                            arrivalPrediction = journey.feasibleArrivalPredictions[0],
                                            $departurePred = $entry.find(".entry__title .entry__minutes"),
                                            $arrivalPred = $entry.find(".entry__subtitle .entry__minutes");
                                        
                                        $departurePred.text(departurePrediction.minutes);
                                        $arrivalPred.text(arrivalPrediction.minutes);
                                    }
                                });
                                deferred.resolve();
                            } catch (e) {
                                deferred.reject();
                                list.showList("Places", $.Deferred().resolve(bestJourneysList), options);
                            }
                        } else {
                            deferred.reject();
                            list.showList("Places", $.Deferred().resolve(bestJourneysList), options);
                        }
                    });
                                
                return deferred.promise();
            }
        };
        
        list.showList("Places", listPromise, options);
        
        geo.getLocation().done(function (position) {
            if (placeList.length >= 1) {
                var recentPlace = getRecentPlace();
                if (firstLoad &&
                        placeList.some(function (p) { return p === recentPlace; })) {
                    deferred.reject();
                    return showJourneys(recentPlace);
                }
            }
            
            getBestJourneys(position).done(deferred.resolve, deferred.reject);
            
        }).always(function () {
            firstLoad = false;
        }).fail(function (err) {
            console.error("[showAllJourneys] failed to geolocate: " + err);
            deferred.reject(err);
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
            var stopObjs = [],
                deferred = $.Deferred();
            
            placeList.forEach(function (place) {
                stopObjs = stopObjs.concat(place.stops);
            });
            preds.getPredictionsForMultiStops(stopObjs, force).always(function () {
                deferred.resolve();
            });
            
            return deferred.promise();
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
            if (placeList.length >= 1) {
                if (entryOp === "arrivals") {
                    var recentPlace = getRecentPlace();
                    if (firstLoad &&
                            placeList.some(function (p) { return p === recentPlace; })) {
                        deferred.reject();
                        return showJourneys(recentPlace);
                    }
                } else if (!showAll) {
                    if (geo.distance(position, placeList[0]) < NEARBY_IN_KM &&
                            (placeList.length < 2 ||
                            geo.distance(position, placeList[1]) >= NEARBY_IN_KM)) {
                        deferred.reject();
                        return showPlace(placeList[0]);
                    }
                }
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
        }).always(function () {
            firstLoad = false;
        }).fail(function (err) {
            console.error("[showPlaces] failed to geolocate: " + err);
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
    
    loadRecentPlace();
    
    exports.showSearch = showSearch;
    exports.showJourneys = showJourneys;
    exports.showAllJourneys = showAllJourneys;
    exports.showPlaces = showPlaces;
    exports.showPlace = showPlace;
    exports.showRoutes = showRoutes;
    exports.showDirections = showDirections;
    exports.showStops = showStops;
    exports.showPredictions = showPredictions;
    exports.refreshPage = page.refreshPage;
});
