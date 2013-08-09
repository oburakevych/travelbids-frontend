'use strict';

/* Filters */

var filtersModule = angular.module('myApp.filters', []);
  
filtersModule.filter('readableTime', [function() {
    return function(millisLeft) {
    	return TimeUtil.millisToReadableText(millisLeft);
    }
}]);