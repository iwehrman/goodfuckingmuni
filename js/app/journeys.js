/*jslint vars: true, plusplus: true, browser: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, console */

define(function (require, exports, module) {
    "use strict";
    
    var $ = require("jquery"),
        Q = require("q"),
        routes = require("app/routes"),
        preds = require("app/predictions"),
        geo = require("app/geolocation");
    
    var MUNI_TOLERANCE = 0.71;
    
    var journeyCache = {};
    
    function positionKey(pos) {
        return pos.lat.toFixed(5) + "," + pos.lon.toFixed(5);
    }
    
    function getJourneys(begin, end, force) {
        function filterArrivalsByDepartures(departures, arrivals) {
            var feasibleArrivals = [],
                departureIndex = 0,
                arrivalIndex = 0,
                departure,
                arrival,
                vehicle;
    
            while (departureIndex < departures.length) {
                departure = departures[departureIndex++];
                vehicle = departure.vehicle;
                
                while (arrivalIndex < arrivals.length) {
                    arrival = arrivals[arrivalIndex++];
                    if (arrival.vehicle === vehicle) {
                        feasibleArrivals.push(arrival);
                        break;
                    }
                }
            }
            
            return feasibleArrivals;
        }
        
        function getJourneysForRoutes(allRoutes) {
            var journeys,
                endKey = positionKey(end),
                beginKey = positionKey(begin),
                cachedBegin = journeyCache[endKey],
                cachedJourneys = cachedBegin && cachedBegin[beginKey];
            
            if (cachedJourneys) {
                journeys = cachedJourneys.slice(0);
            } else {
                journeys = [];
                
                allRoutes.forEach(function (route) {
                    var directions = [],
                        bestJourney = null,
                        dirTag;
        
                    for (dirTag in route.directions) {
                        if (route.directions.hasOwnProperty(dirTag)) {
                            directions.push(route.directions[dirTag]);
                        }
                    }
                    
                    directions.forEach(function (direction) {
                        var journey = direction.getJourney(end, begin);
                        
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
                
                var totalDistance = geo.distance(begin, end);
                console.log("Total distance " + totalDistance);
                journeys = journeys.filter(function (journey) {
                    console.log("Walk length " + journey.departure._direction._route.tag,
                                journey.currentToDeparture.toFixed(2),
                                journey.arrivalToDestination.toFixed(2),
                                journey.walkingLength.toFixed(2));
                    if (journey.walkingLength > totalDistance * MUNI_TOLERANCE) {
                        console.log("Long walk " + journey.departure._direction._route.tag,
                                    journey.walkingLength.toFixed(2), totalDistance.toFixed(2));
                        return false;
                    } else {
                        console.log("Riding fraction for " + journey.departure._direction._route.tag,
                                    ((totalDistance - journey.walkingLength) / totalDistance).toFixed(2));
                        return true;
                    }
                });
                
                cachedBegin = {};
                cachedBegin[beginKey] = journeys;
                journeyCache[endKey] = cachedBegin;
            }
            
            return journeys;
        }
        
        function getPredictionsForJourneys(journeys) {
            
            function annotateJourneysWithPredictions(predictions) {
                journeys.forEach(function (journey) {
                    var departure = journey.departure,
                        arrival = journey.arrival,
                        direction = departure._direction,
                        route = direction._route,
                        preds = predictions[route.tag];
                    
                    journey.departurePredictions = preds[departure.tag];
                    journey.arrivalPredictions = preds[arrival.tag];
                });
                
                return journeys;
            }
            
            var stopObjs = [];
            journeys.map(function (journey) {
                var departure = journey.departure,
                    arrival = journey.arrival,
                    route = departure._direction._route;
                    
                stopObjs.push({
                    stopTag: departure.tag,
                    routeTag: route.tag
                });
                
                stopObjs.push({
                    stopTag: arrival.tag,
                    routeTag: route.tag
                });
            });
            
            return preds.getPredictionsForMultiStops(stopObjs, force)
                .then(annotateJourneysWithPredictions);
        }
        
        function filterJourneysWithPredictions(journeys) {
            journeys = journeys.filter(function (journey) {
                var preds = journey.departurePredictions;
                
                if (preds.length === 0) {
                    console.log("No departures for route " +
                                journey.departure._direction._route.tag);
                }
                
                return preds.length > 0;
            });
            
            journeys.forEach(function (journey) {
                var preds = journey.departurePredictions,
                    departure = journey.departure,
                    secondsAway = departure.secondsFromWalking(begin),
                    index;
                
                for (index = 0; index < preds.length; index++) {
                    if (preds[index].seconds > secondsAway) {
                        break;
                    } else {
                        console.log("Infeasible departure " +
                                    journey.departure._direction._route.tag,
                                    preds[index].minutes,
                                    (secondsAway / 60).toFixed(2));
                    }
                }
                
                preds.splice(0, index);
            });
            
            journeys = journeys.filter(function (journey) {
                var preds = journey.departurePredictions;
                
                if (preds.length === 0) {
                    console.log("No feasible departures for route " +
                                journey.departure._direction._route.tag);
                }
                
                return preds.length > 0;
            });
            
            journeys = journeys.filter(function (journey) {
                var departures = journey.departurePredictions,
                    arrivals = journey.arrivalPredictions,
                    feasibleArrivals = filterArrivalsByDepartures(departures, arrivals);
                
                if (feasibleArrivals.length > 0) {
                    journey.feasibleArrivalPredictions = feasibleArrivals;
                    
                    var arrivalStopTime = feasibleArrivals[0].seconds,
                        walkTime = geo.walkTime(journey.arrivalToDestination),
                        finalArrivalInSeconds = arrivalStopTime + walkTime;

                    journey.finalPrediction = {
                        seconds: finalArrivalInSeconds,
                        minutes: Math.round(finalArrivalInSeconds / 60)
                    };

                    console.log("Best arrival for " + journey.departure._direction._route.tag,
                                (feasibleArrivals[0].seconds / 60).toFixed(2),
                                journey.finalPrediction.minutes);
                    
                    return true;
                } else {
                    console.log("No feasible arrivals for " +
                                journey.departure._direction._route.tag);
                    return false;
                }
            });

            journeys.sort(function (journey1, journey2) {
                return journey1.finalPrediction.seconds - journey2.finalPrediction.seconds;
            });
            
            journeys.forEach(function (journey1) {
                var pred1 = journey1.feasibleArrivalPredictions,
                    arrival1 = pred1[0].seconds,
                    walk1 = geo.walkTime(journey1.arrivalToDestination),
                    dest1 = arrival1 + walk1,
                    departure = journey1.departurePredictions[0].minutes;
                
                console.log("Arrival for " + journey1.departure._direction._route.tag,
                            journey1.departure.title + " in " + departure,
                            journey1.arrival.title + " in " + (arrival1 / 60).toFixed(2),
                            (walk1 / 60).toFixed(2));
            });
            
            return journeys;
        }
        
        return routes.getAllRoutes()
            .then(getJourneysForRoutes)
            .then(getPredictionsForJourneys)
            .then(filterJourneysWithPredictions);
    }
    
    function getBestJourneys(position, placeList, force) {
        var journeyPromises = placeList.map(function (place) {
            return Q.all([place, getJourneys(position, place, force)]);
        });
        
        return Q.all(journeyPromises).then(function (journeyObjs) {
            return journeyObjs.map(function (journeyObj) {
                var place = journeyObj[0],
                    journeys = journeyObj[1],
                    bestJourneyObj = {
                        position: position,
                        place: place
                    };
                    
                if (journeys.length > 0) {
                    bestJourneyObj.journey = journeys[0];
                }
                
                return bestJourneyObj;
            }).sort(function (journeyObj1, journeyObj2) {
                if (journeyObj1.journey) {
                    return journeyObj2.journey ? 0 : -1;
                } else {
                    return journeyObj2.journey ? 1 : 0;
                }
            });
        });
    }

    exports.getJourneys = getJourneys;
    exports.getBestJourneys = getBestJourneys;
});
